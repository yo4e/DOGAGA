import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
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
  const [videoTargetTrackId, setVideoTargetTrackId] = useState<string | null>(null);
  const [audioTargetTrackId, setAudioTargetTrackId] = useState<string | null>(null);
  const videoClips = useMemo(() => allVideoClips(state), [state.tracks]);
  const videoTracks = useMemo(() => getVideoTracks(state), [state.tracks]);
  const audioTracks = useMemo(() => getAudioTracks(state), [state.tracks]);

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

  const loadFiles = async (files: FileList | null, kind: AssetKind) => {
    if (!files?.length) return;
    setLoading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const asset = await probeMediaFile(file, kind);
        runtime.register(asset.id, file);
        controller.registerAsset(asset);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
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
        <div className="brand-lockup">
          <h1 className="app-logo">DOGAGA</h1>
          <span className="app-tagline">コンパクト WebMCP 動画エディタ</span>
        </div>
        <div className="app-bar-tools">
          <WebMCPTools controller={controller} onActivity={recordActivity} />
          <div className="app-bar-canvas" aria-label="動画の表示設定">
            <label>
              動画サイズ
              <select
                value={state.canvas.preset}
                onChange={(event) => setCanvas(event.target.value as CanvasPresetId, state.canvas.fitMode)}
              >
                {CANVAS_PRESET_IDS.map((presetId) => (
                  <option value={presetId} key={presetId}>{CANVAS_PRESETS[presetId].label}</option>
                ))}
              </select>
            </label>
            <label>
              素材の表示
              <select
                value={state.canvas.fitMode}
                onChange={(event) => setCanvas(state.canvas.preset, event.target.value as CanvasFitMode)}
              >
                <option value="contain">全体を表示</option>
                <option value="cover">画面いっぱい</option>
              </select>
            </label>
          </div>
          <a className="export-shortcut" href="#export">書き出し</a>
        </div>
      </header>

      <div className="editor-workspace">
        <section className="panel media-panel media-rail">
          <h2>素材</h2>
          <div className="file-row">
            <label>
              動画を選択
              <input type="file" accept="video/*" multiple onChange={(event) => void loadFiles(event.target.files, "video")} />
            </label>
            <label>
              音源を選択
              <input type="file" accept="audio/*" onChange={(event) => void loadFiles(event.target.files, "audio")} />
            </label>
            <label>
              動画の追加先
              <select
                value={videoTargetTrack?.id ?? ""}
                onChange={(event) => setVideoTargetTrackId(event.target.value)}
              >
                {videoTracks.map((track) => (
                  <option key={track.id} value={track.id}>{track.name}</option>
                ))}
              </select>
            </label>
            <label>
              音声の追加先
              <select
                value={audioTargetTrack?.id ?? ""}
                onChange={(event) => setAudioTargetTrackId(event.target.value)}
              >
                {audioTracks.map((track) => (
                  <option key={track.id} value={track.id}>{track.name}</option>
                ))}
              </select>
            </label>
          </div>
          {loading && <p>メディア情報を読み込み中…</p>}
          <div className="asset-list">
            {state.assets.map((asset) => (
              <div className="asset-card" key={asset.id}>
                <div>
                  <strong>{asset.name}</strong>
                  <small>{asset.kind} · {seconds(asset.durationUs)}s</small>
                </div>
                {asset.kind === "video" ? (
                  <button type="button" onClick={() => addVideo(asset.id, videoTargetTrack?.id)}>
                    {videoTargetTrack?.name ?? "V1"}末尾へ
                  </button>
                ) : (
                  <button type="button" onClick={() => setAudioTrack(asset.id, audioTargetTrack?.id)}>
                    {audioTargetTrack?.name ?? "A1"}に設定
                  </button>
                )}
              </div>
            ))}
            {!state.assets.length && <p className="muted">まだ素材は読み込まれていません。</p>}
          </div>
        </section>

        <section className="panel preview-panel preview-main">
          <div className="panel-heading">
            <div>
              <h2>プレビュー</h2>
              <span className="canvas-resolution">{state.canvas.width} × {state.canvas.height}</span>
            </div>
          </div>
          <Preview state={state} controller={controller} runtime={runtime} />
        </section>
      </div>

      <section className="panel timeline-panel">
        <h2>タイムライン</h2>
        <Timeline
          state={state}
          controller={controller}
          selectedClipId={selectedClipId}
          onSelectClip={setSelectedClipId}
        />

        {selectedClip && selectedTrack ? (
          <div className="clip-inspector">
            <div className="inspector-summary">
              <small>選択中のクリップ · {selectedTrack.name}</small>
              <strong>{state.assets.find((asset) => asset.id === selectedClip.assetId)?.name ?? selectedClip.assetId}</strong>
              <span>
                {seconds(selectedClip.timelineStartUs)}s → {seconds(selectedClip.timelineStartUs + clipDurationUs(selectedClip))}s
                ・素材 {seconds(selectedClip.sourceInUs)}–{seconds(selectedClip.sourceOutUs)}s
                ・速度 {selectedClip.playbackRate}×
              </span>
            </div>
            <div className="button-row inspector-actions">
              <button
                type="button"
                disabled={selectedIndex === 0}
                onClick={() => run(() => controller.execute({ type: "moveClip", clipId: selectedClip.id, toIndex: selectedIndex - 1 }))}
              >前へ移動</button>
              <button
                type="button"
                disabled={selectedIndex === selectedTrack.clips.length - 1}
                onClick={() => run(() => controller.execute({ type: "moveClip", clipId: selectedClip.id, toIndex: selectedIndex + 1 }))}
              >後ろへ移動</button>
              <button type="button" onClick={splitSelectedClip}>再生ヘッドで分割</button>
              <button type="button" onClick={() => trim(selectedClip, "in")}>開始を0.1秒カット</button>
              <button type="button" onClick={() => trim(selectedClip, "out")}>終了を0.1秒カット</button>
              <button className="danger-button" type="button" onClick={() => run(() => controller.execute({ type: "deleteClip", clipId: selectedClip.id }))}>削除</button>
            </div>
            {nextClip && (
              selectedTransition ? (
                <button
                  type="button"
                  className="transition-button active"
                  onClick={toggleSelectedDissolve}
                >次のクリップとの0.5秒ディゾルブを外す（Shift+D）</button>
              ) : (
                <button
                  type="button"
                  className="transition-button"
                  onClick={toggleSelectedDissolve}
                >次のクリップとの境界に0.5秒ディゾルブ（Shift+D）</button>
              )
            )}
          </div>
        ) : (
          <p className="muted inspector-empty">動画クリップを選択すると、移動・カット・削除・ディゾルブ操作が表示されます。</p>
        )}

        {audioTracks.map((track) => {
          const clip = track.clips[0] ?? null;
          return (
            <div className="audio-strip" key={track.id}>
              <strong>{track.name} 音声</strong>
              {clip ? (
                <>
                  <span>{state.assets.find((asset) => asset.id === clip.assetId)?.name}</span>
                  <label>
                    Start (s)
                    <input
                      aria-label={`${track.name}の開始位置（秒）`}
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
                      aria-label={`${track.name}の音量`}
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
                    aria-label={`${track.name}の音源を解除`}
                    onClick={() => run(() => controller.execute({ type: "setAudio", trackId: track.id, audio: null }))}
                  >音源解除</button>
                </>
              ) : (
                <label>
                  音源を設定
                  <select
                    aria-label={`${track.name}に設定する音源`}
                    defaultValue=""
                    onChange={(event) => {
                      const assetId = event.target.value;
                      if (assetId) setAudioTrack(assetId, track.id);
                      event.currentTarget.value = "";
                    }}
                  >
                    <option value="" disabled>選択…</option>
                    {state.assets.filter((asset) => asset.kind === "audio").map((asset) => (
                      <option key={asset.id} value={asset.id}>{asset.name}</option>
                    ))}
                  </select>
                </label>
              )}
              {track.muted && <span className="muted">ミュート中</span>}
            </div>
          );
        })}
      </section>

      <div className="export-primary" id="export">
        <ExportPanel state={state} runtime={runtime} />
      </div>

      <details className="developer-details">
        <summary>
          <span>WebMCP・開発者情報</span>
          <small>エージェントの実行履歴と安全な状態を確認</small>
        </summary>
        <div className="developer-content">
          <section className="panel agent-panel">
            <h2>エージェントの実行履歴</h2>
            <div className="activity-list" aria-live="polite">
              {activities.map((activity) => (
                <div className={`activity-item ${activity.status}`} key={activity.id}>
                  <strong>Agent: {activity.tool}</strong>
                  <span>{activity.status === "success" ? "成功" : "エラー"}</span>
                  <small>{activity.message}</small>
                </div>
              ))}
              {!activities.length && <p className="muted">エージェントからツールが実行されると、ここに履歴が表示されます。</p>}
            </div>
          </section>

          <section className="panel state-panel">
            <h2>エージェントに共有する状態</h2>
            <p className="muted">WebMCPの `get_project_state` が返す安全な情報です。ファイル、パス、オブジェクトURLは含みません。</p>
            <pre>{JSON.stringify(controller.getSafeState(), null, 2)}</pre>
          </section>
        </div>
      </details>

      {error && <aside className="error-banner" role="alert">{error}</aside>}
    </main>
  );
}

export default App;
