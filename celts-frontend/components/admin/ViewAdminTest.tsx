'use client';

import { useState } from 'react';

type Batch = {
  _id: string;
  name: string;
  year?: string;
  section?: string;
};

type TestSet = {
  _id: string;
  title: string;
  type: string;
  published: boolean;
  createdByRole: 'admin' | 'faculty';
  assignedBatches: Batch[];
};

type Props = {
  tests: TestSet[];
  batches: Batch[];
};

export function ViewAdminTest({ tests, batches }: Props) {
  const [selectedTest, setSelectedTest] = useState<TestSet | null>(null);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  /* ------------------------------
     EMPTY STATE (IMPORTANT)
  -------------------------------- */
  if (!tests || tests.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-slate-500">
        <p className="text-lg font-medium">No tests found</p>
        <p className="text-sm mt-1">
          Click <strong>“Create Test”</strong> to add your first test.
        </p>
      </div>
    );
  }

  /* ------------------------------
     Assign batches
  -------------------------------- */
  const openAssignModal = (test: TestSet) => {
    setSelectedTest(test);
    setSelectedBatchIds(test.assignedBatches.map(b => b._id));
    setAssignOpen(true);
  };

  const toggleBatch = (id: string) => {
    setSelectedBatchIds(prev =>
      prev.includes(id)
        ? prev.filter(b => b !== id)
        : [...prev, id]
    );
  };

  const submitAssign = async () => {
    if (!selectedTest) return;

    try {
      setLoading(true);

      const res = await fetch(
        `/api/admin/testSets/${selectedTest._id}/assign-batches`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batchIds: selectedBatchIds }),
        }
      );

      if (!res.ok) throw new Error('Assign failed');

      window.location.reload();
    } catch {
      alert('Failed to assign batches');
    } finally {
      setLoading(false);
      setAssignOpen(false);
    }
  };

  /* ------------------------------
     Delete
  -------------------------------- */
  const deleteTest = async (id: string) => {
    if (!confirm('Delete this test?')) return;

    try {
      const res = await fetch(`/api/admin/testSets/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Delete failed');

      window.location.reload();
    } catch {
      alert('Delete failed');
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border">
        <thead className="bg-gray-100 text-left">
          <tr>
            <th className="p-3">Title</th>
            <th className="p-3">Type</th>
            <th className="p-3">Creator</th>
            <th className="p-3">Batches</th>
            <th className="p-3">Status</th>
            <th className="p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tests.map(test => (
            <tr key={test._id} className="border-t">
              <td className="p-3">{test.title}</td>
              <td className="p-3 capitalize">{test.type}</td>
              <td className="p-3 capitalize">{test.createdByRole}</td>
              <td className="p-3">{test.assignedBatches.length}</td>
              <td className="p-3">
                {test.published ? (
                  <span className="text-green-600">Published</span>
                ) : (
                  <span className="text-yellow-600">Draft</span>
                )}
              </td>
              <td className="p-3 space-x-2">
                <button
                  onClick={() => openAssignModal(test)}
                  className="px-3 py-1 border rounded"
                >
                  Assign
                </button>

                <button
                  onClick={() => deleteTest(test._id)}
                  className="px-3 py-1 border rounded text-red-600"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* -------- ASSIGN MODAL -------- */}
      {assignOpen && selectedTest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded w-[420px]">
            <h2 className="text-lg font-semibold mb-4">
              Assign Batches – {selectedTest.title}
            </h2>

            <div className="max-h-64 overflow-y-auto border p-3 space-y-2">
              {batches.map(batch => (
                <label key={batch._id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedBatchIds.includes(batch._id)}
                    onChange={() => toggleBatch(batch._id)}
                  />
                  <span>
                    {batch.name} {batch.section && `(${batch.section})`}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setAssignOpen(false)}
                className="px-4 py-1 border rounded"
              >
                Cancel
              </button>
              <button
                disabled={loading}
                onClick={submitAssign}
                className="px-4 py-1 bg-black text-white rounded"
              >
                {loading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
