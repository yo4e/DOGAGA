# WebMCP Challenge MVP 実装方針

更新日: 2026-08-30

## 1. 目的

DOGAGAの通常ロードマップを4日で完成させるのではなく、WebMCP Challengeで次の一点を明確に実証する。

> 人間とbrowser agentが、同じWeb動画編集ページ・同じProject state・同じ編集commandを共同操作できる。

このSprintでは「高機能動画編集」より「WebMCP-native collaborative editing」を優先する。

競合調査は `docs/WEBMCP_COMPETITOR_RESEARCH.md` を参照する。

---

## 2. 非目標

今回の完成条件にしない。

- WebCodecsを使うこと自体
- MP4 export
- OPFS / IndexedDB persistence
- 再リンク
- codec matrix完成
- lyrics / captions / text
- waveform
- beat analysis
- multi-video-track
- advanced effects / color / keyframes
- cloud / auth / upload
- built-in chat / LLM orchestration
- external MCP server

既存の長期設計は削除しないが、今回の実装ゲートにはしない。

---

## 3. 差別化の正本

DOGAGA WebMCP Sprintの説明は次を正本とする。

### Short pitch

**A browser-native video editor whose live editing commands are exposed directly to browser agents through WebMCP. Humans and agents edit the same project state in the same page.**

### 技術上の違い

既存のAI video editorやMCP video editorでは、よく次の方式を取る。

- built-in chat agent
- localhost MCP server
- remote MCP server + OAuth
- coding agentがproject JSON / codeを外から編集

DOGAGAではWebMCPにより、現在開いているpageが自身の編集capabilityを登録する。

- agentはDOMを推測して操作しない
- 別serverを起動しない
- editor側にLLMを組み込まない
- UIとagentは同じProject / executorを通る
- user-selected local mediaのraw handle/path/object URLをagentへ渡さない

---

## 4. MVPアーキテクチャ

```text
Local File input (human only)
        |
        v
MediaRuntime Map --------------------+
assetId -> File / object URL         |
                                     |
                                     v
Human UI ---> Command Executor ---> Editor State ---> Preview
                 ^                   |
                 |                   v
                 +--- WebMCP Tools --+
```

### 4.1 Editor State

今回必要なstateだけを保持する。

```ts
type EditorState = {
  assets: AssetDescriptor[];
  videoClips: VideoClip[];
  audioClip: AudioClip | null;
  transitions: Transition[];
  playheadUs: number;
};
```

`AssetDescriptor`にはagentへ公開してよいmetadataだけを置く。

例:

- `id`
- `kind`
- display name
- duration
- width / height（取得できた場合）

置かないもの:

- `File`
- `FileSystemFileHandle`
- absolute path
- object URL
- OPFS path
- fingerprint / hash（今回不要）

### 4.2 MediaRuntime

ブラウザsession中だけ次を保持する。

```ts
Map<AssetId, {
  file: File;
  objectUrl: string;
}>
```

これはportable Projectではなくruntime bindingであり、Undo / Redo、WebMCP response、保存JSONの対象にしない。

ページ終了時にobject URLをrevokeする。

今回、PR #19で設計中の完全な再リンク・stale request modelは実装しない。

### 4.3 Command Executor

UIとWebMCP mutation toolは必ず同じ関数へ入る。

最低限:

- `addClip`
- `moveClip`
- `trimClip`
- `deleteClip`
- `setAudio`
- `addTransition`

可能なら:

- `undo`
- `redo`

command executorが行うvalidation:

- 存在するAsset / Clip IDか
- timeline startが負でないか
- source in/outがAsset duration内か
- `sourceOut > sourceIn`か
- clip overlapを今回許可するかの規則
- transitionが隣接clip間にだけ設定されるか
- audio volume範囲

WebMCP adapter側に同じvalidationを重複実装しない。

### 4.4 Undo / Redo

今回のcommand subsetだけに限定し、簡単に安全に実装できる場合のみ入れる。

推奨:

- EditorState snapshotまたは小さなcommand history
- MediaRuntimeはhistoryへ入れない
- file load / object URL lifecycleはUndo対象外

既存 `docs/EDIT_COMMAND_MODEL.md` は設計参考とするが、歌詞・永続Asset・maintenance commandまで今回実装しない。

---

## 5. UI

professional NLEを作らない。

一画面でデモが読めることを優先する。

### 必須領域

1. Media panel
   - video複数選択
   - audio 1本選択
   - Asset ID / durationの簡易表示

2. Preview
   - play / pause
   - seek
   - 現在clip表示
   - audio同期

3. Timeline
   - video clipを横並びbarまたは簡易trackとして表示
   - clip name / duration
   - 選択
   - UIからmove / trim / delete可能
   - cross dissolveの存在が分かる表示

4. Agent activity
   - `Agent: trim_clip`
   - 成功 / error
   - 直近数件だけでよい

5. WebMCP status
   - supported / unsupported
   - tools registered

### UI操作

drag & dropを必須にしない。

deadline優先で、button / select / number inputでもよい。

「人間がmanual editできる」ことが確認できればよく、完成版editorの操作感は評価対象外とする。

---

## 6. Preview

### 基本方針

native `HTMLVideoElement` / `HTMLAudioElement`を第一候補とする。

WebCodecsは今回の完成条件にしない。

### 再生

Global timeline positionから次を算出する。

```text
active clip
source time = clip.sourceIn + (playhead - clip.timelineStart)
```

clip境界を越えたらactive video sourceを切り替える。

### Cross dissolve

1種類だけ。

必要なら2つのvideo elementを重ね、transition区間だけopacityを反転させる簡易方式でよい。

高精度compositorは今回作らない。

### Audio

1本だけ。

- timeline start
- volume

を反映する。

映像と音声のframe-perfect同期は今回の評価軸にしないが、デモ上明らかな破綻は避ける。

---

## 7. WebMCP

### API

現行標準のimperative API:

```ts
document.modelContext.registerTool(...)
```

を使う。

### React lifecycle

第一候補として `use-webmcp-tool` を採用する。

理由:

- GoogleChromeLabs maintain
- Apache-2.0
- React >= 18
- runtime dependencyなし
- StrictMode / HMR lifecycleを処理
- AbortSignal unregistration
- late injection / unsupported browser handling
- error result normalization

この依存は今回の目的に直接対応する小規模依存であり、「大きなwrapperを導入しない」という原則には抵触しないと判断する。

直接APIを数十行で安全に扱える場合は自作でもよいが、独自lifecycleコードを増やすことを目的にしない。

### Tool set

#### read

`get_project_state`

返すもの:

- safe Asset descriptors
- video clip IDs / asset IDs
- timeline start
- source in/out
- audio start / volume
- transitions
- optional undo/redo state

返さないもの:

- File
- path
- object URL
- file handle
- private runtime binding

#### mutations

- `add_clip`
- `move_clip`
- `trim_clip`
- `delete_clip`
- `set_audio`
- `add_transition`

optional:

- `undo`
- `redo`

mutation toolはWebMCP adapterからcommand executorを呼ぶだけにする。

### Tool naming

tool数を増やして競わない。

Agentが一度stateを読み、複数mutationを順に実行し、人間の修正後に再度stateを読む一連のflowを重視する。

---

## 8. Testing

### 自動検証として必須

変更範囲に応じて:

- TypeScript typecheck
- lint
- build
- command executor unit tests
- invalid command tests
- WebMCP adapterがexecutorを呼ぶことのunit test
- safe state serialization test（object URL / File等が漏れない）

### 必須ではない監査

次を毎PRの完了条件にしない。

- 全docsの全文横断レビュー
- Markdown code fence数
- table数
- 全fixture ID照合
- 通常ロードマップの全acceptance再検証
- macOS / Windows両方のcodec matrix
- unrelated schema validation

### Browser実機

最終的に必要:

- local video 3本 + audio 1本
- manual edit
- WebMCP tool discovery
- agent edit
- preview
- human correction
- agent reread + edit

ここは実ブラウザ操作が必要になるため、Codexまたは人間実機確認へ渡す。

---

## 9. 作業分担

### ChatGPTで進める

- competitor research
- architecture / scope固定
- Issue / docs / AGENTS整理
- Project / commandの小さなpure TypeScript部分
- validation / unit tests
- WebMCP tool schema設計
- code review
- README / Devpost draft

### Codexへ渡すタイミング

次のどれかに入ったらCodexを使う価値が高い。

- React app scaffoldから複数UI fileをまとめて実装
- actual media playback synchronization
- cross dissolve preview
- WebMCP対応Chrome / in-app browserの実動作確認
- browser bug修正を反復
- deploy + end-to-end demo確認

Codexへ渡す前に、仕様をこの文書と対象Issueで機械的に実装できる状態へ固定する。

---

## 10. 実行順

### Step 1 — lightweight app + state

- React + TS + Vite
- runtime asset load
- EditorState
- command executor
- simple UI

### Step 2 — preview

- video playback / seek
- audio
- trim / move反映
- simple cross dissolve

### Step 3 — WebMCP

- tools register
- same executor
- agent activity
- unsupported fallback

### Step 4 — browser validation / deploy / submission

- actual WebMCP agent scenario
- GitHub Pages等のpublic static deploymentを第一候補
- README
- demo video
- Devpost

PR数は固定しない。

一つのbranch / PRで自然にレビューできるなら #20 と #21を連続して実装してよい。PRを細分化すること自体を目的にしない。

---

## 11. 長期DOGAGAとの境界

今回のSprintは長期設計を否定しない。

Sprint後に再検討するもの:

- Issue #2 WebCodecs / export技術スパイク
- Issue #4 codec matrix実機測定
- Issue #18 / PR #19 Asset registration / relink / stale request設計
- OPFS / IndexedDB
- portable `.dogaga`
- lyrics / text / waveform

ハッカソン実装から長期実装へ戻す際、Sprintの簡易runtimeをそのまま恒久設計とみなさない。
