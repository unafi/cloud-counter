import { beforeAll, afterAll, afterEach } from 'vitest'
import '@testing-library/jest-dom'

// グローバルなテスト設定
beforeAll(() => {
  // テスト開始前の共通設定
  console.log('🧪 Vitest テストスイート開始')
})

afterAll(() => {
  // テスト終了後のクリーンアップ
  console.log('✅ Vitest テストスイート完了')
})

afterEach(() => {
  // 各テスト後のクリーンアップ
  // モックのリセットなど
})

// 環境変数の設定（テスト用）
process.env.NODE_ENV = 'test'

// AWS認証情報のモック（テスト用）
process.env.AWS_ACCESS_KEY_ID = 'test-access-key'
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key'
process.env.AWS_REGION = 'us-east-1'

// コンソールログの制御（必要に応じて）
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

console.error = (...args: any[]) => {
  // テスト中の期待されるエラーログを抑制
  if (args[0]?.includes?.('Warning:') || args[0]?.includes?.('Expected')) {
    return
  }
  originalConsoleError.apply(console, args)
}

console.warn = (...args: any[]) => {
  // テスト中の期待される警告ログを抑制
  if (args[0]?.includes?.('Warning:')) {
    return
  }
  originalConsoleWarn.apply(console, args)
}

// グローバルなモック設定
global.fetch = global.fetch || (() => Promise.resolve({
  json: () => Promise.resolve({}),
  ok: true,
  status: 200,
  statusText: 'OK'
} as Response))

// ファイルシステムモック（必要に応じて）
import { vi } from 'vitest'

// fs/promisesモックを削除（実際のファイルシステムを使用）

// Date.now()のモック（テストの一貫性のため）
const mockDate = new Date('2024-12-12T10:00:00.000Z')
vi.setSystemTime(mockDate)