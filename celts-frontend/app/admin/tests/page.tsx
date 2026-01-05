// app/admin/tests/page.tsx
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { navItems } from '@/components/admin/NavItems';
import { ViewAdminTest } from '@/components/admin/ViewAdminTest';

export default function AdminTestsPage() {
  return (
    <DashboardLayout navItems={navItems} sidebarHeader="CELTS Admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin Tests</h1>
            <p className="text-muted-foreground">
              Create and manage your tests
            </p>
          </div>


          <div className="flex items-center gap-3">
            <a
              href="/admin/tests/scoreCard"
              className="px-4 py-2 bg-black text-white rounded"
            >
              + View Score
            </a>

            <a
              href="/admin/tests/create"
              className="px-4 py-2 bg-black text-white rounded"
            >
              + Create Test
            </a>
          </div>
        </div>

        <ViewAdminTest />
      </div>
    </DashboardLayout>
  );
}
