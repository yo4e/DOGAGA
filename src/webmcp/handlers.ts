import type { EditorController } from "../editor/controller";
import {
  CANVAS_PRESETS,
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
    throw new Error("tool inputはobjectで指定してください");
  }
  return value as Record<string, unknown>;
}

function requiredString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${key}は空でないstringで指定してください`);
  }
  return value;
}

function optionalInteger(input: Record<string, unknown>, key: string): number | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value)) throw new Error(`${key}は安全な整数で指定してください`);
  return value as number;
}

function optionalNumber(input: Record<string, unknown>, key: string): number | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${key}は有限のnumberで指定してください`);
  }
  return value;
}

export function getProjectState(controller: EditorController) {
  return controller.getSafeState();
}

export function addClip(controller: EditorController, args: unknown) {
  const input = record(args);
  const assetId = requiredString(input, "assetId");
  const state = controller.getState();
  const asset = state.assets.find((candidate) => candidate.id === assetId);
  if (!asset) throw new Error(`Asset ${assetId} が見つかりません`);

  const sourceInUs = optionalInteger(input, "sourceInUs") ?? 0;
  const sourceOutUs = optionalInteger(input, "sourceOutUs") ?? asset.durationUs;
  const atIndex = optionalInteger(input, "atIndex");
  const clipId = makeId("clip");

  controller.execute({
    type: "addClip",
    clip: { id: clipId, assetId, sourceInUs, sourceOutUs },
    ...(atIndex === undefined ? {} : { atIndex }),
  });

  return { ok: true, clipId };
}

export function moveClip(controller: EditorController, args: unknown) {
  const input = record(args);
  const clipId = requiredString(input, "clipId");
  const toIndex = optionalInteger(input, "toIndex");
  if (toIndex === undefined) throw new Error("toIndexは必須です");
  controller.execute({ type: "moveClip", clipId, toIndex });
  return { ok: true, clipId, toIndex };
}

export function trimClip(controller: EditorController, args: unknown) {
  const input = record(args);
  const clipId = requiredString(input, "clipId");
  const sourceInUs = optionalInteger(input, "sourceInUs");
  const sourceOutUs = optionalInteger(input, "sourceOutUs");
  if (sourceInUs === undefined || sourceOutUs === undefined) {
    throw new Error("sourceInUsとsourceOutUsは必須です");
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

export function deleteClip(controller: EditorController, args: unknown) {
  const input = record(args);
  const clipId = requiredString(input, "clipId");
  controller.execute({ type: "deleteClip", clipId });
  return { ok: true, clipId };
}

export function setAudio(controller: EditorController, args: unknown) {
  const input = record(args);
  const assetId = requiredString(input, "assetId");
  const state = controller.getState();
  const asset = state.assets.find((candidate) => candidate.id === assetId);
  if (!asset) throw new Error(`Asset ${assetId} が見つかりません`);

  const existing = state.audioClip?.assetId === assetId ? state.audioClip : null;
  const timelineStartUs = optionalInteger(input, "timelineStartUs") ?? existing?.timelineStartUs ?? 0;
  const sourceInUs = optionalInteger(input, "sourceInUs") ?? existing?.sourceInUs ?? 0;
  const sourceOutUs = optionalInteger(input, "sourceOutUs") ?? existing?.sourceOutUs ?? asset.durationUs;
  const volume = optionalNumber(input, "volume") ?? existing?.volume ?? 0.7;

  controller.execute({
    type: "setAudio",
    audio: {
      id: existing?.id ?? makeId("audio-clip"),
      assetId,
      timelineStartUs,
      sourceInUs,
      sourceOutUs,
      volume,
    },
  });

  return { ok: true, assetId, timelineStartUs, volume };
}

export function clearAudio(controller: EditorController) {
  controller.execute({ type: "setAudio", audio: null });
  return { ok: true };
}

export function setCanvas(controller: EditorController, args: unknown) {
  const input = record(args);
  const preset = requiredString(input, "preset");
  if (!Object.prototype.hasOwnProperty.call(CANVAS_PRESETS, preset)) {
    throw new Error("presetはlandscape、portrait、square、portraitFourFiveのいずれかで指定してください");
  }

  const fitMode = input.fitMode ?? controller.getState().canvas.fitMode;
  if (fitMode !== "contain" && fitMode !== "cover") {
    throw new Error("fitModeはcontainまたはcoverで指定してください");
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
