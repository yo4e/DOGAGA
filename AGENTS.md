# AGENTS.md — DOGAGA 作業規約

このファイルは、DOGAGAリポジトリで作業するCodexおよびその他のAI実装者向けの共通ルールである。

## 1. 現在の最優先

2026-08-30から通常DOGAGAロードマップをいったん保留し、**WebMCP Challengeの締切を使ってDOGAGA compact production v0を前進させるSprint**を最優先とする。

重要: Challenge専用のthrowaway demoを作るのではない。公開中のDOGAGA本体を、機能を絞った本番Webアプリとして育てる。Challenge向けに別実装・固定シナリオ・提出専用経路を作らない。

現在の正本:

- 司令塔: Issue #15の最新コメント
- 競合調査: `docs/WEBMCP_COMPETITOR_RESEARCH.md`
- 実装方針: `docs/WEBMCP_MVP_IMPLEMENTATION_PLAN.md`
- editing core / WebMCP: #20 / #21
- 公開版・提出・最終QA: #22

通常ロードマップ、旧Batch文書、Issue #2 / #4 / #18、PR #19は長期DOGAGAの資料として保持するが、現在のcompact production v0の開始ゲートではない。

## 2. 作業開始時に読むもの

毎回リポジトリ全体を監査しない。最低限:

1. この `AGENTS.md`
2. 対象Issue
3. 対象Issueが直接指定する実装・設計ファイル

必要な場合だけREADME、Roadmap、Project形式、EditCommand、ADR等を参照する。「念のため」で全Issue・全PR・全文書を横断しない。

## 3. compact production v0の中心

高機能NLEを一気に作るのではなく、**小さいが実際に使える本番版**を段階的に完成させる。

現在の中心:

1. 自分のlocal video / audioを読み込める
2. 人間がtimelineで基本編集できる
3. actual previewでplay / pause / seekできる
4. audioとcross dissolveを実際に反映する
5. project canvasを選べる
6. UIとbrowser agentが同じEditor state / command executorを使う
7. WebMCP toolsから同じlive stateを読み書きできる
8. Cloudflare上の公開版でも同じ動作を保つ

審査用に見えるだけのfake preview、ハードコード素材、agent専用state、別MCP server、提出動画だけ成立する特別経路は禁止。

Challenge用の「demo」は提出動画・説明上の実演を指し、DOGAGAアプリ本体をdemoとは呼ばない。

## 4. 技術方針

現在のcompact v0では次を採用する。

- React + TypeScript + Vite
- native `HTMLVideoElement` / `HTMLAudioElement` preview
- session-only runtime Asset binding
- shared Editor state / command executor
- `document.modelContext.registerTool()`
- `use-webmcp-tool`
- Cloudflare Pagesによる公開

WebCodecs、WebGPU、OPFS、IndexedDB、ffmpeg.wasm、完全な再リンク等は必要性を確認して段階導入する。大きな依存や新しいbackend / cloud / authが必要な場合は、人間判断を取る。

## 5. Projectとローカル素材

- `File`、File handle、absolute path、object URLをagentへ公開しない
- portable/editor stateとruntime bindingを分離する
- WebMCPはユーザーが読み込んだAsset IDだけを扱う
- 元動画・音声を無断で外部送信しない
- WebMCP adapter専用の第二Editor stateを作らない

session-only runtimeは現在の実装上の制約であり、編集機能をfakeにしてよいという意味ではない。

## 6. 共通conventions

- UI文言、Issue、PR、開発文書は原則日本語を正本とする
- code識別子、API名、型名は一般的な英語表記を使う
- 文字コードはUTF-8
- テスト素材は自作、public domain、または再配布条件が明確な素材だけを使う
- 大容量メディアをGitへ直接コミットしない
- 新しいfont / icon / sample media等はライセンスを確認する

## 7. GitとPR

- `main`へ直接コミットしない
- coherentな作業単位でbranch / PRを作る
- 無関係なリファクタリングを混ぜない
- PR本文に変更内容、検証、未検証事項を書く
- 一Issue一session / 一Issue一PRを絶対条件にしない

仕様にない重大な設計判断が必要な場合だけ #15へ `DESIGN_DECISION_REQUIRED` を残す。小さな実装詳細で逐一停止しない。

## 8. 検証

変更内容に直接関係する検証を行う。実装変更では可能な範囲で:

- typecheck
- lint（設定がある場合）
- unit tests
- build
- changed behaviorの実ブラウザ確認

command / WebMCP変更では特に:

- invalid inputでstateが壊れない
- UIとWebMCPが同じexecutorを使う
- File / object URL / path等がtool resultへ漏れない

実ブラウザが必要なものは、実行できなければ未検証として明記する。

変更と無関係な全docs監査、全fixture再照合、旧ロードマップ全acceptance確認等を毎回行わない。

## 9. 人間判断・実機確認

次は勝手に確定しない。

- プロダクト方向の大幅変更
- ライセンス変更
- ユーザー素材の外部送信
- 有料サービス / 新しい認証情報
- 大規模依存やbackend導入
- 不可逆なデータ削除
- セキュリティ / プライバシー / 法務上の重大判断

UIの見た目・操作感、動画 / 音声 / transitionの自然さなど主観的確認が必要な場合は `HUMAN_VISUAL_CHECK_REQUIRED` とする。ただし、先に進められるcode / test / docs作業は止めない。

## 10. 長期DOGAGA

compact production v0はthrowawayではなく、通常DOGAGAの本体として継続する。

現在省略している以下は、必要性と優先順位を確認しながら後続で追加する。

- 動画書き出し / download
- WebCodecs / export技術
- codec matrix
- Asset command / relink
- OPFS / IndexedDB
- `.dogaga` portability
- lyrics / text / waveform / effects

簡略化しているsession-only runtime等は恒久仕様と決め打ちせず、実利用を通じて再評価する。
