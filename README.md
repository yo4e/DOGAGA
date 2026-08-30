# DOGAGA（どーがが）

DOGAGAは、**パソコンのブラウザで動く、軽量・ローカルファーストの動画編集Webアプリ**です。

Premiere Proのような総合編集ソフトを再現するのではなく、MV、PV、ショート動画、歌詞動画、Spotify Canvasなどを、軽く・速く・迷わず作れる小型編集機を目指しています。

現在は、WebMCP Challenge 2026の締切を開発加速の機会として使いながら、Challenge専用demoではなく**compact production v0**を実装しています。

## 公開版

- Live app: https://dogaga.pages.dev
- Repository: https://github.com/yo4e/DOGAGA
- License: MIT

公開版はCloudflare Pagesで配信しています。Production branchは `main` です。

## 現在できること

### 編集

- local video / audioの読み込み
- 1 video track（V1）+ 1 audio track（A1）
- clip追加・並べ替え・trim・削除
- 再生ヘッド位置でのclip分割
- `⌘K` / `Ctrl+K` で選択clipを再生ヘッド位置で分割
- `Shift+D` で選択clipと次clipの0.5秒cross dissolveを切替
- audio start / volume / remove
- cross dissolve追加・削除
- 実時間に比例したtimeline表示
- 再生ヘッド / timeline seek
- timeline表示倍率

### Preview

- actual local videoのplay / pause / seek
- clip境界を越える再生
- trim / split / move / deleteの即時反映
- audio同期
- 2 video layerによる実cross dissolve
- project canvas: 16:9 / 9:16 / 1:1 / 4:5
- source fit: 全体表示（contain）/ 画面いっぱい（cover）

### 書き出し

- 現在のV1 / A1をブラウザ内で動画へ書き出し
- trim / clip順 / canvas / contain-cover / cross dissolve / audioを反映
- browser-native `canvas.captureStream()` + Web Audio + MediaRecorder
- 対応環境ではMP4を優先し、必要に応じてWebMへfallback
- server uploadなし
- progress / cancel / download

### WebMCP

DOGAGAは、現在開いている編集ページ自身がWebMCP toolsを公開します。

人間UIとbrowser agentは**同じEditor state / 同じcommand executor**を共同操作します。別MCP serverやagent専用timelineは使いません。

現在のtools:

- `get_project_state`
- `add_clip`
- `move_clip`
- `trim_clip`
- `split_clip`
- `delete_clip`
- `set_audio`
- `clear_audio`
- `set_canvas`
- `add_transition`
- `remove_transition`

WebMCP対応環境では、人間が素材を読み込んだあと、agentがstateを読み、編集し、人間の修正後に再読取して続きを編集できます。

## Privacy / local-first

元動画・音声は、通常の編集・書き出しではサーバーへuploadしません。

ブラウザsession中のruntimeでは `File` / object URLを保持しますが、WebMCPへ公開するEditor stateには含めません。

agentへ渡さないもの:

- `File`
- FileSystemFileHandle
- absolute path
- object URL
- local filesystem情報

## 対応環境

- Desktop Chromeを第一基準
- WebMCP対応環境ではagent共同編集を利用可能
- WebMCP非対応ブラウザでもmanual editor / actual preview / exportを利用可能

WebMCP自体は対応browser / in-app browser側の実装状況に依存します。

## ローカル起動

Node.js 22を推奨します。

新規clone後は、lockfileどおりの依存関係を再現するため `npm ci` を使います。

```bash
git clone https://github.com/yo4e/DOGAGA.git
cd DOGAGA
npm ci
npm run dev
```

検証:

```bash
npm run typecheck
npm test
npm run build
```

production build outputは `dist/` です。

GitHub Actionsもclean checkout + Node.js 22 + `npm ci` で同じ検証を行います。

## 現在の制約 / 次の優先

compact production v0は機能を意図的に絞っています。現在の主な制約:

- 編集sessionの永続保存 / relinkは未実装
- multi-video-track / multi-audio-trackは未実装
- clip playback speed / fade in-outは未実装
- waveform / lyrics / captions / advanced effectsは未実装
- frame-perfectな業務用NLE精度は目標外

次の重要な製品課題は、**基本編集操作（split / speed / fade）の拡充、multi-track化、実利用で見つかるUX修正**です。

## WebMCP Challenge 2026

DOGAGAは2026-08-25以前から存在するプロジェクトです。Challenge期間中は、既存DOGAGAへbrowser-native WebMCP共同編集とcompact editor v0実装を追加しています。

Challenge用に別の固定demoアプリを作るのではなく、公開中のDOGAGA本体をそのまま提出・実演に使います。

Challenge提出動画は3分未満の実演動画として別途用意します。

## 長期ビジョン

将来的には、次の流れをブラウザだけで完結できる編集ツールを目指します。

> 楽曲を置く、映像を並べる、歌詞を同期する、文字を演出する、少し加工する、用途に合った形で書き出す。

万能なプロ向け編集ソフトではなく、音楽動画に必要十分な小型編集機を目指します。

## 計画・設計文書

- [プロダクト方針](docs/PRODUCT_VISION.md)
- [開発ロードマップ](docs/DEVELOPMENT_ROADMAP.md)
- [WebMCP競合調査](docs/WEBMCP_COMPETITOR_RESEARCH.md)
- [WebMCP compact v0実装方針](docs/WEBMCP_MVP_IMPLEMENTATION_PLAN.md)
- [権利・データ取扱方針](docs/RIGHTS_AND_DATA_POLICY.md)
- [ブラウザ・コーデック対応表](docs/CODEC_SUPPORT_MATRIX.md)
- [プロジェクト形式 v0.1](docs/PROJECT_FORMAT.md)
- [編集コマンドとUndo / Redoモデル](docs/EDIT_COMMAND_MODEL.md)
- [AI実装者向け作業規約](AGENTS.md)

通常ロードマップの長期設計は保持しつつ、現在動いているcompact production v0をDOGAGA本体として段階的に育てます。
