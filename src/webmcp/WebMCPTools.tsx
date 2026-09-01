import { useWebMCP } from "use-webmcp-tool";
import type { EditorController } from "../editor/controller";
import {
  addClip,
  addTrack,
  addTransition,
  clearAudio,
  deleteClip,
  getProjectState,
  moveClip,
  moveClipToTrack,
  moveTrack,
  removeTrack,
  removeTransition,
  setAudio,
  setCanvas,
  setClipFade,
  setClipSpeed,
  setTrackMute,
  setTrackOpacity,
  setTrackVisibility,
  splitClip,
  trimClip,
} from "./handlers";
import {
  addClipSchema,
  addTrackSchema,
  addTransitionSchema,
  clearAudioSchema,
  clipIdSchema,
  emptySchema,
  moveClipSchema,
  moveClipToTrackSchema,
  moveTrackSchema,
  setAudioSchema,
  setCanvasSchema,
  setClipFadeSchema,
  setClipSpeedSchema,
  setTrackMuteSchema,
  setTrackOpacitySchema,
  setTrackVisibilitySchema,
  splitClipSchema,
  trackIdSchema,
  transitionIdSchema,
  trimClipSchema,
} from "./schemas";

export type AgentActivity = {
  id: string;
  tool: string;
  status: "success" | "error";
  message: string;
  at: number;
};

type Props = {
  controller: EditorController;
  onActivity: (activity: AgentActivity) => void;
};

function activityId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function WebMCPTools({ controller, onActivity }: Props) {
  const execute = (tool: string, handler: (args: unknown) => unknown) => async (args: unknown) => {
    try {
      const result = await handler(args);
      onActivity({ id: activityId(), tool, status: "success", message: "完了", at: Date.now() });
      return result;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      onActivity({ id: activityId(), tool, status: "error", message, at: Date.now() });
      throw caught;
    }
  };

  const getStateTool = useWebMCP({
    name: "get_project_state",
    description: "Read DOGAGA's current agent-safe editor state, including video/audio tracks, canvas, loaded Asset IDs, clips, transitions, and playhead. Local File handles and object URLs are never returned.",
    inputSchema: emptySchema,
    execute: execute("get_project_state", () => getProjectState(controller)),
  });

  const addTrackTool = useWebMCP({
    name: "add_track",
    description: "Add an empty video or audio track. DOGAGA generates a track ID; name is optional.",
    inputSchema: addTrackSchema,
    execute: execute("add_track", (args) => addTrack(controller, args)),
  });

  const removeTrackTool = useWebMCP({
    name: "remove_track",
    description: "Remove an empty non-default track. V1 and A1 cannot be removed.",
    inputSchema: trackIdSchema,
    execute: execute("remove_track", (args) => removeTrack(controller, args)),
  });

  const moveTrackTool = useWebMCP({
    name: "move_track",
    description: "Reorder a video or audio track within tracks of the same kind using a zero-based index. Higher video order renders above lower order.",
    inputSchema: moveTrackSchema,
    execute: execute("move_track", (args) => moveTrack(controller, args)),
  });

  const setTrackOpacityTool = useWebMCP({
    name: "set_track_opacity",
    description: "Set a video track opacity from 0 to 1. Preview and export use this value.",
    inputSchema: setTrackOpacitySchema,
    execute: execute("set_track_opacity", (args) => setTrackOpacity(controller, args)),
  });

  const setTrackVisibilityTool = useWebMCP({
    name: "set_track_visibility",
    description: "Show or hide a video track in preview and export.",
    inputSchema: setTrackVisibilitySchema,
    execute: execute("set_track_visibility", (args) => setTrackVisibility(controller, args)),
  });

  const setTrackMuteTool = useWebMCP({
    name: "set_track_mute",
    description: "Mute or unmute an audio track in preview and export.",
    inputSchema: setTrackMuteSchema,
    execute: execute("set_track_mute", (args) => setTrackMute(controller, args)),
  });

  const addClipTool = useWebMCP({
    name: "add_clip",
    description: "Add a loaded video Asset to a video track. trackId is optional and defaults to V1. Use Asset and track IDs returned by get_project_state.",
    inputSchema: addClipSchema,
    execute: execute("add_clip", (args) => addClip(controller, args)),
  });

  const moveClipTool = useWebMCP({
    name: "move_clip",
    description: "Reorder an existing video clip by zero-based index within its current video track.",
    inputSchema: moveClipSchema,
    execute: execute("move_clip", (args) => moveClip(controller, args)),
  });

  const moveClipToTrackTool = useWebMCP({
    name: "move_clip_to_track",
    description: "Move an existing video clip to another video track, optionally at a zero-based target index.",
    inputSchema: moveClipToTrackSchema,
    execute: execute("move_clip_to_track", (args) => moveClipToTrack(controller, args)),
  });

  const trimClipTool = useWebMCP({
    name: "trim_clip",
    description: "Set a clip's source in/out range in integer microseconds.",
    inputSchema: trimClipSchema,
    execute: execute("trim_clip", (args) => trimClip(controller, args)),
  });

  const splitClipTool = useWebMCP({
    name: "split_clip",
    description: "Split a video clip into two at a global timeline position. If timelineUs is omitted, DOGAGA uses the current playhead. The split stays in the same video track.",
    inputSchema: splitClipSchema,
    execute: execute("split_clip", (args) => splitClip(controller, args)),
  });

  const setClipSpeedTool = useWebMCP({
    name: "set_clip_speed",
    description: "Set a video clip playback speed. Supported rates are 0.25, 0.5, 0.75, 1, 1.25, 1.5, and 2. Timeline duration changes while source in/out stay the same.",
    inputSchema: setClipSpeedSchema,
    execute: execute("set_clip_speed", (args) => setClipSpeed(controller, args)),
  });

  const setClipFadeTool = useWebMCP({
    name: "set_clip_fade",
    description: "Set a video clip fade-in and fade-out duration in timeline microseconds. Supported values are 0, 250000, 500000, 1000000, and 2000000, limited by the clip's current timeline duration.",
    inputSchema: setClipFadeSchema,
    execute: execute("set_clip_fade", (args) => setClipFade(controller, args)),
  });

  const deleteClipTool = useWebMCP({
    name: "delete_clip",
    description: "Delete an existing video clip from its video track.",
    inputSchema: clipIdSchema,
    execute: execute("delete_clip", (args) => deleteClip(controller, args)),
  });

  const setAudioTool = useWebMCP({
    name: "set_audio",
    description: "Set or update one audio clip on an audio track using a loaded audio Asset ID. trackId is optional and defaults to A1.",
    inputSchema: setAudioSchema,
    execute: execute("set_audio", (args) => setAudio(controller, args)),
  });

  const clearAudioTool = useWebMCP({
    name: "clear_audio",
    description: "Remove the current audio clip from an audio track without deleting the loaded Asset. trackId defaults to A1.",
    inputSchema: clearAudioSchema,
    execute: execute("clear_audio", (args) => clearAudio(controller, args)),
  });

  const setCanvasTool = useWebMCP({
    name: "set_canvas",
    description: "Set DOGAGA's project canvas preset and source fitting mode through the shared editor state.",
    inputSchema: setCanvasSchema,
    execute: execute("set_canvas", (args) => setCanvas(controller, args)),
  });

  const addTransitionTool = useWebMCP({
    name: "add_transition",
    description: "Add a cross-dissolve between two adjacent video clips on the same video track. Duration defaults to 500000 microseconds.",
    inputSchema: addTransitionSchema,
    execute: execute("add_transition", (args) => addTransition(controller, args)),
  });

  const removeTransitionTool = useWebMCP({
    name: "remove_transition",
    description: "Remove an existing transition by transition ID.",
    inputSchema: transitionIdSchema,
    execute: execute("remove_transition", (args) => removeTransition(controller, args)),
  });

  const tools = [
    getStateTool,
    addTrackTool,
    removeTrackTool,
    moveTrackTool,
    setTrackOpacityTool,
    setTrackVisibilityTool,
    setTrackMuteTool,
    addClipTool,
    moveClipTool,
    moveClipToTrackTool,
    trimClipTool,
    splitClipTool,
    setClipSpeedTool,
    setClipFadeTool,
    deleteClipTool,
    setAudioTool,
    clearAudioTool,
    setCanvasTool,
    addTransitionTool,
    removeTransitionTool,
  ];
  const supported = tools.some((tool) => tool.supported);
  const registered = tools.filter((tool) => tool.registered).length;
  const error = tools.find((tool) => tool.error)?.error;

  return (
    <section className="agent-status" aria-label="WebMCP status" data-supported={supported}>
      <div>
        <strong>WebMCP</strong>
        <span>{supported ? `接続中 · ${registered}/${tools.length}` : "このブラウザでは未対応"}</span>
      </div>
      {error && <small role="alert">登録エラー: {error.message}</small>}
    </section>
  );
}
