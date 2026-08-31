# DOGAGA UI redesign — Design QA

## Evidence

- Source visual truth: `/Users/yo4e/.codex/generated_images/01a0500e-3ff8-7160-a6ee-0a9f0fa8044a/exec-02297807-6f8d-45fd-8fdf-58d982eb63de.png`
- Implementation URL: `http://127.0.0.1:4174/`（production build preview）
- Implementation screenshot: `/private/tmp/dogaga-ui-implementation-final.png`
- Full-view comparison: `/private/tmp/dogaga-design-comparison.png`
- Focused comparison: `/private/tmp/dogaga-design-focused.png`
- Mobile evidence: `/private/tmp/dogaga-ui-mobile-320.png`
- Viewport: 1487 × 1058 CSS px、devicePixelRatio 1
- Source pixels: 1487 × 1058
- Implementation pixels: 1487 × 1058
- Density normalization: 不要。source / implementationともに1:1で比較した。
- State: 空の素材ライブラリ、landscape 16:9、contain、V2 / V1 / A1 / A2の空トラック、WebMCP 20/20 tools ready。

## Findings

最終比較で、対応が必要なP0 / P1 / P2は残っていない。

- Fonts and typography: sourceと同系統のsystem sans-serifで、ロゴ、セクション見出し、小さい操作ラベルの階層が維持されている。DOGAGAを`h1`にして文書構造も補正した。
- Spacing and layout rhythm: sourceの「素材rail → preview → full-width timeline」を維持した。previewとtrackは要望どおり角丸0px。実装のpreviewは正確な16:9を保つためsourceより横幅を抑え、timelineを同一viewportに残している。
- Colors and tokens: white / warm gray / black / cobalt blueへ統一。selection / playhead / disabled / dangerの意味を分離し、focus outlineは白背景で判別できる濃いblueへ補正した。
- Image and asset fidelity: このempty stateに必須の画像assetはない。sourceのフィルムglyphやtransport iconをCSS・文字記号で模造せず、実装済みの実機能だけを表示した。
- Copy and content: 日本語を正本として素材、preview、timeline、書き出しの順に整理した。agent activityとsafe stateは開発者向けdetailsへ移した。
- Responsiveness: 1487px、900px、800px、760px、320pxを確認。横ページoverflowなし。320pxではtrack sidebarを128pxへ縮め、lane表示幅を162px確保した。
- Accessibility and states: disabledの再生 / 書き出しを灰色にし、有効なprimary actionと区別した。focus ring、track metadata、empty textのcontrastを補正し、track toggleのaria-labelも自然な日本語に修正した。

## Intentional product deviations

- Source visualのdrag & drop zone、rail collapse、複数transport icon、track lock、frame-rate footerは現行production機能に存在しない。UIだけをfakeにせず、このbranchでは追加していない。
- Sourceよりpreview左右に余白があるが、canvas presetの実比率を崩さずtimelineを上部に保つための意図的な制約で、操作性を損なわない。

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
- video track visibilityとaudio track muteを切り替え、UI stateが更新される。
- canvas presetをsquare、fit modeをcoverへ変更し、preview比率が450 × 450へ変わる。landscape / containへ戻せる。
- headerの「書き出し」から既存export panelへ移動できる。
- WebMCP 20 toolsをproduction buildでdiscoverできる。
- WebMCP `add_track`で作ったV2 / A2を同じUIへ反映し、`get_project_state`で同じlive stateを再取得できる。
- `get_project_state`の結果にFile、object URL、absolute path、runtime bindingが含まれない。
- production build previewのconsole error / warningは0件。

## Residual test gaps / P3

- 実メディアを使ったplayback / exportの再検証はこのUI-only branchでは行っていない。既存EditorControllerとhandlerは変更していない。
- 開発serverのReact StrictModeでは`use-webmcp-tool` cleanup由来のAbortErrorが出るが、production buildでは再現しない。

final result: passed
