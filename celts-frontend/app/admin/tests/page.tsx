// app/admin/tests/page.tsx
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { navItems } from '@/components/admin/NavItems';
import { ViewAdminTest } from '@/components/admin/ViewAdminTest';

async function getTests() {
  try {
    const res = await fetch('/api/admin/testsets', {
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error('Fetch tests failed:', res.status);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error('Fetch tests error:', err);
    return null;
  }
}

async function getBatches() {
  try {
    const res = await fetch('/admin/batches', {
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error('Fetch batches failed:', res.status);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error('Fetch batches error:', err);
    return null;
  }
}

export default async function AdminTestsPage() {
  const [testsRes, batchesRes] = await Promise.all([
    getTests(),
    getBatches(),
  ]);

  // 🔹 Normalize responses safely
  const tests =
    Array.isArray(testsRes)
      ? testsRes
      : testsRes?.data || testsRes?.tests || [];

  const batches =
    Array.isArray(batchesRes)
      ? batchesRes
      : batchesRes?.data || batchesRes?.batches || [];

  return (
    <DashboardLayout navItems={navItems} sidebarHeader="CELTS Admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin Tests</h1>
            <p className="text-muted-foreground">
              Create and manage your tests
            </p>
          </div>

          <a
            href="/admin/tests/create"
            className="px-4 py-2 bg-black text-white rounded"
          >
            + Create Test
          </a>
        </div>

        {/* Tests Table */}
        <ViewAdminTest tests={tests} batches={batches} />
      </div>
    </DashboardLayout>
  );
}
