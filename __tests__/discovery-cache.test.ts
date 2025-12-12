/**
 * DiscoveryCache クラスのテスト
 */

import { DiscoveryCache } from '../lib/discovery-cache';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('DiscoveryCache', () => {
  let tempDir: string;
  let cache: DiscoveryCache;

  beforeEach(async () => {
    // テスト用の一時ディレクトリを作成
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'discovery-cache-test-'));
    cache = new DiscoveryCache(tempDir);
  });

  afterEach(async () => {
    // テスト後にクリーンアップ
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('テンポラリディレクトリの削除に失敗:', error);
    }
  });

  describe('基本的な機能テスト', () => {
    test('新しいキャッシュインスタンスが正常に作成される', () => {
      expect(cache).toBeInstanceOf(DiscoveryCache);
    });

    test('初期状態では今日の実行記録がない', async () => {
      const todayExecution = await cache.checkTodayExecution();
      expect(todayExecution).toBeNull();
    });

    test('実行結果を正常に保存できる', async () => {
      const regions = ['us-east-1', 'ap-northeast-1'];
      const executionTime = 1500;
      const cost = 0.01;

      await cache.saveExecution(regions, executionTime, cost);

      const todayExecution = await cache.checkTodayExecution();
      expect(todayExecution).not.toBeNull();
      expect(todayExecution!.discoveredRegions).toEqual(regions);
      expect(todayExecution!.executionTime).toBe(executionTime);
      expect(todayExecution!.costIncurred).toBe(cost);
      expect(todayExecution!.requestCount).toBe(2); // 保存後にcheckを呼んだので2
    });

    test('同日内の重複チェックが正常に動作する', async () => {
      // 最初の実行を保存
      await cache.saveExecution(['us-east-1'], 1000, 0.01);

      // 同日内の2回目のチェック
      const firstCheck = await cache.checkTodayExecution();
      expect(firstCheck!.requestCount).toBe(2);

      // 同日内の3回目のチェック
      const secondCheck = await cache.checkTodayExecution();
      expect(secondCheck!.requestCount).toBe(3);
    });

    test('統計情報を正常に取得できる', async () => {
      await cache.saveExecution(['us-east-1', 'us-west-2'], 2000, 0.01);

      const stats = await cache.getStats();
      expect(stats.totalExecutions).toBe(1);
      expect(stats.totalCost).toBe(0.01);
      expect(stats.averageExecutionTime).toBe(2000);
      expect(stats.preventedDuplicates).toBe(0);

      // 重複リクエストを発生させる
      await cache.checkTodayExecution();
      await cache.checkTodayExecution();

      const updatedStats = await cache.getStats();
      expect(updatedStats.preventedDuplicates).toBe(2);
    });
  });

  describe('キャッシュ管理機能', () => {
    test('キャッシュの存在確認が正常に動作する', async () => {
      expect(await cache.exists()).toBe(false);

      await cache.saveExecution(['us-east-1'], 1000, 0.01);
      expect(await cache.exists()).toBe(true);
    });

    test('キャッシュクリアが正常に動作する', async () => {
      await cache.saveExecution(['us-east-1'], 1000, 0.01);
      expect(await cache.exists()).toBe(true);

      await cache.clearCache();
      expect(await cache.exists()).toBe(false);
    });

    test('キャッシュの妥当性検証が正常に動作する', async () => {
      // 有効なキャッシュ
      await cache.saveExecution(['us-east-1'], 1000, 0.01);
      const validation = await cache.validateCache();
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });
  });

  describe('エラーケースのテスト', () => {
    test('存在しないキャッシュファイルの統計情報取得', async () => {
      const stats = await cache.getStats();
      expect(stats.totalExecutions).toBe(0);
      expect(stats.totalCost).toBe(0);
      expect(stats.preventedDuplicates).toBe(0);
    });

    test('存在しないキャッシュファイルのクリア', async () => {
      // エラーが発生しないことを確認
      await expect(cache.clearCache()).resolves.not.toThrow();
    });

    test('空のキャッシュファイルの妥当性検証', async () => {
      const validation = await cache.validateCache();
      expect(validation.isValid).toBe(true); // キャッシュなしは有効
    });
  });

  describe('日付処理のテスト', () => {
    test('今日の日付が正しく処理される', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      await cache.saveExecution(['us-east-1'], 1000, 0.01);
      const execution = await cache.checkTodayExecution();
      
      expect(execution!.lastDiscovery).toBe(today);
    });
  });
});

// プロパティベーステスト（Jest問題が解決されたら有効化）
/*
import fc from 'fast-check';

describe('DiscoveryCache Property Tests', () => {
  test.skip('Property 5: 重複実行防止とキャッシュ動作', () => {
    fc.assert(fc.property(
      fc.array(fc.constantFrom('us-east-1', 'us-west-2', 'ap-northeast-1'), { minLength: 1, maxLength: 5 }),
      fc.integer({ min: 100, max: 5000 }),
      fc.float({ min: 0.01, max: 0.01 }),
      async (regions, executionTime, cost) => {
        // 同日内の重複実行が防がれることを検証
        // このテストはJest問題解決後に実装
        expect(true).toBe(true);
      }
    ));
  });
});
*/