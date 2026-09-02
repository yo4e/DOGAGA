import type { EditorController } from "../editor/controller";
import {
  isSupportedFadeDuration,
  isSupportedPlaybackRate,
  type EditPlanOperation,
} from "../editor/collaboration";

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
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value;
}

function optionalString(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0) throw new Error(`${key} must be a non-empty string`);
  return value;
}

function requiredNumber(input: Record<string, unknown>, key: string): number {
  const value = input[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${key} must be a finite number`);
  return value;
}

function requiredInteger(input: Record<string, unknown>, key: string): number {
  const value = input[key];
  if (!Number.isSafeInteger(value)) throw new Error(`${key} must be a safe integer`);
  return value as number;
}

function optionalInteger(input: Record<string, unknown>, key: string): number | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value)) throw new Error(`${key} must be a safe integer`);
  return value as number;
}

function requiredBoolean(input: Record<string, unknown>, key: string): boolean {
  const value = input[key];
  if (typeof value !== "boolean") throw new Error(`${key} must be a boolean`);
  return value;
}

function parseOperation(value: unknown): EditPlanOperation {
  const input = record(value);
  const type = requiredString(input, "type");

  switch (type) {
    case "set_canvas": {
      const preset = requiredString(input, "preset");
      if (!["landscape", "portrait", "square", "portraitFourFive"].includes(preset)) {
        throw new Error("preset must be landscape, portrait, square, or portraitFourFive");
      }
      const fitMode = optionalString(input, "fitMode");
      if (fitMode !== undefined && fitMode !== "contain" && fitMode !== "cover") {
        throw new Error("fitMode must be contain or cover");
      }
      return {
        type,
        preset: preset as "landscape" | "portrait" | "square" | "portraitFourFive",
        ...(fitMode === undefined ? {} : { fitMode: fitMode as "contain" | "cover" }),
      };
    }
    case "set_track_opacity":
      return {
        type,
        trackId: requiredString(input, "trackId"),
        opacity: requiredNumber(input, "opacity"),
      };
    case "set_track_visibility":
      return {
        type,
        trackId: requiredString(input, "trackId"),
        visible: requiredBoolean(input, "visible"),
      };
    case "set_track_mute":
      return {
        type,
        trackId: requiredString(input, "trackId"),
        muted: requiredBoolean(input, "muted"),
      };
    case "move_clip":
      return {
        type,
        clipId: requiredString(input, "clipId"),
        toIndex: requiredInteger(input, "toIndex"),
      };
    case "move_clip_to_track": {
      const toIndex = optionalInteger(input, "toIndex");
      return {
        type,
        clipId: requiredString(input, "clipId"),
        trackId: requiredString(input, "trackId"),
        ...(toIndex === undefined ? {} : { toIndex }),
      };
    }
    case "trim_clip":
      return {
        type,
        clipId: requiredString(input, "clipId"),
        sourceInUs: requiredInteger(input, "sourceInUs"),
        sourceOutUs: requiredInteger(input, "sourceOutUs"),
      };
    case "set_clip_speed": {
      const playbackRate = requiredNumber(input, "playbackRate");
      if (!isSupportedPlaybackRate(playbackRate)) throw new Error("Unsupported playbackRate");
      return {
        type,
        clipId: requiredString(input, "clipId"),
        playbackRate,
      };
    }
    case "set_clip_fade": {
      const fadeInUs = requiredInteger(input, "fadeInUs");
      const fadeOutUs = requiredInteger(input, "fadeOutUs");
      if (!isSupportedFadeDuration(fadeInUs) || !isSupportedFadeDuration(fadeOutUs)) {
        throw new Error("Unsupported fade duration");
      }
      return {
        type,
        clipId: requiredString(input, "clipId"),
        fadeInUs,
        fadeOutUs,
      };
    }
    default:
      throw new Error(`Unsupported edit plan operation: ${type}`);
  }
}

export function proposeEditPlan(controller: EditorController, args: unknown) {
  const input = record(args);
  const operationsValue = input.operations;
  if (!Array.isArray(operationsValue)) throw new Error("operations must be an array");
  if (operationsValue.length < 1 || operationsValue.length > 8) {
    throw new Error("operations must contain between 1 and 8 items");
  }

  const plan = controller.proposeEditPlan({
    id: makeId("edit-plan"),
    title: requiredString(input, "title"),
    reason: requiredString(input, "reason"),
    operations: operationsValue.map(parseOperation),
  });

  return {
    ok: true,
    planId: plan.id,
    status: plan.status,
    operationCount: plan.operations.length,
    message: "The edit plan is waiting for human review in DOGAGA. No timeline changes have been applied yet.",
  };
}
