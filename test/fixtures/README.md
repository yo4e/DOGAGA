# DOGAGA test fixtures

このディレクトリには、テスト素材の台帳と生成方法だけを置く。生成されたメディアはGitへコミットしない。

## 検証

```bash
python3 scripts/generate_test_fixtures.py --check
```

## ローカル生成

```bash
python3 scripts/generate_test_fixtures.py --output-dir test/fixtures/generated
```

生成先は `.gitignore` の対象である。既存内容が異なるファイルは上書きしない。素材の状態、権利記録、実測の扱いは `docs/TEST_MEDIA_POLICY.md` を参照する。
