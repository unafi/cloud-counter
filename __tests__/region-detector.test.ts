/**
 * RegionDetector クラスのテスト
 * Vitestによる基本的な単体テスト
 */

import { describe, it, expect, vi } from 'vitest'
import { RegionDetector } from '../lib/region-detector'

// モック設定
vi.mock('@aws-sdk/client-cost-explorer')

describe('RegionDetector', () => {
  const mockCredentials = {
    accessKeyId: 'test-access-key',
    secretAccessKey: 'test-secret-key'
  };

  describe('基本的な機能テスト', () => {
    it('RegionDetectorインスタンスが正常に作成される', () => {
      expect(() => {
        new RegionDetector(mockCredentials);
      }).not.toThrow();
    });

    test('検出結果の妥当性検証が正常に動作する', () => {
      const validResult = {
        activeRegions: ['us-east-1', 'ap-northeast-1'],
        invalidRegions: [],
        totalFound: 2,
        executionTime: 1500,
        costIncurred: 0.01
      };

      const validation = RegionDetector.validateDetectionResult(validResult);
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    test('無効な検出結果を正しく検出する', () => {
      const invalidResult = {
        activeRegions: [],
        invalidRegions: [],
        totalFound: 0,
        executionTime: -1,
        costIncurred: -0.01
      };

      const validation = RegionDetector.validateDetectionResult(invalidResult);
      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });

    test('統計情報の計算が正常に動作する', () => {
      const results = [
        {
          activeRegions: ['us-east-1', 'us-west-2'],
          invalidRegions: [],
          totalFound: 2,
          executionTime: 1000,
          costIncurred: 0.01
        },
        {
          activeRegions: ['us-east-1', 'ap-northeast-1'],
          invalidRegions: [],
          totalFound: 2,
          executionTime: 1500,
          costIncurred: 0.01
        }
      ];

      const stats = RegionDetector.getDetectionStats(results);
      
      expect(stats.totalExecutions).toBe(2);
      expect(stats.averageExecutionTime).toBe(1250);
      expect(stats.totalCost).toBe(0.02);
      expect(stats.uniqueRegionsFound).toContain('us-east-1');
      expect(stats.uniqueRegionsFound).toContain('us-west-2');
      expect(stats.uniqueRegionsFound).toContain('ap-northeast-1');
    });
  });

  describe('エラーケースのテスト', () => {
    test('空の結果配列で統計情報を計算', () => {
      const stats = RegionDetector.getDetectionStats([]);
      
      expect(stats.totalExecutions).toBe(0);
      expect(stats.averageExecutionTime).toBe(0);
      expect(stats.totalCost).toBe(0);
      expect(stats.uniqueRegionsFound).toHaveLength(0);
    });

    test('重複リージョンを含む結果の検証', () => {
      const resultWithDuplicates = {
        activeRegions: ['us-east-1', 'us-east-1'], // 重複
        invalidRegions: [],
        totalFound: 1, // 実際の総数と不一致
        executionTime: 1000,
        costIncurred: 0.01
      };

      const validation = RegionDetector.validateDetectionResult(resultWithDuplicates);
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('検出総数と有効・無効リージョン数の合計が一致しません');
    });
  });
});

// プロパティベーステスト（Jest問題が解決されたら有効化）
/*
import fc from 'fast-check';

describe('RegionDetector Property Tests', () => {
  test.skip('Property 1: リージョン発見と設定更新の一貫性', () => {
    fc.assert(fc.property(
      fc.array(fc.constantFrom('us-east-1', 'us-west-2', 'ap-northeast-1'), { minLength: 1, maxLength: 5 }),
      async (discoveredRegions) => {
        // このテストはJest問題解決後に実装
        expect(true).toBe(true);
      }
    ));
  });

  test.skip('Property 8: データ検証とフィルタリング', () => {
    fc.assert(fc.property(
      fc.array(fc.string(), { maxLength: 10 }),
      (inputRegions) => {
        // 無効なリージョン名が自動的にフィルタリングされることを検証
        // このテストはJest問題解決後に実装
        expect(true).toBe(true);
      }
    ));
  });
});
*/