import fs from 'fs/promises';
import path from 'path';

/**
 * リージョン発見キャッシュエントリの型定義
 */
export interface DiscoveryCacheEntry {
  lastDiscovery: string; // YYYY-MM-DD形式
  timestamp: string; // ISO形式のタイムスタンプ
  discoveredRegions: string[];
  executionTime: number;
  costIncurred: number;
  requestCount: number; // 同日内のリクエスト回数
}

/**
 * キャッシュ統計情報の型定義
 */
export interface CacheStats {
  totalExecutions: number;
  totalCost: number;
  averageExecutionTime: number;
  lastExecution?: string;
  preventedDuplicates: number;
}

/**
 * リージョン発見キャッシュ管理クラス
 * 重複実行防止とコスト最適化を担当
 */
export class DiscoveryCache {
  private readonly cacheDir: string;
  private readonly cacheFile: string;
  
  constructor(baseDir?: string) {
    this.cacheDir = path.join(baseDir || process.cwd(), 'data');
    this.cacheFile = path.join(this.cacheDir, 'region-discovery-cache.json');
  }

  /**
   * キャッシュディレクトリを初期化
   */
  private async ensureCacheDir(): Promise<void> {
    try {
      await fs.access(this.cacheDir);
    } catch {
      await fs.mkdir(this.cacheDir, { recursive: true });
      console.log(`キャッシュディレクトリを作成: ${this.cacheDir}`);
    }
  }

  /**
   * 今日の実行が既に存在するかチェック
   * @returns 実行済みの場合はキャッシュエントリ、未実行の場合はnull
   */
  async checkTodayExecution(): Promise<DiscoveryCacheEntry | null> {
    try {
      const cache = await this.loadCache();
      const today = new Date().toISOString().split('T')[0];
      
      if (cache && cache.lastDiscovery === today) {
        console.log(`本日(${today})の実行記録を発見: ${cache.requestCount}回目のリクエスト`);
        
        // リクエスト回数を増加
        cache.requestCount += 1;
        await this.saveCache(cache);
        
        return cache;
      }
      
      return null;
    } catch (error) {
      console.warn('キャッシュチェック中にエラー:', error);
      return null;
    }
  }

  /**
   * 新しい実行結果をキャッシュに保存
   * @param discoveredRegions 発見されたリージョン
   * @param executionTime 実行時間（ミリ秒）
   * @param costIncurred 発生コスト
   */
  async saveExecution(
    discoveredRegions: string[], 
    executionTime: number, 
    costIncurred: number
  ): Promise<void> {
    try {
      await this.ensureCacheDir();
      
      const today = new Date().toISOString().split('T')[0];
      const timestamp = new Date().toISOString();
      
      const cacheEntry: DiscoveryCacheEntry = {
        lastDiscovery: today,
        timestamp,
        discoveredRegions,
        executionTime,
        costIncurred,
        requestCount: 1
      };
      
      await this.saveCache(cacheEntry);
      console.log(`リージョン発見実行をキャッシュに保存: ${today}`);
      
    } catch (error) {
      console.error('キャッシュ保存エラー:', error);
      throw error;
    }
  }

  /**
   * キャッシュファイルからデータを読み込み
   */
  private async loadCache(): Promise<DiscoveryCacheEntry | null> {
    try {
      const cacheContent = await fs.readFile(this.cacheFile, 'utf-8');
      return JSON.parse(cacheContent) as DiscoveryCacheEntry;
    } catch (error) {
      // ファイルが存在しない場合は正常
      if ((error as any).code === 'ENOENT') {
        return null;
      }
      console.warn('キャッシュファイル読み込みエラー:', error);
      return null;
    }
  }

  /**
   * キャッシュファイルにデータを保存
   */
  private async saveCache(cache: DiscoveryCacheEntry): Promise<void> {
    await this.ensureCacheDir();
    await fs.writeFile(this.cacheFile, JSON.stringify(cache, null, 2), 'utf-8');
  }

  /**
   * キャッシュ統計情報を取得
   */
  async getStats(): Promise<CacheStats> {
    try {
      const cache = await this.loadCache();
      
      if (!cache) {
        return {
          totalExecutions: 0,
          totalCost: 0,
          averageExecutionTime: 0,
          preventedDuplicates: 0
        };
      }
      
      return {
        totalExecutions: 1, // 現在のキャッシュ実装では1実行のみ記録
        totalCost: cache.costIncurred,
        averageExecutionTime: cache.executionTime,
        lastExecution: cache.timestamp,
        preventedDuplicates: Math.max(0, cache.requestCount - 1)
      };
      
    } catch (error) {
      console.warn('統計情報取得エラー:', error);
      return {
        totalExecutions: 0,
        totalCost: 0,
        averageExecutionTime: 0,
        preventedDuplicates: 0
      };
    }
  }

  /**
   * 指定した日数より古いキャッシュを削除
   * @param daysToKeep 保持する日数（デフォルト: 30日）
   */
  async cleanupOldCache(daysToKeep: number = 30): Promise<void> {
    try {
      const cache = await this.loadCache();
      
      if (!cache) {
        return;
      }
      
      const cacheDate = new Date(cache.lastDiscovery);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      if (cacheDate < cutoffDate) {
        await fs.unlink(this.cacheFile);
        console.log(`古いキャッシュを削除: ${cache.lastDiscovery}`);
      }
      
    } catch (error) {
      console.warn('キャッシュクリーンアップエラー:', error);
    }
  }

  /**
   * キャッシュを完全にクリア
   */
  async clearCache(): Promise<void> {
    try {
      await fs.unlink(this.cacheFile);
      console.log('キャッシュをクリアしました');
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        console.warn('キャッシュクリアエラー:', error);
      }
    }
  }

  /**
   * キャッシュファイルの存在確認
   */
  async exists(): Promise<boolean> {
    try {
      await fs.access(this.cacheFile);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * キャッシュの妥当性を検証
   */
  async validateCache(): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    try {
      const cache = await this.loadCache();
      
      if (!cache) {
        return { isValid: true, issues: [] }; // キャッシュなしは有効
      }
      
      // 日付形式の検証
      if (!/^\d{4}-\d{2}-\d{2}$/.test(cache.lastDiscovery)) {
        issues.push('無効な日付形式');
      }
      
      // タイムスタンプの検証
      if (isNaN(new Date(cache.timestamp).getTime())) {
        issues.push('無効なタイムスタンプ');
      }
      
      // リージョンリストの検証
      if (!Array.isArray(cache.discoveredRegions)) {
        issues.push('リージョンリストが配列ではありません');
      }
      
      // 数値フィールドの検証
      if (typeof cache.executionTime !== 'number' || cache.executionTime < 0) {
        issues.push('無効な実行時間');
      }
      
      if (typeof cache.costIncurred !== 'number' || cache.costIncurred < 0) {
        issues.push('無効なコスト');
      }
      
      if (typeof cache.requestCount !== 'number' || cache.requestCount < 1) {
        issues.push('無効なリクエスト回数');
      }
      
    } catch (error) {
      issues.push(`キャッシュ読み込みエラー: ${(error as Error).message}`);
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * デバッグ用: キャッシュ内容を表示
   */
  async debugCache(): Promise<void> {
    try {
      const cache = await this.loadCache();
      console.log('=== キャッシュ内容 ===');
      console.log(JSON.stringify(cache, null, 2));
      
      const stats = await this.getStats();
      console.log('=== 統計情報 ===');
      console.log(JSON.stringify(stats, null, 2));
      
      const validation = await this.validateCache();
      console.log('=== 妥当性検証 ===');
      console.log(JSON.stringify(validation, null, 2));
      
    } catch (error) {
      console.error('デバッグ表示エラー:', error);
    }
  }
}