import {
  allVideoClips,
  getAudioTracks,
  type AudioClip,
  type EditorState,
  type VideoClip,
} from "../editor/model";
import type { MediaRuntime } from "../media/runtime";
import { computeDrawRegion, exportDurationUs, pickRecorderFormat, videoLayersAt, type RecorderFormat } from "./plan";

const US = 1_000_000;
const EXPORT_FPS = 30;
const VIDEO_DRIFT_THRESHOLD_SECONDS = 0.12;

export type ExportProgress = {
  elapsedUs: number;
  totalUs: number;
};

export type ExportResult = {
  blob: Blob;
  format: RecorderFormat;
  durationUs: number;
};

export type ExportProjectOptions = {
  state: EditorState;
  runtime: MediaRuntime;
  onProgress?: (progress: ExportProgress) => void;
  signal?: AbortSignal;
};

type PreparedVideo = {
  clip: VideoClip;
  element: HTMLVideoElement;
};

type PreparedAudioSource = {
  clip: AudioClip;
  source: AudioBufferSourceNode;
};

type PreparedAudio = {
  context: AudioContext;
  destination: MediaStreamAudioDestinationNode;
  sources: PreparedAudioSource[];
};

function abortError(): DOMException {
  return new DOMException("Export canceled", "AbortError");
}

function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("error", onError);
    };
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Failed to load a video asset"));
    };
    video.addEventListener("loadeddata", onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

function waitForSeek(video: HTMLVideoElement): Promise<void> {
  if (!video.seeking) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Failed to seek a video asset"));
    };
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

async function prepareVideos(state: EditorState, runtime: MediaRuntime): Promise<Map<string, PreparedVideo>> {
  const prepared = new Map<string, PreparedVideo>();

  await Promise.all(allVideoClips(state).map(async (clip) => {
    const binding = runtime.get(clip.assetId);
    if (!binding) throw new Error(`Runtime binding for video asset ${clip.assetId} was not found`);

    const video = document.createElement("video");
    video.src = binding.objectUrl;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    video.load();

    await waitForVideoReady(video);
    video.playbackRate = clip.playbackRate;
    video.currentTime = clip.sourceInUs / US;
    await waitForSeek(video);
    prepared.set(clip.id, { clip, element: video });
  }));

  return prepared;
}

async function prepareAudio(state: EditorState, runtime: MediaRuntime): Promise<PreparedAudio | null> {
  const clips = getAudioTracks(state).flatMap((track) => track.muted ? [] : track.clips);
  if (!clips.length) return null;

  const context = new AudioContext();
  await context.resume();
  const destination = context.createMediaStreamDestination();
  const sources: PreparedAudioSource[] = [];

  for (const clip of clips) {
    const binding = runtime.get(clip.assetId);
    if (!binding) {
      await context.close();
      throw new Error(`Runtime binding for audio asset ${clip.assetId} was not found`);
    }

    const buffer = await context.decodeAudioData(await binding.file.arrayBuffer());
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.value = clip.volume;
    source.connect(gain);
    gain.connect(destination);
    sources.push({ clip, source });
  }

  return { context, destination, sources };
}

function startAudio(prepared: PreparedAudio): void {
  for (const { clip, source } of prepared.sources) {
    const startDelaySeconds = clip.timelineStartUs / US;
    const offsetSeconds = clip.sourceInUs / US;
    const durationSeconds = (clip.sourceOutUs - clip.sourceInUs) / US;
    source.start(prepared.context.currentTime + startDelaySeconds, offsetSeconds, durationSeconds);
  }
}

function drawFrame(
  context: CanvasRenderingContext2D,
  state: EditorState,
  videos: Map<string, PreparedVideo>,
  timelineUs: number,
): void {
  context.save();
  context.globalAlpha = 1;
  context.fillStyle = "#000";
  context.fillRect(0, 0, state.canvas.width, state.canvas.height);

  const layers = videoLayersAt(state, timelineUs);
  const activeClipIds = new Set(layers.map((layer) => layer.clipId));

  for (const [clipId, prepared] of videos) {
    if (!activeClipIds.has(clipId) && !prepared.element.paused) prepared.element.pause();
  }

  for (const layer of layers) {
    const prepared = videos.get(layer.clipId);
    if (!prepared) continue;
    const video = prepared.element;
    const targetSeconds = layer.sourceTimeUs / US;
    video.playbackRate = prepared.clip.playbackRate;

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      if (Math.abs(video.currentTime - targetSeconds) > VIDEO_DRIFT_THRESHOLD_SECONDS) {
        video.currentTime = targetSeconds;
      }
      if (video.paused) void video.play().catch(() => undefined);

      const region = computeDrawRegion(
        video.videoWidth,
        video.videoHeight,
        state.canvas.width,
        state.canvas.height,
        state.canvas.fitMode,
      );
      context.globalAlpha = layer.opacity;
      context.drawImage(
        video,
        region.sx,
        region.sy,
        region.sw,
        region.sh,
        region.dx,
        region.dy,
        region.dw,
        region.dh,
      );
    }
  }

  context.restore();
}

function createRecorder(stream: MediaStream): { recorder: MediaRecorder; format: RecorderFormat } {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("This browser does not support the MediaRecorder API required for video export");
  }

  const format = pickRecorderFormat((mimeType) => MediaRecorder.isTypeSupported(mimeType));
  if (!format) throw new Error("No supported video export format is available in this browser");

  try {
    return { recorder: new MediaRecorder(stream, { mimeType: format.mimeType }), format };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    throw new Error(`Could not start the video encoder: ${message}`);
  }
}

export async function exportProject({ state, runtime, onProgress, signal }: ExportProjectOptions): Promise<ExportResult> {
  if (!allVideoClips(state).length) throw new Error("There are no video clips to export");
  if (signal?.aborted) throw abortError();

  const durationUs = exportDurationUs(state);
  if (durationUs <= 0) throw new Error("Export duration is zero");

  const canvas = document.createElement("canvas");
  canvas.width = state.canvas.width;
  canvas.height = state.canvas.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not initialize the export canvas");
  if (typeof canvas.captureStream !== "function") {
    throw new Error("This browser does not support canvas-based video export");
  }

  const videos = await prepareVideos(state, runtime);
  const audio = await prepareAudio(state, runtime);
  const canvasStream = canvas.captureStream(EXPORT_FPS);
  const stream = new MediaStream(canvasStream.getVideoTracks());
  if (audio) {
    for (const track of audio.destination.stream.getAudioTracks()) stream.addTrack(track);
  }

  const { recorder, format } = createRecorder(stream);
  const chunks: BlobPart[] = [];
  let animationFrame = 0;
  let settled = false;

  try {
    const result = await new Promise<ExportResult>((resolve, reject) => {
      const cleanupAbort = () => signal?.removeEventListener("abort", onAbort);
      const fail = (error: Error | DOMException) => {
        if (settled) return;
        settled = true;
        cleanupAbort();
        reject(error);
      };
      const onAbort = () => {
        if (recorder.state !== "inactive") recorder.stop();
        fail(abortError());
      };

      signal?.addEventListener("abort", onAbort, { once: true });
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      });
      recorder.addEventListener("error", (event) => {
        const detail = event.error?.message ?? "MediaRecorder error";
        fail(new Error(`Video export failed: ${detail}`));
      });
      recorder.addEventListener("stop", () => {
        if (settled) return;
        settled = true;
        cleanupAbort();
        const blob = new Blob(chunks, { type: recorder.mimeType || format.mimeType });
        if (blob.size === 0) {
          reject(new Error("The exported video is empty"));
          return;
        }
        resolve({ blob, format, durationUs });
      });

      drawFrame(context, state, videos, 0);
      recorder.start(500);
      if (audio) startAudio(audio);
      const startMs = performance.now();

      const render = (now: number) => {
        const elapsedUs = Math.min(durationUs, Math.max(0, Math.round((now - startMs) * 1000)));
        drawFrame(context, state, videos, elapsedUs);
        onProgress?.({ elapsedUs, totalUs: durationUs });

        if (elapsedUs >= durationUs) {
          if (recorder.state !== "inactive") recorder.stop();
          return;
        }
        animationFrame = requestAnimationFrame(render);
      };

      animationFrame = requestAnimationFrame(render);
    });

    return result;
  } finally {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    for (const prepared of videos.values()) {
      prepared.element.pause();
      prepared.element.removeAttribute("src");
      prepared.element.load();
    }
    for (const track of stream.getTracks()) track.stop();
    for (const track of canvasStream.getTracks()) track.stop();
    if (audio) {
      for (const prepared of audio.sources) {
        try { prepared.source.stop(); } catch { /* already stopped */ }
      }
      await audio.context.close();
    }
  }
}
