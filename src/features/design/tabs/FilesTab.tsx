import { useDesignForm } from '../DesignFormContext';
import { FILE_SLOTS } from '../designFormUtils';

export function FilesTab() {
  const { assets, pendingUploads, setPendingUploads, editable, onDeleteAsset } = useDesignForm();

  const assetForSlot = (type: string) =>
    assets.find((a) => a.assetType === type || (type === 'FRONT_IMAGE' && a.assetType === 'IMAGE') || (type === 'TECHNICAL_SKETCH' && a.assetType === 'SKETCH'));

  const pendingForSlot = (type: string) => pendingUploads.find((p) => p.assetType === type);

  const onSelect = (type: string, files: FileList | null) => {
    if (!files?.[0]) return;
    const file = files[0];
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
    setPendingUploads((prev) => [...prev.filter((p) => p.assetType !== type), { file, assetType: type, preview }]);
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-erp-text-muted">
        At least a front image or technical sketch is required before submit. Other views help pattern and sampling.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FILE_SLOTS.map((slot) => {
        const existing = assetForSlot(slot.type);
        const pending = pendingForSlot(slot.type);
        const url = pending?.preview || existing?.url;
        const isImage = url && (existing?.mimeType?.startsWith('image/') || url.startsWith('data:image') || pending?.preview);

        return (
          <div key={slot.type} className="rounded border p-3">
            <p className="mb-0.5 text-sm font-medium">{slot.label}</p>
            {slot.hint && <p className="mb-2 text-[10px] text-erp-text-muted">{slot.hint}</p>}
            {url ? (
              <div className="relative mb-2">
                {isImage ? (
                  <img src={url} alt={slot.label} className="h-32 w-full rounded object-cover" />
                ) : (
                  <div className="flex h-32 items-center justify-center rounded bg-transparent text-xs text-erp-text-muted">
                    {pending?.file.name || existing?.fileName}
                  </div>
                )}
                {editable && existing && (
                  <button type="button" onClick={() => onDeleteAsset(existing._id)} className="erp-icon-btn absolute right-1 top-1 px-1 text-xs text-red-600">×</button>
                )}
                {editable && pending && (
                  <button type="button" onClick={() => setPendingUploads((p) => p.filter((x) => x.assetType !== slot.type))} className="erp-icon-btn absolute right-1 top-1 px-1 text-xs text-red-600">×</button>
                )}
              </div>
            ) : (
              <div className="mb-2 flex h-32 items-center justify-center rounded border-dashed border bg-transparent text-xs text-erp-text-muted">No file</div>
            )}
            {editable && (
              <label className="cursor-pointer text-xs text-[var(--erp-accent)] hover:underline">
                Upload
                <input type="file" accept={slot.accept} className="hidden" onChange={(e) => onSelect(slot.type, e.target.files)} />
              </label>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
