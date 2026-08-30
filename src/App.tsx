import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { EditorController } from "./editor/controller";
import { EditorCommandError } from "./editor/executor";
import {
  CANVAS_PRESETS,
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

  useEffect(() => () => runtime.dispose(), [runtime]);

  useEffect(() => {
    if (!state.videoClips.length) {
      if (selectedClipId !== null) setSelectedClipId(null);
      return;
    }
    if (!state.videoClips.some((clip) => clip.id === selectedClipId)) {
      setSelectedClipId(state.videoClips[0].id);
    }
  }, [selectedClipId, state.videoClips]);

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

  const addVideo = (assetId: string) => {
    const asset = state.assets.find((item) => item.id === assetId);
    if (!asset || asset.kind !== "video") return;
    const clipId = newId("clip");
    if (run(() =>
      controller.execute({
        type: "addClip",
        clip: {
          id: clipId,
          assetId,
          sourceInUs: 0,
          sourceOutUs: asset.durationUs,
        },
      }),
    )) setSelectedClipId(clipId);
  };

  const setAudio = (assetId: string) => {
    const asset = state.assets.find((item) => item.id === assetId);
    if (!asset || asset.kind !== "audio") return;
    run(() =>
      controller.execute({
        type: "setAudio",
        audio: {
          id: newId("audio-clip"),
          assetId,
          timelineStartUs: 0,
          sourceInUs: 0,
          sourceOutUs: asset.durationUs,
          volume: 0.7,
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

  const selectedClip = state.videoClips.find((clip) => clip.id === selectedClipId) ?? null;
  const selectedIndex = selectedClip
    ? state.videoClips.findIndex((clip) => clip.id === selectedClip.id)
    : -1;
  const nextClip = selectedIndex >= 0 ? state.videoClips[selectedIndex + 1] : undefined;
  const selectedTransition = selectedClip && nextClip
    ? state.transitions.find(
        (transition) => transition.fromClipId === selectedClip.id && transition.toClipId === nextClip.id,
      )
    : undefined;

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
      <header className="hero">
        <p className="eyebrow">Compact WebMCP Video Editor</p>
        <h1>DOGAGA</h1>
        <p>自分の動画をブラウザで編集し、その同じ編集stateをbrowser agentとも共有するコンパクトな動画編集アプリ。</p>
      </header>

      <section className="panel media-panel">
        <h2>1. 素材</h2>
        <div className="file-row">
          <label>
            動画を選択
            <input type="file" accept="video/*" multiple onChange={(event) => void loadFiles(event.target.files, "video")} />
          </label>
          <label>
            音源を選択
            <input type="file" accept="audio/*" onChange={(event) => void loadFiles(event.target.files, "audio")} />
          </label>
        </div>
        {loading && <p>metadataを読み込み中…</p>}
        <div className="asset-list">
          {state.assets.map((asset) => (
            <div className="asset-card" key={asset.id}>
              <div>
                <strong>{asset.name}</strong>
                <small>{asset.kind} · {seconds(asset.durationUs)}s</small>
              </div>
              {asset.kind === "video" ? (
                <button type="button" onClick={() => addVideo(asset.id)}>タイムライン末尾へ</button>
              ) : (
                <button type="button" onClick={() => setAudio(asset.id)}>音源に設定</button>
              )}
            </div>
          ))}
          {!state.assets.length && <p className="muted">まだ素材は読み込まれていません。</p>}
        </div>
      </section>

      <section className="panel preview-panel">
        <div className="panel-heading">
          <div>
            <h2>2. プレビュー</h2>
            <span className="canvas-resolution">{state.canvas.width} × {state.canvas.height}</span>
          </div>
          <div className="canvas-controls">
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
        </div>
        <Preview state={state} controller={controller} runtime={runtime} />
      </section>

      <section className="panel timeline-panel">
        <h2>3. タイムライン</h2>
        <p className="muted">⌘K / Ctrl+K: 再生ヘッドでカット（分割） ・ Shift+D: 次のclipとのディゾルブ切替</p>
        <Timeline
          state={state}
          controller={controller}
          selectedClipId={selectedClipId}
          onSelectClip={setSelectedClipId}
        />

        {selectedClip ? (
          <div className="clip-inspector">
            <div className="inspector-summary">
              <small>選択中のクリップ</small>
              <strong>{state.assets.find((asset) => asset.id === selectedClip.assetId)?.name ?? selectedClip.assetId}</strong>
              <span>
                {seconds(selectedClip.timelineStartUs)}s → {seconds(selectedClip.timelineStartUs + selectedClip.sourceOutUs - selectedClip.sourceInUs)}s
                ・素材 {seconds(selectedClip.sourceInUs)}–{seconds(selectedClip.sourceOutUs)}s
              </span>
            </div>
            <div className="button-row inspector-actions">
              <button type="button" disabled={selectedIndex === 0} onClick={() => run(() => controller.execute({ type: "moveClip", clipId: selectedClip.id, toIndex: selectedIndex - 1 }))}>前へ移動</button>
              <button type="button" disabled={selectedIndex === state.videoClips.length - 1} onClick={() => run(() => controller.execute({ type: "moveClip", clipId: selectedClip.id, toIndex: selectedIndex + 1 }))}>後ろへ移動</button>
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
                >
                  次のクリップとの0.5秒ディゾルブを外す（Shift+D）
                </button>
              ) : (
                <button
                  type="button"
                  className="transition-button"
                  onClick={toggleSelectedDissolve}
                >
                  次のクリップとの境界に0.5秒ディゾルブ（Shift+D）
                </button>
              )
            )}
          </div>
        ) : (
          <p className="muted inspector-empty">V1のクリップを選択すると、移動・カット・削除・ディゾルブ操作が表示されます。</p>
        )}

        {state.audioClip && (
          <div className="audio-strip">
            <strong>A1 音楽</strong>
            <span>{state.assets.find((asset) => asset.id === state.audioClip?.assetId)?.name}</span>
            <label>
              Start (s)
              <input
                type="number"
                min="0"
                step="0.1"
                value={seconds(state.audioClip.timelineStartUs)}
                onChange={(event) => run(() => controller.execute({
                  type: "setAudio",
                  audio: {
                    ...state.audioClip!,
                    timelineStartUs: Math.max(0, Math.round(Number(event.target.value) * US)),
                  },
                }))}
              />
            </label>
            <label>
              Volume
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={state.audioClip.volume}
                onChange={(event) => run(() => controller.execute({
                  type: "setAudio",
                  audio: { ...state.audioClip!, volume: Number(event.target.value) },
                }))}
              />
            </label>
            <button type="button" onClick={() => run(() => controller.execute({ type: "setAudio", audio: null }))}>音源解除</button>
          </div>
        )}
      </section>

      <ExportPanel state={state} runtime={runtime} />

      <section className="panel agent-panel">
        <h2>5. WebMCP / Agent</h2>
        <WebMCPTools controller={controller} onActivity={recordActivity} />
        <div className="activity-list" aria-live="polite">
          {activities.map((activity) => (
            <div className={`activity-item ${activity.status}`} key={activity.id}>
              <strong>Agent: {activity.tool}</strong>
              <span>{activity.status === "success" ? "成功" : "エラー"}</span>
              <small>{activity.message}</small>
            </div>
          ))}
          {!activities.length && <p className="muted">Agentからtoolが実行されると、ここに履歴が表示されます。</p>}
        </div>
      </section>

      <section className="panel state-panel">
        <h2>6. Agent-safe state</h2>
        <p className="muted">WebMCPの `get_project_state` はこの形だけを返す。File / path / object URLは含めない。</p>
        <pre>{JSON.stringify(controller.getSafeState(), null, 2)}</pre>
      </section>

      {error && <aside className="error-banner" role="alert">{error}</aside>}
    </main>
  );
}

export default App;
