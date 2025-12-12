# API実装・権限・課金設計書

## 1. 現状のAPI利用状況と課題

現在実装されている機能に必要なAPI、権限、および課金体系の整理です。

### 1-1. AWS
*   **Cost Explorer API** (コスト取得)
    *   **権限**: `ce:GetCostAndUsage`
    *   **課金**: **$0.01 / request** (手動更新時のみ発生)
    *   **現状**: グローバル（非リージョン）として動作。
*   **EC2 / Lambda API** (リソース取得)
    *   **権限**: `ec2:DescribeInstances`, `lambda:ListFunctions` (ReadOnlyAccess)
    *   **課金**: 無料 (通常のAPIコール制限内)
    *   **課題**: `.env.local` の `AWS_REGION` に依存。指定リージョン以外のリソースが見えない。

### 1-2. Azure
*   **Consumption API** (コスト取得)
    *   **権限**: `Cost Management Reader`
    *   **課金**: 無料 (ただし一部APIはThrottlingあり)
*   **Compute / AppService API** (リソース取得)
    *   **権限**: `Reader` (サブスクリプション全体)
    *   **課金**: 無料

### 1-3. Google Cloud (GCP)
*   **Cloud Billing API** (コスト取得)
    *   **権限**: `Billing Account Viewer` (請求アカウント閲覧者)
    *   **課金**: 無料 (BigQuery連携時はQuery課金)
    *   **制限**: APIでは正確なコスト値が取れない（BigQuery必須）。現在は接続確認のみ。
*   **Compute Engine API** (リソース取得)
    *   **権限**: `Compute Viewer` (Compute 閲覧者)
    *   **課金**: 無料

---

## 2. 全リージョン横断取得機能 (Cross-Region Strategy)

「どのリージョンで何が動いているかわからない」を解決するための設計です。

### 実現方法 (AWS)
AWSはリソース系APIがリージョン別であるため、以下の戦略をとります。

1.  **アクティブリージョンの特定**:
    *   Cost Explorer API の `GetDimensionValues` (Key=REGION) を使用して、課金が発生しているリージョン一覧を取得する。
    *   **コスト**: **$0.01** (1コール)
2.  **各リージョンへのリソース問い合わせ**:
    *   特定されたリージョンに対してのみ `EC2 DescribeInstances` 等を実行する。
    *   **コスト**: 無料
    *   **メリット**: 無駄な全リージョン走査（APIコール数爆発）を防ぎつつ、隠れたリソースを発見できる。

### 必要な権限
*   `ce:GetDimensionValues` (既存のBilling権限に含まれることが多い)
*   各リージョンでの `ReadOnlyAccess` (IAMユーザーはデフォルトで全リージョン対象なので追加設定不要)

---

## 3. 権限自動付与機能 (Auto-Permission Automation)

ユーザーが手動でIAMポリシーを追加する手間を省く機能の検討です。

### 実現可能性とリスク
*   **方法**: アプリに `AdministratorAccess` (またはそれに準ずる強力な権限) を持つクレデンシャルを渡す。アプリが `iam:AttachUserPolicy` 等を実行して、自分自身に必要な権限（ReadOnlyAccess等）を付与する。
*   **リスク (高)**:
    *   ローカルPC内に **Admin権限のキー** を保存する必要がある。マルウェア等に漏洩した場合、AWSアカウント全体が乗っ取られる危険がある。
    *   **結論**: **「アプリによる自動付与」はセキュリティリスクが高すぎるため非推奨。**

### 代替案 (推奨)
*   **初期セットアップスクリプト**: 
    *   アプリが「CloudFormationテンプレート」や「Terraformコード」、あるいは「AWS CLI用コマンド」を生成する。
    *   ユーザーはそれをコピーして、一度だけCLI等で実行する。これならアプリにAdmin権限を渡す必要がない。

---

## 4. Hot Deploy (npm run dev) 対応

### 現状の課題
*   `.env.local` を書き換えても反映されない。
    *   **理由**: Next.js (Node.js) は起動時に環境変数をメモリにロードするため、ファイル変更検知による再読み込み機能がない。
*   コード変更はHot Reloadされるが、動作が不安定な場合がある。

### 対応策
1.  **環境変数の動的読み込み**:
    *   APIルート内で `dotenv.config()` を毎回呼ぶか、`.env` ファイルを `fs` で直接読んでパースするロジックに変更する。
    *   これにより、サーバー再起動なしで設定変更を反映可能になる。
2.  **nodemon等の導入**:
    *   環境変数ファイルの変更を検知して、自動で `next dev` プロセスを再起動するツール (`nodemon`) を導入する。これが最も手軽で確実。

---

## 5. 次のフェーズのタスクリスト (Phase 6 案)

*   [ ] **Bug Fix**: 東京リージョンでリソースが見えない問題の調査（ログ詳細化、Region環境変数の動的読込テスト）
*   [ ] **Feature**: AWS全リージョン対応（Cost ExplorerによるActive Region検知の実装）
*   [ ] **Feature**: 環境変数(Config)のホットリロード対応（`dotenv` 動的読み込み化）
*   [ ] **Feature**: 権限設定支援（「このコマンドを実行してください」を表示する機能の実装）
