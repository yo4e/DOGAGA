import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { EditorController } from "./editor/controller";
import { EditorCommandError } from "./editor/executor";
import type { AssetKind, VideoClip } from "./editor/model";
import { MediaRuntime } from "./media/runtime";
import { probeMediaFile } from "./media/probe";
import { Preview } from "./preview/Preview";

const US = 1_000_000;

function newId(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function seconds(us: number): string {
  return (us / US).toFixed(2);
}

function App() {
  const controller = useMemo(() => new EditorController(), []);
  const runtime = useMemo(() => new MediaRuntime(), []);
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => () => runtime.dispose(), [runtime]);

  const run = (action: () => void) => {
    try {
      setError(null);
      action();
    } catch (caught) {
      setError(caught instanceof EditorCommandError || caught instanceof Error ? caught.message : String(caught));
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
    run(() =>
      controller.execute({
        type: "addClip",
        clip: {
          id: newId("clip"),
          assetId,
          sourceInUs: 0,
          sourceOutUs: asset.durationUs,
        },
      }),
    );
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
        <h2>2. プレビュー</h2>
        <Preview state={state} controller={controller} runtime={runtime} />
      </section>

      <section className="panel timeline-panel">
        <h2>3. 簡易タイムライン</h2>
        <div className="timeline-track">
          {state.videoClips.map((clip, index) => {
            const asset = state.assets.find((item) => item.id === clip.assetId);
            const transition = state.transitions.find(
              (item) => item.fromClipId === clip.id && item.toClipId === state.videoClips[index + 1]?.id,
            );
            return (
              <article className="clip-card" key={clip.id}>
                <strong>{asset?.name ?? clip.assetId}</strong>
                <small>{seconds(clip.timelineStartUs)}s → {seconds(clip.timelineStartUs + clip.sourceOutUs - clip.sourceInUs)}s</small>
                <small>source {seconds(clip.sourceInUs)}–{seconds(clip.sourceOutUs)}s</small>
                <div className="button-row">
                  <button type="button" disabled={index === 0} onClick={() => run(() => controller.execute({ type: "moveClip", clipId: clip.id, toIndex: index - 1 }))}>←</button>
                  <button type="button" disabled={index === state.videoClips.length - 1} onClick={() => run(() => controller.execute({ type: "moveClip", clipId: clip.id, toIndex: index + 1 }))}>→</button>
                  <button type="button" onClick={() => trim(clip, "in")}>In +0.1s</button>
                  <button type="button" onClick={() => trim(clip, "out")}>Out -0.1s</button>
                  <button type="button" onClick={() => run(() => controller.execute({ type: "deleteClip", clipId: clip.id }))}>削除</button>
                </div>
                {index < state.videoClips.length - 1 && (
                  transition ? (
                    <button
                      type="button"
                      className="transition-button active"
                      onClick={() => run(() => controller.execute({ type: "removeTransition", transitionId: transition.id }))}
                    >
                      0.5s dissolveを外す
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="transition-button"
                      onClick={() => run(() => controller.execute({
                        type: "addTransition",
                        transition: {
                          id: newId("transition"),
                          kind: "cross-dissolve",
                          fromClipId: clip.id,
                          toClipId: state.videoClips[index + 1].id,
                          durationUs: 500_000,
                        },
                      }))}
                    >
                      次との境界に0.5s dissolve
                    </button>
                  )
                )}
              </article>
            );
          })}
          {!state.videoClips.length && <p className="muted">動画clipを追加するとここに並びます。</p>}
        </div>
        {state.audioClip && (
          <div className="audio-strip">
            <strong>Audio</strong>
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

      <section className="panel state-panel">
        <h2>4. Agent-safe state</h2>
        <p className="muted">WebMCPの `get_project_state` はこの形だけを返す。File / path / object URLは含めない。</p>
        <pre>{JSON.stringify(controller.getSafeState(), null, 2)}</pre>
      </section>

      {error && <aside className="error-banner" role="alert">{error}</aside>}
    </main>
  );
}

export default App;
