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

素材の準備、権利審査、ブラウザ実測は互いに独立した軸である。一つの`status`へまとめない。

### 3.1 準備状態

`preparationStatus`はファイルと生成・検査手順の準備状態だけを表す。

| 値 | 意味 | 次へ進む条件 |
|---|---|---|
| `planned` | 条件だけを定義し、ファイルは未準備 | 生成または収録する |
| `generated` | 指定条件で生成・収録したが、内容やメタデータを未検証 | ハッシュと構造を検証する |
| `verified` | 生成レシピ、SHA-256、内容、許可メタデータを確認した | 対象ブラウザで測定できる |
| `rejected` | 破損、条件不一致等によりfixtureとして使わない | 理由を残し、テストから除外する |

### 3.2 権利審査状態

`rights.reviewStatus`は`pending | reviewed | rejected`のいずれかとする。`reviewed`では`reviewedBy`と`reviewedAt`を必須とし、権利者、ライセンス選択状態、ローカル利用、CI artifact、共同開発者間の移送、公開再配布を個別に記録する。準備済みでも権利審査が`pending`なら、許可された範囲を超えて共有しない。

### 3.3 環境ごとの実測状態

実測はfixture直下の`measurements[]`へ、OS・OSバージョン・ブラウザ・ブラウザ完全バージョンごとに追加する。各レコードは`status`（`not-run | completed | blocked`）と操作別の`results`を持つ。ある環境の`completed`をfixture全体や別環境へ一般化しない。

`preparationStatus: verified`や`rights.reviewStatus: reviewed`を実測済みの代用にしてはならない。実測完了レコードには最低限、素材SHA-256、環境、実施日、操作別結果、測定者、関連Issueまたはログを記録する。

## 4. 必要素材マトリクス

正確な値、状態、fixture IDの正本は `test/fixtures/manifest.json` とする。Issue #2と#4の記録は次のIDを参照し、別名の同等fixtureを定義しない。

| fixture ID | 条件 | 主な目的 | 保管 | 準備状態 |
|---|---|---|---|---|
| `audio-silence-wav-1s` | 1秒、48kHz、mono、PCM 16-bit | 無音、duration、mono | 都度生成 | `verified` |
| `audio-sync-pulses-wav-3s` | 3秒、48kHz、stereo、0.5/1.5/2.5秒 | A/V同期、シーク基準 | 都度生成 | `verified` |
| `audio-tone-wav-3s` | 3秒、48kHz、stereo、左右別周波数 | 波形、チャンネル処理 | 都度生成 | `verified` |
| `image-color-bars-png` | 320×180、RGB | 画像読込、色、16:9 | 都度生成 | `verified` |
| `image-seek-grid-png` | 320×180、RGB | 合成座標、比率 | 都度生成 | `verified` |
| `image-alpha-gradient-png` | 320×180、RGBA、alpha勾配 | 透明度読込・合成 | 都度生成 | `verified` |
| `video-mp4-h264-aac-cfr-720p-10s` | H.264/AAC、720p/30fps/CFR、10秒 | 最小読込、再生、同期 | ローカル | `planned` |
| `video-mp4-h264-aac-cfr-1080p-30s` | H.264/AAC、1080p/30fps/CFR、30秒 | Issue #2完了条件、書出し | ローカル | `planned` |
| `video-mp4-h264-aac-cfr-1080p-60s` | H.264/AAC、1080p/30fps/CFR、60秒 | メモリ、長めのシーク | ローカル | `planned` |
| `video-mp4-h264-aac-vfr-1080p-30s` | H.264/AAC、1080p/VFR、30秒 | PTS、シーク、CFR変換 | ローカル | `planned` |
| `video-mp4-h264-cfr-720p-10s-no-audio` | H.264、720p/30fps/CFR、音声なし | 映像だけの正常入力 | ローカル | `planned` |
| `video-iphone-physical-avc-vfr-silent` | iPhone実機AVC、無音 | 回転、VFR、メタデータ | 非公開ローカル | `planned` |
| `video-iphone-physical-avc-vfr-av-sync` | iPhone実機AVC、管理された基準音 | 実機A/V同期 | 非公開ローカル | `planned` |
| `video-iphone-physical-hevc-hdr-silent` | iPhone実機HEVC/HDR、無音 | 非対応・条件付きの負例 | 非公開ローカル | `planned` |
| `video-webm-vp8-opus-720p-10s` | VP8/Opus、720p/30fps、10秒 | 非MP4比較経路 | ローカル | `planned` |
| `video-webm-vp9-opus-720p-10s` | VP9/Opus、720p/30fps、10秒 | 非MP4比較経路 | ローカル | `planned` |
| `audio-mp3-cbr-3s` | CBR、3秒 | duration解析 | ローカル | `planned` |
| `audio-mp3-vbr-30s` | VBR、30秒 | duration、シーク | ローカル | `planned` |
| `image-jpeg-orientation-set` | 320×180、Orientation 1/6/8 | EXIF回転、メタデータ | ローカル | `planned` |
| `negative-mp4-truncated` | 基本MP4の末尾を切断 | 破損入力のエラー | ローカル | `planned` |
| `negative-fake-extension-mp4` | PNG内容を`.mp4`名で提示 | 内容と拡張子の不一致 | ローカル | `planned` |

MP4の映像にはフレーム番号ではなく、単純な時間マーカー、色変化、移動図形を使う。音声はこのリポジトリが生成する基準パルスまたは連続音を多重化する。フォント依存の文字描画は再現性を下げるため必須にしない。

「iPhone相当の合成ファイル」と「iPhone実機で撮影したファイル」は別IDにする。合成ファイルだけで実機検証済みとはしない。実機撮影時は、無地の壁や自作パターンだけを写し、撮影場所を推測できる対象を避ける。

回転・VFR・HDR・メタデータ確認用は無音の`video-iphone-physical-avc-vfr-silent`または`video-iphone-physical-hevc-hdr-silent`とする。A/V同期は、管理された環境で自作の映像マーカーと基準音だけを収録した`video-iphone-physical-avc-vfr-av-sync`で測る。無音fixtureの結果でA/V同期を`pass`にしてはならない。

## 5. 標準fixtureの再生成

Python 3の標準ライブラリだけで、WAV 3件とPNG 3件（RGB 2件、RGBA 1件）を生成できる。パッケージ追加、FFmpeg、ネットワークアクセスは不要である。

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

生成パターンには第三者素材を含めない。標準生成器とその生成物の権利者・許諾主体は、現時点では`yo4e（DOGAGAリポジトリ管理者・生成器の提供者）`としてmanifestへ明記する。yo4eは次のDOGAGA開発内利用を許可する。

- 開発者端末でのローカルテスト
- 同一DOGAGAプロジェクトのCIで生成し、その実行のartifactとして受け渡すこと
- DOGAGA共同開発者間で、検証に必要な生成物を受け渡すこと

リポジトリと生成物へ適用する公開ライセンスはまだ選択していないため、`rights.license.status`は`not-selected`、`identifier`は`null`とする。これはライセンス名としての`NOASSERTION`ではない。公開配布、一般向けダウンロード、他プロジェクトへの再配布は`rights.permissions.publicRedistribution: pending`とし、リポジトリのライセンス決定後に再審査する。CI artifactも公開配布場所として恒久保存せず、DOGAGA開発の必要範囲だけで扱う。

アルゴリズムを変更するとSHA-256が変わる。変更時は`--report`の結果を確認し、`generatorVersion`を上げ、目的に照らしたレビュー後にmanifestを更新する。

### 映像・圧縮音声fixture

H.264、AAC、VP8、VP9、Opus、MP3、JPEGはエンコーダーと設定が結果へ影響するため、この標準生成器の対象外とする。Issue #2または#4で生成するときは、次を追加記録する。

- 生成ツール名、完全なバージョン、入手元
- 実行したコマンドまたは設定ファイル
- エンコーダー名、codec profile/level、pixel format、rate control
- container time base、映像と音声の開始PTS、キーフレーム間隔
- FFmpegを使う場合はビルド設定とライセンス
- 生成後の`ffprobe`等の出力とSHA-256

ツールの導入とライセンス確認が済むまでは、FFmpegコマンドを本書の正本レシピとして固定しない。別マシンで同一バイト列にならないエンコーダーでは、バイト完全一致ではなく、入力パターン、エンコード設定、解析済みメディア属性を再現条件とする。

## 6. 権利・個人情報チェック

素材の`rights.reviewStatus`を`reviewed`へ進める前に、担当者が次を確認する。

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

一つでも不明なら`rights.reviewStatus`を`pending`または`rejected`のままにし、許可状態が`pending`のGit、CI、共同開発者、外部保管先へ移さない。準備不成立なら`preparationStatus`も`planned`または`rejected`とする。

## 7. ライセンス記録テンプレート

第三者素材または実機素材ごとに、manifestと同じIDを使って次を記録する。

```yaml
id: 一意で個人名や機密情報を含まない素材ID
fileName: ローカルでの非個人的なファイル名、未準備ならnull
preparationStatus: planned | generated | verified | rejected
mediaType: MIME type
purpose:
  - 検証目的
properties:
  durationSeconds: 数値または条件
rights:
  origin: self-generated | public-domain | licensed-third-party | physical-device と出所詳細
  thirdPartyContent: true | false
  rightsHolder: 権利者または許諾主体の明示名
  license:
    status: not-selected | selected
    identifier: SPDX識別子、正式名称、または未選択時null
  reviewStatus: pending | reviewed | rejected
  reviewedBy: reviewed時のGitHubユーザー名
  reviewedAt: reviewed時のYYYY-MM-DD
  permissions:
    localDevelopment: allowed | prohibited | pending
    ciArtifactTransfer: allowed | prohibited | pending
    collaboratorTransfer: allowed | prohibited | pending
    publicRedistribution: allowed | prohibited | pending
  basis: 許諾根拠、証跡、未解決事項
privacy:
  people: none | consent-recorded | unknown
  voices: none | consent-recorded | unknown
  logos: none | authorized | unknown
  location: none | removed | unknown
  metadata: none | removed | unknown
storage:
  class: generated | local-only | private-local-only | restricted-external
  locationId: 秘密情報を含まない保管先ID、未配置ならnull
measurements: []
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

実測結果は準備状態や権利審査状態を上書きせず、対象fixtureの`measurements[]`へ一回の環境・実行につき一レコードを追加する。

```json
{
  "environment": {
    "os": "macOS",
    "osVersion": "具体的なバージョン",
    "browser": "Google Chrome",
    "browserVersion": "完全なバージョン",
    "hardware": "必要な範囲のCPU/GPU/メモリ"
  },
  "status": "completed",
  "fixtureSha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "measuredAt": "2026-07-17T00:00:00+09:00",
  "measuredBy": "GitHubユーザー名",
  "results": {
    "importRead": "pass",
    "htmlMediaElementPlayback": "pass",
    "seek": "pass",
    "waveform": "pass",
    "webCodecsDecode": "not-run",
    "encode": "not-run",
    "mux": "not-run",
    "reImport": "not-run"
  },
  "metrics": {
    "seekErrorUs": null,
    "audioSyncErrorUs": null,
    "peakMemoryMegabytes": null,
    "exportSeconds": null
  },
  "evidence": "ログ、スクリーンショット、IssueまたはPRへの参照",
  "notes": "失敗条件と回避策"
}
```

例の`fixtureSha256`は形式を示すダミー値なので、実ファイル全体のSHA-256へ置き換える。操作別結果は`pass | fail | not-run | inconclusive | not-applicable`のいずれかとする。`seekErrorUs`と`audioSyncErrorUs`は整数マイクロ秒で記録し、未測定時は`null`とする。`not-run`や`null`を成功値で埋めない。公式仕様、`isConfigSupported()`、`canPlayType()`等の自動判定、実ブラウザでの操作結果は別欄に記録する。あるOS・ブラウザの`status: completed`を別環境へ一般化しない。

外部ログで使う`fixtureId`はテスト素材台帳内のIDであり、`.dogaga`プロジェクト内の`asset.id`とは別の名前空間である。`fixtureSha256`はファイル全体のSHA-256であり、再リンク候補用の`asset.fingerprint`の拡張可能な`method` / `value`とは別の記録である。同じアルゴリズムだと仮定しない。fixtureの`preparationStatus`、`rights.reviewStatus`、`measurements[].status`はいずれもProjectの`asset.linkState`（`unchecked` / `available` / `missing`）とは関連付けない。

## 11. 今回の検証済み範囲と未解決事項

この方針の追加時点で確認したのは、標準生成器によるWAV 3件とPNG 3件の決定的な生成、SHA-256、チャンク制限、およびplanned fixtureを含むmanifest全21件の最低構造だけである。ブラウザでの読み込み、シーク、音ズレ、書き出し、macOS/Windows差は実機未検証であり、Issue #2/#4で測定する。

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
