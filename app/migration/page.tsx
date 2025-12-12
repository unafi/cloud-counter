import DashboardShell from "@/components/dashboard-shell";
import MigrationAdvisor from "@/components/migration-advisor";

export default function MigrationPage() {
    return (
        <DashboardShell>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">移行ガイド</h1>
                <p className="text-slate-500">
                    無料枠終了が近いサービスに対する、最適な移行先のリコメンデーション
                </p>
            </div>
            <MigrationAdvisor />
        </DashboardShell>
    );
}
