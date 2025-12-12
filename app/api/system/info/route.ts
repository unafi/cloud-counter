import { NextResponse } from "next/server";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { getConfig } from "@/lib/config";

export async function GET() {
    try {
        // 1. AWS Account ID (from STS)
        let awsAccountId = "<YOUR_ACCOUNT_ID>";
        try {
            const accessKeyId = getConfig("AWS_ACCESS_KEY_ID");
            const secretAccessKey = getConfig("AWS_SECRET_ACCESS_KEY");
            const region = getConfig("AWS_REGION") || "us-east-1";

            if (accessKeyId && secretAccessKey) {
                const sts = new STSClient({
                    credentials: { accessKeyId, secretAccessKey },
                    region
                });
                const identity = await sts.send(new GetCallerIdentityCommand({}));
                if (identity.Account) {
                    awsAccountId = identity.Account;
                }
            }
        } catch (e) {
            console.warn("Failed to fetch AWS Account ID", e);
        }

        // 2. Azure Subscription ID (from env)
        const azureSubscriptionId = getConfig("AZURE_SUBSCRIPTION_ID") || "<YOUR_SUBSCRIPTION_ID>";
        const azureTenantId = getConfig("AZURE_TENANT_ID") || "<YOUR_TENANT_ID>";
        const azureClientId = getConfig("AZURE_CLIENT_ID") || "<YOUR_CLIENT_ID>";

        // 3. GCP Project ID (from env or key file)
        let gcpProjectId = process.env.GOOGLE_CLOUD_PROJECT || "<YOUR_PROJECT_ID>";
        // Note: SDK can verify this, but for now getting from simple env or generic placeholder
        // If creds file exists, we could parse it, but that's complex. 
        // Assuming user might know it or we configured it.
        // Actually, getConfig doesn't easily parse JSON files.
        // Let's rely on standard env if available.

        return NextResponse.json({
            aws: { accountId: awsAccountId },
            azure: {
                subscriptionId: azureSubscriptionId,
                tenantId: azureTenantId,
                clientId: azureClientId
            },
            google: { projectId: gcpProjectId }
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
