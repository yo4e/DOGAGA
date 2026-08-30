# WebMCP Challenge — compact production v0 実装方針

更新日: 2026-08-30

## 1. 目的

WebMCP Challengeの締切を使って、DOGAGAの**小さいが実際に使える本番Webアプリ v0**を前進させる。

Challenge専用のthrowaway demoや固定シナリオ用prototypeを作るのではなく、公開中のDOGAGA本体をそのまま育てる。

> 人間とbrowser agentが、同じWeb動画編集ページ・同じEditor state・同じ編集commandを共同操作できる。

### compact production v0の基準

通常のlocal mediaに対して、本物の機能として成立させる。

- local video / audioの読み込み
- clip追加・並べ替え・trim・削除
- audio start / volume
- project canvas（16:9 / 9:16 / 1:1 / 4:5）
- contain / cover
- cross dissolve 1種類
- 実時間timeline / playhead / seek
- timelineに沿ったactual video preview
- WebMCPから同じlive stateの読取・編集
- 人間操作とagent操作の相互反映
- Cloudflare上の公開版でも同じ動作

ハードコードしたデモデータ、fake preview、agent専用state、提出動画だけ成立する特別経路は作らない。

Challengeにおける「demo」は提出動画内の実演を指し、DOGAGAアプリ本体をdemo扱いしない。

競合調査は `docs/WEBMCP_COMPETITOR_RESEARCH.md` を参照する。

---

## 2. 今回のscope外 / 後続

compact production v0は機能を意図的に絞る。今回のediting core / WebMCP PRのmerge gateにしないもの:

- 動画書き出し / download
- WebCodecsを使うこと自体
- OPFS / IndexedDB persistence
- 再リンク
- codec matrix完成
- lyrics / captions / text
- waveform
- beat analysis
- multi-video-track
- advanced effects / color / keyframes
- cloud upload / auth
- built-in chat / LLM orchestration
- external MCP server

これらは「デモだから省く」のではない。現在の本番v0を小さく保ち、動く単位で段階的に追加するためである。

特に**最低限の動画書き出し / downloadは、このediting core merge後の重要な製品課題**とする。

---

## 3. 差別化の正本

### Short pitch

**A compact browser-native video editor whose live editing commands are exposed directly to browser agents through WebMCP. Humans and agents edit the same real project state in the same page.**

既存のAI video editor / MCP video editorでは、built-in chat、localhost MCP server、remote MCP server + OAuth、coding agentによる外部JSON編集などが多い。

DOGAGAでは現在開いているpage自身がWebMCP capabilityを登録する。

- agentはDOMを推測して操作しない
- 別serverを起動しない
- editor側にLLMを組み込まない
- UIとagentは同じEditor state / executorを通る
- user-selected local mediaのraw handle / path / object URLをagentへ渡さない

---

## 4. アーキテクチャ

```text
Local File input (human only)
        |
        v
MediaRuntime Map --------------------+
assetId -> File / object URL         |
                                     |
                                     v
Human UI ---> Command Executor ---> Editor State ---> Real Preview
                 ^                   |
                 |                   v
                 +--- WebMCP Tools --+
```

### Editor State

現在の中心state:

```ts
type EditorState = {
  canvas: CanvasSettings;
  assets: AssetDescriptor[];
  videoClips: VideoClip[];
  audioClip: AudioClip | null;
  transitions: Transition[];
  playheadUs: number;
};
```

`AssetDescriptor`にはagentへ公開してよいmetadataだけを置く。

公開しないもの:

- `File`
- `FileSystemFileHandle`
- absolute path
- object URL
- OPFS path
- runtime-only binding

### MediaRuntime

browser session中だけ `File` / object URLを保持する。Editor state、WebMCP response、将来のportable Project dataとは分離する。

### Command Executor

UIとWebMCP mutation toolは必ず同じexecutorへ入る。

現在のcommand subset:

- `addClip`
- `moveClip`
- `trimClip`
- `deleteClip`
- `setAudio`
- `setCanvas`
- `addTransition`
- `removeTransition`

意味validationは共通executorで行い、WebMCP adapterに第二validation実装を作らない。

---

## 5. UI / Timeline

professional NLEの機能量は目指さないが、人間が自分の素材で普通に編集できるUIを基準にする。

現在の必須領域:

1. Media
   - video複数選択
   - audio 1本選択
   - Asset名 / duration / metadata
2. Preview
   - actual local media
   - play / stop / seek
   - canvas preset / fit mode
   - audio同期
   - transition反映
3. Timeline
   - V1 video track / A1 audio track
   - 実時間に比例した表示
   - time ruler / playhead
   - horizontal scroll / zoom
   - clip選択
   - move / trim / delete
   - cross dissolve表示
4. Agent activity
   - tool名
   - success / error
5. WebMCP status
   - supported / unsupported
   - tools registered

ドラッグ操作は現段階の必須条件ではない。実利用で必要性を確認して後続追加する。

---

## 6. Preview

native `HTMLVideoElement` / `HTMLAudioElement`を使う。

Global timeline positionからactive clipとsource timeを算出し、clip境界でsourceを切り替える。seekでも同じmappingを使う。

### Cross dissolve

隣接clipをtimeline上で実overlapさせ、2つのvideo elementのopacityを反転させる。単なる表示ラベルではなく、actual previewで実際にblendすること。

### Audio

A1一本を現在のcompact scopeとする。

- timeline start
- source in/out
- volume

をactual `HTMLAudioElement`へ反映する。

frame-perfectな業務用NLE精度は現段階の目標外だが、短尺編集として明らかな破綻は許容しない。

---

## 7. WebMCP

React lifecycleは `use-webmcp-tool` を使い、`document.modelContext.registerTool()` のregistration lifecycleを管理する。

### 現在の10 tools

read:

- `get_project_state`

mutations:

- `add_clip`
- `move_clip`
- `trim_clip`
- `delete_clip`
- `set_audio`
- `clear_audio`
- `set_canvas`
- `add_transition`
- `remove_transition`

`get_project_state`はsafe Asset descriptors、canvas、clips、audio、transitions、playhead等を返す。

返さないもの:

- File
- path
- object URL
- file handle
- private runtime binding

Agentがstateを読み、複数mutationを行い、人間の修正後に再度stateを読んで続きから編集できるflowを重視する。

---

## 8. 検証

### 自動検証

- TypeScript typecheck
- build
- command executor unit tests
- invalid command tests
- WebMCP handler tests
- safe state serialization test

### 実ブラウザ

最低限:

- 通常のlocal video / audio load
- manual edit
- play / stop / seek
- clip境界
- audio同期
- actual cross dissolve
- WebMCP tool discovery
- agent edit
- human correction
- agent reread + edit
- WebMCP非対応browserでmanual editorが壊れないこと

固定fixtureだけでなく通常のlocal mediaで成立することを確認する。

### 2026-08-30時点

PR #25では、local / productionの両方でbrowser validationとWebMCP shared-state scenarioを実施済み。Cloudflare Pages公開版でもactual previewとagent共同編集を確認済み。

---

## 9. 公開

現在の公開先:

- Cloudflare Pages
- https://dogaga.pages.dev

React + Viteのproduction build (`npm run build` → `dist/`) をそのまま配信する。

Challenge提出のためだけの別アプリは作らず、この公開版をDOGAGA本体として継続する。

PR #25 merge後はCloudflare PagesのProduction branchを `main` へ切り替える。

---

## 10. Challenge提出との関係

Challenge提出では、DOGAGA本体の実動作を使って次を用意する。

- public live app
- README / setup
- 3分未満のpublic YouTube demo video（実演動画）
- 英語Devpost説明
- WebMCPが適する理由
- human / agent shared-state editingの説明
- privacy / local-first説明

アプリ本体と提出用実演動画を混同しない。

---

## 11. 長期DOGAGAとの関係

compact production v0は通常DOGAGAの本体であり、throwawayではない。

後続候補:

- 最低限の動画書き出し / download
- WebCodecs / export技術
- Issue #4 codec matrix実機測定
- Issue #18 / PR #19 Asset registration / relink / stale request設計
- OPFS / IndexedDB
- portable `.dogaga`
- lyrics / text / waveform / effects

session-only runtimeなど現在簡略化している部分は、そのまま恒久仕様とみなさず、実利用を通じて再評価する。
