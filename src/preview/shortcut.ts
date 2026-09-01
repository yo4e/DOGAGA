type ShortcutKey = Pick<KeyboardEvent, "code" | "key">;

export function isSpaceShortcut(event: ShortcutKey): boolean {
  return event.code === "Space" || event.key === " " || event.key === "Spacebar";
}
