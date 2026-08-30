import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { EditorController } from "../editor/controller";
import { clipDurationUs, timelineDurationUs, type EditorState } from "../editor/model";

const US = 1_000_000;
const SCALE_OPTIONS = [24, 48, 80] as const;

type Props = {
  state: EditorState;
  controller: EditorController;
  selectedClipId: string | null;
  onSelectClip: (clipId: string) => void;
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

  const seekFromClick = (event: ReactMouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const nextUs = Math.max(0, Math.round(((event.clientX - rect.left) / pixelsPerSecond) * US));
    controller.setPlayheadUs(Math.min(durationUs, nextUs));
  };

  return (
    <div className="timeline-editor">
      <div className="timeline-toolbar">
        <p>クリップを選ぶと下に編集操作が表示されます。空いている場所をクリックすると再生位置を移動できます。</p>
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
                    title={`${asset?.name ?? clip.assetId} · ${(duration / US).toFixed(2)}秒`}
                    style={{
                      left: (clip.timelineStartUs / US) * pixelsPerSecond,
                      width: Math.max(28, (duration / US) * pixelsPerSecond),
                      zIndex: selectedClipId === clip.id ? 100 : index + 1,
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectClip(clip.id);
                    }}
                  >
                    <strong>{index + 1}. {asset?.name ?? clip.assetId}</strong>
                    <span>{(duration / US).toFixed(2)}s</span>
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
    </div>
  );
}
