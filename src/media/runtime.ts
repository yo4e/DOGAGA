export type RuntimeMediaBinding = {
  file: File;
  objectUrl: string;
};

export class MediaRuntime {
  private readonly bindings = new Map<string, RuntimeMediaBinding>();

  register(assetId: string, file: File): RuntimeMediaBinding {
    this.remove(assetId);
    const binding = { file, objectUrl: URL.createObjectURL(file) };
    this.bindings.set(assetId, binding);
    return binding;
  }

  get(assetId: string): RuntimeMediaBinding | undefined {
    return this.bindings.get(assetId);
  }

  remove(assetId: string): void {
    const existing = this.bindings.get(assetId);
    if (!existing) return;
    URL.revokeObjectURL(existing.objectUrl);
    this.bindings.delete(assetId);
  }

  dispose(): void {
    for (const binding of this.bindings.values()) {
      URL.revokeObjectURL(binding.objectUrl);
    }
    this.bindings.clear();
  }
}
