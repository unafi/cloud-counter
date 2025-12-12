# Cloud Counter - システムアーキテクチャ詳細

## 1. プロジェクト構造

```
cloud-counter/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── aws/
│   │   │   ├── cost/route.ts     # AWS課金情報API
│   │   │   ├── resources/route.ts # AWSリソース情報API（マルチリージョン対応）
│   │   │   ├── regions/route.ts  # リージョン発見API
│   │   │   └── policies/route.ts # IAMポリシー生成API
│   │   ├── azure/
│   │   │   ├── cost/route.ts     # Azure課金情報API
│   │   │   └── resources/route.ts # Azureリソース情報API
│   │   ├── google/
│   │   │   ├── cost/route.ts     # GCP課金情報API
│   │   │   └── resources/route.ts # GCPリソース情報API
│   │   └── system/
│   │       └── info/route.ts     # システム情報API
│   ├── migration/                # 移行ガイドページ
│   ├── settings/                 # 設定ページ
│   ├── favicon.ico
│   ├── globals.css               # グローバルスタイル
│   ├── layout.tsx                # ルートレイアウト
│   └── page.tsx                  # ホームページ
├── components/                   # Reactコンポーネント
│   ├── dashboard-shell.tsx       # メインレイアウト
│   ├── migration-advisor.tsx     # 移行アドバイザー
│   ├── overview.tsx              # ダッシュボード概要
│   ├── permission-helper.tsx     # 権限設定支援
│   └── resource-inventory.tsx    # リソース一覧
├── lib/                          # ユーティリティライブラリ
│   ├── config.ts                 # 動的設定読み込み
│   ├── file-cache.ts             # ファイルキャッシュ管理
│   ├── free-tier-limits.ts       # 無料枠定義
│   ├── multi-region-client.ts    # マルチリージョンリソースクライアント
│   └── resource-coverage-analyzer.ts # リソースカバレッジ分析
├── data/                         # データファイル
│   └── cost-cache.json           # キャッシュデータ
├── docs/                         # ドキュメント
│   ├── specification.md          # プロジェクト仕様書
│   ├── architecture.md           # システムアーキテクチャ
│   ├── github-integration.md     # GitHub統合ガイド
│   ├── phase6-summary.md         # Phase 6実装サマリー
│   └── latest-features.md        # 最新機能ガイド
├── public/                       # 静的ファイル
├── .env.local                    # 環境変数（Git除外）
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## 2. コンポーネント設計

### 2.1 レイアウトコンポーネント

#### DashboardShell (`components/dashboard-shell.tsx`)
**責務**: アプリケーション全体のレイアウト管理

**主要機能**:
- サイドバーナビゲーション
- レスポンシブメニュー制御
- ページルーティング
- ユーザー情報表示

**状態管理**:
```typescript
const [isSidebarOpen, setIsSidebarOpen] = useState(true);
const pathname = usePathname();
```

**ナビゲーション定義**:
```typescript
const navigation = [
  { name: "ダッシュボード", href: "/", icon: LayoutDashboard },
  { name: "無料枠トラッカー", href: "/tracker", icon: CreditCard },
  { name: "移行ガイド", href: "/migration", icon: Cloud },
  { name: "設定", href: "/settings", icon: Settings },
];
```

### 2.2 データ表示コンポーネント

#### Overview (`components/overview.tsx`)
**責務**: ダッシュボードのメイン表示

**主要機能**:
- 課金情報の集約表示
- 円グラフによる視覚化
- 無料枠アラート表示
- 手動データ更新

**状態管理**:
```typescript
const [totalCost, setTotalCost] = useState(0);
const [pieData, setPieData] = useState<any[]>([]);
const [warnings, setWarnings] = useState<FreeTierStatus[]>([]);
const [loading, setLoading] = useState(true);
const [updating, setUpdating] = useState(false);
const [lastUpdated, setLastUpdated] = useState<string | null>(null);
```

**データフェッチロジック**:
```typescript
const fetchData = async (forceRefresh = false) => {
    // 並行フェッチ
    const [awsRes, azureRes, gcpRes] = await Promise.all([
        fetch(`/api/aws/cost${query}`),
        fetch(`/api/azure/cost${query}`),
        fetch(`/api/google/cost${query}`),
    ]);
    
    // データ集約・変換処理
    // キャッシュ更新
};
```

#### ResourceInventory (`components/resource-inventory.tsx`)
**責務**: クラウドリソースの一覧表示（マルチリージョン対応）

**主要機能**:
- 全クラウドのリソース統合表示
- ステータス別色分け
- プロバイダー識別
- リアルタイム更新
- **新機能**: マルチリージョンリソースの統合表示
- **新機能**: S3バケットの物理的場所と課金場所の区別表示
- **新機能**: リソースカバレッジアラートの表示

**データ構造**:
```typescript
interface CloudResource {
    id: string;
    name: string;
    type: string;
    status: string;
    region: string;
    regionDisplayName: string;
    crossRegionId: string;
    details?: string;
    // マルチリージョン対応の追加フィールド
    availability?: string;
    lastSeen?: string;
    resourceArn?: string;
    // S3固有の追加フィールド
    actualLocation?: string;
    billingRegion?: string;
}
```

## 3. API設計

### 3.1 共通パターン

#### リクエストパラメータ
- `?refresh=true`: 強制API呼び出し
- デフォルト: キャッシュからの読み込み

#### レスポンス構造
```typescript
// 成功レスポンス
{
    total: number,
    currency: string,
    details: ServiceUsage[],
    lastUpdated: string,
    _source: "cache" | "api"
}

// エラーレスポンス
{
    error: string,
    status: number
}
```

### 3.2 AWS API実装 (`app/api/aws/cost/route.ts`)

#### 認証設定
```typescript
const client = new CostExplorerClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});
```

#### Cost Explorer API呼び出し
```typescript
const command = new GetCostAndUsageCommand({
    TimePeriod: {
        Start: startOfMonth,
        End: endOfMonth,
    },
    Granularity: Granularity.MONTHLY,
    Metrics: ["UnblendedCost", "UsageQuantity"],
    GroupBy: [
        { Type: "DIMENSION", Key: "SERVICE" },
        { Type: "DIMENSION", Key: "REGION" },
    ],
});
```

### 3.3 Azure API実装

#### 認証設定
```typescript
const credential = new DefaultAzureCredential({
    tenantId: process.env.AZURE_TENANT_ID,
    clientId: process.env.AZURE_CLIENT_ID,
    clientSecret: process.env.AZURE_CLIENT_SECRET,
});
```

#### Consumption API呼び出し
```typescript
const consumptionClient = new ConsumptionManagementClient(
    credential,
    subscriptionId
);
```

### 3.4 Google Cloud API実装

#### 認証設定
```typescript
const client = new billing.CloudBillingClient({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});
```

### 2.3 新規ライブラリコンポーネント

#### MultiRegionResourceClient (`lib/multi-region-client.ts`)
**責務**: 複数AWSリージョンでの並行リソース取得

**主要機能**:
```typescript
export class MultiRegionResourceClient {
    async getResourcesFromAllRegions(regions: string[]): Promise<CloudResource[]>;
    async getResourcesFromRegion(region: string): Promise<RegionResult>;
    private getEC2Resources(region: string): Promise<CloudResource[]>;
    private getLambdaResources(region: string): Promise<CloudResource[]>;
    private getS3Resources(region: string): Promise<CloudResource[]>;
    private handleRegionError(region: string, error: Error): void;
}
```

**特徴**:
- Promise.allSettledによる並行処理
- リージョン別エラーハンドリング
- S3バケットの物理的場所検出
- 統計情報とフィルタリング機能

#### ResourceCoverageAnalyzer (`lib/resource-coverage-analyzer.ts`)
**責務**: リソースカバレッジ分析と権限提案

**主要機能**:
```typescript
export class ResourceCoverageAnalyzer {
    static analyzeCoverage(discoveredRegions: string[], resourceRegions: string[]): CoverageAnalysisResult;
    static generateComprehensivePolicy(): object;
    static generateMinimalPolicy(): object;
    private static generateRecommendedActions(uncoveredRegions: string[]): RecommendedAction[];
}
```

**分析結果**:
- カバレッジ率の計算
- 未対応リージョンの特定
- 推奨アクションの生成
- IAMポリシーの自動生成

## 4. データ管理

### 4.1 キャッシュシステム (`lib/file-cache.ts`)

#### ファイル構造
```typescript
export type CloudProvider = 
    'aws' | 'azure' | 'google' | 
    'aws_resources' | 'azure_resources' | 'google_resources';
```

#### キャッシュ操作
```typescript
// 読み込み
export async function getCache(provider: CloudProvider) {
    const data = await fs.readFile(CACHE_FILE, 'utf-8');
    const json = JSON.parse(data);
    return json[provider] || null;
}

// 書き込み
export async function setCache(provider: CloudProvider, data: any) {
    const cacheEntry = {
        ...data,
        lastUpdated: new Date().toISOString(),
    };
    currentCache[provider] = cacheEntry;
    await fs.writeFile(CACHE_FILE, JSON.stringify(currentCache, null, 2));
}
```

### 4.2 設定管理 (`lib/config.ts`)

#### 動的設定読み込み
```typescript
export function getConfig(key: string): string | undefined {
    try {
        const envPath = path.join(process.cwd(), '.env.local');
        if (fs.existsSync(envPath)) {
            const fileContent = fs.readFileSync(envPath, 'utf-8');
            const envConfig = dotenv.parse(fileContent);
            if (envConfig[key]) return envConfig[key];
        }
    } catch (e) {
        console.warn("Failed to load .env.local dynamically", e);
    }
    return process.env[key];
}
```

### 4.3 無料枠定義 (`lib/free-tier-limits.ts`)

#### データ構造
```typescript
export interface FreeTierLimit {
    serviceName: string;
    limit: number;
    unit: string;
    period: "MONTHLY" | "ALWAYS" | "12_MONTHS";
    description: string;
}
```

#### AWS無料枠定義例
```typescript
export const AWS_FREE_TIER_LIMITS: FreeTierLimit[] = [
    {
        serviceName: "AWS Lambda",
        limit: 1000000,
        unit: "Requests",
        period: "ALWAYS",
        description: "1M requests per month",
    },
    // ...
];
```

## 5. 状態管理パターン

### 5.1 ローカル状態管理
- **React useState**: コンポーネント内状態
- **useEffect**: 副作用・データフェッチ
- **カスタムフック**: 再利用可能なロジック

### 5.2 データフロー
```
User Action → API Call → Cache Update → State Update → UI Re-render
     ↓
Manual Refresh Button Click
     ↓
Promise.all([aws, azure, gcp])
     ↓
File Cache Write
     ↓
Component State Update
     ↓
Dashboard Re-render
```

## 6. エラーハンドリング戦略

### 6.1 API レベル
```typescript
try {
    const response = await client.send(command);
    // 成功処理
} catch (error: any) {
    console.warn("AWS API Warning:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
}
```

### 6.2 コンポーネントレベル
```typescript
const [error, setError] = useState<string | null>(null);

try {
    await fetchData();
} catch (e) {
    setError("データの取得に失敗しました");
    console.error("Failed to fetch cloud data", e);
}
```

### 6.3 ユーザーフィードバック
- **ローディング状態**: スピナー表示
- **エラーメッセージ**: 具体的な解決方法を提示
- **成功通知**: 更新完了の明確な表示

## 7. パフォーマンス最適化

### 7.1 API最適化
- **並行処理**: `Promise.all`による同時実行
- **キャッシュファースト**: 初回表示の高速化
- **条件付きフェッチ**: `refresh`パラメータによる制御

### 7.2 フロントエンド最適化
- **コンポーネント分割**: 責務の明確化
- **メモ化**: 不要な再計算の防止
- **遅延読み込み**: 必要時のみデータ取得

### 7.3 レンダリング最適化
```typescript
// 条件付きレンダリング
{loading && !totalCost && !lastUpdated ? (
    <LoadingSpinner />
) : (
    <DashboardContent />
)}

// プログレッシブ表示
<div className="animate-in fade-in duration-500">
    {/* コンテンツ */}
</div>
```

## 8. セキュリティ実装

### 8.1 環境変数管理
```typescript
// 必須チェック
if (!accessKeyId || !secretAccessKey) {
    return NextResponse.json(
        { error: "AWS credentials not found in env" },
        { status: 400 }
    );
}
```

### 8.2 ログ制御
```typescript
// 機密情報のマスキング
console.log("API call to AWS", { 
    region, 
    accessKeyId: accessKeyId?.substring(0, 4) + "****" 
});
```

### 8.3 権限最小化
- **読み取り専用**: `ReadOnlyAccess`ポリシー
- **必要最小限**: 課金情報とリソース情報のみ
- **定期ローテーション**: アクセスキーの定期更新推奨

## 9. テスト戦略

### 9.1 単体テスト
- **ユーティリティ関数**: `lib/`配下の関数
- **データ変換ロジック**: API レスポンス処理
- **計算ロジック**: 無料枠使用率計算

### 9.2 統合テスト
- **API エンドポイント**: モックデータでの動作確認
- **キャッシュ機能**: ファイル読み書きの検証
- **エラーハンドリング**: 異常系の動作確認

### 9.3 E2Eテスト
- **ユーザーフロー**: ダッシュボード表示から更新まで
- **レスポンシブ**: 各デバイスサイズでの表示確認
- **パフォーマンス**: 読み込み時間の測定

## 10. デプロイメント

### 10.1 ローカル開発
```bash
npm run dev    # 開発サーバー起動
npm run build  # プロダクションビルド
npm run start  # プロダクションサーバー起動
```

### 10.2 環境設定
- **開発環境**: `.env.local`での設定
- **本番環境**: 環境変数での設定
- **セキュリティ**: `.gitignore`での除外

### 10.3 監視・ログ
- **アプリケーションログ**: コンソール出力
- **エラートラッキング**: 例外の記録
- **パフォーマンス**: API応答時間の監視

---

このアーキテクチャドキュメントは、Cloud Counterシステムの技術的な詳細を包括的に説明しています。開発者がシステムの構造を理解し、効率的に開発・保守を行うための参考資料として活用してください。