import { ComputeManagementClient } from "@azure/arm-compute";
import { WebSiteManagementClient } from "@azure/arm-appservice";
import { ClientSecretCredential } from "@azure/identity";
import { NextResponse, NextRequest } from "next/server";
import { getCache, setCache } from "@/lib/file-cache";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const refresh = searchParams.get("refresh") === "true";

    if (!refresh) {
        const cachedData = await getCache("azure_resources");
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

        const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);

        // Clients
        const computeClient = new ComputeManagementClient(credential, subscriptionId);
        const webClient = new WebSiteManagementClient(credential, subscriptionId);

        const resources = [];

        // Fetch VMs
        const vms = computeClient.virtualMachines.listAll();
        for await (const vm of vms) {
            // ステータス詳細取得には instanceView が必要だが、リスト取得だけでは取れない場合がある
            // ここでは簡易的に存在リストを表示し、ステータスは別途取得するのが理想だが、
            // APIコール数を抑えるため、VMごとに instanceView を呼ぶのは避けるか、数が少なければ呼ぶ
            // プロトタイプなので、とりあえず "Unknown" または、できれば取得する

            // Note: listAll does not return instance view. Need to call get with expand
            // しかしN+1問題になるので、今回は一覧のみとするか、小規模前提でループする
            // -> 小規模前提で詳細取得を試みる
            let status = "Unknown";
            try {
                // リソースグループ名が必要
                const rgName = vm.id?.split("/")[4]; // /subscriptions/{sub}/resourceGroups/{rg}/...
                if (rgName && vm.name) {
                    const view = await computeClient.virtualMachines.instanceView(rgName, vm.name);
                    // PowerState/Running を探す
                    const powerState = view.statuses?.find(s => s.code?.startsWith("PowerState/"));
                    status = powerState?.displayStatus || "Unknown";
                }
            } catch (e) {
                console.warn("Failed to get VM view", e);
            }

            resources.push({
                id: vm.id,
                name: vm.name,
                type: "Virtual Machine",
                status: status,
                region: vm.location,
                details: vm.hardwareProfile?.vmSize
            });
        }

        // Fetch App Services (Functions)
        const apps = webClient.webApps.list();
        for await (const app of apps) {
            resources.push({
                id: app.id,
                name: app.name,
                type: app.kind?.includes("functionapp") ? "Azure Functions" : "App Service",
                status: app.state, // Running / Stopped
                region: app.location,
                details: app.defaultHostName
            });
        }

        const responseData = {
            resources,
            lastUpdated: new Date().toISOString()
        };

        await setCache("azure_resources", responseData);

        return NextResponse.json({ ...responseData, _source: "api" });

    } catch (error: any) {
        console.warn("Azure Resource API Warning:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
