import type { AssetKind } from "../editor/model";

const VIDEO_EXTENSIONS = new Set(["avi", "m4v", "mov", "mp4", "mpeg", "mpg", "ogv", "webm"]);
const AUDIO_EXTENSIONS = new Set(["aac", "flac", "m4a", "mp3", "oga", "ogg", "opus", "wav"]);

export function inferAssetKind(file: Pick<File, "name" | "type">): AssetKind | null {
  const mime = file.type.trim().toLowerCase();
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";

  if (mime && mime !== "application/octet-stream") return null;

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (VIDEO_EXTENSIONS.has(extension)) return "video";
  if (AUDIO_EXTENSIONS.has(extension)) return "audio";
  return null;
}
