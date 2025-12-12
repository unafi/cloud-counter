# GitHub統合とProject管理

## 概要

Cloud CounterプロジェクトでのGitHub CLI統合とProject管理の実装について説明します。KiroのSpec管理とGitHubのIssue・Project管理を効率的に連携させることで、開発タスクの可視化と進捗管理を実現しています。

## 実装済み機能

### 1. GitHub CLI統合

#### セットアップ
```bash
# GitHub CLIのインストール（Windows）
winget install GitHub.cli

# 認証
gh auth login

# 権限確認
gh auth status
```

#### 利用可能な権限
- `gist`: Gistの作成・管理
- `project`: GitHub Projectsの管理
- `read:org`: 組織情報の読み取り
- `repo`: リポジトリの管理
- `workflow`: GitHub Actionsワークフローの管理

### 2. GitHub Project管理

#### Project情報
- **Project名**: Cloud Counter Development
- **URL**: https://github.com/users/unafi/projects/1
- **タイプ**: Private Project
- **ステータス**: Todo / In Progress / Done

#### 管理対象Issue
現在7つのIssueがProjectで管理されています：

**完了済み (Done)**
- Issue #4: リソースカバレッジアラート機能の改善
- Issue #5: S3バケット検出機能の追加
- Issue #6: リソース取得のボタン化
- Issue #7: リソースカバレッジアラート機能の追加

**進行中 (Todo)**
- Issue #8: プロパティベーステストの改善
- Issue #9: 新しいAWSサービスのサポート追加
- Issue #10: パフォーマンス最適化とキャッシュ戦略の改善

### 3. Spec-Issue連携

#### 連携フロー
```
Kiro Spec (.kiro/specs/*/tasks.md)
    ↓
GitHub Issue作成 (gh issue create)
    ↓
Project追加 (gh project item-add)
    ↓
ステータス管理 (gh project item-edit)
```

#### Issue作成パターン
```bash
# 完了済みタスクのIssue化
gh issue create \
  --title "機能名" \
  --body "詳細な説明とSpec参照" \
  --label "enhancement"

# Projectへの追加
gh project item-add 1 --url https://github.com/unafi/cloud-counter/issues/N

# ステータス更新（完了済みの場合）
gh project item-edit \
  --id ITEM_ID \
  --field-id STATUS_FIELD_ID \
  --single-select-option-id DONE_OPTION_ID \
  --project-id PROJECT_ID
```

## 技術実装詳細

### 1. GitHub CLI API活用

#### Project情報取得
```bash
# Project一覧
gh project list --owner unafi

# Project詳細
gh project view 1 --owner unafi

# フィールド情報
gh project field-list 1 --owner unafi
```

#### GraphQL API活用
```bash
# ステータスフィールドの選択肢取得
gh api graphql -f query='
query($owner: String!, $number: Int!) {
  user(login: $owner) {
    projectV2(number: $number) {
      fields(first: 20) {
        nodes {
          ... on ProjectV2SingleSelectField {
            name
            options { name id }
          }
        }
      }
    }
  }
}' -f owner=unafi -F number=1
```

### 2. Issue管理自動化

#### Issue作成テンプレート
```markdown
## 概要
[機能の概要説明]

## 実装内容
- [実装項目1]
- [実装項目2]

## 関連ファイル
- `path/to/file1.ts`
- `path/to/file2.tsx`

## 関連Spec
- Spec: spec-name
- Requirements: X.Y, Z.W

## ステータス
✅ 完了済み (PR #N で完了)
```

#### ラベル管理
利用可能なラベル：
- `enhancement`: 新機能・改善
- `bug`: バグ修正
- `documentation`: ドキュメント更新
- `good first issue`: 初心者向け
- `help wanted`: 支援が必要

### 3. Project管理

#### ステータス管理
- **Todo** (ID: f75ad846): 未着手のタスク
- **In Progress** (ID: 47fc9ee4): 進行中のタスク
- **Done** (ID: 98236657): 完了済みのタスク

#### フィールド管理
- Title: Issue/PR のタイトル
- Assignees: 担当者
- Status: 進捗ステータス
- Labels: ラベル
- Repository: 関連リポジトリ
- Milestone: マイルストーン

## ワークフロー

### 1. 新機能開発時

```bash
# 1. Specファイル作成・更新
# .kiro/specs/feature-name/ 配下にrequirements.md, design.md, tasks.md

# 2. Issue作成
gh issue create --title "新機能名" --body "詳細" --label "enhancement"

# 3. Projectに追加
gh project item-add 1 --url https://github.com/unafi/cloud-counter/issues/N

# 4. 開発開始時にステータス更新
gh project item-edit --id ITEM_ID --field-id STATUS_FIELD_ID --single-select-option-id IN_PROGRESS_ID --project-id PROJECT_ID

# 5. 完了時にステータス更新
gh project item-edit --id ITEM_ID --field-id STATUS_FIELD_ID --single-select-option-id DONE_ID --project-id PROJECT_ID
```

### 2. バグ修正時

```bash
# 1. バグ報告Issue作成
gh issue create --title "バグ: 問題の説明" --body "再現手順と期待動作" --label "bug"

# 2. 修正完了後にクローズ
gh issue close N --comment "修正完了: 対応内容の説明"
```

### 3. 定期的なProject管理

```bash
# Project状況確認
gh project view 1 --owner unafi

# Issue一覧確認
gh project item-list 1 --owner unafi --format json

# 進捗レポート生成
gh project item-list 1 --owner unafi | grep -E "(Todo|In Progress|Done)"
```

## 今後の改善計画

### 1. 自動化の拡張
- Spec更新時の自動Issue作成
- PR作成時の自動Project連携
- 完了時の自動ステータス更新

### 2. レポート機能
- 週次進捗レポートの自動生成
- マイルストーン達成状況の可視化
- 開発速度の分析

### 3. 通知機能
- Issue作成・更新時の通知
- Project状況変更時のアラート
- 期限管理とリマインダー

## 参考資料

### GitHub CLI ドキュメント
- [GitHub CLI Manual](https://cli.github.com/manual/)
- [GitHub Projects API](https://docs.github.com/en/issues/planning-and-tracking-with-projects)
- [GraphQL API](https://docs.github.com/en/graphql)

### 関連ファイル
- `.kiro/specs/aws-multi-region/`: AWS全リージョン対応機能のSpec
- `docs/specification.md`: プロジェクト仕様書
- `docs/architecture.md`: システムアーキテクチャ

---

この統合により、KiroのSpec駆動開発とGitHubのProject管理が効率的に連携し、開発タスクの可視化と進捗管理が実現されています。