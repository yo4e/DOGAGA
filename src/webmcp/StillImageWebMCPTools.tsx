import { useWebMCP } from "use-webmcp-tool";
import type { EditorController } from "../editor/controller";
import { IMAGE_MAX_DURATION_US, IMAGE_MIN_DURATION_US, getVideoTracks } from "../editor/model";
import type { AgentActivity } from "./WebMCPTools";

type Props = {
  controller: EditorController;
  onActivity: (activity: AgentActivity) => void;
};

function activityId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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
  if (typeof value !== "string" || value.length === 0) throw new Error(`${key} must be a non-empty string`);
  return value;
}

function optionalString(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0) throw new Error(`${key} must be a non-empty string`);
  return value;
}

function optionalInteger(input: Record<string, unknown>, key: string): number | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value)) throw new Error(`${key} must be a safe integer`);
  return value as number;
}

function validateDuration(durationUs: number): void {
  if (durationUs < IMAGE_MIN_DURATION_US || durationUs > IMAGE_MAX_DURATION_US) {
    throw new Error("durationUs must be between 100000 and 600000000 microseconds");
  }
}

export function addImageClip(controller: EditorController, args: unknown) {
  const input = record(args);
  const assetId = requiredString(input, "assetId");
  const trackId = optionalString(input, "trackId");
  const atIndex = optionalInteger(input, "atIndex");
  const durationUs = optionalInteger(input, "durationUs");
  const state = controller.getState();
  const asset = state.assets.find((candidate) => candidate.id === assetId);
  if (!asset) throw new Error(`Asset ${assetId} was not found`);
  if (asset.kind !== "image") throw new Error("assetId must refer to an image asset");
  if (trackId && !getVideoTracks(state).some((track) => track.id === trackId)) {
    throw new Error(`Video track ${trackId} was not found`);
  }
  if (durationUs !== undefined) validateDuration(durationUs);

  const clipId = makeId("clip");
  controller.execute({
    type: "addClip",
    clip: { id: clipId, assetId, sourceInUs: 0, sourceOutUs: asset.durationUs },
    ...(trackId === undefined ? {} : { trackId }),
    ...(atIndex === undefined ? {} : { atIndex }),
  });
  if (durationUs !== undefined && durationUs !== asset.durationUs) {
    controller.execute({ type: "setClipDuration", clipId, durationUs });
  }
  return { ok: true, clipId, durationUs: durationUs ?? asset.durationUs, ...(trackId ? { trackId } : {}) };
}

export function setStillDuration(controller: EditorController, args: unknown) {
  const input = record(args);
  const clipId = requiredString(input, "clipId");
  const durationUs = optionalInteger(input, "durationUs");
  if (durationUs === undefined) throw new Error("durationUs is required");
  validateDuration(durationUs);
  controller.execute({ type: "setClipDuration", clipId, durationUs });
  return { ok: true, clipId, durationUs };
}

const addImageClipSchema = {
  type: "object",
  properties: {
    assetId: { type: "string", description: "Image Asset ID returned by get_project_state." },
    trackId: { type: "string", description: "Optional target video track. Defaults to V1." },
    atIndex: { type: "integer", minimum: 0, description: "Optional zero-based insertion index." },
    durationUs: {
      type: "integer",
      minimum: IMAGE_MIN_DURATION_US,
      maximum: IMAGE_MAX_DURATION_US,
      description: "Optional display duration in microseconds. Defaults to the image asset's 5-second duration.",
    },
  },
  required: ["assetId"],
  additionalProperties: false,
} as const;

const setStillDurationSchema = {
  type: "object",
  properties: {
    clipId: { type: "string" },
    durationUs: { type: "integer", minimum: IMAGE_MIN_DURATION_US, maximum: IMAGE_MAX_DURATION_US },
  },
  required: ["clipId", "durationUs"],
  additionalProperties: false,
} as const;

export function StillImageWebMCPTools({ controller, onActivity }: Props) {
  const execute = (tool: string, handler: (args: unknown) => unknown) => async (args: unknown) => {
    try {
      const result = await handler(args);
      onActivity({ id: activityId(), tool, status: "success", message: "Completed", at: Date.now() });
      return result;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      onActivity({ id: activityId(), tool, status: "error", message, at: Date.now() });
      throw caught;
    }
  };

  useWebMCP({
    name: "add_image_clip",
    description: "Add a loaded PNG/JPEG/WebP image Asset to a DOGAGA video track as a still clip. Images default to 5 seconds and may optionally receive a custom display duration. Use image Asset IDs and video track IDs from get_project_state. Still images support track moves, opacity/visibility, fades, and cross-dissolves, but not source trim, split, or playback speed.",
    inputSchema: addImageClipSchema,
    execute: execute("add_image_clip", (args) => addImageClip(controller, args)),
  });

  useWebMCP({
    name: "set_still_duration",
    description: "Change the display duration of an existing still-image clip in integer microseconds. This tool is image-only; video clips continue to use trim and playback-speed controls.",
    inputSchema: setStillDurationSchema,
    execute: execute("set_still_duration", (args) => setStillDuration(controller, args)),
  });

  return null;
}
