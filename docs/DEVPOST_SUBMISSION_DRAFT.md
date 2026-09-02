# WebMCP Challenge — Devpost Submission Draft

Updated: 2026-09-02

Working English submission copy for the final Challenge build. Replace the YouTube placeholder and trim to the actual Devpost field limits before submission.

## Project name

DOGAGA

## Tagline

Teach a browser video editor by example, let the agent generalize, then approve the result.

## Links

- Live app: https://dogaga.pages.dev
- Source: https://github.com/yo4e/DOGAGA
- License: MIT
- Demo video: **TODO — public YouTube URL, under 3 minutes, with audio**

## Short description

DOGAGA is a compact, local-first browser video editor where the human UI and a WebMCP agent operate on the same live timeline.

Its final collaboration flow is **Human teaches → DOGAGA captures semantic meaning → Agent generalizes → Human approves**. A person can demonstrate an edit through the normal UI, DOGAGA exposes the semantic before/after result as agent-safe state, the agent generalizes that treatment through a reviewable Edit Plan, and the human decides whether to Apply or Reject it.

There is no separate agent timeline, remote MCP editing backend, screen-recorded macro, or automatic hidden replay. The same `EditorController` powers human editing, WebMCP tools, Preview, and browser-native Export.

## The problem

AI-assisted creative tools often place the agent beside the editor rather than inside the editor's structured state. The agent may generate instructions, click UI controls indirectly, or operate through a separate backend. That creates a synchronization problem: after either side edits, the other side may not know the current project state or the human's actual intent.

Video editing makes this especially visible. Meaning lives in structured operations—track order, clip timing, fades, opacity, canvas, image duration, audio state—not just in pixels or DOM controls.

DOGAGA explores a page-native alternative: the open web application exposes its live semantic editing state and actions through WebMCP while the person keeps the normal visual editor and final approval.

## Why WebMCP is a strong fit

WebMCP gives the open DOGAGA page an explicit contract for agent-readable state and semantic editing actions.

The agent does not have to infer a timeline from pixels or guess which DOM element corresponds to a trim, fade, track, or still-image duration. It can call `get_project_state`, inspect the same structured project the UI is rendering, and use typed tools or a reviewable multi-step proposal.

This becomes more powerful with Teach by Example. DOGAGA can capture a human edit as semantic meaning—for example, “add this still to V2, make it 3 seconds, add a 0.5 second fade”—then expose that meaning through WebMCP. The agent can infer analogous assets and propose the same treatment elsewhere.

That is a natural WebMCP interaction because the page itself owns both the visual interaction and the structured semantics.

## How it creates a better user experience

The person can work visually and demonstrate intent instead of translating every editing decision into a prompt.

A typical loop is:

1. Human loads local media and starts editing normally.
2. Human clicks **Teach agent**.
3. Human demonstrates one treatment in the normal editor.
4. DOGAGA captures supported semantic before/after changes.
5. Agent calls `get_project_state` and reads `humanDemonstration`.
6. Human asks: **“Do the same to the other still images.”**
7. Agent maps the example to analogous current assets and submits `propose_edit_plan`.
8. DOGAGA shows the plan without mutating the timeline.
9. Human clicks **Apply** or **Reject**.
10. If applied, the same live timeline and Preview update immediately and can be exported in the browser.

The human does not have to describe every slider value again, and the agent does not get permission to silently replay or approve its own generalized edit.

## What people and agents can do together that was difficult before

The human can communicate editing intent through an actual edit, while the agent receives a structured semantic representation of what changed.

For example, a person can load several still images, demonstrate a 3-second faded overlay on V2, and ask the agent to do the same to the other images. The agent sees safe asset IDs and the semantic demonstration, chooses analogous targets, and proposes the generalized operations. The person reviews the plan and applies it in the same editor.

This is different from DOM macro replay: DOGAGA does not record mouse coordinates or slider events. It captures meaning such as `add_visual_clip`, `set_still_duration`, or `set_clip_fade`.

It is also different from handing work to a separate MCP timeline: the human UI, agent state, Preview, and Export remain one project.

## How DOGAGA implements WebMCP

DOGAGA uses `use-webmcp-tool` to register page-native WebMCP tools.

The architecture keeps one source of truth:

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

The canonical editor state contains safe asset descriptors, video/audio tracks, clips, canvas settings, transitions, and playhead state.

The controller also owns small collaboration metadata:

- Project Brief (`Destination` + `Goal`)
- `humanDemonstration`
- reviewable `editPlan`

Local `File` objects and object URLs live only in a runtime media map and are deliberately excluded from agent-visible state.

All direct mutation tools call the same command executor used by the UI. `propose_edit_plan` validates a complete plan non-mutatingly. Human **Apply** revalidates and commits atomically; **Reject** leaves the timeline unchanged.

## Current WebMCP tools

DOGAGA exposes **23 tools**.

Core/collaboration:

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

Still-image specific:

22. `add_image_clip`
23. `set_still_duration`

Teach by Example is not a hidden extra tool. The human starts/stops teaching in the normal UI, and the completed semantic example is returned by `get_project_state`.

## Product experience

DOGAGA is intentionally compact, but the submitted app is a working editor rather than a fixed hackathon scene.

Current capabilities include:

- local video, PNG/JPEG/WebP still-image, and audio loading
- multiple video and audio tracks
- still-image display duration
- transparent PNG overlays
- clip split, trim, reorder, delete, and cross-track movement
- video playback speed
- visual clip fades
- cross dissolves
- video track opacity / visibility
- audio track mute and clip volume
- actual multi-layer browser Preview
- 16:9, 9:16, 1:1, and 4:5 canvases
- contain / cover source fitting
- browser-native composited video/audio Export and download
- Project Brief + reviewable agent suggestions
- Teach by Example semantic demonstrations

The export path uses Canvas composition, Web Audio, and MediaRecorder. Supported browsers prefer MP4 when available and otherwise fall back to WebM. Normal editing and export do not upload source media to DOGAGA servers.

## Privacy and local-first design

DOGAGA is local-first for media handling.

The browser keeps local `File` objects and object URLs in a runtime-only map. WebMCP receives safe descriptors and editing/collaboration metadata.

The agent-safe state does not contain:

- `File` objects
- `FileSystemFileHandle` values
- absolute file paths
- object URLs
- local filesystem information
- media pixels
- private Teach by Example snapshots

A completed human demonstration contains only semantic changes and safe asset/clip/track identifiers.

## Why this differs from a conventional MCP video editor

A conventional MCP integration can expose an editor through an external server, desktop process, or automation service. DOGAGA explores a different boundary: the currently open web application exposes its own semantic state and actions.

That means:

- the person stays in a normal web editor
- the agent works against the state of that same open page
- there is no separate remote MCP server for the timeline
- there is no second copy of the editing project
- manual edits are immediately part of the state the agent reads next
- a human edit can be turned into a semantic demonstration
- agent generalization remains reviewable and human-approved

The web page itself becomes the collaboration surface.

## What was built during the Challenge period

DOGAGA existed before August 25, 2026. The public repository history documents that prior work.

Challenge-period work meaningfully extended the project with WebMCP and completed the current compact production path. Major additions include:

- browser-native WebMCP shared-state architecture
- agent-safe editor state and command schemas
- real local-media Preview connected to the shared state
- Cloudflare Pages public deployment
- browser-native video export/download
- canonical multi-track state
- split, playback speed, fades, and cross-dissolves
- track opacity/visibility and multi-audio mixing
- English reviewer-facing production surface and docs
- Project Brief and non-mutating `propose_edit_plan`
- still-image support including transparent PNG overlays in Preview/Export
- WebMCP image tools
- Teach by Example semantic before/after capture
- agent-safe `humanDemonstration`
- reviewable generalization through the existing atomic Edit Plan path
- final 23-tool WebMCP surface

Relevant public history includes PRs #25, #27, #32, #33, #39, #40, #47, #55, #57, and #60.

## Known limitations

DOGAGA deliberately remains a compact editor. Current limitations include:

- no persistent project save/relink across browser sessions yet
- no arbitrary timeline gaps or drag trimming yet
- no audio playback-speed or audio fade controls yet
- no waveform editor
- no captions / lyrics workflow yet
- no advanced effects, masks, blend modes, keyframes, or Ken Burns image motion yet
- no goal of frame-perfect professional NLE precision at this stage

## Testing instructions for judges

### Recommended WebMCP path

1. Open https://dogaga.pages.dev in ChatGPT's in-app browser or Chrome with WebMCP enabled.
2. Load 3 local still images using the human UI. Media selection is intentionally human-only.
3. Add/select V2.
4. Click **Teach agent**.
5. Add one still to V2 and set an obvious treatment such as 3.00 seconds + 0.50 second fade.
6. Click **Stop teaching**.
7. Open **WebMCP & developer details** and confirm the **Human example** column shows the semantic example.
8. Ask the agent to read the current DOGAGA state.
9. Ask: **“Do the same to the other still images.”**
10. Confirm the agent creates a reviewable Edit Plan rather than mutating immediately.
11. Click **Apply**.
12. Confirm the timeline/Preview changes and optionally Export the result.

Expected WebMCP sequence:

`get_project_state → read humanDemonstration → propose_edit_plan → Human Apply`

### Without WebMCP

The manual editor, actual Preview, and Export still work in a normal supported desktop browser.

See `docs/WEBMCP_BROWSER_COMPATIBILITY.md` for environment details.

## Demo-video direction

The final <3-minute video should center the unique collaboration story rather than trying to show every editing tool:

1. Human loads local media.
2. Human teaches one visible treatment.
3. Agent reads the semantic `humanDemonstration`.
4. Human asks the agent to do the same to analogous assets.
5. Agent submits a reviewable Edit Plan.
6. Human applies it.
7. Preview / Export proves it is the real editor state.
8. Close on one-state architecture + local-first privacy.

See `docs/CHALLENGE_DEMO_VIDEO_SCRIPT.md` for the timed script.

## Final submission checklist

- [x] Final supported-host production WebMCP scenario passes
- [x] Public live URL
- [x] Public repository
- [x] MIT license visible
- [x] English README / reviewer documentation
- [x] Challenge-period work distinguishable in public history/docs
- [x] Manual production interaction QA
- [x] Still-image / transparent-PNG / mixed Export smoke
- [x] Teach by Example human capture smoke
- [ ] Replace demo-video placeholder with public YouTube URL
- [ ] Keep video under 3 minutes with clear audio
- [ ] Copy/trim this draft to the actual Devpost fields
- [ ] Save and submit before 2026-09-03 13:00 PDT / 2026-09-04 05:00 JST
- [ ] After submission/deadline, do not modify the submitted Devpost entry, repo, or live site during judging
