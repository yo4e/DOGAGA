# WebMCP Challenge MVP 実装方針

更新日: 2026-08-30

## 1. 目的

DOGAGAの通常ロードマップを4日で完成させるのではなく、WebMCP Challenge期間中に**小さいが実際に使える動画編集アプリ**を完成させる。

> 人間とbrowser agentが、同じWeb動画編集ページ・同じProject state・同じ編集commandを共同操作できる。

このSprintでは高機能NLEを目指さない。ただし、審査用に動いて見えるだけのthrowaway demoにも、固定シナリオ専用のprototypeにもしてはいけない。

### 完成像

ユーザーが自分のlocal video / audioを読み込み、実際に編集し、previewし、同じ編集状態をWebMCP agentにも操作させられる**compact editor v0**を作る。

次は本物の機能として成立させる。

- local video / audioの読み込み
- clip追加・並べ替え・trim・削除
- audio start / volume
- project canvas（16:9 / 9:16 / 1:1 / 4:5）と素材の表示方法
- cross dissolve 1種類
- timelineに沿った実動画preview
- play / pause / seek
- WebMCPから同じlive stateの読取・編集
- 人間操作とagent操作の相互反映

ハードコードしたデモデータ、fake preview、agent専用の別state、提出動画だけ成立する特別経路は作らない。

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

これらを省く理由は「デモだから」ではなく、**compact editor v0として機能を絞るため**である。

特にMP4 exportはchallenge期間中のstretch goalとする。export未実装でも、編集中のstateとpreviewは実データで成立していなければならない。

既存の長期設計は削除しないが、今回の実装ゲートにはしない。

---

## 3. 差別化の正本

DOGAGA WebMCP Sprintの説明は次を正本とする。

### Short pitch

**A compact browser-native video editor whose live editing commands are exposed directly to browser agents through WebMCP. Humans and agents edit the same real project state in the same page.**

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
Human UI ---> Command Executor ---> Editor State ---> Real Preview
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

今回、PR #19で設計中だった完全な再リンク・stale request modelは実装しない。

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
- 1 video track上の配置規則
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

professional NLEを作らないが、**普通に使って編集内容を理解・変更できるUI**にはする。

一画面で次を扱えることを優先する。

1. Media panel
   - video複数選択
   - audio 1本選択
   - Asset名 / durationの簡易表示

2. Preview
   - actual local mediaを再生
   - play / pause
   - seek
   - 現在clip表示
   - audio同期
   - transition反映

3. Timeline
   - video clipを横並びbarまたは簡易trackとして表示
   - clip name / duration
   - 選択
   - UIからmove / trim / delete可能
   - cross dissolveの存在が分かる表示

4. Agent activity
   - `Agent: trim_clip`
   - success / error
   - 直近数件だけでよい

5. WebMCP status
   - supported / unsupported
   - tools registered

### UI操作

drag & dropを必須にしない。

button / select / number input中心でもよいが、**人間が自分の素材で編集を完了できること**を基準にする。

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

seek時にも同じmappingを使い、実素材の該当時刻へ移動する。

### Cross dissolve

1種類だけ。

2つのvideo elementを重ね、transition区間だけopacityを反転させる簡易方式でよい。

ただし単なる表示ラベルではなく、previewで実際に映像がblendすること。

### Audio

1本だけ。

- timeline start
- volume

を実際の `HTMLAudioElement` へ反映する。

映像と音声のframe-perfect同期は今回の評価軸にしないが、通常の短尺編集として明らかな破綻は避ける。

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
- `document.modelContext.registerTool()` のlifecycleをReact mount/unmountへ結びつける
- StrictMode / HMR lifecycle対応
- AbortSignal unregistration
- late injection / unsupported browser handling
- error result normalization

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
- project canvas preset / fit mode
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
- `clear_audio`
- `set_canvas`
- `add_transition`
- `remove_transition`

optional:

- `undo`
- `redo`

mutation toolはWebMCP adapterからcommand executorを呼ぶだけにする。

Agentが一度stateを読み、複数mutationを順に実行し、人間の修正後に再度stateを読む一連のflowを重視する。

---

## 8. Testing

### 自動検証として必須

変更範囲に応じて:

- TypeScript typecheck
- build
- command executor unit tests
- invalid command tests
- WebMCP adapterがexecutorを呼ぶことのunit test
- safe state serialization test（object URL / File等が漏れない）

### Browser実機で必須

- 自分のlocal video 3本 + audio 1本をload
- manual edit
- actual play / pause / seek
- clip境界を越えるpreview
- audio反映
- cross dissolve preview
- WebMCP tool discovery
- agent edit
- human correction
- agent reread + edit

固定fixtureだけでなく、通常のlocal mediaでも成立することを確認する。

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

- actual media playback synchronization
- cross dissolve preview
- WebMCP対応Chrome / in-app browserの実動作確認
- browser bug修正を反復
- deploy + end-to-end利用確認

Codexへ渡す前に、仕様をこの文書と対象Issueで機械的に実装できる状態へ固定する。

---

## 10. 実行順

### Step 1 — app + state

- React + TS + Vite
- runtime asset load
- EditorState
- command executor
- compact manual UI

### Step 2 — real preview

- actual video playback / seek
- audio
- trim / move反映
- real simple cross dissolve

### Step 3 — WebMCP

- tools register
- same executor
- agent activity
- unsupported fallback

### Step 4 — browser validation / deploy / submission

- actual WebMCP agent scenario
- 普通のlocal mediaでeditorとして動作確認
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

Challenge期間に作るcompact editor v0はthrowawayにしない。実装のうち、Editor state / executor / WebMCP境界 / UI構造は通常DOGAGAへ育てられる品質を保つ。

一方、session-only runtimeなど簡略化した部分は、そのまま恒久設計とみなさず後で再評価する。
