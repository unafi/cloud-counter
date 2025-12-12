import { ConsumptionManagementClient } from "@azure/arm-consumption";
import { ClientSecretCredential } from "@azure/identity";
import { NextResponse, NextRequest } from "next/server";
import { getCache, setCache } from "@/lib/file-cache";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const refresh = searchParams.get("refresh") === "true";

    if (!refresh) {
        const cachedData = await getCache("azure");
        if (cachedData) {
            return NextResponse.json({ ...cachedData, _source: "cache" });
        }
        return NextResponse.json({
            total: 0,
            currency: "JPY",
            details: [],
            message: "No cached data found. Please click 'Update Data'.",
            _source: "empty_cache"
        });
    }

    try {
        const tenantId = process.env.AZURE_TENANT_ID;
        const clientId = process.env.AZURE_CLIENT_ID;
        const clientSecret = process.env.AZURE_CLIENT_SECRET;
        const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;

        if (!tenantId || !clientId || !clientSecret || !subscriptionId) {
            return NextResponse.json(
                { error: "Azure credentials not found in env" },
                { status: 400 }
            );
        }

        const credential = new ClientSecretCredential(
            tenantId,
            clientId,
            clientSecret
        );
        const client = new ConsumptionManagementClient(credential, subscriptionId);

        const now = new Date();
        // Azure billing query format dates
        // 注意: APIによっては日付フォーマットが厳密
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        // Filter string for UsageDetails
        // 例: usageStart ge '2023-10-01' and usageEnd le '2023-10-31'
        // 簡略化のため、今回は全件取得してJS側で集計するか、UsageDetails List APIを呼ぶ
        // 実際は "scope" に対してクエリするが、ここではサブスクリプションスコープを使用

        // Azure Cost Management API は複雑なので、ここではシンプルに「Daily Usage」を取得して合算する例
        // 実運用では "Query" API を使うのが一般的だが SDK @azure/arm-costmanagement が推奨される場合もある
        // ここでは @azure/arm-consumption の usageDetails を使用

        // scope format: /subscriptions/{subscriptionId}
        const scope = `subscriptions/${subscriptionId}`;

        // 実装: UsageDetails を取得して集計
        // アカウント作成直後だとデータが空の場合があるが、エラーにはならないはず
        const result = client.usageDetails.list(scope);

        let total = 0;
        const details = [];
        let count = 0;

        for await (const item of result) {
            // データ量が多すぎる場合は制限
            if (count >= 100) break;

            // SDKの型定義整合性のため any キャスト (Legacy/ModernのUnion対策)
            const i = item as any;

            total += i.pretaxCost || 0;

            details.push({
                service_name: i.consumedService || "Unknown",
                region: i.resourceLocation || "global",
                cost: i.pretaxCost?.toString() || "0",
                // Azureは usageQuantity というフィールド名、単位は unitOfMeasure 等
                usage: i.quantity?.toString() || "0",
                cost_unit: i.currency || "JPY",
                usage_unit: i.unitOfMeasure || "Unit"
            });

            count++;
        }

        const responseData = {
            total,
            currency: "JPY", // Azureのレスポンス依存だが一旦JPY/USDなどをそのまま流す
            period: { start: startOfMonth.toISOString().split("T")[0], end: endOfMonth.toISOString().split("T")[0] },
            details,
        };

        // キャッシュ保存
        await setCache("azure", responseData);

        return NextResponse.json({ ...responseData, _source: "api" });

    } catch (error: any) {
        console.warn("Azure API Warning:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
