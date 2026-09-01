import { CaretLeftIcon } from "@phosphor-icons/react/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/CaretRight";
import { CornersInIcon } from "@phosphor-icons/react/CornersIn";
import { CornersOutIcon } from "@phosphor-icons/react/CornersOut";
import { FilmStripIcon } from "@phosphor-icons/react/FilmStrip";
import { PauseIcon } from "@phosphor-icons/react/Pause";
import { PlayIcon } from "@phosphor-icons/react/Play";
import { SkipBackIcon } from "@phosphor-icons/react/SkipBack";
import { SkipForwardIcon } from "@phosphor-icons/react/SkipForward";
import { SpeakerHighIcon } from "@phosphor-icons/react/SpeakerHigh";
import { SpeakerSlashIcon } from "@phosphor-icons/react/SpeakerSlash";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { playbackPositionUs, type PlaybackClock } from "./playbackClock";

const US = 1_000_000;
const MEDIA_SYNC_TOLERANCE_SECONDS = 0.05;
type Props = {
  state: EditorState;
  controller: EditorController;
  runtime: MediaRuntime;
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
    if (video.readyState > 0 && (!playing || Math.abs(video.currentTime - targetSeconds) > MEDIA_SYNC_TOLERANCE_SECONDS)) {
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

function clockLabel(us: number): string {
  const totalHundredths = Math.max(0, Math.floor(us / 10_000));
  const totalSeconds = Math.floor(totalHundredths / 100);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const hundredths = totalHundredths % 100;
  return `${[hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":")}.${String(hundredths).padStart(2, "0")}`;
}

function isPlaybackShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.closest("input, select, textarea, button, a, summary, [role='button']") !== null;
}

export function Preview({ state, controller, runtime }: Props) {
  const [playing, setPlaying] = useState(false);
  const [masterVolume, setMasterVolume] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [stageFit, setStageFit] = useState<"width" | "height">("height");
  const clockRef = useRef<PlaybackClock | null>(null);
  const audioRefs = useRef(new Map<string, HTMLAudioElement>());
  const editorRef = useRef<HTMLDivElement>(null);
  const monitorRef = useRef<HTMLDivElement>(null);
  const lastAudibleVolumeRef = useRef(1);
  const durationUs = timelineDurationUs(state);

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
    audio.volume = Math.min(1, clip.volume * masterVolume);
    if (!active) {
      audio.pause();
      return;
    }

    const target = audioTargetSeconds(clip, state.playheadUs);
    if (audio.readyState > 0 && (!playing || Math.abs(audio.currentTime - target) > MEDIA_SYNC_TOLERANCE_SECONDS)) {
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

  const seekBy = (deltaUs: number) => {
    seek(Math.min(durationUs, Math.max(0, state.playheadUs + deltaUs)));
  };

  const changeMasterVolume = (value: number) => {
    const next = Math.min(1, Math.max(0, value));
    if (next > 0) lastAudibleVolumeRef.current = next;
    setMasterVolume(next);
  };

  const toggleMasterMute = () => {
    changeMasterVolume(masterVolume > 0 ? 0 : lastAudibleVolumeRef.current);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
      return;
    }
    if (editorRef.current?.requestFullscreen) {
      void editorRef.current.requestFullscreen().catch(() => undefined);
    }
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
      const nextUs = playbackPositionUs(clock, now, maxUs);
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
  }, [audioLayers, masterVolume, playing, state.playheadUs]);

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(document.fullscreenElement === editorRef.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useLayoutEffect(() => {
    const monitor = monitorRef.current;
    if (!monitor) return;

    const canvasRatio = state.canvas.width / state.canvas.height;
    const updateStageFit = () => {
      const rect = monitor.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      setStageFit(rect.width / rect.height < canvasRatio ? "width" : "height");
    };

    updateStageFit();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateStageFit);
      return () => window.removeEventListener("resize", updateStageFit);
    }
    const observer = new ResizeObserver(updateStageFit);
    observer.observe(monitor);
    return () => observer.disconnect();
  }, [state.canvas.height, state.canvas.width]);

  const startAudiosAt = (startUs: number) => {
    for (const layer of audioLayers) {
      const audio = audioRefs.current.get(layer.clip.id);
      if (!audio || layer.track.muted) continue;
      const { clip } = layer;
      if (startUs < clip.timelineStartUs || startUs >= audioEndUs(clip)) continue;
      if (audio.readyState > 0) audio.currentTime = audioTargetSeconds(clip, startUs);
      audio.volume = Math.min(1, clip.volume * masterVolume);
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented
        || event.repeat
        || event.code !== "Space"
        || event.metaKey
        || event.ctrlKey
        || event.altKey
        || event.shiftKey
        || isPlaybackShortcutTarget(event.target)
      ) return;

      event.preventDefault();
      editorRef.current?.querySelector<HTMLButtonElement>(".transport-play")?.click();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="preview-editor" ref={editorRef}>
      <div
        className="preview-monitor"
        data-canvas-preset={state.canvas.preset}
        data-stage-fit={stageFit}
        ref={monitorRef}
      >
        <div
          className="preview-stage"
          aria-label={`${state.canvas.width}×${state.canvas.height} video preview`}
          style={{
            aspectRatio: `${state.canvas.width} / ${state.canvas.height}`,
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
              <FilmStripIcon className="preview-empty-icon" size={42} weight="light" aria-hidden="true" />
              <strong>{allVideos.length ? "No video is visible at the current playhead" : "Add a video clip to the timeline"}</strong>
            </div>
          )}
        </div>
        <input
          className="preview-scrubber"
          aria-label="Playhead position"
          type="range"
          min="0"
          max={Math.max(0, durationUs)}
          step="10000"
          value={Math.min(state.playheadUs, Math.max(0, durationUs))}
          disabled={durationUs <= 0}
          onChange={(event) => seek(Number(event.target.value))}
        />
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
        <span className="transport-time">{clockLabel(state.playheadUs)} / {clockLabel(durationUs)}</span>
        <div className="transport-controls" role="group" aria-label="Playback controls">
          <button type="button" title="Go to start" aria-label="Go to start" disabled={durationUs <= 0} onClick={() => seek(0)}>
            <SkipBackIcon size={17} weight="regular" aria-hidden="true" />
          </button>
          <button type="button" title="Back 0.1 seconds" aria-label="Back 0.1 seconds" disabled={durationUs <= 0} onClick={() => seekBy(-100_000)}>
            <CaretLeftIcon size={16} weight="fill" aria-hidden="true" />
          </button>
          <button
            className="transport-play"
            type="button"
            title={playing ? "Pause (Space)" : "Play (Space)"}
            aria-label={playing ? "Pause" : "Play"}
            aria-pressed={playing}
            onClick={togglePlayback}
            disabled={durationUs <= 0}
          >
            {playing ? (
              <PauseIcon size={19} weight="fill" aria-hidden="true" />
            ) : (
              <PlayIcon size={19} weight="fill" aria-hidden="true" />
            )}
          </button>
          <button type="button" title="Forward 0.1 seconds" aria-label="Forward 0.1 seconds" disabled={durationUs <= 0} onClick={() => seekBy(100_000)}>
            <CaretRightIcon size={16} weight="fill" aria-hidden="true" />
          </button>
          <button type="button" title="Go to end" aria-label="Go to end" disabled={durationUs <= 0} onClick={() => seek(durationUs)}>
            <SkipForwardIcon size={17} weight="regular" aria-hidden="true" />
          </button>
        </div>
        <div className="transport-end">
          <button
            type="button"
            title={masterVolume > 0 ? "Mute preview audio" : "Unmute preview audio"}
            aria-label={masterVolume > 0 ? "Mute preview audio" : "Unmute preview audio"}
            aria-pressed={masterVolume === 0}
            onClick={toggleMasterMute}
          >
            {masterVolume > 0 ? (
              <SpeakerHighIcon size={18} weight="regular" aria-hidden="true" />
            ) : (
              <SpeakerSlashIcon size={18} weight="regular" aria-hidden="true" />
            )}
          </button>
          <input
            aria-label="Preview volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={masterVolume}
            onChange={(event) => changeMasterVolume(Number(event.target.value))}
          />
          <button
            type="button"
            title={fullscreen ? "Exit fullscreen" : "Show preview fullscreen"}
            aria-label={fullscreen ? "Exit fullscreen" : "Show preview fullscreen"}
            disabled={!document.fullscreenEnabled}
            onClick={toggleFullscreen}
          >
            {fullscreen ? (
              <CornersInIcon size={18} weight="regular" aria-hidden="true" />
            ) : (
              <CornersOutIcon size={18} weight="regular" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
