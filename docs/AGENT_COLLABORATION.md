# Human–agent collaboration in DOGAGA

Updated: 2026-09-02

DOGAGA uses WebMCP as a page-native collaboration surface. The human editor UI and the WebMCP agent operate on the same `EditorController`, the same canonical timeline state, and the same validation rules.

The final Challenge story is:

> **Human teaches → DOGAGA captures semantic meaning → Agent generalizes → Human approves**

This builds on DOGAGA's destination-aware Project Brief and reviewable Edit Plan flow.

## Shared state, not a second editor

`get_project_state` returns the current agent-safe project state, including:

- Project Brief (`Destination` + `Goal`)
- loaded safe asset descriptors
- visual/audio tracks and clips
- canvas, transitions, playhead, and duration
- any current `humanDemonstration`
- any current reviewable `editPlan`

The human UI and WebMCP do not maintain separate timelines. A manual edit is immediately part of the state the agent reads next.

Local `File` objects, file handles, object URLs, filesystem paths, and media pixels are never added to the agent-safe state.

## 1. Project Brief

The human can choose a destination and goal, for example:

- Spotify Canvas + Promotional loop
- YouTube Shorts + Vertical short
- Instagram Reel + Vertical short
- TikTok + Vertical short
- Music video + Music-centered

An agent can compare that intent with the current project and explain useful adjustments before proposing them.

## 2. Teach by Example

Teach by Example lets the person demonstrate an editing treatment through the normal DOGAGA UI.

1. Click **Teach agent** in the Media rail.
2. Edit normally.
3. Click **Stop teaching**.
4. DOGAGA compares the before/after editor state and records only supported semantic changes.
5. `get_project_state` exposes the completed example as `humanDemonstration`.

DOGAGA records semantic editing meaning rather than mouse movements or slider-event streams.

Supported demonstration changes include:

- adding a loaded video/image to a video track (`add_visual_clip`)
- canvas preset / fit mode
- video-track opacity / visibility
- audio-track mute
- visual-clip move between tracks
- unambiguous same-track reorder
- video playback speed
- still-image display duration
- visual-clip fade in/out

For a newly added still image, final demonstrated duration and fades are folded into the same `add_visual_clip` semantic change. A demonstration such as “add this still to V2, make it 3 seconds, give it a 0.5 second fade” therefore remains one useful example.

Unsupported or ambiguous differences are omitted rather than guessed. If no supported semantic change was made, DOGAGA records an explicit empty example with guidance for the person.

The developer details panel shows the same result in a human-readable **Human example** column.

## 3. Agent generalization

A ready `humanDemonstration` is an example, not a macro and not an instruction to replay IDs blindly.

The `get_project_state` tool description explicitly tells the agent to infer analogous targets from the current live assets/clips. For example, after the human demonstrates a treatment on one loaded still image, the user can ask:

> Do the same to the other still images.

The agent should map that treatment onto the analogous current assets and submit a reviewable `propose_edit_plan`.

A demonstrated `add_visual_clip` means the human intentionally added a loaded visual asset to a particular kind of track with the captured duration/speed/fades. Generalization should use other analogous assets, not replay the original asset ID.

## 4. `propose_edit_plan`

`propose_edit_plan` accepts a short title, a reason, and 1–8 structured operations. It is deliberately **non-mutating**.

The current plan operation surface includes:

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

The complete proposal is validated against the current editor state using the same command executor as the human UI and direct WebMCP editing tools.

If validation succeeds, DOGAGA shows an app-owned **Agent suggestion** card with the reason and human-readable operations.

## 5. Human approval

A pending plan never edits the timeline by itself.

The person chooses:

- **Apply** — DOGAGA revalidates the complete plan against the current live state and atomically commits it only if every operation is still valid.
- **Reject** — the timeline remains unchanged.

Apply is intentionally a human UI action, not an agent-callable approval tool.

After Apply or Reject, the decision is reflected in shared collaboration state so the agent can re-read the project and continue from the human decision.

## Final Challenge validation scenario

Use the production app at `https://dogaga.pages.dev` in a supported WebMCP host.

Recommended flow:

1. Human loads 3 still images (PNG/JPEG/WebP); transparent PNG is useful for a visible layered result.
2. Human creates or selects V2.
3. Human clicks **Teach agent**.
4. Human adds one still to V2 and gives it an obvious treatment, for example 3.00 s duration + 0.50 s fade.
5. Human clicks **Stop teaching**.
6. Human opens **WebMCP & developer details** and confirms **Human example** says `Example recorded` with the expected semantic change.
7. Agent calls `get_project_state` and confirms `humanDemonstration.status = "ready"`.
8. User asks: **“Do the same to the other still images.”**
9. Agent calls `propose_edit_plan`, mapping the demonstrated treatment to the other analogous image assets.
10. DOGAGA shows the reviewable Agent suggestion without changing the timeline.
11. Human clicks **Apply**.
12. Human previews the result and optionally exports a short downloadable video.
13. Agent can call `get_project_state` again to confirm the approved live state.

This scenario demonstrates the full collaboration loop without a challenge-only demo path:

> **Human intent → semantic demonstration → WebMCP state read → agent generalization → human approval → shared live timeline**

## Safety boundary

Teach by Example does **not** introduce:

- screen recording
- a generic macro engine
- hidden background AI
- automatic replay
- automatic approval
- media-pixel transfer to the agent
- local file handles, object URLs, or filesystem paths in WebMCP state

The private before-snapshot used to compute the example remains inside the controller and is not returned by `get_project_state`.

## Why this is specifically useful for WebMCP

A conventional automation layer can click UI controls, and a remote MCP server can expose an editor backend. DOGAGA explores a different boundary: the currently open web page exposes semantic editing state and actions directly while the person keeps the normal visual editor.

That makes a demonstrated human edit legible to the agent as structured meaning, while the generalized result remains reviewable in the same page before it affects the canonical timeline.
