# DOGAGA テスト素材方針

更新日: 2026-07-17

## 1. 目的と適用範囲

この文書は、Issue #2の技術スパイクとIssue #4のブラウザ・コーデック検証に使う動画、音声、画像の準備、権利確認、保管、状態記録を定める。

テスト素材は、再生できたことを示すだけでなく、シーク、音声同期、可変フレームレート（VFR）、メモリ、書き出しを同じ条件で再検証できる必要がある。一方、権利不明素材、個人情報、大容量バイナリはリポジトリへ持ち込まない。

本書は法律相談ではない。一般公開する素材、外部保管サービス、第三者素材を採用する前に、権利者とライセンス条件を人間が確認する。

## 2. 原則

1. 自作の抽象パターン、合成音、単色・幾何学画像を第一選択にする。
2. 人物、肉声、市販楽曲、歌詞、ロゴ、キャラクター、実在の住所・位置情報を含めない。
3. Gitには生成スクリプト、manifest、検証記録だけを置く。メディア生成物は既定で置かない。
4. 第三者素材は、利用だけでなく改変、再配布、CI利用の条件を確認するまで隔離する。
5. `生成できた`、`生成結果を検証した`、`実ブラウザで測定した`を別の状態として記録する。
6. 自動ダウンロードを既定にしない。外部送信や外部取得なしで基本fixtureを生成できるようにする。
7. 実機素材が必要な場合も、元ファイルはローカルまたはアクセス制限された保管先に置き、manifestには個人情報を含まないIDとハッシュだけを記録する。

## 3. 状態モデル

素材の状態は次のいずれかとする。状態はファイルの存在ではなく、確認済み範囲を表す。

| 状態 | 意味 | 次へ進む条件 |
|---|---|---|
| `planned` | 条件だけを定義し、ファイルは未準備 | 生成または権利審査を完了する |
| `generated` | 指定条件で生成したが、決定性・内容・メタデータを未検証 | ハッシュと構造を検証する |
| `generation-verified` | 生成レシピ、SHA-256、許可メタデータを確認した | 対象ブラウザで測定する |
| `rights-reviewed` | 第三者素材の出所と利用条件を人間が確認した | 必要ならメタデータ除去後に測定する |
| `measured` | 特定OS・ブラウザ・バージョンで実測記録がある | 別環境の結果は別レコードとして追加する |
| `rejected` | 権利、個人情報、破損、条件不一致等により使用しない | 理由を残し、テストから除外する |

`generation-verified`や`rights-reviewed`を`measured`の代用にしてはならない。実測記録には最低限、素材ID、素材SHA-256、OS、ブラウザ名と完全なバージョン、実施日、結果、測定者、関連Issueまたはログを記録する。

## 4. 必要素材マトリクス

正確な値と状態の正本は `test/fixtures/manifest.json` とする。次の表はテスト目的の一覧である。

| 区分 | 条件 | 主な目的 | 保管 | 初期状態 |
|---|---|---|---|---|
| WAV無音 | 1秒、48kHz、mono、PCM 16-bit | 無音、duration、mono | 都度生成 | `generation-verified` |
| WAV基準パルス | 3秒、48kHz、stereo、0.5/1.5/2.5秒 | A/V同期、シーク基準 | 都度生成 | `generation-verified` |
| WAV連続音 | 3秒、48kHz、stereo、左右別周波数 | 波形、チャンネル処理 | 都度生成 | `generation-verified` |
| PNGカラーバー | 320×180、RGB | 画像読込、色、16:9 | 都度生成 | `generation-verified` |
| PNG座標グリッド | 320×180、RGB | 合成座標、比率 | 都度生成 | `generation-verified` |
| MP4基本 | H.264/AAC、720p/30fps/CFR、10秒 | 最小読込、再生、同期 | ローカル | `planned` |
| MP4基準負荷 | H.264/AAC、1080p/30fps/CFR、30秒 | Issue #2完了条件、書出し | ローカル | `planned` |
| MP4長さ | H.264/AAC、1080p/30fps/CFR、60秒 | メモリ、長めのシーク | ローカル | `planned` |
| MP4 VFR | H.264/AAC、1080p、VFR、30秒 | PTS、シーク、CFR変換 | ローカル | `planned` |
| iPhone実機 | 10〜30秒、回転情報、実際のVFR/codecを解析 | 実機由来の差 | 非公開ローカル | `planned` |
| WebM | VP9/Opus、720p/30fps、10秒 | 非MP4入力 | ローカル | `planned` |
| MP3 | CBR 3秒、VBR 30秒 | duration、シーク | ローカル | `planned` |
| JPEG | 320×180、Orientation 1/6/8 | EXIF回転、メタデータ | ローカル | `planned` |

MP4の映像にはフレーム番号ではなく、単純な時間マーカー、色変化、移動図形を使う。音声はこのリポジトリが生成する基準パルスまたは連続音を多重化する。フォント依存の文字描画は再現性を下げるため必須にしない。

「iPhone相当の合成ファイル」と「iPhone実機で撮影したファイル」は別IDにする。合成ファイルだけで実機検証済みとはしない。実機撮影時は、無地の壁や自作パターンだけを写し、音声を無効化できる場合は無効化し、撮影場所を推測できる対象を避ける。

## 5. 標準fixtureの再生成

Python 3の標準ライブラリだけで、WAV 3件とPNG 2件を生成できる。パッケージ追加、FFmpeg、ネットワークアクセスは不要である。

```bash
python3 scripts/generate_test_fixtures.py --check
python3 scripts/generate_test_fixtures.py --output-dir test/fixtures/generated
```

生成器は次を保証する。

- 浮動小数点、現在時刻、乱数、OSフォントを使わない。
- manifest記載のバイト数とSHA-256が一致しなければ失敗する。
- PNGは`IHDR`、`IDAT`、`IEND`チャンクだけを持つ。tEXt、eXIf、iTXt等を持たない。
- WAVは`fmt `、`data`チャンクだけを持つ。LIST/INFO、端末名、作成日時等を持たない。
- 既存内容が異なるファイルやシンボリックリンクを上書きしない。
- 生成物は `.gitignore` の対象であり、通常のレビュー差分へ入らない。

生成パターンには第三者素材を含めない。ただし、このリポジトリ自体のライセンスが未設定であるため、manifestの`license`は`NOASSERTION`、用途はDOGAGAのローカルテスト、再配布は禁止として記録する。将来、生成fixtureを配布またはCI間で共有する場合は、リポジトリ管理者が適用ライセンスを明示してから`rights-reviewed`へ進める。

アルゴリズムを変更するとSHA-256が変わる。変更時は`--report`の結果を確認し、`generatorVersion`を上げ、目的に照らしたレビュー後にmanifestを更新する。

### 映像・圧縮音声fixture

H.264、AAC、VP9、Opus、MP3、JPEGはエンコーダーと設定が結果へ影響するため、この標準生成器の対象外とする。Issue #2または#4で生成するときは、次を追加記録する。

- 生成ツール名、完全なバージョン、入手元
- 実行したコマンドまたは設定ファイル
- エンコーダー名、codec profile/level、pixel format、rate control
- container time base、映像と音声の開始PTS、キーフレーム間隔
- FFmpegを使う場合はビルド設定とライセンス
- 生成後の`ffprobe`等の出力とSHA-256

ツールの導入とライセンス確認が済むまでは、FFmpegコマンドを本書の正本レシピとして固定しない。別マシンで同一バイト列にならないエンコーダーでは、バイト完全一致ではなく、入力パターン、エンコード設定、解析済みメディア属性を再現条件とする。

## 6. 権利・個人情報チェック

素材を`rights-reviewed`へ進める前に、担当者が次を確認する。

### 権利

- [ ] 作者、権利者、配布元が特定できる
- [ ] ライセンス名、版、原文URL、取得日を記録した
- [ ] テスト利用、改変、再配布、CIでの複製、商用開発での利用可否を確認した
- [ ] 必要なクレジット方法と配布時のライセンス同梱条件を記録した
- [ ] 楽曲、歌詞、肉声、フォント、ロゴ、商標、キャラクター、アートワークを含まない、または個別に許諾を記録した
- [ ] AI生成物の場合、利用サービス、生成日、入力元、利用規約、学習元に関する既知情報を記録した
- [ ] 「著作権フリー」「royalty-free」という説明だけで採用していない

### 人物・プライバシー

- [ ] 顔、身体的特徴、声、氏名、住所、車両番号、画面通知等が写っていない
- [ ] 未成年者や第三者の私的空間が含まれない
- [ ] GPS、撮影日時、端末名・シリアル、作者名、編集履歴、サムネイル等のメタデータを調べた
- [ ] 不要メタデータを除去し、除去後のファイルを再解析した
- [ ] ファイル名とログにも個人名、場所、端末名を残していない

一つでも不明なら`planned`または`rejected`のままにし、Git、CI、外部保管先へ移さない。

## 7. ライセンス記録テンプレート

第三者素材または実機素材ごとに、manifestと同じIDを使って次を記録する。

```yaml
id: 一意で個人名や機密情報を含まない素材ID
file_name: ローカルでの非個人的なファイル名
sha256: 64桁のSHA-256
status: planned | rights-reviewed | measured | rejected
source:
  type: self-generated | public-domain | licensed-third-party | physical-device
  title: 素材名
  creator: 作者または権利者
  original_url: ライセンス原文へ到達できるURL
  acquired_at: YYYY-MM-DD
license:
  name: SPDX識別子または正式名称
  version: 版
  commercial_use: allowed | prohibited | unknown
  modification: allowed | prohibited | unknown
  redistribution: allowed | prohibited | unknown
  attribution: 表示内容またはnone
  evidence: 保存した原文、スクリーンショット、Issueへの参照
changes:
  - 切り出し、再エンコード、メタデータ除去等
privacy:
  people: none | consent-recorded | unknown
  voice: none | consent-recorded | unknown
  location: none | removed | unknown
  metadata_checked_with: ツール名と完全なバージョン
  metadata_removed: true | false
storage:
  class: generated | local-only | restricted-external
  location_id: 秘密情報を含まない保管先ID
verification:
  generated_with: ツールと完全なバージョン
  media_inspection: 実行コマンドまたはログ参照
  browser_measurements: []
reviewed_by: GitHubユーザー名
reviewed_at: YYYY-MM-DD
notes: 未解決事項
```

URLだけではライセンス変更や配布終了へ耐えない。許される範囲でライセンス原文または証跡を保管し、取得日時点の条件を追跡する。アクセス制限された原本のURL、署名付きURL、個人名は公開manifestへ書かない。

## 8. Gitへ含める上限

初期運用では次を上限とする。

- メディアバイナリ1ファイル: 256 KiB以下
- PRで追加するメディアバイナリ合計: 1 MiB以下
- リポジトリ内のメディアfixture総量: 1 MiB以下

ただし、上限以下なら自動的にコミットしてよいわけではない。生成で再現できる素材はコミットせず、権利台帳、必要性、レビュー上の利点がある最小素材だけを例外として提案する。例外はPR本文にサイズ、SHA-256、権利記録、生成できない理由を書く。

Issue #8時点では、メディアバイナリを一つもGitへ追加しない。Git LFSも導入しない。LFSはリポジトリ履歴からバイナリを消す仕組みではなく、権利・容量・取得制御の問題を解決しないためである。将来、再現不能なfixtureを複数人やCIで共有する必要が明確になった時点で、LFSとアクセス制限付きオブジェクトストレージを比較する。

## 9. 大容量・実機素材の保管

大容量素材と実機素材は、開発者が選んだローカルの`DOGAGA_TEST_MEDIA_DIR`配下へ、manifest IDをディレクトリ名として保管する。ソースコードからこの環境変数を必須にせず、テスト実行時だけ明示する。

```text
DOGAGA_TEST_MEDIA_DIR/
  manifest-private.json
  video-mp4-h264-aac-cfr-1080p-30s/
    source.mp4
    inspection.json
    LICENSE.txt
```

保管先の条件:

- OSのバックアップや同期設定を含め、意図しないクラウド送信がないことを確認する。
- 共有が必要なら、権限管理、削除手順、保存期間、漏えい時の連絡方法が決まった保管先だけを使う。
- 公開manifestにはSHA-256と非機密な媒体属性だけを記録し、署名付きURLや端末所有者の情報を書かない。
- 取得手順は人間の明示操作とし、CIが権利未確認ファイルを自動取得しない。
- CIでは生成fixtureだけを既定で使い、制限付き素材がない場合は明示的にskipする。

## 10. Issue #2/#4での記録方法

実測結果は素材台帳を直接上書きするのではなく、一回の環境・実行につき一レコードを追加する。

```json
{
  "fixtureId": "video-mp4-h264-aac-cfr-1080p-30s",
  "fixtureSha256": "...",
  "testedAt": "2026-07-17T00:00:00+09:00",
  "tester": "GitHubユーザー名",
  "environment": {
    "os": "macOS 具体的なバージョン",
    "browser": "Google Chrome 完全なバージョン",
    "hardware": "必要な範囲のCPU/GPU/メモリ"
  },
  "operations": {
    "load": "pass | fail | not-run",
    "playback": "pass | fail | not-run",
    "seek": "pass | fail | not-run",
    "audioSync": "pass | fail | not-run",
    "export": "pass | fail | not-run"
  },
  "metrics": {
    "seekErrorMilliseconds": null,
    "audioSyncErrorMilliseconds": null,
    "peakMemoryMegabytes": null,
    "exportSeconds": null
  },
  "evidence": "ログ、スクリーンショット、IssueまたはPRへの参照",
  "notes": "失敗条件と回避策"
}
```

`not-run`や`null`を成功値で埋めない。公式仕様、`isConfigSupported()`、`canPlayType()`等の自動判定、実ブラウザでの操作結果は別欄に記録する。あるOS・ブラウザの`measured`を別環境へ一般化しない。

ここで使う`fixtureId`はテスト素材台帳内のIDであり、`.dogaga`プロジェクト内の`asset.id`とは別の名前空間である。`fixtureSha256`はファイル全体のSHA-256で、再リンク候補用の`asset.fingerprint`（`sha256-sampled-v1`候補）ではない。また、fixtureの`status`は素材準備・検証の進行状態であり、Projectの`asset.linkState`（`unchecked` / `available` / `missing`）とは関連付けない。

## 11. 今回の検証済み範囲と未解決事項

この方針の追加時点で確認したのは、標準生成器によるWAV/PNGの決定的な生成、SHA-256、チャンク制限だけである。ブラウザでの読み込み、シーク、音ズレ、書き出し、macOS/Windows差は実機未検証であり、Issue #2/#4で測定する。

未解決事項:

- H.264/AAC、WebM、MP3、JPEGを生成するツールとバージョン
- FFmpegまたはffmpeg.wasmを使う場合の実ビルド構成とライセンス
- iPhone実機素材の機種、OS、codec、HDR、回転情報の組み合わせ
- 大容量素材の共有が必要になった場合の保管先と保存期間
- CIで圧縮codecを含むfixtureを生成するか、アクセス制限付き素材を取得するか
- Gitのバイナリ上限を運用実績に応じて維持・変更するか
- リポジトリと生成fixtureへ適用するライセンス

## 12. 関連文書

- `docs/RIGHTS_AND_DATA_POLICY.md`
- `docs/CODEC_SUPPORT_MATRIX.md`（Issue #4で作成予定）
- `docs/DEVELOPMENT_ROADMAP.md`
- `docs/CODEX_BATCH_01.md`
- Issue #2、#4、#8
