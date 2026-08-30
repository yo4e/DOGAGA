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
- 複数video track（V1 / V2 / ...）+ 複数audio track（A1 / A2 / ...）
- video / audio trackの追加・並べ替え
- video trackの表示/非表示・opacity
- audio trackのmute
- video clipを別video trackへ移動
- clip追加・並べ替え・trim・削除
- 再生ヘッド位置でのclip分割
- `⌘K` / `Ctrl+K` で選択clipを再生ヘッド位置で分割
- `Shift+D` で同一track上の選択clipと次clipの0.5秒cross dissolveを切替
- clip右クリックで再生速度変更（0.25× / 0.5× / 0.75× / 1× / 1.25× / 1.5× / 2×）
- clip右クリックでfade in / fade out（なし / 0.25秒 / 0.5秒 / 1秒 / 2秒）
- audio start / volume / remove
- cross dissolve追加・削除
- 実時間に比例したmulti-track timeline表示
- 再生ヘッド / timeline seek
- timeline表示倍率

### Preview

- actual local videoのplay / pause / seek
- 複数video trackの実合成
- video track opacity / visibilityの即時反映
- clip境界を越える再生
- trim / split / speed / fade / move / deleteの即時反映
- 複数audio trackの同時再生・mute
- clip fadeとcross dissolveを同じopacity計算で合成
- project canvas: 16:9 / 9:16 / 1:1 / 4:5
- source fit: 全体表示（contain）/ 画面いっぱい（cover）

video trackはorderが高いほど上に合成されます。cross dissolveは同一video track内の隣接clip間だけに設定します。

### 書き出し

- 現在の複数video / audio trackをブラウザ内で動画へ書き出し
- video track order / opacity / visibilityを反映
- 複数audio trackをWeb Audioでmixし、mute / clip volumeを反映
- trim / split / playback speed / fade / clip順 / canvas / contain-cover / cross dissolveを反映
- browser-native `canvas.captureStream()` + Web Audio + MediaRecorder
- 対応環境ではMP4を優先し、必要に応じてWebMへfallback
- server uploadなし
- progress / cancel / download

### WebMCP

DOGAGAは、現在開いている編集ページ自身がWebMCP toolsを公開します。

人間UIとbrowser agentは**同じEditor state / 同じcommand executor**を共同操作します。別MCP serverやagent専用timelineは使いません。

Editor stateの正本は `tracks[]` です。既存のagent workflowとの互換用に、safe stateではV1/A1由来のlegacy viewも当面返します。

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

既存toolは互換性を維持し、`add_clip` で `trackId` を省略するとV1、`set_audio` / `clear_audio` で省略するとA1を使います。

WebMCP対応環境では、人間が素材を読み込んだあと、agentがstateを読み、track追加・配置・編集を行い、人間の修正後に再読取して続きを編集できます。

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

- Desktop Chromeをmanual editor / Preview / Exportの第一基準にする
- ChatGPT Site Toolsは、2026-08-30時点ではChatGPT desktop appのbuilt-in browserで利用可能
- OpenAI公式Site Toolsは、2026-08-30時点ではChromeではまだ利用不可
- Chrome自身のWebMCPはChrome 149以降のorigin trial、またはlocal testing flagで試験可能
- WebMCP非対応browserでもmanual editor / actual preview / exportは利用可能

Codex Chrome extensionは既存Chrome profile/session/tabsを使うbrowser操作経路として利用できるが、現在のChrome Site Tools対応とは別物です。DOGAGAはChrome専用automationや独自extensionへ寄せず、標準WebMCP tool contractを維持します。

詳細と検証手順は [WebMCP browser compatibility](docs/WEBMCP_BROWSER_COMPATIBILITY.md) を参照してください。

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
- video/audio trackのlock UIは未実装
- audio clipのfade / 再生速度変更は未実装
- arbitrary clip positioning / gaps / drag trimは未実装
- waveform / lyrics / captions / advanced effectsは未実装
- frame-perfectな業務用NLE精度は目標外

次の重要な製品課題は、**multi-trackの実ブラウザQA、Chrome/WebMCP互換性確認、実利用で見つかるUX修正**です。

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
- [WebMCP browser compatibility](docs/WEBMCP_BROWSER_COMPATIBILITY.md)
- [権利・データ取扱方針](docs/RIGHTS_AND_DATA_POLICY.md)
- [ブラウザ・コーデック対応表](docs/CODEC_SUPPORT_MATRIX.md)
- [プロジェクト形式 v0.1](docs/PROJECT_FORMAT.md)
- [編集コマンドとUndo / Redoモデル](docs/EDIT_COMMAND_MODEL.md)
- [AI実装者向け作業規約](AGENTS.md)

通常ロードマップの長期設計は保持しつつ、現在動いているcompact production v0をDOGAGA本体として段階的に育てます。
