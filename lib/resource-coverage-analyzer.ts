/**
 * リソースカバレッジ分析ユーティリティ
 * Cost Explorer APIで検出されたリージョンと実際に取得できたリソースを比較し、
 * 未対応サービスの存在をアラートする機能を提供
 */

export interface CoverageAnalysisResult {
    // 分析結果
    hasUncoveredResources: boolean;
    uncoveredRegions: string[];
    coveredRegions: string[];
    
    // 詳細情報
    totalDiscoveredRegions: number;
    totalCoveredRegions: number;
    coveragePercentage: number;
    
    // アラート情報
    alertMessage?: string;
    recommendedActions: RecommendedAction[];
}

export interface RecommendedAction {
    service: string;
    description: string;
    requiredPermissions: string[];
    estimatedCost: string;
}

export class ResourceCoverageAnalyzer {
    
    /**
     * リソースカバレッジを分析
     * @param discoveredRegions Cost Explorer APIで検出されたリージョン
     * @param resourceRegions 実際にリソースが取得できたリージョン
     * @returns 分析結果
     */
    static analyzeCoverage(
        discoveredRegions: string[],
        resourceRegions: string[]
    ): CoverageAnalysisResult {
        
        // 重複を除去してソート
        const discovered = [...new Set(discoveredRegions)].sort();
        const covered = [...new Set(resourceRegions)].sort();
        
        // カバーされていないリージョンを特定
        const uncovered = discovered.filter(region => !covered.includes(region));
        
        // カバレッジ率を計算
        const coveragePercentage = discovered.length > 0 
            ? Math.round((covered.length / discovered.length) * 100)
            : 100;
        
        // アラートメッセージを生成
        const alertMessage = uncovered.length > 0
            ? `${uncovered.length}個のリージョン（${uncovered.join(', ')}）で未対応のAWSサービスが検出されました。これらのリージョンではEC2、Lambda、S3以外のサービスが使用されている可能性があります。`
            : undefined;
        
        // 推奨アクションを生成
        const recommendedActions = uncovered.length > 0
            ? this.generateRecommendedActions(uncovered)
            : [];
        
        return {
            hasUncoveredResources: uncovered.length > 0,
            uncoveredRegions: uncovered,
            coveredRegions: covered,
            totalDiscoveredRegions: discovered.length,
            totalCoveredRegions: covered.length,
            coveragePercentage,
            alertMessage,
            recommendedActions
        };
    }
    
    /**
     * 推奨アクションを生成
     * @param uncoveredRegions カバーされていないリージョン
     * @returns 推奨アクション一覧
     */
    private static generateRecommendedActions(uncoveredRegions: string[]): RecommendedAction[] {
        const actions: RecommendedAction[] = [];
        
        // データベースサービス
        actions.push({
            service: "データベースサービス (RDS, DynamoDB)",
            description: "リレーショナルデータベースやNoSQLデータベースの情報を取得",
            requiredPermissions: [
                "rds:DescribeDBInstances",
                "rds:DescribeDBClusters",
                "dynamodb:ListTables",
                "dynamodb:DescribeTable"
            ],
            estimatedCost: "無料"
        });
        
        // コンテナサービス
        actions.push({
            service: "コンテナサービス (ECS, EKS)",
            description: "コンテナクラスターとサービスの情報を取得",
            requiredPermissions: [
                "ecs:ListClusters",
                "ecs:DescribeClusters",
                "ecs:ListServices",
                "eks:ListClusters",
                "eks:DescribeCluster"
            ],
            estimatedCost: "無料"
        });
        
        // ストレージサービス
        actions.push({
            service: "ストレージサービス (EBS, EFS)",
            description: "ブロックストレージとファイルシステムの情報を取得",
            requiredPermissions: [
                "ec2:DescribeVolumes",
                "efs:DescribeFileSystems"
            ],
            estimatedCost: "無料"
        });
        
        // ネットワークサービス
        actions.push({
            service: "ネットワークサービス (VPC, Load Balancer)",
            description: "VPCとロードバランサーの情報を取得",
            requiredPermissions: [
                "ec2:DescribeVpcs",
                "ec2:DescribeSubnets",
                "elbv2:DescribeLoadBalancers",
                "elb:DescribeLoadBalancers"
            ],
            estimatedCost: "無料"
        });
        
        return actions;
    }
    
    /**
     * 包括的な読み取り専用ポリシーを生成
     * @returns IAMポリシーJSON
     */
    static generateComprehensivePolicy(): object {
        return {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Sid": "CostExplorerAccess",
                    "Effect": "Allow",
                    "Action": [
                        "ce:GetDimensionValues"
                    ],
                    "Resource": "*"
                },
                {
                    "Sid": "BasicResourceAccess",
                    "Effect": "Allow",
                    "Action": [
                        "ec2:DescribeInstances",
                        "lambda:ListFunctions",
                        "s3:ListAllMyBuckets",
                        "s3:GetBucketLocation"
                    ],
                    "Resource": "*"
                },
                {
                    "Sid": "DatabaseResourceAccess",
                    "Effect": "Allow",
                    "Action": [
                        "rds:DescribeDBInstances",
                        "rds:DescribeDBClusters",
                        "dynamodb:ListTables",
                        "dynamodb:DescribeTable"
                    ],
                    "Resource": "*"
                },
                {
                    "Sid": "ContainerResourceAccess",
                    "Effect": "Allow",
                    "Action": [
                        "ecs:ListClusters",
                        "ecs:DescribeClusters",
                        "ecs:ListServices",
                        "eks:ListClusters",
                        "eks:DescribeCluster"
                    ],
                    "Resource": "*"
                },
                {
                    "Sid": "StorageResourceAccess",
                    "Effect": "Allow",
                    "Action": [
                        "ec2:DescribeVolumes",
                        "efs:DescribeFileSystems"
                    ],
                    "Resource": "*"
                },
                {
                    "Sid": "NetworkResourceAccess",
                    "Effect": "Allow",
                    "Action": [
                        "ec2:DescribeVpcs",
                        "ec2:DescribeSubnets",
                        "elbv2:DescribeLoadBalancers",
                        "elb:DescribeLoadBalancers"
                    ],
                    "Resource": "*"
                }
            ]
        };
    }
    
    /**
     * 最小権限ポリシーを生成
     * @returns IAMポリシーJSON
     */
    static generateMinimalPolicy(): object {
        return {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Sid": "CostExplorerAccess",
                    "Effect": "Allow",
                    "Action": [
                        "ce:GetDimensionValues"
                    ],
                    "Resource": "*"
                },
                {
                    "Sid": "BasicResourceAccess",
                    "Effect": "Allow",
                    "Action": [
                        "ec2:DescribeInstances",
                        "lambda:ListFunctions",
                        "s3:ListAllMyBuckets",
                        "s3:GetBucketLocation"
                    ],
                    "Resource": "*"
                }
            ]
        };
    }
}