import { InstancesClient } from "@google-cloud/compute";
import { NextResponse, NextRequest } from "next/server";
import path from "path";
import { getCache, setCache } from "@/lib/file-cache";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const refresh = searchParams.get("refresh") === "true";

    if (!refresh) {
        const cachedData = await getCache("google_resources");
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
        let keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;

        if (keyFilename && !path.isAbsolute(keyFilename)) {
            keyFilename = path.resolve(process.cwd(), keyFilename);
        }

        const client = new InstancesClient({ keyFilename });

        // GCPの場合、プロジェクトIDとZoneが必要
        // プロジェクトIDは認証情報から取れる場合もあるが、環境設定で持っているのが確実
        // Zoneはすべて舐めるのは大変なので、主要Zoneに絞るか、AggregatedListを使う
        const projectId = await client.getProjectId();

        // aggregatedListAsyncを使用 (v6.0.0+ breaking change対応)
        // イテレータは [zone, scopedList] のタプルを返す
        const resources: any[] = [];
        for await (const [zone, scopedList] of client.aggregatedListAsync({ project: projectId })) {
            const instances = scopedList.instances;
            if (instances && instances.length > 0) {
                instances.forEach((instance: any) => {
                    // zone name format: "regions/us-central1/zones/us-central1-a" -> "us-central1-a"
                    const zoneName = zone.split("/").pop();

                    resources.push({
                        id: instance.id?.toString(),
                        name: instance.name,
                        type: "Compute Engine",
                        status: instance.status, // RUNNING, STOPPING, TERMINATED...
                        region: zoneName,
                        details: instance.machineType?.split("/").pop() // e2-micro etc
                    });
                });
            }
        }

        const responseData = {
            resources,
            lastUpdated: new Date().toISOString()
        };

        await setCache("google_resources", responseData);

        return NextResponse.json({ ...responseData, _source: "api" });

    } catch (error: any) {
        console.warn("GCP Resource API Warning:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
