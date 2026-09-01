import { EditorCommandError, executeCommand } from "./executor";
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

export class EditorController {
  private state: EditorState = createEmptyEditorState();
  private readonly listeners = new Set<Listener>();

  readonly getState = (): EditorState => this.state;

  readonly getSafeState = () => toSafeEditorState(this.state);

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

  execute(command: EditorCommand): EditorState {
    let next: EditorState;
    try {
      next = executeCommand(this.state, command);
    } catch (caught) {
      if (caught instanceof EditorCommandError) {
        throw new EditorCommandError(caught.code, publicCommandErrorMessage(caught.code));
      }
      throw caught;
    }
    if (next !== this.state) {
      this.state = {
        ...next,
        playheadUs: Math.min(next.playheadUs, timelineDurationUs(next)),
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
