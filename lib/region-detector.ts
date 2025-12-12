import { CostExplorerClient, GetDimensionValuesCommand } from '@aws-sdk/client-cost-explorer';
import { ErrorHandler } from './error-handler';

/**
 * リージョン検出結果の型定義
 */
export interface RegionDetectionResult {
  activeRegions: string[];
  invalidRegions: string[];
  totalFound: number;
  executionTime: number;
  costIncurred: number;
}

/**
 * リージョン検出設定の型定義
 */
export interface RegionDetectionConfig {
  timePeriodMonths: number;
  includeCurrentMonth: boolean;
  filterInvalidRegions: boolean;
  retryConfig?: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
  };
}

/**
 * AWS リージョン検出クラス
 * Cost Explorer APIを使用してアクティブなリージョンを効率的に検出
 */
export class RegionDetector {
  private readonly costExplorerClient: CostExplorerClient;
  private readonly defaultConfig: RegionDetectionConfig = {
    timePeriodMonths: 1,
    includeCurrentMonth: true,
    filterInvalidRegions: true,
    retryConfig: {
      maxRetries: 2,
      baseDelay: 1000,
      maxDelay: 5000
    }
  };

  constructor(credentials: { accessKeyId: string; secretAccessKey: string }) {
    this.costExplorerClient = new CostExplorerClient({
      region: 'us-east-1', // Cost Explorer APIは us-east-1 でのみ利用可能
      credentials
    });
  }

  /**
   * アクティブなリージョンを検出
   * @param config 検出設定
   * @returns 検出結果
   */
  async detectActiveRegions(config?: Partial<RegionDetectionConfig>): Promise<RegionDetectionResult> {
    const startTime = Date.now();
    const finalConfig = { ...this.defaultConfig, ...config };

    try {
      // 時間範囲を計算
      const { startDate, endDate } = this.calculateTimePeriod(finalConfig);

      // Cost Explorer API を呼び出し
      const command = new GetDimensionValuesCommand({
        TimePeriod: {
          Start: startDate,
          End: endDate,
        },
        Dimension: "REGION",
        Context: "COST_AND_USAGE"
      });

      const response = await ErrorHandler.withRetry(
        () => this.costExplorerClient.send(command),
        finalConfig.retryConfig
      );

      // レスポンスを解析
      const allRegions = response.DimensionValues
        ?.map(dim => dim.Value)
        .filter((region): region is string => region !== undefined) || [];
      
      const { validRegions, invalidRegions } = this.filterRegions(allRegions, finalConfig.filterInvalidRegions);

      const executionTime = Date.now() - startTime;

      const result: RegionDetectionResult = {
        activeRegions: validRegions,
        invalidRegions,
        totalFound: allRegions.length,
        executionTime,
        costIncurred: 0.01 // Cost Explorer API の課金額
      };

      console.log(`リージョン検出完了: ${validRegions.length}個の有効リージョン、${invalidRegions.length}個の無効リージョン (${executionTime}ms)`);
      
      return result;

    } catch (error) {
      console.error('リージョン検出エラー:', error);
      throw error;
    }
  }

  /**
   * 時間範囲を計算
   * @param config 検出設定
   * @returns 開始日と終了日
   */
  private calculateTimePeriod(config: RegionDetectionConfig): { startDate: string; endDate: string } {
    const now = new Date();
    
    let startDate: Date;
    let endDate: Date;

    if (config.includeCurrentMonth) {
      // 今月の開始日から今日まで
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else {
      // 前月の開始日から終了日まで
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      startDate = lastMonth;
      endDate = new Date(now.getFullYear(), now.getMonth(), 0); // 前月の最終日
    }

    // 複数月の場合は開始日を調整
    if (config.timePeriodMonths > 1) {
      startDate = new Date(startDate.getFullYear(), startDate.getMonth() - (config.timePeriodMonths - 1), 1);
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  }

  /**
   * リージョンをフィルタリング
   * @param regions 検出されたリージョンリスト
   * @param filterInvalid 無効なリージョンをフィルタリングするか
   * @returns フィルタリング結果
   */
  private filterRegions(regions: string[], filterInvalid: boolean): {
    validRegions: string[];
    invalidRegions: string[];
  } {
    const validRegions: string[] = [];
    const invalidRegions: string[] = [];

    regions.forEach(region => {
      if (this.isValidAWSRegion(region)) {
        validRegions.push(region);
      } else {
        invalidRegions.push(region);
        if (filterInvalid) {
          console.warn(`無効なリージョンをフィルタリング: ${region}`);
        }
      }
    });

    // 重複を除去
    const uniqueValidRegions = [...new Set(validRegions)];
    const uniqueInvalidRegions = [...new Set(invalidRegions)];

    return {
      validRegions: uniqueValidRegions,
      invalidRegions: uniqueInvalidRegions
    };
  }

  /**
   * AWSリージョンの妥当性をチェック
   * @param region リージョン名
   * @returns 有効なリージョンかどうか
   */
  private isValidAWSRegion(region: string): boolean {
    // AWS リージョンの基本的なパターンをチェック
    const regionPattern = /^[a-z]{2,3}-[a-z]+-\d+$/;
    
    // 既知の有効なAWSリージョンリスト（2024年12月時点）
    const validRegions = new Set([
      // US リージョン
      'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
      // EU リージョン
      'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-central-2',
      'eu-north-1', 'eu-south-1', 'eu-south-2',
      // アジア太平洋リージョン
      'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3',
      'ap-southeast-1', 'ap-southeast-2', 'ap-southeast-3', 'ap-southeast-4',
      'ap-south-1', 'ap-south-2', 'ap-east-1',
      // その他のリージョン
      'ca-central-1', 'ca-west-1',
      'sa-east-1',
      'af-south-1',
      'me-south-1', 'me-central-1',
      'il-central-1',
      // 中国リージョン
      'cn-north-1', 'cn-northwest-1',
      // GovCloud
      'us-gov-east-1', 'us-gov-west-1'
    ]);

    return regionPattern.test(region) && validRegions.has(region);
  }

  /**
   * リージョン検出の統計情報を取得
   * @param results 複数の検出結果
   * @returns 統計情報
   */
  static getDetectionStats(results: RegionDetectionResult[]): {
    totalExecutions: number;
    averageExecutionTime: number;
    totalCost: number;
    uniqueRegionsFound: string[];
    mostCommonRegions: { region: string; frequency: number }[];
  } {
    if (results.length === 0) {
      return {
        totalExecutions: 0,
        averageExecutionTime: 0,
        totalCost: 0,
        uniqueRegionsFound: [],
        mostCommonRegions: []
      };
    }

    const totalExecutionTime = results.reduce((sum, result) => sum + result.executionTime, 0);
    const totalCost = results.reduce((sum, result) => sum + result.costIncurred, 0);
    
    // 全ての発見されたリージョンを収集
    const allRegions = results.flatMap(result => result.activeRegions);
    const uniqueRegions = [...new Set(allRegions)];
    
    // リージョンの出現頻度を計算
    const regionFrequency = new Map<string, number>();
    allRegions.forEach(region => {
      regionFrequency.set(region, (regionFrequency.get(region) || 0) + 1);
    });
    
    const mostCommonRegions = Array.from(regionFrequency.entries())
      .map(([region, frequency]) => ({ region, frequency }))
      .sort((a, b) => b.frequency - a.frequency);

    return {
      totalExecutions: results.length,
      averageExecutionTime: totalExecutionTime / results.length,
      totalCost,
      uniqueRegionsFound: uniqueRegions,
      mostCommonRegions
    };
  }

  /**
   * リージョン検出結果の妥当性を検証
   * @param result 検証する結果
   * @returns 検証結果
   */
  static validateDetectionResult(result: RegionDetectionResult): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // 基本的な妥当性チェック
    if (result.activeRegions.length === 0 && result.invalidRegions.length === 0) {
      issues.push('リージョンが1つも検出されませんでした');
    }

    if (result.executionTime <= 0) {
      issues.push('実行時間が無効です');
    }

    if (result.costIncurred < 0) {
      issues.push('コストが負の値です');
    }

    if (result.totalFound !== result.activeRegions.length + result.invalidRegions.length) {
      issues.push('検出総数と有効・無効リージョン数の合計が一致しません');
    }

    // 重複チェック
    const allRegions = [...result.activeRegions, ...result.invalidRegions];
    const uniqueRegions = new Set(allRegions);
    if (allRegions.length !== uniqueRegions.size) {
      issues.push('重複するリージョンが含まれています');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }
}