# Destination-aware agent collaboration

DOGAGA's WebMCP surface can expose more than editing commands. It also exposes a small, agent-safe **Project Brief** so an agent can understand the intended destination of the current edit and make useful recommendations against the live timeline state.

## Project Brief

The human can choose a destination and goal in the DOGAGA header, for example:

- Spotify Canvas + Promotional loop
- YouTube Shorts + Vertical short
- Instagram Reel + Vertical short
- TikTok + Vertical short
- Music video + Music-centered

`get_project_state` returns this brief together with the existing canvas, assets, tracks, clips, transitions, playhead, and duration.

No local `File`, object URL, filesystem path, or file handle is added to the agent-visible state.

## Proactive recommendation flow

A WebMCP agent should first call `get_project_state`.

When the Project Brief is specific, the tool description encourages the agent to compare the destination / goal with the live editor state and proactively explain useful adjustments. Example:

> This is a Spotify Canvas project. The current canvas is landscape and the visual sequence is longer than a short loop. I recommend switching to a vertical canvas and simplifying the sequence.

The agent can then use `propose_edit_plan` instead of immediately changing the timeline.

## `propose_edit_plan`

`propose_edit_plan` accepts a short title, a reason, and 1–8 structured operations. The current first slice supports:

- `set_canvas`
- `set_track_opacity`
- `set_track_visibility`
- `set_track_mute`
- `move_clip`
- `move_clip_to_track`
- `trim_clip`
- `set_clip_speed`
- `set_clip_fade`

The proposal is validated against the **current** editor state by running the same command executor used by the human UI and normal WebMCP mutation tools. Validation is non-mutating.

If validation succeeds, DOGAGA shows an app-owned **Agent suggestion** card containing the reason and human-readable operation list.

## Human approval

A pending plan does not edit the timeline.

The human chooses:

- **Apply** — DOGAGA revalidates the complete plan against the current live state, then commits the full result only if every operation succeeds.
- **Reject** — the timeline remains unchanged.

Apply is intentionally a human UI action, not an agent-callable approval tool.

Revalidation is atomic: if the project changed after the proposal and any operation is now invalid, DOGAGA does not partially apply the earlier operations.

After Apply or Reject, `get_project_state` exposes the plan status so the agent can re-read the same shared state and continue from the human decision.

## Example

A human selects:

```text
Destination: Spotify Canvas
Goal: Promotional loop
```

The agent reads the project and may submit:

```json
{
  "title": "Prepare a vertical layered loop",
  "reason": "The project is intended for Spotify Canvas, but the current edit is landscape.",
  "operations": [
    { "type": "set_canvas", "preset": "portrait", "fitMode": "cover" },
    { "type": "move_clip_to_track", "clipId": "clip-...", "trackId": "video-track-..." },
    { "type": "set_track_opacity", "trackId": "video-track-...", "opacity": 0.65 },
    { "type": "set_clip_fade", "clipId": "clip-...", "fadeInUs": 500000, "fadeOutUs": 500000 }
  ]
}
```

The proposal appears in DOGAGA for review. The human remains in control of whether those edits become part of the canonical timeline.

## Design boundary

The Project Brief and review plan are collaboration metadata owned by the same `EditorController`, but they are kept separate from the media timeline model. This prevents review workflow metadata from changing Preview / Export semantics while still keeping the human UI and WebMCP agent synchronized through one controller and one subscription path.
