# DOGAGA プロジェクト形式 v0.1

更新日: 2026-07-17
対象Issue: #5

## 1. 目的

`.dogaga` は、DOGAGAで行った非破壊編集を保存し、ブラウザを閉じた後でも再開するためのプロジェクトファイルである。v0.1では次を優先する。

- 同じ時間モデルをプレビューと書き出しで共有する
- 元の動画、音声、画像をプロジェクトへ埋め込まない
- 素材が見つからない状態と再リンクの手掛かりを保存する
- 動画、音声、通常テキスト、歌詞行を一つのタイムラインで表現する
- 将来の形式変更を、バージョン判定と段階的な移行で扱う
- 誤記を早く検出しつつ、明示的な拡張データは失わず往復させる

v0.1の実体はUTF-8のJSONであり、ZIPコンテナではない。元素材、サムネイル、波形、プロキシ、Undo履歴、ブラウザのファイルハンドルは含めない。

## 2. 成果物

- 形式仕様: `docs/PROJECT_FORMAT.md`（本書）
- 機械検証用草案: `schemas/dogaga-project.schema.json`
- 最小サンプル: `examples/minimal-project.dogaga`

JSON SchemaはDraft 2020-12を使用する。Schemaで検証できない参照整合性は、後述の意味検証で補う。

最小サンプルは動画、音声、同期済み歌詞を表現し、音声素材の `linkState` を意図的に `missing` としている。これは素材が見つからない状態でも、音声Clipと編集内容を失わず再リンクを待てることを示すためである。

## 3. v0.1で決定すること

### 3.1 時間は整数マイクロ秒

保存する時刻と長さは、すべて整数マイクロ秒（`TimeUs`）とする。フィールド名は `startUs`、`durationUs`、`sourceStartUs` のように単位を末尾へ付ける。

- 1秒は `1_000_000` マイクロ秒
- プロジェクト時刻の原点は `0`
- JSONへは整数で保存し、小数秒や暗黙のミリ秒を混在させない
- JavaScriptでは `Number.isSafeInteger` を満たす範囲だけを受け付ける
- v0.1の非負時刻の上限は `9_007_199_254_740_991`

30fpsの1フレームは整数マイクロ秒にならず、29.97fpsや可変フレームレート素材もある。そのため、フレーム番号を編集時刻の正本にはしない。キャンバスと書き出しのフレームレートは有理数で保持する。

```json
{
  "frameRate": {
    "numerator": 30000,
    "denominator": 1001
  }
}
```

フレーム番号から保存時刻へ変換するときは、次の絶対式を使って最も近い整数マイクロ秒へ丸める。直前フレームへ丸め値を加算し続けない。

```text
timeUs = round(frameIndex × 1,000,000 × denominator ÷ numerator)
```

音声サンプル位置も `sampleIndex / sampleRate` から絶対時刻を計算し、永続化の境界で一度だけマイクロ秒へ丸める。デコーダー内部でコーデック固有のタイムベースが必要な場合は、その処理内では有理数またはAPIのタイムスタンプを保持し、Projectへ書く境界で変換する。

動画・音声Clipの `durationUs` はプロジェクト上の長さ、`playbackRate` の `numerator / denominator` は「プロジェクト時間1に対して進む素材時間」を表す。プロジェクト上のオフセット `timelineOffsetUs` が消費する素材時間は、次の有理数式を正本とする。

```text
sourceOffsetExactUs = timelineOffsetUs × playbackRate.numerator ÷ playbackRate.denominator
sourceTimeExactUs = sourceStartUs + sourceOffsetExactUs
```

たとえば `playbackRate: 2/1` のClipは、プロジェクト上の1秒で素材を2秒消費する。保存値から導出できる `sourceDurationUs` や `sourceEndUs` はProjectへ重複保存しない。

計算途中はJavaScriptの `Number` へ変換せず、整数の分子・分母を `BigInt` 等で保持する。デコーダー等の整数マイクロ秒APIへ渡す境界でだけ、非負値を **0.5マイクロ秒は素材終端側へ送る四捨五入** で丸める。

```text
roundHalfUp(numerator / denominator)
  = floor((numerator + floor(denominator / 2)) / denominator)
```

意味検証では丸め後の値ではなく、次の交差積を整数で比較し、素材の正確な範囲を超えていないことを確認する。

```text
(sourceStartUs × rate.denominator)
  + (durationUs × rate.numerator)
  <= asset.metadata.durationUs × rate.denominator
```

`playbackRate` は最大公約数で約分済みでなければならない。保存・再読込は `sourceStartUs`、`durationUs`、約分済みの `playbackRate` をそのまま保持し、上記の同じ純粋関数で導出値を再計算する。これにより速度変更後も保存を挟んでIn / Outが変わらない。

### 3.2 可変フレームレート素材

VFR素材のクリップ位置とトリム位置は、フレーム番号ではなく素材タイムライン上の `sourceStartUs` とプロジェクト上の `startUs` で表す。

- `metadata.nominalFrameRate` は表示・診断用であり、フレーム時刻の正本ではない
- 正確なフレーム時刻は、コンテナのサンプル時刻から得る
- シーク時は要求時刻以前のキーフレームからデコードし、要求時刻へ進める
- CFRへ書き出す場合の重複・間引き規則はレンダラー側で決め、元のVFR時刻をProject内で書き換えない

### 3.3 `.dogaga` は編集指示だけを保存する

各素材は安定した `asset.id` で参照する。次は保存してよい。

- 元のファイル名
- バイト数と最終更新時刻
- コンテナ、コーデック、尺、解像度等の検出済みメタデータ
- 再リンク候補を照合するためのサンプルハッシュ
- 最後に確認したリンク状態

次は保存しない。

- 動画、音声、画像のバイナリ本体
- OSの絶対パス
- `File` / `FileSystemFileHandle` の直列化表現
- `blob:` URL
- OPFS内の実装依存パス
- 外部アップロード先

ブラウザが保持できるファイルハンドルやOPFSキーは、端末内の別ストレージへ `asset.id` をキーとして保存できる。ただし、それらは可搬な `.dogaga` の一部ではない。

### 3.4 リンク状態は最後に確認した状態

`asset.linkState` は `unchecked`、`available`、`missing` のいずれかで、最後に保存した時点の観測結果である。別端末やブラウザ再起動後も有効だとは限らない。

読み込み時は必ず端末内の参照を再検証する。再検証前のランタイム状態は `unchecked` として扱い、ファイルが見つからなければ内部状態を `missing` とし、UIには「素材が見つかりません」と表示する。`missing` の素材を参照するクリップは削除せず、タイムライン上の位置と編集内容を保持する。

再リンクの候補は次の順で照合する。

1. `fingerprint` が一致する
2. `byteLength`、`lastModifiedMs`、`originalFileName` が一致する
3. 尺、解像度、コンテナ等のメタデータが一致する
4. 候補が複数ならユーザーへ選択を求める

ファイル名だけの一致で自動確定しない。`fingerprint` は省略可能であり、`method` と `value` が両方一致するときだけ同じ方式の指紋として比較する。`method` は拡張可能な不透明識別子で、採取範囲、ハッシュ関数、バージョンを含む実際の方式はIssue #2の性能検証後に定義する。方式を定義するまでは、特定の標準名を割り当てない。

### 3.5 未知フィールドと拡張

v0.1の標準オブジェクトは `additionalProperties: false` とし、同じバージョン内の誤記を検出する。任意データは各主要オブジェクトの `extensions` へ入れる。

拡張キーは、所有者が衝突を避けられる名前にする。

```json
{
  "extensions": {
    "com.example.feature": {
      "value": 1
    }
  }
}
```

読み込み、編集、保存を往復するとき、アプリが解釈できない `extensions` の値も変更せず保持する。標準フィールドを増減する場合は `version` を更新し、移行関数を用意する。未知の新しい `version` を既知形式として無理に開かない。

## 4. ルート構造

```text
Project
├─ version
├─ id / name / description
├─ createdAt / updatedAt / createdWith
├─ canvas
├─ assets[]
├─ tracks[]
│  ├─ clips[]
│  └─ transitions[]
├─ lyricDocuments[]
├─ markers[]
├─ styles[]
├─ exportPreset
└─ extensions
```

### 4.1 Project

| フィールド | 必須 | 内容 |
|---|---:|---|
| `version` | 必須 | v0.1では `0.1.0` |
| `id` | 必須 | プロジェクト内外で安定した不透明ID |
| `name` | 必須 | ユーザー表示名 |
| `description` | 任意 | プロジェクト説明 |
| `createdAt` | 必須 | UTCのRFC 3339日時 |
| `updatedAt` | 必須 | UTCのRFC 3339日時 |
| `createdWith` | 必須 | DOGAGAのアプリバージョン |
| `canvas` | 必須 | 画面サイズ、フレームレート、尺 |
| `assets` | 必須 | 元素材の参照とメタデータ |
| `tracks` | 必須 | 動画、音声、テキストのトラック |
| `lyricDocuments` | 必須 | 取り込んだ歌詞原文と行 |
| `markers` | 必須 | ビート、区間、任意マーカー |
| `styles` | 必須 | 再利用する文字スタイル |
| `exportPreset` | 必須 | 最後に選択した書き出し設定 |
| `extensions` | 必須 | 名前空間付き拡張。未使用時は `{}` |

IDはユーザーへ意味を見せない不透明な文字列とし、Project内で一意にする。配列の添字やファイル名をIDへ流用しない。UUID、ULID等の採用は実装時に一方式へ統一する。

### 4.2 Canvas

`canvas.durationUs` はプロジェクトの編集可能範囲である。全クリップとマーカーは原則として `0` 以上 `durationUs` 以下に収める。

`frameRate` はプレビューと書き出しの標準カデンスであり、クリップ時刻の単位ではない。背景色はCSSの8桁16進色 `#RRGGBBAA` で保持する。

### 4.3 Asset

`kind` は `video`、`audio`、`image` のいずれか。`metadata` は検出できた項目だけを持つ。画像に尺を捏造せず、動画に音声がない場合も `hasAudio: false` として記録できる。

`fingerprint` は素材本体の所有権や安全性を保証するものではなく、再リンク候補の照合だけに使う。ログや外部分析へファイル名、ハッシュ、素材メタデータを送らない。

### 4.4 TrackとClip

`track.kind` は `video`、`audio`、`text` のいずれか。同じ種類のClipだけを持つ。この組み合わせとaudio / text Trackの `transitions` が空であることはSchemaでも検証し、参照するAssetの種類は読み込み時の意味検証で補う。

すべてのClipは安定した `id` と並び順 `order` を持つ。

動画・音声Clip:

- `assetId`: 参照する素材
- `startUs`: プロジェクト上の開始時刻
- `durationUs`: タイムライン上の長さ
- `sourceStartUs`: 元素材上の開始時刻
- `playbackRate`: 有理数。v0.1のUIでは原則 `1/1`

動画・音声Assetでは、前節の有理数式で素材消費範囲を検証する。画像Assetには時間方向の素材尺がないため、この範囲検証を適用せず、`sourceStartUs: 0` と `playbackRate: 1/1` を要求する。画像の表示時間はVideoClipの `durationUs` だけで表す。

動画・画像を置くVideoClipは、静的な `transform` も持つ。

- `position`: キャンバス左上を `(0, 0)` とするピクセル座標。変換後の表示領域の中心を置く位置
- `scale`: fit適用後の幅と高さへ掛ける正の倍率
- `rotationDegrees`: 表示領域の中心を軸とする時計回りの回転角
- `fit`: crop後の素材をキャンバスへ合わせる `contain`、`cover`、`stretch`、または元ピクセル寸法の `none`
- `crop`: メタデータの回転を適用した素材に対し、各辺から除く割合（0以上1未満）

描画順は、素材メタデータの回転、crop、fit、scale、`position` を中心とした回転と配置の順とする。cropの左右合計と上下合計はそれぞれ1未満でなければならない。キーフレームはv0.1の対象外であり、これらの値はClip全期間で一定とする。

テキストClip:

- `role`: `title`、`caption`、`lyric`
- title / captionの `text`: UTF-8の表示文字列。日本語の空白と改行を勝手に正規化しない
- lyricの `lyricLineRef`: 正本となる歌詞行への参照
- lyricの `textOverride`: その表示Clipだけを意図的に別表記にする場合の任意上書き
- `timing`: `unsynced` または開始・長さを持つ `timed`
- `styleId`: 共通文字スタイル
- `layout`: キャンバス左上を `(0, 0)` とする表示基準点 `position`、基準点へ接する9方向の `anchor`、基準点を軸とする時計回りの `rotationDegrees`

未同期の歌詞行は `timing.status: "unsynced"` で保持できる。同期済み時刻を `0` や負数で代用しない。

### 4.5 LyricDocument

歌詞原文と編集行を、タイムライン表示から分離して保持する。

- `sourceText` は取り込み時の原文
- `lines[].text` はユーザーが確認した行本文であり、歌詞本文の唯一の正本
- 改行と空白は作者の意図として保持する
- 行の時刻は対応するTextClipの `timing` を正本とする
- `lyricLineRef` から原文行を参照する

lyric TextClipは通常の `text` を持たず、`lyricLineRef` が指す `LyricLine.text` を表示する。同じ行から複数の表示Clipを作ることは許可し、行本文を編集すると `textOverride` のない全表示へ反映する。表記を意図的に変える表示だけ `textOverride` を持ち、上書きを削除すると正本表示へ戻る。title / captionは逆に `text` を必須とし、歌詞参照や `textOverride` を持たない。

行の結合・分割は、行配列と参照するClipを一つの編集コマンドで更新する。各旧Clipをどの新しい行へ対応させるかをコマンド引数で明示し、曖昧な参照を自動推測しない。`textOverride` はClip固有の表示意図として、Clipを削除しない限り保持する。

`syncSettings.audioClipId` は、同期時刻の基準とした配置済みAudioClipを指す。歌詞時刻はプロジェクト時刻なので、同じAssetを異なる位置へ複数配置しても対象を一意にできる。参照先のAudioClipや素材がmissingでもIDは保持し、再リンク後に同じ配置を基準として再開する。

### 4.6 Transition

トランジションはClipのプロパティではなく、video Trackだけが所有する。AudioClipのフェードは `fades`、TextClipの演出は将来のeffectモデルで扱う。

- `crossDissolve`: `fromClipId` と `toClipId` の両方を指定する
- `fadeToBlack`: `fromClipId` だけを指定する
- `fadeFromBlack`: `toClipId` だけを指定する

`durationUs` はすべて1以上とし、参照先は同じvideo Track内に存在しなければならない。カットは2つのClipの境界そのものなのでTransitionとして保存せず、境界にTransitionがない状態で表す。

クロスディゾルブの2 Clipは `order` が連続し、`from` の終了と `to` の開始が `durationUs` だけ重ならなければならない。

```text
to.startUs = from.startUs + from.durationUs - transition.durationUs
```

`durationUs` は両Clipの `durationUs` 未満とする。重なり部分は両Clipに明示された素材範囲から再生し、Transition専用の隠れた素材ハンドルは持たない。既存の非重複境界へディゾルブを追加する編集コマンドは、利用可能な素材範囲を確認してClipの `sourceStartUs` / `startUs` / `durationUs` を更新し、重なりをProjectへ明示する。動画素材の端に十分なハンドルがない場合は追加を失敗または短縮し、画像は素材尺による制限を受けない。

`fadeToBlack` はfrom Clip末尾の、`fadeFromBlack` はto Clip先頭の `durationUs` 区間を使い、各durationは対象Clipの長さ以下とする。高度な文字アニメーションはTransitionへ混ぜない。

### 4.7 Marker

マーカーはプロジェクト時刻 `timeUs` を持ち、`generic`、`beat`、`section`、`cue` を区別する。拍位置をフレーム番号へ丸めて保存しない。

### 4.8 Style

v0.1はTextStyleだけを定義する。フォント名は指定であり、フォントファイルを埋め込まない。開く端末にフォントがない場合は代替表示し、ユーザーへ案内する。

### 4.9 ExportPreset

書き出し設定は最後に選択した値を再現するために保存する。コーデック文字列は希望値であり、そのブラウザで利用できることを保証しない。書き出し開始前に `VideoEncoder.isConfigSupported()` 等と実機書き出しで再確認する。

## 5. 意味検証

JSON Schema検証に通った後、少なくとも次を検証する。

1. 全IDが要求されたスコープで一意である
2. `assetId`、`styleId`、`lyricLineRef`、`audioClipId` が存在し、`audioClipId` はaudio Track内のAudioClipを指す
3. Trackの `kind` と各Clipの `type` が一致する
4. 動画・音声Clipの素材種類が利用方法と矛盾しない
5. `startUs + durationUs` が安全な整数で、キャンバス範囲内にある
6. `playbackRate` が約分済みであり、動画・音声では `sourceStartUs` と有理数で計算した正確な素材消費範囲が素材尺を超えず、画像では `sourceStartUs: 0` と `playbackRate: 1/1` である
7. VideoClipのcrop左右合計・上下合計がそれぞれ1未満であり、timedのTextClipがキャンバス範囲内にある
8. Transitionがvideo Trackだけにあり、kindに必要な参照形状、Clipの連続順、重なり、素材ハンドル、duration条件を満たす
9. LyricDocumentの `line.order` とTrack内の並び順が重複しない
10. `createdAt <= updatedAt` である
11. `frameRate` と `playbackRate` の分母が0でない
12. `exportPreset` が対象ブラウザで使えるかは別途能力判定する

エラーはユーザー向けと開発者向けを分ける。例:

- ユーザー向け: 「プロジェクトを開けませんでした。ファイルが壊れているか、新しいDOGAGAで作成された可能性があります。編集内容と元の素材は変更されていません。DOGAGAを更新して、もう一度開いてください。」
- 開発者向け: `project.schema.invalid at /tracks/0/clips/1/durationUs: must be >= 1`

## 6. 読み込み手順

1. 入力サイズの上限を確認する
2. UTF-8としてJSONを解析する
3. `version` だけを安全に読む
4. 対応していない新しいバージョンなら編集せず案内する
5. 旧バージョンなら移行関数を順番に適用する
6. 現行JSON Schemaで検証する
7. 参照と時間範囲を意味検証する
8. `asset.id` ごとに端末内参照を再検証する
9. 見つからない素材を `missing` として表示し、Clipは保持する
10. Project状態を生成し、Undo履歴は空で開始する

無効なファイルを一部だけ推測修復して上書きしない。復旧候補を作る場合は元ファイルを残し、別プロジェクトとして保存する。

## 7. 保存手順

1. 一時スナップショットを作る
2. 時刻が安全な整数であることを確認する
3. Schema検証と意味検証を行う
4. `updatedAt` を更新する
5. UTF-8 JSONへ直列化する
6. 一時ファイルへ書き、成功後に保存先を置き換える

自動保存はProjectのスナップショットを保存する責務だけを持つ。Undo / Redo履歴は `.dogaga` v0.1へ含めず、プロジェクト再読込後の履歴は空でよい。自動保存世代やクラッシュ復旧は端末内ストレージで別管理する。

## 8. バージョンと移行

`version` は `major.minor.patch` の文字列とする。v0.1 Schemaは `0.1.0` だけを受け付ける。

- patch: 意味を変えない誤記修正。保存形式を変える場合は上げない
- minor: 後方移行が可能なフィールド追加・変更
- major: 互換性を保てない意味変更

実装は対象バージョンごとの純粋な移行関数を持つ。

```ts
type JsonObject = Record<string, unknown>;
type Migration = (input: Readonly<JsonObject>) => JsonObject;

const migrations: Record<string, Migration> = {
  "0.1.0": migrate_0_1_0_to_0_2_0,
};
```

移行関数は入力を破壊せず、新しいオブジェクトを返す。同じfixtureへ複数回実行して結果が安定すること、未知の `extensions` を保持すること、移行前のバックアップから復旧できることをテストする。

新しい形式を古いアプリで開いた場合は読み取り専用プレビューを推測実行せず、更新を案内する。将来、読み取り専用互換性を提供する場合は別の明示的な互換レイヤーとして設計する。

## 9. プライバシーと権利

- `.dogaga` は素材本体を含めないが、ファイル名、歌詞、プロジェクト名等の個人情報を含み得る
- プロジェクト内容を利用ログやエラー送信へ自動添付しない
- 外部サービスへ送信する機能はMVPの保存経路に含めない
- 歌詞はユーザーが権利を確認して用意し、DOGAGA側から検索・配布しない
- フォントファイルは埋め込まず、利用権と代替表示を別途扱う
- プロジェクト共有時は、素材が同梱されないことと再リンクが必要なことを案内する

## 10. v0.1の既知の制限と未決事項

- fingerprintの方式名、採取範囲、性能はIssue #2で実測して確定する。確定までは省略し、仮の標準名を保存しない
- ブラウザ間でFile System Access APIの永続ハンドルを移送できないため、再リンク操作が必要になる
- スロー／早回しUIはMVP必須ではなく、`playbackRate` は将来性のための表現だけを先に持つ
- キーフレーム、エフェクトチェーン、マスク、高度なトランジションはv0.1対象外
- 音声サンプル境界と整数マイクロ秒の変換は、書き出し技術スパイクで長時間の累積誤差を実測する
- Schemaは参照整合性を保証しないため、意味検証の実装が必要
- `.dogaga` のJSONサイズ上限と自動保存世代数は、Phase 0Dで決める
- ZIP化やサムネイル同梱は、単純なJSONの運用結果を見てから別バージョンで検討する

## 11. Issue #2と#6への引き継ぎ

Issue #2では、このサンプル形式を読み込み、少なくとも次を確認する。

- `asset.id` とローカルFileをランタイムで関連付けられる
- `sourceStartUs` と `startUs` を同じ変換関数でプレビューへ渡せる
- VFR素材のコンテナ時刻をマイクロ秒へ変換できる
- ブラウザ再起動後にmissing表示と再リンクが成立する
- 30秒素材で保存・読み込み後のIn / Outが変わらない

Issue #6のUndo / Redoモデルは、Projectスナップショットを正本状態とし、コマンドがProject内の安定IDと整数マイクロ秒を更新する設計にする。自動保存と履歴スタックは分離し、コマンド専用の一時情報をProjectへ混ぜない。
