/**
 * エラーハンドリングクラス
 * AWS API、設定ファイル、ネットワークエラーの包括的な処理を提供
 */

/**
 * エラーレスポンスの型定義
 */
export interface ErrorResponse {
  message: string;
  action: string;
  recoverable: boolean;
  errorCode?: string;
  retryAfter?: number;
}

/**
 * リトライ設定の型定義
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * エラーハンドリングクラス
 * 各種エラーの分類、処理、リトライ機能を提供
 */
export class ErrorHandler {
  private static readonly DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2
  };

  /**
   * Cost Explorer APIエラーを処理
   * @param error エラーオブジェクト
   * @returns エラーレスポンス
   */
  static handleCostExplorerError(error: Error): ErrorResponse {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name;

    // 権限不足エラー
    if (errorName === 'UnauthorizedOperation' || 
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('access denied')) {
      return {
        message: 'Cost Explorer APIの権限が不足しています',
        action: 'IAMユーザーまたはロールに「ce:GetDimensionValues」権限を追加してください。詳細はAWSコンソールのIAM設定を確認してください。',
        recoverable: true,
        errorCode: 'COST_EXPLORER_PERMISSION_DENIED'
      };
    }

    // クォータ超過エラー
    if (errorMessage.includes('throttling') || 
        errorMessage.includes('rate exceeded') ||
        errorMessage.includes('quota exceeded')) {
      return {
        message: 'Cost Explorer APIのレート制限に達しました',
        action: 'しばらく待ってから再試行してください。通常、1分後に利用可能になります。',
        recoverable: true,
        errorCode: 'COST_EXPLORER_RATE_LIMIT',
        retryAfter: 60
      };
    }

    // タイムアウトエラー
    if (errorMessage.includes('timeout') || 
        errorMessage.includes('timed out')) {
      return {
        message: 'Cost Explorer APIへの接続がタイムアウトしました',
        action: 'ネットワーク接続を確認して再試行してください。',
        recoverable: true,
        errorCode: 'COST_EXPLORER_TIMEOUT'
      };
    }

    // 一般的なネットワークエラー
    if (errorMessage.includes('network') || 
        errorMessage.includes('connection') ||
        errorMessage.includes('enotfound')) {
      return {
        message: 'ネットワーク接続エラーが発生しました',
        action: 'インターネット接続を確認し、ファイアウォール設定を確認してください。',
        recoverable: true,
        errorCode: 'NETWORK_ERROR'
      };
    }

    // その他のエラー
    return {
      message: `Cost Explorer APIエラー: ${error.message}`,
      action: 'AWS認証情報とネットワーク接続を確認してください。問題が続く場合は、AWSサービスの状態を確認してください。',
      recoverable: true,
      errorCode: 'COST_EXPLORER_UNKNOWN'
    };
  }

  /**
   * リソースAPIエラーを処理
   * @param error エラーオブジェクト
   * @param region 対象リージョン
   * @returns エラーレスポンス
   */
  static handleResourceError(error: Error, region?: string): ErrorResponse {
    const errorMessage = error.message.toLowerCase();
    const regionInfo = region ? ` (リージョン: ${region})` : '';

    // 権限不足エラー
    if (error.name === 'UnauthorizedOperation' ||
        errorMessage.includes('unauthorized') || 
        errorMessage.includes('access denied')) {
      return {
        message: `リソースAPIの権限が不足しています${regionInfo}`,
        action: 'IAMユーザーまたはロールに「ReadOnlyAccess」ポリシーを追加してください。',
        recoverable: true,
        errorCode: 'RESOURCE_API_PERMISSION_DENIED'
      };
    }

    // 無効なリージョンエラー
    if (errorMessage.includes('invalid region') || 
        errorMessage.includes('region not found') ||
        errorMessage.includes('region') && errorMessage.includes('not supported')) {
      return {
        message: `無効なリージョンが指定されました: ${region}`,
        action: '有効なAWSリージョン名を確認してください。',
        recoverable: false,
        errorCode: 'INVALID_REGION'
      };
    }

    // レート制限エラー
    if (errorMessage.includes('throttling') || 
        errorMessage.includes('rate exceeded')) {
      return {
        message: `APIレート制限に達しました${regionInfo}`,
        action: 'しばらく待ってから再試行してください。',
        recoverable: true,
        errorCode: 'RESOURCE_RATE_LIMIT',
        retryAfter: 30
      };
    }

    return {
      message: `リソース取得エラー${regionInfo}: ${error.message}`,
      action: 'AWS認証情報とリージョン設定を確認してください。',
      recoverable: true,
      errorCode: 'RESOURCE_ERROR'
    };
  }

  /**
   * 設定ファイルエラーを処理
   * @param error エラーオブジェクト
   * @returns エラーレスポンス
   */
  static handleConfigError(error: Error): ErrorResponse {
    const errorMessage = error.message.toLowerCase();

    // ファイル権限エラー
    if (errorMessage.includes('permission denied') || 
        errorMessage.includes('eacces')) {
      return {
        message: '.env.localファイルへの書き込み権限がありません',
        action: 'ファイルの権限を確認し、書き込み可能にしてください。Windowsの場合は管理者権限で実行してください。',
        recoverable: true,
        errorCode: 'CONFIG_FILE_PERMISSION_DENIED'
      };
    }

    // ディスク容量不足エラー
    if (errorMessage.includes('no space') || 
        errorMessage.includes('enospc')) {
      return {
        message: 'ディスク容量が不足しています',
        action: 'ディスク容量を確保してから再試行してください。',
        recoverable: true,
        errorCode: 'DISK_SPACE_INSUFFICIENT'
      };
    }

    // ファイルが見つからないエラー
    if (errorMessage.includes('no such file') || 
        errorMessage.includes('enoent')) {
      return {
        message: '.env.localファイルが見つかりません',
        action: 'プロジェクトルートに.env.localファイルを作成してください。',
        recoverable: true,
        errorCode: 'CONFIG_FILE_NOT_FOUND'
      };
    }

    return {
      message: `設定ファイルエラー: ${error.message}`,
      action: '.env.localファイルの存在と権限を確認してください。',
      recoverable: true,
      errorCode: 'CONFIG_ERROR'
    };
  }

  /**
   * 指数バックオフによるリトライ実行
   * @param operation 実行する非同期操作
   * @param config リトライ設定
   * @returns 操作の結果
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const retryConfig = { ...this.DEFAULT_RETRY_CONFIG, ...config };
    let lastError: Error;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // 最後の試行の場合はエラーを投げる
        if (attempt === retryConfig.maxRetries) {
          break;
        }

        // リトライ不可能なエラーの場合は即座に終了
        if (!this.isRetryableError(error as Error)) {
          break;
        }

        // 指数バックオフによる待機
        const delay = Math.min(
          retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt),
          retryConfig.maxDelay
        );
        
        console.warn(`操作が失敗しました。${delay}ms後に再試行します (${attempt + 1}/${retryConfig.maxRetries}):`, error);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * エラーがリトライ可能かどうかを判定
   * @param error エラーオブジェクト
   * @returns リトライ可能かどうか
   */
  private static isRetryableError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    
    // リトライ不可能なエラー
    const nonRetryableErrors = [
      'unauthorized',
      'access denied',
      'invalid region',
      'permission denied',
      'no such file'
    ];

    return !nonRetryableErrors.some(nonRetryable => 
      errorMessage.includes(nonRetryable)
    );
  }

  /**
   * 指定時間待機
   * @param ms 待機時間（ミリ秒）
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * エラーログを構造化して出力
   * @param error エラーオブジェクト
   * @param context エラーのコンテキスト情報
   */
  static logError(error: Error, context: Record<string, any> = {}): void {
    const errorInfo = {
      timestamp: new Date().toISOString(),
      message: error.message,
      name: error.name,
      stack: error.stack,
      context
    };

    console.error('Structured Error Log:', JSON.stringify(errorInfo, null, 2));
  }

  /**
   * 複数のエラーを統合して処理
   * @param errors エラーの配列
   * @returns 統合されたエラーレスポンス
   */
  static handleMultipleErrors(errors: Array<{ region?: string; error: Error }>): ErrorResponse {
    if (errors.length === 0) {
      return {
        message: '不明なエラーが発生しました',
        action: 'システム管理者に連絡してください。',
        recoverable: false,
        errorCode: 'UNKNOWN_ERROR'
      };
    }

    if (errors.length === 1) {
      const { error, region } = errors[0];
      return this.handleResourceError(error, region);
    }

    // 複数エラーの場合は統計情報を提供
    const errorTypes = new Map<string, number>();
    errors.forEach(({ error }) => {
      const errorType = this.categorizeError(error);
      errorTypes.set(errorType, (errorTypes.get(errorType) || 0) + 1);
    });

    const errorSummary = Array.from(errorTypes.entries())
      .map(([type, count]) => `${type}: ${count}件`)
      .join(', ');

    return {
      message: `複数のリージョンでエラーが発生しました (${errors.length}件)`,
      action: `エラー内訳: ${errorSummary}。各リージョンの設定と権限を確認してください。`,
      recoverable: true,
      errorCode: 'MULTIPLE_ERRORS'
    };
  }

  /**
   * エラーを分類
   * @param error エラーオブジェクト
   * @returns エラーカテゴリ
   */
  private static categorizeError(error: Error): string {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('unauthorized') || errorMessage.includes('access denied')) {
      return '権限エラー';
    }
    if (errorMessage.includes('throttling') || errorMessage.includes('rate exceeded')) {
      return 'レート制限';
    }
    if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
      return 'ネットワークエラー';
    }
    if (errorMessage.includes('invalid region')) {
      return '無効リージョン';
    }

    return 'その他のエラー';
  }

  /**
   * リソースAPIエラーを処理（テスト用エイリアス）
   * @param region 対象リージョン
   * @param error エラーオブジェクト
   * @returns エラーレスポンス
   */
  static handleResourceApiError(region: string, error: Error): ErrorResponse {
    return this.handleResourceError(error, region);
  }

  /**
   * 設定ファイルエラーを処理（テスト用エイリアス）
   * @param error エラーオブジェクト
   * @returns エラーレスポンス
   */
  static handleConfigFileError(error: Error): ErrorResponse {
    return this.handleConfigError(error);
  }

  /**
   * ユーザーフレンドリーなメッセージを生成
   * @param error エラーオブジェクト
   * @returns 機密情報をマスクしたメッセージ
   */
  static getUserFriendlyMessage(error: Error): string {
    let message = error.message;

    // AWS Access Key IDのマスキング (AKIA で始まる20文字) - 最優先で処理
    message = message.replace(/AKIA[A-Z0-9]{16}/g, 'AKIA****');
    
    // AWS Secret Access Keyのマスキング (40文字の英数字/記号) - 2番目に処理
    message = message.replace(/[A-Za-z0-9/+=]{40}/g, '****');
    
    // IPアドレスのマスキング
    message = message.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '***.***.***.**');

    return message;
  }
}