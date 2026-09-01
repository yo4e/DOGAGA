export type PlaybackClock = {
  wallMs: number;
  playheadUs: number;
};

export function playbackPositionUs(clock: PlaybackClock, nowMs: number, maxUs: number): number {
  const elapsedUs = Math.max(0, Math.round((nowMs - clock.wallMs) * 1000));
  return Math.min(maxUs, clock.playheadUs + elapsedUs);
}
