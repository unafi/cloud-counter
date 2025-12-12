import DashboardShell from "@/components/dashboard-shell";
import Overview from "@/components/overview";

export default function Home() {
  return (
    <DashboardShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">ダッシュボード</h1>
        <p className="text-slate-500">クラウド課金状況と無料枠の消費ステータス</p>
      </div>
      <Overview />
    </DashboardShell>
  );
}
