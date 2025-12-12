import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// メモリ上のキャッシュ (頻繁なファイルI/Oを防ぐため、ごく短時間だけ保持してもよいが、一旦毎回読み込む)
// Next.jsのHMR(Hot Module Replacement)と相性が悪い場合があるため、明示的に読み込む関数を用意する

export function getConfig(key: string): string | undefined {
    // 1. process.env (システム環境変数 or 起動時ロード変数を優先)
    // ただし、Next.jsの再起動なしでの変更反映を優先するため、
    // .env.local を優先的に読みに行くロジックにする

    try {
        const envPath = path.join(process.cwd(), '.env.local');
        if (fs.existsSync(envPath)) {
            const fileContent = fs.readFileSync(envPath, 'utf-8');
            const envConfig = dotenv.parse(fileContent); // parseは同期処理

            if (envConfig[key]) {
                return envConfig[key];
            }
        }
    } catch (e) {
        console.warn("Failed to load .env.local dynamically", e);
    }

    // 2. フォールバックとして process.env を見る
    return process.env[key];
}
