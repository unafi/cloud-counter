"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { AlertCircle, TrendingUp, Loader2 } from "lucide-react";
import { AWS_FREE_TIER_LIMITS, AZURE_FREE_TIER_LIMITS, GCP_FREE_TIER_LIMITS, FreeTierLimit } from "@/lib/free-tier-limits";
import ResourceInventory from "@/components/resource-inventory";
import { RegionDiscoveryButton } from "@/components/region-discovery-button";

// 簡易通貨レート (プロトタイプ用)
const USD_TO_JPY = 150;

type ServiceUsage = {
    service_name: string;
    region: string;
    cost: string; // API returns string
    usage: string;
    cost_unit: string;
    usage_unit: string;
};

type CloudCostResponse = {
    total: number;
    currency: string;
    details: ServiceUsage[];
    message?: string;
    period?: { start: string, end: string };
};

type FreeTierStatus = {
    service: string;
    provider: "AWS" | "Azure" | "GCP";
    limit: string;
    used: string;
    percentage: number;
    usageUnit: string;
};

export default function Overview() {
    const [totalCost, setTotalCost] = useState(0);
    const [pieData, setPieData] = useState<any[]>([]);
    const [warnings, setWarnings] = useState<FreeTierStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    const fetchData = async (forceRefresh = false) => {
        setLoading(true);
        if (forceRefresh) setUpdating(true);

        try {
            const query = forceRefresh ? "?refresh=true" : "";

            // 並行フェッチ
            const [awsRes, azureRes, gcpRes] = await Promise.all([
                fetch(`/api/aws/cost${query}`).then(r => r.json() as Promise<CloudCostResponse & { lastUpdated?: string }>),
                fetch(`/api/azure/cost${query}`).then(r => r.json() as Promise<CloudCostResponse & { lastUpdated?: string }>),
                fetch(`/api/google/cost${query}`).then(r => r.json() as Promise<CloudCostResponse & { lastUpdated?: string }>),
            ]);

            // 最終更新日の取得 (どれか一つでもあれば採用)
            const dates = [awsRes.lastUpdated, azureRes.lastUpdated, gcpRes.lastUpdated].filter(Boolean) as string[];
            if (dates.length > 0) {
                // 最も新しい日時を採用
                dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
                setLastUpdated(new Date(dates[0]).toLocaleString());
            }

            // 1. コスト集計 (JPY換算)
            const awsCost = (awsRes.total || 0) * (awsRes.currency === "USD" ? USD_TO_JPY : 1);
            const azureCost = (azureRes.total || 0) * (azureRes.currency === "USD" ? USD_TO_JPY : 1);
            const gcpCost = (gcpRes.total || 0) * (gcpRes.currency === "USD" ? USD_TO_JPY : 1);

            setTotalCost(Math.round(awsCost + azureCost + gcpCost));

            setPieData([
                { name: "AWS", value: Math.round(awsCost), color: "#FF9900" },
                { name: "Azure", value: Math.round(azureCost), color: "#0078D4" },
                { name: "Google Cloud", value: Math.round(gcpCost), color: "#4285F4" },
            ].filter(d => d.value > 0));

            // 2. 無料枠計算
            const calculatedWarnings: FreeTierStatus[] = [];

            // Helper to check limits
            const checkLimits = (provider: "AWS" | "Azure" | "GCP", items: ServiceUsage[], limits: FreeTierLimit[]) => {
                items?.forEach(item => {
                    const limitDef = limits.find(l => item.service_name.includes(l.serviceName) || l.serviceName.includes(item.service_name));

                    if (limitDef) {
                        const usageVal = parseFloat(item.usage);
                        const limitVal = limitDef.limit;

                        let percentage = 0;
                        if (limitVal > 0) {
                            percentage = Math.min(Math.round((usageVal / limitVal) * 100), 100);
                        }

                        if (percentage > 0 || usageVal > 0) {
                            calculatedWarnings.push({
                                service: item.service_name,
                                provider,
                                limit: `${limitVal.toLocaleString()} ${limitDef.unit}`,
                                used: usageVal.toLocaleString(),
                                percentage,
                                usageUnit: limitDef.unit
                            });
                        }
                    }
                });
            };

            checkLimits("AWS", awsRes.details || [], AWS_FREE_TIER_LIMITS);
            checkLimits("Azure", azureRes.details || [], AZURE_FREE_TIER_LIMITS);
            checkLimits("GCP", gcpRes.details || [], GCP_FREE_TIER_LIMITS);

            calculatedWarnings.sort((a, b) => b.percentage - a.percentage);
            setWarnings(calculatedWarnings);

        } catch (e) {
            console.error("Failed to fetch cloud data", e);
        } finally {
            setLoading(false);
            setUpdating(false);
        }
    };

    useEffect(() => {
        // 初回ロード時はキャッシュのみ取得
        fetchData(false);
    }, []);

    if (loading && !totalCost && !lastUpdated) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <span className="ml-2 text-slate-500">データを読み込んでいます...</span>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header / Actions */}
            <div className="flex justify-between items-center">
                <div>
                    <p className="text-sm text-slate-500">
                        {lastUpdated ? `最終更新: ${lastUpdated}` : "データ未取得 (キャッシュなし)"}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <RegionDiscoveryButton />
                    <button
                        onClick={() => fetchData(true)}
                        disabled={updating}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                        {updating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TrendingUp className="w-4 h-4 mr-2" />}
                        {updating ? "更新中..." : "データを最新にする (課金発生)"}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Cost Card */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-sm font-medium text-slate-500">今月の推定利用料 (Total)</p>
                            <h3 className="text-3xl font-bold text-slate-900 mt-1">¥ {totalCost.toLocaleString()}</h3>
                        </div>
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-sm text-slate-600">
                        <span className="text-green-500 font-medium whitespace-pre-wrap">Real-time Data Ready</span>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-400 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500"></div>
                </div>

                {/* Breakdown Chart */}
                <div className="md:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
                    <div className="w-1/2">
                        <h4 className="text-lg font-semibold text-slate-900 mb-2">クラウド別内訳</h4>
                        {pieData.length > 0 ? (
                            <div className="mt-4 space-y-2">
                                {pieData.map((item) => (
                                    <div key={item.name} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center">
                                            <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }}></span>
                                            {item.name}
                                        </div>
                                        <span className="font-medium">¥{item.value.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-400 py-4">データがありません (¥0)</p>
                        )}
                    </div>
                    <div className="w-1/2 h-40">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData.length > 0 ? pieData : [{ name: "None", value: 1 }]}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={60}
                                    paddingAngle={5}
                                    dataKey="value"
                                    fill="#eee"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => `¥${value.toLocaleString()}`} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Free Tier Warnings */}
            <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2 text-orange-500" />
                    無料枠アラート / 使用状況
                </h3>

                {warnings.length === 0 ? (
                    <div className="bg-slate-50 rounded-xl p-8 text-center text-slate-500 mb-8">
                        現在、無料枠の対象となる主なサービスの利用は検知されていません。
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                        {warnings.map((warn, i) => (
                            <div key={i} className={`bg-white rounded-xl p-5 shadow-sm border border-l-4 transition-all ${warn.percentage >= 85 ? 'border-l-orange-500' : 'border-slate-100'}`}>
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center">
                                        <span className={`px-2 py-1 rounded text-xs font-bold mr-2 ${warn.provider === 'AWS' ? 'bg-orange-100 text-orange-700' :
                                            warn.provider === 'Azure' ? 'bg-blue-100 text-blue-700' :
                                                'bg-green-100 text-green-700'
                                            }`}>
                                            {warn.provider}
                                        </span>
                                        <h4 className="font-semibold text-slate-900 truncate max-w-[150px]" title={warn.service}>{warn.service}</h4>
                                    </div>
                                    {warn.percentage >= 80 && (
                                        <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
                                            Limit Near
                                        </span>
                                    )}
                                </div>

                                <div className="mb-2 flex justify-between text-sm text-slate-500">
                                    <span>{warn.used} / {warn.limit}</span>
                                    <span className="font-bold">{warn.percentage}%</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                    <div
                                        className={`h-2 rounded-full transition-all duration-1000 ${warn.percentage >= 90 ? 'bg-red-500' :
                                            warn.percentage >= 70 ? 'bg-orange-400' : 'bg-blue-400'
                                            }`}
                                        style={{ width: `${Math.min(warn.percentage, 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Resource Inventory */}
            <ResourceInventory />
        </div>
    );
}
