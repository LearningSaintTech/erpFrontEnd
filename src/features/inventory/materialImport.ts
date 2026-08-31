import * as XLSX from 'xlsx';

export type ImportMaterialRow = {
  materialCode?: string;
  name: string;
  category: string;
  unit: string;
  unitCost: number;
  reorderLevel?: number;
  openingQty?: number;
  vendorName?: string;
};

function cell(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim() !== '') return String(row[key]).trim();
    const found = Object.keys(row).find((k) => k.trim().toLowerCase() === key.trim().toLowerCase());
    if (found != null && String(row[found]).trim() !== '') return String(row[found]).trim();
  }
  return '';
}

/** Pull a usable number from messy cells like "( Six colour) 590". */
export function parseLooseNumber(value: unknown): number {
  if (value == null || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const matches = String(value).replace(/,/g, '').match(/-?\d+(\.\d+)?/g);
  if (!matches?.length) return 0;
  return Number(matches[matches.length - 1]) || 0;
}

function guessAccessoryCategory(name: string): string {
  const n = name.toLowerCase();
  if (/zipper|zip\b/.test(n)) return 'ZIPPER';
  if (/button/.test(n)) return 'BUTTON';
  if (/label|tag|sticker/.test(n)) return 'LABEL';
  if (/thread|lastic|elastic/.test(n)) return 'THREAD';
  if (/cone/.test(n)) return 'THREAD';
  if (/bag|box|carton|carteen|packet|paper/.test(n)) return 'PACKAGING';
  return 'ACCESSORY';
}

function guessAccessoryUnit(name: string, usedPacket: boolean, usedBox: boolean): string {
  const n = name.toLowerCase();
  if (/cone/.test(n)) return 'CONES';
  if (/thread/.test(n) && usedPacket) return 'CONES';
  if (usedBox || usedPacket) return 'PIECES';
  return 'PIECES';
}

function mapFabricRow(row: Record<string, unknown>, index: number): ImportMaterialRow | null {
  const name = cell(row, 'Raw materials Name', 'Raw Material Name', 'name', 'Name');
  if (!name) return null;

  const priceM = parseLooseNumber(cell(row, 'Pricing Per meter', 'Price Per Meter', 'unitCost'));
  const stockM = parseLooseNumber(cell(row, 'Total Stock Meter', 'Total Stock Meters', 'openingQty'));
  const priceKg = parseLooseNumber(cell(row, 'Pricing Per Kg', 'Price Per Kg'));
  const stockKg = parseLooseNumber(cell(row, 'Total stock kg', 'Total Stock Kg', 'Total stock KG'));

  const useKg = (priceKg > 0 || stockKg > 0) && !(priceM > 0 || stockM > 0);
  const sno = cell(row, 'S.NO.', 'S.No', 'SNO') || String(index + 1);

  return {
    materialCode: `FAB-${String(sno).padStart(3, '0')}`,
    name,
    category: 'FABRIC',
    unit: useKg ? 'KG' : 'METERS',
    unitCost: useKg ? priceKg : priceM,
    openingQty: useKg ? stockKg : stockM,
    vendorName: cell(row, 'Vendor Name', 'vendorName', 'Vendor'),
  };
}

function mapAccessoryRow(row: Record<string, unknown>, index: number): ImportMaterialRow | null {
  const name = cell(row, 'Raw Material Name', 'Raw materials Name', 'name', 'Name');
  if (!name) return null;

  const pricePacket = parseLooseNumber(cell(row, 'Price Per Packet'));
  const qtyPacket = parseLooseNumber(cell(row, 'Total Packet'));
  const priceBox = parseLooseNumber(cell(row, 'Price Per Boxes', 'Price Per Box'));
  const qtyBox = parseLooseNumber(cell(row, 'Total Boxes', 'Total Box'));
  const pricePiece = parseLooseNumber(cell(row, 'Price Per Peice', 'Price Per Piece'));
  const qtyPiece = parseLooseNumber(cell(row, 'Total Peice', 'Total Piece'));

  let unitCost = 0;
  let openingQty = 0;
  let usedPacket = false;
  let usedBox = false;

  if (pricePacket > 0 || qtyPacket > 0) {
    unitCost = pricePacket;
    openingQty = qtyPacket;
    usedPacket = true;
  } else if (priceBox > 0 || qtyBox > 0) {
    unitCost = priceBox;
    openingQty = qtyBox;
    usedBox = true;
  } else {
    unitCost = pricePiece;
    openingQty = qtyPiece;
  }

  const sno = cell(row, 'S.NO.', 'S.No', 'SNO') || String(index + 1);
  const category = guessAccessoryCategory(name);

  return {
    materialCode: `ACC-${String(sno).padStart(3, '0')}`,
    name,
    category,
    unit: guessAccessoryUnit(name, usedPacket, usedBox),
    unitCost,
    openingQty,
    vendorName: cell(row, 'Vendor Name', 'vendorName', 'Vendor'),
  };
}

function mapGenericRow(row: Record<string, unknown>): ImportMaterialRow | null {
  const name = cell(row, 'name', 'Name', 'Raw materials Name', 'Raw Material Name');
  if (!name) return null;
  const category = (cell(row, 'category', 'Category') || 'FABRIC').toUpperCase();
  const unit = (cell(row, 'unit', 'Unit') || 'METERS').toUpperCase();
  return {
    materialCode: cell(row, 'materialCode', 'Material Code', 'Code') || undefined,
    name,
    category: ['FABRIC', 'THREAD', 'BUTTON', 'LABEL', 'ZIPPER', 'PACKAGING', 'ACCESSORY', 'OTHER'].includes(category)
      ? category
      : 'OTHER',
    unit: ['METERS', 'YARDS', 'PIECES', 'CONES', 'KG'].includes(unit) ? unit : 'METERS',
    unitCost: parseLooseNumber(cell(row, 'unitCost', 'Unit Cost', 'Pricing Per meter', 'Price')),
    reorderLevel: parseLooseNumber(cell(row, 'reorderLevel', 'Reorder Level')),
    openingQty: parseLooseNumber(cell(row, 'openingQty', 'Opening Qty', 'Total Stock Meter', 'Total stock kg')),
    vendorName: cell(row, 'vendorName', 'Vendor Name', 'Vendor'),
  };
}

function detectSheetMapper(sheetName: string, headers: string[]) {
  const h = headers.map((x) => x.toLowerCase());
  const name = sheetName.toLowerCase();
  if (name.includes('fabric') || h.some((x) => x.includes('pricing per meter') || x.includes('total stock meter'))) {
    return mapFabricRow;
  }
  if (
    name.includes('access')
    || h.some((x) => x.includes('price per packet') || x.includes('price per peice') || x.includes('price per piece'))
  ) {
    return mapAccessoryRow;
  }
  return mapGenericRow;
}

/** Parse .xlsx / .xls / .csv into importable material rows. */
export async function parseMaterialsUploadFile(file: File): Promise<ImportMaterialRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const items: ImportMaterialRow[] = [];
  const seenCodes = new Set<string>();

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
    if (!rows.length) continue;
    const headers = Object.keys(rows[0]);
    const mapper = detectSheetMapper(sheetName, headers);

    rows.forEach((row, index) => {
      const mapped = mapper === mapGenericRow
        ? mapGenericRow(row)
        : (mapper as typeof mapFabricRow)(row, index);
      if (!mapped?.name) return;
      let code = mapped.materialCode?.trim().toUpperCase();
      if (code && seenCodes.has(code)) {
        code = `${code}-${index + 1}`;
      }
      if (code) seenCodes.add(code);
      items.push({ ...mapped, materialCode: code });
    });
  }

  return items;
}

export function materialsImportTemplateCsv(): string {
  return [
    'materialCode,name,category,unit,unitCost,reorderLevel,openingQty,vendorName',
    'FAB-001,Cotton Poplin Navy,FABRIC,METERS,100,50,180,M/S DARSHNI ENTERPRISES',
    'ACC-001,Metal Zipper,ZIPPER,PIECES,35,20,50,DIPANSHI ENTERPRISES',
  ].join('\n');
}
