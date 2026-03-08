'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi, apiariesApi } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, FileText, Download } from 'lucide-react';
import toast from 'react-hot-toast';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

type CsvType = 'inspections' | 'treatments' | 'feedings' | 'production';
type PdfType = 'season' | 'hive' | 'apiary';

const csvExports: Array<{ type: CsvType; label: string; description: string }> = [
  { type: 'inspections', label: 'Inspeksjoner', description: 'Alle inspeksjoner med detaljer' },
  { type: 'treatments', label: 'Behandlinger', description: 'Alle behandlinger med tilbakeholdelsesfrister' },
  { type: 'feedings', label: 'Foringer', description: 'Alle foringer med mengder' },
  { type: 'production', label: 'Produksjon', description: 'All produksjon med okonomi' },
];

export default function ReportsPage() {
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [downloading, setDownloading] = useState<string | null>(null);

  const { data: apiariesResponse } = useQuery({
    queryKey: ['apiaries'],
    queryFn: () => apiariesApi.list(),
  });

  const apiaries = apiariesResponse?.data || [];

  async function handleCsvDownload(type: CsvType) {
    setDownloading(`csv-${type}`);
    try {
      const response = await reportsApi.downloadCsv(type, selectedYear);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-${selectedYear}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Kunne ikke laste ned CSV-fil');
    } finally {
      setDownloading(null);
    }
  }

  async function handlePdfDownload(type: PdfType, id?: string) {
    const key = id ? `pdf-${type}-${id}` : `pdf-${type}`;
    setDownloading(key);
    try {
      const response = await reportsApi.downloadPdf(type, selectedYear, id);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-rapport-${selectedYear}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Kunne ikke generere PDF-rapport');
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rapporter og eksport</h1>
          <p className="text-gray-500">Last ned data og generer rapporter</p>
        </div>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-honey-500"
        >
          {years.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {/* PDF Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-red-500" />
            PDF-rapporter
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Sesongrapport {selectedYear}</p>
              <p className="text-sm text-gray-500">
                Komplett oversikt over sesongen. Kan brukes for Mattilsynet.
              </p>
            </div>
            <Button
              onClick={() => handlePdfDownload('season')}
              isLoading={downloading === 'pdf-season'}
              size="sm"
            >
              <Download className="w-4 h-4 mr-1" />
              Last ned
            </Button>
          </div>

          {apiaries.map((apiary) => (
            <div key={apiary.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Bigardrapport — {apiary.name}</p>
                <p className="text-sm text-gray-500">{apiary.hiveCount} kuber</p>
              </div>
              <Button
                variant="outline"
                onClick={() => handlePdfDownload('apiary', apiary.id)}
                isLoading={downloading === `pdf-apiary-${apiary.id}`}
                size="sm"
              >
                <Download className="w-4 h-4 mr-1" />
                PDF
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* CSV Exports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-green-500" />
            CSV-eksport
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {csvExports.map((exp) => (
              <div key={exp.type} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{exp.label}</p>
                  <p className="text-sm text-gray-500">{exp.description}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => handleCsvDownload(exp.type)}
                  isLoading={downloading === `csv-${exp.type}`}
                  size="sm"
                >
                  <Download className="w-4 h-4 mr-1" />
                  CSV
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
