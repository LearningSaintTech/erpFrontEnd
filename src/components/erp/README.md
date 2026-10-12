# ERP UI kit — page patterns

Everything is exported from `src/components/erp` (`import { … } from '../../components/erp'`).
Tokens and base styles live in `src/styles/slate-theme.css`. Legacy `Erp*` names still work;
short aliases (`Button`, `Card`, `Input`, `Select`, `PageHeader`, `Tabs`, `StatusBadge`) are for new code.

## Design rules (read first)

- **Type scale** — 12px caption/label (`text-xs`) · 13px table cells & secondary (`text-[13px]`) · 14px body/controls (`text-sm`, the default) · 16px section title (`text-base`) · 20px page title · 24–28px KPI value. Do **not** use 9–11px text.
- **Colour** — neutral surfaces, one accent (`var(--erp-accent)`). Status colour only through tones: `neutral | info | success | warning | danger` (`--erp-{tone}-bg|text|border|solid`). Don't hard-code `amber-500`, `red-600` etc.
- **Controls** — 36px tall (32px with `size="sm"`). Don't override padding/font-size with `!py-1 !text-[11px]`; use `size="sm"` / `inputSize="sm"`.
- **Radii** — 6px controls, 8px cards/menus, 12px modals/drawers. **Shadows** — `shadow-erp-xs` on cards, nothing heavier on page surfaces.
- **Numbers** — right-aligned, tabular: `className="erp-num"` on `<th>` and `<td>`.
- **Copy** — page description = one short plain-language sentence. No `A → B → C` process arrows in headers; put workflow guidance in a `StepFlow` or a dismissible "How it works" `InfoBanner`.
- **Every icon-only button** needs `aria-label` → use `<IconButton aria-label="…">` (gets a tooltip for free).

## Component API summary

| Component | Key props |
|---|---|
| `Button` / `ErpButton` | `variant`: `primary` · `secondary` · `ghost` · `danger` (soft, row-level) · `danger-solid` (dialog confirm) · `link` · legacy `icon`; `size`: `sm`·`md`; `loading`; `icon`; `iconRight`; `block` |
| `IconButton` | **`aria-label` (required)**, `tooltip` (defaults to label, `false` to disable), `size`, `outlined`, `loading` |
| `Badge` | `tone`, `dot` |
| `StatusBadge` / `ErpStatusBadge` | `status` (raw enum) → tone + "Sentence case" label; `label` to override; `tone` to force; `raw` = old uppercase text. Helpers: `statusToTone`, `humanizeStatus`, legacy `statusToVariant` |
| `Field` | `label`, `required`, `hint`, `error`, `htmlFor` — wires `id`/`aria-invalid`/`aria-describedby` into a single child control |
| `ErpInput` / `ErpSelect` / `Textarea` | native props + `invalid`, `inputSize="sm"` |
| `SearchInput` | `value`, `onChange(string)`, `onClear`, `placeholder`, `inputSize`, `wrapperClassName` (Esc clears) |
| `ErpSearchSelect` | unchanged (searchable select) |
| `Modal` | `open`, `onClose`, `title`, `description`, `size` sm·md·lg·xl, `footer`, `closeOnOverlayClick`, `closeOnEsc`, `initialFocusRef`, `flush`, `role` |
| `Drawer` | same as Modal + `size` sm(400)·md(560)·lg(720)·xl(960), `headerExtra`; right side, sticky footer |
| `useConfirm()` | `confirm({ title, message, confirmLabel, cancelLabel, tone: 'danger'\|'primary' }) → Promise<boolean>` |
| `usePrompt()` | `prompt({ title, message, label, placeholder, required=true, minLength, singleLine, confirmLabel, tone }) → Promise<string \| null>` |
| `toast` | `toast.success/error/info/warning(message, { description, duration, action, id })`, `toast.dismiss(id?)` |
| `DropdownMenu` | `items: [{ label, icon, onSelect, danger, disabled, disabledReason, shortcut, hidden } \| { type: 'separator' } \| { type: 'label', label }]`, `trigger` (default "⋯"), `label`, `align` |
| `RowActionsMenu` | `items`, `label` — "⋯" for table rows (stops row click, renders nothing if no visible items) |
| `Tooltip` | `content`, `side`, `delay` |
| `ErpPageHeader` / `PageHeader` | `title`, `description` (legacy `subtitle`), `primaryAction`, `secondaryActions`, `actions` (legacy), `meta`, `breadcrumbs`, `tabs` |
| `ErpTabs` / `Tabs` | `tabs: [{ id, label, count?, disabled? }]`, `active`, `onChange`, `ariaLabel` |
| `StatTile` | `label`, `value`, `icon?`, `hint?`, `delta?: { value, direction: 'up'\|'down'\|'flat', upIsGood? }`, `onClick?`, `active?`, legacy `highlight` |
| `KpiGrid` | `cols` 2·3·4·6 (2 on phones) |
| `FilterBar` | `search`, `filters`, `onClear` (only pass when a filter is active), `actions`, `bordered` |
| `Section` / `ErpCard` | `title`, `description`, `actions`, `flush` (Section) / `padding` (ErpCard) |
| `ErpDataTable` | helpers: `erp-num`, `erp-row-clickable`, `erp-row-selected`, `erp-cell-primary`, `erp-cell-actions` |
| `TablePager` | `page`, `totalPages`, `total`, `onPrev`, `onNext`, **`pageSize`** (→ "21–40 of 135"), `itemLabel` |
| `EmptyState` / `EmptyRow` | `icon`, `title`, `description`, `action` / `colSpan` + same |
| `TableSkeleton` / `Skeleton` | `rows`, `columns`, `asRows` (inside an existing `<tbody>`) |
| `QueryState` | `isLoading`, `isError`, `error`, `onRetry`, `isEmpty`, `emptyMessage`, `emptyDescription`, `emptyIcon`, `emptyAction`, `skeleton` block·table·inline |
| `DescriptionList` | `items: [{ label, value, full?, hidden? }]`, `columns` 1·2·3 |
| `StepFlow` | `steps: [{ id, label, description?, state?, onClick? }]`, `current`, `orientation`, `size` |
| `InfoBanner` | `tone` muted·info·accent·warn·success·danger, `title`, `icon`, `dismissKey` (remembers dismissal), `inset={false}` for page flow, `action` |

Mutation toasts are global (see `src/lib/queryClient.ts`):

```ts
useMutation({ mutationFn, meta: { successMessage: 'Vendor saved' } });     // success toast
useMutation({ mutationFn, meta: { skipErrorToast: true } });                // you show the error yourself
```

Errors from mutations **without** their own `onError` show a toast with the API message automatically.
Mutations that still have the legacy `onError: (e) => setError(e.message)` banner are skipped (no double
messages); when you migrate a page, delete those `onError`/`setError` banners and let the toast handle it
(or set `meta: { errorToast: true }` to force the toast while keeping `onError`).

---

## (a) List page

PageHeader with a primary **New …** button that opens a Drawer — never an inline create form above the list.
FilterBar, table, row click opens the detail drawer, row actions = one contextual button + "⋯" menu.

```tsx
export function VendorsPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const list = useQuery({ queryKey: ['vendors', q, status, page], queryFn: () => vendorApi.list({ q, status, page, limit: 20 }) });
  const rows = list.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Vendors"
        description="Suppliers you buy fabric, trims and services from."
        secondaryActions={<Button variant="secondary" icon={<Download size={16} />}>Export</Button>}
        primaryAction={<Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>New vendor</Button>}
      />

      <KpiGrid cols={4} className="mb-4">…</KpiGrid>

      <Section flush>
        <FilterBar
          search={<SearchInput value={q} onChange={setQ} placeholder="Search vendors…" />}
          filters={(
            <ErpSelect inputSize="sm" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
              <option value="">All statuses</option><option value="ACTIVE">Active</option>
            </ErpSelect>
          )}
          onClear={q || status ? () => { setQ(''); setStatus(''); } : undefined}
        />
        <QueryState
          skeleton="table" isLoading={list.isLoading} isError={list.isError} error={list.error} onRetry={list.refetch}
          isEmpty={!rows.length} emptyMessage="No vendors yet" emptyDescription="Add your first supplier to start raising purchase orders."
          emptyAction={<Button size="sm" onClick={() => setCreating(true)}>New vendor</Button>}
        >
          <ErpDataTable>
            <thead><tr><th>Vendor</th><th>Status</th><th className="erp-num">Lead time (days)</th><th className="erp-cell-actions"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v._id} className={`erp-row-clickable${selectedId === v._id ? ' erp-row-selected' : ''}`} onClick={() => setSelectedId(v._id)}>
                  <td className="erp-cell-primary">{v.name}</td>
                  <td><StatusBadge status={v.status} /></td>
                  <td className="erp-num">{v.leadTimeDays}</td>
                  <td className="erp-cell-actions">
                    <div className="flex items-center justify-end gap-1">
                      {v.status === 'DRAFT' && (
                        <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); activate.mutate(v._id); }}>Activate</Button>
                      )}
                      <RowActionsMenu items={[
                        { label: 'Edit', icon: Pencil, onSelect: () => openEdit(v) },
                        { label: 'Deactivate', icon: Ban, danger: true, hidden: !canEdit, onSelect: () => deactivate(v) },
                      ]} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </ErpDataTable>
          <TablePager page={page} totalPages={list.data?.meta?.totalPages ?? 0} total={list.data?.meta?.total ?? 0}
            pageSize={20} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
        </QueryState>
      </Section>

      <VendorFormDrawer open={creating} onClose={() => setCreating(false)} />
      <VendorDetailDrawer id={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}
```

Rules: buttons inside a clickable row must `e.stopPropagation()` (`DropdownMenu`/`RowActionsMenu` already do).
One visible contextual action per row max; everything else goes in "⋯".

## (b) Drawer form

```tsx
function VendorFormDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', email: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: vendorApi.create,
    meta: { successMessage: 'Vendor created' },          // toast on success; API errors toast automatically
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendors'] }); onClose(); },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Enter the vendor name.';
    if (form.email && !/^\S+@\S+$/.test(form.email)) next.email = 'Enter a valid email address.';
    setErrors(next);
    if (Object.keys(next).length === 0) save.mutate(form);
  };

  return (
    <Drawer
      open={open} onClose={onClose} size="md" closeOnOverlayClick={false}
      title="New vendor" description="Vendors can be used on purchase orders once active."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="vendor-form" loading={save.isPending}>Save vendor</Button>
        </>
      )}
    >
      <form id="vendor-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Name" required error={errors.name}>
          <ErpInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Email" hint="Used for PO emails" error={errors.email}>
          <ErpInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
      </form>
    </Drawer>
  );
}
```

- Validation messages are full sentences that say how to fix it; show them under the field via `error`.
- Two-column forms: `<div className="grid gap-4 sm:grid-cols-2">` of `Field`s. Use `size="lg"`/`"xl"` drawers for line-item editors.
- Detail drawers: `DescriptionList` for facts, `StepFlow` for progress, actions in the footer.

## (c) Destructive & reasoned actions

```tsx
const confirm = useConfirm();
const prompt = usePrompt();

const cancelOrder = async (o: Order) => {
  const ok = await confirm({
    title: `Cancel ${o.number}?`,
    message: 'Reserved material is released. This cannot be undone.',
    confirmLabel: 'Cancel order',
    tone: 'danger',
  });
  if (ok) cancel.mutate(o._id);
};

const reject = async (pr: Pr) => {
  const reason = await prompt({ title: 'Reject requisition', label: 'Reason', minLength: 5, tone: 'danger', confirmLabel: 'Reject' });
  if (reason != null) rejectPr.mutate({ id: pr._id, comments: reason });
};
```

Never use `window.confirm`/`window.prompt` or hand-made `fixed inset-0` overlays — use `Modal`/`Drawer`/`useConfirm`/`usePrompt`.
`useCommentDialog()` (src/hooks) still works for optional comments; prefer `usePrompt({ required: false })`.

## (d) Status & numbers

```tsx
<StatusBadge status={po.status} />                // "Approval pending", info tone
<StatusBadge status="CUSTOM" tone="warning" label="Awaiting fabric" />
<td className="erp-num">{qty.toLocaleString()}</td>
<td className="erp-num">{formatCurrency(amount)}</td>
```

Drop page-local `statusLabel()` uppercase labels — the default label is already human-readable.
Add new statuses to `STATUS_MAP`/`TONE_OVERRIDES` in `ErpStatusBadge.tsx`, not per page.

## (e) Empty / loading / error

```tsx
<QueryState skeleton="table" isLoading={q.isLoading} isError={q.isError} error={q.error} onRetry={q.refetch}
  isEmpty={!rows.length} emptyMessage="No inspections waiting" emptyDescription="Goods receipts appear here once they arrive.">
  …table…
</QueryState>

// inside an existing <tbody>:
{q.isLoading ? <TableSkeleton asRows rows={5} columns={7} /> : rows.length === 0 ? <EmptyRow colSpan={7} title="No orders match these filters" action={<Button size="sm" variant="secondary" onClick={clear}>Clear filters</Button>} /> : rows.map(…)}
```

Empty states say what the list is for and offer the next action. Distinguish "nothing yet" from "nothing matches filters".

## (f) Descriptions and workflow guidance

```tsx
<PageHeader title="Purchase" description="Raise requisitions, pay suppliers and receive goods." />

<InfoBanner inset={false} tone="info" title="How purchasing works" dismissKey="purchase-how-it-works" className="mb-4">
  A requisition is approved by the factory admin, then paid after you agree terms with the supplier. Goods are received against the payment and checked by QC before they enter stock.
</InfoBanner>

<StepFlow current="sample" steps={[
  { id: 'design', label: 'Design', description: 'Approved' },
  { id: 'pattern', label: 'Pattern' },
  { id: 'sample', label: 'Sample', description: 'Fit trial' },
  { id: 'bom', label: 'SKU / BOM' },
  { id: 'production', label: 'Production' },
]} />
```

## (g) KPI row

```tsx
<KpiGrid cols={4} className="mb-4">
  <StatTile icon={ClipboardList} label="Open requisitions" value={stats.prOpen} hint="Awaiting approval"
    onClick={() => setFilter('pr-open')} active={filter === 'pr-open'} />
  <StatTile icon={Wallet} label="Unpaid" value={formatCurrency(stats.unpaid)} highlight={stats.unpaid > 0 ? 'warn' : undefined} />
  …
</KpiGrid>
```

Max 4–6 tiles. Make them clickable only if they filter the list below (and show `active`).

## Shell notes

- The app shell (`components/AppLayout.tsx`) already renders breadcrumbs from the route + nav config
  (`config/panels.ts`), a Ctrl/Cmd+K command palette, the factory switcher and the account menu.
  Pages should not render another app title bar.
- Content padding is 24px desktop / 16px mobile. Tables placed directly inside `.erp-card`/`Section flush`
  scroll horizontally inside the card. Use `erp-form-width` (max 960px) for standalone form pages.
- Overlay z-index scale: overlays `--erp-z-overlay` (10500) < menus/selects `--erp-z-popover` (11000) < toasts < tooltips.
