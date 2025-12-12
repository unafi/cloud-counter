import { NextRequest, NextResponse } from 'next/server';
import { ConfigManager } from '@/lib/config-manager';
import { ErrorHandler } from '@/lib/error-handler';
import { RegionDetector } from '@/lib/region-detector';
import { DiscoveryCache } from '@/lib/discovery-cache';
import { getConfig } from '@/lib/config';

/**
 * リージョン発見APIのリクエスト型
 */
interface RegionDiscoveryRequest {
  action: 'discover' | 'status';
}

/**
 * リージョン発見APIのレスポンス型
 */
interface RegionDiscoveryResponse {
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
 * AWS全リージョン発見API
 * Cost Explorer APIを使用してアクティブなリージョンを検出し、設定を更新
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    const body: RegionDiscoveryRequest = await request.json();
    
    if (body.action === 'status') {
      return await handleStatusRequest();
    }
    
    if (body.action === 'discover') {
      return await handleDiscoveryRequest(startTime);
    }
    
    return NextResponse.json(
      { error: 'Invalid action. Use "discover" or "status".' },
      { status: 400 }
    );
    
  } catch (error) {
    console.error('Region Discovery API Error:', error);
    
    const errorResponse = ErrorHandler.handleCostExplorerError(error as Error);
    
    return NextResponse.json(
      {
        error: errorResponse.message,
        action: errorResponse.action,
        recoverable: errorResponse.recoverable,
        errorCode: errorResponse.errorCode
      },
      { status: 500 }
    );
  }
}

/**
 * ステータス確認リクエストを処理
 */
async function handleStatusRequest(): Promise<NextResponse> {
  const currentRegions = ConfigManager.getRegionConfig();
  const cache = new DiscoveryCache();
  const stats = await cache.getStats();
  
  const response: RegionDiscoveryResponse = {
    discoveredRegions: currentRegions,
    previousRegions: currentRegions,
    newRegions: [],
    removedRegions: [],
    updatedConfig: false,
    cost: 0,
    lastDiscovery: stats.lastExecution?.split('T')[0]
  };
  
  return NextResponse.json(response);
}

/**
 * リージョン発見リクエストを処理
 */
async function handleDiscoveryRequest(startTime: number): Promise<NextResponse> {
  // AWS認証情報の確認
  const accessKeyId = getConfig("AWS_ACCESS_KEY_ID");
  const secretAccessKey = getConfig("AWS_SECRET_ACCESS_KEY");
  
  if (!accessKeyId || !secretAccessKey) {
    return NextResponse.json(
      {
        error: 'AWS認証情報が設定されていません',
        action: '.env.localファイルにAWS_ACCESS_KEY_IDとAWS_SECRET_ACCESS_KEYを設定してください',
        recoverable: true,
        errorCode: 'AWS_CREDENTIALS_MISSING'
      },
      { status: 400 }
    );
  }
  
  // 重複実行チェック
  const cache = new DiscoveryCache();
  const todayExecution = await cache.checkTodayExecution();
  
  if (todayExecution) {
    const currentRegions = ConfigManager.getRegionConfig();
    
    return NextResponse.json({
      discoveredRegions: currentRegions,
      previousRegions: currentRegions,
      newRegions: [],
      removedRegions: [],
      updatedConfig: false,
      cost: 0,
      lastDiscovery: todayExecution.lastDiscovery,
      error: `本日既にリージョン発見を実行済みです（${todayExecution.requestCount}回目のリクエスト）。Cost Explorer APIの重複課金を防ぐため、1日1回の制限があります。`
    });
  }
  
  // RegionDetectorを使用してリージョン発見を実行
  const regionDetector = new RegionDetector({
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!
  });
  
  const detectionResult = await regionDetector.detectActiveRegions({
    timePeriodMonths: 1,
    includeCurrentMonth: true,
    filterInvalidRegions: true
  });
  
  const discoveredRegions = detectionResult.activeRegions;
  
  // 現在の設定と比較
  const comparison = ConfigManager.getConfigComparison(discoveredRegions);
  
  // 設定を更新
  const updateSuccess = await ConfigManager.updateRegionConfig(discoveredRegions);
  
  if (updateSuccess) {
    // 実行結果をキャッシュに保存
    await cache.saveExecution(
      discoveredRegions,
      detectionResult.executionTime,
      detectionResult.costIncurred
    );
  }
  
  const response: RegionDiscoveryResponse = {
    discoveredRegions,
    previousRegions: comparison.previous,
    newRegions: comparison.added,
    removedRegions: comparison.removed,
    updatedConfig: updateSuccess,
    cost: detectionResult.costIncurred,
    lastDiscovery: updateSuccess ? new Date().toISOString().split('T')[0] : undefined,
    executionTime: detectionResult.executionTime
  };
  
  return NextResponse.json(response);
}



