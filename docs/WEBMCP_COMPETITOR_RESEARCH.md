# WebMCP Challenge 競合・先行実装調査

更新日: 2026-08-30

## 結論

DOGAGAのハッカソン版は、単に「AIが動画を編集する」「agentがtimelineを操作する」だけでは差別化できない。

2026年8月時点では、すでに次のカテゴリに多数の先行例がある。

- 人間UIとAI agentが同じ動画timelineを編集するアプリ
- MCP server経由でClaude / Codex等から動画編集を行うアプリ
- browser-native / local-firstの動画編集アプリ
- agentがコードやJSON timelineを生成・変更して動画を作る仕組み

一方、今回の調査では、**ブラウザで現在開いている動画編集ページ自身がWebMCP toolsを登録し、別MCP server・ローカルserver・内蔵chatを必須とせず、人間とbrowser agentがその場の同一編集状態を共同操作する**ことを中核にした成熟した動画編集アプリは確認できなかった。

したがって、DOGAGA WebMCP Sprintの主張は次へ絞る。

> DOGAGA is a browser-native video editor that exposes its live editing state and commands directly to browser agents through WebMCP, so humans and agents can edit the same project in the same page.

新規性の中心は「AI video editor」ではなく、**video editor as a WebMCP-native website** に置く。

---

## 1. 直接競合: 人間とagentが同じtimelineを編集する

### OpenChatCut

- local-first conversational AI video editor
- professional multi-track timeline
- built-in agent + Agent Skills + MCP
- Codex / Claude Code等が実際のProjectをinspect / edit / export可能
- manual editingとagent editingが同じworkspaceに共存
- AGPL-3.0-or-later

DOGAGAとの近さ: **非常に高い**。

違い:

- OpenChatCutの外部agent連携はStreamable HTTP MCP endpointをローカルで立てる方式
- DOGAGA短期MVPは、WebMCPにより現在のWebページ自身がtoolsを登録する
- DOGAGAでは別server設定やMCP接続設定をデモの前提にしない

参考:
- https://github.com/0xsline/OpenChatCut
- https://github.com/Leo0186/openchatcut

### Frontstage

- browser / Windowsで動くAI-native video editor
- multi-track、trim、ripple、effects、caption、export等を持つ
- built-in agentが40以上のtoolでtimelineを編集
- desktop版はlocalhost MCP serverを公開しClaude等から操作可能
- core / engine / UI / AIを分離
- GPL-3.0

DOGAGAとの近さ: **非常に高い**。

参考にすべき点:

- UIとagentが同じundo stackを使う
- headless domain coreとUIを分離する
- agent actionが実timelineへ反映される

そのまま流用しない理由:

- GPL-3.0でDOGAGAのMIT方針と組み合わせに注意が必要
- 機能規模が今回の4日MVPには大きすぎる

参考:
- https://github.com/x777/frontstage

### FableCut

- browser video editor
- timeline全体をJSON documentとして扱う
- UI、REST、MCPのいずれからも同じProjectを変更可能
- browser UIは変更をlive reload
- zero runtime dependencies
- MIT License

DOGAGAとの近さ: **高い**。

重要な示唆:

- agent向けに第二の編集モデルを作らず、既存Project representationをautomation surfaceとして使う設計は有効
- previewとexportのcompositorを一つにする方針も参考になる

ただし、MCP/REST + Node server方式でありWebMCPではない。

参考:
- https://github.com/ronak-create/FableCut

### Velocut

- browser-native / local-first
- human UIとLLM agentが同一JSON command protocolを使用
- Rust/WASM canonical engine + TypeScript reference engine
- WebGPU / WebCodecs
- agent console、branching history等を持つ

DOGAGAとの近さ: **設計思想として極めて高い**。

重要な示唆:

- humanとagentを別系統にせず同一command pipelineへ通すことは先行例でも採用されている
- したがってDOGAGAの差別化は「同じcommand executor」単体ではなく、WebMCPによるWebページ直接公開まで含める必要がある

参考:
- https://github.com/open-ribbi/velocut

### Pireel Studio

- backend-free browser video editor
- local editing / timeline / live preview / WebCodecs export
- external agentからMCP経由で操作可能
- editor本体はAGPL-3.0、agent側はApache-2.0

DOGAGAとの近さ: **高い**。

違い:

- external MCP / agent pluginを接続する方式
- talking-head editing中心
- WebMCPでページ自身がtoolsを公開することが主題ではない

参考:
- https://github.com/pireel/pireel
- https://github.com/pireel/pireel-agent

### Tellers MCP

- hosted remote MCP server
- agentがvideo projectをcreate / edit / inspect / preview / export
- live playable timelineを人間が確認できる
- OAuthでClaude / Codexと接続

DOGAGAとの近さ: **体験として高い**。

DOGAGAとの差:

- Tellersはremote MCP service + OAuth
- DOGAGAはWebページ自体がWebMCP toolsを公開し、ローカル素材と現在のbrowser stateを中心にする

参考:
- https://tellers.ai/mcp
- https://tellers.ai/docs/mcp

---

## 2. AI動画編集の一般競合

### Descript Underlord

- fully powered video editor内のAI agent
- transcriptを中心に編集
- natural-language instructionsで複数編集をまとめて実行
- 人間のmanual passとagent作業が同じproduct内にある

示唆:

「AIへ頼んだあと人間が直す」はすでに一般化しつつある。DOGAGAはこの体験自体を新規性として主張しない。

参考:
- https://www.descript.com/underlord

### VEED OpenEdit

- agent-driven video editing pipeline
- Claude Code / Codex / Gemini等で利用
- GUIやtimelineは持たず、HTML/CSS compositionをagentが生成
- editor部分Apache-2.0

示唆:

agent-first video creationは「GUIなし」方向でも競争が進んでいる。DOGAGAは逆に、**人間が見て直接直せるlive UIを残したままagent capabilityを公開する**ことを強調できる。

参考:
- https://www.veed.io/tools/openedit
- https://support.veed.io/en/articles/16342833-how-to-use-openedit-veed-s-agent-driven-video-editor

### Filmidi / その他Devpost系

2026年のhackathon作品にも、MCP serverを内蔵してagentがtimelineを編集するvideo editorがすでに存在する。

例:
- Filmidi: native MCP server、50+ tools、timeline editing
- Clippi: conversational editing
- Video Editor Agent: prompt-driven Remotion generation

示唆:

「MCPを動画編集に使った」だけでも新規性として弱い。

参考:
- https://devpost.com/software/filmidi-i970g4
- https://devpost.com/software/clippi
- https://devpost.com/software/video-editor-agent

---

## 3. 実装資産候補

### Elah

- Apache-2.0
- browser-native frame-accurate video editing engine
- `@elah/editor` / `@elah/core` / timeline等をnpm packageとして提供
- timeline engine、history、renderer、preview、MP4 exportを持つ
- React layerあり

長所:

- DOGAGAのReact方針と合わせやすい
- browser editor engineをゼロから作るより将来的には大幅に省力化できる可能性
- headless coreが明確

今回採用しない理由:

- DOGAGA既存Project schema / command modelとのadapter設計が必要
- 4日MVPではpackage理解と統合作業が新たなリスクになる
- 今回必要なのは単一video track + audio +数commandであり、自作subsetのほうが小さい

ハッカソン後に通常DOGAGAのengine候補として再評価する価値は高い。

参考:
- https://github.com/elahlabs/elah
- https://www.elah.dev/

### OpenReel Video

- MIT
- React + TypeScript
- browser-only / local-first
- WebCodecs / WebGPU
- multi-track、effects、audio等

長所:

- DOGAGAとライセンス互換性が高い
- browser-native editorとして実装参考になる

今回採用しない理由:

- 完成度の高い大規模editorから必要subsetだけ抽出するコストが高い
- DOGAGA独自のProject / WebMCP境界を説明しにくくなる

参考:
- https://github.com/syntax-syndicate/openreel-video-editor

### FreeCut

- MIT
- React + TypeScript + Vite
- browser-only / local-first
- Zustand + Zundo
- WebGPU / WebCodecs / Mediabunny / OPFS等

長期DOGAGAの技術参考として有用。

今回のMVPでは依存・機能面積が大きく、丸ごと採用しない。

参考:
- https://github.com/walterlow/freecut

### GoogleChromeLabs/use-webmcp-tool

- Chrome側でmaintainされているReact hook
- Apache-2.0
- React >= 18
- runtime dependencyなし
- `document.modelContext.registerTool()` のlifecycleをReact mount/unmountへ結びつける
- StrictMode、late injection、error normalization、AbortSignal unregistrationを扱う

**今回の採用候補として強く推奨。**

理由:

- WebMCPはexperimentalで仕様変更リスクがある
- DOGAGA独自hookを書く価値が低い
- HMR / StrictModeのduplicate registrationを自作で解決する必要がなくなる
- 小さく、今回の目的に直接対応する依存

参考:
- https://github.com/GoogleChromeLabs/use-webmcp-tool
- https://developer.chrome.com/docs/ai/webmcp/imperative-api

---

## 4. DOGAGAが競わないもの

ハッカソン版では次を競争軸にしない。

- AIが動画を自動生成できること
- 高機能timeline
- 多数のeffects / transitions
- AI caption / transcription
- beat detection
- MP4 export品質
- MCP tool数
- 自動編集の賢さ

これらは先行プロダクトが強く、4日で追う意味がない。

---

## 5. DOGAGAが示すもの

最小デモで示す価値は次の4点。

1. **Web page itself is the agent interface**
   - 別MCP server、localhost server、OAuth connectorを必要とせず、ページがWebMCP toolsを公開する。

2. **One live state for human and agent**
   - 人間UIとagent toolが同じProject / command executorを操作する。

3. **Human correction is first-class**
   - agent編集後に人間がUIで修正し、その変更後stateをagentが再読取して続行できる。

4. **Local media stays local**
   - ユーザーが選択した動画・音声のFile / object URLをWebMCP toolへ公開せず、agentは安全なAsset IDとtimeline metadataだけを見る。

---

## 6. 調査から導く実装判断

- editor engine丸ごとの新規統合は今回しない
- professional timelineを作らない
- native `HTMLVideoElement` / `HTMLAudioElement`中心でpreviewを成立させる
- Project / command executorは小さく自作し、human UIとWebMCPで共有する
- WebMCP lifecycleには `use-webmcp-tool` の採用を第一候補とする
- MP4 exportは提出要件ではないためstretch goalのままにする
- 既存長期設計のAsset再リンク、OPFS、codec matrix、完全Undo設計をハッカソン入口ゲートにしない

次の正本: `docs/WEBMCP_MVP_IMPLEMENTATION_PLAN.md`
