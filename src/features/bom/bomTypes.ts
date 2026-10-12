/** Fields the BOM / SKU / pattern backend returns that the shared API types do not carry yet. */
export {};

declare module '../../types/api' {
  interface Bom {
    rejectionComments?: string;
    revisionComments?: string;
    /** Source pattern was reopened after this BOM was frozen — build and freeze a new version. */
    needsReview?: boolean;
    reviewReason?: string;
    /** Newest version for its SKU (list endpoint only). */
    isLatestVersion?: boolean;
    patternDevelopmentId?: string;
    patternUpdatedAt?: string;
  }

  interface Sku {
    hasActiveBom?: boolean;
  }

  interface DesignBomLine {
    /** Design colour variant this line applies to — blank = every colour. */
    color?: string;
  }

  interface DesignAccessory {
    /** Design colour variant this trim applies to — blank = every colour. */
    variantColor?: string;
  }

  interface Sample {
    rejectionComments?: string;
  }
}

declare module '../../types/api.extended' {
  interface BomLine {
    materialCategory?: string;
    isOptional?: boolean;
  }

  interface BomStats {
    pendingApproval?: number;
    needsReview?: number;
  }

  interface SkuPreviewItem {
    conflict?: string;
  }

  interface SkuPreview {
    conflictCount?: number;
    sizeSource?: 'pattern' | 'design';
  }
}
