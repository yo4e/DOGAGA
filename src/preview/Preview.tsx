import { useEffect, useMemo, useRef, useState } from "react";
import type { EditorController } from "../editor/controller";
import {
  allVideoClips,
  clipDurationUs,
  clipFadeOpacityAt,
  getAudioTracks,
  getVideoTracks,
  sourceTimeUsAt,
  timelineDurationUs,
  type AudioClip,
  type AudioTrack,
  type EditorState,
  type VideoClip,
} from "../editor/model";
import type { MediaRuntime } from "../media/runtime";

const US = 1_000_000;
const PREVIEW_MAX_HEIGHT = 450;

type Props = {
  state: EditorState;
  controller: EditorController;
  runtime: MediaRuntime;
};

type Clock = {
  wallMs: number;
  playheadUs: number;
};

type AudioLayer = {
  track: AudioTrack;
  clip: AudioClip;
};

function clipEndUs(clip: VideoClip): number {
  return clip.timelineStartUs + clipDurationUs(clip);
}

function transitionOpacity(state: EditorState, clip: VideoClip): number {
  const clips = allVideoClips(state);
  for (const transition of state.transitions) {
    const to = clips.find((candidate) => candidate.id === transition.toClipId);
    if (!to) continue;
    const startUs = to.timelineStartUs;
    const endUs = startUs + transition.durationUs;
    if (state.playheadUs < startUs || state.playheadUs > endUs) continue;

    const progress = Math.min(1, Math.max(0, (state.playheadUs - startUs) / transition.durationUs));
    if (clip.id === transition.fromClipId) return 1 - progress;
    if (clip.id === transition.toClipId) return progress;
  }
  return 1;
}

function opacityForClip(state: EditorState, clip: VideoClip, trackOpacity: number): number {
  return trackOpacity * transitionOpacity(state, clip) * clipFadeOpacityAt(clip, state.playheadUs);
}

function VideoLayer({ clip, state, runtime, playing, trackOpacity }: {
  clip: VideoClip;
  state: EditorState;
  runtime: MediaRuntime;
  playing: boolean;
  trackOpacity: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const binding = runtime.get(clip.assetId);
  const targetSeconds = sourceTimeUsAt(clip, state.playheadUs) / US;

  const syncVideo = (video: HTMLVideoElement) => {
    video.playbackRate = clip.playbackRate;
    if (video.readyState > 0 && (!playing || Math.abs(video.currentTime - targetSeconds) > 0.12)) {
      video.currentTime = targetSeconds;
    }
    if (playing) {
      if (video.paused) void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  };

  useEffect(() => {
    const video = ref.current;
    if (!video || !binding) return;
    syncVideo(video);
  }, [binding, clip.playbackRate, playing, targetSeconds]);

  if (!binding) return null;

  return (
    <video
      ref={ref}
      className="preview-video"
      src={binding.objectUrl}
      muted
      playsInline
      preload="auto"
      style={{ opacity: opacityForClip(state, clip, trackOpacity), objectFit: state.canvas.fitMode }}
      onLoadedMetadata={(event) => syncVideo(event.currentTarget)}
    />
  );
}

function audioEndUs(clip: AudioClip): number {
  return clip.timelineStartUs + (clip.sourceOutUs - clip.sourceInUs);
}

function audioTargetSeconds(clip: AudioClip, playheadUs: number): number {
  return (clip.sourceInUs + (playheadUs - clip.timelineStartUs)) / US;
}

export function Preview({ state, controller, runtime }: Props) {
  const [playing, setPlaying] = useState(false);
  const clockRef = useRef<Clock | null>(null);
  const audioRefs = useRef(new Map<string, HTMLAudioElement>());
  const durationUs = timelineDurationUs(state);
  const canvasRatio = state.canvas.width / state.canvas.height;

  const videoTracks = useMemo(() => getVideoTracks(state), [state.tracks]);
  const allVideos = useMemo(() => allVideoClips(state), [state.tracks]);
  const activeVideoLayers = useMemo(
    () => videoTracks.flatMap((track) => {
      if (!track.visible || track.opacity <= 0) return [];
      return track.clips
        .filter((clip) => state.playheadUs >= clip.timelineStartUs && state.playheadUs < clipEndUs(clip))
        .map((clip) => ({ track, clip }));
    }),
    [state.playheadUs, videoTracks],
  );

  const audioLayers = useMemo<AudioLayer[]>(
    () => getAudioTracks(state).flatMap((track) => track.clips.map((clip) => ({ track, clip }))),
    [state.tracks],
  );

  const syncAudio = (audio: HTMLAudioElement, layer: AudioLayer) => {
    const { track, clip } = layer;
    const binding = runtime.get(clip.assetId);
    if (!binding || track.muted) {
      audio.pause();
      return;
    }

    const active = state.playheadUs >= clip.timelineStartUs && state.playheadUs < audioEndUs(clip);
    audio.volume = clip.volume;
    if (!active) {
      audio.pause();
      return;
    }

    const target = audioTargetSeconds(clip, state.playheadUs);
    if (audio.readyState > 0 && (!playing || Math.abs(audio.currentTime - target) > 0.15)) {
      audio.currentTime = target;
    }
    if (playing) {
      if (audio.paused) void audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  };

  const seek = (nextUs: number) => {
    controller.setPlayheadUs(nextUs);
    if (playing) clockRef.current = { wallMs: performance.now(), playheadUs: nextUs };
  };

  useEffect(() => {
    if (!playing) return;
    if (!clockRef.current) {
      clockRef.current = { wallMs: performance.now(), playheadUs: controller.getState().playheadUs };
    }

    let frame = 0;
    const tick = (now: number) => {
      const clock = clockRef.current;
      if (!clock) return;
      const currentState = controller.getState();
      const maxUs = timelineDurationUs(currentState);
      const nextUs = Math.min(maxUs, clock.playheadUs + Math.round((now - clock.wallMs) * 1000));
      controller.setPlayheadUs(nextUs);
      if (nextUs >= maxUs) {
        clockRef.current = null;
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [controller, playing]);

  useEffect(() => {
    for (const layer of audioLayers) {
      const audio = audioRefs.current.get(layer.clip.id);
      if (audio) syncAudio(audio, layer);
    }
  }, [audioLayers, playing, state.playheadUs]);

  const startAudiosAt = (startUs: number) => {
    for (const layer of audioLayers) {
      const audio = audioRefs.current.get(layer.clip.id);
      if (!audio || layer.track.muted) continue;
      const { clip } = layer;
      if (startUs < clip.timelineStartUs || startUs >= audioEndUs(clip)) continue;
      if (audio.readyState > 0) audio.currentTime = audioTargetSeconds(clip, startUs);
      audio.volume = clip.volume;
      void audio.play().catch(() => undefined);
    }
  };

  const togglePlayback = () => {
    if (playing) {
      setPlaying(false);
      clockRef.current = null;
      for (const audio of audioRefs.current.values()) audio.pause();
      return;
    }

    const startUs = state.playheadUs >= durationUs ? 0 : state.playheadUs;
    if (startUs !== state.playheadUs) controller.setPlayheadUs(startUs);
    clockRef.current = { wallMs: performance.now(), playheadUs: startUs };
    startAudiosAt(startUs);
    setPlaying(true);
  };

  return (
    <div className="preview-editor">
      <div
        className="preview-stage"
        aria-label={`${state.canvas.width}×${state.canvas.height} 動画プレビュー`}
        style={{
          aspectRatio: `${state.canvas.width} / ${state.canvas.height}`,
          width: `min(100%, ${Math.round(canvasRatio * PREVIEW_MAX_HEIGHT)}px)`,
        }}
      >
        {activeVideoLayers.map(({ track, clip }) => (
          <VideoLayer
            key={clip.id}
            clip={clip}
            state={state}
            runtime={runtime}
            playing={playing}
            trackOpacity={track.opacity}
          />
        ))}
        {!activeVideoLayers.length && (
          <div className="preview-empty">
            <strong>{allVideos.length ? "再生位置に表示中の映像がありません" : "動画をタイムラインへ追加してください"}</strong>
          </div>
        )}
      </div>

      {audioLayers.map((layer) => {
        const binding = runtime.get(layer.clip.assetId);
        if (!binding) return null;
        return (
          <audio
            key={layer.clip.id}
            ref={(element) => {
              if (element) audioRefs.current.set(layer.clip.id, element);
              else audioRefs.current.delete(layer.clip.id);
            }}
            src={binding.objectUrl}
            preload="auto"
            onLoadedMetadata={(event) => syncAudio(event.currentTarget, layer)}
          />
        );
      })}

      <div className="transport">
        <button type="button" onClick={togglePlayback} disabled={durationUs <= 0}>
          {playing ? "一時停止" : "再生"}
        </button>
        <span>{(state.playheadUs / US).toFixed(2)}s / {(durationUs / US).toFixed(2)}s</span>
        <input
          aria-label="再生位置"
          type="range"
          min="0"
          max={Math.max(0, durationUs)}
          step="10000"
          value={Math.min(state.playheadUs, Math.max(0, durationUs))}
          disabled={durationUs <= 0}
          onChange={(event) => seek(Number(event.target.value))}
        />
      </div>
    </div>
  );
}
