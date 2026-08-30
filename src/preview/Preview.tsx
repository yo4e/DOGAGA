import { useEffect, useMemo, useRef, useState } from "react";
import type { EditorController } from "../editor/controller";
import {
  clipDurationUs,
  sourceTimeUsAt,
  timelineDurationUs,
  type EditorState,
  type VideoClip,
} from "../editor/model";
import type { MediaRuntime } from "../media/runtime";

const US = 1_000_000;

type Props = {
  state: EditorState;
  controller: EditorController;
  runtime: MediaRuntime;
};

type Clock = {
  wallMs: number;
  playheadUs: number;
};

function clipEndUs(clip: VideoClip): number {
  return clip.timelineStartUs + clipDurationUs(clip);
}

function opacityForClip(state: EditorState, clip: VideoClip): number {
  for (const transition of state.transitions) {
    const to = state.videoClips.find((candidate) => candidate.id === transition.toClipId);
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

function VideoLayer({ clip, state, runtime, playing }: {
  clip: VideoClip;
  state: EditorState;
  runtime: MediaRuntime;
  playing: boolean;
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
      style={{ opacity: opacityForClip(state, clip), objectFit: state.canvas.fitMode }}
      onLoadedMetadata={(event) => syncVideo(event.currentTarget)}
    />
  );
}

export function Preview({ state, controller, runtime }: Props) {
  const [playing, setPlaying] = useState(false);
  const clockRef = useRef<Clock | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const durationUs = timelineDurationUs(state);
  const canvasRatio = state.canvas.width / state.canvas.height;

  const activeClips = useMemo(
    () => state.videoClips.filter(
      (clip) => state.playheadUs >= clip.timelineStartUs && state.playheadUs < clipEndUs(clip),
    ),
    [state.playheadUs, state.videoClips],
  );

  const audioBinding = state.audioClip ? runtime.get(state.audioClip.assetId) : undefined;

  const syncAudio = (audio: HTMLAudioElement) => {
    const clip = state.audioClip;
    if (!clip || !audioBinding) {
      audio.pause();
      return;
    }

    audio.volume = clip.volume;
    const audioEndUs = clip.timelineStartUs + (clip.sourceOutUs - clip.sourceInUs);
    const active = state.playheadUs >= clip.timelineStartUs && state.playheadUs < audioEndUs;

    if (!active) {
      audio.pause();
      return;
    }

    const target = (clip.sourceInUs + (state.playheadUs - clip.timelineStartUs)) / US;
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
    if (playing) {
      clockRef.current = { wallMs: performance.now(), playheadUs: nextUs };
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
    const audio = audioRef.current;
    if (!audio) return;
    syncAudio(audio);
  }, [audioBinding, playing, state.audioClip, state.playheadUs]);

  const togglePlayback = () => {
    if (playing) {
      setPlaying(false);
      clockRef.current = null;
      audioRef.current?.pause();
      return;
    }

    const startUs = state.playheadUs >= durationUs ? 0 : state.playheadUs;
    if (startUs !== state.playheadUs) controller.setPlayheadUs(startUs);
    clockRef.current = { wallMs: performance.now(), playheadUs: startUs };

    if (state.audioClip && audioBinding && audioRef.current) {
      const clip = state.audioClip;
      const endUs = clip.timelineStartUs + (clip.sourceOutUs - clip.sourceInUs);
      if (startUs >= clip.timelineStartUs && startUs < endUs) {
        if (audioRef.current.readyState > 0) {
          audioRef.current.currentTime = (clip.sourceInUs + (startUs - clip.timelineStartUs)) / US;
        }
        audioRef.current.volume = clip.volume;
        void audioRef.current.play().catch(() => undefined);
      }
    }

    setPlaying(true);
  };

  return (
    <div className="preview-editor">
      <div
        className="preview-stage"
        aria-label={`${state.canvas.width}×${state.canvas.height} 動画プレビュー`}
        style={{
          aspectRatio: `${state.canvas.width} / ${state.canvas.height}`,
          width: `min(100%, ${Math.round(canvasRatio * 560)}px)`,
        }}
      >
        {activeClips.map((clip) => (
          <VideoLayer key={clip.id} clip={clip} state={state} runtime={runtime} playing={playing} />
        ))}
        {!activeClips.length && (
          <div className="preview-empty">
            <strong>{state.videoClips.length ? "再生位置に映像がありません" : "動画をタイムラインへ追加してください"}</strong>
          </div>
        )}
      </div>

      {state.audioClip && audioBinding && (
        <audio
          ref={audioRef}
          src={audioBinding.objectUrl}
          preload="auto"
          onLoadedMetadata={(event) => syncAudio(event.currentTarget)}
        />
      )}

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
