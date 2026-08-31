import { createContext, useContext, ReactNode } from 'react';
import type { Design, DesignAsset, DesignLookups, DesignVersion, Sample } from '../../types/api';
import type { DesignFormState } from './designFormUtils';

export interface MaterialOption {
  _id: string;
  materialCode: string;
  name: string;
  unit: string;
  category?: string;
}

export interface PendingUpload {
  file: File;
  assetType: string;
  preview: string;
}

export interface DesignFormContextValue {
  form: DesignFormState;
  setForm: React.Dispatch<React.SetStateAction<DesignFormState>>;
  editable: boolean;
  design?: Design;
  designId?: string;
  materials: MaterialOption[];
  lookups?: DesignLookups;
  collections: { _id: string; name: string }[];
  seasons: { _id: string; name: string; year: number }[];
  assets: DesignAsset[];
  setAssets: React.Dispatch<React.SetStateAction<DesignAsset[]>>;
  pendingUploads: PendingUpload[];
  setPendingUploads: React.Dispatch<React.SetStateAction<PendingUpload[]>>;
  versions: DesignVersion[];
  samples: Sample[];
  onDeleteAsset: (assetId: string) => void;
}

const DesignFormContext = createContext<DesignFormContextValue | null>(null);

export function DesignFormProvider({ value, children }: { value: DesignFormContextValue; children: ReactNode }) {
  return <DesignFormContext.Provider value={value}>{children}</DesignFormContext.Provider>;
}

export function useDesignForm() {
  const ctx = useContext(DesignFormContext);
  if (!ctx) throw new Error('useDesignForm must be used within DesignFormProvider');
  return ctx;
}
