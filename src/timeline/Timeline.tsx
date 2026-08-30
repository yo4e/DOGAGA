import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { EditorController } from "../editor/controller";
import {
  PLAYBACK_RATES,
  clipDurationUs,
  timelineDurationUs,
  type EditorState,
} from "../editor/model";
import "./context-menu.css";

const US = 1_000_000;
const SCALE_OPTIONS = [24, 48, 80] as const;

type Props = {
  state: EditorState;
  controller: EditorController;
  selectedClipId: string | null;
  onSelectClip: (clipId: string) => void;
};

type SpeedMenu = {
  clipId: string;
  x: number;
  y: number;
};

function timestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

function tickStep(pixelsPerSecond: number, durationSeconds: number): number {
  const minimumByScale = pixelsPerSecond >= 64 ? 1 : pixelsPerSecond >= 36 ? 2 : 5;
  const minimumByCount = durationSeconds / 300;
  return [1, 2, 5, 10, 15, 30, 60, 120, 300, 600].find(
    (candidate) => candidate >= minimumByScale && candidate >= minimumByCount,
  ) ?? 600;
}

export function Timeline({ state, controller, selectedClipId, onSelectClip }: Props) {
  const [pixelsPerSecond, setPixelsPerSecond] = useState<(typeof SCALE_OPTIONS)[number]>(48);
  const [speedMenu, setSpeedMenu] = useState<SpeedMenu | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const durationUs = timelineDurationUs(state);
  const contentSeconds = Math.max(10, Math.ceil(durationUs / US));
  const canvasWidth = Math.max(720, contentSeconds * pixelsPerSecond);
  const visibleSeconds = canvasWidth / pixelsPerSecond;
  const step = tickStep(pixelsPerSecond, visibleSeconds);
  const ticks = useMemo(
    () => Array.from({ length: Math.floor(visibleSeconds / step) + 1 }, (_, index) => index * step),
    [step, visibleSeconds],
  );
  const canvasStyle = {
    width: `${canvasWidth}px`,
    "--second-width": `${pixelsPerSecond}px`,
  } as CSSProperties & Record<"--second-width", string>;

  useEffect(() => {
    const scroll = scrollRef.current;
    const selected = state.videoClips.find((clip) => clip.id === selectedClipId);
    if (!scroll || !selected) return;

    const padding = 24;
    const clipStart = (selected.timelineStartUs / US) * pixelsPerSecond;
    const clipEnd = clipStart + (clipDurationUs(selected) / US) * pixelsPerSecond;
    const clipWidth = clipEnd - clipStart;
    const availableWidth = scroll.clientWidth - padding * 2;
    if (clipWidth > availableWidth) {
      scroll.scrollLeft = Math.max(0, clipStart - padding);
    } else if (clipStart < scroll.scrollLeft + padding) {
      scroll.scrollLeft = Math.max(0, clipStart - padding);
    } else if (clipEnd > scroll.scrollLeft + scroll.clientWidth - padding) {
      scroll.scrollLeft = Math.max(0, clipEnd - scroll.clientWidth + padding);
    }
  }, [pixelsPerSecond, selectedClipId, state.videoClips]);

  useEffect(() => {
    if (!speedMenu) return;
    const close = () => setSpeedMenu(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [speedMenu]);

  const seekFromClick = (event: ReactMouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const nextUs = Math.max(0, Math.round(((event.clientX - rect.left) / pixelsPerSecond) * US));
    controller.setPlayheadUs(Math.min(durationUs, nextUs));
  };

  const speedMenuClip = speedMenu
    ? state.videoClips.find((clip) => clip.id === speedMenu.clipId) ?? null
    : null;

  return (
    <div className="timeline-editor">
      <div className="timeline-toolbar">
        <p>クリップを選ぶと下に編集操作が表示されます。右クリックで再生速度を変更できます。</p>
        <label>
          表示幅
          <select
            value={pixelsPerSecond}
            onChange={(event) => setPixelsPerSecond(Number(event.target.value) as (typeof SCALE_OPTIONS)[number])}
          >
            <option value={24}>広く見る</option>
            <option value={48}>標準</option>
            <option value={80}>細かく見る</option>
          </select>
        </label>
      </div>

      <div className="timeline-workspace">
        <div className="timeline-sidebar" aria-hidden="true">
          <div className="timeline-corner">TIME</div>
          <div className="track-label"><strong>V1</strong><span>動画</span></div>
          <div className="track-label audio"><strong>A1</strong><span>音楽</span></div>
        </div>

        <div className="timeline-scroll" ref={scrollRef}>
          <div className="timeline-canvas" style={canvasStyle}>
            <button
              type="button"
              className="time-ruler"
              aria-label="タイムライン上で再生位置を選ぶ"
              onClick={seekFromClick}
            >
              {ticks.map((second) => (
                <span className="time-tick" key={second} style={{ left: second * pixelsPerSecond }}>
                  {timestamp(second)}
                </span>
              ))}
            </button>

            <div className="timeline-lane video-lane" onClick={seekFromClick}>
              {state.videoClips.map((clip, index) => {
                const asset = state.assets.find((candidate) => candidate.id === clip.assetId);
                const duration = clipDurationUs(clip);
                return (
                  <button
                    type="button"
                    className={`timeline-clip${selectedClipId === clip.id ? " selected" : ""}`}
                    key={clip.id}
                    aria-pressed={selectedClipId === clip.id}
                    title={`${asset?.name ?? clip.assetId} · ${(duration / US).toFixed(2)}秒 · ${clip.playbackRate}×`}
                    style={{
                      left: (clip.timelineStartUs / US) * pixelsPerSecond,
                      width: Math.max(28, (duration / US) * pixelsPerSecond),
                      zIndex: selectedClipId === clip.id ? 100 : index + 1,
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectClip(clip.id);
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onSelectClip(clip.id);
                      setSpeedMenu({
                        clipId: clip.id,
                        x: Math.min(event.clientX, Math.max(8, window.innerWidth - 200)),
                        y: Math.min(event.clientY, Math.max(8, window.innerHeight - 120)),
                      });
                    }}
                  >
                    <strong>{index + 1}. {asset?.name ?? clip.assetId}</strong>
                    <span>{(duration / US).toFixed(2)}s · {clip.playbackRate}×</span>
                  </button>
                );
              })}
              {!state.videoClips.length && <span className="track-empty">動画を追加するとV1へ並びます</span>}
              {state.transitions.map((transition) => {
                const toClip = state.videoClips.find((clip) => clip.id === transition.toClipId);
                if (!toClip) return null;
                return (
                  <span
                    className="transition-marker"
                    key={transition.id}
                    title={`クロスディゾルブ ${(transition.durationUs / US).toFixed(1)}秒`}
                    style={{ left: (toClip.timelineStartUs / US) * pixelsPerSecond }}
                  >
                    D
                  </span>
                );
              })}
            </div>

            <div className="timeline-lane audio-lane" onClick={seekFromClick}>
              {state.audioClip ? (
                <div
                  className="timeline-audio"
                  title={`${state.assets.find((asset) => asset.id === state.audioClip?.assetId)?.name ?? "Audio"} · 音量 ${Math.round(state.audioClip.volume * 100)}%`}
                  style={{
                    left: (state.audioClip.timelineStartUs / US) * pixelsPerSecond,
                    width: Math.max(
                      28,
                      ((state.audioClip.sourceOutUs - state.audioClip.sourceInUs) / US) * pixelsPerSecond,
                    ),
                  }}
                >
                  <strong>{state.assets.find((asset) => asset.id === state.audioClip?.assetId)?.name ?? "Audio"}</strong>
                  <span>音量 {Math.round(state.audioClip.volume * 100)}%</span>
                </div>
              ) : (
                <span className="track-empty">音源を設定するとA1へ表示されます</span>
              )}
            </div>

            <div
              className="timeline-playhead"
              aria-hidden="true"
              style={{ left: (state.playheadUs / US) * pixelsPerSecond }}
            >
              <span />
            </div>
          </div>
        </div>
      </div>

      {speedMenu && speedMenuClip && (
        <div
          className="clip-context-menu"
          role="dialog"
          aria-label="クリップの再生速度"
          style={{ left: speedMenu.x, top: speedMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <label>
            再生速度
            <select
              autoFocus
              value={speedMenuClip.playbackRate}
              onChange={(event) => {
                controller.execute({
                  type: "setClipSpeed",
                  clipId: speedMenuClip.id,
                  playbackRate: Number(event.target.value),
                });
                setSpeedMenu(null);
              }}
            >
              {PLAYBACK_RATES.map((rate) => (
                <option key={rate} value={rate}>{rate}×</option>
              ))}
            </select>
          </label>
          <small>右クリックしたclipだけに適用</small>
        </div>
      )}
    </div>
  );
}
