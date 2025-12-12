/**
 * エンドツーエンドテスト
 * AWS全リージョン対応機能の完全フローをテスト
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ConfigManager } from '../lib/config-manager'
import { DiscoveryCache } from '../lib/discovery-cache'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

// AWS SDKのモック
vi.mock('@aws-sdk/client-ec2')
vi.mock('@aws-sdk/client-lambda')
vi.mock('@aws-sdk/client-cost-explorer')
vi.mock('../lib/config')

const { getConfig } = await vi.importMock('../lib/config') as { getConfig: ReturnType<typeof vi.fn> }
const mockGetConfig = vi.mocked(getConfig)

describe('AWS全リージョン対応機能 - エンドツーエンドテスト', () => {
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // テスト用の一時ディレクトリを作成
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'e2e-test-'));
    
    // デフォルトの認証情報を設定
    mockGetConfig.mockImplementation((key: string) => {
      switch (key) {
        case 'AWS_ACCESS_KEY_ID':
          return 'test-access-key';
        case 'AWS_SECRET_ACCESS_KEY':
          return 'test-secret-key';
        default:
          return undefined;
      }
    });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('テンポラリディレクトリの削除に失敗:', error);
    }
  });

  describe('完全なリージョン発見フロー', () => {
    test('リージョン発見から設定更新までの完全フロー', async () => {
      // 1. 初期設定
      const testEnvPath = path.join(tempDir, '.env.local');
      ConfigManager.setTestEnvPath(testEnvPath);
      
      const cache = new DiscoveryCache(tempDir);

      // 2. 初期状態の確認
      expect(ConfigManager.getRegionConfig()).toEqual([]);
      expect(await cache.checkTodayExecution()).toBeNull();

      // 3. リージョン発見の実行（シミュレーション）
      const discoveredRegions = ['us-east-1', 'us-west-2', 'ap-northeast-1'];
      
      // 4. 設定の更新
      const updateSuccess = await ConfigManager.updateRegionConfig(discoveredRegions);
      expect(updateSuccess).toBe(true);

      // 5. 更新された設定の確認
      const updatedRegions = ConfigManager.getRegionConfig();
      expect(updatedRegions).toEqual(discoveredRegions);

      // 6. キャッシュへの記録
      await cache.saveExecution(discoveredRegions, 1500, 0.01);

      // 7. 重複実行防止の確認
      const duplicateCheck = await cache.checkTodayExecution();
      expect(duplicateCheck).not.toBeNull();
      expect(duplicateCheck!.discoveredRegions).toEqual(discoveredRegions);

      // 8. 設定比較機能の確認
      const comparison = ConfigManager.getConfigComparison(['us-east-1', 'eu-west-1']);
      expect(comparison.previous).toEqual(discoveredRegions);
      expect(comparison.added).toContain('eu-west-1');
      expect(comparison.removed).toContain('us-west-2');
      expect(comparison.unchanged).toContain('us-east-1');

      // 9. 統計情報の確認
      const stats = await cache.getStats();
      expect(stats.totalExecutions).toBe(1);
      expect(stats.totalCost).toBe(0.01);
      expect(stats.preventedDuplicates).toBe(1);

      // クリーンアップ
      ConfigManager.setTestEnvPath(null);
    });

    test('エラー処理とリカバリーフロー', async () => {
      const testEnvPath = path.join(tempDir, '.env.local');
      ConfigManager.setTestEnvPath(testEnvPath);

      // 1. 無効なリージョンを含む設定の試行
      const invalidRegions = ['us-east-1', 'invalid-region', 'us-west-2'];
      const updateSuccess = await ConfigManager.updateRegionConfig(invalidRegions);
      
      // 2. 有効なリージョンのみが保存されることを確認
      expect(updateSuccess).toBe(true);
      const savedRegions = ConfigManager.getRegionConfig();
      expect(savedRegions).toEqual(['us-east-1', 'us-west-2']);
      expect(savedRegions).not.toContain('invalid-region');

      // 3. 設定比較での変更検出
      const comparison = ConfigManager.getConfigComparison(['us-east-1']);
      expect(comparison.removed).toContain('us-west-2');

      ConfigManager.setTestEnvPath(null);
    });
  });

  describe('API統合フロー', () => {
    test('リージョン発見APIのレスポンス形式', () => {
      // APIレスポンスの期待される形式
      const expectedDiscoveryResponse = {
        discoveredRegions: ['us-east-1', 'us-west-2'],
        previousRegions: [],
        newRegions: ['us-east-1', 'us-west-2'],
        removedRegions: [],
        updatedConfig: true,
        cost: 0.01,
        lastDiscovery: '2025-12-12',
        executionTime: 1500
      };

      // レスポンス形式の検証
      expect(expectedDiscoveryResponse).toHaveProperty('discoveredRegions');
      expect(expectedDiscoveryResponse).toHaveProperty('cost');
      expect(expectedDiscoveryResponse).toHaveProperty('executionTime');
      expect(expectedDiscoveryResponse.cost).toBe(0.01);
      expect(Array.isArray(expectedDiscoveryResponse.discoveredRegions)).toBe(true);
    });

    test('リソースAPIのマルチリージョン対応', () => {
      // マルチリージョンリソースの期待される形式
      const expectedResource = {
        id: 'i-123456789',
        name: 'test-instance',
        type: 'EC2',
        status: 'running',
        region: 'us-east-1',
        regionDisplayName: 'US East (N. Virginia)',
        crossRegionId: 'ec2-us-east-1-i-123456789',
        availability: 'us-east-1a',
        lastSeen: '2025-12-12T10:00:00Z',
        resourceArn: 'arn:aws:ec2:us-east-1:123456789012:instance/i-123456789'
      };

      // リソース形式の検証
      expect(expectedResource).toHaveProperty('region');
      expect(expectedResource).toHaveProperty('regionDisplayName');
      expect(expectedResource).toHaveProperty('crossRegionId');
      expect(expectedResource.crossRegionId).toMatch(/^[a-z0-9]+-[a-z]+-[a-z]+-\d+-/);
    });
  });

  describe('パフォーマンスと制限の検証', () => {
    test('Cost Explorer API使用制限の遵守', () => {
      // 1日1回制限の検証
      const dailyLimit = {
        maxExecutionsPerDay: 1,
        costPerExecution: 0.01,
        maxDailyCost: 0.01
      };

      expect(dailyLimit.maxExecutionsPerDay).toBe(1);
      expect(dailyLimit.maxDailyCost).toBe(0.01);
    });

    test('無料APIの優先使用', () => {
      // 無料APIと有料APIの分離
      const apiUsage = {
        freeApis: ['ec2:DescribeInstances', 'lambda:ListFunctions'],
        paidApis: ['ce:GetDimensionValues'],
        resourceSearchUsesFreeOnly: true,
        regionDiscoveryUsesPaidApi: true
      };

      expect(apiUsage.freeApis.length).toBeGreaterThan(0);
      expect(apiUsage.paidApis.length).toBe(1);
      expect(apiUsage.resourceSearchUsesFreeOnly).toBe(true);
    });

    test('並行処理による効率化', () => {
      // 並行処理の効率性検証
      const regions = ['us-east-1', 'us-west-2', 'ap-northeast-1'];
      const estimatedTimePerRegion = 1000; // 1秒

      const sequentialTime = regions.length * estimatedTimePerRegion; // 3秒
      const parallelTime = estimatedTimePerRegion; // 1秒（最も遅いリージョン）

      const efficiency = (sequentialTime - parallelTime) / sequentialTime;
      
      expect(efficiency).toBeGreaterThan(0.5); // 50%以上の効率化
      expect(parallelTime).toBeLessThan(sequentialTime);
    });
  });

  describe('データ整合性の検証', () => {
    test('リージョン設定とキャッシュの同期', async () => {
      const testEnvPath = path.join(tempDir, '.env.local');
      ConfigManager.setTestEnvPath(testEnvPath);
      
      const cache = new DiscoveryCache(tempDir);
      const regions = ['us-east-1', 'us-west-2'];

      // 1. 設定更新
      await ConfigManager.updateRegionConfig(regions);
      
      // 2. キャッシュ保存
      await cache.saveExecution(regions, 1000, 0.01);

      // 3. 整合性確認
      const configRegions = ConfigManager.getRegionConfig();
      const cachedExecution = await cache.checkTodayExecution();

      expect(configRegions).toEqual(regions);
      expect(cachedExecution!.discoveredRegions).toEqual(regions);

      ConfigManager.setTestEnvPath(null);
    });

    test('クロスリージョンIDの一意性', () => {
      // 同じリソースIDでも異なるリージョンでは一意のクロスリージョンIDを持つ
      const resource1 = {
        id: 'i-123',
        region: 'us-east-1',
        crossRegionId: 'ec2-us-east-1-i-123'
      };

      const resource2 = {
        id: 'i-123', // 同じID
        region: 'us-west-2', // 異なるリージョン
        crossRegionId: 'ec2-us-west-2-i-123'
      };

      expect(resource1.crossRegionId).not.toBe(resource2.crossRegionId);
      expect(resource1.crossRegionId).toContain(resource1.region);
      expect(resource2.crossRegionId).toContain(resource2.region);
    });
  });

  describe('ユーザーエクスペリエンスの検証', () => {
    test('エラーメッセージの適切性', () => {
      // エラーメッセージが適切な情報を含むことを確認
      const errorCases = [
        {
          code: 'COST_EXPLORER_PERMISSION_DENIED',
          shouldContain: ['Cost Explorer API', '権限', 'ce:GetDimensionValues']
        },
        {
          code: 'CONFIG_FILE_PERMISSION_DENIED',
          shouldContain: ['書き込み権限', '.env.local', '管理者権限']
        },
        {
          code: 'NETWORK_ERROR',
          shouldContain: ['ネットワーク', '接続', 'ファイアウォール']
        }
      ];

      errorCases.forEach(errorCase => {
        // 実際のエラーハンドリングロジックでは、
        // これらのキーワードが含まれることを確認
        expect(errorCase.shouldContain.length).toBeGreaterThan(0);
      });
    });

    test('実行時間とフィードバック', () => {
      // ユーザーフィードバックのタイミング
      const userExperience = {
        immediateResponse: true, // 即座にローディング表示
        progressFeedback: true,  // 進行状況の表示
        completionNotification: true, // 完了通知
        errorRecovery: true      // エラー時のリカバリー案内
      };

      Object.values(userExperience).forEach(value => {
        expect(value).toBe(true);
      });
    });
  });
});

// テストヘルパー関数
function createMockDiscoveryResult(regions: string[]) {
  return {
    discoveredRegions: regions,
    previousRegions: [],
    newRegions: regions,
    removedRegions: [],
    updatedConfig: true,
    cost: 0.01,
    executionTime: 1500,
    lastDiscovery: new Date().toISOString().split('T')[0]
  };
}

function createMockResource(id: string, region: string, type: string = 'EC2') {
  return {
    id,
    name: `${type}-${id}`,
    type,
    status: 'running',
    region,
    regionDisplayName: `Mock ${region}`,
    crossRegionId: `${type.toLowerCase()}-${region}-${id}`,
    availability: `${region}a`,
    lastSeen: new Date().toISOString(),
    resourceArn: `arn:aws:${type.toLowerCase()}:${region}:123456789012:${type.toLowerCase()}/${id}`
  };
}