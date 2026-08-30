import {
  CANVAS_PRESETS,
  clipDurationUs,
  createCanvasSettings,
  type AssetDescriptor,
  type EditorCommand,
  type EditorState,
  type Transition,
  type VideoClip,
} from "./model";

export class EditorCommandError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "EditorCommandError";
    this.code = code;
  }
}

function fail(code: string, message: string): never {
  throw new EditorCommandError(code, message);
}

function getAsset(state: EditorState, assetId: string): AssetDescriptor {
  const asset = state.assets.find((candidate) => candidate.id === assetId);
  if (!asset) fail("ASSET_NOT_FOUND", `Asset ${assetId} が見つかりません`);
  return asset;
}

function validateRange(asset: AssetDescriptor, sourceInUs: number, sourceOutUs: number): void {
  if (!Number.isSafeInteger(sourceInUs) || !Number.isSafeInteger(sourceOutUs)) {
    fail("INVALID_TIME", "時刻は安全な整数マイクロ秒で指定してください");
  }
  if (sourceInUs < 0 || sourceOutUs <= sourceInUs || sourceOutUs > asset.durationUs) {
    fail("INVALID_SOURCE_RANGE", "sourceIn/sourceOut が素材の範囲外です");
  }
}

function isAdjacent(clips: readonly VideoClip[], fromClipId: string, toClipId: string): boolean {
  const fromIndex = clips.findIndex((clip) => clip.id === fromClipId);
  return fromIndex >= 0 && clips[fromIndex + 1]?.id === toClipId;
}

function transitionFits(clips: readonly VideoClip[], transition: Transition): boolean {
  if (!isAdjacent(clips, transition.fromClipId, transition.toClipId)) return false;
  const from = clips.find((clip) => clip.id === transition.fromClipId)!;
  const to = clips.find((clip) => clip.id === transition.toClipId)!;
  return (
    Number.isSafeInteger(transition.durationUs) &&
    transition.durationUs > 0 &&
    transition.durationUs <= Math.min(clipDurationUs(from), clipDurationUs(to))
  );
}

function sanitizeTransitions(clips: readonly VideoClip[], transitions: readonly Transition[]): Transition[] {
  return transitions.filter((transition) => transitionFits(clips, transition));
}

function transitionDurationForBoundary(
  transitions: readonly Transition[],
  fromClipId: string,
  toClipId: string,
): number {
  return transitions.find(
    (transition) => transition.fromClipId === fromClipId && transition.toClipId === toClipId,
  )?.durationUs ?? 0;
}

export function packVideoTrack(
  clips: readonly VideoClip[],
  transitions: readonly Transition[] = [],
): VideoClip[] {
  const packed: VideoClip[] = [];
  let cursorUs = 0;

  for (const clip of clips) {
    const previous = packed.at(-1);
    const overlapUs = previous
      ? transitionDurationForBoundary(transitions, previous.id, clip.id)
      : 0;
    const timelineStartUs = Math.max(0, cursorUs - overlapUs);
    const next = { ...clip, timelineStartUs };
    packed.push(next);
    cursorUs = timelineStartUs + clipDurationUs(next);
  }

  return packed;
}

function finalizeVideoChange(
  state: EditorState,
  videoClips: readonly VideoClip[],
  transitions: readonly Transition[] = state.transitions,
): EditorState {
  const validTransitions = sanitizeTransitions(videoClips, transitions);
  const packed = packVideoTrack(videoClips, validTransitions);
  return {
    ...state,
    videoClips: packed,
    transitions: validTransitions,
  };
}

export function executeCommand(state: EditorState, command: EditorCommand): EditorState {
  switch (command.type) {
    case "addClip": {
      if (state.videoClips.some((clip) => clip.id === command.clip.id)) {
        fail("CLIP_ID_CONFLICT", `Clip ${command.clip.id} はすでに存在します`);
      }
      const asset = getAsset(state, command.clip.assetId);
      if (asset.kind !== "video") fail("ASSET_KIND_MISMATCH", "video clipにはvideo Assetが必要です");
      validateRange(asset, command.clip.sourceInUs, command.clip.sourceOutUs);

      const atIndex = command.atIndex ?? state.videoClips.length;
      if (!Number.isInteger(atIndex) || atIndex < 0 || atIndex > state.videoClips.length) {
        fail("INVALID_INDEX", "挿入位置が範囲外です");
      }

      const next = [...state.videoClips];
      next.splice(atIndex, 0, { ...command.clip, timelineStartUs: 0 });
      return finalizeVideoChange(state, next);
    }

    case "moveClip": {
      const fromIndex = state.videoClips.findIndex((clip) => clip.id === command.clipId);
      if (fromIndex < 0) fail("CLIP_NOT_FOUND", `Clip ${command.clipId} が見つかりません`);
      if (
        !Number.isInteger(command.toIndex) ||
        command.toIndex < 0 ||
        command.toIndex >= state.videoClips.length
      ) {
        fail("INVALID_INDEX", "移動先indexが範囲外です");
      }
      if (fromIndex === command.toIndex) return state;

      const next = [...state.videoClips];
      const [clip] = next.splice(fromIndex, 1);
      next.splice(command.toIndex, 0, clip);
      return finalizeVideoChange(state, next);
    }

    case "trimClip": {
      const index = state.videoClips.findIndex((clip) => clip.id === command.clipId);
      if (index < 0) fail("CLIP_NOT_FOUND", `Clip ${command.clipId} が見つかりません`);
      const clip = state.videoClips[index];
      const asset = getAsset(state, clip.assetId);
      validateRange(asset, command.sourceInUs, command.sourceOutUs);

      const next = [...state.videoClips];
      next[index] = {
        ...clip,
        sourceInUs: command.sourceInUs,
        sourceOutUs: command.sourceOutUs,
      };
      return finalizeVideoChange(state, next);
    }

    case "deleteClip": {
      if (!state.videoClips.some((clip) => clip.id === command.clipId)) {
        fail("CLIP_NOT_FOUND", `Clip ${command.clipId} が見つかりません`);
      }
      return finalizeVideoChange(
        state,
        state.videoClips.filter((clip) => clip.id !== command.clipId),
      );
    }

    case "setAudio": {
      if (command.audio === null) return { ...state, audioClip: null };
      const asset = getAsset(state, command.audio.assetId);
      if (asset.kind !== "audio") fail("ASSET_KIND_MISMATCH", "audio trackにはaudio Assetが必要です");
      validateRange(asset, command.audio.sourceInUs, command.audio.sourceOutUs);
      if (!Number.isSafeInteger(command.audio.timelineStartUs) || command.audio.timelineStartUs < 0) {
        fail("INVALID_TIME", "audio開始時刻が不正です");
      }
      if (!Number.isFinite(command.audio.volume) || command.audio.volume < 0 || command.audio.volume > 1) {
        fail("INVALID_VOLUME", "volumeは0から1の範囲で指定してください");
      }
      return { ...state, audioClip: { ...command.audio } };
    }

    case "setCanvas": {
      const preset = (CANVAS_PRESETS as Record<string, { width: number; height: number }>)[command.preset];
      if (!preset) fail("INVALID_CANVAS_PRESET", "未対応の動画サイズです");
      if (command.fitMode !== "contain" && command.fitMode !== "cover") {
        fail("INVALID_CANVAS_FIT", "未対応の素材表示方法です");
      }
      return {
        ...state,
        canvas: createCanvasSettings(command.preset, command.fitMode),
      };
    }

    case "addTransition": {
      const { transition } = command;
      if (transition.kind !== "cross-dissolve") fail("UNSUPPORTED_TRANSITION", "未対応のtransitionです");
      if (state.transitions.some((item) => item.id === transition.id)) {
        fail("TRANSITION_ID_CONFLICT", `Transition ${transition.id} はすでに存在します`);
      }
      if (
        state.transitions.some(
          (item) => item.fromClipId === transition.fromClipId && item.toClipId === transition.toClipId,
        )
      ) {
        fail("TRANSITION_CONFLICT", "同じclip境界にはtransitionを1つだけ設定できます");
      }
      if (!transitionFits(state.videoClips, transition)) {
        fail("INVALID_TRANSITION", "cross dissolveは隣接clip間かつ両clipの長さ以内で指定してください");
      }
      return finalizeVideoChange(state, state.videoClips, [...state.transitions, { ...transition }]);
    }

    case "removeTransition": {
      if (!state.transitions.some((transition) => transition.id === command.transitionId)) {
        fail("TRANSITION_NOT_FOUND", `Transition ${command.transitionId} が見つかりません`);
      }
      return finalizeVideoChange(
        state,
        state.videoClips,
        state.transitions.filter((transition) => transition.id !== command.transitionId),
      );
    }
  }
}
