export const SECRET_MASK = '••••••••';

export const WORKING_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const TIMEZONE_OPTIONS = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Europe/London',
  'America/New_York',
  'UTC',
];

export const CURRENCY_OPTIONS = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];

export const DATE_FORMAT_OPTIONS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];

export const UOM_OPTIONS = ['PIECES', 'METERS', 'KILOGRAMS', 'SETS', 'ROLLS'];

export const NUMBERING_PREFIX_FIELDS = [
  { key: 'design', label: 'Design' },
  { key: 'sku', label: 'SKU' },
  { key: 'purchaseOrder', label: 'Purchase order' },
  { key: 'productionOrder', label: 'Production order' },
  { key: 'batch', label: 'Batch' },
  { key: 'sample', label: 'Sample' },
] as const;

export const DEFAULT_PRODUCTION_STAGES = [
  'CUTTING', 'PRINTING', 'EMBROIDERY', 'STITCHING', 'WASHING', 'IRONING', 'FINISHING',
];
