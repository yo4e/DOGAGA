import { executeCommand } from "./executor";
import {
  createEmptyEditorState,
  timelineDurationUs,
  type AssetDescriptor,
  type EditorCommand,
  type EditorState,
} from "./model";
import { toSafeEditorState } from "./safeState";

type Listener = () => void;

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
      throw new Error(`Asset ${asset.id} はすでに登録されています`);
    }
    if (!Number.isSafeInteger(asset.durationUs) || asset.durationUs <= 0) {
      throw new Error("Asset durationUsは正の安全な整数である必要があります");
    }
    this.state = { ...this.state, assets: [...this.state.assets, { ...asset }] };
    this.emit();
  }

  execute(command: EditorCommand): EditorState {
    const next = executeCommand(this.state, command);
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
      throw new Error("playheadUsは0以上の安全な整数である必要があります");
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
