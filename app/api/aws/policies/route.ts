import { NextRequest, NextResponse } from 'next/server';
import { ResourceCoverageAnalyzer } from '@/lib/resource-coverage-analyzer';

/**
 * AWS IAMポリシー生成API
 * 最小権限または包括的権限のIAMポリシーJSONを生成
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'minimal';
    
    try {
        let policy: object;
        let description: string;
        
        switch (type) {
            case 'comprehensive':
                policy = ResourceCoverageAnalyzer.generateComprehensivePolicy();
                description = '包括的な読み取り専用権限（データベース、コンテナ、ストレージ、ネットワークサービスを含む）';
                break;
            case 'minimal':
            default:
                policy = ResourceCoverageAnalyzer.generateMinimalPolicy();
                description = '最小権限（Cost Explorer、EC2、Lambda、S3のみ）';
                break;
        }
        
        return NextResponse.json({
            type,
            description,
            policy,
            usage: {
                minimal: 'Cost Explorer APIでのリージョン発見とEC2、Lambda、S3の基本リソース取得',
                comprehensive: '上記に加えて、データベース、コンテナ、ストレージ、ネットワークサービスの詳細取得'
            },
            note: 'すべて読み取り専用権限で、リソースの変更・削除は不可能です'
        });
        
    } catch (error) {
        console.error('Policy Generation API Error:', error);
        
        return NextResponse.json(
            { error: 'ポリシー生成中にエラーが発生しました' },
            { status: 500 }
        );
    }
}