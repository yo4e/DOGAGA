import { IMAGE_DEFAULT_DURATION_US, type AssetDescriptor, type AssetKind } from "../editor/model";

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function probeImageFile(file: File, objectUrl: string): Promise<AssetDescriptor> {
  const image = new Image();
  image.decoding = "async";

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(`${file.name}: The browser could not read image metadata`));
      image.src = objectUrl;
    });

    if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      throw new Error(`${file.name}: Could not read image dimensions`);
    }

    return {
      id: makeId("image"),
      kind: "image",
      name: file.name,
      durationUs: IMAGE_DEFAULT_DURATION_US,
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
  } finally {
    image.removeAttribute("src");
  }
}

export async function probeMediaFile(file: File, kind: AssetKind): Promise<AssetDescriptor> {
  const objectUrl = URL.createObjectURL(file);

  try {
    if (kind === "image") return await probeImageFile(file, objectUrl);

    const media = document.createElement(kind === "video" ? "video" : "audio");
    try {
      const metadata = await new Promise<{ duration: number; width?: number; height?: number }>(
        (resolve, reject) => {
          media.preload = "metadata";
          media.onloadedmetadata = () => {
            if (!Number.isFinite(media.duration) || media.duration <= 0) {
              reject(new Error(`${file.name}: Could not read media duration`));
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
          media.onerror = () => reject(new Error(`${file.name}: The browser could not read media metadata`));
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
    }
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
