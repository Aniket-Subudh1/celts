import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { navItems } from '@/components/admin/NavItems';
import { CreateAdminTest } from '@/components/admin/CreateAdminTest';
export default async function CreateAdminTestPage() {
    
  return (
    <DashboardLayout navItems={navItems} sidebarHeader="CELTS Admin" userName= "Admin" >
      <div className="space-y-4">
        {/* Back Button */}
        <Link
          href="/admin/tests"
          className="text-sm text-slate-600 hover:text-slate-900 inline-flex items-center gap-2"
        >
          ← Back to Tests
        </Link>

        {/* Create Test Form */}
        <CreateAdminTest />
      </div>
    </DashboardLayout>
  );
}
