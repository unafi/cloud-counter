"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  CreditCard,
  Cloud,
  Settings,
  Menu,
  X,
  User,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const pathname = usePathname();

  const navigation = [
    { name: "ダッシュボード", href: "/", icon: LayoutDashboard },
    { name: "無料枠トラッカー", href: "/tracker", icon: CreditCard },
    { name: "移行ガイド", href: "/migration", icon: Cloud },
    { name: "設定", href: "/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      {/* Sidebar */}
      <aside
        className={clsx(
          "bg-slate-900 text-white transition-all duration-300 ease-in-out fixed inset-y-0 left-0 z-50 md:relative md:translate-x-0 w-64",
          !isSidebarOpen && "-translate-x-full md:hidden"
        )}
      >
        <div className="h-16 flex items-center justify-between px-6 bg-slate-950">
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-blue-200">
            CloudBill
          </span>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden text-slate-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={clsx(
                  "flex items-center px-4 py-3 rounded-lg transition-colors group",
                  isActive
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )}
              >
                <item.icon
                  className={clsx(
                    "w-5 h-5 mr-3 transition-colors",
                    isActive ? "text-white" : "text-slate-500 group-hover:text-blue-300"
                  )}
                />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-slate-800">
          <div className="flex items-center space-x-3 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300">
              <User className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Guest User</p>
              <p className="text-xs text-slate-500">Local Mode</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-8 shadow-sm">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className={clsx(
              "p-2 rounded-md text-slate-500 hover:bg-slate-100 focus:outline-none md:hidden",
              isSidebarOpen && "hidden"
            )}
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center space-x-4 ml-auto">
            {/* Right side header actions if needed */}
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-auto p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}
