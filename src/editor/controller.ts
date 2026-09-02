import { EditorCommandError, executeCommand } from "./executor";
import {
  cloneEditPlan,
  createEmptyCollaborationState,
  isProjectDestination,
  isProjectGoal,
  simulateEditPlan,
  type AgentEditPlan,
  type CollaborationState,
  type EditPlanOperation,
  type ProjectBrief,
} from "./collaboration";
import {
  createEmptyEditorState,
  timelineDurationUs,
  type AssetDescriptor,
  type EditorCommand,
  type EditorState,
} from "./model";
import { toSafeEditorState } from "./safeState";

type Listener = () => void;

function publicCommandErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    ASSET_NOT_FOUND: "The requested asset was not found.",
    INVALID_TIME: "A time value is invalid. Use non-negative safe integer microseconds where required.",
    INVALID_SOURCE_RANGE: "The source in/out range is outside the selected asset.",
    INVALID_PLAYBACK_RATE: "The requested playback rate is not supported.",
    INVALID_FADE_DURATION: "The requested fade duration is not supported.",
    INVALID_STILL_DURATION: "Still-image duration must be between 0.1 and 600 seconds.",
    INVALID_IMAGE_CLIP: "Still images are added at their default duration and 1x speed; change duration with the still-duration control.",
    IMAGE_SOURCE_OPERATION_UNSUPPORTED: "Still images do not support source trim, split, or playback speed. Change the still duration instead.",
    STILL_DURATION_ONLY: "The still-duration operation can only be used with image clips.",
    TRACK_NOT_FOUND: "The requested track was not found.",
    TRACK_KIND_MISMATCH: "The selected track has the wrong media type for this operation.",
    TRACK_LOCKED: "The selected track is locked.",
    INVALID_INDEX: "The requested target index is out of range.",
    TRACK_ID_CONFLICT: "A track with that ID already exists.",
    INVALID_TRACK_NAME: "A non-empty track name is required.",
    DEFAULT_TRACK_REQUIRED: "V1 and A1 are required for compatibility and cannot be removed.",
    TRACK_NOT_EMPTY: "A track containing clips cannot be removed.",
    INVALID_OPACITY: "Track opacity must be between 0 and 1.",
    INVALID_VISIBILITY: "Track visibility must be a boolean value.",
    INVALID_MUTE: "Track mute state must be a boolean value.",
    CLIP_ID_CONFLICT: "A clip with that ID already exists.",
    ASSET_KIND_MISMATCH: "The selected asset type does not match this operation.",
    CLIP_NOT_FOUND: "The requested clip was not found.",
    INVALID_SPLIT_POSITION: "The split position must be inside the selected clip.",
    FADE_TOO_LONG: "Fade duration cannot exceed the clip timeline duration.",
    INVALID_VOLUME: "Volume must be between 0 and 1.",
    INVALID_CANVAS_PRESET: "The requested canvas preset is not supported.",
    INVALID_CANVAS_FIT: "The requested source-fit mode is not supported.",
    UNSUPPORTED_TRANSITION: "The requested transition type is not supported.",
    TRANSITION_ID_CONFLICT: "A transition with that ID already exists.",
    TRANSITION_CONFLICT: "Only one transition can be assigned to the same clip boundary.",
    INVALID_TRANSITION: "A cross-dissolve requires adjacent clips on the same video track and a valid duration.",
    TRANSITION_NOT_FOUND: "The requested transition was not found.",
  };
  return messages[code] ?? `Editor command failed (${code}).`;
}

function normalizeCommandError(caught: unknown): never {
  if (caught instanceof EditorCommandError) {
    throw new EditorCommandError(caught.code, publicCommandErrorMessage(caught.code));
  }
  throw caught;
}

export class EditorController {
  private state: EditorState = createEmptyEditorState();
  private collaboration: CollaborationState = createEmptyCollaborationState();
  private readonly listeners = new Set<Listener>();

  readonly getState = (): EditorState => this.state;

  readonly getCollaborationState = (): CollaborationState => this.collaboration;

  readonly getSafeState = () => ({
    ...toSafeEditorState(this.state),
    projectBrief: { ...this.collaboration.projectBrief },
    editPlan: cloneEditPlan(this.collaboration.editPlan),
  });

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  registerAsset(asset: AssetDescriptor): void {
    if (this.state.assets.some((candidate) => candidate.id === asset.id)) {
      throw new Error(`Asset ${asset.id} is already registered`);
    }
    if (!Number.isSafeInteger(asset.durationUs) || asset.durationUs <= 0) {
      throw new Error("Asset durationUs must be a positive safe integer");
    }
    this.state = { ...this.state, assets: [...this.state.assets, { ...asset }] };
    this.emit();
  }

  setProjectBrief(brief: ProjectBrief): void {
    if (!isProjectDestination(brief.destination)) {
      throw new Error("Unsupported project destination");
    }
    if (!isProjectGoal(brief.goal)) {
      throw new Error("Unsupported project goal");
    }
    if (
      brief.destination === this.collaboration.projectBrief.destination
      && brief.goal === this.collaboration.projectBrief.goal
    ) return;
    this.collaboration = {
      ...this.collaboration,
      projectBrief: { ...brief },
    };
    this.emit();
  }

  proposeEditPlan(input: {
    id: string;
    title: string;
    reason: string;
    operations: EditPlanOperation[];
  }): AgentEditPlan {
    const title = input.title.trim();
    const reason = input.reason.trim();
    if (!input.id.trim()) throw new Error("Edit plan ID is required");
    if (!title) throw new Error("Edit plan title is required");
    if (!reason) throw new Error("Edit plan reason is required");
    if (input.operations.length < 1 || input.operations.length > 8) {
      throw new Error("Edit plan must contain between 1 and 8 operations");
    }

    try {
      simulateEditPlan(this.state, input.operations);
    } catch (caught) {
      normalizeCommandError(caught);
    }

    const editPlan: AgentEditPlan = {
      id: input.id,
      title,
      reason,
      operations: input.operations.map((operation) => ({ ...operation })),
      status: "pending",
      createdAt: Date.now(),
    };
    this.collaboration = { ...this.collaboration, editPlan };
    this.emit();
    return cloneEditPlan(editPlan)!;
  }

  applyEditPlan(planId: string): AgentEditPlan {
    const plan = this.collaboration.editPlan;
    if (!plan || plan.id !== planId) throw new Error("The requested edit plan was not found");
    if (plan.status !== "pending") throw new Error(`The edit plan is already ${plan.status}`);

    let next: EditorState;
    try {
      next = simulateEditPlan(this.state, plan.operations);
    } catch (caught) {
      normalizeCommandError(caught);
    }

    this.state = {
      ...next!,
      playheadUs: Math.min(next!.playheadUs, timelineDurationUs(next!)),
    };
    const editPlan: AgentEditPlan = { ...plan, status: "applied", resolvedAt: Date.now() };
    this.collaboration = { ...this.collaboration, editPlan };
    this.emit();
    return cloneEditPlan(editPlan)!;
  }

  rejectEditPlan(planId: string): AgentEditPlan {
    const plan = this.collaboration.editPlan;
    if (!plan || plan.id !== planId) throw new Error("The requested edit plan was not found");
    if (plan.status !== "pending") throw new Error(`The edit plan is already ${plan.status}`);
    const editPlan: AgentEditPlan = { ...plan, status: "rejected", resolvedAt: Date.now() };
    this.collaboration = { ...this.collaboration, editPlan };
    this.emit();
    return cloneEditPlan(editPlan)!;
  }

  dismissEditPlan(planId: string): void {
    if (this.collaboration.editPlan?.id !== planId) return;
    this.collaboration = { ...this.collaboration, editPlan: null };
    this.emit();
  }

  execute(command: EditorCommand): EditorState {
    let next: EditorState;
    try {
      next = executeCommand(this.state, command);
    } catch (caught) {
      normalizeCommandError(caught);
    }
    if (next! !== this.state) {
      this.state = {
        ...next!,
        playheadUs: Math.min(next!.playheadUs, timelineDurationUs(next!)),
      };
      this.emit();
    }
    return this.state;
  }

  setPlayheadUs(playheadUs: number): void {
    if (!Number.isSafeInteger(playheadUs) || playheadUs < 0) {
      throw new Error("playheadUs must be a non-negative safe integer");
    }
    const clamped = Math.min(playheadUs, timelineDurationUs(this.state));
    if (clamped === this.state.playheadUs) return;
    this.state = { ...this.state, playheadUs: clamped };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
