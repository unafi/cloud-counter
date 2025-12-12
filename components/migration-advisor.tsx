"use client";

import { ArrowRight, Check, X, AlertTriangle } from "lucide-react";
import { clsx } from "clsx";

interface ServiceComparison {
    provider: "AWS" | "Azure" | "GCP";
    serviceName: string;
    freeTierLimit: string;
    currentStatus: string;
    estimatedCost: string;
    pros: string[];
    cons: string[];
    recommended?: boolean;
}

const COMPARISONS: ServiceComparison[] = [
    {
        provider: "AWS",
        serviceName: "Lambda",
        freeTierLimit: "400,000 GB-seconds / month",
        currentStatus: "Limit Exceeded soon (2 days left)",
        estimatedCost: "¥450 / month (after limit)",
        pros: ["Existing implementation", "Rich ecosystem"],
        cons: ["Free tier expirations", "Complex cold starts"],
        recommended: false,
    },
    {
        provider: "Azure",
        serviceName: "Functions",
        freeTierLimit: "1,000,000 requests / month",
        currentStatus: "Unused (Full Free Tier available)",
        estimatedCost: "¥0",
        pros: ["Generous permanently free tier", "Great VS Code integration"],
        cons: ["Different trigger model"],
        recommended: true,
    },
    {
        provider: "GCP",
        serviceName: "Cloud Functions",
        freeTierLimit: "2,000,000 invocations / month",
        currentStatus: "Unused",
        estimatedCost: "¥0",
        pros: ["Simple deployment", "Fast scaling"],
        cons: ["Fewer triggers than AWS"],
        recommended: false,
    },
];

export default function MigrationAdvisor() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <AlertTriangle className="h-5 w-5 text-amber-400" aria-hidden="true" />
                    </div>
                    <div className="ml-3">
                        <p className="text-sm text-amber-700">
                            <span className="font-bold">推奨アクション:</span> AWS Lambda
                            の無料枠が残りわずかです。Azure Functions への移行で月額約 ¥450
                            の節約が見込まれます。
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {COMPARISONS.map((service) => (
                    <div
                        key={service.provider}
                        className={clsx(
                            "relative rounded-2xl border p-6 shadow-sm transition-all hover:shadow-md bg-white",
                            service.recommended
                                ? "border-blue-500 ring-1 ring-blue-500"
                                : "border-slate-200"
                        )}
                    >
                        {service.recommended && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                Recommended
                            </div>
                        )}

                        <div className="flex items-center justify-between mb-4 mt-2">
                            <h3 className="text-xl font-bold text-slate-900">
                                {service.provider}
                            </h3>
                            <span className="text-sm font-medium text-slate-500">
                                {service.serviceName}
                            </span>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-semibold">
                                    無料枠上限
                                </p>
                                <p className="font-medium text-slate-700">{service.freeTierLimit}</p>
                            </div>

                            <div>
                                <p className="text-xs text-slate-500 uppercase font-semibold">
                                    現在のステータス
                                </p>
                                <p
                                    className={clsx(
                                        "font-medium",
                                        service.provider === "AWS" ? "text-red-500" : "text-green-600"
                                    )}
                                >
                                    {service.currentStatus}
                                </p>
                            </div>

                            <div className="pt-4 border-t border-slate-100">
                                <p className="text-xs text-slate-500 uppercase font-semibold text-center mb-1">
                                    推定月額コスト
                                </p>
                                <p className="text-2xl font-bold text-center text-slate-900">
                                    {service.estimatedCost}
                                </p>
                            </div>

                            <ul className="space-y-2 text-sm pt-4">
                                {service.pros.map((pro) => (
                                    <li key={pro} className="flex items-start text-slate-600">
                                        <Check className="w-4 h-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                                        {pro}
                                    </li>
                                ))}
                                {service.cons.map((con) => (
                                    <li key={con} className="flex items-start text-slate-600">
                                        <X className="w-4 h-4 text-red-400 mr-2 shrink-0 mt-0.5" />
                                        {con}
                                    </li>
                                ))}
                            </ul>

                            <button
                                className={clsx(
                                    "w-full py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center mt-4",
                                    service.recommended
                                        ? "bg-blue-600 text-white hover:bg-blue-700"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                )}
                            >
                                詳細を見る <ArrowRight className="w-4 h-4 ml-2" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
