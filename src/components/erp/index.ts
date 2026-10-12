/**
 * ERP UI kit — see ./README.md for page patterns.
 * Legacy Erp* names are kept; short aliases (Button, Card, Input…) are for new code.
 */

// Primitives
export { ErpButton, Button, IconButton, Spinner } from './ErpButton';
export type { ErpButtonProps, ErpButtonVariant, ErpButtonSize, IconButtonProps } from './ErpButton';
export { ErpCard, Card } from './ErpCard';
export { ErpDataTable } from './ErpDataTable';
export { ErpInput, Input } from './ErpInput';
export type { ErpInputProps } from './ErpInput';
export { ErpSelect, Select } from './ErpSelect';
export type { ErpSelectProps } from './ErpSelect';
export { ErpSearchSelect } from './ErpSearchSelect';
export type { ErpSearchOption } from './ErpSearchSelect';
export { Field, Textarea, ErpTextarea, SearchInput } from './Field';
export type { FieldProps, TextareaProps, SearchInputProps } from './Field';
export { Tooltip } from './Tooltip';

// Status
export {
  ErpStatusBadge, StatusBadge, Badge, statusToVariant, statusToTone, humanizeStatus,
} from './ErpStatusBadge';
export type { ErpTone, ErpStatusVariant, BadgeProps } from './ErpStatusBadge';

// Page structure
export { ErpPageHeader, PageHeader, Breadcrumbs } from './ErpPageHeader';
export type { Crumb } from './ErpPageHeader';
export { ErpTabs, Tabs } from './ErpTabs';
export type { ErpTab } from './ErpTabs';
export {
  ActionStack, ComposeSection, EmptyRow, FilterBar, InfoBanner, Section, StatTile, TabShell, TabToolbar,
  TablePager, TextLink, btnSm, fieldLabel,
} from './erpLayout';
export type { StatTileProps } from './erpLayout';
export {
  DescriptionList, EmptyState, KpiGrid, Skeleton, StepFlow, TableSkeleton,
} from './DataDisplay';
export type { DescriptionItem, EmptyStateProps, Step, StepState } from './DataDisplay';

// Overlays & feedback
export { Modal, Drawer, useOverlayBehavior } from './Overlay';
export type { ModalProps, DrawerProps, ModalSize, DrawerSize } from './Overlay';
export { DropdownMenu, RowActionsMenu } from './DropdownMenu';
export type { DropdownMenuItem, DropdownMenuProps } from './DropdownMenu';
export { ConfirmProvider, useConfirm, usePrompt } from './ConfirmDialog';
export type { ConfirmOptions, PromptOptions } from './ConfirmDialog';
export { ToastProvider, toast } from './Toast';
export type { ToastOptions, ToastType } from './Toast';
