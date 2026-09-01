import { useEffect, useMemo, useState, useSyncExternalStore, type DragEvent } from "react";
import { EditorController } from "./editor/controller";
import { EditorCommandError } from "./editor/executor";
import {
  CANVAS_PRESETS,
  allVideoClips,
  clipDurationUs,
  findVideoClipLocation,
  getAudioTracks,
  getVideoTracks,
  type AssetKind,
  type CanvasFitMode,
  type CanvasPresetId,
  type VideoClip,
} from "./editor/model";
import { ExportPanel } from "./export/ExportPanel";
import { inferAssetKind } from "./media/kind";
import { MediaRuntime } from "./media/runtime";
import { probeMediaFile } from "./media/probe";
import { Preview } from "./preview/Preview";
import { Timeline } from "./timeline/Timeline";
import { WebMCPTools, type AgentActivity } from "./webmcp/WebMCPTools";

const US = 1_000_000;
const CANVAS_PRESET_IDS = Object.keys(CANVAS_PRESETS) as CanvasPresetId[];

function newId(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function seconds(us: number): string {
  return (us / US).toFixed(2);
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName);
}

function App() {
  const controller = useMemo(() => new EditorController(), []);
  const runtime = useMemo(() => new MediaRuntime(), []);
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [videoTargetTrackId, setVideoTargetTrackId] = useState<string | null>(null);
  const [audioTargetTrackId, setAudioTargetTrackId] = useState<string | null>(null);
  const videoClips = useMemo(() => allVideoClips(state), [state.tracks]);
  const videoTracks = useMemo(() => getVideoTracks(state), [state.tracks]);
  const audioTracks = useMemo(() => getAudioTracks(state), [state.tracks]);
  const videoAssetCount = state.assets.filter((asset) => asset.kind === "video").length;
  const audioAssetCount = state.assets.filter((asset) => asset.kind === "audio").length;

  useEffect(() => () => runtime.dispose(), [runtime]);

  useEffect(() => {
    if (!videoClips.length) {
      if (selectedClipId !== null) setSelectedClipId(null);
      return;
    }
    if (!videoClips.some((clip) => clip.id === selectedClipId)) {
      setSelectedClipId(videoClips[0].id);
    }
  }, [selectedClipId, videoClips]);

  useEffect(() => {
    if (!videoTracks.length) return;
    if (!videoTargetTrackId || !videoTracks.some((track) => track.id === videoTargetTrackId)) {
      setVideoTargetTrackId(videoTracks[0].id);
    }
  }, [videoTargetTrackId, videoTracks]);

  useEffect(() => {
    if (!audioTracks.length) return;
    if (!audioTargetTrackId || !audioTracks.some((track) => track.id === audioTargetTrackId)) {
      setAudioTargetTrackId(audioTracks[0].id);
    }
  }, [audioTargetTrackId, audioTracks]);

  const run = (action: () => void): boolean => {
    try {
      setError(null);
      action();
      return true;
    } catch (caught) {
      setError(caught instanceof EditorCommandError || caught instanceof Error ? caught.message : String(caught));
      return false;
    }
  };

  const registerMediaFiles = async (
    entries: Array<{ file: File; kind: AssetKind }>,
    initialFailures: string[] = [],
  ) => {
    if (!entries.length && !initialFailures.length) return;
    setLoading(true);
    setError(null);
    const failures = [...initialFailures];
    try {
      for (const { file, kind } of entries) {
        try {
          const asset = await probeMediaFile(file, kind);
          runtime.register(asset.id, file);
          try {
            controller.registerAsset(asset);
          } catch (caught) {
            runtime.remove(asset.id);
            throw caught;
          }
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : String(caught);
          failures.push(message.startsWith(`${file.name}:`) ? message : `${file.name}: ${message}`);
        }
      }
    } finally {
      setLoading(false);
      setError(failures.length ? failures.join(" / ") : null);
    }
  };

  const loadFiles = async (files: FileList | null, kind: AssetKind) => {
    if (!files?.length) return;
    await registerMediaFiles(Array.from(files, (file) => ({ file, kind })));
  };

  const loadDroppedFiles = async (files: FileList) => {
    const entries: Array<{ file: File; kind: AssetKind }> = [];
    const unsupported: string[] = [];
    for (const file of Array.from(files)) {
      const kind = inferAssetKind(file);
      if (kind) entries.push({ file, kind });
      else unsupported.push(`${file.name}: Unsupported video or audio file`);
    }
    await registerMediaFiles(entries, unsupported);
  };

  const onMediaDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    setDragActive(false);
    void loadDroppedFiles(event.dataTransfer.files);
  };

  const addVideo = (assetId: string, trackId?: string) => {
    const asset = state.assets.find((item) => item.id === assetId);
    if (!asset || asset.kind !== "video") return;
    const clipId = newId("clip");
    if (run(() =>
      controller.execute({
        type: "addClip",
        ...(trackId ? { trackId } : {}),
        clip: {
          id: clipId,
          assetId,
          sourceInUs: 0,
          sourceOutUs: asset.durationUs,
        },
      }),
    )) setSelectedClipId(clipId);
  };

  const setAudioTrack = (assetId: string, trackId?: string) => {
    const asset = state.assets.find((item) => item.id === assetId);
    if (!asset || asset.kind !== "audio") return;
    const currentTrack = trackId ? audioTracks.find((track) => track.id === trackId) : audioTracks[0];
    const existing = currentTrack?.clips[0];
    run(() =>
      controller.execute({
        type: "setAudio",
        ...(trackId ? { trackId } : {}),
        audio: {
          id: existing?.id ?? newId("audio-clip"),
          assetId,
          timelineStartUs: existing?.timelineStartUs ?? 0,
          sourceInUs: 0,
          sourceOutUs: asset.durationUs,
          volume: existing?.volume ?? 0.7,
        },
      }),
    );
  };

  const trim = (clip: VideoClip, side: "in" | "out") => {
    const step = 100_000;
    const sourceInUs = side === "in" ? clip.sourceInUs + step : clip.sourceInUs;
    const sourceOutUs = side === "out" ? clip.sourceOutUs - step : clip.sourceOutUs;
    run(() => controller.execute({ type: "trimClip", clipId: clip.id, sourceInUs, sourceOutUs }));
  };

  const recordActivity = (activity: AgentActivity) => {
    setActivities((current) => [activity, ...current].slice(0, 8));
  };

  const selectedLocation = selectedClipId ? findVideoClipLocation(state, selectedClipId) ?? null : null;
  const selectedClip = selectedLocation?.clip ?? null;
  const selectedIndex = selectedLocation?.clipIndex ?? -1;
  const selectedTrack = selectedLocation?.track ?? null;
  const nextClip = selectedTrack && selectedIndex >= 0 ? selectedTrack.clips[selectedIndex + 1] : undefined;
  const selectedTransition = selectedClip && nextClip
    ? state.transitions.find(
        (transition) => transition.fromClipId === selectedClip.id && transition.toClipId === nextClip.id,
      )
    : undefined;
  const videoTargetTrack = videoTracks.find((track) => track.id === videoTargetTrackId) ?? videoTracks[0] ?? null;
  const audioTargetTrack = audioTracks.find((track) => track.id === audioTargetTrackId) ?? audioTracks[0] ?? null;
  const splitSelectedClip = (): boolean => {
    if (!selectedClip) return false;
    const newClipId = newId("clip");
    const didSplit = run(() => controller.execute({
      type: "splitClip",
      clipId: selectedClip.id,
      atTimelineUs: state.playheadUs,
      newClipId,
    }));
    if (didSplit) setSelectedClipId(newClipId);
    return didSplit;
  };

  const toggleSelectedDissolve = (): boolean => {
    if (!selectedClip || !nextClip) return false;
    if (selectedTransition) {
      return run(() => controller.execute({
        type: "removeTransition",
        transitionId: selectedTransition.id,
      }));
    }
    return run(() => controller.execute({
      type: "addTransition",
      transition: {
        id: newId("transition"),
        kind: "cross-dissolve",
        fromClipId: selectedClip.id,
        toClipId: nextClip.id,
        durationUs: 500_000,
      },
    }));
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();

      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && key === "k") {
        if (!selectedClip) return;
        event.preventDefault();
        splitSelectedClip();
        return;
      }

      if (!event.metaKey && !event.ctrlKey && !event.altKey && event.shiftKey && key === "d") {
        if (!selectedClip || !nextClip) return;
        event.preventDefault();
        toggleSelectedDissolve();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedClip, nextClip, selectedTransition, state.playheadUs]);

  const setCanvas = (preset: CanvasPresetId, fitMode: CanvasFitMode) => {
    run(() => controller.execute({ type: "setCanvas", preset, fitMode }));
  };

  return (
    <main className="app-shell">
      <header className="app-bar">
        <div className="app-bar-primary">
          <div className="brand-lockup">
            <h1 className="app-logo">DOGAGA</h1>
            <span className="app-tagline">Compact WebMCP video editor</span>
          </div>
          <WebMCPTools controller={controller} onActivity={recordActivity} />
        </div>
        <div className="app-bar-tools">
          <div className="app-bar-canvas" aria-label="Video display settings">
            <label>
              Canvas
              <select
                name="canvas-preset"
                value={state.canvas.preset}
                onChange={(event) => setCanvas(event.target.value as CanvasPresetId, state.canvas.fitMode)}
              >
                {CANVAS_PRESET_IDS.map((presetId) => (
                  <option value={presetId} key={presetId}>{CANVAS_PRESETS[presetId].label}</option>
                ))}
              </select>
            </label>
            <label>
              Source fit
              <select
                name="canvas-fit"
                value={state.canvas.fitMode}
                onChange={(event) => setCanvas(state.canvas.preset, event.target.value as CanvasFitMode)}
              >
                <option value="contain">Contain</option>
                <option value="cover">Cover</option>
              </select>
            </label>
          </div>
          <a className="export-shortcut" href="#export">Export</a>
        </div>
      </header>

      <div className="editor-workspace">
        <section className="panel media-panel media-rail">
          <h2>Media</h2>
          <div className="file-row">
            <label className="file-picker">
              <span>Select video</span>
              <span className="file-picker-control">
                <span className="file-picker-button" aria-hidden="true">Choose</span>
                <span className="file-picker-status" aria-live="polite">
                  {videoAssetCount
                    ? `${videoAssetCount} video ${videoAssetCount === 1 ? "file" : "files"} loaded`
                    : "No videos loaded"}
                </span>
              </span>
              <input
                className="file-picker-input"
                type="file"
                accept="video/*"
                multiple
                aria-label="Select video files"
                onChange={(event) => void loadFiles(event.target.files, "video")}
              />
            </label>
            <label className="file-picker">
              <span>Select audio</span>
              <span className="file-picker-control">
                <span className="file-picker-button" aria-hidden="true">Choose</span>
                <span className="file-picker-status" aria-live="polite">
                  {audioAssetCount
                    ? `${audioAssetCount} audio ${audioAssetCount === 1 ? "file" : "files"} loaded`
                    : "No audio loaded"}
                </span>
              </span>
              <input
                className="file-picker-input"
                type="file"
                accept="audio/*"
                aria-label="Select audio file"
                onChange={(event) => void loadFiles(event.target.files, "audio")}
              />
            </label>
          </div>
          <div
            className={`media-dropzone${dragActive ? " drag-active" : ""}`}
            aria-label="Video or audio file drop zone"
            onDragEnter={(event) => {
              if (!Array.from(event.dataTransfer.types).includes("Files")) return;
              event.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(event) => {
              if (!Array.from(event.dataTransfer.types).includes("Files")) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }}
            onDragLeave={(event) => {
              const related = event.relatedTarget;
              if (!(related instanceof Node) || !event.currentTarget.contains(related)) setDragActive(false);
            }}
            onDrop={onMediaDrop}
          >
            <strong>{loading ? "Reading media metadata…" : "Drag & drop files here"}</strong>
            <span>Examples: WebM, MP4, MP3, WAV</span>
          </div>
          <div className="asset-list">
            {state.assets.map((asset) => (
              <div className="asset-card" key={asset.id}>
                <div>
                  <strong>{asset.name}</strong>
                  <small>{asset.kind} · {seconds(asset.durationUs)}s</small>
                </div>
                {asset.kind === "video" ? (
                  <div className="asset-card-actions">
                    <select
                      name={`video-target-${asset.id}`}
                      aria-label={`Target video track for ${asset.name}`}
                      value={videoTargetTrack?.id ?? ""}
                      onChange={(event) => setVideoTargetTrackId(event.target.value)}
                    >
                      {videoTracks.map((track) => (
                        <option key={track.id} value={track.id}>{track.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label={`Add ${asset.name} to ${videoTargetTrack?.name ?? "video track"}`}
                      onClick={() => addVideo(asset.id, videoTargetTrack?.id)}
                    >Add</button>
                  </div>
                ) : (
                  <div className="asset-card-actions">
                    <select
                      name={`audio-target-${asset.id}`}
                      aria-label={`Target audio track for ${asset.name}`}
                      value={audioTargetTrack?.id ?? ""}
                      onChange={(event) => setAudioTargetTrackId(event.target.value)}
                    >
                      {audioTracks.map((track) => (
                        <option key={track.id} value={track.id}>{track.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label={`Add ${asset.name} to ${audioTargetTrack?.name ?? "audio track"}`}
                      onClick={() => setAudioTrack(asset.id, audioTargetTrack?.id)}
                    >Add</button>
                  </div>
                )}
              </div>
            ))}
            {!state.assets.length && <p className="muted">No media loaded yet.</p>}
          </div>
        </section>

        <section className="panel preview-panel preview-main">
          <div className="panel-heading">
            <h2>Preview</h2>
            <span className="canvas-resolution">{state.canvas.width} × {state.canvas.height}</span>
          </div>
          <Preview state={state} controller={controller} runtime={runtime} />
        </section>
      </div>

      <section className="panel timeline-panel">
        <Timeline
          state={state}
          controller={controller}
          selectedClipId={selectedClipId}
          onSelectClip={setSelectedClipId}
        />

        {selectedClip && selectedTrack ? (
          <div className="clip-inspector">
            <div className="inspector-summary">
              <small>Selected clip · {selectedTrack.name}</small>
              <strong>{state.assets.find((asset) => asset.id === selectedClip.assetId)?.name ?? selectedClip.assetId}</strong>
              <span>
                {seconds(selectedClip.timelineStartUs)}s → {seconds(selectedClip.timelineStartUs + clipDurationUs(selectedClip))}s
                · Source {seconds(selectedClip.sourceInUs)}–{seconds(selectedClip.sourceOutUs)}s
                · Speed {selectedClip.playbackRate}×
              </span>
            </div>
            <div className="button-row inspector-actions">
              <label className="inspector-track-select">
                Video track
                <select
                  name={`selected-clip-track-${selectedClip.id}`}
                  value={selectedTrack.id}
                  onChange={(event) => run(() => controller.execute({
                    type: "moveClipToTrack",
                    clipId: selectedClip.id,
                    trackId: event.target.value,
                  }))}
                >
                  {videoTracks.map((track) => (
                    <option key={track.id} value={track.id}>{track.name}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={selectedIndex === 0}
                onClick={() => run(() => controller.execute({ type: "moveClip", clipId: selectedClip.id, toIndex: selectedIndex - 1 }))}
              >Move earlier</button>
              <button
                type="button"
                disabled={selectedIndex === selectedTrack.clips.length - 1}
                onClick={() => run(() => controller.execute({ type: "moveClip", clipId: selectedClip.id, toIndex: selectedIndex + 1 }))}
              >Move later</button>
              <button type="button" onClick={splitSelectedClip}>Split at playhead</button>
              <button type="button" onClick={() => trim(selectedClip, "in")}>Trim 0.1s from start</button>
              <button type="button" onClick={() => trim(selectedClip, "out")}>Trim 0.1s from end</button>
              <button className="danger-button" type="button" onClick={() => run(() => controller.execute({ type: "deleteClip", clipId: selectedClip.id }))}>Delete</button>
            </div>
            {nextClip && (
              selectedTransition ? (
                <button
                  type="button"
                  className="transition-button active"
                  onClick={toggleSelectedDissolve}
                >Remove 0.5s dissolve to next clip (Shift+D)</button>
              ) : (
                <button
                  type="button"
                  className="transition-button"
                  onClick={toggleSelectedDissolve}
                >Add 0.5s dissolve to next clip (Shift+D)</button>
              )
            )}
          </div>
        ) : (
          <p className="muted inspector-empty">Select a video clip to show move, trim, delete, and dissolve controls.</p>
        )}

        {audioTracks.map((track) => {
          const clip = track.clips[0] ?? null;
          return (
            <div className="audio-strip" key={track.id}>
              <strong>{track.name} audio</strong>
              {clip ? (
                <>
                  <span className="audio-strip-name">{state.assets.find((asset) => asset.id === clip.assetId)?.name}</span>
                  <label>
                    Start (s)
                    <input
                      name={`audio-start-${track.id}`}
                      aria-label={`${track.name} start position in seconds`}
                      type="number"
                      min="0"
                      step="0.1"
                      value={seconds(clip.timelineStartUs)}
                      onChange={(event) => run(() => controller.execute({
                        type: "setAudio",
                        trackId: track.id,
                        audio: {
                          ...clip,
                          timelineStartUs: Math.max(0, Math.round(Number(event.target.value) * US)),
                        },
                      }))}
                    />
                  </label>
                  <label>
                    Volume
                    <input
                      name={`audio-volume-${track.id}`}
                      aria-label={`${track.name} volume`}
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={clip.volume}
                      onChange={(event) => run(() => controller.execute({
                        type: "setAudio",
                        trackId: track.id,
                        audio: { ...clip, volume: Number(event.target.value) },
                      }))}
                    />
                  </label>
                  <button
                    type="button"
                    aria-label={`Remove audio from ${track.name}`}
                    onClick={() => run(() => controller.execute({ type: "setAudio", trackId: track.id, audio: null }))}
                  >Remove audio</button>
                </>
              ) : (
                <label>
                  Add audio
                  <select
                    name={`audio-source-${track.id}`}
                    aria-label={`Audio source for ${track.name}`}
                    defaultValue=""
                    onChange={(event) => {
                      const assetId = event.target.value;
                      if (assetId) setAudioTrack(assetId, track.id);
                      event.currentTarget.value = "";
                    }}
                  >
                    <option value="" disabled>Select…</option>
                    {state.assets.filter((asset) => asset.kind === "audio").map((asset) => (
                      <option key={asset.id} value={asset.id}>{asset.name}</option>
                    ))}
                  </select>
                </label>
              )}
              {track.muted && <span className="muted">Muted</span>}
            </div>
          );
        })}
      </section>

      <div className="export-primary" id="export">
        <ExportPanel state={state} runtime={runtime} />
      </div>

      <details className="developer-details">
        <summary>
          <span>WebMCP & developer details</span>
          <small>Inspect agent activity and the agent-safe shared state</small>
        </summary>
        <div className="developer-content">
          <section className="panel agent-panel">
            <h2>Agent activity</h2>
            <div className="activity-list" aria-live="polite">
              {activities.map((activity) => (
                <div className={`activity-item ${activity.status}`} key={activity.id}>
                  <strong>Agent: {activity.tool}</strong>
                  <span>{activity.status === "success" ? "Success" : "Error"}</span>
                  <small>{activity.message}</small>
                </div>
              ))}
              {!activities.length && <p className="muted">Agent tool calls will appear here.</p>}
            </div>
          </section>

          <section className="panel state-panel">
            <h2>State shared with the agent</h2>
            <p className="muted">This is the agent-safe state returned by WebMCP `get_project_state`. It never includes local files, filesystem paths, or object URLs.</p>
            <pre>{JSON.stringify(controller.getSafeState(), null, 2)}</pre>
          </section>
        </div>
      </details>

      {error && <aside className="error-banner" role="alert">{error}</aside>}
    </main>
  );
}

export default App;