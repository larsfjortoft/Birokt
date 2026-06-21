'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, ClipboardCheck } from 'lucide-react';
import Link from 'next/link';
import { statsApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SkeletonList } from '@/components/ui/skeleton';
import { cn, getHealthColor, getStrengthColor } from '@/lib/utils';

const actionLabels: Record<string, string> = {
  needs_brood_box: 'Trenger yngelrom',
  needs_super: 'Trenger skattekasse',
  needs_split: 'Trenger deling',
  needs_food: 'Trenger mat',
  hunger: 'Trenger mat',
  swarm_tendency: 'Svermetrang',
  space_shortage: 'Plassmangel',
};

const healthLabels: Record<string, string> = {
  healthy: 'Frisk',
  warning: 'Advarsel',
  critical: 'Kritisk',
};

const strengthLabels: Record<string, string> = {
  strong: 'Sterk',
  medium: 'Medium',
  weak: 'Svak',
};

export default function ActionsPage() {
  const { data: response, isLoading } = useQuery({
    queryKey: ['stats', 'actions-needed'],
    queryFn: () => statsApi.actionsNeeded(),
  });

  const hives = response?.data?.hives || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trenger handling</h1>
          <p className="text-gray-500">Kuber med tiltak fra siste inspeksjon</p>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <SkeletonList rows={4} />
          </CardContent>
        </Card>
      ) : hives.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">Ingen kuber trenger handling</h3>
            <p className="text-gray-500">Når en inspeksjon merkes med handling, vises kuben her.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {hives.map((item) => (
            <Link
              key={item.hive.id}
              href={`/hives/${item.hive.id}`}
              className="block rounded-xl focus:outline-none focus:ring-2 focus:ring-honey-500 focus:ring-offset-2"
            >
              <Card className="cursor-pointer hover:border-amber-300 hover:shadow-md transition-all">
                <CardContent className="py-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-gray-900">
                          Kube {item.hive.hiveNumber}
                        </span>
                        {item.inspection.strength && (
                          <span className={cn('px-2 py-0.5 rounded text-xs font-medium', getStrengthColor(item.inspection.strength))}>
                            {strengthLabels[item.inspection.strength] || item.inspection.strength}
                          </span>
                        )}
                        <span className={cn('px-2 py-0.5 rounded text-xs font-medium', getHealthColor(item.inspection.healthStatus))}>
                          {healthLabels[item.inspection.healthStatus] || item.inspection.healthStatus}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">{item.hive.apiary.name}</p>
                      <span className="mt-2 inline-flex items-center gap-1 text-sm text-honey-600">
                        <ClipboardCheck className="w-4 h-4" />
                        Inspeksjon {new Date(item.inspection.inspectionDate).toLocaleDateString('nb-NO')}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 md:justify-end">
                      {item.actions.map((action) => (
                        <Badge key={action.id} variant="warning">
                          {actionLabels[action.actionType] || action.actionType}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
