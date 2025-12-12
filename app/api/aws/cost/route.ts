import { CostExplorerClient, GetCostAndUsageCommand, Granularity } from "@aws-sdk/client-cost-explorer";
import { NextResponse, NextRequest } from "next/server";
import { getCache, setCache } from "@/lib/file-cache";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const refresh = searchParams.get("refresh") === "true";

    // 1. キャッシュチェック (強制更新でない場合)
    if (!refresh) {
        const cachedData = await getCache("aws");
        if (cachedData) {
            return NextResponse.json({ ...cachedData, _source: "cache" });
        }
        // キャッシュがない場合は、初回としてAPIを取りに行くか、空を返すか。
        // ユーザー要望では「ボタン押下で更新」なので、初回でキャッシュがない時だけは
        // 自動で取るか、あるいは「データなし」を返すのが安全だが、
        // ここでは利便性のため「キャッシュなければ取る」動きにする（または空を返す）。
        // 今回は「キャッシュなければ空(未取得)」を返し、ユーザーにボタンを押させる方が
        // 「意図しない課金」を防ぐ意味で安全。
        return NextResponse.json({
            total: 0,
            currency: "USD",
            details: [],
            message: "No cached data found. Please click 'Update Data' to fetch latest costs via AWS API.",
            _source: "empty_cache"
        });
    }

    // 2. リアルAPIフェッチ (refresh=true)
    try {
        const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
        const region = process.env.AWS_REGION || "us-east-1";

        if (!accessKeyId || !secretAccessKey) {
            // ローカル開発用: 環境変数が設定されていない場合はモックデータを返すか、エラーを返す
            // ここではわかりやすくエラーにしてユーザーに設定を促す
            return NextResponse.json(
                { error: "AWS credentials not found in env" },
                { status: 400 }
            );
        }

        const client = new CostExplorerClient({
            region,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

        // AWS Cost Explorer Call
        // Metrics: 'UsageQuantity' を追加して、金額0円でも「使っているかどうか」を判別可能にする
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

        const response = await client.send(command);

        // データ整形
        // サービス x リージョンごとの明細を作成
        const services = response.ResultsByTime?.[0]?.Groups?.map((group) => ({
            service_name: group.Keys?.[0], // Service
            region: group.Keys?.[1],       // Region
            cost: group.Metrics?.UnblendedCost?.Amount,
            usage: group.Metrics?.UsageQuantity?.Amount,
            cost_unit: group.Metrics?.UnblendedCost?.Unit,
            usage_unit: group.Metrics?.UsageQuantity?.Unit,
        }));

        // コストが0より大きい、または使用量が0より大きいものだけフィルタリングしても良い
        // const activeServices = services?.filter(s => parseFloat(s.cost!) > 0 || parseFloat(s.usage!) > 0);

        const total = services?.reduce(
            (acc, curr) => acc + parseFloat(curr.cost || "0"),
            0
        );

        const responseData = {
            total,
            currency: "USD", // 通常USDで返ってくる
            period: { start: startOfMonth, end: endOfMonth },
            details: services,
        };

        // 3. キャッシュ保存
        await setCache("aws", responseData);

        return NextResponse.json({ ...responseData, _source: "api" });

    } catch (error: any) {
        console.warn("AWS API Warning:", error.message);

        // エラー時はキャッシュがあればそれを返すフォールバックも考えられるが、
        // 明示的にエラーをユーザーに伝えたほうがよい
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
