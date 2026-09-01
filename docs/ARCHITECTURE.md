# DOGAGA Architecture — Compact Production v0

Updated: 2026-09-01

This document describes the architecture of the current public DOGAGA build used for WebMCP Challenge evaluation. Older roadmap and design documents remain in the repository as development history, but they may describe features that are not part of the current compact production v0.

## 1. Product boundary

DOGAGA is a local-first browser video editor. The current production scope includes local video/audio loading, multiple video and audio tracks, real preview, browser-native export, and 20 WebMCP editing tools.

The Challenge build is not a separate demo application. The public app at `https://dogaga.pages.dev` is the product being evaluated.

## 2. One editor state for humans and agents

DOGAGA keeps one canonical editing state. The human UI and WebMCP tools do not maintain separate timelines.

```text
Local File input (human only)
        |
        v
MediaRuntime Map ----------------------------+
assetId -> File / object URL                 |
                                             v
Human UI ---> EditorController / executor ---> Editor State ---> Preview / Export
                         ^                     |
                         |                     v
                         +------ WebMCP Tools --+
```

The important boundary is between **serializable editing state** and **runtime-only local media bindings**.

## 3. Canonical editor state

The current state is centered on `tracks[]`:

```ts
type EditorState = {
  canvas: CanvasSettings;
  assets: AssetDescriptor[];
  tracks: EditorTrack[];
  transitions: Transition[];
  playheadUs: number;
};
```

Video tracks contain video clips and track-level visibility / opacity. Audio tracks contain audio clips and track-level mute state. Track order determines video compositing order within the corresponding media kind.

For backward compatibility with earlier agent workflows, the agent-safe serialized state still includes legacy V1/A1-derived views in addition to canonical `tracks[]` data.

## 4. Command execution

Human UI operations and WebMCP mutation tools go through the same `EditorController` and command executor.

The command layer validates constraints including:

- asset and track existence
- video/audio track kind
- source in/out ranges
- supported playback rates
- supported fade durations
- valid track movement indices
- video track opacity
- audio volume and mute state
- split positions
- cross-dissolve adjacency and duration
- canvas presets and source-fit modes

This shared command path prevents the agent from silently creating a second set of editing semantics.

## 5. Local media runtime

When a person chooses a local file, DOGAGA probes its browser-readable metadata and registers a safe `AssetDescriptor` in editor state.

The actual `File` and object URL are stored separately in `MediaRuntime`, keyed by asset ID. They exist only for the browser session.

Runtime-only media data is used by Preview and Export but is not serialized into WebMCP state.

## 6. Preview

Preview reads the same editor state used by the timeline and WebMCP tools.

Current behavior includes:

- real local video playback
- multiple video layers
- track opacity and visibility
- trim and playback speed
- clip fade in/out
- cross-dissolve compositing
- multiple audio tracks
- track mute and clip volume
- playhead seek and transport controls
- 16:9, 9:16, 1:1, and 4:5 canvases
- contain / cover source fitting

DOGAGA is not currently intended to provide frame-perfect professional NLE timing. The compact production v0 target is a coherent browser editing experience for short-form and music-centered work.

## 7. Export

Export is performed in the browser without uploading source media to a DOGAGA server.

The current path uses:

```text
Editor State
   |
   +--> video layer planning --> Canvas composition --> canvas.captureStream()
   |
   +--> audio tracks ---------> Web Audio mix --------+
                                                    |
                                                    v
                                               MediaRecorder
                                                    |
                                                    v
                                             MP4 / WebM Blob
                                                    |
                                                    v
                                                Download
```

The export path applies the same track order, opacity, visibility, trim, playback speed, fades, cross-dissolves, audio mix, mute state, clip volume, canvas settings, and source fitting used by the editor.

DOGAGA prefers MP4 when the browser exposes a compatible MediaRecorder format and falls back to WebM when needed.

## 8. WebMCP surface

The page currently exposes 20 tools:

1. `get_project_state`
2. `add_track`
3. `remove_track`
4. `move_track`
5. `set_track_opacity`
6. `set_track_visibility`
7. `set_track_mute`
8. `add_clip`
9. `move_clip`
10. `move_clip_to_track`
11. `trim_clip`
12. `split_clip`
13. `set_clip_speed`
14. `set_clip_fade`
15. `delete_clip`
16. `set_audio`
17. `clear_audio`
18. `set_canvas`
19. `add_transition`
20. `remove_transition`

The tools are registered through `use-webmcp-tool`. Their mutation handlers call the same controller used by the human UI.

## 9. Agent-safe state boundary

The WebMCP-visible state deliberately excludes runtime-local information.

Not exposed to the agent:

- `File` objects
- `FileSystemFileHandle` values
- absolute filesystem paths
- object URLs
- runtime media bindings

The agent receives safe identifiers and editing metadata such as asset IDs, names, durations, dimensions, track settings, clip ranges, transitions, canvas settings, and playhead state.

## 10. Failure behavior

Invalid commands are rejected before editor state is replaced. Public runtime errors are normalized to English at the controller boundary so the human UI and WebMCP consumer receive consistent evaluation-facing messages.

Media probing and export failures also return English messages without exposing local filesystem paths.

## 11. Current intentional limitations

Compact production v0 does not currently include:

- persistent project save/relink across browser sessions
- arbitrary timeline gaps or free clip positioning
- drag trimming
- audio playback-speed or fade controls
- waveform editing
- lyrics/caption editing
- advanced effects, masks, blend modes, or keyframe automation
- frame-perfect professional NLE guarantees

These are product-roadmap items, not hidden requirements of the submitted build.

## 12. Validation

The repository CI validates a clean Node.js 22 install using `npm ci`, TypeScript type checking, unit tests, and production build.

Browser QA has separately covered manual editing, local preview, multi-track video/audio behavior, real export/download, and WebMCP shared-state behavior. The final submission QA remains tracked in Issue #22.
