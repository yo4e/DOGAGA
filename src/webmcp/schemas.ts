export const emptySchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
} as const;

export const addTrackSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["video", "audio"] },
    name: { type: "string", minLength: 1 },
  },
  required: ["kind"],
  additionalProperties: false,
} as const;

export const trackIdSchema = {
  type: "object",
  properties: { trackId: { type: "string" } },
  required: ["trackId"],
  additionalProperties: false,
} as const;

export const moveTrackSchema = {
  type: "object",
  properties: {
    trackId: { type: "string" },
    toIndex: { type: "integer", minimum: 0 },
  },
  required: ["trackId", "toIndex"],
  additionalProperties: false,
} as const;

export const setTrackOpacitySchema = {
  type: "object",
  properties: {
    trackId: { type: "string" },
    opacity: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["trackId", "opacity"],
  additionalProperties: false,
} as const;

export const setTrackVisibilitySchema = {
  type: "object",
  properties: {
    trackId: { type: "string" },
    visible: { type: "boolean" },
  },
  required: ["trackId", "visible"],
  additionalProperties: false,
} as const;

export const setTrackMuteSchema = {
  type: "object",
  properties: {
    trackId: { type: "string" },
    muted: { type: "boolean" },
  },
  required: ["trackId", "muted"],
  additionalProperties: false,
} as const;

export const addClipSchema = {
  type: "object",
  properties: {
    assetId: { type: "string", description: "Loaded video Asset ID from get_project_state" },
    trackId: { type: "string", description: "Target video track ID. Defaults to V1 when omitted." },
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

export const moveClipToTrackSchema = {
  type: "object",
  properties: {
    clipId: { type: "string" },
    trackId: { type: "string" },
    toIndex: { type: "integer", minimum: 0 },
  },
  required: ["clipId", "trackId"],
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

export const splitClipSchema = {
  type: "object",
  properties: {
    clipId: { type: "string" },
    timelineUs: {
      type: "integer",
      minimum: 0,
      description: "Global timeline position in microseconds. Defaults to the current playhead when omitted.",
    },
  },
  required: ["clipId"],
  additionalProperties: false,
} as const;

export const setClipSpeedSchema = {
  type: "object",
  properties: {
    clipId: { type: "string" },
    playbackRate: {
      type: "number",
      enum: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2],
      description: "Video playback speed multiplier.",
    },
  },
  required: ["clipId", "playbackRate"],
  additionalProperties: false,
} as const;

export const setClipFadeSchema = {
  type: "object",
  properties: {
    clipId: { type: "string" },
    fadeInUs: {
      type: "integer",
      enum: [0, 250000, 500000, 1000000, 2000000],
      description: "Fade-in duration in timeline microseconds.",
    },
    fadeOutUs: {
      type: "integer",
      enum: [0, 250000, 500000, 1000000, 2000000],
      description: "Fade-out duration in timeline microseconds.",
    },
  },
  required: ["clipId", "fadeInUs", "fadeOutUs"],
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
    trackId: { type: "string", description: "Target audio track ID. Defaults to A1 when omitted." },
    timelineStartUs: { type: "integer", minimum: 0 },
    sourceInUs: { type: "integer", minimum: 0 },
    sourceOutUs: { type: "integer", minimum: 1 },
    volume: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["assetId"],
  additionalProperties: false,
} as const;

export const clearAudioSchema = {
  type: "object",
  properties: {
    trackId: { type: "string", description: "Audio track ID. Defaults to A1 when omitted." },
  },
  additionalProperties: false,
} as const;

export const setCanvasSchema = {
  type: "object",
  properties: {
    preset: {
      type: "string",
      enum: ["landscape", "portrait", "square", "portraitFourFive"],
      description: "Project canvas preset: landscape 16:9, portrait 9:16, square 1:1, or portraitFourFive 4:5",
    },
    fitMode: {
      type: "string",
      enum: ["contain", "cover"],
      description: "contain shows the whole source; cover fills and crops the canvas",
    },
  },
  required: ["preset"],
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
