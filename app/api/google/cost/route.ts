import { CloudBillingClient } from "@google-cloud/billing";
import { NextResponse, NextRequest } from "next/server";
import path from "path";
import { getCache, setCache } from "@/lib/file-cache";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const refresh = searchParams.get("refresh") === "true";

    // 1. キャッシュチェック (強制更新でない場合)
    if (!refresh) {
        const cachedData = await getCache("google");
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
        // Windows環境での相対パス問題を解決するため、明示的に絶対パスに変換する
        let keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;

        if (keyFilename) {
            // "./" や ".\" で始まる場合、またはファイル名のみの場合を考慮し、絶対パス化
            if (!path.isAbsolute(keyFilename)) {
                keyFilename = path.resolve(process.cwd(), keyFilename);
            }
        }

        // デバッグ用: パスが正しく解決されているか確認
        // console.log("GCP Key Path:", keyFilename);

        const client = new CloudBillingClient({ keyFilename });

        // 1. 請求アカウント一覧を取得
        const [billingAccounts] = await client.listBillingAccounts();

        if (billingAccounts.length === 0) {
            throw new Error("No billing accounts found.");
        }

        const accountNames = billingAccounts.map(ba => ba.displayName).join(", ");

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

        // 本物のコストデータは BigQuery がないと取れないため、接続確認のみ
        const responseData = {
            total: 0,
            currency: "JPY",
            period: { start: startOfMonth, end: endOfMonth },
            details: billingAccounts.map(account => ({
                service_name: `GCP Billing Account: ${account.displayName}`,
                region: "global",
                cost: "0", // APIでは取得不可 (BigQuery required)
                usage: "Active",
                cost_unit: "JPY",
                usage_unit: "Status"
            })),
            message: `Connection successful. Found accounts: ${accountNames}.`
        };

        // キャッシュ保存
        await setCache("google", responseData);

        return NextResponse.json({ ...responseData, _source: "api" });

    } catch (error: any) {
        console.warn("GCP API Warning:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
