type ClipDropIndexInput = {
  sourceIndex: number;
  targetLength: number;
  insertionIndex: number;
  sameTrack: boolean;
};

export function resolveClipDropIndex({
  sourceIndex,
  targetLength,
  insertionIndex,
  sameTrack,
}: ClipDropIndexInput): number {
  const boundedInsertion = Math.max(0, Math.min(targetLength, insertionIndex));
  if (!sameTrack) return boundedInsertion;

  const withoutSource = sourceIndex < boundedInsertion
    ? boundedInsertion - 1
    : boundedInsertion;
  return Math.max(0, Math.min(Math.max(0, targetLength - 1), withoutSource));
}
