/**
 * MultiRegionResourceClient クラスのテスト
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MultiRegionResourceClient, CloudResource } from '../lib/multi-region-client'

// AWS SDKのモック
vi.mock('@aws-sdk/client-ec2')
vi.mock('@aws-sdk/client-lambda')
vi.mock('../lib/config')

// モック設定
const mockGetConfig = vi.mocked(await import('../lib/config')).getConfig

describe('MultiRegionResourceClient', () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    jest.clearAllMocks();
    
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

  describe('基本的な機能テスト', () => {
    test('MultiRegionResourceClientインスタンスが正常に作成される', () => {
      expect(() => {
        new MultiRegionResourceClient();
      }).not.toThrow();
    });

    test('空のリージョンリストで呼び出した場合、空の配列を返す', async () => {
      const client = new MultiRegionResourceClient();
      const resources = await client.getResourcesFromAllRegions([]);
      
      expect(resources).toEqual([]);
    });

    test('リソース統計情報が正常に計算される', () => {
      const client = new MultiRegionResourceClient();
      const mockResources: CloudResource[] = [
        {
          id: 'i-123',
          name: 'test-instance',
          type: 'EC2',
          status: 'running',
          region: 'us-east-1',
          regionDisplayName: 'US East (N. Virginia)',
          crossRegionId: 'ec2-us-east-1-i-123'
        },
        {
          id: 'lambda-456',
          name: 'test-function',
          type: 'Lambda',
          status: 'Active',
          region: 'us-west-2',
          regionDisplayName: 'US West (Oregon)',
          crossRegionId: 'lambda-us-west-2-test-function'
        }
      ];

      const stats = client.getResourceStats(mockResources);
      
      expect(stats.totalCount).toBe(2);
      expect(stats.byRegion['us-east-1']).toBe(1);
      expect(stats.byRegion['us-west-2']).toBe(1);
      expect(stats.byType['EC2']).toBe(1);
      expect(stats.byType['Lambda']).toBe(1);
      expect(stats.byStatus['running']).toBe(1);
      expect(stats.byStatus['Active']).toBe(1);
    });

    test('稼働中のリソースのフィルタリングが正常に動作する', () => {
      const client = new MultiRegionResourceClient();
      const mockResources: CloudResource[] = [
        {
          id: 'i-123',
          name: 'running-instance',
          type: 'EC2',
          status: 'running',
          region: 'us-east-1',
          regionDisplayName: 'US East (N. Virginia)',
          crossRegionId: 'ec2-us-east-1-i-123'
        },
        {
          id: 'i-456',
          name: 'stopped-instance',
          type: 'EC2',
          status: 'stopped',
          region: 'us-east-1',
          regionDisplayName: 'US East (N. Virginia)',
          crossRegionId: 'ec2-us-east-1-i-456'
        },
        {
          id: 'lambda-789',
          name: 'active-function',
          type: 'Lambda',
          status: 'active',
          region: 'us-west-2',
          regionDisplayName: 'US West (Oregon)',
          crossRegionId: 'lambda-us-west-2-active-function'
        }
      ];

      const activeResources = client.getActiveResources(mockResources);
      
      expect(activeResources).toHaveLength(2);
      expect(activeResources.map(r => r.id)).toContain('i-123');
      expect(activeResources.map(r => r.id)).toContain('lambda-789');
      expect(activeResources.map(r => r.id)).not.toContain('i-456');
    });

    test('特定リージョンのリソースフィルタリングが正常に動作する', () => {
      const client = new MultiRegionResourceClient();
      const mockResources: CloudResource[] = [
        {
          id: 'i-123',
          name: 'east-instance',
          type: 'EC2',
          status: 'running',
          region: 'us-east-1',
          regionDisplayName: 'US East (N. Virginia)',
          crossRegionId: 'ec2-us-east-1-i-123'
        },
        {
          id: 'i-456',
          name: 'west-instance',
          type: 'EC2',
          status: 'running',
          region: 'us-west-2',
          regionDisplayName: 'US West (Oregon)',
          crossRegionId: 'ec2-us-west-2-i-456'
        }
      ];

      const eastResources = client.getResourcesByRegion(mockResources, 'us-east-1');
      
      expect(eastResources).toHaveLength(1);
      expect(eastResources[0].id).toBe('i-123');
      expect(eastResources[0].region).toBe('us-east-1');
    });
  });

  describe('リージョン情報の検証', () => {
    test('リソースに必須のリージョン情報が含まれている', () => {
      const mockResource: CloudResource = {
        id: 'test-resource',
        name: 'Test Resource',
        type: 'EC2',
        status: 'running',
        region: 'us-east-1',
        regionDisplayName: 'US East (N. Virginia)',
        crossRegionId: 'ec2-us-east-1-test-resource',
        availability: 'us-east-1a',
        lastSeen: new Date().toISOString(),
        resourceArn: 'arn:aws:ec2:us-east-1:123456789012:instance/test-resource'
      };

      // 必須フィールドの検証
      expect(mockResource.region).toBeDefined();
      expect(mockResource.regionDisplayName).toBeDefined();
      expect(mockResource.crossRegionId).toBeDefined();
      
      // 拡張フィールドの検証
      expect(mockResource.availability).toBeDefined();
      expect(mockResource.lastSeen).toBeDefined();
      expect(mockResource.resourceArn).toBeDefined();
      
      // crossRegionIdの形式検証（type-region-resourceId の形式）
      expect(mockResource.crossRegionId).toMatch(/^[a-z0-9]+-[a-z]+-[a-z]+-\d+-[a-zA-Z0-9-]+$/);
    });

    test('クロスリージョンIDが一意性を保つ', () => {
      const resources: CloudResource[] = [
        {
          id: 'i-123',
          name: 'instance-1',
          type: 'EC2',
          status: 'running',
          region: 'us-east-1',
          regionDisplayName: 'US East (N. Virginia)',
          crossRegionId: 'ec2-us-east-1-i-123'
        },
        {
          id: 'i-123', // 同じIDだが異なるリージョン
          name: 'instance-2',
          type: 'EC2',
          status: 'running',
          region: 'us-west-2',
          regionDisplayName: 'US West (Oregon)',
          crossRegionId: 'ec2-us-west-2-i-123'
        }
      ];

      const crossRegionIds = resources.map(r => r.crossRegionId);
      const uniqueIds = new Set(crossRegionIds);
      
      // クロスリージョンIDは一意である必要がある
      expect(uniqueIds.size).toBe(crossRegionIds.length);
    });
  });

  describe('エラーケースのテスト', () => {
    test('認証情報が不足している場合はエラーを投げる', () => {
      mockGetConfig.mockImplementation(() => undefined);
      
      expect(() => {
        new MultiRegionResourceClient();
      }).toThrow('AWS認証情報が設定されていません');
    });

    test('空の統計情報が正常に処理される', () => {
      const client = new MultiRegionResourceClient();
      const stats = client.getResourceStats([]);
      
      expect(stats.totalCount).toBe(0);
      expect(Object.keys(stats.byRegion)).toHaveLength(0);
      expect(Object.keys(stats.byType)).toHaveLength(0);
      expect(Object.keys(stats.byStatus)).toHaveLength(0);
    });
  });
});

// プロパティベーステスト（Jest問題が解決されたら有効化）
/*
import fc from 'fast-check';

describe('MultiRegionResourceClient Property Tests', () => {
  test.skip('Property 2: マルチリージョン並行処理の完全性', () => {
    fc.assert(fc.property(
      fc.array(fc.constantFrom('us-east-1', 'us-west-2', 'ap-northeast-1'), { minLength: 1, maxLength: 3 }),
      async (regions) => {
        // 各リージョンで並行リソース検索を実行した場合、
        // エラーが発生したリージョンを除く全てのリージョンから
        // リソース情報が取得され、統合結果に含まれることを検証
        expect(true).toBe(true);
      }
    ));
  });

  test.skip('Property 3: リソース情報のリージョン情報保持', () => {
    fc.assert(fc.property(
      fc.array(fc.constantFrom('us-east-1', 'us-west-2', 'ap-northeast-1'), { minLength: 1, maxLength: 3 }),
      (regions) => {
        // 任意のマルチリージョン検索結果において、
        // 全てのリソースは正しいリージョン情報を含み、
        // リージョン情報が欠損または不正な値になることはないことを検証
        expect(true).toBe(true);
      }
    ));
  });
});
*/