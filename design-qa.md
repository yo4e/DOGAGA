# DOGAGA UI redesign — Design QA

## Evidence

- Source visual truth: `/Users/yo4e/.codex/generated_images/01a0500e-3ff8-7160-a6ee-0a9f0fa8044a/exec-02297807-6f8d-45fd-8fdf-58d982eb63de.png`
- Implementation URL: `http://127.0.0.1:4174/`（production build preview）
- Implementation screenshot: `/private/tmp/dogaga-ui-implementation-final.png`
- Full-view comparison: `/private/tmp/dogaga-design-comparison.png`
- Focused comparison: `/private/tmp/dogaga-design-focused.png`
- Mid-width evidence: `/private/tmp/dogaga-ui-mid-800.png`
- Mobile evidence: `/private/tmp/dogaga-ui-mobile-320.png`
- Viewport: 1487 × 1058 CSS px、devicePixelRatio 1
- Source pixels: 1487 × 1058
- Implementation pixels: 1487 × 1058
- Density normalization: 不要。source / implementationともに1:1で比較した。
- State: 空の素材ライブラリ、landscape 16:9、contain、UIから追加したV2 / A2を含むV2 / V1 / A1 / A2の空トラック、WebMCP 20/20 tools ready。

## Findings

最終比較で、対応が必要なP0 / P1 / P2は残っていない。

- Fonts and typography: sourceと同系統のsystem sans-serifで、ロゴ、セクション見出し、小さい操作ラベルの階層が維持されている。DOGAGAを`h1`にして文書構造も補正した。
- Spacing and layout rhythm: sourceの約450px素材rail、約450px高のviewer、直下のtransport、full-width timelineを同じ1487×1058 viewportで揃えた。previewとtrackは要望どおり角丸0px。viewer内の実canvasだけ正確な16:9 / 9:16 / 1:1 / 4:5を保つ。
- Colors and tokens: white / warm gray / black / cobalt blueへ統一。selection / playhead / disabled / dangerの意味を分離し、focus outlineは白背景で判別できる濃いblueへ補正した。
- Image and asset fidelity: viewerのdark radial surface、drop zone、ruler、lane copyをsourceへ合わせた。フィルム、transport、track操作はPhosphor Iconsの一貫した線画へ統一し、CSS・文字記号による模造を避けた。
- Copy and content: 日本語を正本として素材、preview、timeline、書き出しの順に整理した。agent activityとsafe stateは開発者向けdetailsへ移した。
- Responsiveness: 1487px、900px、800px、760px、320pxを確認。横ページoverflowなし。320pxではtrack sidebarを128pxへ縮め、lane表示幅を162px確保した。
- Accessibility and states: disabledの再生 / 書き出しを灰色にし、有効なprimary actionと区別した。focus ring、track metadata、empty textのcontrastを補正し、icon-only controlへ日本語の`aria-label`と`title`を付けた。

## Intentional product deviations

- Source visualのrail collapse、track lock、PiP、frame-rate footerは対応するproduction handlerがないため追加していない。
- Native file inputは実ブラウザ動作・アクセシビリティを優先した。track操作は既存機能のvisibility / opacity / mute / move / deleteだけを小型iconへ置換し、lock等の未実装機能は見た目だけ追加していない。

## Comparison history

### Iteration 1

- [P1] previewが高くtimelineがfoldより下へ押し出された。`Preview.tsx`のpreview上限を450pxにし、track rowを66pxへ圧縮した。
- [P1] timelineのsidebarとlaneが縦に積まれた。`.timeline-workspace`へgrid構造と188px sidebarを復元した。
- [P2] 720pxのtimeline canvasがdesktop laneの途中で終わった。minimum canvas widthを1200pxへ広げた。
- Post-fix evidence: `/private/tmp/dogaga-ui-implementation-final.png`。preview、ruler、4 tracksが同一desktop viewport内で読み取れる。

### Iteration 2

- [P2] disabled primary buttonが有効時と同じblueだった。specific disabled selectorsを追加した。
- [P2] focus outlineと小さいtrack textのcontrastが不足した。focusを`#075fc7`、補助文字を濃いgray、clip metaをwhiteへ変更した。
- [P2] 320px幅でtimeline laneが102pxしか残らなかった。mobile sidebarを128px、mini controlsを22px基準へ変更し、laneを162pxへ拡大した。
- [P2] ページ主題がheadingとして存在しなかった。DOGAGAロゴを`h1`へ変更した。
- [P2] 800px付近でtagline用media queryが実DOMに一致しなかった。`.app-tagline`へselectorを修正した。
- Post-fix evidence: `/private/tmp/dogaga-design-comparison.png`、`/private/tmp/dogaga-design-focused.png`、`/private/tmp/dogaga-ui-mobile-320.png`。production console error / warningは0件。

## Primary interactions tested

- UIからvideo / audio trackを追加し、V2 / A2がtimelineと追加先selectへ即時反映される。
- Drop zoneは既存の`probeMediaFile` → runtime binding → `controller.registerAsset`経路をfile inputと共有する。MIME、空MIME＋拡張子、大文字拡張子、unsupportedの分類をunit testで確認した。
- video track visibilityとaudio track muteを切り替え、UI stateが更新される。
- canvas presetをsquare、fit modeをcoverへ変更し、preview比率が450 × 450へ変わる。landscape / containへ戻せる。
- headerの「書き出し」から既存export panelへ移動できる。
- WebMCP 20 toolsをproduction buildでdiscoverできる。
- WebMCP `add_track`で作ったV2 / A2を同じUIへ反映し、`get_project_state`で同じlive stateを再取得できる。
- `get_project_state`の結果にFile、object URL、absolute path、runtime bindingが含まれない。
- track操作を小型iconへ置き換えた状態で、V2 / V1 / A1 / A2すべてのcontrolsが147px内へ収まり、disabled・hover・日本語accessible nameを保つ。
- 2秒の自作WAVをA1へ設定し、play / pause、先頭 / 末尾、±0.1秒、master mute / unmuteを実ブラウザで確認した。再生中の+0.1秒後もplayheadとaudio currentTimeの差は0.0242秒だった。
- プレビュー全画面表示へ入り、transportを含むeditor全体が表示されたまま同じcontrolで終了できることを確認した。
- 800px幅ではtransportを2段化し、time / 5-button controls / volume / fullscreenが重ならないことをbounding boxと画面で確認した。
- 320×900でdocument横overflowがなく、production build previewのconsole error / warningは0件。

## Residual test gaps / P3

- 実音声によるplaybackは再検証したが、実動画を使った映像、cross dissolve、exportの再検証はこのUI-only branchでは行っていない。既存export handlerは変更していない。
- OSからの実ファイル混在dropは未実施。分類と部分失敗継続はunit / code pathで確認し、実メディアprobe自体は既存経路を再利用している。
- 開発serverのReact StrictModeでは`use-webmcp-tool` cleanup由来のAbortErrorが出るが、production buildでは再現しない。

### Iteration 3

- [P2] sourceより素材railが狭く、drop zoneもなかった。railを450pxへ広げ、実動作するvideo / audio混在drop zoneを追加し、file input・target select・empty messageの縦位置をsourceへ揃えた。
- [P2] previewがcanvas幅の800pxだけ黒く、sourceのviewerより左右が大きく空いていた。列幅いっぱいのviewerと中央の比率保持canvasを分離し、sourceと同じ約450px高のdark surfaceにした。
- [P2] WebMCP status、transport、timeline ruler / empty labelsの配置がsourceから離れていた。statusをbrand側へ移し、transportをtime / play / seekの3領域へ整理、timelineを24px/秒・1300px幅・164px sidebarへ変更した。
- Post-fix evidence: `/private/tmp/dogaga-design-comparison.png`。source / implementationを同じ1487×1058、同じ4-track empty stateで1枚にまとめ、主要領域の境界と密度を再比較した。

### Iteration 4

- [P2] `隠す` / `消音` / `上` / `下` / `削除`がsourceのcompactなtool stripより重く見えた。既存handlerとdisabled stateを保ったまま、Phosphorのeye / speaker / arrow / trash iconへ置き換えた。
- [P2] previewのempty stateとtransportがsourceより簡素だった。実動作する先頭 / ±0.1秒 / play-pause / 末尾、master volume / mute、editor全体のfullscreenを追加し、フィルムiconと暗いviewer surfaceを揃えた。
- [P2] 800px幅でtime / transport / volumeが重なった。980px以下を2段transportへ切り替え、800pxと320pxの横overflowを解消した。
- [P2] 再生中の±0.1秒seekが従来のmedia同期許容差より小さく、playheadだけ移動する可能性があった。video / audioの同期許容差を0.05秒へ揃え、実音声で差0.0242秒を確認した。
- Post-fix evidence: `/private/tmp/dogaga-design-comparison.png`。source / implementationを同じ1487×1058、同じV2 / V1 / A1 / A2 stateで1枚にまとめて再比較し、actionableなP0 / P1 / P2がないことを確認した。

final result: passed
