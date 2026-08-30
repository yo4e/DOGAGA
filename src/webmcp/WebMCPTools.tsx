import { useWebMCP } from "use-webmcp-tool";
import type { EditorController } from "../editor/controller";
import {
  addClip,
  addTransition,
  clearAudio,
  deleteClip,
  getProjectState,
  moveClip,
  removeTransition,
  setAudio,
  setCanvas,
  trimClip,
} from "./handlers";
import {
  addClipSchema,
  addTransitionSchema,
  clipIdSchema,
  emptySchema,
  moveClipSchema,
  setAudioSchema,
  setCanvasSchema,
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
    description: "Read DOGAGA's current agent-safe editor state, including canvas size, loaded Asset IDs, clips, audio, transitions, and playhead. Local File handles and object URLs are never returned.",
    inputSchema: emptySchema,
    execute: execute("get_project_state", () => getProjectState(controller)),
  });

  const addClipTool = useWebMCP({
    name: "add_clip",
    description: "Add a loaded video Asset to DOGAGA's single video track. Use Asset IDs returned by get_project_state.",
    inputSchema: addClipSchema,
    execute: execute("add_clip", (args) => addClip(controller, args)),
  });

  const moveClipTool = useWebMCP({
    name: "move_clip",
    description: "Reorder an existing video clip by zero-based track index.",
    inputSchema: moveClipSchema,
    execute: execute("move_clip", (args) => moveClip(controller, args)),
  });

  const trimClipTool = useWebMCP({
    name: "trim_clip",
    description: "Set a clip's source in/out range in integer microseconds.",
    inputSchema: trimClipSchema,
    execute: execute("trim_clip", (args) => trimClip(controller, args)),
  });

  const deleteClipTool = useWebMCP({
    name: "delete_clip",
    description: "Delete an existing video clip from the timeline.",
    inputSchema: clipIdSchema,
    execute: execute("delete_clip", (args) => deleteClip(controller, args)),
  });

  const setAudioTool = useWebMCP({
    name: "set_audio",
    description: "Set or update DOGAGA's single audio track using a loaded audio Asset ID, with optional timeline start, source range, and volume.",
    inputSchema: setAudioSchema,
    execute: execute("set_audio", (args) => setAudio(controller, args)),
  });

  const clearAudioTool = useWebMCP({
    name: "clear_audio",
    description: "Remove the current audio clip from the timeline without deleting the loaded Asset.",
    inputSchema: emptySchema,
    execute: execute("clear_audio", () => clearAudio(controller)),
  });

  const setCanvasTool = useWebMCP({
    name: "set_canvas",
    description: "Set DOGAGA's project canvas preset and source fitting mode through the shared editor state.",
    inputSchema: setCanvasSchema,
    execute: execute("set_canvas", (args) => setCanvas(controller, args)),
  });

  const addTransitionTool = useWebMCP({
    name: "add_transition",
    description: "Add a cross-dissolve between two adjacent video clips. Duration is integer microseconds and defaults to 500000.",
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
    addClipTool,
    moveClipTool,
    trimClipTool,
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
    <section className="agent-status" aria-label="WebMCP status">
      <div>
        <strong>WebMCP</strong>
        <span>{supported ? `${registered}/${tools.length} tools ready` : "このブラウザでは未対応"}</span>
      </div>
      {error && <small role="alert">登録エラー: {error.message}</small>}
    </section>
  );
}
