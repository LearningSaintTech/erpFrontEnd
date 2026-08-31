import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './app/providers/AuthProvider';
import { ProtectedRoute } from './app/ProtectedRoute';
import { PermissionRoute } from './app/PermissionRoute';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { DesignsPage } from './features/design/DesignsPage';
import { DesignFormPage } from './features/design/DesignFormPage';
import { SamplesPage } from './features/sampling/SamplesPage';
import { PatternPage } from './features/pattern/PatternPage';
import { SkusPage } from './features/sku/SkusPage';
import { BomsPage } from './features/bom/BomsPage';
import { InventoryPage } from './features/inventory/InventoryPage';
import { PurchasePage } from './features/purchase/PurchasePage';
import { VendorsPage } from './features/purchase/VendorsPage';
import { ProductionPage } from './features/production/ProductionPage';
import { MachinesPage } from './features/production/MachinesPage';
import { WarehousePage } from './features/warehouse/WarehousePage';
import { QualityPage } from './features/quality/QualityPage';
import { CapaPage } from './features/quality/CapaPage';
import { QualityTemplatesPage } from './features/quality/QualityTemplatesPage';
import { NotificationsPage } from './features/notifications/NotificationsPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { ApprovalsPage } from './features/approvals/ApprovalsPage';
import { WastePage } from './features/waste/WastePage';
import { UsersPage } from './features/users/UsersPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { InventoryCodesPage } from './features/settings/InventoryCodesPage';
import { AuditPage } from './features/audit/AuditPage';
import { AdminPage } from './features/admin/AdminPage';
import { ChatPage } from './features/chat/ChatPage';
import { ChatProvider } from './app/providers/ChatProvider';
import { NotificationProvider } from './app/providers/NotificationProvider';
import { ChatGlobalUi } from './components/chat/ChatGlobalUi';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function P({ perm, anyOf, superAdminOnly, children }: {
  perm?: string;
  anyOf?: string[];
  superAdminOnly?: boolean;
  children: ReactNode;
}) {
  return (
    <PermissionRoute perm={perm} anyOf={anyOf} superAdminOnly={superAdminOnly}>
      {children}
    </PermissionRoute>
  );
}

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <ChatProvider>
          <NotificationProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<DashboardPage />} />

              <Route path="/admin" element={<Navigate to="/admin/organizations" replace />} />
              <Route path="/admin/organizations" element={<P superAdminOnly perm="organization.read"><AdminPage /></P>} />
              <Route path="/audit" element={<P perm="audit.read"><AuditPage /></P>} />

              <Route path="/factory" element={<Navigate to="/users" replace />} />
              <Route path="/factory/users" element={<P perm="user.read"><UsersPage /></P>} />
              <Route path="/users" element={<P perm="user.read"><UsersPage /></P>} />
              <Route path="/settings" element={<Navigate to="/settings/general" replace />} />
              <Route path="/settings/inventory-codes" element={<P perm="inventory.configure"><InventoryCodesPage /></P>} />
              <Route path="/settings/:section" element={<P anyOf={['settings.configure', 'factory.configure']}><SettingsPage /></P>} />
              <Route path="/approvals" element={<P perm="approval.read"><ApprovalsPage /></P>} />

              <Route path="/design" element={<Navigate to="/designs" replace />} />
              <Route path="/designs" element={<P perm="design.read"><DesignsPage /></P>} />
              <Route path="/designs/new" element={<P perm="design.create"><DesignFormPage /></P>} />
              <Route path="/designs/:id/edit" element={<P anyOf={['design.read', 'design.update']}><DesignFormPage /></P>} />

              <Route path="/sampling" element={<Navigate to="/samples" replace />} />
              <Route path="/samples" element={<P perm="sampling.read"><SamplesPage /></P>} />
              <Route path="/pattern" element={<P perm="pattern.read"><PatternPage /></P>} />

              <Route path="/products" element={<Navigate to="/products/skus" replace />} />
              <Route path="/products/skus" element={<P perm="sku.read"><SkusPage /></P>} />
              <Route path="/products/boms" element={<P perm="bom.read"><BomsPage /></P>} />
              <Route path="/skus" element={<Navigate to="/products/skus" replace />} />
              <Route path="/boms" element={<Navigate to="/products/boms" replace />} />

              <Route path="/inventory" element={<P perm="inventory.read"><InventoryPage /></P>} />

              <Route path="/purchase" element={<P perm="purchase.read"><PurchasePage /></P>} />
              <Route path="/vendors" element={<P perm="purchase.read"><VendorsPage /></P>} />

              <Route path="/production" element={<Navigate to="/production/orders" replace />} />
              <Route path="/production/orders" element={<P perm="production.read"><ProductionPage /></P>} />
              <Route path="/production/machines" element={<P perm="production.read"><MachinesPage /></P>} />
              <Route path="/production/schedule" element={<Navigate to="/production/orders" replace />} />
              <Route path="/waste" element={<P perm="waste.read"><WastePage /></P>} />

              <Route path="/warehouse" element={<Navigate to="/warehouse/warehouses" replace />} />
              <Route path="/warehouse/warehouses" element={<P perm="warehouse.read"><WarehousePage section="warehouses" /></P>} />
              <Route path="/warehouse/stock-locator" element={<P perm="warehouse.read"><WarehousePage section="stock-locator" /></P>} />
              <Route path="/warehouse/operations/put-away" element={<P perm="warehouse.read"><WarehousePage section="put-away" /></P>} />
              <Route path="/warehouse/operations/picking" element={<P perm="warehouse.read"><WarehousePage section="picking" /></P>} />
              <Route path="/warehouse/operations/transfer" element={<P perm="warehouse.read"><WarehousePage section="transfer" /></P>} />
              <Route path="/warehouse/operations/dispatch" element={<P perm="warehouse.read"><WarehousePage section="dispatch" /></P>} />
              <Route path="/warehouse/cycle-counts" element={<P perm="warehouse.read"><WarehousePage section="cycle-counts" /></P>} />
              <Route path="/warehouses" element={<Navigate to="/warehouse/warehouses" replace />} />

              <Route path="/quality" element={<Navigate to="/quality/inspections" replace />} />
              <Route path="/quality/inspections" element={<P perm="quality.read"><QualityPage /></P>} />
              <Route path="/quality/capa" element={<P perm="quality.read"><CapaPage /></P>} />
              <Route path="/quality/templates" element={<P perm="quality.read"><QualityTemplatesPage /></P>} />

              <Route path="/reports" element={<Navigate to="/reports/factory" replace />} />
              <Route path="/reports/:tab" element={<P perm="report.read"><ReportsPage /></P>} />
              <Route path="/notifications" element={<P perm="notification.read"><NotificationsPage /></P>} />
              <Route path="/chat" element={<P perm="chat.read"><ChatPage /></P>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <ChatGlobalUi />
          </NotificationProvider>
          </ChatProvider>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
