import PermissionHelper from "@/components/permission-helper";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function SettingsPage() {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="border-b p-4 flex items-center gap-4">
                <Link href="/" className="p-2 hover:bg-muted rounded-full">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-xl font-bold">Settings & Setup</h1>
            </header>
            <main className="p-6 max-w-4xl mx-auto">
                <PermissionHelper />
            </main>
        </div>
    );
}
