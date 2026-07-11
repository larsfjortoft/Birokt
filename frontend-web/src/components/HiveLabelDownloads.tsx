'use client';

import QRCode from 'qrcode';
import { Download, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';

type HiveLabelDownloadsProps = {
  hiveNumber: string;
  qrCode: string;
  hiveType: string;
};

const BASE_WIDTH = 72;
const BASE_HEIGHT = 54;
const BASE_DEPTH = 2;
const RAISED_DEPTH = 0.8;

const glyphs: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '?': ['01110', '10001', '00010', '00100', '00100', '00000', '00100'],
};

type TextBlockOptions = {
  x?: number;
  y?: number;
  maxWidth?: number;
  align?: 'left' | 'center' | 'right';
  maxScale?: number;
};

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function safeFilename(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'kube';
}

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[character] || character));
}

function cube(x: number, y: number, z: number, width: number, height: number, depth: number) {
  const points = [
    [x, y, z], [x + width, y, z], [x + width, y + height, z], [x, y + height, z],
    [x, y, z + depth], [x + width, y, z + depth], [x + width, y + height, z + depth], [x, y + height, z + depth],
  ];
  const faces = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  return faces.map((face) => `facet normal 0 0 0\n outer loop\n${face.map((index) => `  vertex ${points[index].join(' ')}`).join('\n')}\n endloop\nendfacet`).join('\n');
}

function labelTextBlocks(label: string, options: TextBlockOptions = {}) {
  const text = label.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const {
    x = BASE_WIDTH / 2,
    y = 3,
    maxWidth = 48,
    align = 'center',
    maxScale = 1.3,
  } = options;
  const scale = Math.min(maxScale, maxWidth / Math.max(1, text.length * 6));
  const textWidth = (text.length * 6 - 1) * scale;
  const blocks: string[] = [];
  let startX = x;

  if (align === 'center') {
    startX -= textWidth / 2;
  } else if (align === 'right') {
    startX -= textWidth;
  }

  for (const character of text) {
    const glyph = glyphs[character] || glyphs['?'];
    glyph.forEach((row, rowIndex) => row.split('').forEach((pixel, columnIndex) => {
      if (pixel === '1') blocks.push(cube(startX + columnIndex * scale, y + (6 - rowIndex) * scale, BASE_DEPTH, scale, scale, RAISED_DEPTH));
    }));
    startX += 6 * scale;
  }

  return blocks;
}

export function HiveLabelDownloads({ hiveNumber, qrCode, hiveType }: HiveLabelDownloadsProps) {
  const filename = safeFilename(hiveNumber);
  const colonyLabels = hiveType === 'double_queen' ? ['1', '2'] : ['1'];

  const downloadSvg = async () => {
    const qrDataUrl = await QRCode.toDataURL(qrCode, { errorCorrectionLevel: 'M', margin: 1, width: 900 });
    const qrX = 220;
    const qrY = 120;
    const qrWidth = 460;
    const leftColonyLabel = `<text x="${qrX + 22}" y="92" text-anchor="start" font-family="Arial, sans-serif" font-size="56" font-weight="700" fill="#111827">${escapeXml(colonyLabels[0])}</text>`;
    const rightColonyLabel = colonyLabels[1]
      ? `\n  <text x="${qrX + qrWidth - 22}" y="92" text-anchor="end" font-family="Arial, sans-serif" font-size="56" font-weight="700" fill="#111827">${escapeXml(colonyLabels[1])}</text>`
      : '';
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="90mm" height="60mm" viewBox="0 0 900 600">\n  <rect width="900" height="600" rx="24" fill="white" stroke="#1f2937" stroke-width="10"/>\n  ${leftColonyLabel}${rightColonyLabel}\n  <image href="${qrDataUrl}" x="${qrX}" y="${qrY}" width="${qrWidth}" height="${qrWidth}"/>\n  <text x="450" y="565" text-anchor="middle" font-family="Arial, sans-serif" font-size="52" font-weight="700" fill="#111827">${escapeXml(hiveNumber)}</text>\n</svg>`;
    download(`kube-${filename}-qr-etikett.svg`, svg, 'image/svg+xml');
  };

  const downloadStl = () => {
    const qr = QRCode.create(qrCode, { errorCorrectionLevel: 'M' });
    const qrSize = 30;
    const moduleSize = qrSize / qr.modules.size;
    const qrX = (BASE_WIDTH - qrSize) / 2;
    const qrY = 13;
    const modules: string[] = [];

    for (let row = 0; row < qr.modules.size; row += 1) {
      for (let column = 0; column < qr.modules.size; column += 1) {
        if (qr.modules.get(row, column)) {
          modules.push(cube(qrX + column * moduleSize, qrY + (qr.modules.size - row - 1) * moduleSize, BASE_DEPTH, moduleSize, moduleSize, RAISED_DEPTH));
        }
      }
    }

    const textBlocks = [
      ...labelTextBlocks(hiveNumber, { x: BASE_WIDTH / 2, y: 3, maxWidth: qrSize + 8, maxScale: 1.2 }),
      ...labelTextBlocks(colonyLabels[0], { x: qrX + 4.5, y: 46, maxWidth: 8, maxScale: 1 }),
      ...(colonyLabels[1] ? labelTextBlocks(colonyLabels[1], { x: qrX + qrSize - 4.5, y: 46, maxWidth: 8, maxScale: 1 }) : []),
    ];

    const stl = `solid birokt_hive_label\n${cube(0, 0, 0, BASE_WIDTH, BASE_HEIGHT, BASE_DEPTH)}\n${modules.join('\n')}\n${textBlocks.join('\n')}\nendsolid birokt_hive_label\n`;
    download(`kube-${filename}-3d-merke.stl`, stl, 'model/stl');
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => void downloadSvg()}>
        <QrCode className="mr-2 h-4 w-4" />
        Last ned QR-etikett
      </Button>
      <Button variant="outline" size="sm" onClick={downloadStl}>
        <Download className="mr-2 h-4 w-4" />
        Last ned 3D-merke (STL)
      </Button>
    </div>
  );
}
