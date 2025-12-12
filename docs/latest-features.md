# Cloud Counter - 最新機能ガイド

## Phase 6 で追加された新機能

### 1. AWS全リージョン対応機能

#### 概要
Cost Explorer APIを使用してアクティブリージョンを自動検出し、隠れたリソースを発見する機能です。

#### 使用方法
1. ダッシュボードの「全リージョン発見」ボタンをクリック
2. 課金警告（$0.01）を確認して実行
3. 検出されたリージョンが`.env.local`に自動反映
4. 以降のリソース取得で全リージョンが対象になる

#### 技術詳細
- **API**: Cost Explorer `GetDimensionValues`
- **コスト**: $0.01 per request
- **キャッシュ**: 24時間有効
- **設定ファイル**: `.env.local`の`AWS_REGION`を自動更新

### 2. S3バケット検出機能

#### 概要
S3バケットの物理的場所と課金場所を区別して表示する機能です。

#### 表示内容
- バケット名
- 作成日
- 物理的場所（実際のデータ保存場所）
- 課金リージョン（Cost Explorerで検出されたリージョン）

#### 技術詳細
- **API**: S3 `ListBuckets`, `GetBucketLocation`
- **処理**: us-east-1で一括取得後、各バケットの場所を並行取得
- **表示**: リソース一覧に統合表示

### 3. リソースカバレッジアラート機能

#### 概要
Cost Explorer APIで検出されたリージョンと実際のリソース取得結果を比較し、未対応サービスをアラート表示する機能です。

#### アラート内容
- 未対応リージョンの特定
- カバレッジ率の表示
- 推奨アクションの提示
- 必要な権限の具体的な説明

#### 対応推奨サービス
- データベースサービス (RDS, DynamoDB)
- コンテナサービス (ECS, EKS)
- ストレージサービス (EBS, EFS)
- ネットワークサービス (VPC, Load Balancer)

### 4. IAMポリシー自動生成機能

#### 概要
最小権限と包括的権限の2種類のIAMポリシーを自動生成する機能です。

#### アクセス方法
```
GET /api/aws/policies?type=minimal
GET /api/aws/policies?type=comprehensive
```

#### 生成ポリシー
**最小権限ポリシー**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ce:GetDimensionValues",
        "ec2:DescribeInstances",
        "lambda:ListFunctions",
        "s3:ListAllMyBuckets",
        "s3:GetBucketLocation"
      ],
      "Resource": "*"
    }
  ]
}
```

**包括的権限ポリシー**
- 上記に加えて、RDS、DynamoDB、ECS、EKS、EBS、EFS、VPC、ELB等の読み取り権限

### 5. マルチリージョンリソース取得

#### 概要
複数のAWSリージョンから並行してリソース情報を取得する機能です。

#### 対応リソース
- **EC2インスタンス**: 全リージョンのインスタンス情報
- **Lambda関数**: 全リージョンの関数情報  
- **S3バケット**: グローバルバケットの詳細情報

#### パフォーマンス特徴
- Promise.allSettledによる並行処理
- エラー発生リージョンのスキップ継続
- 統計情報の自動計算

## 使用方法

### 1. 初回セットアップ

#### 環境変数設定
```env
# .env.local
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
# 注: AWS_REGIONは全リージョン発見機能により自動更新されます
```

#### 必要な権限
最小権限で開始し、必要に応じて拡張：
```bash
# AWS CLIでの権限設定例
aws iam attach-user-policy \
  --user-name your-user \
  --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess

# Cost Explorer権限の追加
aws iam put-user-policy \
  --user-name your-user \
  --policy-name CostExplorerAccess \
  --policy-document file://cost-explorer-policy.json
```

### 2. 全リージョン発見の実行

1. **ダッシュボードアクセス**: http://localhost:3000
2. **全リージョン発見ボタン**: 「全リージョン発見」をクリック
3. **課金確認**: $0.01の課金を確認して「実行」
4. **結果確認**: 発見されたリージョン数と更新内容を確認
5. **自動反映**: `.env.local`が自動更新される

### 3. リソース一覧の確認

1. **リソース取得**: 「リソース取得」ボタンをクリック
2. **マルチリージョン表示**: 全リージョンのリソースが統合表示
3. **詳細情報**: リージョン名、ステータス、詳細情報を確認
4. **S3特別表示**: 物理的場所と課金場所の区別を確認

### 4. カバレッジアラートの確認

1. **アラート表示**: 未対応サービスがある場合、アラートが表示
2. **詳細確認**: カバレッジ率と未対応リージョンを確認
3. **推奨アクション**: 必要な権限と対応方法を確認
4. **ポリシー取得**: `/api/aws/policies`で必要なポリシーを取得

## トラブルシューティング

### 1. 権限エラー

#### 症状
```
UnauthorizedOperation: You are not authorized to perform this operation
```

#### 対処法
1. IAMポリシーの確認
2. 必要な権限の追加
3. `/api/aws/policies`でポリシーJSONを取得
4. AWS CLIまたはコンソールで権限を追加

### 2. リージョンエラー

#### 症状
```
InvalidRegion: The region 'xx-xxxx-x' does not exist
```

#### 対処法
1. `.env.local`の`AWS_REGION`を確認
2. 無効なリージョンコードを削除
3. 全リージョン発見を再実行

### 3. S3アクセスエラー

#### 症状
```
AccessDenied: Access Denied
```

#### 対処法
1. S3の読み取り権限を確認
2. `s3:ListAllMyBuckets`権限の追加
3. `s3:GetBucketLocation`権限の追加

### 4. Cost Explorer エラー

#### 症状
```
Cost Explorer API access denied
```

#### 対処法
1. `ce:GetDimensionValues`権限の確認
2. Cost Explorerの有効化確認
3. 課金アカウントの権限確認

## パフォーマンス最適化

### 1. キャッシュ活用
- 初回表示時はキャッシュから高速読み込み
- 手動更新時のみAPI呼び出し実行
- 24時間有効なリージョン発見キャッシュ

### 2. 並行処理
- 複数リージョンの同時処理
- エラー発生時の継続処理
- 効率的なリソース統合

### 3. エラーハンドリング
- 部分的失敗への対応
- ユーザーフレンドリーなエラーメッセージ
- 自動リトライ機能

## セキュリティ考慮事項

### 1. 最小権限の原則
- 必要最小限の権限から開始
- 段階的な権限拡張
- 読み取り専用権限の徹底

### 2. 認証情報の保護
- ローカル完結型の設計
- `.env.local`での安全な管理
- Git除外による漏洩防止

### 3. API使用制限
- Cost Explorer APIの課金制御
- 同日内重複実行の防止
- 適切なレート制限の遵守

## 今後の機能拡張

### Phase 7 予定機能
- プロパティベーステストの改善
- 新しいAWSサービス対応（RDS、DynamoDB等）
- パフォーマンス最適化（インクリメンタルキャッシュ）
- アラート機能（無料枠上限接近時の通知）

### 拡張可能性
- Azure、Google Cloudのマルチリージョン対応
- 自動スケジュール実行
- レポート機能の追加
- 通知機能の実装

---

この最新機能により、Cloud CounterはAWSの隠れたリソースを効率的に発見し、包括的なリソース管理を実現できるようになりました。