# Cloud Counter - マルチクラウド課金・無料枠管理システム

AWS、Azure、Google Cloudの3大クラウドプロバイダーの課金状況と無料枠消費状況を一元管理し、意図しない課金を防ぐWebアプリケーションです。

## 🚀 主要機能

### ✅ 実装済み機能 (Phase 6)
- **ダッシュボード**: 全クラウドの当月推定利用料の可視化
- **無料枠トラッカー**: 使用中サービスの無料枠消費状況監視
- **マルチリージョンリソース一覧**: 稼働中リソースのステータス管理
- **AWS全リージョン発見**: Cost Explorer APIによるアクティブリージョン自動検出
- **S3バケット検出**: 物理的場所と課金場所の区別表示
- **リソースカバレッジアラート**: 未対応サービスの検出と権限提案
- **IAMポリシー自動生成**: 最小権限・包括的権限の選択式生成

### 🔄 今後の機能 (Phase 7以降)
- プロパティベーステストの改善
- 新しいAWSサービス対応（RDS、DynamoDB、ECS、EKS等）
- パフォーマンス最適化とキャッシュ戦略の改善
- アラート機能（無料枠上限接近時の通知）

## 🛠️ 技術スタック

- **Frontend**: Next.js 16.0.8, React 19.2.1, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Cloud SDKs**: AWS SDK v3, Azure SDK, Google Cloud SDK
- **Data**: ファイルベースキャッシュ（JSON）

## 📋 前提条件

- Node.js 18.0以上
- npm または yarn
- AWS、Azure、Google Cloudのアカウントと認証情報

## 🚀 クイックスタート

### 1. プロジェクトのセットアップ

```bash
# リポジトリのクローン
git clone <repository-url>
cd cloud-counter

# 依存関係のインストール
npm install

# 環境変数ファイルの作成
cp .env.example .env.local
```

### 2. 環境変数の設定

`.env.local`ファイルを編集：

```env
# AWS設定
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-1
# 注: AWS_REGIONは全リージョン発見機能により自動更新されます

# Azure設定（オプション）
AZURE_SUBSCRIPTION_ID=your_subscription_id
AZURE_TENANT_ID=your_tenant_id
AZURE_CLIENT_ID=your_client_id
AZURE_CLIENT_SECRET=your_client_secret

# Google Cloud設定（オプション）
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
```

### 3. AWS権限の設定

最小権限から開始（推奨）：

```bash
# AWS CLIでの権限設定
aws iam attach-user-policy \
  --user-name your-user \
  --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess

# Cost Explorer権限の追加
aws iam put-user-policy \
  --user-name your-user \
  --policy-name CostExplorerAccess \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": ["ce:GetDimensionValues"],
        "Resource": "*"
      }
    ]
  }'
```

または、アプリ内で生成されたポリシーを使用：
```bash
# 最小権限ポリシーの取得
curl http://localhost:3000/api/aws/policies?type=minimal

# 包括的権限ポリシーの取得
curl http://localhost:3000/api/aws/policies?type=comprehensive
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## 📖 使用方法

### 1. 初回セットアップ
1. ダッシュボードにアクセス
2. 「全リージョン発見」ボタンをクリック（$0.01の課金が発生）
3. 検出されたリージョンが自動的に設定に反映

### 2. リソース監視
1. 「リソース取得」ボタンでマルチリージョンのリソースを取得
2. EC2、Lambda、S3バケットの詳細情報を確認
3. S3バケットの物理的場所と課金場所を区別表示

### 3. カバレッジ確認
1. リソースカバレッジアラートで未対応サービスを確認
2. 推奨アクションに従って権限を拡張
3. 必要に応じてIAMポリシーを追加

## 🏗️ プロジェクト構造

```
cloud-counter/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── aws/                  # AWS関連API
│   │   │   ├── cost/route.ts     # 課金情報API
│   │   │   ├── resources/route.ts # リソース情報API
│   │   │   ├── regions/route.ts  # リージョン発見API
│   │   │   └── policies/route.ts # ポリシー生成API
│   │   ├── azure/                # Azure関連API
│   │   └── google/               # Google Cloud関連API
│   ├── page.tsx                  # ホームページ
│   └── layout.tsx                # ルートレイアウト
├── components/                   # Reactコンポーネント
│   ├── overview.tsx              # ダッシュボード
│   ├── resource-inventory.tsx    # リソース一覧
│   └── ...
├── lib/                          # ユーティリティライブラリ
│   ├── multi-region-client.ts    # マルチリージョンクライアント
│   ├── resource-coverage-analyzer.ts # カバレッジ分析
│   ├── config.ts                 # 設定管理
│   └── ...
├── docs/                         # ドキュメント
└── data/                         # キャッシュデータ
```

## 🔧 API エンドポイント

| エンドポイント | メソッド | 説明 |
|---|---|---|
| `/api/aws/cost` | GET | AWS課金情報取得 |
| `/api/aws/resources` | GET | AWSリソース一覧（マルチリージョン対応） |
| `/api/aws/regions` | POST | アクティブリージョン発見 |
| `/api/aws/policies` | GET | IAMポリシー生成 |
| `/api/azure/cost` | GET | Azure課金情報取得 |
| `/api/google/cost` | GET | GCP課金情報取得 |

## 🛡️ セキュリティ

- **ローカル完結型**: 認証情報はローカルPC内の`.env.local`に保存
- **最小権限**: 読み取り専用権限の徹底
- **段階的権限拡張**: 必要に応じて権限を追加
- **課金制御**: Cost Explorer APIは手動実行のみ

## 🚨 トラブルシューティング

### 権限エラー
```bash
# 権限不足の場合、必要なポリシーを確認
curl http://localhost:3000/api/aws/policies?type=minimal
```

### リージョンエラー
```bash
# .env.localのAWS_REGIONを確認
# 無効なリージョンがある場合は削除
```

### S3アクセスエラー
```bash
# S3の読み取り権限を確認
# s3:ListAllMyBuckets, s3:GetBucketLocation が必要
```

## 📚 ドキュメント

- [プロジェクト仕様書](./docs/specification.md)
- [システムアーキテクチャ](./docs/architecture.md)
- [最新機能ガイド](./docs/latest-features.md)
- [GitHub統合](./docs/github-integration.md)
- [Phase 6 実装サマリー](./docs/phase6-summary.md)

## 🤝 開発への参加

### GitHub Project
開発タスクは [GitHub Project](https://github.com/users/unafi/projects/1) で管理されています。

### 開発フロー
1. Issueの確認・作成
2. ブランチの作成
3. 機能実装・テスト
4. プルリクエストの作成
5. レビュー・マージ

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 🙏 謝辞

- AWS、Azure、Google Cloudの各種APIとSDK
- Next.js、React、TypeScriptコミュニティ
- オープンソースライブラリの開発者の皆様

---

**注意**: このアプリケーションは課金情報を扱うため、認証情報の管理には十分注意してください。本番環境での使用前に、セキュリティ要件を十分に検討してください。
