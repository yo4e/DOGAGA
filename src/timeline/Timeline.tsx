import { ArrowDownIcon } from "@phosphor-icons/react/ArrowDown";
import { ArrowUpIcon } from "@phosphor-icons/react/ArrowUp";
import { EyeIcon } from "@phosphor-icons/react/Eye";
import { EyeSlashIcon } from "@phosphor-icons/react/EyeSlash";
import { SpeakerHighIcon } from "@phosphor-icons/react/SpeakerHigh";
import { SpeakerSlashIcon } from "@phosphor-icons/react/SpeakerSlash";
import { TrashIcon } from "@phosphor-icons/react/Trash";
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
  DEFAULT_AUDIO_TRACK_ID,
  DEFAULT_VIDEO_TRACK_ID,
  FADE_DURATIONS_US,
  PLAYBACK_RATES,
  clipDurationUs,
  findVideoClipLocation,
  getAudioTracks,
  getVideoTracks,
  timelineDurationUs,
  type EditorState,
  type EditorTrack,
  type VideoTrack,
} from "../editor/model";
import { getTimelineRows, getTimelineTrackMoveIndex } from "./rows";
import "./context-menu.css";

const US = 1_000_000;
const SCALE_OPTIONS = [24, 48, 80] as const;
const MIN_TIMELINE_WIDTH = 1300;
const RULER_HEIGHT = 38;
const TRACK_HEIGHT = 66;

type Props = {
  state: EditorState;
  controller: EditorController;
  selectedClipId: string | null;
  onSelectClip: (clipId: string) => void;
};

type ClipMenu = {
  clipId: string;
  x: number;
  y: number;
};

function newId(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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

function fadeLabel(durationUs: number): string {
  return durationUs === 0 ? "None" : `${durationUs / US}s`;
}

export function Timeline({ state, controller, selectedClipId, onSelectClip }: Props) {
  const [pixelsPerSecond, setPixelsPerSecond] = useState<(typeof SCALE_OPTIONS)[number]>(24);
  const [clipMenu, setClipMenu] = useState<ClipMenu | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const videoTracks = useMemo(() => getVideoTracks(state), [state.tracks]);
  const audioTracks = useMemo(() => getAudioTracks(state), [state.tracks]);
  const rows = useMemo(() => getTimelineRows(state), [state.tracks]);
  const durationUs = timelineDurationUs(state);
  const contentSeconds = Math.max(10, Math.ceil(durationUs / US));
  const canvasWidth = Math.max(MIN_TIMELINE_WIDTH, contentSeconds * pixelsPerSecond);
  const visibleSeconds = canvasWidth / pixelsPerSecond;
  const step = tickStep(pixelsPerSecond, visibleSeconds);
  const ticks = useMemo(
    () => Array.from({ length: Math.floor(visibleSeconds / step) + 1 }, (_, index) => index * step),
    [step, visibleSeconds],
  );
  const canvasStyle = {
    width: `${canvasWidth}px`,
    height: `${RULER_HEIGHT + rows.length * TRACK_HEIGHT}px`,
    "--second-width": `${pixelsPerSecond}px`,
  } as CSSProperties & Record<"--second-width", string>;

  useEffect(() => {
    const scroll = scrollRef.current;
    const selected = selectedClipId ? findVideoClipLocation(state, selectedClipId)?.clip : undefined;
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
  }, [pixelsPerSecond, selectedClipId, state.tracks]);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll || scroll.clientWidth <= 0) return;

    const playheadX = (state.playheadUs / US) * pixelsPerSecond;
    const edgePadding = Math.min(120, Math.max(40, scroll.clientWidth * 0.15));
    const visibleLeft = scroll.scrollLeft;
    const visibleRight = visibleLeft + scroll.clientWidth;

    if (playheadX < visibleLeft + edgePadding) {
      scroll.scrollLeft = Math.max(0, playheadX - edgePadding);
    } else if (playheadX > visibleRight - edgePadding) {
      scroll.scrollLeft = Math.max(0, playheadX - scroll.clientWidth + edgePadding);
    }
  }, [pixelsPerSecond, state.playheadUs]);

  useEffect(() => {
    if (!clipMenu) return;
    const close = () => setClipMenu(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [clipMenu]);

  const seekFromClick = (event: ReactMouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const nextUs = Math.max(0, Math.round(((event.clientX - rect.left) / pixelsPerSecond) * US));
    controller.setPlayheadUs(Math.min(durationUs, nextUs));
  };

  const menuLocation = clipMenu ? findVideoClipLocation(state, clipMenu.clipId) ?? null : null;
  const menuClip = menuLocation?.clip ?? null;
  const allowedFadeDurations = menuClip
    ? FADE_DURATIONS_US.filter((duration) => duration <= clipDurationUs(menuClip))
    : FADE_DURATIONS_US;

  const addTrack = (kind: "video" | "audio") => {
    const index = kind === "video" ? videoTracks.length + 1 : audioTracks.length + 1;
    controller.execute({
      type: "addTrack",
      track: {
        id: newId(`${kind}-track`),
        kind,
        name: `${kind === "video" ? "V" : "A"}${index}`,
      },
    });
  };

  const renderTrackControls = (track: EditorTrack) => {
    const sameKind = track.kind === "video" ? videoTracks : audioTracks;
    const upIndex = getTimelineTrackMoveIndex(track, sameKind, "up");
    const downIndex = getTimelineTrackMoveIndex(track, sameKind, "down");
    const isDefault = track.id === DEFAULT_VIDEO_TRACK_ID || track.id === DEFAULT_AUDIO_TRACK_ID;
    return (
      <div className="track-label" key={track.id}>
        <div className="track-label-title">
          <strong>{track.name}</strong>
          <span>{track.kind === "video" ? "Video" : "Audio"}</span>
        </div>
        <div className="track-mini-controls">
          {track.kind === "video" ? (
            <>
              <button
                type="button"
                title={track.visible ? "Hide track" : "Show track"}
                aria-label={track.visible ? `Hide ${track.name}` : `Show ${track.name}`}
                onClick={() => controller.execute({ type: "setTrackVisibility", trackId: track.id, visible: !track.visible })}
              >
                {track.visible ? (
                  <EyeIcon size={16} weight="regular" aria-hidden="true" />
                ) : (
                  <EyeSlashIcon size={16} weight="regular" aria-hidden="true" />
                )}
              </button>
              <input
                aria-label={`${track.name} opacity`}
                title={`${track.name} opacity ${Math.round(track.opacity * 100)}%`}
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={track.opacity}
                onChange={(event) => controller.execute({
                  type: "setTrackOpacity",
                  trackId: track.id,
                  opacity: Number(event.target.value),
                })}
              />
            </>
          ) : (
            <button
              type="button"
              title={track.muted ? "Unmute" : "Mute"}
              aria-label={track.muted ? `Unmute ${track.name}` : `Mute ${track.name}`}
              onClick={() => controller.execute({ type: "setTrackMute", trackId: track.id, muted: !track.muted })}
            >
              {track.muted ? (
                <SpeakerSlashIcon size={16} weight="regular" aria-hidden="true" />
              ) : (
                <SpeakerHighIcon size={16} weight="regular" aria-hidden="true" />
              )}
            </button>
          )}
          <button
            type="button"
            title="Move up"
            aria-label={`Move ${track.name} up`}
            disabled={upIndex === null}
            onClick={() => {
              if (upIndex !== null) controller.execute({ type: "moveTrack", trackId: track.id, toIndex: upIndex });
            }}
          ><ArrowUpIcon size={14} weight="regular" aria-hidden="true" /></button>
          <button
            type="button"
            title="Move down"
            aria-label={`Move ${track.name} down`}
            disabled={downIndex === null}
            onClick={() => {
              if (downIndex !== null) controller.execute({ type: "moveTrack", trackId: track.id, toIndex: downIndex });
            }}
          ><ArrowDownIcon size={14} weight="regular" aria-hidden="true" /></button>
          {!isDefault && (
            <button
              type="button"
              title={track.clips.length ? "Remove all clips before deleting this track" : "Delete track"}
              aria-label={`Delete ${track.name}`}
              disabled={track.clips.length > 0}
              onClick={() => controller.execute({ type: "removeTrack", trackId: track.id })}
            ><TrashIcon size={15} weight="regular" aria-hidden="true" /></button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="timeline-editor">
      <div className="timeline-toolbar">
        <h2>Timeline</h2>
        <div className="timeline-toolbar-actions">
          <button type="button" onClick={() => addTrack("video")}>+ Video</button>
          <button type="button" onClick={() => addTrack("audio")}>+ Audio</button>
          <label>
            Scale
            <select
              value={pixelsPerSecond}
              onChange={(event) => setPixelsPerSecond(Number(event.target.value) as (typeof SCALE_OPTIONS)[number])}
            >
              <option value={24}>Wide</option>
              <option value={48}>Standard</option>
              <option value={80}>Detailed</option>
            </select>
          </label>
        </div>
      </div>

      <div className="timeline-workspace">
        <div className="timeline-sidebar">
          <div className="timeline-corner">Tracks / Time</div>
          {rows.map(renderTrackControls)}
        </div>

        <div className="timeline-scroll" ref={scrollRef}>
          <div className="timeline-canvas" style={canvasStyle}>
            <button
              type="button"
              className="time-ruler"
              aria-label="Choose the playhead position on the timeline"
              onClick={seekFromClick}
            >
              {ticks.map((second) => (
                <span className="time-tick" key={second} style={{ left: second * pixelsPerSecond }}>
                  {timestamp(second)}
                </span>
              ))}
            </button>

            {rows.map((track, rowIndex) => {
              const top = RULER_HEIGHT + rowIndex * TRACK_HEIGHT;
              if (track.kind === "video") {
                return (
                  <div
                    className={`timeline-lane video-lane${track.visible ? "" : " track-disabled"}`}
                    key={track.id}
                    style={{ top }}
                    onClick={seekFromClick}
                  >
                    {track.clips.map((clip, index) => {
                      const asset = state.assets.find((candidate) => candidate.id === clip.assetId);
                      const clipDuration = clipDurationUs(clip);
                      return (
                        <button
                          type="button"
                          className={`timeline-clip${selectedClipId === clip.id ? " selected" : ""}`}
                          key={clip.id}
                          aria-pressed={selectedClipId === clip.id}
                          title={`${asset?.name ?? clip.assetId} · ${(clipDuration / US).toFixed(2)}s · ${clip.playbackRate}× · fade ${fadeLabel(clip.fadeInUs)} / ${fadeLabel(clip.fadeOutUs)}`}
                          style={{
                            left: (clip.timelineStartUs / US) * pixelsPerSecond,
                            width: Math.max(28, (clipDuration / US) * pixelsPerSecond),
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
                            setClipMenu({
                              clipId: clip.id,
                              x: Math.min(event.clientX, Math.max(8, window.innerWidth - 220)),
                              y: Math.min(event.clientY, Math.max(8, window.innerHeight - 340)),
                            });
                          }}
                        >
                          <strong>{index + 1}. {asset?.name ?? clip.assetId}</strong>
                          <span>{(clipDuration / US).toFixed(2)}s · {clip.playbackRate}×</span>
                        </button>
                      );
                    })}
                    {!track.clips.length && (
                      <span className="track-empty">Add video clips here ({track.name})</span>
                    )}
                    {state.transitions.map((transition) => {
                      const toClip = track.clips.find((clip) => clip.id === transition.toClipId);
                      if (!toClip) return null;
                      return (
                        <span
                          className="transition-marker"
                          key={transition.id}
                          title={`Cross-dissolve ${(transition.durationUs / US).toFixed(1)}s`}
                          style={{ left: (toClip.timelineStartUs / US) * pixelsPerSecond }}
                        >D</span>
                      );
                    })}
                  </div>
                );
              }

              return (
                <div
                  className={`timeline-lane audio-lane${track.muted ? " track-disabled" : ""}`}
                  key={track.id}
                  style={{ top }}
                  onClick={seekFromClick}
                >
                  {track.clips.map((clip) => (
                    <div
                      className="timeline-audio"
                      key={clip.id}
                      title={`${state.assets.find((asset) => asset.id === clip.assetId)?.name ?? "Audio"} · Volume ${Math.round(clip.volume * 100)}%`}
                      style={{
                        left: (clip.timelineStartUs / US) * pixelsPerSecond,
                        width: Math.max(28, ((clip.sourceOutUs - clip.sourceInUs) / US) * pixelsPerSecond),
                      }}
                    >
                      <strong>{state.assets.find((asset) => asset.id === clip.assetId)?.name ?? "Audio"}</strong>
                      <span>Volume {Math.round(clip.volume * 100)}%</span>
                    </div>
                  ))}
                  {!track.clips.length && (
                    <span className="track-empty">Add audio here ({track.name})</span>
                  )}
                </div>
              );
            })}

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

      <p className="timeline-help">Space to play/pause, ⌘K / Ctrl+K to split, Shift+D to toggle a dissolve. Right-click a clip to change speed, fades, or its target track.</p>

      {clipMenu && menuClip && menuLocation && (
        <div
          className="clip-context-menu"
          role="dialog"
          aria-label="Clip settings"
          style={{ left: clipMenu.x, top: clipMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <label>
            Video track
            <select
              value={menuLocation.track.id}
              onChange={(event) => {
                controller.execute({ type: "moveClipToTrack", clipId: menuClip.id, trackId: event.target.value });
                setClipMenu(null);
              }}
            >
              {videoTracks.map((track) => (
                <option key={track.id} value={track.id}>{track.name}</option>
              ))}
            </select>
          </label>
          <label>
            Playback speed
            <select
              autoFocus
              value={menuClip.playbackRate}
              onChange={(event) => controller.execute({
                type: "setClipSpeed",
                clipId: menuClip.id,
                playbackRate: Number(event.target.value),
              })}
            >
              {PLAYBACK_RATES.map((rate) => (
                <option key={rate} value={rate}>{rate}×</option>
              ))}
            </select>
          </label>
          <label>
            Fade in
            <select
              value={menuClip.fadeInUs}
              onChange={(event) => controller.execute({
                type: "setClipFade",
                clipId: menuClip.id,
                fadeInUs: Number(event.target.value),
                fadeOutUs: menuClip.fadeOutUs,
              })}
            >
              {allowedFadeDurations.map((duration) => (
                <option key={duration} value={duration}>{fadeLabel(duration)}</option>
              ))}
            </select>
          </label>
          <label>
            Fade out
            <select
              value={menuClip.fadeOutUs}
              onChange={(event) => controller.execute({
                type: "setClipFade",
                clipId: menuClip.id,
                fadeInUs: menuClip.fadeInUs,
                fadeOutUs: Number(event.target.value),
              })}
            >
              {allowedFadeDurations.map((duration) => (
                <option key={duration} value={duration}>{fadeLabel(duration)}</option>
              ))}
            </select>
          </label>
          <small>Speed and fades are per clip. Moving a clip to another track keeps its source range.</small>
        </div>
      )}
    </div>
  );
}