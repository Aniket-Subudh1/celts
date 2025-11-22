"use client";

import { useState, useEffect } from "react";
import { Lock, Loader2 } from "lucide-react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { navItems } from "@/components/admin/NavItems";
import api from "@/lib/api";

const staticPermissions = [
  {
    name: "View Dashboard",
    key: "view_dashboard",
    admin: true,
    faculty: true,
    student: true,
  },
  {
    name: "Manage Users",
    key: "manage_users",
    admin: true,
    faculty: false,
    student: false,
  },
  {
    name: "Create Tests",
    key: "create_tests",
    admin: false,
    faculty: true,
    student: false,
  },
  {
    name: "View Results",
    key: "view_results",
    admin: true,
    faculty: true,
    student: true,
  },
  {
    name: "View Analytics",
    key: "view_analytics",
    admin: true,
    faculty: true,
    student: false,
  },
];

interface FacultyUser {
  _id: string;
  name: string;
  email: string;
  systemId?: string;
  facultyPermissions?: {
    canEditScores?: boolean;
  };
}

export default function PermissionsPage() {
  const [userName, setUserName] = useState<string>("");
  const [facultyList, setFacultyList] = useState<FacultyUser[]>([]);
  const [loadingFaculty, setLoadingFaculty] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("celts_user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUserName(parsed.name || "");
      } catch (err) {
        console.error("Error parsing user from storage:", err);
      }
    }
  }, []);

  async function fetchFaculty() {
    setLoadingFaculty(true);
    setError(null);
    try {
      const res = await api.apiGet("/admin/users?role=faculty");
      if (!res.ok) {
        setError(res.error?.message || "Failed to load faculty list");
        setFacultyList([]);
        setLoadingFaculty(false);
        return;
      }
      const data: FacultyUser[] = res.data ?? [];
      setFacultyList(data);
    } catch (err: any) {
      console.error("[PermissionsPage] fetchFaculty error:", err);
      setError(err?.message || "Network error");
      setFacultyList([]);
    } finally {
      setLoadingFaculty(false);
    }
  }

  useEffect(() => {
    fetchFaculty();
  }, []);

  async function handleToggleEditScores(
    facultyId: string,
    nextValue: boolean
  ) {
    try {
      setSavingId(facultyId);
      setError(null);

      const res = await api.apiPatch(
        `/admin/faculty/${facultyId}/permissions`,
        { canEditScores: nextValue }
      );

      if (!res.ok) {
        setError(res.error?.message || "Failed to update permission");
        return;
      }

      // Update local state
      setFacultyList((prev) =>
        prev.map((f) =>
          f._id === facultyId
            ? {
                ...f,
                facultyPermissions: {
                  ...(f.facultyPermissions || {}),
                  canEditScores: nextValue,
                },
              }
            : f
        )
      );
    } catch (err: any) {
      console.error("[PermissionsPage] toggle error:", err);
      setError(err?.message || "Network error while updating permission");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <DashboardLayout
      navItems={navItems}
      sidebarHeader="CELTS Admin"
      userName={userName}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-medium text-slate-900">
              Role permissions
            </h1>
            <p className="mt-1 text-sm text-slate-500 max-w-xl">
              Default capabilities per role and the per-faculty toggle to allow
              editing of student band scores. Changes are applied immediately.
            </p>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={fetchFaculty}
              disabled={loadingFaculty}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 shadow-sm hover:shadow"
            >
              {loadingFaculty ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Refreshing
                </>
              ) : (
                "Refresh"
              )}
            </button>
          </div>
        </div>

        {/* Permission matrix - documentation style */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                Role capability matrix
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                What each role may or may not do in the system.
              </p>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto rounded-md border border-slate-100">
            <table className="w-full min-w-[640px] table-auto">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">
                    Permission
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-600">
                    Admin
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-600">
                    Faculty
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-600">
                    Student
                  </th>
                </tr>
              </thead>
              <tbody>
                {staticPermissions.map((perm, idx) => (
                  <tr
                    key={perm.key}
                    className={
                      idx % 2 === 0 ? "bg-white" : "bg-slate-50"
                    }
                  >
                    <td className="px-4 py-3 text-sm text-slate-800 font-medium">
                      {perm.name}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Checkbox checked={perm.admin} disabled />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Checkbox checked={perm.faculty} disabled />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Checkbox checked={perm.student} disabled />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 rounded-md bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-slate-500" />
              <div>
                <p className="text-sm font-medium text-slate-800">
                  Permission notes
                </p>
                <p className="text-sm text-slate-500 mt-1"> Admin: Admins have system-wide access. </p>
                <p className="text-sm text-slate-500 mt-1">Faculty: Faculty can create and modify test grades; enabling the toggle below allows them to also edit
                  student band scores when granted.</p>
                <p className="text-sm text-slate-500 mt-1">Student: Student can only View the test assigned to them , attempt it and then see the scores.</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Faculty permissions (interactive) */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-slate-800">
                Faculty score editing
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Toggle per-faculty permission to allow manual editing of band
                scores.
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-5 overflow-x-auto rounded-md border border-slate-100">
            <table className="w-full min-w-[720px]">
              <thead className="bg-white sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">
                    Faculty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">
                    Employee ID
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500">
                    Can edit band scores
                  </th>
                </tr>
              </thead>

              <tbody>
                {facultyList.length === 0 && !loadingFaculty ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-sm text-slate-500"
                    >
                      No faculty users found.
                    </td>
                  </tr>
                ) : null}

                {facultyList.map((fac, idx) => {
                  const canEdit =
                    fac.facultyPermissions?.canEditScores === true;
                  const isSaving = savingId === fac._id;
                  return (
                    <tr
                      key={fac._id}
                      className={
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50"
                      }
                    >
                      <td className="px-4 py-4 align-top">
                        <div className="text-sm font-medium text-slate-800">
                          {fac.name || "Unnamed Faculty"}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="text-sm text-slate-600">{fac.email}</div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="text-sm text-slate-600">
                          {fac.systemId || "-"}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top text-center">
                        <div className="inline-flex items-center gap-3">
                          <Checkbox
                            checked={canEdit}
                            disabled={isSaving}
                            onCheckedChange={(val) =>
                              handleToggleEditScores(fac._id, Boolean(val))
                            }
                          />
                          {isSaving && (
                            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {loadingFaculty && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center">
                      <div className="inline-flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading faculty...
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
