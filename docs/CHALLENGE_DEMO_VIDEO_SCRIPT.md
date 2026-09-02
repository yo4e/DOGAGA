# WebMCP Challenge — Demo Video Script

Updated: 2026-09-02

Target: **2:35–2:50 total**

Requirement: public YouTube, under 3 minutes, with clear audio. Use only media you own or are authorized to use. Do not add copyrighted background music or third-party trademarks just for the submission.

This script uses the real production app at https://dogaga.pages.dev. Do not create a challenge-only demo path.

## Core story

> **Human teaches → DOGAGA captures semantic meaning → Agent generalizes → Human approves**

The video should make this collaboration loop obvious. Do not try to show all 23 tools.

## Before recording

Prepare:

- 3 still images you own or are authorized to use; visually distinct images make generalization easy to see
- at least one transparent PNG if available, so layered compositing is obvious
- optionally one very short video/audio file if you want a richer Preview, but still images are enough for the core story
- ChatGPT in-app browser or Chrome with WebMCP enabled
- DOGAGA open at `https://dogaga.pages.dev`
- browser zoom/window size that keeps the Media rail, Preview, Timeline, and agent/tool activity readable
- notifications hidden
- no personal filenames, account information, unrelated tabs, or private media visible

Use short assets so Export finishes quickly.

## Rehearsal state

Before the final take, rehearse once so the prompt maps cleanly to the loaded assets.

Suggested setup:

1. Load 3 still images.
2. Create V2 if needed.
3. Keep the timeline otherwise simple.
4. Use a clear demonstrated treatment: **add first still to V2 → 3.00 s duration → 0.50 s fade**.
5. Confirm the other two image assets remain loaded but not yet treated.

The final take should begin from a clean/reloaded state, not from the completed rehearsal project.

## Recording plan

### 0:00–0:15 — Pitch

**Screen**

Open DOGAGA and briefly show the editor.

**Narration**

> DOGAGA is a local-first browser video editor where a person and an agent work on the same live timeline through WebMCP. The key idea is simple: I can teach an editing treatment by doing it once, the agent can generalize it, and I still approve the result.

### 0:15–0:30 — Human loads local media

**Screen**

Load the 3 still images with the normal Media controls. Create/select V2 if necessary.

**Narration**

> I start normally by choosing local media. These source files stay in my browser. DOGAGA exposes safe asset metadata to the agent, but not file handles, local paths, object URLs, or media pixels.

### 0:30–0:58 — Human teaches by example

**Screen**

1. Click **Teach agent**.
2. Add one still image to V2.
3. Set its duration to about **3.00 s**.
4. Set a **0.50 s fade**.
5. Click **Stop teaching**.
6. Open **WebMCP & developer details** and briefly show the **Human example** column.

Expected human-readable example should make the intent obvious, such as adding the image to V2 with its demonstrated duration/fade.

**Narration**

> I click Teach agent and edit normally. DOGAGA does not record mouse coordinates or slider events. It compares the editor before and after and captures supported semantic changes—here, adding a still to V2 with a specific duration and fade.

### 0:58–1:18 — Agent reads semantic state

**Screen / agent request**

Ask:

> Read the current DOGAGA project state. Briefly tell me what human example I just demonstrated and what other analogous still-image assets are available. Do not edit anything yet.

The agent should call `get_project_state` and recognize `humanDemonstration.status = ready`.

**Narration**

> Through WebMCP, the agent reads the same live project plus the semantic human demonstration. It can understand the treatment without seeing my local files or replaying UI events.

### 1:18–1:48 — Agent generalizes with a reviewable plan

**Screen / agent request**

Ask:

> Do the same to the other still images. Generalize the example to the analogous loaded image assets, but use DOGAGA's reviewable edit plan so I can approve it before anything changes.

The agent should call `propose_edit_plan` and create `add_visual_clip` operations for the other images with the demonstrated treatment.

Show the app-owned **Agent suggestion** card.

**Narration**

> Now I ask the agent to do the same to the other stills. It maps the example to analogous assets and submits a structured Edit Plan. The proposal is validated, but the timeline has not changed yet.

### 1:48–2:05 — Human approves

**Screen**

Click **Apply**. Show the new still clips appearing in the timeline and the Preview updating.

If the visual result is clearer with track opacity or a transparent PNG overlay, briefly play/seek the Preview.

**Narration**

> DOGAGA does not let the agent approve its own generalization. I choose Apply, the whole plan is revalidated and committed atomically, and the same live timeline and Preview update immediately.

### 2:05–2:25 — Prove it is the real editor

**Screen**

Preview briefly, then click **Export video**. Show export progress and the download becoming available. Keep the project short enough that this finishes quickly.

**Narration**

> This is the real editor state, not a fixed demo. DOGAGA composites the project in the browser and exports a downloadable video with Canvas, Web Audio, and MediaRecorder.

### 2:25–2:43 — Architecture / privacy close

**Screen**

Briefly show developer details, README architecture diagram, or the live app with the WebMCP status visible.

**Narration**

> DOGAGA exposes 23 WebMCP tools directly from the open page. Human editing, agent tools, Preview, and Export share one EditorController, while local media stays runtime-only. WebMCP turns the page itself into the collaboration surface.

### 2:43–2:50 — End card

**Screen**

Show:

- DOGAGA
- `dogaga.pages.dev`
- `github.com/yo4e/DOGAGA`

No extra narration is required.

## Exact recording prompts

Keep the prompts natural. Do not narrate raw JSON.

### Read the demonstration

> Read the current DOGAGA project state. Briefly tell me what human example I just demonstrated and what other analogous still-image assets are available. Do not edit anything yet.

### Generalize with human review

> Do the same to the other still images. Generalize the example to the analogous loaded image assets, but use DOGAGA's reviewable edit plan so I can approve it before anything changes.

### Optional post-Apply confirmation

If time allows, after Apply ask:

> Read the DOGAGA state again and confirm that the approved generalized edits are now part of the live timeline.

Do not include this if it pushes the video near 3:00.

## Expected WebMCP sequence

The important tool sequence is:

```text
get_project_state
  -> reads humanDemonstration
  -> agent infers analogous image assets
propose_edit_plan
  -> DOGAGA shows Agent suggestion
Human clicks Apply
  -> atomic revalidation + commit
```

The video does not need to exercise all 23 tools. The goal is to show a distinctive, real WebMCP collaboration loop clearly.

## What the final supported-host rehearsal must confirm

Before recording the final take, verify on production/main:

- `get_project_state` returns `humanDemonstration.status = "ready"`
- the demonstration contains the expected semantic change(s)
- the agent identifies the other image assets rather than replaying the original asset ID
- the agent uses `propose_edit_plan` for the generalized multi-step edit
- the timeline does not change before human Apply
- the app-owned Agent suggestion is readable
- Apply changes the same live timeline/Preview
- Reject would leave the timeline untouched (this does not need to be shown in the video)
- local File handles / object URLs / paths are absent from agent-visible state

## If a tool call fails during recording

Do not spend the submission video debugging.

If the failure is a simple semantic validation message, one short recovery is acceptable. Otherwise restart the take using the rehearsed asset setup.

The safest final demo is deliberately narrow: one human example, one state read, one generalized review plan, one human Apply, one short Export.

## Final video checks

- [ ] Total duration is under 3:00; target 2:35–2:50
- [ ] Audio is clearly audible
- [ ] English narration is present
- [ ] DOGAGA visibly functions, not just slides/screenshots
- [ ] Human **Teach agent → Stop teaching** is visible
- [ ] **Human example** semantic result is visible
- [ ] WebMCP agent calls/uses `get_project_state`
- [ ] Agent generalization produces a reviewable Edit Plan
- [ ] Timeline remains unchanged before Apply
- [ ] Human **Apply** is visible
- [ ] Shared timeline/Preview changes after Apply
- [ ] Real Export/download is shown
- [ ] No unauthorized music, footage, trademarks, or private data
- [ ] YouTube visibility is Public
- [ ] Final YouTube URL is copied into `docs/DEVPOST_SUBMISSION_DRAFT.md` and Devpost
