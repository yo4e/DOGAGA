# Still-image support

DOGAGA can use PNG, JPEG, and WebP files as visual assets on the same V1 / V2 / ... tracks used by video clips.

## Current behavior

- Local PNG, JPEG, and WebP files can be loaded from the Media panel or by drag and drop.
- A new still-image clip defaults to 5 seconds.
- The display duration can be changed from the selected-clip inspector or through WebMCP.
- Still-image clips can be reordered and moved between video tracks.
- Video-track opacity and visibility apply to image clips.
- Clip fade-in / fade-out and cross-dissolves use the same timeline opacity calculation as video clips.
- Canvas presets and contain / cover source fitting apply to images.
- PNG alpha transparency is preserved in Preview and when compositing the final export, so a transparent overlay on V2 can reveal V1 beneath it.
- Browser export composites image frames through the same Canvas pipeline used for video layers.

## Intentional differences from video clips

A still image has display duration, but it does not have meaningful source time or playback speed. DOGAGA therefore does not expose source trim, split, or playback-speed operations for image clips. Change the still duration instead.

The current duration range is 0.1 to 600 seconds.

## WebMCP

Two image-specific tools complement the existing visual editing tools:

- `add_image_clip` — add a loaded image Asset to a video track, optionally with a custom duration.
- `set_still_duration` — change the display duration of an existing image clip.

`get_project_state` exposes image Assets as safe descriptors with `kind: "image"`; local `File` objects, object URLs, and filesystem paths remain excluded.

After an image clip exists, the existing track-move, track-opacity, track-visibility, fade, transition, move, and delete tools continue to operate on the same canonical editor state.

## Export boundary

Transparent PNG overlays are supported inside a normal DOGAGA composition. DOGAGA does not currently export an alpha-channel video: the final encoded video has the normal project background/composited result.