# AGENTS.md — DOGAGA 作業規約

このファイルは、DOGAGAリポジトリで作業するCodexおよびその他のAI実装者向けの共通ルールである。

## 1. 現在の最優先

2026-08-30から、通常DOGAGAロードマップはいったん保留し、**WebMCP Challenge向け短期Sprint**を最優先とする。

現在の正本:

- 司令塔: Issue #15の最新コメント
- 競合調査: `docs/WEBMCP_COMPETITOR_RESEARCH.md`
- 実装方針: `docs/WEBMCP_MVP_IMPLEMENTATION_PLAN.md`
- 実装Issue: #20 / #21
- 提出・最終QA: #22

通常ロードマップ、旧Batch文書、Issue #2 / #4 / #18、PR #19は長期DOGAGAの資料として保持するが、**現在のWebMCP Sprintの実装開始ゲートではない**。

## 2. 作業開始時に読むもの

毎回リポジトリ全体を監査しない。

最低限:

1. この `AGENTS.md`
2. 対象Issue
3. 対象Issueが直接指定する実装・設計ファイル

WebMCP Sprintでは、初回または方針確認が必要なときだけ `docs/WEBMCP_MVP_IMPLEMENTATION_PLAN.md` を読む。

次の文書は、対象作業に必要な場合だけ参照する。

- `README.md`
- `docs/PRODUCT_VISION.md`
- `docs/DEVELOPMENT_ROADMAP.md`
- `docs/PROJECT_FORMAT.md`
- `docs/EDIT_COMMAND_MODEL.md`
- ADR類
- rights / lyrics / codec / test-media等の個別文書

**「念のため」だけを理由に全設計文書、全Issue、全PRを毎回横断しない。**

## 3. WebMCP Sprintの中心

今回作るものは、高機能AI動画編集ソフトではない。

> ブラウザで開いている動画編集ページ自身がWebMCP toolsを公開し、人間UIとbrowser agentが同じProject state / command executorを共同操作する最小デモ。

優先順位:

1. local video / audioを人間が読み込める
2. 人間が基本編集できる
3. UIとagentが同じcommand executorを使う
4. WebMCP toolsから同じstateを読み書きできる
5. agent編集 → 人間修正 → agent再読取・再編集を示せる
6. public demoとして提出できる

完成版NLEの機能量は優先しない。

## 4. 技術方針

Sprintでは次を採用してよい。

- React + TypeScript + Vite
- native `HTMLVideoElement` / `HTMLAudioElement` preview
- session-only runtime Asset binding
- simple command executor
- `document.modelContext.registerTool()`
- WebMCP lifecycle用の小規模React helper

WebCodecs、WebGPU、OPFS、IndexedDB、ffmpeg.wasm、完全な再リンク等は必要になった時だけ導入する。

大きな依存や新しいbackend / cloud / authを必要とする場合は止めて理由を報告する。

## 5. Projectとローカル素材

- `File`、File handle、absolute path、object URLをagentへ公開しない
- portable Project dataとruntime bindingを分離する
- WebMCPはユーザーがすでに読み込んだAsset IDだけを扱う
- 元動画・音声を無断で外部送信しない
- WebMCP adapter専用の第二Project stateを作らない

Issue #18 / PR #19の長期Asset registration / relink設計は今回の実装ゲートではない。Sprintでは `docs/WEBMCP_MVP_IMPLEMENTATION_PLAN.md` のsession-only境界を使う。

## 6. GitとPR

- `main`へ直接コミットしない
- coherentな作業単位でbranch / PRを作る
- 無関係なリファクタリングを混ぜない
- PR本文に変更内容、検証、未検証事項を書く

**一Issue一session、一Issue一PRを絶対条件にしない。**

#20のediting coreから#21のWebMCP adapterまで、一つの実装として自然に連続する場合は同じbranch / PRで進めてよい。PR分割そのものを目的にしない。

仕様にない重大な設計判断が必要な場合だけ、影響箇所を止めて #15へ `DESIGN_DECISION_REQUIRED` を残す。小さな実装詳細まで逐一停止しない。

## 7. 検証

変更内容に直接関係する検証を行う。

実装変更では可能な範囲で:

- typecheck
- lint
- unit tests
- build
- changed behaviorの確認

command / WebMCP変更では特に:

- invalid inputでstateが壊れない
- UIとWebMCPが同じexecutorを使う
- File / object URL / path等がtool resultへ漏れない

実ブラウザが必要なものは、実行できなければ未検証として明記する。

### 毎回は不要な監査

変更と無関係なら次は行わない。

- 全docsの全文横断照合
- Markdown code fence数 / table数の監査
- 全fixture IDの再照合
- 旧用語の全repository検索
- 通常ロードマップ全acceptanceの再確認
- macOS / Windows双方のcodec matrix再測定
- 変更していないSchema / fixtureの再検証

「検証を多く行ったこと」ではなく、**変更を壊していないことを必要十分に確認できたこと**を完了条件とする。

## 8. 人間判断・実機確認

次は勝手に確定しない。

- プロダクト方向の大幅変更
- ライセンス変更
- ユーザー素材の外部送信
- 有料サービス / 新しい認証情報
- 大規模依存やbackend導入
- 不可逆なデータ削除
- セキュリティ / プライバシー / 法務上の重大判断

次は必要に応じて `HUMAN_VISUAL_CHECK_REQUIRED` とする。

- UIの見た目・操作感
- 動画 / 音声 / transitionの自然さ
- 実ブラウザWebMCP scenario

ただし、実機確認が必要という理由だけで、それ以前にできるcode / test / docs作業を止めない。

## 9. 長期DOGAGA

通常ロードマップは削除しない。

WebMCP Challenge後、次を改めて評価する。

- Issue #2 WebCodecs / export技術スパイク
- Issue #4 codec matrix
- Issue #18 / PR #19 Asset command / relink
- OPFS / IndexedDB
- `.dogaga` portability
- lyrics / text / waveform / export

Sprintの簡易実装をそのまま恒久設計とみなさず、成果を長期設計へ統合する。
