# Cloud Counter - マルチクラウド課金・無料枠管理システム 仕様書

## 1. プロジェクト概要

### 1.1 目的
AWS、Azure、Google Cloudの3大クラウドプロバイダーの課金状況と無料枠消費状況を一元管理し、意図しない課金を防ぎ、最も経済的なクラウドサービス利用を支援するWebアプリケーション。

### 1.2 主要機能
- **ダッシュボード**: 全クラウドの当月推定利用料の可視化
- **無料枠トラッカー**: 使用中サービスの無料枠消費状況監視
- **リソース一覧**: 稼働中リソースのステータス管理（マルチリージョン対応）
- **移行ガイド**: クロスクラウド移行レコメンデーション
- **権限設定支援**: 各クラウドの権限設定自動化支援
- **全リージョン発見**: Cost Explorer APIによるアクティブリージョン自動検出
- **リソースカバレッジアラート**: 未対応サービスの検出と権限提案
- **S3バケット検出**: 物理的場所と課金場所の区別表示

### 1.3 技術スタック

#### フロントエンド
- **Next.js 16.0.8**: React フレームワーク
- **React 19.2.1**: UIライブラリ
- **TypeScript 5.x**: 型安全性
- **Tailwind CSS 4.x**: スタイリング
- **Recharts 3.5.1**: グラフ描画
- **Lucide React 0.556.0**: アイコン

#### バックエンド/API
- **Node.js**: サーバーサイドランタイム
- **Next.js API Routes**: RESTful API実装

#### クラウドSDK
- **AWS SDK v3**: Cost Explorer, EC2, Lambda, S3 API
- **Azure SDK**: ARM Compute, Consumption API
- **Google Cloud SDK**: Billing, Compute Engine API

#### データ管理
- **ファイルベースキャッシュ**: JSON形式でローカル保存
- **dotenv**: 環境変数管理

## 2. アーキテクチャ設計

### 2.1 システム構成
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │  Cloud APIs     │
│   (Next.js)     │◄──►│   (API Routes)  │◄──►│  AWS/Azure/GCP  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│   UI Components │    │  File Cache     │
│   (React/TSX)   │    │  (JSON)         │
└─────────────────┘    └─────────────────┘
```

### 2.2 セキュリティ方針
- **ローカル完結型**: 認証情報はローカルPC内の`.env.local`に平文保存
- **クラウドデプロイなし**: 認証情報漏洩リスクを最小化
- **読み取り専用権限**: 各クラウドで最小権限の原則を適用

### 2.3 データフロー
1. **初回表示**: キャッシュファイルから既存データを読み込み
2. **手動更新**: ユーザーがボタンクリックでAPI呼び出し実行
3. **データ取得**: 各クラウドAPIから並行取得
4. **キャッシュ更新**: 取得データをローカルファイルに保存
5. **UI更新**: 最新データでダッシュボード更新

## 3. 機能仕様

### 3.1 ダッシュボード (Overview)

#### 表示項目
- **今月の推定利用料合計**: 全クラウドの合計金額（JPY換算）
- **クラウド別内訳**: 円グラフによる視覚化
- **最終更新日時**: データ取得タイムスタンプ
- **手動更新ボタン**: API呼び出しトリガー

#### 技術実装
- **コンポーネント**: `components/overview.tsx`
- **API エンドポイント**: 
  - `/api/aws/cost`
  - `/api/azure/cost`
  - `/api/google/cost`
- **通貨換算**: USD → JPY (レート: 150円固定)

### 3.2 無料枠トラッカー

#### 監視対象サービス
**AWS**
- Lambda: 100万リクエスト/月、40万GB秒/月
- EC2: 750時間/月 (t2.micro/t3.micro)
- S3: 5GB Standard Storage (12ヶ月)

**Azure**
- Functions: 100万リクエスト/月
- App Service: F1 Free Tier
- Bandwidth: 100GB送信/月

**Google Cloud**
- Compute Engine: 744時間/月 (e2-micro)
- Cloud Storage: 5GB Standard
- Cloud Functions: 200万呼び出し/月

#### 表示機能
- **プログレスバー**: 使用量/上限の視覚化
- **アラート表示**: 80%以上で警告、90%以上で危険
- **残り使用量**: 数値とパーセンテージ表示

#### 技術実装
- **定義ファイル**: `lib/free-tier-limits.ts`
- **計算ロジック**: APIレスポンスと無料枠定義のマッチング

### 3.3 リソース一覧 (Resource Inventory)

#### 対象リソース
**AWS**
- **EC2インスタンス**: InstanceId, Type, State (running/stopped)
- **Lambda関数**: FunctionName, Runtime, LastModified
- **S3バケット**: BucketName, 物理的場所, 課金リージョン, 作成日

**Azure**
- **Virtual Machines**: PowerState (running/deallocated)
- **Azure Functions**: State (Running/Stopped)

**Google Cloud**
- **Compute Engine**: Status (RUNNING/TERMINATED等)

#### 表示項目
- プロバイダー識別バッジ
- サービスタイプアイコン
- リソース名
- ステータスバッジ（色分け）
- リージョン情報（表示名付き）
- 詳細情報
- **S3専用**: 物理的場所と課金場所の区別表示
- **マルチリージョン対応**: 複数リージョンの統合表示

#### 技術実装
- **コンポーネント**: `components/resource-inventory.tsx`
- **API エンドポイント**:
  - `/api/aws/resources`
  - `/api/azure/resources`
  - `/api/google/resources`

### 3.4 移行ガイド (Migration Advisor)

#### 機能概要
- 無料枠上限に近いサービスを検出
- 他クラウドの同等サービスの無料枠状況を比較
- 移行推奨度の表示

#### レコメンデーション例
```
AWS Lambda の無料枠が85%消費
↓
Azure Functions: あと50万リクエスト利用可能 [推奨]
Google Cloud Functions: あと180万リクエスト利用可能
```

### 3.5 全リージョン発見機能

#### 機能概要
Cost Explorer APIを使用してアクティブリージョンを自動検出し、隠れたリソースを発見する機能。

#### 実装詳細
- **API**: `GetDimensionValues` (Key=REGION)
- **コスト**: $0.01 per request
- **対象**: 課金が発生している全リージョン
- **更新方式**: 手動実行（ボタンクリック）
- **キャッシュ**: 24時間有効

#### 技術実装
- **エンドポイント**: `/api/aws/regions`
- **設定更新**: `.env.local`の`AWS_REGION`を自動更新
- **並行処理**: 検出されたリージョンで並行リソース取得

### 3.6 リソースカバレッジアラート

#### 機能概要
Cost Explorer APIで検出されたリージョンと実際のリソース取得結果を比較し、未対応サービスをアラート表示。

#### アラート対象
- データベースサービス (RDS, DynamoDB)
- コンテナサービス (ECS, EKS)
- ストレージサービス (EBS, EFS)
- ネットワークサービス (VPC, Load Balancer)

#### 推奨アクション
- 必要な権限の具体的な提示
- IAMポリシーJSONの自動生成
- 段階的な権限拡張の提案

#### 技術実装
- **分析クラス**: `ResourceCoverageAnalyzer`
- **ポリシー生成API**: `/api/aws/policies`
- **権限タイプ**: 最小権限 / 包括的権限

### 3.7 権限設定支援

#### 対応クラウド
**AWS**
- 必要権限: `ReadOnlyAccess`, `ce:GetDimensionValues`
- 生成コマンド: AWS CLI用IAMポリシーアタッチ
- **新機能**: 最小権限・包括的権限の選択式ポリシー生成

**Azure**
- 必要権限: `Cost Management Reader`, `Reader`
- 生成コマンド: Azure CLI用ロール割り当て

**Google Cloud**
- 必要権限: `Billing Account Viewer`, `Compute Viewer`
- 生成コマンド: gcloud CLI用IAM設定

## 4. API仕様

### 4.1 共通レスポンス形式

```typescript
type CloudCostResponse = {
    total: number;           // 合計金額
    currency: string;        // 通貨単位
    details: ServiceUsage[]; // サービス別詳細
    lastUpdated?: string;    // 最終更新日時
    period?: {               // 対象期間
        start: string;
        end: string;
    };
    _source: "cache" | "api"; // データソース
};

type ServiceUsage = {
    service_name: string;    // サービス名
    region: string;          // リージョン
    cost: string;           // コスト
    usage: string;          // 使用量
    cost_unit: string;      // コスト単位
    usage_unit: string;     // 使用量単位
};
```

### 4.2 リソース API レスポンス

```typescript
type ResourceResponse = {
    resources: CloudResource[];
    lastUpdated?: string;
    error?: string;
};

type CloudResource = {
    id: string;       // リソースID
    name: string;     // リソース名
    type: string;     // サービスタイプ
    status: string;   // 稼働状況
    region: string;   // リージョン
    details?: string; // 追加情報
};
```

### 4.3 エンドポイント一覧

| エンドポイント | メソッド | 説明 | パラメータ |
|---|---|---|---|
| `/api/aws/cost` | GET | AWS課金情報取得 | `?refresh=true` |
| `/api/azure/cost` | GET | Azure課金情報取得 | `?refresh=true` |
| `/api/google/cost` | GET | GCP課金情報取得 | `?refresh=true` |
| `/api/aws/resources` | GET | AWSリソース一覧（マルチリージョン対応） | `?refresh=true` |
| `/api/azure/resources` | GET | Azureリソース一覧 | `?refresh=true` |
| `/api/google/resources` | GET | GCPリソース一覧 | `?refresh=true` |
| `/api/aws/regions` | POST | アクティブリージョン発見 | `{"action": "discover"}` |
| `/api/aws/policies` | GET | IAMポリシー生成 | `?type=minimal\|comprehensive` |
| `/api/system/info` | GET | システム情報取得 | - |

## 5. 設定・環境変数

### 5.1 必須環境変数

#### AWS設定
```env
AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_REGION=us-east-1,ap-northeast-1,eu-west-1
# 注: AWS_REGIONはカンマ区切りで複数リージョン指定可能
# 全リージョン発見機能により自動更新される
```

#### Azure設定
```env
AZURE_SUBSCRIPTION_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### Google Cloud設定
```env
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
```

### 5.2 動的設定読み込み

#### 実装方式
- **ホットリロード対応**: `lib/config.ts`で`.env.local`を動的読み込み
- **再起動不要**: 設定変更後、即座に反映
- **フォールバック**: `process.env`への自動フォールバック

```typescript
export function getConfig(key: string): string | undefined {
    // .env.localを動的読み込み
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        const fileContent = fs.readFileSync(envPath, 'utf-8');
        const envConfig = dotenv.parse(fileContent);
        if (envConfig[key]) return envConfig[key];
    }
    // フォールバック
    return process.env[key];
}
```

## 6. キャッシュシステム

### 6.1 ファイル構造
```
data/
└── cost-cache.json
```

### 6.2 キャッシュ形式
```json
{
  "aws": {
    "total": 12.34,
    "currency": "USD",
    "details": [...],
    "lastUpdated": "2024-12-11T10:30:00.000Z"
  },
  "azure": { ... },
  "google": { ... },
  "aws_resources": { ... },
  "azure_resources": { ... },
  "google_resources": { ... }
}
```

### 6.3 キャッシュ戦略
- **読み込み優先**: 初回表示時はキャッシュから高速表示
- **手動更新**: ユーザー操作時のみAPI呼び出し
- **コスト制御**: 意図しないAPI課金を防止
- **並行更新**: 複数クラウドの同時取得

## 7. UI/UX設計

### 7.1 レスポンシブデザイン
- **デスクトップファースト**: 主要ターゲット
- **モバイル対応**: 基本機能の表示保証
- **Tailwind CSS**: ユーティリティファーストアプローチ

### 7.2 カラーパレット
- **AWS**: オレンジ系 (#FF9900)
- **Azure**: ブルー系 (#0078D4)
- **Google Cloud**: ブルー系 (#4285F4)
- **ステータス**: 緑(稼働中)、グレー(停止中)、オレンジ(警告)

### 7.3 ナビゲーション
- **サイドバー**: 固定式メニュー
- **ダッシュボード**: メイン画面
- **無料枠トラッカー**: 埋め込み表示
- **移行ガイド**: 独立ページ
- **設定**: 権限設定支援

## 8. エラーハンドリング

### 8.1 API エラー対応
- **認証エラー**: 環境変数未設定時の明確なメッセージ
- **権限エラー**: 必要権限の具体的な指示
- **ネットワークエラー**: リトライ機能とフォールバック
- **レート制限**: 適切な待機時間の実装

### 8.2 ユーザーフィードバック
- **ローディング状態**: スピナーとプログレス表示
- **エラーメッセージ**: 解決方法を含む具体的な説明
- **成功通知**: 更新完了の明確な表示

## 9. セキュリティ考慮事項

### 9.1 認証情報管理
- **ローカル保存**: `.env.local`での平文管理
- **Git除外**: `.gitignore`での確実な除外
- **最小権限**: 読み取り専用権限の徹底

### 9.2 API セキュリティ
- **HTTPS通信**: 全API通信の暗号化
- **トークン管理**: 短期間での更新推奨
- **ログ制御**: 機密情報のログ出力防止

## 10. パフォーマンス最適化

### 10.1 API呼び出し最適化
- **並行処理**: Promise.allによる同時取得
- **キャッシュ活用**: 不要なAPI呼び出し削減
- **タイムアウト設定**: 適切な応答時間制限

### 10.2 フロントエンド最適化
- **コンポーネント分割**: 再利用性とメンテナンス性
- **状態管理**: useStateによる効率的な更新
- **レンダリング最適化**: 不要な再描画の防止

## 11. 今後の拡張計画

### 11.1 実装済み機能 (Phase 6)
- ✅ **全リージョン対応**: AWS Cost Explorer APIによるアクティブリージョン検知
- ✅ **S3バケット検出**: 物理的場所と課金場所の区別表示
- ✅ **リソースカバレッジアラート**: 未対応サービスの検出と権限提案
- ✅ **IAMポリシー自動生成**: 最小権限・包括的権限の選択式生成
- ✅ **マルチリージョンリソース取得**: 並行処理による効率的な取得

### 11.2 今後の機能 (Phase 7以降)
- **プロパティベーステスト**: fast-checkによる堅牢性テスト
- **新しいAWSサービス対応**: RDS、DynamoDB、ECS、EKS等
- **パフォーマンス最適化**: インクリメンタルキャッシュとバックグラウンド更新
- **アラート機能**: 無料枠上限接近時の通知
- **レポート機能**: 月次・週次の利用状況レポート
- **予算管理**: 利用上限設定と監視

### 11.2 技術的改善
- **データベース導入**: 履歴データの永続化
- **認証システム**: マルチユーザー対応
- **CI/CD**: 自動テスト・デプロイパイプライン

## 12. 運用・保守

### 12.1 ログ管理
- **アプリケーションログ**: エラー・警告の記録
- **API呼び出しログ**: 課金発生の追跡
- **パフォーマンスログ**: 応答時間の監視

### 12.2 バックアップ・復旧
- **設定ファイル**: `.env.local`のバックアップ推奨
- **キャッシュデータ**: 定期的なエクスポート機能
- **復旧手順**: 環境再構築の手順書

---

## 付録

### A. 開発環境セットアップ
```bash
# プロジェクトクローン
git clone <repository-url>
cd cloud-counter

# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env.local
# .env.localを編集

# 開発サーバー起動
npm run dev
```

### B. トラブルシューティング
- **AWS リージョン問題**: `AWS_REGION`環境変数の確認
- **Azure 認証エラー**: サービスプリンシパルの権限確認
- **GCP 認証エラー**: サービスアカウントキーのパス確認

### C. 参考リンク
- [AWS Cost Explorer API](https://docs.aws.amazon.com/cost-explorer/)
- [Azure Consumption API](https://docs.microsoft.com/en-us/rest/api/consumption/)
- [Google Cloud Billing API](https://cloud.google.com/billing/docs/reference/rest)