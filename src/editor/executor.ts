import {
  CANVAS_PRESETS,
  DEFAULT_AUDIO_TRACK_ID,
  DEFAULT_VIDEO_TRACK_ID,
  FADE_DURATIONS_US,
  PLAYBACK_RATES,
  allAudioClips,
  allVideoClips,
  clipDurationUs,
  createAudioTrack,
  createCanvasSettings,
  createVideoTrack,
  findVideoClipLocation,
  getAudioTracks,
  getDefaultAudioTrack,
  getDefaultVideoTrack,
  getVideoTracks,
  sourceTimeUsAt,
  type AssetDescriptor,
  type AudioTrack,
  type EditorCommand,
  type EditorState,
  type EditorTrack,
  type TrackKind,
  type Transition,
  type VideoClip,
  type VideoTrack,
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

function validatePlaybackRate(playbackRate: number): void {
  if (!(PLAYBACK_RATES as readonly number[]).includes(playbackRate)) {
    fail("INVALID_PLAYBACK_RATE", `再生速度は ${PLAYBACK_RATES.join(" / ")}x のいずれかで指定してください`);
  }
}

function validateFadeDuration(durationUs: number): void {
  if (!(FADE_DURATIONS_US as readonly number[]).includes(durationUs)) {
    fail("INVALID_FADE_DURATION", "fadeは 0 / 0.25 / 0.5 / 1 / 2秒のいずれかで指定してください");
  }
}

function fitFadeDuration(durationUs: number, clipTimelineDurationUs: number): number {
  const limitUs = Math.min(durationUs, clipTimelineDurationUs);
  return [...FADE_DURATIONS_US].reverse().find((candidate) => candidate <= limitUs) ?? 0;
}

function clampFades(clip: VideoClip): VideoClip {
  const durationUs = clipDurationUs(clip);
  return {
    ...clip,
    fadeInUs: fitFadeDuration(clip.fadeInUs, durationUs),
    fadeOutUs: fitFadeDuration(clip.fadeOutUs, durationUs),
  };
}

function normalizeTrackOrders(tracks: readonly EditorTrack[]): EditorTrack[] {
  const videos = tracks
    .filter((track): track is VideoTrack => track.kind === "video")
    .sort((a, b) => a.order - b.order)
    .map((track, order) => ({ ...track, order }));
  const audios = tracks
    .filter((track): track is AudioTrack => track.kind === "audio")
    .sort((a, b) => a.order - b.order)
    .map((track, order) => ({ ...track, order }));
  return [...videos, ...audios];
}

function getTrack(state: EditorState, trackId: string): EditorTrack {
  const track = state.tracks.find((candidate) => candidate.id === trackId);
  if (!track) fail("TRACK_NOT_FOUND", `Track ${trackId} が見つかりません`);
  return track;
}

function getVideoTrack(state: EditorState, trackId?: string): VideoTrack {
  const track = trackId ? getTrack(state, trackId) : getDefaultVideoTrack(state);
  if (!track || track.kind !== "video") fail("TRACK_KIND_MISMATCH", "video trackを指定してください");
  return track;
}

function getAudioTrack(state: EditorState, trackId?: string): AudioTrack {
  const track = trackId ? getTrack(state, trackId) : getDefaultAudioTrack(state);
  if (!track || track.kind !== "audio") fail("TRACK_KIND_MISMATCH", "audio trackを指定してください");
  return track;
}

function assertUnlocked(track: EditorTrack): void {
  if (track.locked) fail("TRACK_LOCKED", `${track.name} はロックされています`);
}

function clipIdExists(state: EditorState, clipId: string): boolean {
  return allVideoClips(state).some((clip) => clip.id === clipId)
    || allAudioClips(state).some((clip) => clip.id === clipId);
}

function videoTrackContainingClip(tracks: readonly EditorTrack[], clipId: string): VideoTrack | undefined {
  return tracks.find(
    (track): track is VideoTrack => track.kind === "video" && track.clips.some((clip) => clip.id === clipId),
  );
}

function isAdjacent(clips: readonly VideoClip[], fromClipId: string, toClipId: string): boolean {
  const fromIndex = clips.findIndex((clip) => clip.id === fromClipId);
  return fromIndex >= 0 && clips[fromIndex + 1]?.id === toClipId;
}

function transitionFits(tracks: readonly EditorTrack[], transition: Transition): boolean {
  const track = videoTrackContainingClip(tracks, transition.fromClipId);
  if (!track || !track.clips.some((clip) => clip.id === transition.toClipId)) return false;
  if (!isAdjacent(track.clips, transition.fromClipId, transition.toClipId)) return false;
  const from = track.clips.find((clip) => clip.id === transition.fromClipId)!;
  const to = track.clips.find((clip) => clip.id === transition.toClipId)!;
  return (
    Number.isSafeInteger(transition.durationUs) &&
    transition.durationUs > 0 &&
    transition.durationUs <= Math.min(clipDurationUs(from), clipDurationUs(to))
  );
}

function sanitizeTransitions(tracks: readonly EditorTrack[], transitions: readonly Transition[]): Transition[] {
  return transitions.filter((transition) => transitionFits(tracks, transition));
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
    const next = clampFades({ ...clip, timelineStartUs });
    packed.push(next);
    cursorUs = timelineStartUs + clipDurationUs(next);
  }

  return packed;
}

function finalizeTracks(
  state: EditorState,
  tracks: readonly EditorTrack[],
  transitions: readonly Transition[] = state.transitions,
): EditorState {
  const normalized = normalizeTrackOrders(tracks).map((track) =>
    track.kind === "video"
      ? { ...track, clips: track.clips.map(clampFades) }
      : { ...track, clips: track.clips.map((clip) => ({ ...clip })) },
  );
  const validTransitions = sanitizeTransitions(normalized, transitions);
  const packed = normalized.map((track) =>
    track.kind === "video"
      ? { ...track, clips: packVideoTrack(track.clips, validTransitions) }
      : track,
  );
  return {
    ...state,
    tracks: packed,
    transitions: validTransitions,
  };
}

function replaceTrack(state: EditorState, trackId: string, nextTrack: EditorTrack): EditorState {
  return finalizeTracks(
    state,
    state.tracks.map((track) => track.id === trackId ? nextTrack : track),
  );
}

function reorderKindTracks(state: EditorState, kind: TrackKind, trackId: string, toIndex: number): EditorState {
  const kindTracks = (kind === "video" ? getVideoTracks(state) : getAudioTracks(state)) as EditorTrack[];
  const fromIndex = kindTracks.findIndex((track) => track.id === trackId);
  if (fromIndex < 0) fail("TRACK_NOT_FOUND", `Track ${trackId} が見つかりません`);
  if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= kindTracks.length) {
    fail("INVALID_INDEX", "track移動先indexが範囲外です");
  }
  if (fromIndex === toIndex) return state;

  const nextKindTracks = [...kindTracks];
  const [moved] = nextKindTracks.splice(fromIndex, 1);
  nextKindTracks.splice(toIndex, 0, moved);
  const orderById = new Map(nextKindTracks.map((track, index) => [track.id, index]));
  const nextTracks = state.tracks.map((track) =>
    track.kind === kind ? { ...track, order: orderById.get(track.id)! } : track,
  );
  return finalizeTracks(state, nextTracks);
}

export function executeCommand(state: EditorState, command: EditorCommand): EditorState {
  switch (command.type) {
    case "addTrack": {
      if (state.tracks.some((track) => track.id === command.track.id)) {
        fail("TRACK_ID_CONFLICT", `Track ${command.track.id} はすでに存在します`);
      }
      if (!command.track.name.trim()) fail("INVALID_TRACK_NAME", "track名を指定してください");
      const order = command.track.kind === "video" ? getVideoTracks(state).length : getAudioTracks(state).length;
      const track = command.track.kind === "video"
        ? createVideoTrack(command.track.id, command.track.name, order)
        : createAudioTrack(command.track.id, command.track.name, order);
      return finalizeTracks(state, [...state.tracks, track]);
    }

    case "removeTrack": {
      const track = getTrack(state, command.trackId);
      if (track.id === DEFAULT_VIDEO_TRACK_ID || track.id === DEFAULT_AUDIO_TRACK_ID) {
        fail("DEFAULT_TRACK_REQUIRED", "V1 / A1 は互換性維持のため削除できません");
      }
      if (track.clips.length > 0) fail("TRACK_NOT_EMPTY", "clipがあるtrackは削除できません");
      return finalizeTracks(state, state.tracks.filter((candidate) => candidate.id !== track.id));
    }

    case "moveTrack": {
      const track = getTrack(state, command.trackId);
      return reorderKindTracks(state, track.kind, track.id, command.toIndex);
    }

    case "setTrackOpacity": {
      const track = getVideoTrack(state, command.trackId);
      if (!Number.isFinite(command.opacity) || command.opacity < 0 || command.opacity > 1) {
        fail("INVALID_OPACITY", "opacityは0から1の範囲で指定してください");
      }
      return replaceTrack(state, track.id, { ...track, opacity: command.opacity });
    }

    case "setTrackVisibility": {
      const track = getVideoTrack(state, command.trackId);
      if (typeof command.visible !== "boolean") fail("INVALID_VISIBILITY", "visibleはbooleanで指定してください");
      return replaceTrack(state, track.id, { ...track, visible: command.visible });
    }

    case "setTrackMute": {
      const track = getAudioTrack(state, command.trackId);
      if (typeof command.muted !== "boolean") fail("INVALID_MUTE", "mutedはbooleanで指定してください");
      return replaceTrack(state, track.id, { ...track, muted: command.muted });
    }

    case "addClip": {
      if (clipIdExists(state, command.clip.id)) {
        fail("CLIP_ID_CONFLICT", `Clip ${command.clip.id} はすでに存在します`);
      }
      const track = getVideoTrack(state, command.trackId);
      assertUnlocked(track);
      const asset = getAsset(state, command.clip.assetId);
      if (asset.kind !== "video") fail("ASSET_KIND_MISMATCH", "video clipにはvideo Assetが必要です");
      validateRange(asset, command.clip.sourceInUs, command.clip.sourceOutUs);
      const playbackRate = command.clip.playbackRate ?? 1;
      const fadeInUs = command.clip.fadeInUs ?? 0;
      const fadeOutUs = command.clip.fadeOutUs ?? 0;
      validatePlaybackRate(playbackRate);
      validateFadeDuration(fadeInUs);
      validateFadeDuration(fadeOutUs);

      const atIndex = command.atIndex ?? track.clips.length;
      if (!Number.isInteger(atIndex) || atIndex < 0 || atIndex > track.clips.length) {
        fail("INVALID_INDEX", "挿入位置が範囲外です");
      }

      const clips = [...track.clips];
      clips.splice(atIndex, 0, {
        ...command.clip,
        playbackRate,
        fadeInUs,
        fadeOutUs,
        timelineStartUs: 0,
      });
      return replaceTrack(state, track.id, { ...track, clips });
    }

    case "moveClip": {
      const location = findVideoClipLocation(state, command.clipId);
      if (!location) fail("CLIP_NOT_FOUND", `Clip ${command.clipId} が見つかりません`);
      assertUnlocked(location.track);
      if (!Number.isInteger(command.toIndex) || command.toIndex < 0 || command.toIndex >= location.track.clips.length) {
        fail("INVALID_INDEX", "移動先indexが範囲外です");
      }
      if (location.clipIndex === command.toIndex) return state;
      const clips = [...location.track.clips];
      const [clip] = clips.splice(location.clipIndex, 1);
      clips.splice(command.toIndex, 0, clip);
      return replaceTrack(state, location.track.id, { ...location.track, clips });
    }

    case "moveClipToTrack": {
      const location = findVideoClipLocation(state, command.clipId);
      if (!location) fail("CLIP_NOT_FOUND", `Clip ${command.clipId} が見つかりません`);
      const target = getVideoTrack(state, command.trackId);
      assertUnlocked(location.track);
      assertUnlocked(target);
      if (location.track.id === target.id) {
        if (command.toIndex === undefined) return state;
        return executeCommand(state, { type: "moveClip", clipId: command.clipId, toIndex: command.toIndex });
      }

      const targetIndex = command.toIndex ?? target.clips.length;
      if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex > target.clips.length) {
        fail("INVALID_INDEX", "移動先indexが範囲外です");
      }
      const sourceClips = location.track.clips.filter((clip) => clip.id !== command.clipId);
      const targetClips = [...target.clips];
      targetClips.splice(targetIndex, 0, { ...location.clip, timelineStartUs: 0 });
      const nextTracks = state.tracks.map((track) => {
        if (track.id === location.track.id && track.kind === "video") return { ...track, clips: sourceClips };
        if (track.id === target.id && track.kind === "video") return { ...track, clips: targetClips };
        return track;
      });
      return finalizeTracks(state, nextTracks);
    }

    case "trimClip": {
      const location = findVideoClipLocation(state, command.clipId);
      if (!location) fail("CLIP_NOT_FOUND", `Clip ${command.clipId} が見つかりません`);
      assertUnlocked(location.track);
      const asset = getAsset(state, location.clip.assetId);
      validateRange(asset, command.sourceInUs, command.sourceOutUs);
      const clips = [...location.track.clips];
      clips[location.clipIndex] = clampFades({
        ...location.clip,
        sourceInUs: command.sourceInUs,
        sourceOutUs: command.sourceOutUs,
      });
      return replaceTrack(state, location.track.id, { ...location.track, clips });
    }

    case "splitClip": {
      const location = findVideoClipLocation(state, command.clipId);
      if (!location) fail("CLIP_NOT_FOUND", `Clip ${command.clipId} が見つかりません`);
      assertUnlocked(location.track);
      if (clipIdExists(state, command.newClipId)) {
        fail("CLIP_ID_CONFLICT", `Clip ${command.newClipId} はすでに存在します`);
      }
      if (!Number.isSafeInteger(command.atTimelineUs)) {
        fail("INVALID_TIME", "split位置は安全な整数マイクロ秒で指定してください");
      }

      const clip = location.clip;
      const clipStartUs = clip.timelineStartUs;
      const clipEndUs = clipStartUs + clipDurationUs(clip);
      if (command.atTimelineUs <= clipStartUs || command.atTimelineUs >= clipEndUs) {
        fail("INVALID_SPLIT_POSITION", "split位置はclipの開始・終了より内側に指定してください");
      }

      const sourceSplitUs = sourceTimeUsAt(clip, command.atTimelineUs);
      if (sourceSplitUs <= clip.sourceInUs || sourceSplitUs >= clip.sourceOutUs) {
        fail("INVALID_SPLIT_POSITION", "split位置を素材時刻へ変換できませんでした");
      }

      const left = clampFades({ ...clip, sourceOutUs: sourceSplitUs, fadeOutUs: 0 });
      const right = clampFades({
        id: command.newClipId,
        assetId: clip.assetId,
        timelineStartUs: 0,
        sourceInUs: sourceSplitUs,
        sourceOutUs: clip.sourceOutUs,
        playbackRate: clip.playbackRate,
        fadeInUs: 0,
        fadeOutUs: clip.fadeOutUs,
      });
      const clips = [...location.track.clips];
      clips.splice(location.clipIndex, 1, left, right);
      const nextTracks = state.tracks.map((track) =>
        track.id === location.track.id && track.kind === "video" ? { ...track, clips } : track,
      );
      const transitions = state.transitions.map((transition) =>
        transition.fromClipId === clip.id ? { ...transition, fromClipId: command.newClipId } : transition,
      );
      return finalizeTracks(state, nextTracks, transitions);
    }

    case "setClipSpeed": {
      const location = findVideoClipLocation(state, command.clipId);
      if (!location) fail("CLIP_NOT_FOUND", `Clip ${command.clipId} が見つかりません`);
      assertUnlocked(location.track);
      validatePlaybackRate(command.playbackRate);
      if (location.clip.playbackRate === command.playbackRate) return state;
      const clips = [...location.track.clips];
      clips[location.clipIndex] = clampFades({ ...location.clip, playbackRate: command.playbackRate });
      return replaceTrack(state, location.track.id, { ...location.track, clips });
    }

    case "setClipFade": {
      const location = findVideoClipLocation(state, command.clipId);
      if (!location) fail("CLIP_NOT_FOUND", `Clip ${command.clipId} が見つかりません`);
      assertUnlocked(location.track);
      validateFadeDuration(command.fadeInUs);
      validateFadeDuration(command.fadeOutUs);
      const durationUs = clipDurationUs(location.clip);
      if (command.fadeInUs > durationUs || command.fadeOutUs > durationUs) {
        fail("FADE_TOO_LONG", "fade時間はclipのtimeline尺以内にしてください");
      }
      const clips = [...location.track.clips];
      clips[location.clipIndex] = {
        ...location.clip,
        fadeInUs: command.fadeInUs,
        fadeOutUs: command.fadeOutUs,
      };
      return replaceTrack(state, location.track.id, { ...location.track, clips });
    }

    case "deleteClip": {
      const location = findVideoClipLocation(state, command.clipId);
      if (!location) fail("CLIP_NOT_FOUND", `Clip ${command.clipId} が見つかりません`);
      assertUnlocked(location.track);
      const clips = location.track.clips.filter((clip) => clip.id !== command.clipId);
      return replaceTrack(state, location.track.id, { ...location.track, clips });
    }

    case "setAudio": {
      const track = getAudioTrack(state, command.trackId);
      assertUnlocked(track);
      if (command.audio === null) return replaceTrack(state, track.id, { ...track, clips: [] });
      const asset = getAsset(state, command.audio.assetId);
      if (asset.kind !== "audio") fail("ASSET_KIND_MISMATCH", "audio trackにはaudio Assetが必要です");
      validateRange(asset, command.audio.sourceInUs, command.audio.sourceOutUs);
      if (!Number.isSafeInteger(command.audio.timelineStartUs) || command.audio.timelineStartUs < 0) {
        fail("INVALID_TIME", "audio開始時刻が不正です");
      }
      if (!Number.isFinite(command.audio.volume) || command.audio.volume < 0 || command.audio.volume > 1) {
        fail("INVALID_VOLUME", "volumeは0から1の範囲で指定してください");
      }
      const conflict = allVideoClips(state).some((clip) => clip.id === command.audio!.id)
        || getAudioTracks(state).some(
          (candidate) => candidate.id !== track.id && candidate.clips.some((clip) => clip.id === command.audio!.id),
        );
      if (conflict) fail("CLIP_ID_CONFLICT", `Clip ${command.audio.id} はすでに存在します`);
      return replaceTrack(state, track.id, { ...track, clips: [{ ...command.audio }] });
    }

    case "setCanvas": {
      const preset = (CANVAS_PRESETS as Record<string, { width: number; height: number }>)[command.preset];
      if (!preset) fail("INVALID_CANVAS_PRESET", "未対応の動画サイズです");
      if (command.fitMode !== "contain" && command.fitMode !== "cover") {
        fail("INVALID_CANVAS_FIT", "未対応の素材表示方法です");
      }
      return { ...state, canvas: createCanvasSettings(command.preset, command.fitMode) };
    }

    case "addTransition": {
      const { transition } = command;
      if (transition.kind !== "cross-dissolve") fail("UNSUPPORTED_TRANSITION", "未対応のtransitionです");
      if (state.transitions.some((item) => item.id === transition.id)) {
        fail("TRANSITION_ID_CONFLICT", `Transition ${transition.id} はすでに存在します`);
      }
      if (state.transitions.some((item) => item.fromClipId === transition.fromClipId && item.toClipId === transition.toClipId)) {
        fail("TRANSITION_CONFLICT", "同じclip境界にはtransitionを1つだけ設定できます");
      }
      const track = videoTrackContainingClip(state.tracks, transition.fromClipId);
      if (!track) fail("CLIP_NOT_FOUND", "transition元clipが見つかりません");
      assertUnlocked(track);
      if (!transitionFits(state.tracks, transition)) {
        fail("INVALID_TRANSITION", "cross dissolveは同じvideo track内の隣接clip間かつ両clipの長さ以内で指定してください");
      }
      return finalizeTracks(state, state.tracks, [...state.transitions, { ...transition }]);
    }

    case "removeTransition": {
      const transition = state.transitions.find((item) => item.id === command.transitionId);
      if (!transition) fail("TRANSITION_NOT_FOUND", `Transition ${command.transitionId} が見つかりません`);
      const track = videoTrackContainingClip(state.tracks, transition.fromClipId);
      if (track) assertUnlocked(track);
      return finalizeTracks(
        state,
        state.tracks,
        state.transitions.filter((item) => item.id !== command.transitionId),
      );
    }
  }
}
