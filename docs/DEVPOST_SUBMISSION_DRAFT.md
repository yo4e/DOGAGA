# WebMCP Challenge — Devpost Submission Draft

Updated: 2026-08-30

This document is a working English draft for the WebMCP Challenge submission. Replace the YouTube placeholder and adjust field lengths to the final Devpost form before submission.

## Project name

DOGAGA

## Tagline

A local-first browser video editor where people and agents edit the same live timeline through WebMCP.

## Links

- Live app: https://dogaga.pages.dev
- Source: https://github.com/yo4e/DOGAGA
- License: MIT
- Demo video: **TODO — public YouTube URL, under 3 minutes, with audio**

## Short description

DOGAGA is a compact, local-first video editor that runs in the browser. A person can load local video and audio, edit a multi-track timeline, preview the real result, and export a downloadable video. At the same time, the page exposes its live editor state as WebMCP tools, so an agent can read and edit the same project the person is looking at.

There is no separate agent timeline and no remote MCP editing backend. Human UI actions and WebMCP tool calls go through the same EditorController and command executor. This makes human → agent → human → agent editing a real shared-state workflow rather than a handoff between disconnected interfaces.

## The problem

AI-assisted creative tools often put the agent beside the editor rather than inside the editing state. The agent may generate instructions, manipulate files indirectly, or operate through a separate automation layer. That creates friction: the person and the agent can easily lose track of each other's latest changes.

Video editing makes that problem especially visible. A timeline contains order, timing, trims, transitions, playback speed, fades, tracks, opacity, audio, canvas settings, and a playhead. If the agent cannot reliably read and mutate that structured state, collaboration becomes fragile.

DOGAGA explores a simpler model: the open web page itself exposes the actions an agent needs, while the person keeps the normal visual editor and final control.

## Why WebMCP is a strong fit

WebMCP gives DOGAGA a structured, page-native interface for agent actions. The agent does not need to guess which DOM element represents a trim, infer timeline state from pixels, or connect to a second timeline stored on a server.

The open DOGAGA page exposes tools for reading project state and performing real editing commands. Those commands mutate the same state that powers the timeline, preview, and export.

This is particularly useful for video editing because many useful operations are naturally structured:

- add or move a clip
- split at a timeline position
- trim source ranges
- change playback speed
- set fade in/out
- add a cross dissolve
- add and reorder tracks
- move a clip to another track
- set track opacity or visibility
- mute audio tracks
- change the project canvas

WebMCP turns those operations into explicit contracts while keeping the visual editor available to the person.

## How WebMCP creates a better user experience

A person can start visually: load their own media, arrange something by hand, and preview it. Then they can ask an agent to make a set of structured edits. The result appears immediately in the same timeline and preview.

The person can then correct the edit manually. Because there is only one editor state, the agent can read the project again and see the person's latest changes before continuing.

That shared loop is the core UX:

1. Person loads local media.
2. Agent reads the live project state.
3. Agent edits the timeline using WebMCP tools.
4. Person previews and adjusts the result manually.
5. Agent re-reads the changed state.
6. Agent continues from the person's latest version.
7. Person exports the real edited video.

Neither side has to translate the project into a separate agent-specific representation before handing it back.

## What people and agents can do together that was difficult before

The person and agent can alternate control over one live, structured video-editing project.

For example, the person can load several local clips and a music file. The agent can add a second video track, split clips, change playback speed, move an overlay clip to V2, reduce that track's opacity, add fades and a dissolve, adjust the canvas, and configure audio. The person can immediately preview those edits, make a correction, and ask the agent to continue from the corrected state.

The same project can then be exported in the browser as a downloadable video.

The important difference is not merely that an agent can “control a video editor.” It is that DOGAGA exposes the editor's semantic actions and safe project state directly from the page, so both participants remain synchronized.

## How DOGAGA implements WebMCP

DOGAGA uses browser-native WebMCP tool registration through the `use-webmcp-tool` lifecycle helper.

The architecture keeps one source of truth:

```text
Local File input (human only)
        |
        v
MediaRuntime Map ---------------------------+
File / object URL                           |
                                            v
Human UI ---> EditorController / executor ---> Editor state ---> Preview / Export
                         ^                      |
                         |                      v
                         +------ WebMCP tools --+
```

The canonical editor state contains canvas settings, loaded safe asset descriptors, video/audio tracks, clips, transitions, and the playhead.

Local `File` objects and object URLs live only in the runtime media map. They are deliberately excluded from the agent-safe state.

All mutation tools call the same command executor used by the human UI. Validation for source ranges, playback rates, fades, track kinds, transition adjacency, opacity, volume, and other constraints therefore applies consistently to both people and agents.

## Current WebMCP tools

DOGAGA currently exposes 20 tools:

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

Existing single-track-style calls remain compatible: `add_clip` defaults to V1 when `trackId` is omitted, while `set_audio` and `clear_audio` default to A1.

## Product experience

DOGAGA is intentionally compact, but the submitted app is a working production-oriented editor rather than a fixed hackathon demo.

Current capabilities include:

- local video and audio loading
- multiple video and audio tracks
- clip split, trim, reorder, delete, and cross-track movement
- keyboard split with Cmd/Ctrl+K
- cross-dissolve shortcut with Shift+D
- video playback speed from 0.25x to 2x
- clip fade in/out
- video track opacity and visibility
- audio track mute and clip volume
- real multi-track browser preview
- cross dissolves
- 16:9, 9:16, 1:1, and 4:5 project canvases
- contain / cover source fitting
- browser-native multi-track video export and download

The export path uses canvas composition, Web Audio, and MediaRecorder. Supported browsers prefer MP4 when available and otherwise fall back to WebM. Normal editing and export do not upload the user's source media to a server.

## Privacy and local-first design

DOGAGA is local-first for media handling.

When a person chooses a video or audio file, the browser keeps the `File` and its object URL in a runtime-only media map. WebMCP receives only safe descriptors such as asset IDs, names, durations, dimensions, clip ranges, track settings, and timeline values.

The agent-safe state does not contain:

- `File` objects
- FileSystemFileHandle values
- absolute file paths
- object URLs
- local filesystem information

Normal editing, preview, and export remain in the browser without uploading source media to DOGAGA servers.

## Why this differs from a conventional MCP video editor

A conventional MCP integration can expose a powerful editor through an external server, desktop process, or separate automation service. DOGAGA is exploring a different boundary: the currently open web application exposes its own semantic editing tools through WebMCP.

That means:

- the person stays in a normal web UI
- the agent works against the state of that same open page
- there is no separate remote MCP server for the timeline
- there is no built-in chat UI required inside DOGAGA
- there is no second copy of the editing project for the agent
- manual edits are immediately part of the state the agent reads next

The browser page becomes the collaboration surface.

## What was built during the Challenge period

DOGAGA existed before August 25, 2026. The repository history documents that prior work.

The Challenge-period work meaningfully extended DOGAGA with WebMCP and completed a compact production editing path. Major additions during the Challenge period include:

- browser-native WebMCP shared-state architecture
- agent-safe editor state and command schemas
- real local-media preview connected to the same state
- real cross-dissolve preview
- timeline / canvas implementation for the compact editor
- Cloudflare Pages public deployment
- browser-native video export / download
- playhead split and editing shortcuts
- playback-speed editing
- clip fade in/out
- canonical multi-track editor state
- video track opacity / visibility
- multiple audio tracks and browser-side audio mixing
- WebMCP expansion to 20 tools
- browser compatibility and WebMCP testing documentation

Relevant implementation history is visible in the public Git commit and pull-request history, including PRs #25, #27, #32, #33, #39, #40, and #41.

## Known limitations

DOGAGA deliberately remains a compact editor. Current limitations include:

- no project persistence / relink across browser sessions yet
- no drag trimming or arbitrary timeline gaps yet
- no audio playback-speed or audio fade controls yet
- no waveform editor
- no captions / lyrics workflow yet
- no advanced effects, masks, blend modes, or keyframe automation
- no goal of frame-perfect professional NLE precision at this stage

These constraints keep the current architecture understandable while leaving a clear path for continued development after the Challenge.

## Testing instructions for judges

### Recommended WebMCP path

1. Open https://dogaga.pages.dev in ChatGPT's in-app browser with Site Tools / WebMCP support.
2. Load one or more local video files and optionally an audio file using the normal human UI. Media selection is intentionally human-only; local file handles are not exposed to the agent.
3. Ask the agent to call `get_project_state`.
4. Ask it to add a video track with `add_track`.
5. Add or move clips, then try `split_clip`, `set_clip_speed`, `move_clip_to_track`, `set_track_opacity`, and `set_clip_fade`.
6. Add a cross dissolve or change the canvas.
7. Observe that the human timeline and preview update immediately.
8. Make a manual edit in the UI.
9. Ask the agent to call `get_project_state` again and continue from the updated state.
10. Use **Export video** to create and download the edited result.

### Without WebMCP

The manual editor, real preview, and export continue to work in a normal supported desktop browser even when WebMCP is unavailable.

For Chrome WebMCP experimental testing, see `docs/WEBMCP_BROWSER_COMPATIBILITY.md`.

## Suggested demo-video narration outline

### 0:00–0:15 — Pitch

“DOGAGA is a local-first browser video editor where a person and an agent edit the same live timeline. Instead of giving the agent a second editing backend, the page exposes its real editor actions through WebMCP.”

### 0:15–0:30 — Human starts the project

Load local video and audio. Mention that source media stays in the browser.

### 0:30–1:30 — Agent edits

Show `get_project_state`, add V2, split or trim clips, change speed, move a clip to V2, change V2 opacity, add fade/dissolve, and adjust audio/canvas.

### 1:30–1:55 — Human correction

Preview the real result and change something manually.

### 1:55–2:20 — Agent continues from human state

Read state again and make one more edit, demonstrating that the agent sees the human's latest version.

### 2:20–2:40 — Real export

Export and download the edited video.

### 2:40–2:55 — Architecture / privacy

Show or narrate the one-state architecture: human UI and WebMCP share the same controller; local media files never enter the agent-safe state.

## Final submission checklist

- [ ] Replace demo-video placeholder with public YouTube URL
- [ ] Keep video under 3 minutes
- [ ] Ensure video has audible English narration or English translation/subtitles as required
- [ ] Verify live URL from a logged-out / judge-like session
- [ ] Verify repository About/license visibility
- [ ] Verify README setup instructions
- [ ] Run final multi-track production QA
- [ ] Run final ChatGPT in-app browser 20-tool shared-state QA
- [ ] Copy/trim this draft to the actual Devpost fields
- [ ] Save submission draft on Devpost
- [ ] Submit before 2026-09-03 13:00 PDT / 2026-09-04 05:00 JST
