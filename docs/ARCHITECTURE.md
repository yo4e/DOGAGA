# DOGAGA Architecture — Compact Production v0

Updated: 2026-09-02

This document describes the current public DOGAGA build used for WebMCP Challenge evaluation. Older roadmap and design documents remain in the repository as development history and may describe earlier stages or future features.

## 1. Product boundary

DOGAGA is a local-first browser video editor. The current production scope includes local video/image/audio loading, multiple video and audio tracks, actual multi-layer Preview, browser-native export, and a **23-tool WebMCP surface**.

The Challenge build is not a separate demo application. The public app at `https://dogaga.pages.dev` is the product being evaluated.

## 2. One editor state for humans and agents

DOGAGA keeps one canonical editing state. The human UI and WebMCP tools do not maintain separate timelines.

```text
Local File input (human only)
        |
        v
MediaRuntime Map -----------------------------+
assetId -> File / object URL                  |
                                              v
Human UI ---> EditorController / executor ---> Editor State ---> Preview / Export
                         ^                      |
                         |                      v
                         +------ WebMCP Tools --+
```

The important boundary is between **serializable editing/collaboration state** and **runtime-only local media bindings**.

## 3. Canonical editor state

The editing state is centered on `tracks[]`:

```ts
type EditorState = {
  canvas: CanvasSettings;
  assets: AssetDescriptor[];
  tracks: EditorTrack[];
  transitions: Transition[];
  playheadUs: number;
};
```

Video tracks contain video or still-image clips plus track-level visibility / opacity. Audio tracks contain audio clips plus track-level mute state. Track order determines visual compositing order within the video-track stack.

For backward compatibility with earlier agent workflows, the agent-safe serialized state still includes temporary legacy V1/A1-derived views in addition to canonical `tracks[]` data.

## 4. Collaboration state

The same `EditorController` also owns small collaboration metadata that is kept separate from Preview / Export semantics:

- `projectBrief` — human-selected destination and goal
- `editPlan` — a validated, reviewable agent proposal
- `humanDemonstration` — a semantic human before/after example captured through Teach by Example

`get_project_state` returns the agent-safe form of this collaboration state together with the live editor state.

A private snapshot used while teaching is never exposed to WebMCP. Only the resulting semantic demonstration is shared.

## 5. Command execution

Human UI operations and WebMCP mutation tools go through the same `EditorController` and command executor.

The command layer validates constraints including:

- asset and track existence
- video/audio track kind
- source in/out ranges
- supported playback rates
- supported fade durations
- still-image display duration
- valid track movement indices
- video track opacity / visibility
- audio volume / mute
- split positions
- cross-dissolve adjacency and duration
- canvas presets and source-fit modes

This shared command path prevents the agent from silently creating a second set of editing semantics.

## 6. Local media runtime

When a person chooses a local video, image, or audio file, DOGAGA probes browser-readable metadata and registers a safe `AssetDescriptor` in editor state.

The actual `File` and object URL are stored separately in `MediaRuntime`, keyed by asset ID. They exist only for the browser session.

Runtime-only media data is used by Preview and Export but is not serialized into WebMCP state.

## 7. Preview

Preview reads the same editor state used by the timeline and WebMCP tools.

Current behavior includes:

- real local video playback
- still-image clips
- multiple visual layers
- transparent PNG compositing
- track opacity and visibility
- video trim and playback speed
- still-image display duration
- visual clip fade in/out
- cross-dissolve compositing
- multiple audio tracks
- track mute and clip volume
- playhead seek and transport controls
- 16:9, 9:16, 1:1, and 4:5 canvases
- contain / cover source fitting

DOGAGA is not intended to provide frame-perfect professional NLE timing. Compact production v0 targets a coherent browser editing experience for short-form and music-centered work.

## 8. Export

Export is performed in the browser without uploading source media to a DOGAGA server.

```text
Editor State
   |
   +--> visual layer planning --> Canvas composition --> canvas.captureStream()
   |
   +--> audio tracks -----------> Web Audio mix --------+
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

The export path applies the same visual track order, alpha transparency, opacity, visibility, video trim/speed, still duration, fades, cross-dissolves, audio mix, mute state, clip volume, canvas settings, and source fitting used by the editor.

DOGAGA prefers MP4 when the browser exposes a compatible MediaRecorder format and falls back to WebM when needed.

## 9. WebMCP surface

DOGAGA currently exposes **23 tools**.

Core/collaboration tools:

1. `get_project_state`
2. `propose_edit_plan`
3. `add_track`
4. `remove_track`
5. `move_track`
6. `set_track_opacity`
7. `set_track_visibility`
8. `set_track_mute`
9. `add_clip`
10. `move_clip`
11. `move_clip_to_track`
12. `trim_clip`
13. `split_clip`
14. `set_clip_speed`
15. `set_clip_fade`
16. `delete_clip`
17. `set_audio`
18. `clear_audio`
19. `set_canvas`
20. `add_transition`
21. `remove_transition`

Still-image-specific tools:

22. `add_image_clip`
23. `set_still_duration`

The tools are registered through `use-webmcp-tool`. Their mutation handlers call the same controller used by the human UI.

## 10. Teach by Example

Teach by Example records semantic before/after changes rather than mouse events.

Supported semantic changes include:

- `add_visual_clip`
- `set_canvas`
- `set_track_opacity`
- `set_track_visibility`
- `set_track_mute`
- `move_clip`
- `move_clip_to_track`
- `set_clip_speed`
- `set_still_duration`
- `set_clip_fade`

A completed example appears as `humanDemonstration` in `get_project_state` and as a human-readable **Human example** column in developer details.

The agent is instructed to treat that demonstration as an example to generalize to analogous current assets/clips, not as a macro to blindly replay.

## 11. Reviewable edit plans

`propose_edit_plan` accepts a reason and 1–8 structured operations. It validates the complete plan non-mutatingly against the live state.

The plan operation surface includes:

- `add_visual_clip`
- `set_canvas`
- `set_track_opacity`
- `set_track_visibility`
- `set_track_mute`
- `move_clip`
- `move_clip_to_track`
- `trim_clip`
- `set_clip_speed`
- `set_still_duration`
- `set_clip_fade`

A valid proposal appears in DOGAGA as an app-owned Agent suggestion. It does not change the timeline until the human chooses **Apply**. Apply revalidates and commits atomically; Reject leaves the timeline untouched.

The final Challenge collaboration loop is therefore:

> **Human teaches → DOGAGA captures semantic meaning → Agent generalizes → Human approves**

## 12. Agent-safe state boundary

The WebMCP-visible state deliberately excludes runtime-local information.

Not exposed to the agent:

- `File` objects
- `FileSystemFileHandle` values
- absolute filesystem paths
- object URLs
- runtime media bindings
- media pixels
- private Teach by Example snapshots

The agent receives safe identifiers and editing metadata such as asset IDs, names, media kinds, durations, dimensions, track settings, clip ranges/durations, transitions, canvas settings, playhead state, Project Brief, review-plan status, and semantic human demonstration data.

## 13. Failure behavior

Invalid commands are rejected before editor state is replaced. Public runtime errors are normalized to English at the controller boundary so the human UI and WebMCP consumer receive consistent evaluation-facing messages.

Edit Plan validation is non-mutating. Apply revalidates the whole proposal and does not partially commit a stale or invalid plan.

Media probing and export failures also return English messages without exposing local filesystem paths.

## 14. Current intentional limitations

Compact production v0 does not currently include:

- persistent project save/relink across browser sessions
- arbitrary timeline gaps or free clip positioning
- drag trimming
- audio playback-speed or fade controls
- waveform editing
- lyrics/caption editing
- advanced effects, masks, blend modes, or keyframe automation
- image-specific motion/effects such as Ken Burns animation
- frame-perfect professional NLE guarantees

These are roadmap items, not hidden requirements of the submitted build.

## 15. Validation

The repository CI validates a clean Node.js 22 install using `npm ci`, TypeScript type checking, unit tests, and production build.

PR #60's latest pre-merge validation passed typecheck, **77 tests**, build, GitHub Actions, and Cloudflare Pages preview. Human production smoke has separately covered manual editing, multi-track video/audio behavior, still-image/transparent-PNG compositing, real export/download, and Teach by Example capture.

The final submission-only gate is the supported-host production WebMCP scenario tracked in Issue #22: `get_project_state → read humanDemonstration → generalize through propose_edit_plan → Human Apply`.
