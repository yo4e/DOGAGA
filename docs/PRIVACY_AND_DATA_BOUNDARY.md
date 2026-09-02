# Privacy and Local-Data Boundary

Updated: 2026-09-02

This document describes the data boundary of the current public DOGAGA build. It is a technical product note, not legal advice or a substitute for a future privacy policy or terms of service.

## 1. Current principle

DOGAGA is local-first for source media.

During normal editing, Preview, Teach by Example, and Export, the user's video, still-image, and audio files are processed in the browser. The current public build does not upload source media to a DOGAGA server.

## 2. What stays local

When a user chooses a video, PNG/JPEG/WebP image, or audio file, the browser keeps the original `File` and an object URL inside a runtime-only media map for the current session.

This runtime data is used for:

- media metadata probing
- video/image Preview
- audio Preview
- canvas composition
- browser-side audio mixing
- browser-native Export

The current build does not provide cloud project storage or server-side rendering.

## 3. What enters editor state

The editor stores safe descriptors and editing metadata rather than local file objects.

Examples include:

- generated asset ID
- media kind (`video` / `image` / `audio`)
- filename as displayed to the user
- duration / still-image display duration
- dimensions when available
- track IDs and settings
- clip source ranges / timeline order
- playback speed and fades
- transition settings
- canvas preset and fit mode
- playhead position

## 4. What WebMCP can read

`get_project_state` returns the agent-safe editor and collaboration state used for structured collaboration.

The agent-safe state does **not** include:

- `File` objects
- `FileSystemFileHandle` values
- absolute filesystem paths
- object URLs
- local filesystem locations
- runtime-only media bindings
- media pixels
- the private Teach by Example before-snapshot

An agent works with safe asset IDs and editing metadata. Local file selection remains a human/browser action.

The agent-safe collaboration state may include:

- Project Brief destination / goal
- current Edit Plan and its review status
- completed semantic `humanDemonstration`

## 5. Teach by Example boundary

When the human clicks **Teach agent**, DOGAGA snapshots editor state privately inside the controller.

When teaching stops, DOGAGA computes supported semantic before/after changes. Examples include:

- add a loaded visual to a track
- move/reorder a clip
- change still duration
- change video speed
- change visual fades
- change track opacity / visibility
- mute/unmute an audio track
- change canvas settings

Only the resulting semantic example is exposed through `get_project_state`. The private snapshot itself is not returned.

Teach by Example does not record the screen, mouse coordinates, keyboard event streams, media pixels, or local file handles.

## 6. What WebMCP can change

Direct WebMCP editing tools can mutate structured editor state through the same command executor used by the human UI.

They can change tracks, clips, trims, playback speed, still duration, fades, opacity, visibility, mute state, canvas settings, audio assignments, and transitions. They do not receive arbitrary local filesystem access through DOGAGA.

`propose_edit_plan` is deliberately non-mutating. It validates a structured multi-step proposal, then shows it to the human inside DOGAGA.

Human **Apply** revalidates and commits the complete plan atomically. **Reject** leaves the timeline unchanged. The agent cannot call Apply/Reject through DOGAGA's WebMCP surface.

## 7. Export

Export happens in the browser.

Visual layers are rendered into a canvas, audio is mixed with Web Audio, and the resulting stream is recorded with MediaRecorder. The browser creates the output Blob and the user downloads it locally.

The normal Export path does not require uploading source media or the exported file to DOGAGA servers.

## 8. Session lifetime

Compact production v0 does not persist the editing session across browser restarts.

Runtime `File` bindings and object URLs are session-local. Object URLs are revoked when their runtime bindings are disposed.

Persistent project save, relinking, OPFS/IndexedDB storage, cloud backup, and remote collaboration are future product areas and are not part of the submitted build.

## 9. External services

The current editing pipeline does not require external AI processing for source media.

The external agent can receive only the WebMCP-safe structured state described above. DOGAGA itself does not send source-media bytes to an AI service as part of editing, Teach by Example, Preview, or Export.

If future DOGAGA features send media, lyrics, captions, or other user content to an external service, the product should disclose what is sent, why it is sent, the receiving service, and relevant retention conditions before processing.

## 10. User responsibility for media rights

DOGAGA's technical local-first boundary does not grant rights to source media. Users remain responsible for having the rights needed to edit, reproduce, export, and publish the video, audio, images, lyrics, fonts, trademarks, or other material they use.

Challenge demo material should therefore use original or clearly licensed media.

## 11. Evaluation check

A reviewer can inspect developer details or call `get_project_state` and verify that local `File` objects, object URLs, absolute paths, media pixels, and private teaching snapshots are absent.

The final Challenge test can additionally confirm that a semantic `humanDemonstration` is visible while the underlying local media remains runtime-only.

Relevant implementation areas include:

- `src/media/runtime.ts`
- `src/media/probe.ts`
- `src/editor/controller.ts`
- `src/editor/collaboration.ts`
- `src/editor/safeState.ts`
- `src/webmcp/WebMCPTools.tsx`
- `src/webmcp/StillImageWebMCPTools.tsx`
- `src/export/exporter.ts`
