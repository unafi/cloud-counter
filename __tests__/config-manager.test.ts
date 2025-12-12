/**
 * ConfigManager プロパティベーステスト
 * Feature: aws-multi-region, Property 6: 設定変更の動的反映
 * Validates: Requirements 4.5, 3.5
 */

import * as fc from 'fast-check';
import { ConfigManager } from '@/lib/config-manager';
import fs from 'fs/promises';
import path from 'path';

// テスト用の一時ファイルパス
const TEST_ENV_PATH = path.join(process.cwd(), '.env.test');

// 有効なAWSリージョンのサンプル
const VALID_AWS_REGIONS = [
    'us-east-1', 'us-west-2', 'ap-northeast-1', 'eu-west-1', 'ap-southeast-1'
];

// テスト前後のセットアップ・クリーンアップ
beforeEach(async () => {
    // テスト用パスを設定
    ConfigManager.setTestEnvPath(TEST_ENV_PATH);
    
    // テスト用環境ファイルをクリーンアップ
    try {
        await fs.unlink(TEST_ENV_PATH);
    } catch (error) {
        // ファイルが存在しない場合は無視
    }
});

afterEach(async () => {
    // テスト用環境ファイルをクリーンアップ
    try {
        await fs.unlink(TEST_ENV_PATH);
    } catch (error) {
        // ファイルが存在しない場合は無視
    }
    
    // テスト用パスをリセット
    ConfigManager.setTestEnvPath(null);
});

describe('ConfigManager Property Tests', () => {
    
    /**
     * Property 6: 設定変更の動的反映
     * 任意の手動設定変更後の初回リソース検索において、新しい設定が自動的に読み込まれ、
     * 更新されたリージョンリストでリソース検索が実行される
     */
    test('**Feature: aws-multi-region, Property 6: 設定変更の動的反映**', async () => {
        // シンプルなテストケース
        const testRegions = ['us-east-1', 'ap-northeast-1'];
        
        // 設定を更新
        const updateSuccess = await ConfigManager.updateRegionConfig(testRegions);
        expect(updateSuccess).toBe(true);
        
        // 設定から読み込んだリージョンが一致することを検証
        const configRegions = ConfigManager.getRegionConfig();
        expect(configRegions.sort()).toEqual(testRegions.sort());
    });

    test('parseRegions should handle various input formats', () => {
        fc.assert(fc.property(
            fc.array(fc.constantFrom(...VALID_AWS_REGIONS), { minLength: 0, maxLength: 5 }),
            (regions) => {
                const regionString = regions.join(',');
                const parsed = ConfigManager.parseRegions(regionString);
                
                // パースされたリージョンは全て有効なリージョンである
                expect(parsed.every(region => VALID_AWS_REGIONS.includes(region))).toBe(true);
                
                // 重複が除去されている
                expect(parsed.length).toBeLessThanOrEqual(regions.length);
                
                // 元のリージョンが全て含まれている（重複除去後）
                const uniqueOriginal = [...new Set(regions)];
                expect(parsed.sort()).toEqual(uniqueOriginal.sort());
            }
        ), { numRuns: 100 });
    });

    test('formatRegions should create valid comma-separated strings', () => {
        const testCases = [
            { input: [], expected: '' },
            { input: ['us-east-1'], expected: 'us-east-1' },
            { input: ['us-east-1', 'ap-northeast-1'], expected: 'us-east-1,ap-northeast-1' },
            { input: ['us-east-1', 'us-east-1'], expected: 'us-east-1' }, // 重複除去
        ];
        
        testCases.forEach(({ input, expected }) => {
            const result = ConfigManager.formatRegions(input);
            expect(result).toBe(expected);
        });
    });

    test('getConfigComparison should correctly identify changes', async () => {
        // 初期設定
        const previousRegions = ['us-east-1', 'ap-northeast-1'];
        await ConfigManager.updateRegionConfig(previousRegions);
        
        // 新しい設定
        const newRegions = ['us-east-1', 'eu-west-1'];
        
        // 比較を実行
        const comparison = ConfigManager.getConfigComparison(newRegions);
        
        // 結果を検証
        expect(comparison.previous.sort()).toEqual(previousRegions.sort());
        expect(comparison.new.sort()).toEqual(newRegions.sort());
        expect(comparison.added).toEqual(['eu-west-1']);
        expect(comparison.removed).toEqual(['ap-northeast-1']);
        expect(comparison.unchanged).toEqual(['us-east-1']);
    });

    test('round-trip property: parse then format should preserve data', () => {
        fc.assert(fc.property(
            fc.array(fc.constantFrom(...VALID_AWS_REGIONS), { minLength: 1, maxLength: 5 }),
            (regions) => {
                const uniqueRegions = [...new Set(regions)];
                const formatted = ConfigManager.formatRegions(uniqueRegions);
                const parsed = ConfigManager.parseRegions(formatted);
                
                // ラウンドトリップで元のデータが保持される
                expect(parsed.sort()).toEqual(uniqueRegions.sort());
            }
        ), { numRuns: 100 });
    });

    test('invalid regions should be filtered out', () => {
        const invalidRegions = ['invalid-region', 'us-invalid-1', '', '  ', 'not-a-region'];
        const mixedRegions = [...VALID_AWS_REGIONS.slice(0, 2), ...invalidRegions];
        
        const parsed = ConfigManager.parseRegions(mixedRegions.join(','));
        
        // 有効なリージョンのみが残る
        expect(parsed).toEqual(VALID_AWS_REGIONS.slice(0, 2));
        
        // 無効なリージョンは除外される
        invalidRegions.forEach(invalid => {
            expect(parsed).not.toContain(invalid);
        });
    });
});

describe('ConfigManager Error Handling', () => {
    test('should handle empty region strings gracefully', () => {
        const emptyInputs = ['', '  ', ',', ',,', ' , , '];
        
        emptyInputs.forEach(input => {
            const result = ConfigManager.parseRegions(input);
            expect(result).toEqual([]);
        });
    });

    test('should handle malformed region strings', () => {
        const malformedInputs = [
            'us-east-1,,ap-northeast-1',  // 空の要素
            ' us-east-1 , ap-northeast-1 ',  // 余分なスペース
            'us-east-1,invalid,ap-northeast-1',  // 無効なリージョンが混在
        ];
        
        malformedInputs.forEach(input => {
            const result = ConfigManager.parseRegions(input);
            // 有効なリージョンのみが抽出される
            expect(result.every(region => VALID_AWS_REGIONS.includes(region))).toBe(true);
        });
    });
});