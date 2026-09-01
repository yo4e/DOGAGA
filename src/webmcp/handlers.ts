import type { EditorController } from "../editor/controller";
import {
  CANVAS_PRESETS,
  getAudioTracks,
  getDefaultAudioTrack,
  getVideoTracks,
  type CanvasFitMode,
  type CanvasPresetId,
} from "../editor/model";

const DEFAULT_TRANSITION_US = 500_000;

function makeId(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Tool input must be an object");
  }
  return value as Record<string, unknown>;
}

function requiredString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value;
}

function optionalString(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value;
}

function requiredBoolean(input: Record<string, unknown>, key: string): boolean {
  const value = input[key];
  if (typeof value !== "boolean") throw new Error(`${key} must be a boolean`);
  return value;
}

function optionalInteger(input: Record<string, unknown>, key: string): number | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value)) throw new Error(`${key} must be a safe integer`);
  return value as number;
}

function optionalNumber(input: Record<string, unknown>, key: string): number | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${key} must be a finite number`);
  }
  return value;
}

export function getProjectState(controller: EditorController) {
  return controller.getSafeState();
}

export function addTrack(controller: EditorController, args: unknown) {
  const input = record(args);
  const kind = requiredString(input, "kind");
  if (kind !== "video" && kind !== "audio") throw new Error("kind must be video or audio");
  const state = controller.getState();
  const nextNumber = kind === "video" ? getVideoTracks(state).length + 1 : getAudioTracks(state).length + 1;
  const name = optionalString(input, "name") ?? `${kind === "video" ? "V" : "A"}${nextNumber}`;
  const trackId = makeId(`${kind}-track`);
  controller.execute({ type: "addTrack", track: { id: trackId, kind, name } });
  return { ok: true, trackId, kind, name };
}

export function removeTrack(controller: EditorController, args: unknown) {
  const input = record(args);
  const trackId = requiredString(input, "trackId");
  controller.execute({ type: "removeTrack", trackId });
  return { ok: true, trackId };
}

export function moveTrack(controller: EditorController, args: unknown) {
  const input = record(args);
  const trackId = requiredString(input, "trackId");
  const toIndex = optionalInteger(input, "toIndex");
  if (toIndex === undefined) throw new Error("toIndex is required");
  controller.execute({ type: "moveTrack", trackId, toIndex });
  return { ok: true, trackId, toIndex };
}

export function setTrackOpacity(controller: EditorController, args: unknown) {
  const input = record(args);
  const trackId = requiredString(input, "trackId");
  const opacity = optionalNumber(input, "opacity");
  if (opacity === undefined) throw new Error("opacity is required");
  controller.execute({ type: "setTrackOpacity", trackId, opacity });
  return { ok: true, trackId, opacity };
}

export function setTrackVisibility(controller: EditorController, args: unknown) {
  const input = record(args);
  const trackId = requiredString(input, "trackId");
  const visible = requiredBoolean(input, "visible");
  controller.execute({ type: "setTrackVisibility", trackId, visible });
  return { ok: true, trackId, visible };
}

export function setTrackMute(controller: EditorController, args: unknown) {
  const input = record(args);
  const trackId = requiredString(input, "trackId");
  const muted = requiredBoolean(input, "muted");
  controller.execute({ type: "setTrackMute", trackId, muted });
  return { ok: true, trackId, muted };
}

export function addClip(controller: EditorController, args: unknown) {
  const input = record(args);
  const assetId = requiredString(input, "assetId");
  const state = controller.getState();
  const asset = state.assets.find((candidate) => candidate.id === assetId);
  if (!asset) throw new Error(`Asset ${assetId} was not found`);

  const sourceInUs = optionalInteger(input, "sourceInUs") ?? 0;
  const sourceOutUs = optionalInteger(input, "sourceOutUs") ?? asset.durationUs;
  const atIndex = optionalInteger(input, "atIndex");
  const trackId = optionalString(input, "trackId");
  const clipId = makeId("clip");

  controller.execute({
    type: "addClip",
    clip: { id: clipId, assetId, sourceInUs, sourceOutUs },
    ...(atIndex === undefined ? {} : { atIndex }),
    ...(trackId === undefined ? {} : { trackId }),
  });

  return { ok: true, clipId, ...(trackId ? { trackId } : {}) };
}

export function moveClip(controller: EditorController, args: unknown) {
  const input = record(args);
  const clipId = requiredString(input, "clipId");
  const toIndex = optionalInteger(input, "toIndex");
  if (toIndex === undefined) throw new Error("toIndex is required");
  controller.execute({ type: "moveClip", clipId, toIndex });
  return { ok: true, clipId, toIndex };
}

export function moveClipToTrack(controller: EditorController, args: unknown) {
  const input = record(args);
  const clipId = requiredString(input, "clipId");
  const trackId = requiredString(input, "trackId");
  const toIndex = optionalInteger(input, "toIndex");
  controller.execute({
    type: "moveClipToTrack",
    clipId,
    trackId,
    ...(toIndex === undefined ? {} : { toIndex }),
  });
  return { ok: true, clipId, trackId, ...(toIndex === undefined ? {} : { toIndex }) };
}

export function trimClip(controller: EditorController, args: unknown) {
  const input = record(args);
  const clipId = requiredString(input, "clipId");
  const sourceInUs = optionalInteger(input, "sourceInUs");
  const sourceOutUs = optionalInteger(input, "sourceOutUs");
  if (sourceInUs === undefined || sourceOutUs === undefined) {
    throw new Error("sourceInUs and sourceOutUs are required");
  }
  controller.execute({ type: "trimClip", clipId, sourceInUs, sourceOutUs });
  return { ok: true, clipId, sourceInUs, sourceOutUs };
}

export function splitClip(controller: EditorController, args: unknown) {
  const input = record(args);
  const clipId = requiredString(input, "clipId");
  const timelineUs = optionalInteger(input, "timelineUs") ?? controller.getState().playheadUs;
  const newClipId = makeId("clip");
  controller.execute({ type: "splitClip", clipId, atTimelineUs: timelineUs, newClipId });
  return { ok: true, clipId, newClipId, timelineUs };
}

export function setClipSpeed(controller: EditorController, args: unknown) {
  const input = record(args);
  const clipId = requiredString(input, "clipId");
  const playbackRate = optionalNumber(input, "playbackRate");
  if (playbackRate === undefined) throw new Error("playbackRate is required");
  controller.execute({ type: "setClipSpeed", clipId, playbackRate });
  return { ok: true, clipId, playbackRate };
}

export function setClipFade(controller: EditorController, args: unknown) {
  const input = record(args);
  const clipId = requiredString(input, "clipId");
  const fadeInUs = optionalInteger(input, "fadeInUs");
  const fadeOutUs = optionalInteger(input, "fadeOutUs");
  if (fadeInUs === undefined || fadeOutUs === undefined) {
    throw new Error("fadeInUs and fadeOutUs are required");
  }
  controller.execute({ type: "setClipFade", clipId, fadeInUs, fadeOutUs });
  return { ok: true, clipId, fadeInUs, fadeOutUs };
}

export function deleteClip(controller: EditorController, args: unknown) {
  const input = record(args);
  const clipId = requiredString(input, "clipId");
  controller.execute({ type: "deleteClip", clipId });
  return { ok: true, clipId };
}

export function setAudio(controller: EditorController, args: unknown) {
  const input = record(args);
  const assetId = requiredString(input, "assetId");
  const trackId = optionalString(input, "trackId");
  const state = controller.getState();
  const asset = state.assets.find((candidate) => candidate.id === assetId);
  if (!asset) throw new Error(`Asset ${assetId} was not found`);

  const track = trackId
    ? getAudioTracks(state).find((candidate) => candidate.id === trackId)
    : getDefaultAudioTrack(state);
  if (!track) throw new Error(`Audio track ${trackId ?? "A1"} was not found`);
  const current = track.clips[0] ?? null;
  const existing = current?.assetId === assetId ? current : null;
  const timelineStartUs = optionalInteger(input, "timelineStartUs") ?? existing?.timelineStartUs ?? 0;
  const sourceInUs = optionalInteger(input, "sourceInUs") ?? existing?.sourceInUs ?? 0;
  const sourceOutUs = optionalInteger(input, "sourceOutUs") ?? existing?.sourceOutUs ?? asset.durationUs;
  const volume = optionalNumber(input, "volume") ?? existing?.volume ?? 0.7;

  controller.execute({
    type: "setAudio",
    trackId: track.id,
    audio: {
      id: existing?.id ?? makeId("audio-clip"),
      assetId,
      timelineStartUs,
      sourceInUs,
      sourceOutUs,
      volume,
    },
  });

  return { ok: true, trackId: track.id, assetId, timelineStartUs, volume };
}

export function clearAudio(controller: EditorController, args: unknown = {}) {
  const input = record(args);
  const trackId = optionalString(input, "trackId");
  controller.execute({ type: "setAudio", audio: null, ...(trackId ? { trackId } : {}) });
  return { ok: true, ...(trackId ? { trackId } : {}) };
}

export function setCanvas(controller: EditorController, args: unknown) {
  const input = record(args);
  const preset = requiredString(input, "preset");
  if (!Object.prototype.hasOwnProperty.call(CANVAS_PRESETS, preset)) {
    throw new Error("preset must be one of landscape, portrait, square, or portraitFourFive");
  }

  const fitMode = input.fitMode ?? controller.getState().canvas.fitMode;
  if (fitMode !== "contain" && fitMode !== "cover") {
    throw new Error("fitMode must be contain or cover");
  }

  controller.execute({
    type: "setCanvas",
    preset: preset as CanvasPresetId,
    fitMode: fitMode as CanvasFitMode,
  });
  return { ok: true, canvas: { ...controller.getState().canvas } };
}

export function addTransition(controller: EditorController, args: unknown) {
  const input = record(args);
  const fromClipId = requiredString(input, "fromClipId");
  const toClipId = requiredString(input, "toClipId");
  const durationUs = optionalInteger(input, "durationUs") ?? DEFAULT_TRANSITION_US;
  const transitionId = makeId("transition");

  controller.execute({
    type: "addTransition",
    transition: {
      id: transitionId,
      kind: "cross-dissolve",
      fromClipId,
      toClipId,
      durationUs,
    },
  });

  return { ok: true, transitionId, fromClipId, toClipId, durationUs };
}

export function removeTransition(controller: EditorController, args: unknown) {
  const input = record(args);
  const transitionId = requiredString(input, "transitionId");
  controller.execute({ type: "removeTransition", transitionId });
  return { ok: true, transitionId };
}
