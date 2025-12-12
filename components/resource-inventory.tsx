"use client";

import { useEffect, useState } from "react";
import { Loader2, Server, Box, RefreshCw, Layers } from "lucide-react";

type CloudResource = {
    id: string;
    name: string;
    type: string;
    status: string;
    region: string;
    regionDisplayName?: string;
    crossRegionId?: string;
    availability?: string;
    lastSeen?: string;
    resourceArn?: string;
    details?: string;
};

type ResourceResponse = {
    resources: CloudResource[];
    lastUpdated?: string;
    regionCount?: number;
    stats?: {
        totalResources: number;
        byRegion: { [region: string]: number };
        byType: { [type: string]: number };
        byStatus: { [status: string]: number };
    };
    error?: string;
};

export default function ResourceInventory() {
    const [resources, setResources] = useState<CloudResource[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [stats, setStats] = useState<ResourceResponse['stats'] | null>(null);
    const [regionCount, setRegionCount] = useState<number>(0);

    // プロバイダー判定（簡易）
    const getProvider = (type: string) => {
        if (type === "EC2" || type === "Lambda") return "AWS";
        if (type === "Virtual Machine" || type === "Azure Functions" || type === "App Service") return "Azure";
        if (type === "Compute Engine") return "GCP";
        return "Unknown";
    };

    const fetchData = async (forceRefresh = false) => {
        if (forceRefresh) setUpdating(true);
        else setLoading(true);

        try {
            const query = forceRefresh ? "?refresh=true" : "";
            const [aws, azure, gcp] = await Promise.all([
                fetch(`/api/aws/resources${query}`).then(r => r.json() as Promise<ResourceResponse>),
                fetch(`/api/azure/resources${query}`).then(r => r.json() as Promise<ResourceResponse>),
                fetch(`/api/google/resources${query}`).then(r => r.json() as Promise<ResourceResponse>),
            ]);

            const allResources = [
                ...(aws.resources || []),
                ...(azure.resources || []),
                ...(gcp.resources || [])
            ];

            // 最終更新日
            const dates = [aws.lastUpdated, azure.lastUpdated, gcp.lastUpdated].filter(Boolean) as string[];
            if (dates.length > 0) {
                dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
                setLastUpdated(new Date(dates[0]).toLocaleString());
            }

            // 統計情報とリージョン数を統合
            const combinedStats = {
                totalResources: allResources.length,
                byRegion: {} as { [region: string]: number },
                byType: {} as { [type: string]: number },
                byStatus: {} as { [status: string]: number }
            };

            // AWS統計情報を統合（マルチリージョン対応）
            if (aws.stats) {
                Object.assign(combinedStats.byRegion, aws.stats.byRegion);
                Object.assign(combinedStats.byType, aws.stats.byType);
                Object.assign(combinedStats.byStatus, aws.stats.byStatus);
            }

            // 他のプロバイダーの統計も統合
            allResources.forEach(resource => {
                if (!aws.stats) { // AWSに統計がない場合は手動計算
                    combinedStats.byRegion[resource.region] = (combinedStats.byRegion[resource.region] || 0) + 1;
                    combinedStats.byType[resource.type] = (combinedStats.byType[resource.type] || 0) + 1;
                    combinedStats.byStatus[resource.status] = (combinedStats.byStatus[resource.status] || 0) + 1;
                }
            });

            setResources(allResources);
            setStats(combinedStats);
            setRegionCount(aws.regionCount || Object.keys(combinedStats.byRegion).length);
        } catch (e) {
            console.error("Failed to fetch resources", e);
        } finally {
            setLoading(false);
            setUpdating(false);
        }
    };

    useEffect(() => {
        fetchData(false);
    }, []);

    // ステータスの色判定
    const getStatusColor = (status: string) => {
        const s = status.toLowerCase();
        if (s === "running" || s === "active") return "bg-green-100 text-green-700 border-green-200";
        if (s === "stopped" || s === "terminated" || s === "deallocated") return "bg-slate-100 text-slate-600 border-slate-200";
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                        <Layers className="w-5 h-5 mr-2 text-indigo-500" />
                        リソース一覧 / 稼働ステータス
                    </h3>
                    {stats && (
                        <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                            <span>総数: {stats.totalResources}個</span>
                            <span>リージョン: {regionCount}個</span>
                            <span>稼働中: {stats.byStatus?.running || stats.byStatus?.Active || 0}個</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center space-x-4">
                    <p className="text-xs text-slate-500 hidden md:block">
                        {lastUpdated ? `最終更新: ${lastUpdated}` : "データ未取得"}
                    </p>
                    <button
                        onClick={() => fetchData(true)}
                        disabled={updating}
                        className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                        title="ステータスを更新 (APIコール発生)"
                    >
                        <RefreshCw className={`w-4 h-4 ${updating ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                {loading && resources.length === 0 ? (
                    <div className="p-8 text-center flex justify-center items-center">
                        <Loader2 className="w-6 h-6 animate-spin text-slate-400 mr-2" />
                        <span className="text-slate-500">リソース情報を取得中...</span>
                    </div>
                ) : resources.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        リソースが見つかりません (キャッシュなし、または0件)
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-medium">
                                <tr>
                                    <th className="px-5 py-3">Provider</th>
                                    <th className="px-5 py-3">Service / Type</th>
                                    <th className="px-5 py-3">Resource Name</th>
                                    <th className="px-5 py-3">Status</th>
                                    <th className="px-5 py-3 hidden md:table-cell">Region</th>
                                    <th className="px-5 py-3 hidden sm:table-cell">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {resources.map((res, i) => (
                                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-5 py-3">
                                            <span className={`px-2 py-1 rounded-md text-xs font-bold ${getProvider(res.type) === "AWS" ? "bg-orange-50 text-orange-600" :
                                                    getProvider(res.type) === "Azure" ? "bg-blue-50 text-blue-600" :
                                                        "bg-blue-50 text-blue-500" // GCP
                                                }`}>
                                                {getProvider(res.type)}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 font-medium text-slate-700">
                                            <div className="flex items-center">
                                                {res.type.includes("Virtual") || res.type.includes("EC2") || res.type.includes("Compute") ? (
                                                    <Server className="w-4 h-4 mr-2 text-slate-400" />
                                                ) : (
                                                    <Box className="w-4 h-4 mr-2 text-slate-400" />
                                                )}
                                                {res.type}
                                            </div>
                                        </td>
                                        <td className="px-5 py-3 text-slate-900 font-medium">{res.name}</td>
                                        <td className="px-5 py-3">
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(res.status)}`}>
                                                {res.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-slate-500 hidden md:table-cell">
                                            <div>
                                                <div className="font-medium">{res.region}</div>
                                                {res.regionDisplayName && (
                                                    <div className="text-xs text-slate-400">{res.regionDisplayName}</div>
                                                )}
                                                {res.availability && res.availability !== res.region && (
                                                    <div className="text-xs text-slate-400">AZ: {res.availability}</div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-5 py-3 text-slate-500 text-xs hidden sm:table-cell">{res.details || "-"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
