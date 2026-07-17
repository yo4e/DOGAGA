# DOGAGA 編集コマンドとUndo / Redoモデル v0.1

更新日: 2026-07-17
対象Issue: #6
依存する正本: `docs/PROJECT_FORMAT.md`、`schemas/dogaga-project.schema.json`、`docs/LYRIC_SYNC_UX.md`

## 1. 目的

DOGAGAの基本編集と歌詞同期を、壊れにくいUndo / Redoへ接続するためのランタイム設計を定義する。

本書が扱うのは、Project v0.1を変更する編集コマンド、履歴スタック、連続操作の圧縮、自動保存との境界である。`.dogaga` の永続形式そのものは `docs/PROJECT_FORMAT.md` を正本とする。

## 2. 結論

v0.1では、**型付きコマンドと、適用時に生成する最小の逆コマンド**を採用する。

- Projectを編集状態の正本とする
- コマンドは安定IDと絶対値を使い、配列添字やDOM参照を保存しない
- コマンド適用は純粋関数に近い同期処理とし、成功時だけProjectと履歴を同時に更新する
- Undoに必要な変更前データは、Project全体ではなく影響範囲だけを逆コマンドへ保持する
- 複数対象の変更は一つの原子的コマンド、または原子的なBatchとして扱う
- ドラッグ中のプレビューは履歴へ積まず、確定時に一件だけ積む
- 歌詞タップ同期は、Space一回を一履歴とする
- Undo / Redo履歴は`.dogaga` v0.1へ保存しない。再読込後は空で開始する
- 自動保存はProjectスナップショット、Undo / Redoは現在の編集セッションという別責務にする

## 3. 対象外

- 複数人の同時編集と競合解決
- サーバーイベントを正本とするevent sourcing
- Undo履歴の端末間同期
- `.dogaga`への履歴同梱
- 外部ファイル書き出しの取り消し
- OPFSキャッシュの完全な即時削除
- 使用する状態管理ライブラリの確定

## 4. 方式比較

| 方式 | 利点 | 問題 | v0.1判断 |
|---|---|---|---|
| Project全体のbefore / afterスナップショット | 実装と理解が簡単 | 歌詞、スタイル、Trackが増えるほどメモリを使う。変更意図を検証しにくい | テスト用に限定 |
| 汎用JSON Patch | 差分を機械生成しやすい | 配列添字が並べ替えに弱く、Clip ID等の意味制約が見えない | 採用しない |
| 型付きコマンド + 逆コマンド | 意図、検証、UI表示、原子性を揃えやすい。安定IDを使える | コマンドごとの実装が必要 | **採用** |
| event sourcing | 監査と再生に強い | 永続化、migration、外部副作用まで設計が広がる | MVP対象外 |

型付きコマンドは、ライブラリ固有のdraftやproxyを公開型へ漏らさない。内部実装でimmutable helperを使うかは、Phase 1の性能計測後に決める。

## 5. 不変条件

すべてのコマンドは、適用前後で次を守る。

1. 入力Projectを直接変更しない
2. Project v0.1のJSON Schemaと意味検証を通る状態だけを確定する
3. 失敗時はProject、`past`、`future`を一切変更しない
4. Project内の対象は安定IDで参照する
5. 新しいIDはコマンド作成時に確定し、Undo / Redoで再生成しない
6. 一つの履歴項目は、ユーザーが一操作と認識する単位にする
7. Undo後に新しい編集を確定したらRedoスタックを破棄する
8. コマンドは外部通信、ファイル選択、デコード、書き出しを直接実行しない
9. ログと履歴ラベルへ歌詞本文、ファイル名、ハッシュ、絶対pathを含めない
10. プレビューと書き出しで共有するProjectの時間モデルを変更しない
11. `TimeUs`と`SignedTimeUs`はすべてJavaScriptの安全な整数とし、加減算結果も確定前に同じ範囲を検証する
12. lock中のTrackに属するClipまたはTransitionを変えるコマンドは、Batch内のsubcommandを含めて拒否する

## 6. ランタイム状態

```ts
interface EditorState {
  project: ProjectV0_1;
  history: HistoryState;
  runtimeRevision: number;
  savedRevision: number;
  activeInteraction: InteractionSession | null;
}

interface HistoryState {
  past: readonly HistoryEntry[];
  future: readonly HistoryEntry[];
  estimatedBytes: number;
}

interface HistoryEntry {
  id: string;
  labelKey: EditHistoryMessageKey;
  forward: EditCommand;
  inverse: ExecutableCommand;
  affectedIds: readonly string[];
  interactionId?: string;
  lyricSyncSessionId?: string;
  estimatedBytes: number;
}

interface InteractionSession {
  id: string;
  kind: "drag" | "resize" | "numeric-nudge";
  preview: EditCommand;
}
```

`runtimeRevision`、履歴、操作中プレビューはランタイム専用であり、Projectへ混ぜない。`savedRevision`はdirty表示の高速判定に使えるが、保存完了と同一内容へのUndoが競合する場合に備え、保存対象の内容ハッシュまたは同値比較も併用する。

Projectの`updatedAt`は保存処理がスナップショットへ設定する。各コマンド実行時に時刻を生成するとUndoで内容が完全に戻らないため、コマンドexecutorの責務にはしない。

## 7. TypeScriptインターフェース草案

次は実装境界を示す草案である。Project型はJSON Schemaから生成するか、Schemaと同じ検証fixtureで一致を確認する。

```ts
type TimeUs = number;
type SignedTimeUs = number;
type Id = string;

interface CommandBase {
  commandId: Id;
  labelKey: EditHistoryMessageKey;
  interactionId?: Id;
  lyricSyncSessionId?: Id;
}

interface AddClipCommand extends CommandBase {
  type: "AddClip";
  trackId: Id;
  clip: VideoClip | AudioClip | TextClip;
}

interface MoveClipCommand extends CommandBase {
  type: "MoveClip";
  clipId: Id;
  toTrackId: Id;
  toStartUs: TimeUs;
  toOrder: number;
}

interface TrimClipCommand extends CommandBase {
  type: "TrimClip";
  clipId: Id;
  startUs: TimeUs;
  durationUs: TimeUs;
  sourceStartUs: TimeUs;
  audioFades?: AudioFades;
}

interface SplitClipCommand extends CommandBase {
  type: "SplitClip";
  clipId: Id;
  splitAtUs: TimeUs;
  rightClipId: Id;
  audioFades?: {
    left: AudioFades;
    right: AudioFades;
  };
}

interface DeleteClipCommand extends CommandBase {
  type: "DeleteClip";
  clipId: Id;
}

interface DuplicateClipCommand extends CommandBase {
  type: "DuplicateClip";
  sourceClipId: Id;
  targetTrackId: Id;
  duplicateClipId: Id;
  startUs: TimeUs;
  order: number;
}

interface AddTransitionCommand extends CommandBase {
  type: "AddTransition";
  trackId: Id;
  transition: Transition;
}

interface RemoveTransitionCommand extends CommandBase {
  type: "RemoveTransition";
  trackId: Id;
  transitionId: Id;
}

interface UpdateTextStyleCommand extends CommandBase {
  type: "UpdateTextStyle";
  styleId: Id;
  changes: Readonly<Partial<TextStyleEditableFields>>;
}

interface CaptionTimingUpdate {
  textClipId: Id;
  timing: TextTiming;
}

interface SetCaptionTimingCommand extends CommandBase {
  type: "SetCaptionTiming";
  updates: readonly CaptionTimingUpdate[];
}

interface ShiftCaptionRangeCommand extends CommandBase {
  type: "ShiftCaptionRange";
  textClipIds: readonly Id[];
  deltaUs: SignedTimeUs;
}

interface ImportLyricsCommand extends CommandBase {
  type: "ImportLyrics";
  document: LyricDocument;
  textTrackId: Id;
  textClips: readonly TextClip[];
}

interface SplitLyricLineCommand extends CommandBase {
  type: "SplitLyricLine";
  documentId: Id;
  replacedLineId: Id;
  replacementLines: readonly [LyricLine, LyricLine];
  clipAssignments: Readonly<Record<Id, Id>>;
}

interface MergeLyricLinesCommand extends CommandBase {
  type: "MergeLyricLines";
  documentId: Id;
  replacedLineIds: readonly Id[];
  replacementLine: LyricLine;
  clipAssignments: Readonly<Record<Id, Id>>;
}

type AtomicEditCommand =
  | AddClipCommand
  | MoveClipCommand
  | TrimClipCommand
  | SplitClipCommand
  | DeleteClipCommand
  | DuplicateClipCommand
  | AddTransitionCommand
  | RemoveTransitionCommand
  | UpdateTextStyleCommand
  | SetCaptionTimingCommand
  | ShiftCaptionRangeCommand
  | ImportLyricsCommand
  | SplitLyricLineCommand
  | MergeLyricLinesCommand;

interface BatchCommand extends CommandBase {
  type: "Batch";
  commands: readonly AtomicEditCommand[];
}

type EditCommand = AtomicEditCommand | BatchCommand;

type AnyClip = VideoClip | AudioClip | TextClip;

interface TrackItemSlice {
  trackId: Id;
  clips?: readonly AnyClip[];
  transitions?: readonly Transition[];
}

interface LyricDocumentSlice {
  documentId: Id;
  lines?: readonly LyricLine[];
  syncSettings?: LyricSyncSettings;
}

interface ProjectSlice {
  trackItems?: readonly TrackItemSlice[];
  lyricDocuments?: readonly LyricDocumentSlice[];
  styles?: readonly TextStyle[];
}

// UIから直接発行しない。削除や行構造変更のinverseだけが生成する。
interface RestoreProjectSliceCommand extends CommandBase {
  type: "RestoreProjectSlice";
  slice: ProjectSlice;
  affectedIds: readonly Id[];
}

// Batchのinverseは、subcommandのinverseを逆順に保持する。
interface InternalBatchCommand extends CommandBase {
  type: "InternalBatch";
  commands: readonly ExecutableCommand[];
}

type ExecutableCommand =
  | EditCommand
  | RestoreProjectSliceCommand
  | InternalBatchCommand;

interface ApplyResult {
  project: ProjectV0_1;
  inverse: ExecutableCommand;
  affectedIds: readonly Id[];
  estimatedBytes: number;
}

type ApplyCommand = (
  project: Readonly<ProjectV0_1>,
  command: ExecutableCommand,
) => Result<ApplyResult, CommandError>;
```

`replacementLines`と`clipAssignments`は、行分割を空白位置から自動推測しないために明示する。日本語歌詞は単語間スペースを前提にせず、UIで確定した本文と参照関係をコマンドへ渡す。

`RestoreProjectSlice`のsliceはforward適用前の値である。executorは`affectedIds`に含まれる現在のobjectを対象scopeから除き、sliceにあるobjectを安定IDと`order`で復元してから、Project全体を意味検証する。これにより、Splitの右Clip等のforwardで新設したobjectを除去しつつ、元の左Clipを戻せる。`syncSettings`を含むsliceは、Clip削除に伴って`audioClipId`を`null`へ変えた場合の復元にも使う。UIや通常ログからこの内部コマンドを直接発行しない。

## 8. 履歴操作

### Execute

1. コマンド全体の参照、時刻、Track種別、Project意味制約を検証する
2. 新しいProjectと逆コマンドを生成する
3. 成功した場合だけProjectを置き換える
4. `HistoryEntry`を`past`へ積む
5. `future`を空にする
6. `runtimeRevision`を増やし、自動保存を予約する

### Undo

1. `past`末尾のinverseを、履歴へ新規追加しないモードで適用する
2. 成功時だけ対象entryを`past`から`future`へ移す
3. `runtimeRevision`を増やし、自動保存を予約する
4. 逆操作に失敗した場合は両スタックを動かさず、開発者向け診断を残す

### Redo

1. `future`末尾のforwardを再適用する
2. 成功時だけ対象entryを`future`から`past`へ戻す
3. 初回と同じID、時刻、本文を使い、乱数や現在時刻を再生成しない

Undo / Redoの実行中に通常の履歴項目を追加してはならない。executorへ`recordHistory`フラグを渡すより、履歴管理層とProject変換層を分ける。

## 9. コマンド別の意味

| コマンド | 原子的に変更するもの | 逆操作に保持するもの | 主な拒否条件 |
|---|---|---|---|
| `AddClip` | 指定Trackへ正規化済みClipを追加し、Trackの`order`を正規化 | 追加Clip IDと変更前の並び順 | Track種別不一致、ID・参照先不在／重複、範囲外 |
| `MoveClip` | Track、`startUs`、挿入位置と影響Trackの`order` | 元・先Trackの変更前slice | 範囲外、lock中、Transition制約破壊 |
| `TrimClip` | `startUs`、`durationUs`、`sourceStartUs` | 変更前の3値 | 素材範囲外、0以下の尺、fade・Transition破壊 |
| `SplitClip` | 左Clipを短縮し、直後へ右Clipを追加して`order`を正規化 | 元Trackの影響ClipとTransitionの最小slice | 端点分割、素材時刻変換不能、ID重複 |
| `DeleteClip` | Clipと、そのClipを参照するTransitionを削除 | Clip、Track位置、削除Transition | lock中、参照整合を復元不能 |
| `DuplicateClip` | 新IDのClipを指定位置へ追加し、Trackの`order`を正規化 | 複製Clip IDと変更前の並び順 | ID重複、配置範囲外 |
| `AddTransition` | 既に有効な重なりを持つvideo TrackへTransition追加 | Transition ID | Track種別、隣接、重なり、handle不足 |
| `RemoveTransition` | 指定Transitionを削除 | 削除したTransitionとTrack ID | Transition不在、Track lock中 |
| `UpdateTextStyle` | 指定styleの変更対象フィールド | 同じフィールドの変更前値 | style不在、値域外 |
| `SetCaptionTiming` | 一回のタップで影響するTextClip timing群 | 対象Clipの変更前timing群 | 空・重複ID、text/lyric以外、順序・範囲違反 |
| `ShiftCaptionRange` | 明示した同期済みTextClip群の時刻 | 逆向きdeltaと対象ID | 未同期を含む、一件でも範囲外、ID重複・不在 |
| `ImportLyrics` | LyricDocumentと未同期TextClip群 | 追加したdocument / clip ID | ID重複、参照不整合、上限超過 |
| `SplitLyricLine` | 行配列と全参照Clipを同時更新 | 影響した行・Clip参照のslice | 割当不足、本文不一致、参照の孤立 |
| `MergeLyricLines` | 複数行と全参照Clipを一行へ更新 | 影響した行・Clip参照のslice | 順序不正、割当不足、参照の孤立 |

### Track内の並び順

`order`を配列添字としてコマンドへ保存しない一方、挿入・移動後のTrackでは値を`0..n-1`へ決定的に正規化する。`toOrder`、追加Clipの`order`、複製先の`order`は、正規化後に置きたい挿入位置を表す。

- 同じ挿入位置にある既存Clip以降を一つ後ろへ送る
- 同一Track内の移動は対象を一度除いてから挿入する
- Track間移動は元・先の両Trackを正規化する
- 同じ入力Projectとコマンドから、必ず同じID順と`order`を得る
- inverseは対象Clipだけでなく、`order`が変わったClipを含む最小sliceを保持する

これにより、整数`order`の衝突をUI実装ごとの暗黙ルールで解決しない。Project上の配列順も正規化後の`order`昇順へ揃える。

### Clip分割

- 左Clipは元のIDを保ち、右Clipはコマンド作成時に確定した新IDを使う
- Project上の分割オフセットから元素材位置を求めるときは、Project形式の有理数式とhalf-up丸めを使う
- 元Clip先頭側のTransition参照は元IDの左Clipへ残し、末尾側のTransition参照は新IDの右Clipへ更新する。分割位置が既存Transition区間内にあり制約を保てない場合は拒否する
- 新しい内側境界はカットであり、Transitionを自動追加しない
- AudioClipでは、左Clipが元のfade in、右Clipが元のfade outを引き継ぎ、新しい内側境界のfadeは0とする。継承値が分割後のClip長を超える場合は、コマンドの`audioFades`へ両側の確定値を明示するか、操作を拒否する。暗黙に短縮しない

### トリムとAudio fade

AudioClipのfadeは、トリム後もProject形式の「各fadeと合計がClip長以下」を満たす場合だけ保持する。満たさない場合は、`TrimClip.audioFades`へユーザーが確認した確定値を含めるか、トリムを拒否する。executorがfadeを暗黙に縮めてはならない。

### Transitionを持つClipの移動・トリム

暗黙にTransitionを削除してはならない。変更後も制約を満たす場合だけそのまま適用し、満たさない場合は次のどちらかにする。

- UIで「トランジションも削除する」等を明示し、`RemoveTransition`を含むBatchとして実行する
- 操作を拒否し、影響と次の操作を日本語で案内する

### Transition追加時のClip範囲

`AddTransition`は、Project形式の重なり、隣接順、duration、素材範囲を既に満たすClipへTransition objectを追加する原子的primitiveとする。非重複のカット境界へクロスディゾルブを追加するユーザー操作では、利用可能な素材ハンドルから変更後の`startUs`、`durationUs`、`sourceStartUs`を事前計算し、必要な`TrimClip` / `MoveClip`と`AddTransition`を一つのBatchで確定する。

executorが素材範囲を暗黙に広げたり、Transitionの長さを暗黙に短縮したりしない。十分なハンドルがない場合に短い長さを提案するUIはよいが、ユーザーが確定した値を新しいBatchへ明示する。

### Clip削除と参照

`DeleteClip`は、対象Clipを参照するTransitionも同じ操作で削除する。対象が`LyricSyncSettings.audioClipId`から参照されるAudioClipの場合は、該当する`audioClipId`を`null`へ変更するが、歌詞本文とTextClip timingは削除しない。inverseはClip、Transition、同期対象参照を一回のUndoで復元する。

このcascadeはコマンド仕様として固定し、実装ごとに「参照を残す」「歌詞も削除する」等へ分岐させない。

### 複製

Clipの値は複製するが、Clip IDと`order`は新しくする。Assetと`lyricLineRef`は同じ参照を保持できる。Transitionは自動複製しない。

## 10. 原子性とBatch

複数対象を変更する操作は、途中状態をUI、保存、購読者へ公開しない。

```text
command全体の形を検証
  -> 非公開draftへsubcommandを順番に適用・検証
       ├─ 一件でも失敗 -> draftを破棄し、Project / historyを変更しない
       └─ 全件成功 -> 完成draftを意味検証し、一度だけcommit
```

Batchのinverseは、各subcommandのinverseを**逆順**に並べた`InternalBatch`とする。subcommandを個別の履歴へ積まない。後続subcommandが先行subcommandの作成したIDを参照する場合も、非公開draft上で順番に検証できる。

Batchを使う例:

- Clip移動と、明示的に選んだTransition削除
- 行分割と、複数TextClipの`lyricLineRef`更新
- 歌詞取り込みと、未同期TextClipの一括作成

`ShiftCaptionRange`はそれ自体が一つの原子的コマンドであり、行ごとの`SetCaptionTiming`へ分解しない。一件でも範囲外になるなら全件を失敗させる。

## 11. 連続ドラッグと履歴圧縮

### 推奨: 確定前プレビュー

1. pointer downで`InteractionSession`を開始する
2. pointer moveでは`activeInteraction.preview`だけを更新する
3. レンダラーはProjectにpreviewを重ねて表示する
4. pointer upで初期値から最終値への絶対コマンドを一件実行する
5. Esc、pointer cancel、値が変わらない操作は履歴を追加せず終了する

これにより、60fpsのドラッグを60件の履歴にしない。ドラッグ中のpreviewを自動保存しない。

### キーボード連続入力

矢印キーの連続移動など、確定イベントが連続する操作は次の条件をすべて満たす場合だけcoalesceできる。

- 同じcommand type
- 同じ対象ID集合
- 同じ編集プロパティ
- 間に別コマンドがない
- 同じ`interactionId`
- 前回確定からの時間が実装時に定める短い閾値以内

coalesce後もinverseは最初の値、forwardは最後の絶対値を保持する。閾値は実操作テストで決め、v0.1文書では固定しない。別々のクリック、歌詞タップ、削除操作は時間が近くてもまとめない。

## 12. 歌詞タップ同期の履歴

Space一回を、一つの`SetCaptionTiming`として`past`へ積む。

一回のタップで、現在行の開始時刻に加えて前行の終了時刻が`endGapUs`から決まる場合、両TextClipのtimingを同じ`updates[]`へ入れる。Undoは両方を同時に戻す。

```text
タップ1 -> SetCaptionTiming(line 1)                 history A
タップ2 -> SetCaptionTiming(line 2 + line 1終端)    history B
Backspace -> history BをUndo
再タップ -> 新しいhistory B'を追加し、Redoは破棄
```

同期モード中のBackspaceは、履歴末尾が同じ`lyricSyncSessionId`のタップならその一件をUndoする。それ以外の通常編集を誤って戻さない。同期モードを終了した後は、通常のUndoとして同じ履歴を一件ずつ戻せる。

- Escによる一時停止はProjectを変更しないため履歴を追加しない
- 遅延補正を既存行へ一括反映する場合は、一つの`ShiftCaptionRange`とする
- タイミングを消す操作は`SetCaptionTiming`の対象を`unsynced`へする。同じコマンドのため、一回のUndoで消去前の時刻へ戻せる
- 全歌詞行をずらす操作は、同期済みの全対象IDを明示した`ShiftCaptionRange`として扱う
- 全同期テイクを一回で戻す機能は将来候補とし、MVPでは各タップを確実に戻せることを優先する
- `syncHistory[]`やUndoスタックはProjectへ保存しない

## 13. 自動保存、手動保存、再読込

| 操作 | Project内容 | Undo / Redo | 自動保存 |
|---|---|---|---|
| 通常コマンド成功 | 更新 | `past`へ追加、`future`破棄 | debounceして予約 |
| Undo / Redo成功 | 更新 | entryをスタック間で移動 | debounceして予約 |
| ドラッグpreview | 未確定 | 変更なし | 予約しない |
| 手動保存 | 保存用snapshotの`updatedAt`を更新し、成功後にruntime metadataへ反映 | 原則保持 | 保存完了revisionを記録 |
| Project再読込 | 保存済みsnapshotへ置換 | 空で開始 | 読込直後は予約しない |
| crash復旧snapshot読込 | 復旧内容へ置換 | v0.1では空 | ユーザー確認後に予約 |

履歴件数が0かどうかをdirty判定に使わない。保存後に編集してUndoで保存時内容へ戻る場合があるため、保存revisionと内容同値性で判断する。

保存成功時の`updatedAt`反映は編集コマンドとして履歴へ積まず、内容同値性の比較から除外する。これにより、保存後のUndoでも履歴のinverseが時刻metadataを古い値へ戻さない。

自動保存に失敗しても履歴を消さない。ユーザーへ、保存できなかったこと、現在の編集がメモリ上には残っていること、次の操作を案内する。

## 14. 非同期処理と外部副作用

ファイル選択、metadata解析、デコード、波形生成、書き出し、外部通信はコマンドexecutorの外で行う。

```text
非同期処理を開始
  -> 結果を検証
  -> request tokenと対象IDが現在も有効か確認
  -> Projectへ反映する型付きコマンドを生成
  -> 同期的・原子的にcommit
```

- UndoはProjectからAsset / Clip参照を外せるが、生成済みキャッシュの物理削除は別のGC責務とする
- 書き出し済みファイルはUndoで削除しない。書き出しはProject編集ではなく、明示的な外部出力である
- 外部処理の完了が古いProjectへ遅れて反映されないよう、request tokenと対象IDを検証する
- ユーザー素材を外部サービスへ送る処理は、本モデルのコマンド追加だけでは許可されない

`AddClip`が参照できるのは、Projectへ登録済みのAssetだけである。Issue #2で素材読み込みをProjectへ接続する前に、検証済みAsset metadataを登録・解除する型付きコマンドを同Issueまたは独立Issueで定義する。それまでは、非同期処理の完了コールバックから`project.assets`を直接変更しない。

## 15. メモリ方針

- inverseには変更前の最小sliceだけを保持する
- Project全体のdeep cloneを履歴ごとに保持しない
- 変更していない配列やobjectは、内部実装で安全なら構造共有する
- `DeleteClip`等は復元に必要なClipと関連Transitionだけを保持する
- 歌詞本文を含む`ImportLyrics`履歴はメモリ使用量へ計上する
- 履歴entryごとに概算byte数を持ち、件数と総量の両方を診断できるようにする

履歴上限の件数・byte数は、10分Projectと30〜100行の歌詞で実測して決める。上限超過時に古い履歴を削除する場合は、現在操作を壊さず、開発者向け診断へ理由を残す。固定値を実測前に仕様化しない。

## 16. エラー、文言、アクセシビリティ

```ts
interface CommandError {
  code: CommandErrorCode;
  messageKey: EditErrorMessageKey;
  developerDetail: string;
  affectedIds: readonly string[];
}
```

- ユーザー向け文言は日本語メッセージカタログへ置く
- 履歴ラベルは表示文字列ではなく安定した`labelKey`を持つ
- 例: 「クリップの移動を元に戻す」「歌詞の時刻設定をやり直す」
- 元に戻せない外部操作は、実行前に結果と保存先を明示する
- UIの「元に戻す」「やり直す」ボタンは、disabled理由をアクセシビリティラベルでも説明できるようにする
- 技術ログへ歌詞本文、TextClipの`textOverride`、ファイル名、素材hashを出さない

原因未確認の失敗を「Projectが壊れた」と断定しない。コマンド失敗時はProjectが変更されていないことをユーザーへ伝える。

## 17. 履歴例

### Clipをドラッグして移動

```text
開始: clip A startUs=1,000,000
pointer move: previewだけを2,000,000 -> 3,000,000へ更新
pointer up:
  forward MoveClip(A, startUs=3,000,000)
  inverse MoveClip(A, startUs=1,000,000)
履歴: 1件
```

### 3行を一括で-80ms移動

```text
forward ShiftCaptionRange([lineClip1, lineClip2, lineClip3], -80,000)
inverse ShiftCaptionRange([lineClip1, lineClip2, lineClip3], +80,000)

1行でも0未満になる場合:
  Project変更なし
  履歴追加なし
```

### 歌詞行を分割

```text
forward:
  line Aをline B / Cへ置換
  参照TextClipを明示mappingでBまたはCへ更新

inverse:
  line B / Cを元のline Aへ復元
  変更したTextClip参照を元へ復元

本文、行配列、参照Clipは一回のUndoで同時に戻る
```

### Clipを削除

```text
forward DeleteClip(clip A)
  clip Aと、Aを参照するTransition Tを削除

inverse RestoreProjectSlice
  元Trackのorder位置へclip Aを復元
  Transition Tを復元
```

## 18. テスト方針

### 共通契約

すべてのコマンドへ次の契約テストを適用する。

1. `apply(before, forward)`がSchema・意味検証を通る
2. `apply(after, inverse)`が編集対象について`before`と同値になる
3. Undo後のRedoが初回`after`と同値になる
4. 入力Projectが変更されていない
5. 無効コマンドでProjectと両スタックが変わらない
6. 新規IDがRedoでも同じである
7. 新しい編集後にRedoが消える

保存時の`updatedAt`、runtime revision、キャッシュはProject編集内容の同値比較から分離する。

### 必須ケース

- 各基本コマンドの正常・境界・不在ID・Track lock
- 30fpsで整数にならない時刻、29.97fps、`playbackRate`適用後のSplit / Trim
- Audio fadeとTransition制約を破る操作の原子的拒否
- drag 100イベントが履歴1件になる
- Batch途中の失敗で全変更が破棄される
- ShiftCaptionRangeの一件だけ範囲外でも全件不変
- タップ、Backspace、再タップでRedoが正しく破棄される
- Split / Merge後も`lyricLineRef`が孤立しない
- missing Assetを参照するClipでも、素材本体なしでProject編集をUndoできる
- 保存後のUndo、再読込後の履歴空、保存失敗時の履歴維持
- 履歴ラベルと診断へ歌詞本文・素材情報が出ない

ブラウザUI実装後は、Playwrightでpointer cancel、focus中のBackspace、Cmd/Ctrl+Z、Shift+Cmd/Ctrl+Z、OS別キー表記を確認する。

## 19. 実装順

1. Project v0.1のTypeScript型と意味validatorを用意する
2. 純粋な`applyCommand()`と共通契約test harnessを作る
3. `AddClip`、`MoveClip`、`DeleteClip`でhistory managerを通す
4. drag previewと一件確定を接続する
5. Trim / Split / Duplicate / Transitionを追加する
6. text styleとcaption timingを追加する
7. ShiftCaptionRange、ImportLyrics、Split / MergeLyricLineを追加する
8. 自動保存のrevision境界を接続する
9. メモリと長時間操作を実測して履歴上限を決める

アプリ基盤を作るIssue #2と実装順を調整し、別セッションが同時にProject型や時間関数を独自作成しないようにする。

## 20. 未解決事項

- immutable更新へ使うライブラリ、または依存なし実装
- 履歴の件数・byte上限
- キーボード連続入力のcoalesce時間
- 同期テイク全体を一回で戻す追加操作
- crash復旧時に履歴も復元する将来形式
- cache GCの実行時機と容量上限
- 同一内容へのUndoを高速判定するruntime fingerprint

これらはProject永続形式を変更する判断ではない。性能計測や実UI確認が必要な項目は、実装Issueで記録して確定する。

## 21. Issue #6完了条件との対応

| 完了条件 | 本書の対応 |
|---|---|
| Phase 1の基本編集操作 | Section 7、9、17 |
| Phase 2の歌詞同期操作 | Section 7、12、17 |
| 連続ドラッグを一履歴へまとめる | Section 11 |
| 自動保存と履歴を分離する | Section 13 |
| 状態管理方式を選べる材料 | Section 4、15、19、20 |

実装前の人間目視確認は不要である。ドラッグの操作感、履歴ラベル、ショートカット、タップ同期の自然さは、UI実装後に `HUMAN_VISUAL_CHECK_REQUIRED` として具体的な操作手順を提示する。
