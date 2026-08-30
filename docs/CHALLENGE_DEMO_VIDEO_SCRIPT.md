# WebMCP Challenge — Demo Video Script

Target: **2:40–2:55 total**

Requirement: public YouTube, under 3 minutes, with audio. Use only media you own or are authorized to use. Do not add copyrighted background music just for the submission video.

This script uses the real production app at https://dogaga.pages.dev. Do not create a challenge-only flow.

## Before recording

Prepare:

- 2–3 short video files you own
- 1 short audio file you own, optional but recommended
- ChatGPT in-app browser with Site Tools / WebMCP available
- DOGAGA open at `https://dogaga.pages.dev`
- browser zoom / window size set so timeline, preview, and agent actions remain readable
- notifications hidden
- no personal filenames, account information, unrelated tabs, or private media visible

Keep the project simple enough that the visual result is obvious after each agent action.

## Recording plan

### 0:00–0:15 — What DOGAGA is

**Screen**

Open DOGAGA. Briefly show the editor and empty timeline.

**Narration**

> DOGAGA is a local-first browser video editor where a person and an agent edit the same live timeline. Instead of giving the agent a separate editing backend, the page exposes its real editor actions through WebMCP.

### 0:15–0:30 — Human loads local media

**Screen**

Use the normal file pickers to load your video clips and optional audio. Add at least one video to V1.

**Narration**

> I start as a normal user by choosing local video and audio. The source files stay in my browser. DOGAGA does not expose local file handles or object URLs to the agent.

### 0:30–0:45 — Agent reads the same project

**Screen / agent request**

Ask:

> Read the current DOGAGA project state and summarize the loaded assets and timeline.

The agent should use `get_project_state`.

**Narration**

> The agent reads a structured, agent-safe version of the same project state that powers the UI.

### 0:45–1:30 — Agent performs real multi-track edits

**Screen / agent request**

Ask something close to:

> Add a second video track. Add another loaded clip, move it to V2, set V2 opacity to 55 percent, split the main clip near the playhead, make one clip 1.5x speed, add a short fade, and add a cross dissolve where valid. Keep the current canvas.

Use a request that fits the actual loaded asset IDs/state; the agent may choose the exact valid clip IDs and transition boundary.

Aim to visibly exercise several of:

- `add_track`
- `add_clip`
- `move_clip_to_track`
- `set_track_opacity`
- `split_clip`
- `set_clip_speed`
- `set_clip_fade`
- `add_transition`

**Narration**

> These are not DOM-click macros. WebMCP exposes semantic editing tools. Each tool goes through the same EditorController and validation used by the human interface, so the timeline and real preview update immediately.

### 1:30–1:50 — Human corrects the agent

**Screen**

Preview the result. Manually change one visible setting, for example:

- adjust V2 opacity with the track slider, or
- change a clip speed/fade from the right-click menu, or
- move the playhead and split with Cmd or Ctrl K.

**Narration**

> I can take over at any moment. Here I make a manual correction in the same editor. There is no separate agent copy of the timeline to synchronize.

### 1:50–2:10 — Agent re-reads human changes

**Screen / agent request**

Ask:

> Read the project again. Tell me what changed, then make one small follow-up edit without undoing my manual change.

The agent should call `get_project_state` again and then one mutation tool.

**Narration**

> Now the agent reads the project again and sees my latest manual state before continuing. That human-to-agent-to-human-to-agent loop is the core WebMCP experience in DOGAGA.

### 2:10–2:30 — Export the real result

**Screen**

Click **動画を書き出す / Export video**. Show progress briefly, then show the download result. If recording time is tight, use short source clips so export finishes quickly.

**Narration**

> This is a real editor, not a fixed demo. The same multi-track state is composited in the browser and exported as a downloadable video using Canvas, Web Audio, and MediaRecorder.

### 2:30–2:50 — Architecture and privacy close

**Screen**

Briefly show the Agent-safe state panel or a simple repository architecture view. End on the live app or repository.

**Narration**

> DOGAGA exposes twenty WebMCP tools directly from the open page. Human UI and agent tools share one command executor, while local media stays runtime-only in the browser. It is a compact production editor built around a simple idea: the web page itself can be the collaboration surface for people and agents.

### 2:50–2:55 — End card

**Screen**

Show:

- DOGAGA
- `dogaga.pages.dev`
- `github.com/yo4e/DOGAGA`

No extra narration is required.

## Recommended agent prompts for recording

Keep prompts natural; do not narrate raw tool JSON.

### State read

> Read the current DOGAGA project state. Briefly summarize the loaded assets, tracks, clips, and canvas before editing anything.

### Main editing request

> Please turn this into a simple two-layer edit. Add V2, put a suitable loaded video clip on it, set V2 opacity to about 55%, split or trim the V1 material where useful, change one clip to 1.5x speed, add a short fade, and add a cross dissolve only where DOGAGA says it is valid. Then read the state again and summarize what you changed.

### After human correction

> Read the project again. Preserve the manual change I just made, then make one small follow-up improvement using the current state.

## If a tool call fails during recording

Do not hide a genuine validation failure if it is quick to understand. A useful recovery can demonstrate that DOGAGA has semantic constraints.

For example:

> That dissolve is not valid because the clips are not adjacent on the same video track. Find a valid adjacent boundary and try again.

However, avoid spending the video debugging. Rehearse the asset/timeline setup once before the final recording.

## Final video checks

- [ ] Total duration is under 3:00; target under 2:55
- [ ] Audio is clearly audible
- [ ] English narration or a complete English translation is present
- [ ] DOGAGA visibly functions, not just slides/screenshots
- [ ] WebMCP agent action is clearly visible
- [ ] Human manual edit is clearly visible
- [ ] Agent re-read after human edit is shown
- [ ] Export/download is shown
- [ ] No unauthorized music, footage, trademarks, or private data
- [ ] YouTube visibility is Public
- [ ] Final YouTube URL is copied into `docs/DEVPOST_SUBMISSION_DRAFT.md` and Devpost
