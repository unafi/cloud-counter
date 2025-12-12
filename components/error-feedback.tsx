'use client';

import React from 'react';
import { AlertTriangle, Info, CheckCircle, XCircle, ExternalLink, Copy } from 'lucide-react';

/**
 * エラーレスポンスの型定義
 */
interface ErrorResponse {
  message: string;
  action: string;
  recoverable: boolean;
  errorCode?: string;
  details?: string;
}

/**
 * エラーフィードバックコンポーネントのプロパティ
 */
interface ErrorFeedbackProps {
  error: ErrorResponse | string | null;
  onClose?: () => void;
  onRetry?: () => void;
  className?: string;
}

/**
 * エラーフィードバックコンポーネント
 * 包括的なエラー処理とユーザー案内機能を提供
 */
export function ErrorFeedback({ error, onClose, onRetry, className = '' }: ErrorFeedbackProps) {
  if (!error) return null;

  // エラーが文字列の場合は簡易エラーオブジェクトに変換
  const errorObj: ErrorResponse = typeof error === 'string' 
    ? { message: error, action: '再試行してください', recoverable: true }
    : error;

  /**
   * エラーコードに基づいてアイコンと色を決定
   */
  const getErrorStyle = (errorCode?: string) => {
    switch (errorCode) {
      case 'COST_EXPLORER_PERMISSION_DENIED':
      case 'RESOURCE_API_PERMISSION_DENIED':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          iconColor: 'text-orange-500',
          titleColor: 'text-orange-800',
          textColor: 'text-orange-700'
        };
      case 'CONFIG_FILE_PERMISSION_DENIED':
      case 'DISK_SPACE_INSUFFICIENT':
        return {
          icon: XCircle,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          iconColor: 'text-red-500',
          titleColor: 'text-red-800',
          textColor: 'text-red-700'
        };
      case 'COST_EXPLORER_RATE_LIMIT':
      case 'NETWORK_ERROR':
        return {
          icon: Info,
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          iconColor: 'text-blue-500',
          titleColor: 'text-blue-800',
          textColor: 'text-blue-700'
        };
      default:
        return {
          icon: AlertTriangle,
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          iconColor: 'text-gray-500',
          titleColor: 'text-gray-800',
          textColor: 'text-gray-700'
        };
    }
  };

  /**
   * IAMポリシーの例をクリップボードにコピー
   */
  const copyIAMPolicy = async (policyType: 'cost-explorer' | 'resource-api') => {
    const policies = {
      'cost-explorer': `{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ce:GetDimensionValues"
            ],
            "Resource": "*"
        }
    ]
}`,
      'resource-api': `{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ec2:DescribeInstances",
                "lambda:ListFunctions"
            ],
            "Resource": "*"
        }
    ]
}`
    };

    try {
      await navigator.clipboard.writeText(policies[policyType]);
      // 簡易的な成功フィードバック（実際のプロジェクトではtoastなどを使用）
      console.log('IAMポリシーをクリップボードにコピーしました');
    } catch (err) {
      console.error('クリップボードへのコピーに失敗:', err);
    }
  };

  /**
   * エラーコードに基づいて詳細な案内を生成
   */
  const getDetailedGuidance = (errorCode?: string) => {
    switch (errorCode) {
      case 'COST_EXPLORER_PERMISSION_DENIED':
        return (
          <div className="mt-3 space-y-3">
            <div className="text-sm">
              <p className="font-medium mb-2">必要な権限:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>ce:GetDimensionValues</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => copyIAMPolicy('cost-explorer')}
                className="flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded text-xs hover:bg-orange-200"
              >
                <Copy className="w-3 h-3" />
                IAMポリシーをコピー
              </button>
              <a
                href="https://docs.aws.amazon.com/cost-management/latest/userguide/ce-access.html"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded text-xs hover:bg-orange-200"
              >
                <ExternalLink className="w-3 h-3" />
                AWS公式ドキュメント
              </a>
            </div>
          </div>
        );

      case 'RESOURCE_API_PERMISSION_DENIED':
        return (
          <div className="mt-3 space-y-3">
            <div className="text-sm">
              <p className="font-medium mb-2">必要な権限:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>ec2:DescribeInstances</li>
                <li>lambda:ListFunctions</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => copyIAMPolicy('resource-api')}
                className="flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded text-xs hover:bg-orange-200"
              >
                <Copy className="w-3 h-3" />
                IAMポリシーをコピー
              </button>
              <a
                href="https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_examples_ec2_instances-describe.html"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded text-xs hover:bg-orange-200"
              >
                <ExternalLink className="w-3 h-3" />
                AWS公式ドキュメント
              </a>
            </div>
          </div>
        );

      case 'CONFIG_FILE_PERMISSION_DENIED':
        return (
          <div className="mt-3 space-y-2">
            <div className="text-sm">
              <p className="font-medium mb-2">解決方法:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>ファイルの権限を確認: <code className="bg-gray-100 px-1 rounded">.env.local</code></li>
                <li>Windowsの場合: 管理者権限で実行</li>
                <li>Linuxの場合: <code className="bg-gray-100 px-1 rounded">chmod 644 .env.local</code></li>
              </ul>
            </div>
          </div>
        );

      case 'COST_EXPLORER_RATE_LIMIT':
        return (
          <div className="mt-3 space-y-2">
            <div className="text-sm">
              <p className="font-medium mb-2">対処方法:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>5-10分後に再実行してください</li>
                <li>1日1回の制限を活用して重複実行を避けてください</li>
                <li>同時実行を避けてください</li>
              </ul>
            </div>
          </div>
        );

      case 'NETWORK_ERROR':
        return (
          <div className="mt-3 space-y-2">
            <div className="text-sm">
              <p className="font-medium mb-2">確認事項:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>インターネット接続を確認</li>
                <li>ファイアウォール設定を確認</li>
                <li>AWSサービスの状態を確認</li>
              </ul>
            </div>
            <a
              href="https://status.aws.amazon.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
            >
              <ExternalLink className="w-3 h-3" />
              AWSサービス状態
            </a>
          </div>
        );

      default:
        return null;
    }
  };

  const style = getErrorStyle(errorObj.errorCode);
  const IconComponent = style.icon;

  return (
    <div className={`${style.bgColor} ${style.borderColor} border rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <IconComponent className={`w-5 h-5 ${style.iconColor} flex-shrink-0 mt-0.5`} />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h4 className={`font-medium ${style.titleColor}`}>
                {errorObj.errorCode ? `エラー: ${errorObj.errorCode}` : 'エラーが発生しました'}
              </h4>
              <p className={`mt-1 text-sm ${style.textColor}`}>
                {errorObj.message}
              </p>
              <p className={`mt-2 text-sm ${style.textColor}`}>
                <span className="font-medium">対処方法: </span>
                {errorObj.action}
              </p>
              
              {errorObj.details && (
                <details className="mt-2">
                  <summary className={`text-xs ${style.textColor} cursor-pointer hover:underline`}>
                    詳細情報を表示
                  </summary>
                  <pre className={`mt-1 text-xs ${style.textColor} bg-white bg-opacity-50 p-2 rounded overflow-x-auto`}>
                    {errorObj.details}
                  </pre>
                </details>
              )}

              {getDetailedGuidance(errorObj.errorCode)}
            </div>

            {onClose && (
              <button
                onClick={onClose}
                className={`${style.textColor} hover:${style.titleColor} transition-colors`}
                aria-label="エラーを閉じる"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>

          {(errorObj.recoverable && onRetry) && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={onRetry}
                className={`px-3 py-1 bg-white ${style.textColor} border ${style.borderColor} rounded text-sm hover:bg-opacity-80 transition-colors`}
              >
                再試行
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 成功メッセージコンポーネント
 */
interface SuccessFeedbackProps {
  message: string;
  onClose?: () => void;
  className?: string;
}

export function SuccessFeedback({ message, onClose, className = '' }: SuccessFeedbackProps) {
  return (
    <div className={`bg-green-50 border border-green-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-green-700">{message}</p>
            
            {onClose && (
              <button
                onClick={onClose}
                className="text-green-700 hover:text-green-800 transition-colors"
                aria-label="成功メッセージを閉じる"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}