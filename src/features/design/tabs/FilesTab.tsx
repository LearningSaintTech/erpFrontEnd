import { useRef } from 'react';
import { ImagePlus, Trash2, Upload } from 'lucide-react';
import { useDesignForm } from '../DesignFormContext';
import { FILE_SLOTS } from '../designFormUtils';
import { Badge, Button, IconButton, useConfirm } from '../../../components/erp';
import { PreviewableImage } from '../../../components/ImagePreview';
import { DesignFormSection } from '../components/DesignFormSection';

function Slot({ slot }: { slot: (typeof FILE_SLOTS)[number] }) {
  const {
    assets, pendingUploads, setPendingUploads, editable, onDeleteAsset,
  } = useDesignForm();
  const confirm = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);

  const existing = assets.find((a) => a.assetType === slot.type
    || (slot.type === 'FRONT_IMAGE' && a.assetType === 'IMAGE')
    || (slot.type === 'TECHNICAL_SKETCH' && a.assetType === 'SKETCH'));
  const pending = pendingUploads.find((p) => p.assetType === slot.type);
  const url = pending?.preview || existing?.url;
  const isImage = !!url && (!!pending?.preview || existing?.mimeType?.startsWith('image/') || url.startsWith('data:image'));
  const required = slot.type === 'FRONT_IMAGE';

  const onSelect = (files: FileList | null) => {
    if (!files?.[0]) return;
    const file = files[0];
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
    setPendingUploads((prev) => [...prev.filter((p) => p.assetType !== slot.type), { file, assetType: slot.type, preview }]);
  };

  const remove = async () => {
    if (pending) {
      setPendingUploads((p) => p.filter((x) => x.assetType !== slot.type));
      return;
    }
    if (!existing) return;
    const ok = await confirm({
      title: `Remove ${slot.label.toLowerCase()} image?`,
      message: 'The file is deleted from this design straight away.',
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (ok) onDeleteAsset(existing._id);
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface)]">
      <div className="relative flex aspect-[4/3] items-center justify-center bg-[var(--erp-surface-muted)]">
        {url ? (
          isImage ? (
            <PreviewableImage src={url} alt={slot.label} className="h-full w-full object-contain" />
          ) : (
            <span className="px-3 text-center text-xs text-erp-text-muted">{pending?.file.name || existing?.fileName}</span>
          )
        ) : editable ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-erp-text-muted transition hover:bg-[var(--erp-surface)] hover:text-[var(--erp-accent)]"
          >
            <ImagePlus size={28} strokeWidth={1.5} />
            <span className="text-xs font-medium">Upload {slot.label.toLowerCase()}</span>
          </button>
        ) : (
          <span className="text-xs text-erp-text-muted">No file</span>
        )}
        {pending && <span className="absolute left-2 top-2"><Badge tone="info">Not saved yet</Badge></span>}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-[var(--erp-border)] px-3 py-2">
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-sm font-medium text-erp-text-primary">
            <span className="truncate">{slot.label}</span>
            {required && <span className="shrink-0 text-xs font-normal text-erp-text-muted">· required*</span>}
          </p>
          {slot.hint && <p className="truncate text-xs text-erp-text-muted">{slot.hint}</p>}
        </div>
        {editable && (
          <div className="flex shrink-0 items-center gap-1">
            {url && (
              // Icon-only (like Remove) so the slot label keeps its room on narrow cards.
              <IconButton aria-label={`Replace ${slot.label.toLowerCase()} image`} title="Replace" size="sm" onClick={() => inputRef.current?.click()}>
                <Upload size={14} />
              </IconButton>
            )}
            {url && (
              <IconButton aria-label={`Remove ${slot.label.toLowerCase()} image`} size="sm" onClick={remove}>
                <Trash2 size={14} />
              </IconButton>
            )}
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept={slot.accept} className="hidden" onChange={(e) => { onSelect(e.target.files); e.target.value = ''; }} />
    </div>
  );
}

export function FilesTab() {
  return (
    <DesignFormSection
      title="Images"
      hint="*A front image or a technical sketch is required before you submit. Other views help pattern and sampling."
      columns={1}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {FILE_SLOTS.map((slot) => <Slot key={slot.type} slot={slot} />)}
      </div>
    </DesignFormSection>
  );
}
