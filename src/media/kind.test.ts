import { describe, expect, it } from "vitest";
import { inferAssetKind } from "./kind";

describe("inferAssetKind", () => {
  it("prefers a video, audio, or supported image MIME type", () => {
    expect(inferAssetKind({ name: "clip.bin", type: "video/mp4" })).toBe("video");
    expect(inferAssetKind({ name: "song.bin", type: "audio/mpeg" })).toBe("audio");
    expect(inferAssetKind({ name: "cover.bin", type: "image/png" })).toBe("image");
    expect(inferAssetKind({ name: "photo.bin", type: "image/jpeg" })).toBe("image");
    expect(inferAssetKind({ name: "art.bin", type: "image/webp" })).toBe("image");
  });

  it("uses a case-insensitive extension when the browser omits the MIME type", () => {
    expect(inferAssetKind({ name: "CLIP.MOV", type: "" })).toBe("video");
    expect(inferAssetKind({ name: "SONG.M4A", type: "application/octet-stream" })).toBe("audio");
    expect(inferAssetKind({ name: "COVER.PNG", type: "" })).toBe("image");
    expect(inferAssetKind({ name: "PHOTO.JPEG", type: "application/octet-stream" })).toBe("image");
  });

  it("does not accept unsupported image formats or override an explicit unsupported MIME type", () => {
    expect(inferAssetKind({ name: "renamed.mp4", type: "text/plain" })).toBeNull();
    expect(inferAssetKind({ name: "animated.gif", type: "image/gif" })).toBeNull();
    expect(inferAssetKind({ name: "vector.svg", type: "image/svg+xml" })).toBeNull();
    expect(inferAssetKind({ name: "notes.txt", type: "" })).toBeNull();
  });
});
