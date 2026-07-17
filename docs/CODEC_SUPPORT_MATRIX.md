# DOGAGA ブラウザ・コーデック対応表と検証計画

- 文書状態: Draft（実機検証前）
- 更新日: 2026-07-17
- 対象Issue: [#4](https://github.com/yo4e/DOGAGA/issues/4)
- 引き継ぎ先: [#2](https://github.com/yo4e/DOGAGA/issues/2)

## 0. 現在の結論

この文書を作成した環境では、対象ブラウザを使った素材の読み込み、再生、シーク、書き出しを実行していない。したがって、現時点で実測結果を示す行はすべて **未検証** であり、DOGAGAが特定形式に対応済みであることを示すものではない。

Phase 0で最初に成立性を確認する範囲は、次のように暫定決定する。

- 第一入力候補: 最大1080p / 30fps / SDRのH.264映像とAAC-LC音声を持つMP4
- 主要な追加入力候補: MP3、リニアPCM WAV、PNG、JPEG
- 条件付き入力候補: H.264 / AACのiPhone撮影MP4（可変フレームレートを含む）
- 比較対象: VP8 / OpusまたはVP9 / Opusを持つWebM
- MVP初期保証の対象外: HEVC / HDR / 4K / 60fpsのiPhone素材、ProRes、AV1、モバイルブラウザ
- 第一出力候補: 最大1080p / 30fpsのH.264 / AAC-LC MP4

ここでいう「候補」「対象外」は製品スコープ上の分類であり、ブラウザの技術的な「対応」「非対応」とは別である。第一・第二基準環境の実測を終えるまで、リリース時の対応形式として確定しない。

## 1. 目的と範囲

この文書には、次を記録する。

- 対応状態と根拠の定義
- ブラウザAPIによる能力判定と実ブラウザでの動作確認の区別
- OS、ブラウザ、素材条件を固定した検証ケース
- 読み込み、再生、シーク、音ズレ、性能、メモリ、書き出しの記録方法
- 初期対応範囲の暫定判断
- 非対応素材をユーザーへ案内する方針
- Issue #2で実測し、技術判断を確定するための引き継ぎ事項

対象はデスクトップブラウザである。macOS + Chrome最新版を第一基準、Windows + Chrome / Edge最新版を第二基準とし、SafariとFirefoxは将来確認、スマートフォンはMVP初期対象外とする。

この文書だけでは、次を決定しない。

- MP4のdemux / muxライブラリ
- ffmpeg.wasmの採否とビルド構成
- H.264 / AAC等の特許ライセンス上の最終判断
- 完成版のメディア処理アーキテクチャ
- Safari、Firefox、モバイルブラウザの製品サポート

## 2. 状態と根拠の定義

### 2.1 対応状態

| 状態 | 定義 | 使用条件 |
|---|---|---|
| 対応 | 指定したOS、ブラウザ、素材条件、DOGAGAの処理経路で必須検証を通過した | 実測記録、素材ID、ブラウザの完全なバージョン、検証コミットが揃っている |
| 条件付き | 制限または既知の回避策を満たす場合だけ必須検証を通過した | 対応するプロファイル、解像度、fps、色空間、音声条件等を併記する |
| 非対応 | 指定条件で再現性をもって処理できず、MVPでは受け入れないと判断した | 失敗した処理段階、再現手順、ユーザー向け代替手段を併記する |
| 未検証 | 仕様またはAPI上の情報しかない、あるいは実測記録が不足している | 推測で別の状態へ変更しない |

APIが `supported: true` を返しただけでは「対応」にしない。逆に、MVP初期保証の対象外という製品判断だけで「非対応」にもしない。対応状態は、環境と素材条件ごとの実測結果として管理する。

### 2.2 根拠レベル

| 記号 | 根拠 | 分かること | 分からないこと |
|---|---|---|---|
| S | 公式仕様・公式実装資料 | APIの契約、登録済みcodec string、一般的な制約 | 対象端末での可否、速度、安定性 |
| A | 対象ブラウザ上の能力判定API | その時点の構成に対するブラウザの自己申告 | 実ファイルのdemux、正しい出力、長時間安定性 |
| E | 権利確認済み素材を使った実機検証 | 指定環境と素材におけるDOGAGA経路の結果 | 未検証の別環境、別プロファイル、別素材への一般化 |

対応状態を「対応」「条件付き」「非対応」のいずれかへ確定するには、原則として根拠Eを必要とする。根拠SとAは検証ケースの選定と早期エラー表示に使う。

## 3. 暫定スコープと実測マトリクス

### 3.1 入力

| 入力 | 暫定スコープ | 第一基準<br>macOS + Chrome | 第二基準<br>Windows + Chrome | 第二基準<br>Windows + Edge | 備考 |
|---|---|---|---|---|---|
| MP4 / H.264 / AAC-LC、最大1080p / 30fps / SDR | 第一入力候補 | 未検証 | 未検証 | 未検証 | ファイル由来の正確なprofile、level、descriptionで能力判定する |
| MP4 / H.264、音声なし | 第一入力候補の派生 | 未検証 | 未検証 | 未検証 | 音声トラックなしを正常系として扱えるか確認する |
| iPhone撮影MP4 / H.264 / AAC、VFR | 条件付き入力候補 | 未検証 | 未検証 | 未検証 | timestamp、回転、色情報、シーク、音ズレを重点確認する |
| iPhone撮影素材 / HEVCまたはHDR | MVP初期保証の対象外 | 未検証 | 未検証 | 未検証 | 対象外表示と変換案内を確認する。技術的非対応とは未確定 |
| WebM / VP8 / Opus | 比較対象 | 未検証 | 未検証 | 未検証 | MVPで保証するかはMP4経路の成立後に判断する |
| WebM / VP9 / Opus | 比較対象 | 未検証 | 未検証 | 未検証 | exact codec configurationごとに確認する |
| MP3（CBR / VBR） | 主要追加入力候補 | 未検証 | 未検証 | 未検証 | `<audio>`、Web Audio、必要ならAudioDecoderを別々に確認する |
| WAV / リニアPCM | 主要追加入力候補 | 未検証 | 未検証 | 未検証 | bit depth、sample rate、channel数を素材ごとに記録する |
| PNG | 主要追加入力候補 | 未検証 | 未検証 | 未検証 | RGB、alpha、色プロファイルを分けて確認する |
| JPEG | 主要追加入力候補 | 未検証 | 未検証 | 未検証 | EXIF orientation、色プロファイルを分けて確認する |
| 破損または拡張子偽装ファイル | エラー経路 | 未検証 | 未検証 | 未検証 | 内容を検査し、安全に拒否できることを確認する |

### 3.2 出力

| 出力 | 暫定スコープ | 第一基準<br>macOS + Chrome | 第二基準<br>Windows + Chrome | 第二基準<br>Windows + Edge | 備考 |
|---|---|---|---|---|---|
| MP4 / H.264 / AAC-LC、最大1080p / 30fps | 第一出力候補 | 未検証 | 未検証 | 未検証 | 映像・音声encoderとmuxの全経路を実測する |
| MP4 / H.264、音声なし | 第一出力候補の派生 | 未検証 | 未検証 | 未検証 | Canvas向けの音声除去を想定して確認する |
| WebM出力 | MVP初期保証の対象外 | 未検証 | 未検証 | 未検証 | MP4出力の代替に自動昇格させない |
| 4K / 60fps、HDR、HEVC、AV1、ProRes | MVP初期保証の対象外 | 未検証 | 未検証 | 未検証 | Phase 0の必須条件へ含めない |

### 3.3 暫定条件の意味

「最大1080p / 30fps / SDR」は、ロードマップに合わせて最初の検証量を絞るための上限である。H.264のprofile / level、chroma subsampling、bit depth、AACのobject type、channel数、bitrateの最終許容範囲は、素材から得た正確な設定を `isConfigSupported()` へ渡し、実際のdecode / encodeを通して確定する。

iPhone素材は単一形式ではない。Apple公式資料では、撮影設定によってH.264またはHEVCになり得るため、「iPhone撮影」という出所だけで対応可否を決めない。各ファイルのコンテナ、映像・音声コーデック、VFR、HDR、回転・色メタデータを検査する。

記録する時刻と尺は `docs/PROJECT_FORMAT.md` の時間モデルに合わせ、整数マイクロ秒とする。frame rateは `numerator` / `denominator` の有理数を正本とし、VFR素材の `nominalFrameRate` は表示・診断値として扱う。正確なframe timestampはコンテナのsample時刻から得て、フレーム番号や丸めたfpsから再構成しない。ブラウザAPIが浮動小数の `framerate` を要求する箇所では有理数から呼出時に変換し、保存値の正本にはしない。

## 4. 能力判定と実機検証を分ける

### 4.1 判定レイヤー

一つの「対応チェック」で全経路を代表させず、次の順に記録する。

| レイヤー | 確認方法 | 判定できる範囲 | 判定できない範囲 |
|---|---|---|---|
| 1. ファイル検査 | magic bytesとコンテナparserでtrack、codec、duration等を読む | 実際のコンテナとtrack構成 | ブラウザがdecode / encodeできるか |
| 2. メディア要素の粗い判定 | `HTMLMediaElement.canPlayType()` | MIME type + codecsに対する `probably` / `maybe` / 空文字 | WebCodecs経路、性能、ファイルの正常性 |
| 3. 再生能力の自己申告 | `navigator.mediaCapabilities.decodingInfo()` | 指定解像度、bitrate、framerateについて `supported` / `smooth` / `powerEfficient` | DOGAGAのdemux、seek、同期、長時間安定性 |
| 4. WebCodecs構成判定 | `VideoDecoder` / `AudioDecoder` / `VideoEncoder` / `AudioEncoder` の `isConfigSupported()` | exact codec configurationに対するその時点の自己申告 | コンテナ処理、実ファイル全体、mux、実用性能 |
| 5. 画像構成判定 | 利用可能なら `ImageDecoder.isTypeSupported()` | MIME typeに対する画像decoderの自己申告 | 壊れた画像、色・向き、DOGAGAでの描画結果 |
| 6. 実処理 | DOGAGAのparser、decoder、renderer、audio clock、encoder、muxerを通す | 指定環境・素材での成否と計測値 | 別環境・別素材の結果 |

WebCodecs仕様では、実装が登録済みコーデックの任意の組み合わせ、または一つもサポートしないことが許されている。また、`isConfigSupported()` の結果はハードウェアや利用可能資源により動的に変わり得る。よって、ブラウザ名だけを根拠にコーデック対応を断定しない。

WebCodecsが扱うencoded mediaはコンテナ化されていない。MP4やWebMファイルを扱うには、codec能力とは別にdemuxが必要であり、書き出しにはmuxも必要である。encoderが `supported: true` でも、再生可能なMP4ファイルを書き出せることにはならない。

### 4.2 能力判定の記録例

次は実装方式の確定コードではなく、Issue #2で結果を採取するための最小例である。実ファイルから得たcodec stringと設定値を使い、固定値だけで全素材を代表させない。

```js
const video = document.createElement("video");
const mediaElementClaim = video.canPlayType(
  'video/mp4; codecs="avc1.640028, mp4a.40.2"',
);

const playbackClaim = await navigator.mediaCapabilities.decodingInfo({
  type: "file",
  video: {
    contentType: 'video/mp4; codecs="avc1.640028"',
    width: 1920,
    height: 1080,
    bitrate: 8_000_000,
    framerate: 30,
  },
  audio: {
    contentType: 'audio/mp4; codecs="mp4a.40.2"',
    channels: "2",
    bitrate: 192_000,
    samplerate: 48_000,
  },
});

const videoDecoderClaim = await VideoDecoder.isConfigSupported(
  exactVideoDecoderConfigFromDemuxer,
);
const audioDecoderClaim = await AudioDecoder.isConfigSupported(
  exactAudioDecoderConfigFromDemuxer,
);
```

サンプル中のcodec stringは判定方法を示す例であり、MVPの対応profile / levelを確定する値ではない。構成オブジェクトと戻り値はJSONで保存し、例外名、例外メッセージ、判定日時も記録する。

### 4.3 前提条件

- WebCodecsはsecure contextを前提とする。検証URL、`self.isSecureContext`、ブラウザflagの変更有無を記録する。
- Chrome公式資料はフレームやchunkのcallback処理をWorkerへ移すことを推奨している。main threadとWorkerのどちらで測定したかを記録する。
- `VideoFrame`、`AudioData`、decoder、encoderは不要になった時点で `close()` し、解放漏れをメモリ傾向へ混ぜない。
- Web Audioの `decodeAudioData()` は、`<audio>` がサポートする形式をdecodeする契約であり、形式名だけで成功を仮定しない。

## 5. 検証環境

### 5.1 対象環境

| 環境ID | 優先度 | OS | ブラウザ | 状態 |
|---|---|---|---|---|
| ENV-MAC-CHROME | 第一基準 | macOS（検証時のversion / buildを記録） | Chrome最新版（完全なversionを記録） | 未検証 |
| ENV-WIN-CHROME | 第二基準 | Windows（edition / version / buildを記録） | Chrome最新版（完全なversionを記録） | 未検証 |
| ENV-WIN-EDGE | 第二基準 | Windows（edition / version / buildを記録） | Edge最新版（完全なversionを記録） | 未検証 |
| ENV-MAC-SAFARI | 将来確認 | macOS | Safari | 未検証 |
| ENV-DESKTOP-FIREFOX | 将来確認 | macOSまたはWindows | Firefox | 未検証 |

「最新版」は固定versionではないため、結果には必ず完全なブラウザversionと検証日を残す。自動更新後は別結果として再検証する。

### 5.2 環境記録項目

- 環境ID
- 検証日とタイムゾーン
- OS名、edition、version、build、CPU architecture
- ブラウザ名、完全なversion、release channel
- CPU、GPU、RAM容量
- 電源接続状態と省電力モード
- hardware acceleration設定
- 外付けGPU等の有無
- 通常profile / clean profile
- 変更したbrowser flagsとextensions
- 表示解像度とdevice pixel ratio
- 検証URL、secure contextの成否
- DOGAGAのcommit SHA、依存関係lockfileのhash
- DevToolsを開いた状態か

## 6. テスト素材

### 6.1 権利と保管

素材はIssue #8および `docs/RIGHTS_AND_DATA_POLICY.md` に従う。

- 自作、パブリックドメイン、または再配布条件を確認できる素材だけを使う。
- 市販曲、商用映像、出所不明の「著作権フリー」素材を使わない。
- iPhone実写素材に人物、私有地、ロゴ、位置情報等が含まれる場合、必要な許諾とメタデータ除去方針を記録する。
- 大容量素材はGitへ直接commitしない。保管場所と取得手順を台帳へ記録する。
- 各素材にID、SHA-256、byte数、生成または取得手順、権利者、license名、原文URL、取得日、改変内容、再配布可否を記録する。
- 生成素材はgenerator、version、完全なcommand、source assetを記録し、同じ条件を再生成できるようにする。

### 6.2 必須ケース

数値は最初の検証条件であり、対応上限を保証する値ではない。

| 素材ID | 種別 | 条件 | 主な目的 | 優先度 |
|---|---|---|---|---|
| VID-MP4-AVC-AAC-1080-CFR | 動画 | MP4、H.264、AAC-LC、1920×1080、30fps CFR、30秒、SDR | 第一経路の読み込みから書き出し | 必須 |
| VID-MP4-AVC-AAC-720-CFR | 動画 | MP4、H.264、AAC-LC、1280×720、30fps CFR、30秒、SDR | 解像度差と基準素材 | 必須 |
| VID-MP4-AVC-NOAUDIO | 動画 | MP4、H.264、音声なし、30秒 | 音声trackなしの正常系 | 必須 |
| VID-MP4-AVC-AAC-VFR | 動画 | MP4、H.264、AAC-LC、VFR、30秒 | timestamp、seek、CFR出力 | 必須 |
| VID-IPHONE-AVC | 動画 | iPhone「互換性優先」相当、original file | 回転、VFR、色、metadata、音ズレ | 必須 |
| VID-IPHONE-HEVC-HDR | 動画 | iPhone「高効率」またはHDR、original file | 初期対象外の検出と案内 | 必須の負例 |
| VID-WEBM-VP8-OPUS | 動画 | WebM、VP8、Opus、1080p以下、30秒 | 比較経路 | 比較 |
| VID-WEBM-VP9-OPUS | 動画 | WebM、VP9、Opus、1080p以下、30秒 | 比較経路 | 比較 |
| AUD-MP3-CBR | 音声 | MP3 CBR、44.1kHz / stereo | 単体音声と波形 | 必須 |
| AUD-MP3-VBR | 音声 | MP3 VBR、44.1kHz / stereo | durationとseek | 必須 |
| AUD-WAV-PCM16 | 音声 | WAV、PCM signed 16-bit、48kHz / stereo | 無圧縮音声 | 必須 |
| IMG-PNG-RGB | 画像 | PNG RGB、1920×1080 | 静止画decode | 必須 |
| IMG-PNG-ALPHA | 画像 | PNG RGBA、1920×1080 | alpha合成 | 必須 |
| IMG-JPEG-ORIENT | 画像 | JPEG、sRGB、EXIF orientationあり | 向きと色 | 必須 |
| BAD-TRUNCATED-MP4 | 負例 | 自作MP4を意図的にtruncate | 破損検出と日本語エラー | 必須の負例 |
| BAD-FAKE-EXTENSION | 負例 | 内容と拡張子を意図的に不一致にする | sniffingと安全な拒否 | 必須の負例 |

H.264は最低でも実際に採用候補となるprofileごとに素材を分け、AACはobject type、sample rate、channel数を分けて記録する。全組み合わせを一つの「MP4対応」へまとめない。

### 6.3 素材台帳の最小項目

```yaml
id: VID-MP4-AVC-AAC-1080-CFR
sha256: "<64桁のhash>"
byteLength: 0
sourceOrGenerator: "<出所または生成手順>"
rightsHolder: "<権利者>"
license: "<license名>"
licenseUrl: "<原文URL>"
acquiredAt: "YYYY-MM-DD"
redistribution: "allowed | prohibited | unknown"
container: mp4
video:
  codec: "<fileから取得したexact codec string>"
  width: 1920
  height: 1080
  nominalFrameRate:
    numerator: 30
    denominator: 1
  frameRateMode: constant
  bitDepth: 8
  color: "<primaries / transfer / matrix / range>"
audio:
  codec: "<fileから取得したexact codec string>"
  sampleRate: 48000
  channels: 2
durationUs: 30000000
notes: ""
```

## 7. 実行手順と記録値

### 7.1 共通手順

1. 環境と素材の記録を確定し、素材のSHA-256を照合する。
2. 拡張子を信用せず、コンテナとtrack metadataを解析する。
3. `canPlayType()`、`MediaCapabilities`、各 `isConfigSupported()` の入力と戻り値を保存する。
4. ローカルファイルを読み込み、最初の映像frameまたは音声波形が得られるまでの時間と失敗段階を記録する。
5. 30秒素材を先頭から最後まで3回再生し、decode error、dropped / late frame、audio underrun、A/V差、メモリ傾向を記録する。
6. 先頭、10%、25%、50%、75%、90%、末尾1秒前へ順方向・逆方向にseekする。要求時刻以前のkeyframeからdecodeして要求時刻まで進め、要求時刻、最初に表示したframe timestamp、応答時間を記録する。
7. VFR素材では入力timestampを保持したpreviewとCFR出力候補を分け、frame duplication / dropと音声基準clockとの差を記録する。
8. 10〜30秒範囲を第一出力候補へ3回書き出す。encoder能力、encoded chunk、mux、保存の各段階を分けて記録する。
9. 出力を同一ブラウザで再読込し、macOSではQuickTime Player、WindowsではChrome / Edgeで再生可否を確認する。使用可能ならmedia inspectorでもstream metadataとdurationを確認する。
10. decoder / encoder / frame / audio dataを解放し、処理後のメモリ推移を記録する。
11. 結果を状態定義に照らし、制限と回避策を付けて判定する。

### 7.2 記録する指標

| 区分 | 指標 |
|---|---|
| 読み込み | parser完了時間、track数、metadata、最初のframe / 波形までの時間 |
| 再生 | 完走回数、decode error、dropped / late frame、audio underrun |
| シーク | 要求時刻、表示frame timestamp、誤差、応答時間、keyframe位置 |
| 同期 | video timestampとaudio基準clockの差を先頭・中間・末尾およびseek後に採取 |
| 性能 | wall-clock時間、CPU / GPU傾向、decode / encode queue、書き出し倍率 |
| メモリ | 開始前、読込後、再生後、seek反復後、書出しpeak、解放後の使用量と採取手段 |
| 出力 | encoder config、keyframe間隔、chunk数、mux結果、byte数、duration、外部player再生 |
| エラー | DOGAGAの段階、DOMException名、開発者向け詳細、日本語案内、回避策 |

時刻、尺、seek誤差、A/V差は整数マイクロ秒で記録する。fpsは有理数と、APIへ渡した浮動小数値を分けて残す。frame durationの丸め値を反復加算して時刻を作らない。

計測手段と精度が環境ごとに異なるため、memory値にはChrome Task Manager、DevTools、CDP、ブラウザAPI等の採取手段を併記する。異なる手段の数値を直接比較しない。

### 7.3 Phase 0の暫定合格目標

次は正式な製品SLAではなく、Issue #2の初回判断を揃えるための暫定値である。初回実測データと実制作上の違和感を見て更新する。

- 30秒の1080p / 30fps基準素材を3回連続で最後まで処理し、未処理例外や停止がない。
- seek後に誤った時刻へ固定されず、要求時刻と表示frame timestampの差を全地点で記録できる。
- A/V差の絶対値は50,000マイクロ秒以内を目標とし、最大値と推移を記録する。測定誤差も併記する。
- 同じ入力と設定で3回の出力が成功し、durationとtrack構成が一致する。byte単位の同一性は要求しない。
- 出力を対象ブラウザで再読込でき、第一基準環境ではQuickTime Playerでも再生できる。
- 解放後も使用量が試行ごとに単調増加し続ける場合は合格にせず、保持objectと再現条件を調査する。

seek誤差、初期表示時間、dropped frame率、書き出し倍率、メモリ上限は、実測分布がないため現時点で合格値を固定しない。

## 8. 実測結果の記録テンプレート

### 8.1 一件ごとの記録

```md
### RESULT-<環境ID>-<素材ID>-<連番>

- 状態: 未検証 | 対応 | 条件付き | 非対応
- 根拠: E
- 検証日: YYYY-MM-DD HH:mm Z
- 検証者:
- 環境ID:
- OS / build:
- ブラウザ / 完全なversion:
- CPU / GPU / RAM:
- hardware acceleration / 電源状態:
- DOGAGA commit:
- 素材ID / SHA-256:
- 実行経路: HTMLMediaElement | WebCodecs | Web Audio | export
- secure context:

#### 能力判定

| API | 入力 | 戻り値または例外 |
|---|---|---|
| canPlayType |  |  |
| MediaCapabilities.decodingInfo |  |  |
| VideoDecoder.isConfigSupported |  |  |
| AudioDecoder.isConfigSupported |  |  |
| VideoEncoder.isConfigSupported |  |  |
| AudioEncoder.isConfigSupported |  |  |
| ImageDecoder.isTypeSupported |  |  |

#### 実測

| 項目 | 値 | 採取手段 |
|---|---|---|
| 最初のframe / 波形まで |  |  |
| 再生完走 |  |  |
| seek誤差 median / max（µs） |  |  |
| seek応答 median / max（µs） |  |  |
| A/V差 min / max（µs） |  |  |
| dropped / late frame |  |  |
| memory baseline / peak / cleanup後 |  |  |
| 書き出し時間 / 倍率 |  |  |
| 出力byte数 / duration / track |  |  |
| 外部player再生 |  |  |

#### 判定

- 成功した操作:
- 失敗した操作:
- 条件または既知の制限:
- ユーザー向け案内:
- 回避策:
- raw log / screenshot / recording:
- 再検証条件:
```

### 8.2 集約表

| Result ID | 環境ID | 素材ID | DOGAGA commit | 状態 | 読込 | 再生 | seek | A/V | 書出 | 制限・回避策 |
|---|---|---|---|---|---|---|---|---|---|---|
| - | - | - | - | 未検証 | - | - | - | - | - | 実機結果待ち |

raw logには歌詞本文、ユーザーの元ファイル名、絶対path、個人情報を不用意に残さない。共有前に内容を確認する。

## 9. 非対応素材の案内方針

ユーザー向け画面では、コンテナ、コーデック、profile等の技術詳細を最初から大量に見せない。「何が起きたか」「編集への影響」「次にできること」を日本語で示し、開発者向け詳細は展開領域または診断記録へ分離する。最終文言とmessage keyはIssue #9の用語集・エラー原則と整合させる。

| 失敗段階 | ユーザー向け案内例 | 次の行動 | 開発者向け記録 |
|---|---|---|---|
| 形式を識別できない | ファイル形式を確認できなかったため、この素材を読み込めませんでした。プロジェクトと元のファイルは変更されていません。別の素材を選ぶか、MP4に変換してからもう一度読み込んでください。 | 別の素材を選ぶ、または変換して読み込む | sniff結果、magic bytesの分類、parser error |
| 映像codec構成が使えない | この素材の映像コーデックは現在の環境では使えないため、読み込めませんでした。プロジェクトと元のファイルは変更されていません。H.264のMP4に変換するか、推奨環境でもう一度読み込んでください。 | H.264 MP4へ変換する、または推奨環境を確認する | exact codec string、decoder config、API結果 |
| 音声codec構成が使えない | この素材の音声コーデックは現在の環境では使えないため、読み込めませんでした。プロジェクトと元のファイルは変更されていません。AAC-LC音声を含むMP4に変換してから、もう一度読み込んでください。 | AAC-LCを含むMP4へ変換して読み込む | exact codec string、sample rate、channels、API結果 |
| 初期対象外の解像度・fps・HDR | この素材は現在の対応範囲を超えているため、読み込めませんでした。プロジェクトと元のファイルは変更されていません。1080p・30fps・SDRに変換してから、もう一度読み込んでください。 | 初期上限へ変換して読み込む | width、height、fps、bit depth、color metadata |
| 破損または読み取り失敗 | ファイルの内容を最後まで読み取れなかったため、この素材を読み込めませんでした。プロジェクトと元のファイルは変更されていません。元のアプリからもう一度書き出すか、別の素材を選んでください。 | 元のアプリからもう一度書き出す、または別の素材を選ぶ | 失敗offset、track、例外 |
| 資源不足 | 処理に必要なメモリを確保できなかったため、この素材の処理を続けられませんでした。プロジェクトと元のファイルは変更されていません。ほかのタブを閉じるか、短い・小さい素材でもう一度お試しください。 | 負荷を下げてもう一度試す | queue、memory、frame保持数 |
| encoderが使えない | 選んだ書き出し設定を現在の環境で使えなかったため、動画を書き出せませんでした。プロジェクトと元の素材は残っています。途中ファイルは完成していません。推奨ブラウザを確認するか、設定を下げてもう一度書き出してください。 | 推奨環境を確認する、または設定を下げて書き出す | encoder config、API結果、例外 |
| muxまたは保存に失敗（原因未確認） | 動画の書き出しを完了できませんでしたが、原因を特定できませんでした。プロジェクトと元の素材は残っています。途中ファイルは完成していません。設定を確認して、もう一度書き出してください。 | もう一度書き出す、または診断詳細を確認する | encoder完了の有無、mux stage、保存例外 |

変換機能がDOGAGA内に存在しない段階で、「変換」ボタンがあるかのように案内しない。変換先の例を示す場合も、元素材を外部サービスへ無断送信しない。

## 10. WebCodecsとffmpeg.wasmの暫定判断

Phase 0はWebCodecs中心で進め、能力判定と実処理を分離する。ただし、WebCodecsはコンテナparser / muxerではないため、MP4を扱うには別のdemux / mux手段が必要である。

ffmpeg.wasmはこの時点で導入しない。次のいずれかが実測で必要になった場合だけ、対象を限定した別の技術・ライセンス検証へ進める。

- 第一入力候補をWebCodecs経路へ渡す前のdemuxを、比較候補の専用libraryで安全に実現できない。
- 第一出力候補のmuxを、比較候補の専用libraryで再生互換性を保って実現できない。
- 初期保証対象に含めると合意した素材で、必要な変換処理がブラウザ提供codecだけでは成立しない。

評価する場合は、変換対象、使用するffmpeg.wasm packageとversion、実際のFFmpeg build configuration、`--enable-gpl` / `--enable-nonfree`等の有無、同梱codec、配布物、license / notice / source提供条件、download size、起動時間、memory peak、処理倍率を記録する。FFmpeg公式資料が示すとおり、任意部品によってLGPL以外の条件が適用され得るため、package名だけでlicenseを判断しない。

補助変換を採用してもローカル処理を基本とし、ユーザー素材を外部変換サービスへ暗黙に送信しない。

## 11. Issue #2への引き継ぎ

Issue #2では、次の順でこの表を実測結果へ更新する。

1. 必須素材の台帳とSHA-256を確定する。Issue #8の成果物が利用可能なら正本をそちらへ寄せる。
2. MP4 / WebMのtrack metadataからexact decoder configを作る最小parser候補を比較する。
3. 能力判定のraw JSONを採取するdiagnosticsを作る。API結果を製品対応と表示しない。
4. 第一入力候補について、ローカルMP4選択、表示、再生、シーク、日本語エラーまでの縦一本を実装する。
5. macOS + Chrome、Windows + Chrome / Edgeで必須ケースを実行し、この文書のResultテンプレートへ記録する。
6. VFR素材のtimestampと音声基準clockを計測し、previewとCFR出力で使う時間モデルを決める。
7. encoderとmuxerを別々に検証し、10〜30秒の音付きMP4を3回書き出す。
8. 実測結果を基に初期対応形式、条件付き形式、非対応形式、回避策を確定する。
9. ffmpeg.wasmが必要な具体的ケースが残った場合だけ、licenseとbuildを含む別Issueへ分ける。

Issue #4の完了条件である第一・第二基準環境の主要素材検証は、この文書作成時点では未達である。実測後にIssue #2へ結果をコメントし、対応表の該当行を更新する。未実施の項目を完了扱いにしない。

## 12. 未解決事項

- 第一入力候補で許容するH.264 profile / level、AAC object type、channel数、bitrate
- MP4 / WebMのdemuxとMP4 muxに使うlibrary
- VFR previewのclock、seek semantics、CFR出力時のframe duplication / drop規則
- iPhone素材の回転・HDR・色空間metadataの処理範囲
- A/V差を自動計測するfixtureと測定誤差
- memory採取手段を環境間でどこまで揃えるか
- 出力MP4のkeyframe間隔と互換性確認先
- 変換を必要とする場合のローカル処理手段とUI導線
- codecの採用・配布形態に関する特許ライセンス確認

## 13. 参照した公式一次資料

2026-07-17に内容を確認した。ブラウザの実装状況は変わり得るため、実測時にも再確認する。

- [W3C WebCodecs](https://www.w3.org/TR/webcodecs/) — `isConfigSupported()`、best-effortの能力判定、secure context、コンテナ化されていないencoded media、画像decode
- [W3C WebCodecs Codec Registry](https://w3c.github.io/webcodecs/codec_registry.html) — H.264、HEVC、VP8、VP9、AAC、MP3、Opus、PCM等のcodec string登録
- [W3C Media Capabilities](https://www.w3.org/TR/media-capabilities/) — `decodingInfo()` の `supported` / `smooth` / `powerEfficient`
- [WHATWG HTML Standard: media elements](https://html.spec.whatwg.org/multipage/media.html) — `canPlayType()` の戻り値と意味
- [W3C Web Audio API](https://www.w3.org/TR/webaudio-1.0/) — `decodeAudioData()` とmedia elementが対応する音声形式の関係
- [Chrome for Developers: Video processing with WebCodecs](https://developer.chrome.com/docs/web-platform/best-practices/webcodecs) — feature detection、secure context、Worker、frame解放、encode / decodeの処理例
- [Apple Support: Apple製のデバイスでHEIF／HEVCメディアを扱う](https://support.apple.com/ja-jp/116944) — iPhoneの「高効率」と「互換性優先」で生じるHEVC / H.264の違い
- [FFmpeg: License and Legal Considerations](https://ffmpeg.org/legal.html) — build構成により変わるLGPL / GPL条件
