import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useWebMCP } from "use-webmcp-tool";
import {
  PROJECT_DESTINATION_OPTIONS,
  PROJECT_GOAL_OPTIONS,
  describeEditPlanOperation,
  describeHumanDemonstrationChange,
  type ProjectDestination,
  type ProjectGoal,
} from "../editor/collaboration";
import type { EditorController } from "../editor/controller";
import {
  CANVAS_PRESETS,
  type CanvasFitMode,
  type CanvasPresetId,
} from "../editor/model";
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
import { proposeEditPlan } from "./collaborationHandlers";
import { proposeEditPlanSchema } from "./collaborationSchemas";
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
import "./collaboration.css";

const CANVAS_PRESET_IDS = Object.keys(CANVAS_PRESETS) as CanvasPresetId[];

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
  const editorState = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  );
  const collaboration = useSyncExternalStore(
    controller.subscribe,
    controller.getCollaborationState,
    controller.getCollaborationState,
  );
  const [planError, setPlanError] = useState<string | null>(null);
  const [teachingError, setTeachingError] = useState<string | null>(null);
  const [previewPortalTarget, setPreviewPortalTarget] = useState<Element | null>(null);
  const [mediaPortalTarget, setMediaPortalTarget] = useState<Element | null>(null);
  const [developerPortalTarget, setDeveloperPortalTarget] = useState<Element | null>(null);

  useEffect(() => {
    setPreviewPortalTarget(document.querySelector(".preview-panel"));
    setMediaPortalTarget(document.querySelector(".media-panel"));
    setDeveloperPortalTarget(document.querySelector(".developer-content"));
  }, []);

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

  const getStateTool = useWebMCP({
    name: "get_project_state",
    description: "Read DOGAGA's current agent-safe editor state, including the Project Brief / destination, any current humanDemonstration captured through Teach by Example, any current reviewable edit plan, visual/audio tracks, canvas, loaded Asset IDs (video, image, or audio), clips, transitions, and playhead. Local File handles and object URLs are never returned. If humanDemonstration.status is ready, treat its semantic changes as a user-provided editing example: when the human asks to do the same or apply a similar treatment, infer analogous target assets or clips from the live state and use propose_edit_plan for multi-step application so the human can review it. A demonstrated add_visual_clip means the human intentionally added a loaded visual asset to a track with the captured duration/speed/fades; generalize that treatment to analogous loaded assets rather than replaying the original asset ID. When projectBrief.destination or projectBrief.goal is specific, compare that goal with the live state and proactively point out useful improvements. Do not automatically replay a human demonstration without review.",
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
    description: "Set a video track opacity from 0 to 1. Preview and export use this value for both video and still-image clips.",
    inputSchema: setTrackOpacitySchema,
    execute: execute("set_track_opacity", (args) => setTrackOpacity(controller, args)),
  });

  const setTrackVisibilityTool = useWebMCP({
    name: "set_track_visibility",
    description: "Show or hide a video track in preview and export, including any video or still-image clips on it.",
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
    description: "Add a loaded video Asset to a video track. trackId is optional and defaults to V1. Use Asset and track IDs returned by get_project_state. Use add_image_clip for still-image Assets.",
    inputSchema: addClipSchema,
    execute: execute("add_clip", (args) => addClip(controller, args)),
  });

  const moveClipTool = useWebMCP({
    name: "move_clip",
    description: "Reorder an existing visual clip (video or still image) by zero-based index within its current video track.",
    inputSchema: moveClipSchema,
    execute: execute("move_clip", (args) => moveClip(controller, args)),
  });

  const moveClipToTrackTool = useWebMCP({
    name: "move_clip_to_track",
    description: "Move an existing visual clip (video or still image) to another video track, optionally at a zero-based target index.",
    inputSchema: moveClipToTrackSchema,
    execute: execute("move_clip_to_track", (args) => moveClipToTrack(controller, args)),
  });

  const trimClipTool = useWebMCP({
    name: "trim_clip",
    description: "Set a video clip's source in/out range in integer microseconds. Still images do not have source trim; use set_still_duration instead.",
    inputSchema: trimClipSchema,
    execute: execute("trim_clip", (args) => trimClip(controller, args)),
  });

  const splitClipTool = useWebMCP({
    name: "split_clip",
    description: "Split a video clip into two at a global timeline position. If timelineUs is omitted, DOGAGA uses the current playhead. The split stays in the same video track. Still-image clips are not split; change their duration instead.",
    inputSchema: splitClipSchema,
    execute: execute("split_clip", (args) => splitClip(controller, args)),
  });

  const setClipSpeedTool = useWebMCP({
    name: "set_clip_speed",
    description: "Set a video clip playback speed. Supported rates are 0.25, 0.5, 0.75, 1, 1.25, 1.5, and 2. Timeline duration changes while source in/out stay the same. Still images use set_still_duration instead.",
    inputSchema: setClipSpeedSchema,
    execute: execute("set_clip_speed", (args) => setClipSpeed(controller, args)),
  });

  const setClipFadeTool = useWebMCP({
    name: "set_clip_fade",
    description: "Set a visual clip fade-in and fade-out duration in timeline microseconds. Supported values are 0, 250000, 500000, 1000000, and 2000000, limited by the clip's current timeline duration. Works with video and still-image clips.",
    inputSchema: setClipFadeSchema,
    execute: execute("set_clip_fade", (args) => setClipFade(controller, args)),
  });

  const deleteClipTool = useWebMCP({
    name: "delete_clip",
    description: "Delete an existing visual clip (video or still image) from its video track.",
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
    description: "Add a cross-dissolve between two adjacent visual clips on the same video track. Video and still-image clips share the same transition model. Duration defaults to 500000 microseconds.",
    inputSchema: addTransitionSchema,
    execute: execute("add_transition", (args) => addTransition(controller, args)),
  });

  const removeTransitionTool = useWebMCP({
    name: "remove_transition",
    description: "Remove an existing transition by transition ID.",
    inputSchema: transitionIdSchema,
    execute: execute("remove_transition", (args) => removeTransition(controller, args)),
  });

  const proposeEditPlanTool = useWebMCP({
    name: "propose_edit_plan",
    description: "Submit a validated, non-mutating multi-step editing proposal for the human to review inside DOGAGA. Use this after get_project_state when the Project Brief, a ready humanDemonstration, or the live timeline suggests useful improvements. A human demonstration is an example to generalize, not an instruction to blindly replay IDs: choose analogous current assets or clips and explain the mapping in the reason. add_visual_clip can add a loaded video or image to an existing video track while preserving a demonstrated still duration, playback rate, and fades. The proposal does not change the timeline until the human clicks Apply in DOGAGA.",
    inputSchema: proposeEditPlanSchema,
    execute: execute("propose_edit_plan", (args) => proposeEditPlan(controller, args)),
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
    proposeEditPlanTool,
  ];
  const supported = tools.some((tool) => tool.supported);
  const registered = tools.filter((tool) => tool.registered).length;
  const error = tools.find((tool) => tool.error)?.error;
  const plan = collaboration.editPlan;
  const demonstration = collaboration.humanDemonstration;

  const applyPlan = () => {
    if (!plan) return;
    try {
      setPlanError(null);
      controller.applyEditPlan(plan.id);
    } catch (caught) {
      setPlanError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const rejectPlan = () => {
    if (!plan) return;
    try {
      setPlanError(null);
      controller.rejectEditPlan(plan.id);
    } catch (caught) {
      setPlanError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const startTeaching = () => {
    try {
      setTeachingError(null);
      controller.startHumanDemonstration();
    } catch (caught) {
      setTeachingError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const stopTeaching = () => {
    try {
      setTeachingError(null);
      controller.finishHumanDemonstration();
    } catch (caught) {
      setTeachingError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const dismissDemonstration = () => {
    try {
      setTeachingError(null);
      controller.dismissHumanDemonstration();
    } catch (caught) {
      setTeachingError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const setPreviewCanvas = (preset: CanvasPresetId, fitMode: CanvasFitMode) => {
    controller.execute({ type: "setCanvas", preset, fitMode });
  };

  const projectSettingsPanel = (
    <div className="preview-project-settings" aria-label="Project and preview settings">
      <div className="project-brief-controls" aria-label="Project brief">
        <label>
          Destination
          <select
            aria-label="Project destination"
            value={collaboration.projectBrief.destination}
            onChange={(event) => controller.setProjectBrief({
              ...collaboration.projectBrief,
              destination: event.target.value as ProjectDestination,
            })}
          >
            {PROJECT_DESTINATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          Goal
          <select
            aria-label="Project goal"
            value={collaboration.projectBrief.goal}
            onChange={(event) => controller.setProjectBrief({
              ...collaboration.projectBrief,
              goal: event.target.value as ProjectGoal,
            })}
          >
            {PROJECT_GOAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="canvas-controls preview-canvas-controls" aria-label="Video display settings">
        <label>
          Canvas
          <select
            name="preview-canvas-preset"
            value={editorState.canvas.preset}
            onChange={(event) => setPreviewCanvas(event.target.value as CanvasPresetId, editorState.canvas.fitMode)}
          >
            {CANVAS_PRESET_IDS.map((presetId) => (
              <option value={presetId} key={presetId}>{CANVAS_PRESETS[presetId].label}</option>
            ))}
          </select>
        </label>
        <label>
          Source fit
          <select
            name="preview-canvas-fit"
            value={editorState.canvas.fitMode}
            onChange={(event) => setPreviewCanvas(editorState.canvas.preset, event.target.value as CanvasFitMode)}
          >
            <option value="contain">Contain</option>
            <option value="cover">Cover</option>
          </select>
        </label>
      </div>
    </div>
  );

  const demonstrationMessage = demonstration?.status === "recording"
    ? "Teaching… edit normally, then stop."
    : demonstration?.status === "ready"
      ? `Example ready · ${demonstration.changes.length} semantic change${demonstration.changes.length === 1 ? "" : "s"}`
      : demonstration?.status === "empty"
        ? "No supported semantic changes. Try adding a loaded visual to the timeline, moving an existing clip, or changing fade, opacity, still duration, speed, mute, or canvas."
        : "Show DOGAGA one treatment: add a loaded visual to the timeline, move an existing clip, or adjust fade, opacity, still duration, speed, mute, or canvas.";

  const teachPanel = (
    <section className={`teach-by-example ${demonstration?.status ?? "idle"}`} aria-label="Teach by Example">
      <div className="teach-by-example-heading">
        <strong>Teach by Example</strong>
        <span>{demonstrationMessage}</span>
      </div>
      <div className="teach-by-example-actions">
        {demonstration?.status === "recording" ? (
          <button className="stop-teaching" type="button" onClick={stopTeaching}>Stop teaching</button>
        ) : (
          <button type="button" onClick={startTeaching}>
            {demonstration ? "Teach another" : "Teach agent"}
          </button>
        )}
        {demonstration && demonstration.status !== "recording" && (
          <button type="button" onClick={dismissDemonstration}>Dismiss</button>
        )}
      </div>
      {teachingError && <small className="teach-error" role="alert">{teachingError}</small>}
    </section>
  );

  const humanExamplePanel = (
    <section className="panel human-example-panel" aria-label="Human example shared with the agent">
      <h2>Human example</h2>
      <p className="muted">Semantic editing changes captured through Teach by Example. The agent receives these meanings, not mouse movements or local file handles.</p>
      {!demonstration && <p className="muted human-example-empty">No example recorded yet.</p>}
      {demonstration?.status === "recording" && (
        <p className="human-example-recording">Recording… make the example edit in DOGAGA, then choose Stop teaching.</p>
      )}
      {demonstration?.status === "empty" && (
        <p className="human-example-empty">No supported semantic changes were found. Try adding a loaded visual to the timeline, moving an existing clip, or changing fade, opacity, still duration, speed, mute, or canvas.</p>
      )}
      {demonstration?.status === "ready" && (
        <>
          <p className="human-example-ready">Example recorded · {demonstration.changes.length} semantic change{demonstration.changes.length === 1 ? "" : "s"}</p>
          <ol className="human-demonstration-changes">
            {demonstration.changes.map((change, index) => (
              <li key={`${demonstration.id}-${index}`}>
                {describeHumanDemonstrationChange(controller.getState(), change)}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );

  return (
    <>
      <section className="agent-status" aria-label="WebMCP status" data-supported={supported}>
        <div>
          <strong>WebMCP</strong>
          <span>{supported ? `Connected · core ${registered}/${tools.length}` : "Not supported in this browser"}</span>
        </div>
        {error && <small role="alert">Registration error: {error.message}</small>}
      </section>

      {previewPortalTarget && createPortal(projectSettingsPanel, previewPortalTarget)}
      {mediaPortalTarget && createPortal(teachPanel, mediaPortalTarget)}
      {developerPortalTarget && createPortal(humanExamplePanel, developerPortalTarget)}

      {plan && (
        <aside className={`agent-suggestion ${plan.status}`} aria-label="Agent edit suggestion">
          <div className="agent-suggestion-heading">
            <span>Agent suggestion</span>
            <small>{plan.status}</small>
          </div>
          <h3>{plan.title}</h3>
          <p className="agent-suggestion-reason">{plan.reason}</p>
          <ol>
            {plan.operations.map((operation, index) => (
              <li key={`${plan.id}-${index}`}>{describeEditPlanOperation(controller.getState(), operation)}</li>
            ))}
          </ol>
          {planError && <p className="agent-plan-error" role="alert">{planError}</p>}
          {plan.status === "pending" ? (
            <div className="agent-suggestion-actions">
              <button type="button" onClick={rejectPlan}>Reject</button>
              <button className="apply-plan" type="button" onClick={applyPlan}>Apply</button>
            </div>
          ) : (
            <div className="agent-suggestion-actions">
              <p className="agent-plan-status">
                {plan.status === "applied" ? "Applied to the shared timeline." : "Rejected by the human."}
              </p>
              <button type="button" onClick={() => controller.dismissEditPlan(plan.id)}>Dismiss</button>
            </div>
          )}
        </aside>
      )}
    </>
  );
}
