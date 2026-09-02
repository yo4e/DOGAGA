# DOGAGA

DOGAGA is a **lightweight, local-first video editor that runs in a desktop browser**.

Rather than recreating a full professional NLE such as Premiere Pro, DOGAGA aims to be a compact editor for making music videos, promotional videos, short-form clips, lyric videos, Spotify Canvas loops, and similar small projects quickly and without unnecessary complexity.

The WebMCP Challenge 2026 is being used as a development accelerator, but DOGAGA is not a challenge-only demo. The public app is the evolving **compact production v0**.

## Public build

- Live app: https://dogaga.pages.dev
- Repository: https://github.com/yo4e/DOGAGA
- License: MIT

The public build is deployed on Cloudflare Pages from the `main` branch.

## Current capabilities

### Editing

- Load local video, PNG/JPEG/WebP still-image, and audio files
- Multiple video tracks (V1 / V2 / ...) and audio tracks (A1 / A2 / ...)
- Add and reorder video/audio tracks
- Toggle video track visibility and set track opacity
- Mute audio tracks
- Move visual clips between video tracks
- Add, reorder, trim, and delete video clips
- Add still images as visual clips with an adjustable display duration (5 seconds by default)
- Preserve transparent PNG overlays so higher video tracks can reveal lower tracks beneath them
- Split a video clip at the current playhead position
- `⌘K` / `Ctrl+K` to split the selected video clip at the playhead
- `Shift+D` to toggle a 0.5-second cross-dissolve between the selected clip and the next clip on the same track
- Change video clip playback speed from the context menu (0.25× / 0.5× / 0.75× / 1× / 1.25× / 1.5× / 2×)
- Set clip fade-in / fade-out from the context menu (none / 0.25s / 0.5s / 1s / 2s)
- Set audio start position and volume, or remove an audio clip
- Add and remove cross-dissolves
- Multi-track timeline scaled to real time
- Playhead seeking
- Timeline zoom/density controls

Still images intentionally use display duration instead of source trim, split, or playback speed.

### Preview

- Play, pause, and seek actual local video
- Composite multiple video and still-image layers
- Preserve PNG alpha transparency in layered Preview
- Apply video track opacity and visibility immediately
- Continue playback across clip boundaries
- Reflect trim, split, speed, still duration, fade, move, and delete operations immediately
- Play multiple audio tracks simultaneously and respect mute state
- Combine clip fades and cross-dissolves through the same opacity calculation
- Project canvas presets: 16:9 / 9:16 / 1:1 / 4:5
- Source fitting: contain / cover

Higher-order video tracks are rendered above lower-order tracks. Cross-dissolves can only be created between adjacent clips on the same video track.

### Export

- Export the current multi-track video/still-image/audio project entirely in the browser
- Composite video and still-image layers, including transparent PNG overlays
- Respect video track order, opacity, and visibility
- Mix multiple audio tracks through Web Audio, including track mute and clip volume
- Respect trim, split, playback speed, still-image duration, fades, clip order, canvas preset, contain/cover, and cross-dissolves
- Browser-native `canvas.captureStream()` + Web Audio + MediaRecorder pipeline
- Prefer MP4 when supported and fall back to WebM when needed
- No server upload
- Progress, cancel, and download controls

DOGAGA currently exports the normal composited result; it does not export an alpha-channel video.

### WebMCP

The editing page itself exposes WebMCP tools.

The human UI and the browser agent operate on the **same Editor state and the same command executor**. DOGAGA does not use a separate MCP server or an agent-only timeline.

The canonical editor state is `tracks[]`. For compatibility with earlier agent workflows, the agent-safe state still includes temporary legacy views derived from V1/A1.

The current WebMCP surface has **23 tools**:

- `get_project_state`
- `propose_edit_plan`
- `add_track`
- `remove_track`
- `move_track`
- `set_track_opacity`
- `set_track_visibility`
- `set_track_mute`
- `add_clip`
- `add_image_clip`
- `move_clip`
- `move_clip_to_track`
- `trim_clip`
- `split_clip`
- `set_clip_speed`
- `set_still_duration`
- `set_clip_fade`
- `delete_clip`
- `set_audio`
- `clear_audio`
- `set_canvas`
- `add_transition`
- `remove_transition`

Existing tool behavior remains compatible: omitting `trackId` in `add_clip` targets V1, while omitting it in `set_audio` / `clear_audio` targets A1. Image assets use `add_image_clip`, and their display duration can be changed with `set_still_duration`.

DOGAGA also exposes a small agent-safe **Project Brief** (`Destination` + `Goal`). An agent can inspect that brief together with the live editor state, proactively recommend destination-aware adjustments, and submit a structured `propose_edit_plan`. The plan is shown inside DOGAGA and does not mutate the timeline until the human chooses **Apply**. Apply revalidates the whole plan and commits it atomically through the same editor executor; Reject leaves the timeline untouched.

In a WebMCP-capable environment, a human can load local media, an agent can inspect the shared state and propose or perform edits, the human can make a manual correction, and the agent can re-read the same live state and continue editing.

See [Destination-aware agent collaboration](docs/AGENT_COLLABORATION.md) and [Still-image support](docs/STILL_IMAGE_SUPPORT.md).

## Privacy / local-first design

Source video, still images, and audio are not uploaded to a server during normal editing or export.

The browser runtime keeps `File` objects and object URLs during the current session, but these are excluded from the Editor state exposed through WebMCP.

The agent-safe state does not include:

- `File`
- FileSystemFileHandle
- absolute paths
- object URLs
- local filesystem information

Image assets are exposed only as safe descriptors such as asset ID, kind, name, duration, and dimensions.

See [Privacy and local-data boundary](docs/PRIVACY_AND_DATA_BOUNDARY.md) for the current technical data boundary.

## Browser support

- Desktop Chrome is the primary reference environment for the manual editor, Preview, and Export
- As of 2026-08-30, OpenAI Site Tools are available in the ChatGPT desktop app's built-in browser
- As of 2026-08-30, OpenAI Site Tools are not yet available in normal Chrome
- Chrome's own WebMCP implementation can be tested through the Chrome 149+ origin trial or local testing flag
- Browsers without WebMCP support can still use the manual editor, actual Preview, and Export

The Codex Chrome extension can operate an existing Chrome profile/session/tabs as a browser-control path, but that is separate from current Chrome Site Tools support. DOGAGA keeps a standard WebMCP tool contract rather than depending on Chrome-specific automation or a custom extension.

See [WebMCP browser compatibility](docs/WEBMCP_BROWSER_COMPATIBILITY.md) for details and validation steps.

## Local development

Node.js 22 is recommended.

After a fresh clone, use `npm ci` so dependencies match the lockfile exactly.

```bash
git clone https://github.com/yo4e/DOGAGA.git
cd DOGAGA
npm ci
npm run dev
```

Validation:

```bash
npm run typecheck
npm test
npm run build
```

The production build output is `dist/`.

GitHub Actions uses the same clean-checkout + Node.js 22 + `npm ci` validation path.

## Current limitations / next priorities

Compact production v0 intentionally limits scope. Major current limitations include:

- No persistent editing sessions or media relinking yet
- No video/audio track lock UI yet
- No audio clip fade or playback-speed controls yet
- No arbitrary clip positioning, gaps, or drag trimming yet
- No waveform, lyrics, captions, or advanced effects yet
- Still images do not yet have image-specific motion/effects such as Ken Burns animation
- Frame-perfect professional NLE precision is not a goal for this version

The immediate priority is to keep the current production surface stable while finishing real-browser/WebMCP submission QA and documentation. Larger editing features can continue after the Challenge freeze.

## WebMCP Challenge 2026

DOGAGA existed before 2026-08-25. During the Challenge period, the existing project has been meaningfully extended with browser-native WebMCP collaborative editing, destination-aware human approval of agent edit proposals, and the compact editor v0.

The submission uses the public DOGAGA app itself rather than a separate fixed demo application.

A public demo video under three minutes will be prepared separately for the Challenge submission.

## Long-term vision

The long-term goal is a browser-only workflow that can handle:

> Place a song, arrange footage and stills, synchronize lyrics, style text, apply a small amount of processing, and export for the intended destination.

DOGAGA is not intended to become an all-purpose professional editor. The goal is a small editor with enough power for music-centered video work.

## Documentation for reviewers

For the current public build and WebMCP Challenge evaluation, use these English documents:

- [Documentation guide](docs/README.md)
- [Current architecture](docs/ARCHITECTURE.md)
- [Destination-aware agent collaboration](docs/AGENT_COLLABORATION.md)
- [Still-image support](docs/STILL_IMAGE_SUPPORT.md)
- [WebMCP browser compatibility](docs/WEBMCP_BROWSER_COMPATIBILITY.md)
- [Privacy and local-data boundary](docs/PRIVACY_AND_DATA_BOUNDARY.md)
- [Devpost submission draft](docs/DEVPOST_SUBMISSION_DRAFT.md)
- [Challenge demo video script](docs/CHALLENGE_DEMO_VIDEO_SCRIPT.md)

The repository intentionally retains older Japanese design notes, research, ADRs, and Issue history as development history. Some of those files describe earlier stages or future features and are not the primary documentation for the current submitted build.