'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  MapPin,
  Box,
  Crown,
  ClipboardCheck,
  Syringe,
  Droplets,
  Package,
  CalendarDays,
  BookOpen,
  FileText,
  BarChart3,
  Settings,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import GlobalSearch from '@/components/GlobalSearch';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Bigårder', href: '/apiaries', icon: MapPin },
  { name: 'Kuber', href: '/hives', icon: Box },
  { name: 'Dronninger', href: '/queens', icon: Crown },
  { name: 'Inspeksjoner', href: '/inspections', icon: ClipboardCheck },
  { name: 'Behandlinger', href: '/treatments', icon: Syringe },
  { name: 'Foring', href: '/feedings', icon: Droplets },
  { name: 'Produksjon', href: '/production', icon: Package },
  { name: 'Kalender', href: '/calendar', icon: CalendarDays },
  { name: 'Journal', href: '/journal', icon: BookOpen },
  { name: 'Statistikk', href: '/statistics', icon: BarChart3 },
  { name: 'Rapporter', href: '/reports', icon: FileText },
  { name: 'Innstillinger', href: '/settings', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [pathname]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-2xl">🐝</span>
            <span className="text-xl font-bold text-gray-900">Birøkt</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-md hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-honey-100 text-honey-700'
                    : 'text-gray-700 hover:bg-gray-100'
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-honey-100 rounded-full flex items-center justify-center">
              <span className="text-honey-700 font-medium">B</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">Birøkt</p>
              <p className="text-xs text-gray-500 truncate">Lokal app</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200 flex items-center gap-4 px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-md hover:bg-gray-100"
          >
            <Menu className="w-5 h-5" />
          </button>
          <GlobalSearch />
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
