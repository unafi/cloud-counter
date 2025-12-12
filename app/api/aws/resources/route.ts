import { NextResponse, NextRequest } from "next/server";
import { getCache, setCache } from "@/lib/file-cache";
import { getConfig } from "@/lib/config";
import { MultiRegionResourceClient } from "@/lib/multi-region-client";
import { ConfigManager } from "@/lib/config-manager";
import { ErrorHandler } from "@/lib/error-handler";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const refresh = searchParams.get("refresh") === "true";

    // 1. キャッシュチェック
    if (!refresh) {
        const cachedData = await getCache("aws_resources");
        if (cachedData) {
            return NextResponse.json({ ...cachedData, _source: "cache" });
        }
        return NextResponse.json({
            resources: [],
            message: "No cached data found.",
            _source: "empty_cache"
        });
    }

    try {
        // AWS認証情報の確認
        const accessKeyId = getConfig("AWS_ACCESS_KEY_ID");
        const secretAccessKey = getConfig("AWS_SECRET_ACCESS_KEY");

        if (!accessKeyId || !secretAccessKey) {
            return NextResponse.json(
                { error: "AWS credentials not found in env" },
                { status: 400 }
            );
        }

        // 設定されたリージョンを取得（マルチリージョン対応）
        const configuredRegions = ConfigManager.getRegionConfig();
        
        // リージョンが設定されていない場合はデフォルトリージョンを使用
        const regions = configuredRegions.length > 0 ? configuredRegions : ['us-east-1'];
        
        console.log(`${regions.length}個のリージョンからリソースを取得: ${regions.join(', ')}`);

        // MultiRegionResourceClientを使用してリソースを取得
        const multiRegionClient = new MultiRegionResourceClient();
        const resources = await ErrorHandler.withRetry(
            () => multiRegionClient.getResourcesFromAllRegions(regions),
            { maxRetries: 2, baseDelay: 1000, maxDelay: 5000 }
        );

        // 統計情報を取得
        const stats = multiRegionClient.getResourceStats(resources);
        
        const responseData = {
            resources,
            lastUpdated: new Date().toISOString(),
            regionCount: regions.length,
            stats: {
                totalResources: stats.totalCount,
                byRegion: stats.byRegion,
                byType: stats.byType,
                byStatus: stats.byStatus
            }
        };

        // キャッシュに保存
        await setCache("aws_resources", responseData);

        console.log(`マルチリージョンリソース取得完了: ${resources.length}個のリソース`);

        return NextResponse.json({ ...responseData, _source: "api" });

    } catch (error: any) {
        console.error("AWS Multi-Region Resource API Error:", error);
        
        // エラーハンドリング
        const errorResponse = ErrorHandler.handleResourceError(error);
        
        return NextResponse.json({
            error: errorResponse.message,
            action: errorResponse.action,
            recoverable: errorResponse.recoverable,
            errorCode: errorResponse.errorCode
        }, { status: 500 });
    }
}
