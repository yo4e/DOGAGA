# WebMCP browser compatibility

更新日: 2026-08-30

DOGAGAは、ページ内で標準WebMCP toolを登録し、人間UIとbrowser agentが同じEditor state / command executorを共同操作する。

この文書は、ChatGPT desktop built-in browser、通常Chrome、Chrome extension agentの現在の違いとDOGAGA側の方針を記録する。

## 結論

DOGAGA側では、**Chrome専用extensionや独自remote MCP serverを追加しない**。

正本は引き続きWebMCPとし、browser / extension / embedded agentがWebMCPを実装した場合に同じtool contractを再利用できる形を保つ。

2026-08-30時点では、OpenAIのSite ToolsはChatGPT desktop appのbuilt-in browserで利用できるが、ChromeではSite Toolsとしてはまだ利用できない。

一方、Chrome自身はWebMCPをproposed web standardとして実装しており、Chrome 149以降のorigin trial、またはlocal testing flagで試験できる。Chrome公式資料は、browser agentだけでなくextension内のagentもWebMCP toolを利用する想定を明記している。

そのため、現在のDOGAGAで不足しているのは主に**consumer側の対応・検証経路**であり、DOGAGAにvendor-specific backendを追加することではない。

## 現在の経路

| 経路 | DOGAGA manual UI | DOGAGA WebMCP tools | 備考 |
| --- | --- | --- | --- |
| ChatGPT desktop built-in browser | ✅ | ✅ Site Tools対応時 | OpenAI Site Toolsの現在の正式経路 |
| 通常Chrome | ✅ | browser capability次第 | manual editor / preview / exportはWebMCP非対応でも動く |
| Chrome WebMCP testing flag | ✅ | ✅ platform APIを試験可能 | `chrome://flags/#enable-webmcp-testing` |
| Chrome WebMCP origin trial | ✅ | ✅ originがtrial参加時 | Chrome 149以降。public testing向け |
| Codex Chrome extension | ✅ browser操作 | Site Toolsとしては未提供 | 既存Chrome profile/session/tabsを使う経路。OpenAI公式Site Toolsは現在Chrome非対応 |
| WebMCP対応extension agent | ✅ | ✅ 想定される標準経路 | Chrome公式WebMCP資料はextension agentを対象に含む |

## DOGAGA実装の互換性

DOGAGAは `use-webmcp-tool` でページライフサイクルに合わせてtool registrationを行う。

現在の20 tools:

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

### 互換性ルール

- WebMCPがないbrowserでもmanual editor / preview / exportを壊さない。
- `document.modelContext` をDOGAGA側でpolyfillしない。
- Chrome専用DOM automationをtool正本にしない。
- WebMCP consumerがbrowser / extension / embeddedのどこにいても、同じschema / command semanticsを使う。
- local `File` / object URL / pathはagent-safe stateへ出さない。
- track / clip / transition mutationは人間UIと同じEditorController / executorへ通す。

## OpenAI側の現在地

OpenAI Help Centerの2026-08-29更新情報では、Site ToolsはChatGPT desktop appのbuilt-in browserで利用でき、Chromeでは現在利用できない。

Codex Chrome extensionは、既存Chrome profile、cookies、signed-in session、open tabs、Chrome extensionsを使うbrowser作業経路として案内されている。ただし、これは現在のSite Tools / WebMCP structured tool discoveryがChromeで提供されていることを意味しない。

したがって「ChatGPT/CodexのChrome extensionからDOGAGAのWebMCP toolを直接呼ぶ」は、OpenAI consumer側がChrome Site Tools/WebMCPを提供するまでDOGAGAだけでは完成できない。

## Chrome側の現在地

Chrome for DevelopersではWebMCPをproposed web standardとして公開している。

2026-08-26公開のtool design guideでは、agentがbrowser、extension、site embeddedのどこにいても利用できるtool設計を推奨している。

Chrome 149以降はWebMCP origin trialへ参加できる。local testingでは以下のflagを利用できる。

```text
chrome://flags/#enable-webmcp-testing
```

Chromeを再起動後、WebMCP対応agent / testing環境からDOGAGA tool registrationを確認する。

## Production origin trialについて

`dogaga.pages.dev` をChrome WebMCP origin trialへ登録すると、通常Chromeでexperimental WebMCP platform APIをpublic testingできる可能性がある。

ただしorigin trial registrationはGoogle/Chrome側でoriginを登録してtokenを発行する人間操作が必要になるため、現時点では未実施。

Challenge提出にはChatGPT built-in browserでSite Toolsが動作すれば要件を満たせるので、origin trial登録は**Chrome互換性検証を広げる追加施策**として扱う。

## 検証マトリクス

### A. ChatGPT desktop built-in browser

1. `https://dogaga.pages.dev` を開く。
2. 動画・音声を人間がlocal loadする。
3. Site Toolsが20 toolsを検出することを確認する。
4. `get_project_state` を実行する。
5. `add_track` でV2を作る。
6. `move_clip_to_track` でclipをV2へ移す。
7. `set_track_opacity` を実行する。
8. 人間UI / Previewへ即時反映されることを確認する。
9. 人間が修正したあと再度 `get_project_state` で変更を読めることを確認する。

### B. 通常Chrome

1. manual editor / Preview / ExportがWebMCP非対応でも動くことを確認する。
2. WebMCP statusがunsupportedとして明示され、編集機能を無効化しないことを確認する。
3. multi-track Exportを実ファイルで確認する。

### C. Chrome WebMCP testing flag

1. `chrome://flags/#enable-webmcp-testing` をEnabled。
2. Chromeを再起動。
3. DOGAGAを開く。
4. `document.modelContext` / tool registrationが利用可能なtest consumerで20 toolsを確認する。

### D. Codex Chrome extension

1. DOGAGAを通常Chromeで開く。
2. Codex Chrome extensionへ現在のtabを使うbrowser taskを依頼する。
3. manual UIの通常browser操作が可能であることを確認する。
4. Site Tools structured tool discoveryは現在Chrome非対応であることを区別して記録する。

## 参照

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
