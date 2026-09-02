# WebMCP Browser Compatibility

Updated: 2026-09-02

DOGAGA registers standard WebMCP tools inside the page so the human UI and a browser agent can operate on the same EditorController, live editor state, and validation rules.

## Challenge testing paths

The current WebMCP Challenge rules explicitly tell entrants and judges to use either:

- the ChatGPT desktop app's in-app browser, which supports WebMCP for the Challenge; or
- Google Chrome with WebMCP enabled through `chrome://flags/#enable-webmcp-testing`.

DOGAGA therefore treats those as the submission-critical WebMCP validation paths.

The manual editor, actual Preview, and Export remain usable in supported desktop browsers even when no WebMCP consumer is present.

## Compatibility policy

DOGAGA does **not** add a Chrome-specific extension, DOM-click automation layer, or custom remote MCP server as a workaround.

WebMCP is the canonical agent interface. Human edits and WebMCP mutations use the same `EditorController` and command executor.

Compatibility rules:

- manual editing / Preview / Export must not depend on WebMCP support
- DOGAGA does not polyfill `document.modelContext`
- DOM automation is not the canonical semantic editing interface
- the same schemas and command semantics should be usable by any standards-compatible WebMCP consumer
- local `File` values, file handles, object URLs, filesystem paths, media pixels, and private Teach by Example snapshots are excluded from agent-safe state
- the human remains responsible for local file selection and for Apply / Reject of reviewable Edit Plans

## Current WebMCP surface

DOGAGA exposes **23 tools**.

Core/collaboration:

- `get_project_state`
- `propose_edit_plan`
- `add_track`
- `remove_track`
- `move_track`
- `set_track_opacity`
- `set_track_visibility`
- `set_track_mute`
- `add_clip`
- `move_clip`
- `move_clip_to_track`
- `trim_clip`
- `split_clip`
- `set_clip_speed`
- `set_clip_fade`
- `delete_clip`
- `set_audio`
- `clear_audio`
- `set_canvas`
- `add_transition`
- `remove_transition`

Still-image specific:

- `add_image_clip`
- `set_still_duration`

`get_project_state` also returns the agent-safe Project Brief, current reviewable Edit Plan, and current Teach by Example `humanDemonstration` when present.

## Path A — ChatGPT in-app browser

Final submission validation should use production/main at `https://dogaga.pages.dev`.

Recommended final scenario:

1. Load 3 still images through the human UI.
2. Create/select V2.
3. Click **Teach agent**.
4. Add one still to V2 and apply a clear treatment such as 3.00 s duration + 0.50 s fade.
5. Click **Stop teaching**.
6. Confirm developer details show the expected **Human example**.
7. Ask the agent to call `get_project_state` and confirm `humanDemonstration.status = "ready"`.
8. Ask: **“Do the same to the other still images.”**
9. Confirm the agent uses `propose_edit_plan` to generalize the example to analogous image assets.
10. Confirm the timeline has not changed before human approval.
11. Click **Apply** in DOGAGA.
12. Confirm the same live timeline/Preview changes.
13. Optionally export a short downloadable result.

Expected collaboration sequence:

```text
get_project_state
  -> read humanDemonstration
  -> infer analogous assets
propose_edit_plan
  -> app-owned Agent suggestion
Human Apply
  -> atomic revalidation + shared timeline update
```

### Production validation result — 2026-09-02

**PASS** on the production application from `main` application commit `6c49a92`, using:

`ChatGPT Desktop → Codex chat → in-app browser → https://dogaga.pages.dev`

The supported-host rehearsal confirmed:

- the page exposed all **23 WebMCP tools** and displayed `Connected · core 21/21`
- direct Site Tool calls to `get_project_state` and `propose_edit_plan` succeeded
- three generated, non-personal PNG fixtures loaded through the human-only file picker
- Teach by Example returned `humanDemonstration.status = "ready"` with one semantic `add_visual_clip` example: V2, 3.00 seconds, 0.50-second fade-in
- the agent generalized that treatment to the two analogous image assets rather than replaying the demonstrated asset ID
- `propose_edit_plan` left the timeline unchanged while the app-owned suggestion was pending
- human **Apply** produced three sequential 3.00-second V2 clips with the demonstrated fade; **Reject** and invalid-plan paths had already left state unchanged
- the shared Preview played the resulting 9-second timeline
- browser-native Export produced a downloadable 0.9 MB MP4
- returned agent-safe state contained no local file handles, object URLs, filesystem paths, media pixels, or private teaching snapshot
- no app-relevant console warnings or errors appeared during load, teaching, proposal, Apply, Preview, Export, or download

This clears the supported-host functional gate for final demo recording.

## Path B — Chrome WebMCP testing flag

For Chrome-based WebMCP testing:

1. Use a Chrome version that provides the WebMCP testing flag required by the Challenge.
2. Open:

```text
chrome://flags/#enable-webmcp-testing
```

3. Enable the flag and restart Chrome.
4. Open `https://dogaga.pages.dev`.
5. Use a WebMCP-capable consumer/test path to discover DOGAGA's registered tools.
6. Run the same semantic collaboration scenario described above.

## Normal browser fallback QA

Without a WebMCP consumer:

1. Open DOGAGA in a supported desktop browser.
2. Load real video/image/audio media.
3. Confirm manual editing and actual Preview.
4. Confirm still-image/transparent-PNG compositing where relevant.
5. Export and download a short real result.

This fallback is product functionality QA, not a substitute for the final supported-host WebMCP validation required for the Challenge.

## Submission freeze

The Challenge rules require a working live URL that judges can access during evaluation. The official resources also warn entrants not to modify the submitted Devpost entry, repository, or live site after the submission period closes and during judging.

After final submission, DOGAGA's submitted repo/live build should therefore remain frozen until the judging period ends.

## References

- WebMCP Challenge — Official Rules
  - https://webmcp.devpost.com/rules
- WebMCP Challenge — Resources / FAQ
  - https://webmcp.devpost.com/resources
- Chrome for Developers — WebMCP
  - https://developer.chrome.com/docs/ai/webmcp
- Chrome for Developers — Build WebMCP tools
  - https://developer.chrome.com/docs/ai/webmcp/build-tools
- Chrome for Developers — WebMCP tool security
  - https://developer.chrome.com/docs/ai/webmcp/secure-tools
