import fs from 'fs/promises';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), 'data');
const CACHE_FILE = path.join(CACHE_DIR, 'cost-cache.json');

export type CloudProvider = 'aws' | 'azure' | 'google' | 'aws_resources' | 'azure_resources' | 'google_resources';

export async function getCache(provider: CloudProvider) {
    try {
        const data = await fs.readFile(CACHE_FILE, 'utf-8');
        const json = JSON.parse(data);
        return json[provider] || null;
    } catch (error) {
        // ファイルがない、またはJSONパースエラーの場合はnullを返す
        return null;
    }
}

export async function setCache(provider: CloudProvider, data: any) {
    try {
        // ディレクトリ確認
        try {
            await fs.access(CACHE_DIR);
        } catch {
            await fs.mkdir(CACHE_DIR, { recursive: true });
        }

        // 既存データ読み込み
        let currentCache: any = {};
        try {
            const fileContent = await fs.readFile(CACHE_FILE, 'utf-8');
            currentCache = JSON.parse(fileContent);
        } catch {
            // ファイルがない場合は新規オブジェクト
        }

        // 更新日時を付与
        const cacheEntry = {
            ...data,
            lastUpdated: new Date().toISOString(),
        };

        currentCache[provider] = cacheEntry;

        await fs.writeFile(CACHE_FILE, JSON.stringify(currentCache, null, 2), 'utf-8');
        return cacheEntry;
    } catch (error) {
        console.error("Cache write error:", error);
        throw error;
    }
}
