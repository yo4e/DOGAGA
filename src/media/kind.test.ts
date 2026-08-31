import { describe, expect, it } from "vitest";
import { inferAssetKind } from "./kind";

describe("inferAssetKind", () => {
  it("prefers a video or audio MIME type", () => {
    expect(inferAssetKind({ name: "clip.bin", type: "video/mp4" })).toBe("video");
    expect(inferAssetKind({ name: "song.bin", type: "audio/mpeg" })).toBe("audio");
  });

  it("uses a case-insensitive extension when the browser omits the MIME type", () => {
    expect(inferAssetKind({ name: "CLIP.MOV", type: "" })).toBe("video");
    expect(inferAssetKind({ name: "SONG.M4A", type: "application/octet-stream" })).toBe("audio");
  });

  it("does not override an explicit unsupported MIME type", () => {
    expect(inferAssetKind({ name: "renamed.mp4", type: "text/plain" })).toBeNull();
    expect(inferAssetKind({ name: "notes.txt", type: "" })).toBeNull();
  });
});
