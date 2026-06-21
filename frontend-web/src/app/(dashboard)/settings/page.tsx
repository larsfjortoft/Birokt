'use client';

import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, Database, Moon, Sun } from 'lucide-react';
import { useThemeStore, type Theme } from '@/stores/theme';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useThemeStore();

  const themeOptions: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Innstillinger</h1>
        <p className="text-gray-500">Lokale valg for Birøkt</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            Utseende
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="inline-flex rounded-lg border border-gray-300 bg-gray-100 p-1">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = theme === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                    isSelected
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-700 dark:text-white'
                      : 'text-gray-600 hover:text-gray-900 dark:text-slate-300 dark:hover:text-white'
                  )}
                  aria-pressed={isSelected}
                >
                  <Icon className="w-4 h-4" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Varsler
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Inspeksjonspåminnelser</p>
                <p className="text-sm text-gray-500">Få varsel når det er på tide å inspisere</p>
              </div>
              <input
                type="checkbox"
                className="w-5 h-5 text-honey-500 rounded focus:ring-honey-500"
                disabled
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Værvarsler</p>
                <p className="text-sm text-gray-500">Bli varslet om gode inspeksjonsforhold</p>
              </div>
              <input
                type="checkbox"
                className="w-5 h-5 text-honey-500 rounded focus:ring-honey-500"
                disabled
              />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            Varslinger kommer i en fremtidig versjon.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-3">
            Gå til Rapporter-siden for å laste ned data i CSV- eller PDF-format.
          </p>
          <Button variant="outline" onClick={() => router.push('/reports')}>
            Gå til rapporter
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
