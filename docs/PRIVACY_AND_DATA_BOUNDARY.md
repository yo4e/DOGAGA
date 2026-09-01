# Privacy and Local-Data Boundary

Updated: 2026-09-01

This document describes the data boundary of the current public DOGAGA build. It is a technical product note, not legal advice or a substitute for a future privacy policy or terms of service.

## 1. Current principle

DOGAGA is local-first for source media.

During normal editing, preview, and export, the user's video and audio files are processed in the browser. The current public build does not upload source media to a DOGAGA server.

## 2. What stays local

When a user chooses a video or audio file, the browser keeps the original `File` and an object URL inside a runtime-only media map for the current session.

This runtime data is used for:

- media metadata probing
- video preview
- audio preview
- canvas composition
- browser-side audio mixing
- browser-native export

The current build does not provide cloud project storage or server-side rendering.

## 3. What enters editor state

The editor stores safe descriptors and editing metadata rather than the local file object itself.

Examples include:

- generated asset ID
- media kind (`video` / `audio`)
- filename as displayed to the user
- duration
- video dimensions when available
- track IDs and settings
- clip source ranges and timeline positions
- playback speed and fades
- transition settings
- canvas preset and fit mode
- playhead position

## 4. What WebMCP can read

`get_project_state` returns the agent-safe editor state used for structured collaboration.

The agent-safe state does **not** include:

- `File` objects
- `FileSystemFileHandle` values
- absolute filesystem paths
- object URLs
- local filesystem locations
- runtime-only media bindings

An agent works with safe asset IDs and editing metadata. Local file selection remains a human/browser action.

## 5. What WebMCP can change

WebMCP tools can mutate structured editing state through the same command executor used by the human UI.

They can change tracks, clips, trims, playback speed, fades, opacity, visibility, mute state, canvas settings, audio assignments, and transitions. They do not receive arbitrary local filesystem access through DOGAGA.

## 6. Export

Export happens in the browser.

Video layers are rendered into a canvas, audio is mixed with Web Audio, and the resulting stream is recorded with MediaRecorder. The browser creates the output Blob and the user downloads it locally.

The normal export path does not require uploading source media or the exported file to DOGAGA servers.

## 7. Session lifetime

The current compact production v0 does not persist the editing session across browser restarts.

Runtime `File` bindings and object URLs are session-local. Object URLs are revoked when their runtime bindings are disposed.

Persistent project save, relinking, OPFS/IndexedDB storage, cloud backup, and collaboration are future product areas and are not part of the submitted build.

## 8. External services

The current editing pipeline does not require external AI processing for source media.

If future DOGAGA features send media, lyrics, captions, or other user content to an external service, the product should disclose what is sent, why it is sent, the receiving service, and relevant retention conditions before processing. That is a future-design requirement rather than behavior of the current build.

## 9. User responsibility for media rights

DOGAGA's technical local-first boundary does not grant rights to source media. Users remain responsible for having the rights needed to edit, reproduce, export, and publish the video, audio, images, lyrics, fonts, trademarks, or other material they use.

Challenge demo material should therefore use original or clearly licensed media.

## 10. Evaluation check

A reviewer can inspect the shared state from the app's developer details or through `get_project_state` and verify that local `File` objects, object URLs, and absolute paths are absent.

The implementation is primarily visible in:

- `src/media/runtime.ts`
- `src/media/probe.ts`
- `src/editor/safeState.ts`
- `src/webmcp/handlers.ts`
- `src/export/exporter.ts`
