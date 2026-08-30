# WebMCP Challenge — compact production v0 実装方針

更新日: 2026-08-30

## 1. 位置づけ

WebMCP Challengeの締切を開発加速に使い、DOGAGAの**小さいが実際に使える本番Webアプリ v0**を前進させる。

Challenge専用のthrowaway demoや固定シナリオ用prototypeは作らない。公開中のDOGAGA本体をそのまま育てる。

Challengeの「demo」は提出動画内の実演だけを指し、DOGAGAアプリ本体をdemo扱いしない。

## 2. 2026-08-30現在地

editing core / WebMCP shared-state editingはmainへmerge済み。

- 実装 / browser validation / Cloudflare validation: PR #25
- merge用PR: #27
- merge commit: `d3813369989fdb6b41453425dc726d1df210023b`
- Live app: https://dogaga.pages.dev
- 完了Issue: #20 / #21
- active: #22

現在の主な機能:

- local video / audio load
- V1 video track / A1 audio track
- clip Add / Move / Trim / Delete
- audio start / volume / remove
- actual play / stop / seek
- clip境界再生
- actual cross dissolve
- 実時間timeline / playhead / horizontal scroll / zoom
- canvas 16:9 / 9:16 / 1:1 / 4:5
- contain / cover
- UI / agent共通Editor state / command executor
- WebMCP 10 tools
- Cloudflare Pages公開

## 3. compact production v0の基準

通常のlocal mediaに対して、本物の機能として成立させる。

禁止:

- ハードコードしたデモデータ
- fake preview
- agent専用state / timeline
- 別MCP serverへの逃避
- 提出動画だけ成立する特別経路

機能を省く理由は「demoだから」ではなく、小さい本番版を動く単位で段階的に完成させるため。

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

中心state:

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

### Runtime boundary

browser session中だけ `File` / object URLを保持する。

agent-safe stateへ出さないもの:

- `File`
- FileSystemFileHandle
- absolute path
- object URL
- OPFS path
- runtime-only binding

UIとWebMCP mutationは同じ `EditorController.execute()` を使う。

## 5. UI / Preview

現在のcompact scope:

- Media panel
- V1 / A1 timeline
- time ruler / playhead
- scroll / zoom
- clip選択
- move / trim / delete
- audio start / volume
- cross dissolve
- canvas preset / fit mode
- actual video preview
- play / stop / seek

Cross dissolveは隣接clipを実overlapさせ、2つのvideo elementのopacityでactual blendする。

frame-perfectな業務用NLE精度は現段階の目標外だが、通常の短尺編集として明らかな破綻は許容しない。

## 6. WebMCP

現在の10 tools:

- `get_project_state`
- `add_clip`
- `move_clip`
- `trim_clip`
- `delete_clip`
- `set_audio`
- `clear_audio`
- `set_canvas`
- `add_transition`
- `remove_transition`

Agentがstateを読み、複数mutationを行い、人間の修正後に再読取して続きを編集できるshared-state flowを重視する。

local / Cloudflare productionの双方でagent→UI→human→agent flowを確認済み。

## 7. 検証

自動:

- TypeScript typecheck
- unit tests
- build
- invalid command tests
- WebMCP handler tests
- safe state serialization test

実ブラウザ:

- local video / audio load
- manual edit
- play / stop / seek
- clip境界
- audio同期
- actual cross dissolve
- WebMCP discovery
- agent edit
- human correction
- agent reread + edit
- WebMCP非対応Chromeでmanual editorが壊れないこと

PR #25 / #27時点で上記を確認済み。

## 8. 公開

- Hosting: Cloudflare Pages
- Live app: https://dogaga.pages.dev
- build: `npm run build`
- output: `dist`

main mergeは完了済み。

Cloudflare PagesのProduction branchはまだ `feat/webmcp-mvp-core` のため、**次に `main` へ切り替える**。

## 9. 次の製品課題

優先:

1. Cloudflare Production branchを `main` へ切り替える
2. UXの細修正
3. 最低限の動画書き出し / download
4. main新規cloneでREADME setupを最終確認

後続候補:

- persistence / relink
- WebCodecs / export技術
- codec matrix
- OPFS / IndexedDB
- portable `.dogaga`
- lyrics / captions / waveform
- multi-track
- advanced effects

session-only runtime等の簡略化は恒久仕様と決め打ちせず、実利用を通じて再評価する。

## 10. Challenge提出

active Issueは #22。

DOGAGA本体の公開版を使って次を用意する。

- README / setup
- 3分未満のpublic YouTube実演動画（audioあり）
- 英語Devpost説明
- Why WebMCP
- human / agent shared-state editing
- privacy / local-first
- Challenge前 / Challenge期間中のwork区別

提出用に別アプリを作らない。
