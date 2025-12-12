'use client';

import React, { useState } from 'react';
import { Search, AlertTriangle, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { ErrorFeedback } from './error-feedback';

/**
 * リージョン発見結果の型定義
 */
interface DiscoveryResult {
  discoveredRegions: string[];
  previousRegions: string[];
  newRegions: string[];
  removedRegions: string[];
  updatedConfig: boolean;
  cost: number;
  lastDiscovery?: string;
  executionTime?: number;
  error?: string;
}

/**
 * コンポーネントの状態型定義
 */
interface ComponentState {
  isDiscovering: boolean;
  showWarning: boolean;
  discoveryResult: DiscoveryResult | null;
  lastDiscoveryDate: string | null;
  error: string | null;
}

/**
 * 全リージョン発見ボタンコンポーネント
 * Cost Explorer APIを使用したリージョン発見機能のUI
 */
export function RegionDiscoveryButton() {
  const [state, setState] = useState<ComponentState>({
    isDiscovering: false,
    showWarning: false,
    discoveryResult: null,
    lastDiscoveryDate: null,
    error: null
  });

  /**
   * コンポーネント初期化時にステータスを取得
   */
  React.useEffect(() => {
    fetchDiscoveryStatus();
  }, []);

  /**
   * 現在のリージョン発見ステータスを取得
   */
  const fetchDiscoveryStatus = async () => {
    try {
      const response = await fetch('/api/aws/regions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' })
      });

      if (response.ok) {
        const data: DiscoveryResult = await response.json();
        setState(prev => ({
          ...prev,
          lastDiscoveryDate: data.lastDiscovery || null,
          error: null
        }));
      }
    } catch (error) {
      console.warn('ステータス取得エラー:', error);
    }
  };

  /**
   * 課金警告ダイアログを表示
   */
  const showCostWarning = () => {
    setState(prev => ({ ...prev, showWarning: true, error: null }));
  };

  /**
   * 課金警告ダイアログを閉じる
   */
  const hideCostWarning = () => {
    setState(prev => ({ ...prev, showWarning: false }));
  };

  /**
   * リージョン発見を実行
   */
  const executeDiscovery = async () => {
    setState(prev => ({
      ...prev,
      isDiscovering: true,
      showWarning: false,
      error: null,
      discoveryResult: null
    }));

    try {
      const response = await fetch('/api/aws/regions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'discover' })
      });

      const data: DiscoveryResult = await response.json();

      if (response.ok) {
        setState(prev => ({
          ...prev,
          isDiscovering: false,
          discoveryResult: data,
          lastDiscoveryDate: data.lastDiscovery || null,
          error: data.error || null
        }));
      } else {
        setState(prev => ({
          ...prev,
          isDiscovering: false,
          error: data.error || 'リージョン発見に失敗しました'
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isDiscovering: false,
        error: 'ネットワークエラーが発生しました'
      }));
    }
  };

  /**
   * 結果ダイアログを閉じる
   */
  const closeResult = () => {
    setState(prev => ({
      ...prev,
      discoveryResult: null,
      error: null
    }));
  };

  /**
   * 今日実行済みかどうかを判定
   */
  const isExecutedToday = () => {
    if (!state.lastDiscoveryDate) return false;
    const today = new Date().toISOString().split('T')[0];
    return state.lastDiscoveryDate === today;
  };

  return (
    <div className="space-y-4">
      {/* メインボタン */}
      <div className="flex items-center gap-3">
        <button
          onClick={showCostWarning}
          disabled={state.isDiscovering}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
            ${state.isDiscovering
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
            }
          `}
        >
          {state.isDiscovering ? (
            <>
              <Clock className="w-4 h-4 animate-spin" />
              リージョン発見中...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              全リージョン発見
            </>
          )}
        </button>

        {/* ステータス表示 */}
        {state.lastDiscoveryDate && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <CheckCircle className="w-4 h-4 text-green-500" />
            最終実行: {state.lastDiscoveryDate}
            {isExecutedToday() && (
              <span className="text-green-600 font-medium">(本日実行済み)</span>
            )}
          </div>
        )}
      </div>

      {/* 課金警告モーダル */}
      {state.showWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-orange-500" />
              <h3 className="text-lg font-semibold">課金確認</h3>
            </div>
            
            <div className="space-y-3 mb-6">
              <p className="text-gray-700">
                この操作はAWS Cost Explorer APIを使用します。
              </p>
              
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-orange-600" />
                  <span className="font-medium text-orange-800">課金情報</span>
                </div>
                <ul className="text-sm text-orange-700 space-y-1">
                  <li>• 実行1回あたり: $0.01 (約1.5円)</li>
                  <li>• 1日1回の制限により重複課金を防止</li>
                  <li>• 発見されたリージョンは自動的に設定に反映</li>
                </ul>
              </div>

              {isExecutedToday() && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-700">
                    本日既に実行済みです。重複実行は防止されますが、
                    設定確認のため再実行することができます。
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={hideCostWarning}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={executeDiscovery}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                実行する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 結果表示モーダル */}
      {(state.discoveryResult || state.error) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg mx-4">
            <div className="flex items-center gap-3 mb-4">
              {state.error ? (
                <>
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                  <h3 className="text-lg font-semibold text-red-800">エラー</h3>
                </>
              ) : (
                <>
                  <CheckCircle className="w-6 h-6 text-green-500" />
                  <h3 className="text-lg font-semibold text-green-800">発見完了</h3>
                </>
              )}
            </div>

            <div className="space-y-4 mb-6">
              {state.error ? (
                <ErrorFeedback 
                  error={state.error}
                  onRetry={() => {
                    setState(prev => ({ ...prev, error: null }));
                    executeDiscovery();
                  }}
                />
              ) : state.discoveryResult && (
                <>
                  {/* 発見結果サマリー */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <h4 className="font-medium text-blue-800 mb-2">発見結果</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-blue-600">発見リージョン:</span>
                        <span className="ml-1 font-medium">{state.discoveryResult.discoveredRegions.length}個</span>
                      </div>
                      <div>
                        <span className="text-blue-600">実行時間:</span>
                        <span className="ml-1 font-medium">{state.discoveryResult.executionTime}ms</span>
                      </div>
                      <div>
                        <span className="text-blue-600">コスト:</span>
                        <span className="ml-1 font-medium">${state.discoveryResult.cost}</span>
                      </div>
                      <div>
                        <span className="text-blue-600">設定更新:</span>
                        <span className={`ml-1 font-medium ${state.discoveryResult.updatedConfig ? 'text-green-600' : 'text-gray-600'}`}>
                          {state.discoveryResult.updatedConfig ? '成功' : '未更新'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 変更詳細 */}
                  {(state.discoveryResult.newRegions.length > 0 || state.discoveryResult.removedRegions.length > 0) && (
                    <div className="space-y-2">
                      {state.discoveryResult.newRegions.length > 0 && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <h5 className="font-medium text-green-800 mb-1">新規追加リージョン</h5>
                          <div className="flex flex-wrap gap-1">
                            {state.discoveryResult.newRegions.map(region => (
                              <span key={region} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                                {region}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {state.discoveryResult.removedRegions.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <h5 className="font-medium text-red-800 mb-1">削除されたリージョン</h5>
                          <div className="flex flex-wrap gap-1">
                            {state.discoveryResult.removedRegions.map(region => (
                              <span key={region} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                                {region}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 現在のリージョン一覧 */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <h5 className="font-medium text-gray-800 mb-2">現在の設定リージョン</h5>
                    <div className="flex flex-wrap gap-1">
                      {state.discoveryResult.discoveredRegions.map(region => (
                        <span key={region} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                          {region}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={closeResult}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}