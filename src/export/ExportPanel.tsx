import { useEffect, useRef, useState } from "react";
import type { EditorState } from "../editor/model";
import type { MediaRuntime } from "../media/runtime";
import { exportProject, type ExportResult } from "./exporter";

const US = 1_000_000;

type Props = {
  state: EditorState;
  runtime: MediaRuntime;
};

type Download = {
  url: string;
  filename: string;
  result: ExportResult;
};

function timestampName(extension: "mp4" | "webm"): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  return `dogaga-${stamp}.${extension}`;
}

function percent(elapsedUs: number, totalUs: number): number {
  if (totalUs <= 0) return 0;
  return Math.min(100, Math.max(0, (elapsedUs / totalUs) * 100));
}

export function ExportPanel({ state, runtime }: Props) {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState({ elapsedUs: 0, totalUs: 0 });
  const [error, setError] = useState<string | null>(null);
  const [download, setDownload] = useState<Download | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (download) URL.revokeObjectURL(download.url);
  }, [download]);

  const clearDownload = () => {
    setDownload((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  };

  const start = async () => {
    clearDownload();
    setError(null);
    setProgress({ elapsedUs: 0, totalUs: 0 });
    setExporting(true);
    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const result = await exportProject({
        state,
        runtime,
        signal: abortController.signal,
        onProgress: setProgress,
      });
      const url = URL.createObjectURL(result.blob);
      setDownload({ url, filename: timestampName(result.format.extension), result });
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        setError("書き出しをキャンセルしました");
      } else {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    } finally {
      abortRef.current = null;
      setExporting(false);
    }
  };

  const progressPercent = percent(progress.elapsedUs, progress.totalUs);

  return (
    <section className="panel export-panel">
      <h2>4. 書き出し</h2>
      <p className="muted">
        現在のV1 / A1、動画サイズ、表示方法、ディゾルブを実動画へ反映してローカルで書き出します。
        利用可能ならMP4、対応していない環境ではWebMを使います。
      </p>

      <div className="export-actions">
        <button type="button" disabled={exporting || !state.videoClips.length} onClick={() => void start()}>
          {exporting ? "書き出し中…" : "動画を書き出す"}
        </button>
        {exporting && (
          <button type="button" onClick={() => abortRef.current?.abort()}>
            キャンセル
          </button>
        )}
      </div>

      {exporting && (
        <div className="export-progress">
          <progress max="100" value={progressPercent} />
          <span>
            {(progress.elapsedUs / US).toFixed(1)}s / {(progress.totalUs / US).toFixed(1)}s
            ・{progressPercent.toFixed(0)}%
          </span>
        </div>
      )}

      {download && (
        <div className="export-result">
          <strong>書き出し完了</strong>
          <span>
            {download.result.format.extension.toUpperCase()} ・ {(download.result.blob.size / 1024 / 1024).toFixed(1)} MB
          </span>
          <a className="download-link" href={download.url} download={download.filename}>
            {download.filename} をダウンロード
          </a>
        </div>
      )}

      {error && <p className="export-error" role="alert">{error}</p>}
    </section>
  );
}
