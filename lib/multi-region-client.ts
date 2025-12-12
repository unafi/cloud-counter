import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";
import { LambdaClient, ListFunctionsCommand } from "@aws-sdk/client-lambda";
import { getConfig } from './config';

/**
 * クラウドリソースの型定義（マルチリージョン対応）
 */
export interface CloudResource {
    id: string;
    name: string;
    type: string;
    status: string;
    region: string;
    regionDisplayName: string;
    crossRegionId: string;
    details?: string;
    // マルチリージョン対応の追加フィールド
    availability?: string; // リージョンの可用性情報
    lastSeen?: string; // 最後に確認された日時
    resourceArn?: string; // AWS ARN（利用可能な場合）
}

/**
 * リージョン処理結果の型定義
 */
export interface RegionResult {
    region: string;
    resources: CloudResource[];
    error?: string;
}

/**
 * マルチリージョンリソースクライアント
 * 複数のAWSリージョンで並行してリソース情報を取得する
 */
export class MultiRegionResourceClient {
    private readonly credentials: {
        accessKeyId: string;
        secretAccessKey: string;
    };

    constructor() {
        const accessKeyId = getConfig("AWS_ACCESS_KEY_ID");
        const secretAccessKey = getConfig("AWS_SECRET_ACCESS_KEY");

        if (!accessKeyId || !secretAccessKey) {
            throw new Error("AWS認証情報が設定されていません");
        }

        this.credentials = { accessKeyId, secretAccessKey };
    }

    /**
     * 全リージョンからリソースを並行取得
     * @param regions 対象リージョンのリスト
     * @returns 統合されたリソースリスト
     */
    async getResourcesFromAllRegions(regions: string[]): Promise<CloudResource[]> {
        if (regions.length === 0) {
            console.log('対象リージョンが指定されていません');
            return [];
        }

        console.log(`${regions.length}個のリージョンからリソースを取得中: ${regions.join(', ')}`);

        // 各リージョンで並行処理を実行
        const results = await Promise.allSettled(
            regions.map(region => this.getResourcesFromRegion(region))
        );

        const allResources: CloudResource[] = [];
        const errors: string[] = [];

        results.forEach((result, index) => {
            const region = regions[index];
            
            if (result.status === 'fulfilled') {
                const regionResult = result.value;
                if (regionResult.error) {
                    errors.push(`${region}: ${regionResult.error}`);
                    this.handleRegionError(region, new Error(regionResult.error));
                } else {
                    allResources.push(...regionResult.resources);
                    console.log(`${region}: ${regionResult.resources.length}個のリソースを取得`);
                }
            } else {
                errors.push(`${region}: ${result.reason.message}`);
                this.handleRegionError(region, result.reason);
            }
        });

        if (errors.length > 0) {
            console.warn(`一部のリージョンでエラーが発生しました: ${errors.join(', ')}`);
        }

        console.log(`合計 ${allResources.length}個のリソースを取得しました`);
        return allResources;
    }

    /**
     * 単一リージョンからリソースを取得
     * @param region 対象リージョン
     * @returns リージョン処理結果
     */
    async getResourcesFromRegion(region: string): Promise<RegionResult> {
        try {
            const [ec2Resources, lambdaResources] = await Promise.all([
                this.getEC2Resources(region),
                this.getLambdaResources(region)
            ]);

            const allResources = [...ec2Resources, ...lambdaResources];

            return {
                region,
                resources: allResources
            };

        } catch (error: any) {
            return {
                region,
                resources: [],
                error: error.message
            };
        }
    }

    /**
     * EC2インスタンスを取得
     * @param region 対象リージョン
     * @returns EC2リソースリスト
     */
    private async getEC2Resources(region: string): Promise<CloudResource[]> {
        try {
            const ec2Client = new EC2Client({
                region,
                credentials: this.credentials
            });

            const command = new DescribeInstancesCommand({});
            const response = await ec2Client.send(command);

            const instances: CloudResource[] = [];

            response.Reservations?.forEach(reservation => {
                reservation.Instances?.forEach(instance => {
                    const nameTag = instance.Tags?.find(t => t.Key === "Name")?.Value;
                    const instanceName = nameTag || instance.InstanceId || 'Unknown';

                    instances.push({
                        id: instance.InstanceId || 'unknown',
                        name: instanceName,
                        type: "EC2",
                        status: instance.State?.Name || 'unknown',
                        region: region,
                        regionDisplayName: this.getRegionDisplayName(region),
                        crossRegionId: `ec2-${region}-${instance.InstanceId}`,
                        details: instance.InstanceType,
                        availability: instance.Placement?.AvailabilityZone || region,
                        lastSeen: new Date().toISOString(),
                        resourceArn: `arn:aws:ec2:${region}:*:instance/${instance.InstanceId}`
                    });
                });
            });

            return instances;

        } catch (error: any) {
            console.warn(`EC2リソース取得エラー (${region}):`, error.message);
            throw error;
        }
    }

    /**
     * Lambda関数を取得
     * @param region 対象リージョン
     * @returns Lambdaリソースリスト
     */
    private async getLambdaResources(region: string): Promise<CloudResource[]> {
        try {
            const lambdaClient = new LambdaClient({
                region,
                credentials: this.credentials
            });

            const command = new ListFunctionsCommand({});
            const response = await lambdaClient.send(command);

            const functions = response.Functions?.map(fn => ({
                id: fn.FunctionArn || 'unknown',
                name: fn.FunctionName || 'Unknown',
                type: "Lambda",
                status: "Active", // Lambdaは基本的にActive
                region: region,
                regionDisplayName: this.getRegionDisplayName(region),
                crossRegionId: `lambda-${region}-${fn.FunctionName}`,
                details: fn.Runtime,
                availability: region, // Lambdaはリージョンレベル
                lastSeen: new Date().toISOString(),
                resourceArn: fn.FunctionArn
            })) || [];

            return functions;

        } catch (error: any) {
            console.warn(`Lambda関数取得エラー (${region}):`, error.message);
            throw error;
        }
    }

    /**
     * リージョンエラーを処理
     * @param region エラーが発生したリージョン
     * @param error エラーオブジェクト
     */
    private handleRegionError(region: string, error: Error): void {
        console.warn(`Region ${region} でエラーが発生しましたがスキップして続行します:`, error.message);
        
        // エラーの種類に応じた詳細なログ
        if (error.message.includes('UnauthorizedOperation')) {
            console.warn(`${region}: 権限不足です。ReadOnlyAccessポリシーが必要です。`);
        } else if (error.message.includes('InvalidRegion')) {
            console.warn(`${region}: 無効なリージョンです。`);
        } else if (error.message.includes('RequestLimitExceeded')) {
            console.warn(`${region}: APIリクエスト制限に達しました。しばらく待ってから再試行してください。`);
        }
    }

    /**
     * リージョンの表示名を取得
     * @param region リージョンコード
     * @returns 表示用リージョン名
     */
    private getRegionDisplayName(region: string): string {
        const regionNames: { [key: string]: string } = {
            'us-east-1': 'US East (N. Virginia)',
            'us-east-2': 'US East (Ohio)',
            'us-west-1': 'US West (N. California)',
            'us-west-2': 'US West (Oregon)',
            'eu-west-1': 'Europe (Ireland)',
            'eu-west-2': 'Europe (London)',
            'eu-west-3': 'Europe (Paris)',
            'eu-central-1': 'Europe (Frankfurt)',
            'eu-north-1': 'Europe (Stockholm)',
            'ap-northeast-1': 'Asia Pacific (Tokyo)',
            'ap-northeast-2': 'Asia Pacific (Seoul)',
            'ap-northeast-3': 'Asia Pacific (Osaka)',
            'ap-southeast-1': 'Asia Pacific (Singapore)',
            'ap-southeast-2': 'Asia Pacific (Sydney)',
            'ap-south-1': 'Asia Pacific (Mumbai)',
            'ap-east-1': 'Asia Pacific (Hong Kong)',
            'ca-central-1': 'Canada (Central)',
            'sa-east-1': 'South America (São Paulo)',
            'af-south-1': 'Africa (Cape Town)',
            'me-south-1': 'Middle East (Bahrain)'
        };

        return regionNames[region] || region;
    }

    /**
     * リソースの統計情報を取得
     * @param resources リソースリスト
     * @returns 統計情報
     */
    getResourceStats(resources: CloudResource[]): {
        totalCount: number;
        byRegion: { [region: string]: number };
        byType: { [type: string]: number };
        byStatus: { [status: string]: number };
    } {
        const stats = {
            totalCount: resources.length,
            byRegion: {} as { [region: string]: number },
            byType: {} as { [type: string]: number },
            byStatus: {} as { [status: string]: number }
        };

        resources.forEach(resource => {
            // リージョン別
            stats.byRegion[resource.region] = (stats.byRegion[resource.region] || 0) + 1;
            
            // タイプ別
            stats.byType[resource.type] = (stats.byType[resource.type] || 0) + 1;
            
            // ステータス別
            stats.byStatus[resource.status] = (stats.byStatus[resource.status] || 0) + 1;
        });

        return stats;
    }

    /**
     * 稼働中のリソースのみをフィルタリング
     * @param resources リソースリスト
     * @returns 稼働中のリソースリスト
     */
    getActiveResources(resources: CloudResource[]): CloudResource[] {
        const activeStatuses = ['running', 'active', 'available', 'in-use'];
        
        return resources.filter(resource => 
            activeStatuses.includes(resource.status.toLowerCase())
        );
    }

    /**
     * 特定のリージョンのリソースをフィルタリング
     * @param resources リソースリスト
     * @param region 対象リージョン
     * @returns 指定リージョンのリソースリスト
     */
    getResourcesByRegion(resources: CloudResource[], region: string): CloudResource[] {
        return resources.filter(resource => resource.region === region);
    }
}