import type { InventoryCodeType } from '../../types/api';

export const CODE_TYPES: { value: InventoryCodeType; label: string; hint: string; group: string }[] = [
  { value: 'CATEGORY', label: 'Category', hint: 'Product type in SKU (e.g. TW-SH Shirt)', group: 'Product' },
  { value: 'SUB_CATEGORY', label: 'Sub category', hint: 'Finer cut under category', group: 'Product' },
  { value: 'SECTION', label: 'Section', hint: 'Merch section (e.g. TW, BW, AC)', group: 'Product' },
  { value: 'FIT', label: 'Fit', hint: 'Fit code for SKU (e.g. SF Slim Fit)', group: 'Product' },
  { value: 'COLOR', label: 'Colour', hint: 'Colour variant codes (e.g. BLK Black)', group: 'Product' },
  { value: 'SIZE', label: 'Size', hint: 'Size labels offered on a style (XS–XXL)', group: 'Product' },
  { value: 'COLLECTION', label: 'Collection', hint: 'Design collection (e.g. SS26, Holiday)', group: 'Product' },
  { value: 'SEASON', label: 'Season', hint: 'Season name (e.g. Summer 2026)', group: 'Product' },
  { value: 'GENDER', label: 'Gender', hint: 'MEN / WOMEN / UNISEX — used in SKU style-gender', group: 'Classification' },
  { value: 'AGE_GROUP', label: 'Age group', hint: 'Infant, kids, adult, …', group: 'Classification' },
  { value: 'SLEEVE', label: 'Sleeve', hint: 'Sleeve type (full, half, sleeveless)', group: 'Classification' },
  { value: 'NECK', label: 'Neck', hint: 'Neck / collar type', group: 'Classification' },
  { value: 'PATTERN', label: 'Pattern', hint: 'Print or weave pattern', group: 'Classification' },
  { value: 'OCCASION', label: 'Occasion', hint: 'Casual, festive, workwear, …', group: 'Classification' },
  { value: 'MATERIAL', label: 'Material', hint: 'Fabric / composition for product specs', group: 'Specs' },
  { value: 'PRINTING_TYPE', label: 'Printing type', hint: 'Screen, digital, embroidery, …', group: 'Specs' },
  { value: 'TAG', label: 'Tag', hint: 'Design tags (Summer, Export, Eco, …)', group: 'Specs' },
  { value: 'CURRENCY', label: 'Currency', hint: 'INR, USD, …', group: 'Specs' },
  { value: 'UNIT', label: 'Unit', hint: 'cm, m, pc, kg — used on pattern consumption and BOM', group: 'Pattern' },
  { value: 'ACCESSORY', label: 'Accessory / trim', hint: 'Button, zipper, label, thread, …', group: 'Pattern' },
  { value: 'FABRIC_FINISH', label: 'Fabric finish', hint: 'Bio wash, enzyme, peach, mercerized', group: 'Pattern' },
  { value: 'MATERIAL_GROUP', label: 'Material group', hint: 'BOM line class: fabric, trim, packing', group: 'Pattern' },
  { value: 'MEASUREMENT', label: 'Measurement', hint: 'Chest, length, sleeve — size-chart rows', group: 'Pattern' },
  { value: 'STITCH', label: 'Stitch', hint: 'Single needle, overlock, coverstitch', group: 'Pattern' },
  { value: 'NEEDLE', label: 'Needle', hint: 'Needle size / type for sewing', group: 'Pattern' },
  { value: 'MACHINE', label: 'Machine', hint: 'Lockstitch, overlock, flatlock, …', group: 'Pattern' },
];

export const CODE_TYPE_GROUPS = [...new Set(CODE_TYPES.map((t) => t.group))];

export type InventoryCodeTypeValue = (typeof CODE_TYPES)[number]['value'];

export const DEFAULT_SKU_FORMULA = {
  name: 'Standard SKU (ops sheet)',
  skuSegmentOrder: [
    { key: 'styleGender', optional: false },
    { key: 'productType', optional: false },
    { key: 'fitType', optional: false },
    { key: 'colour', optional: false },
    { key: 'size', optional: false },
    { key: 'skuUid', optional: true },
  ],
};

export function codeTypeLabel(type: string) {
  return CODE_TYPES.find((t) => t.value === type)?.label || type;
}

export function codeTypeNoun(type: string) {
  return codeTypeLabel(type).toLowerCase();
}
