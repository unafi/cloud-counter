# 既知の問題 (Known Issues)

## Jest/TypeScript インポート問題

### 問題の概要
- **影響範囲**: プロパティベーステスト全般
- **症状**: `ErrorHandler`クラスが`undefined`でインポートされる
- **発生日**: 2024-12-12
- **ステータス**: 未解決

### 詳細
```typescript
import { ErrorHandler } from '@/lib/error-handler';
// または
import { ErrorHandler } from '../lib/error-handler';

console.log(ErrorHandler); // → undefined
```

### 試行した解決策
1. ✅ Jest設定ファイル修復 (`moduleNameMapping` → `moduleNameMapper`)
2. ✅ ts-jestインストールと設定
3. ✅ Jest設定をNext.jsからシンプル設定に変更
4. ✅ 相対パス・絶対パス・require方式でのインポート試行
5. ❌ TypeScriptコンパイル確認 → 空のJSファイル生成される問題発見

### 根本原因の推測
- Jest/TypeScript統合の設定問題
- Next.jsとJestの設定競合
- TypeScriptコンパイラの設定問題

### 回避策
- プロパティベーステストを一時的にスキップ
- 単体テストは正常に動作する可能性あり

### 今後の対応
- Jest設定の完全再構築
- TypeScript設定の見直し
- または、テスト戦略の変更（プロパティテスト → 単体テスト中心）

### 影響を受けるファイル
- `cloud-counter/__tests__/error-handler.test.ts` - ErrorHandlerクラスのプロパティテスト
- `cloud-counter/__tests__/integration.test.ts` - ErrorHandler関連の統合テスト（一部スキップ）

### 回避策として実装済み
- `cloud-counter/__tests__/config-manager.test.ts` - 正常動作
- `cloud-counter/__tests__/multi-region-client.test.ts` - 正常動作  
- `cloud-counter/__tests__/region-detector.test.ts` - 正常動作
- `cloud-counter/__tests__/discovery-cache.test.ts` - 正常動作
- `cloud-counter/__tests__/api-usage-limits.test.ts` - 正常動作
- `cloud-counter/__tests__/end-to-end.test.ts` - 正常動作

### 優先度
- **中**: 機能実装には影響しないが、品質保証に影響

---

## その他の問題

現在、他の既知の問題はありません。