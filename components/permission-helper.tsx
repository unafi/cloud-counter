"use client";

import { useState, useEffect } from "react";
import { Check, Copy, Terminal, Loader2 } from "lucide-react";

export default function PermissionHelper() {
    const [info, setInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Fetch system info on mount
    useEffect(() => {
        const fetchInfo = async () => {
            try {
                const res = await fetch("/api/system/info");
                const data = await res.json();
                setInfo(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchInfo();
    }, []);

    const CopyButton = ({ text }: { text: string }) => {
        const [copied, setCopied] = useState(false);
        return (
            <button
                onClick={() => {
                    navigator.clipboard.writeText(text);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                }}
                className="absolute top-2 right-2 p-2 bg-background rounded-md border hover:bg-muted transition-colors opacity-80 hover:opacity-100"
                title="Copy to clipboard"
            >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
        );
    };

    const awsCmd = `# 1. 必要なポリシーファイルを作成
cat <<EOF > policy.json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ce:GetCostAndUsage",
                "ce:GetDimensionValues",
                "ec2:DescribeInstances",
                "lambda:ListFunctions"
            ],
            "Resource": "*"
        }
    ]
}
EOF

# 2. ポリシーを作成してユーザーにアタッチ (ユーザー名は適宜変更)
# Account ID: ${info?.aws?.accountId || "Fetching..."}
aws iam create-policy --policy-name CloudCounterPolicy --policy-document file://policy.json
aws iam attach-user-policy --user-name <YOUR_USER_NAME> --policy-arn arn:aws:iam::${info?.aws?.accountId}:policy/CloudCounterPolicy`;

    const azureCmd = `# Service Principal 作成 (Cost Management Reader + Reader)
# Subscription ID: ${info?.azure?.subscriptionId || "Fetching..."}

az ad sp create-for-rbac --name "CloudCounterApp" --role "Cost Management Reader" --scopes /subscriptions/${info?.azure?.subscriptionId}

# 追加で Reader (閲覧者) ロールも付与する場合:
# (上記コマンドの出力から appId を取得して使用)
# az role assignment create --assignee <APP_ID> --role "Reader" --scope /subscriptions/${info?.azure?.subscriptionId}`;

    const gcpCmd = `# 1. Compute Viewer Role (リソース閲覧用)
# Project ID: ${info?.google?.projectId || "Fetching..."}
# Service Account Email: (JSONキー内の client_email を確認してください)
# Email: ${info?.google?.projectId ? "checking..." : "<YOUR_SERVICE_ACCOUNT_EMAIL>"}

gcloud projects add-iam-policy-binding ${info?.google?.projectId} \\
    --member="serviceAccount:<YOUR_SERVICE_ACCOUNT_EMAIL>" \\
    --role="roles/compute.viewer"

# 2. (Optional) Cloud Functions Viewer
gcloud projects add-iam-policy-binding ${info?.google?.projectId} \\
    --member="serviceAccount:<YOUR_SERVICE_ACCOUNT_EMAIL>" \\
    --role="roles/cloudfunctions.viewer"`;

    if (loading) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin w-8 h-8 text-muted-foreground" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="bg-card p-6 rounded-lg border shadow-sm">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Terminal className="w-5 h-5" />
                    権限設定支援 (Permission Setup Helper)
                </h2>
                <p className="text-sm text-muted-foreground mb-6">
                    以下のコマンドをターミナルで実行することで、必要な権限を付与できます。
                    <br />
                    各CLIツールがインストールされ、ログイン済み (<code>aws configure</code>, <code>az login</code>, <code>gcloud auth login</code>) である必要があります。
                </p>

                <div className="space-y-8">
                    {/* AWS */}
                    <section>
                        <h3 className="text-lg font-semibold mb-2 text-orange-500 flex items-center gap-2">
                            AWS
                            <span className="text-xs text-muted-foreground font-normal border px-2 py-0.5 rounded ml-2">aws-cli</span>
                        </h3>
                        <div className="bg-slate-950 text-slate-50 p-4 rounded-md font-mono text-sm overflow-x-auto relative group shadow-inner">
                            <pre>{awsCmd}</pre>
                            <CopyButton text={awsCmd} />
                        </div>
                    </section>

                    {/* Azure */}
                    <section>
                        <h3 className="text-lg font-semibold mb-2 text-blue-500 flex items-center gap-2">
                            Azure
                            <span className="text-xs text-muted-foreground font-normal border px-2 py-0.5 rounded ml-2">azure-cli</span>
                        </h3>
                        <div className="bg-slate-950 text-slate-50 p-4 rounded-md font-mono text-sm overflow-x-auto relative group shadow-inner">
                            <pre>{azureCmd}</pre>
                            <CopyButton text={azureCmd} />
                        </div>
                    </section>

                    {/* GCP */}
                    <section>
                        <h3 className="text-lg font-semibold mb-2 text-blue-400 flex items-center gap-2">
                            Google Cloud
                            <span className="text-xs text-muted-foreground font-normal border px-2 py-0.5 rounded ml-2">gcloud sdk</span>
                        </h3>
                        <div className="bg-slate-950 text-slate-50 p-4 rounded-md font-mono text-sm overflow-x-auto relative group shadow-inner">
                            <pre>{gcpCmd}</pre>
                            <CopyButton text={gcpCmd} />
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
