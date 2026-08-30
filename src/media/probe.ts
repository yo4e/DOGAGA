import type { AssetDescriptor, AssetKind } from "../editor/model";

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function probeMediaFile(file: File, kind: AssetKind): Promise<AssetDescriptor> {
  const objectUrl = URL.createObjectURL(file);
  const media = document.createElement(kind === "video" ? "video" : "audio");

  try {
    const metadata = await new Promise<{ duration: number; width?: number; height?: number }>(
      (resolve, reject) => {
        media.preload = "metadata";
        media.onloadedmetadata = () => {
          if (!Number.isFinite(media.duration) || media.duration <= 0) {
            reject(new Error(`${file.name}: durationを取得できませんでした`));
            return;
          }
          if (media instanceof HTMLVideoElement) {
            resolve({
              duration: media.duration,
              ...(media.videoWidth > 0 ? { width: media.videoWidth } : {}),
              ...(media.videoHeight > 0 ? { height: media.videoHeight } : {}),
            });
            return;
          }
          resolve({ duration: media.duration });
        };
        media.onerror = () => reject(new Error(`${file.name}: ブラウザでmetadataを読めませんでした`));
        media.src = objectUrl;
      },
    );

    return {
      id: makeId(kind),
      kind,
      name: file.name,
      durationUs: Math.max(1, Math.round(metadata.duration * 1_000_000)),
      ...(metadata.width === undefined ? {} : { width: metadata.width }),
      ...(metadata.height === undefined ? {} : { height: metadata.height }),
    };
  } finally {
    media.removeAttribute("src");
    media.load();
    URL.revokeObjectURL(objectUrl);
  }
}
