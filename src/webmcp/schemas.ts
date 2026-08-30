export const emptySchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
} as const;

export const addClipSchema = {
  type: "object",
  properties: {
    assetId: { type: "string", description: "Loaded video Asset ID from get_project_state" },
    sourceInUs: { type: "integer", minimum: 0 },
    sourceOutUs: { type: "integer", minimum: 1 },
    atIndex: { type: "integer", minimum: 0 },
  },
  required: ["assetId"],
  additionalProperties: false,
} as const;

export const moveClipSchema = {
  type: "object",
  properties: {
    clipId: { type: "string" },
    toIndex: { type: "integer", minimum: 0 },
  },
  required: ["clipId", "toIndex"],
  additionalProperties: false,
} as const;

export const trimClipSchema = {
  type: "object",
  properties: {
    clipId: { type: "string" },
    sourceInUs: { type: "integer", minimum: 0 },
    sourceOutUs: { type: "integer", minimum: 1 },
  },
  required: ["clipId", "sourceInUs", "sourceOutUs"],
  additionalProperties: false,
} as const;

export const clipIdSchema = {
  type: "object",
  properties: { clipId: { type: "string" } },
  required: ["clipId"],
  additionalProperties: false,
} as const;

export const setAudioSchema = {
  type: "object",
  properties: {
    assetId: { type: "string", description: "Loaded audio Asset ID from get_project_state" },
    timelineStartUs: { type: "integer", minimum: 0 },
    sourceInUs: { type: "integer", minimum: 0 },
    sourceOutUs: { type: "integer", minimum: 1 },
    volume: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["assetId"],
  additionalProperties: false,
} as const;

export const addTransitionSchema = {
  type: "object",
  properties: {
    fromClipId: { type: "string" },
    toClipId: { type: "string" },
    durationUs: { type: "integer", minimum: 1 },
  },
  required: ["fromClipId", "toClipId"],
  additionalProperties: false,
} as const;

export const transitionIdSchema = {
  type: "object",
  properties: { transitionId: { type: "string" } },
  required: ["transitionId"],
  additionalProperties: false,
} as const;
