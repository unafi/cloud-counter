// Cloud Free Tier Limits Definition
// 各クラウドの無料枠（Always Free / 12 Months Free）の定義

export interface FreeTierLimit {
    serviceName: string; // APIから返ってくるサービス名（部分一致などでマッチさせる想定）
    limit: number;
    unit: string;
    period: "MONTHLY" | "ALWAYS" | "12_MONTHS";
    description: string;
}

export const AWS_FREE_TIER_LIMITS: FreeTierLimit[] = [
    {
        serviceName: "AWS Lambda",
        limit: 1000000,
        unit: "Requests",
        period: "ALWAYS",
        description: "1M requests per month",
    },
    {
        serviceName: "AWS Lambda - Compute", // 識別用（実際はAPIからGB-Secondsで来る）
        limit: 400000,
        unit: "GB-Seconds",
        period: "ALWAYS",
        description: "400,000 GB-seconds per month",
    },
    {
        serviceName: "Amazon Simple Storage Service", // S3
        limit: 5,
        unit: "GB-Mo",
        period: "12_MONTHS",
        description: "5GB Standard Storage",
    },
    {
        serviceName: "Amazon EC2", // t2.micro or t3.micro
        limit: 750,
        unit: "Hrs",
        period: "12_MONTHS",
        description: "750 hours per month (t2.micro/t3.micro)",
    },
    {
        serviceName: "Amazon SNS",
        limit: 1000000,
        unit: "Requests",
        period: "ALWAYS",
        description: "1M requests per month"
    }
];

export const AZURE_FREE_TIER_LIMITS: FreeTierLimit[] = [
    {
        serviceName: "Azure Functions",
        limit: 1000000,
        unit: "Requests",
        period: "ALWAYS",
        description: "1M requests per month",
    },
    {
        serviceName: "Azure App Service", // F1 Free
        limit: 1, // インスタンス数など、APIでの表現が難しいが一旦定義
        unit: "Instance",
        period: "ALWAYS",
        description: "10 Web/Mobile Apps (F1 Free Tier)",
    },
    {
        serviceName: "Bandwidth", // Data Transfer
        limit: 100, // 100GB (legacy) or 5GB depending on region/zone
        unit: "GB",
        period: "ALWAYS",
        description: "100GB Outbound Transfer"
    }
];

export const GCP_FREE_TIER_LIMITS: FreeTierLimit[] = [
    {
        serviceName: "Compute Engine", // e2-micro
        limit: 744, // 1 month approx
        unit: "Hrs",
        period: "ALWAYS", // if e2-micro in specific regions
        description: "e2-micro instance in us-west1/us-central1/us-east1",
    },
    {
        serviceName: "Cloud Storage",
        limit: 5,
        unit: "GB",
        period: "ALWAYS", // US-WEST1, US-CENTRAL1, US-EAST1 only
        description: "5GB Standard Storage",
    },
    {
        serviceName: "Cloud Functions",
        limit: 2000000,
        unit: "Requests",
        period: "ALWAYS",
        description: "2M invocations per month",
    }
];
