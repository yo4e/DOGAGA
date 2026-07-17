# DOGAGA test fixtures

このディレクトリには、テスト素材の台帳と生成方法だけを置く。生成されたメディアはGitへコミットしない。

`manifest.json`はIssue #2/#4で使うfixture IDの正本である。`preparationStatus`、`rights.reviewStatus`、環境別の`measurements[]`を別軸で記録する。

## 検証

```bash
python3 scripts/generate_test_fixtures.py --check
```

この検証は、planned fixtureを含むmanifest全件の必須構造とID重複、標準生成fixtureの決定性、SHA-256、許可チャンクを確認する。ブラウザ実測を行ったことにはならない。

## ローカル生成

```bash
python3 scripts/generate_test_fixtures.py --output-dir test/fixtures/generated
```

生成先は `.gitignore` の対象である。既存内容が異なるファイルは上書きしない。素材の状態、権利記録、実測の扱いは `docs/TEST_MEDIA_POLICY.md` を参照する。
