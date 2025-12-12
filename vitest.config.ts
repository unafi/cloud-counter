import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    // テスト環境の設定
    environment: 'happy-dom', // jsdomより高速
    
    // セットアップファイル
    setupFiles: ['./vitest.setup.ts'],
    
    // テストファイルのパターン
    include: [
      '**/__tests__/**/*.test.{ts,tsx}',
      '**/*.test.{ts,tsx}'
    ],
    
    // 除外パターン
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**'
    ],
    
    // グローバル設定（describe, it, expect等をimportなしで使用）
    globals: true,
    
    // カバレッジ設定
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '__tests__/',
        '*.config.*',
        'dist/',
        '.next/'
      ]
    },
    
    // タイムアウト設定
    testTimeout: 10000,
    hookTimeout: 10000,
    
    // 並列実行設定
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1
      }
    },
    
    // ウォッチモード設定
    watch: false, // CIでは無効
    
    // レポーター設定
    reporter: ['verbose', 'json', 'html'],
    
    // モック設定
    clearMocks: true,
    restoreMocks: true,
    
    // スナップショット設定
    resolveSnapshotPath: (testPath, snapExtension) => {
      return path.join(
        path.dirname(testPath),
        '__snapshots__',
        path.basename(testPath) + snapExtension
      )
    }
  },
  
  // パス解決設定
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '~': path.resolve(__dirname, './'),
    }
  },
  
  // esbuild設定（TypeScript処理）
  esbuild: {
    target: 'es2022' // top-level awaitをサポート
  }
})