const setCanvasOperation = {
  type: "object",
  properties: {
    type: { const: "set_canvas" },
    preset: { type: "string", enum: ["landscape", "portrait", "square", "portraitFourFive"] },
    fitMode: { type: "string", enum: ["contain", "cover"] },
  },
  required: ["type", "preset"],
  additionalProperties: false,
} as const;

const setTrackOpacityOperation = {
  type: "object",
  properties: {
    type: { const: "set_track_opacity" },
    trackId: { type: "string" },
    opacity: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["type", "trackId", "opacity"],
  additionalProperties: false,
} as const;

const setTrackVisibilityOperation = {
  type: "object",
  properties: {
    type: { const: "set_track_visibility" },
    trackId: { type: "string" },
    visible: { type: "boolean" },
  },
  required: ["type", "trackId", "visible"],
  additionalProperties: false,
} as const;

const setTrackMuteOperation = {
  type: "object",
  properties: {
    type: { const: "set_track_mute" },
    trackId: { type: "string" },
    muted: { type: "boolean" },
  },
  required: ["type", "trackId", "muted"],
  additionalProperties: false,
} as const;

const moveClipOperation = {
  type: "object",
  properties: {
    type: { const: "move_clip" },
    clipId: { type: "string" },
    toIndex: { type: "integer", minimum: 0 },
  },
  required: ["type", "clipId", "toIndex"],
  additionalProperties: false,
} as const;

const moveClipToTrackOperation = {
  type: "object",
  properties: {
    type: { const: "move_clip_to_track" },
    clipId: { type: "string" },
    trackId: { type: "string" },
    toIndex: { type: "integer", minimum: 0 },
  },
  required: ["type", "clipId", "trackId"],
  additionalProperties: false,
} as const;

const trimClipOperation = {
  type: "object",
  properties: {
    type: { const: "trim_clip" },
    clipId: { type: "string" },
    sourceInUs: { type: "integer", minimum: 0 },
    sourceOutUs: { type: "integer", minimum: 1 },
  },
  required: ["type", "clipId", "sourceInUs", "sourceOutUs"],
  additionalProperties: false,
} as const;

const setClipSpeedOperation = {
  type: "object",
  properties: {
    type: { const: "set_clip_speed" },
    clipId: { type: "string" },
    playbackRate: { type: "number", enum: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] },
  },
  required: ["type", "clipId", "playbackRate"],
  additionalProperties: false,
} as const;

const setClipFadeOperation = {
  type: "object",
  properties: {
    type: { const: "set_clip_fade" },
    clipId: { type: "string" },
    fadeInUs: { type: "integer", enum: [0, 250000, 500000, 1000000, 2000000] },
    fadeOutUs: { type: "integer", enum: [0, 250000, 500000, 1000000, 2000000] },
  },
  required: ["type", "clipId", "fadeInUs", "fadeOutUs"],
  additionalProperties: false,
} as const;

export const proposeEditPlanSchema = {
  type: "object",
  properties: {
    title: {
      type: "string",
      minLength: 1,
      maxLength: 100,
      description: "Short human-readable title for the proposed editing change.",
    },
    reason: {
      type: "string",
      minLength: 1,
      maxLength: 500,
      description: "Explain why this plan fits the project brief and current live state.",
    },
    operations: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: {
        oneOf: [
          setCanvasOperation,
          setTrackOpacityOperation,
          setTrackVisibilityOperation,
          setTrackMuteOperation,
          moveClipOperation,
          moveClipToTrackOperation,
          trimClipOperation,
          setClipSpeedOperation,
          setClipFadeOperation,
        ],
      },
    },
  },
  required: ["title", "reason", "operations"],
  additionalProperties: false,
} as const;
