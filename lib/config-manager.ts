import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { getConfig } from './config';

/**
 * AWS リージョン設定の管理クラス
 * マルチリージョン対応のための設定読み書き機能を提供
 */
export class ConfigManager {
    private static readonly ENV_FILE_PATH = path.join(process.cwd(), '.env.local');
    private static readonly AWS_REGION_KEY = 'AWS_REGION';
    
    // テスト用のファイルパスオーバーライド
    private static testEnvPath: string | null = null;
    
    /**
     * テスト用のファイルパスを設定（テスト専用）
     */
    static setTestEnvPath(testPath: string | null): void {
        this.testEnvPath = testPath;
    }
    
    /**
     * 現在使用するファイルパスを取得
     */
    private static getEnvFilePath(): string {
        return this.testEnvPath || this.ENV_FILE_PATH;
    }

    /**
     * AWS_REGION環境変数からリージョンリストを解析
     * @param regionString カンマ区切りのリージョン文字列
     * @returns リージョンの配列
     */
    static parseRegions(regionString: string): string[] {
        if (!regionString || regionString.trim() === '') {
            return [];
        }
        
        const regions = regionString
            .split(',')
            .map(region => region.trim())
            .filter(region => region.length > 0)
            .filter(region => this.isValidAWSRegion(region));
        
        // 重複を除去
        return [...new Set(regions)];
    }

    /**
     * リージョン配列をカンマ区切り文字列にフォーマット
     * @param regions リージョンの配列
     * @returns カンマ区切りの文字列
     */
    static formatRegions(regions: string[]): string {
        const validRegions = regions.filter(region => this.isValidAWSRegion(region));
        // 重複を除去
        const uniqueRegions = [...new Set(validRegions)];
        return uniqueRegions.join(',');
    }

    /**
     * 現在のAWS_REGION設定を取得
     * @returns リージョンの配列
     */
    static getRegionConfig(): string[] {
        let regionString: string | undefined;
        
        if (this.testEnvPath) {
            // テスト時は直接ファイルから読み込み
            regionString = this.getConfigFromFile(this.AWS_REGION_KEY);
        } else {
            // 通常時は既存のgetConfig関数を使用
            regionString = getConfig(this.AWS_REGION_KEY);
        }
        
        if (!regionString) {
            return [];
        }
        return this.parseRegions(regionString);
    }
    
    /**
     * ファイルから直接設定を読み込み（テスト用）
     */
    private static getConfigFromFile(key: string): string | undefined {
        try {
            const envFilePath = this.getEnvFilePath();
            const fs = require('fs');
            
            if (!fs.existsSync(envFilePath)) {
                return undefined;
            }
            
            const fileContent = fs.readFileSync(envFilePath, 'utf-8');
            const dotenv = require('dotenv');
            const envConfig = dotenv.parse(fileContent);
            
            return envConfig[key];
        } catch (error) {
            return undefined;
        }
    }

    /**
     * AWS_REGION設定を新しいリージョンリストで更新
     * @param newRegions 新しいリージョンの配列
     * @returns 更新が成功したかどうか
     */
    static async updateRegionConfig(newRegions: string[]): Promise<boolean> {
        try {
            // 有効なリージョンのみをフィルタリング
            const validRegions = newRegions.filter(region => this.isValidAWSRegion(region));
            
            if (validRegions.length === 0) {
                throw new Error('有効なAWSリージョンが指定されていません');
            }

            const envFilePath = this.getEnvFilePath();

            // 現在の.env.localファイルを読み込み
            let fileContent = '';
            try {
                fileContent = await fs.readFile(envFilePath, 'utf-8');
            } catch (error) {
                // ファイルが存在しない場合は新規作成
                console.log('.env.localファイルが存在しないため、新規作成します');
            }

            // 行ごとに分割
            const lines = fileContent.split('\n');
            
            // AWS_REGION行を探す
            const regionLineIndex = lines.findIndex(line => 
                line.trim().startsWith(`${this.AWS_REGION_KEY}=`)
            );

            const newRegionLine = `${this.AWS_REGION_KEY}=${this.formatRegions(validRegions)}`;

            if (regionLineIndex >= 0) {
                // 既存の行を更新
                lines[regionLineIndex] = newRegionLine;
            } else {
                // 新しい行を追加
                lines.push(newRegionLine);
            }

            // ファイルに書き戻し
            await fs.writeFile(envFilePath, lines.join('\n'), 'utf-8');
            
            console.log(`AWS_REGION設定を更新しました: ${this.formatRegions(validRegions)}`);
            return true;

        } catch (error) {
            console.error('AWS_REGION設定の更新に失敗しました:', error);
            return false;
        }
    }

    /**
     * 設定更新前後の比較情報を取得
     * @param newRegions 新しいリージョンリスト
     * @returns 比較結果
     */
    static getConfigComparison(newRegions: string[]): {
        previous: string[];
        new: string[];
        added: string[];
        removed: string[];
        unchanged: string[];
    } {
        const previousRegions = this.getRegionConfig();
        const validNewRegions = newRegions.filter(region => this.isValidAWSRegion(region));

        const added = validNewRegions.filter(region => !previousRegions.includes(region));
        const removed = previousRegions.filter(region => !validNewRegions.includes(region));
        const unchanged = previousRegions.filter(region => validNewRegions.includes(region));

        return {
            previous: previousRegions,
            new: validNewRegions,
            added,
            removed,
            unchanged
        };
    }

    /**
     * AWSリージョン名の妥当性をチェック
     * @param region リージョン名
     * @returns 有効なリージョンかどうか
     */
    private static isValidAWSRegion(region: string): boolean {
        // AWS リージョンの基本的なパターンをチェック
        // 例: us-east-1, ap-northeast-1, eu-west-1 など
        const regionPattern = /^[a-z]{2,3}-[a-z]+-\d+$/;
        
        // 既知の有効なAWSリージョンリスト（主要なもの）
        const validRegions = [
            // US リージョン
            'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
            // EU リージョン
            'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-north-1', 'eu-south-1',
            // アジア太平洋リージョン
            'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3',
            'ap-southeast-1', 'ap-southeast-2', 'ap-south-1', 'ap-east-1',
            // その他のリージョン
            'ca-central-1', 'sa-east-1', 'af-south-1', 'me-south-1',
            // 中国リージョン
            'cn-north-1', 'cn-northwest-1',
            // GovCloud
            'us-gov-east-1', 'us-gov-west-1'
        ];

        return regionPattern.test(region) && validRegions.includes(region);
    }

    /**
     * 設定ファイルのバックアップを作成
     * @returns バックアップファイルのパス
     */
    static async createBackup(): Promise<string | null> {
        try {
            const envFilePath = this.getEnvFilePath();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(process.cwd(), `.env.local.backup.${timestamp}`);
            
            await fs.copyFile(envFilePath, backupPath);
            console.log(`設定ファイルのバックアップを作成しました: ${backupPath}`);
            
            return backupPath;
        } catch (error) {
            console.error('バックアップの作成に失敗しました:', error);
            return null;
        }
    }

    /**
     * 設定ファイルの書き込み権限をチェック
     * @returns 書き込み可能かどうか
     */
    static async checkWritePermission(): Promise<boolean> {
        try {
            const envFilePath = this.getEnvFilePath();
            await fs.access(envFilePath, fs.constants.W_OK);
            return true;
        } catch (error) {
            console.error('設定ファイルへの書き込み権限がありません:', error);
            return false;
        }
    }
}