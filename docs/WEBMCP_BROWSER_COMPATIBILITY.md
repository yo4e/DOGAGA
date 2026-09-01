# WebMCP Browser Compatibility

Updated: 2026-08-30

DOGAGA registers standard WebMCP tools inside the page so the human UI and a browser agent can operate on the same Editor state and command executor.

This document records the current differences between the ChatGPT desktop built-in browser, normal Chrome, Chrome's WebMCP testing paths, and Chrome-extension agents, along with DOGAGA's compatibility policy.

## Conclusion

DOGAGA does **not** add a Chrome-specific extension or a custom remote MCP server as a workaround.

WebMCP remains the canonical tool interface. The same tool contract should be reusable when a browser, extension, or embedded agent implements WebMCP.

As of 2026-08-30, OpenAI Site Tools are available in the ChatGPT desktop app's built-in browser, but are not yet available as Site Tools in normal Chrome.

Chrome itself is implementing WebMCP as a proposed web standard. Chrome 149+ can test it through an origin trial or a local testing flag. Chrome's documentation also describes WebMCP tools as usable by agents in browsers, extensions, and sites.

The main missing piece for DOGAGA is therefore the **consumer-side support and validation path**, not a vendor-specific backend inside DOGAGA.

## Current access paths

| Path | DOGAGA manual UI | DOGAGA WebMCP tools | Notes |
| --- | --- | --- | --- |
| ChatGPT desktop built-in browser | ✅ | ✅ when Site Tools are available | Current official OpenAI Site Tools path |
| Normal Chrome | ✅ | Depends on browser capability | Manual editor / preview / export work without WebMCP |
| Chrome WebMCP testing flag | ✅ | ✅ experimental platform API | `chrome://flags/#enable-webmcp-testing` |
| Chrome WebMCP origin trial | ✅ | ✅ when the origin joins the trial | Chrome 149+ public-testing path |
| Codex Chrome extension | ✅ browser control | Not currently exposed as Site Tools | Uses the existing Chrome profile/session/tabs; current OpenAI Site Tools are not available in Chrome |
| WebMCP-capable extension agent | ✅ | ✅ intended standards path | Chrome's WebMCP documentation includes extension agents |

## DOGAGA implementation compatibility

DOGAGA uses `use-webmcp-tool` to register tools with the page lifecycle.

Current 20 tools:

- `get_project_state`
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

### Compatibility rules

- The manual editor, preview, and export must remain usable in browsers without WebMCP.
- DOGAGA does not polyfill `document.modelContext`.
- Chrome-specific DOM automation is not the canonical tool interface.
- The same schema and command semantics should work whether the WebMCP consumer is in a browser, extension, or embedded agent.
- Local `File` values, object URLs, and filesystem paths are excluded from agent-safe state.
- Track, clip, and transition mutations use the same `EditorController` / executor as the human UI.

## Current OpenAI path

According to OpenAI Help Center information updated on 2026-08-29, Site Tools are available in the ChatGPT desktop app's built-in browser and are not currently available in Chrome.

The Codex Chrome extension is described as a browser-work path that can use an existing Chrome profile, cookies, signed-in session, open tabs, and Chrome extensions. That does not mean structured Site Tools / WebMCP discovery is currently available through Chrome.

Therefore, direct DOGAGA WebMCP calls from the ChatGPT/Codex Chrome extension cannot be completed by DOGAGA alone until the OpenAI consumer side provides Chrome Site Tools/WebMCP support.

## Current Chrome path

Chrome for Developers presents WebMCP as a proposed web standard.

Chrome's tool-design guidance published on 2026-08-26 recommends tool designs that can be used by agents running in browsers, extensions, or sites.

Chrome 149+ can participate in the WebMCP origin trial. For local testing, use:

```text
chrome://flags/#enable-webmcp-testing
```

After restarting Chrome, verify DOGAGA tool registration from a WebMCP-capable agent or testing environment.

## Production origin trial

Registering `dogaga.pages.dev` for the Chrome WebMCP origin trial may allow public testing of the experimental WebMCP platform API in normal Chrome.

Origin-trial registration requires a human to register the origin with Google/Chrome and obtain a token, so this has not been done yet.

The Challenge submission can use the ChatGPT built-in browser when Site Tools work there. Chrome origin-trial registration is treated as an **additional compatibility-validation path**, not a submission requirement.

## Validation matrix

### A. ChatGPT desktop built-in browser

1. Open `https://dogaga.pages.dev`.
2. Load video and audio through the human UI.
3. Confirm that Site Tools discover all 20 tools.
4. Call `get_project_state`.
5. Create V2 with `add_track`.
6. Move a clip to V2 with `move_clip_to_track`.
7. Call `set_track_opacity`.
8. Confirm that the human UI and Preview update immediately.
9. Make a manual edit, then call `get_project_state` again and confirm that the agent sees the human change.

### B. Normal Chrome

1. Confirm that the manual editor, Preview, and Export work without WebMCP.
2. Confirm that WebMCP status is shown as unsupported without disabling editing features.
3. Verify a real multi-track export file.

### C. Chrome WebMCP testing flag

1. Enable `chrome://flags/#enable-webmcp-testing`.
2. Restart Chrome.
3. Open DOGAGA.
4. In a test consumer that can access `document.modelContext` / tool registration, confirm all 20 tools.

### D. Codex Chrome extension

1. Open DOGAGA in normal Chrome.
2. Ask the Codex Chrome extension to use the current tab for a browser task.
3. Confirm normal browser operation of the manual UI.
4. Record separately that structured Site Tools discovery is currently not available in Chrome.

## References

- OpenAI Help Center — Using site tools in the ChatGPT desktop app
  - https://help.openai.com/en/articles/20001423-using-site-tools-in-the-chatgpt-desktop-app
- OpenAI Help Center — Using the built-in browser in the ChatGPT desktop app
  - https://help.openai.com/en/articles/20001277-using-the-built-in-browser-in-the-chatgpt-desktop-app
- Chrome for Developers — WebMCP
  - https://developer.chrome.com/docs/ai/webmcp
- Chrome for Developers — Build your user's agentic workflows with WebMCP tools
  - https://developer.chrome.com/docs/ai/webmcp/build-tools
- Chrome for Developers — WebMCP tool security
  - https://developer.chrome.com/docs/ai/webmcp/secure-tools
- Chrome for Developers — Join the WebMCP origin trial
  - https://developer.chrome.com/blog/ai-webmcp-origin-trial
