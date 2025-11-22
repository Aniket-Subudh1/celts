"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Lock } from "lucide-react";
import api from "@/lib/api";

interface User {
  id: string;
  name: string;
  email: string;
  systemId: string;
  role: "admin" | "faculty" | "student";
  status: "active" | "inactive";
  joinDate: string;
}

function normalizeStatus(s: any): "active" | "inactive" {
  return s === "inactive" ? "inactive" : "active";
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [adminSearch, setAdminSearch] = useState("");
  const [facultySearch, setFacultySearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<User>>({});

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newSystemId, setNewSystemId] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "faculty" | "student"> ( "student" );
  const [newIdValue, setNewIdValue] = useState("");
  const [newCanEditScores, setNewCanEditScores] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addMessage, setAddMessage] = useState<string | null>(null);

  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await api.apiGet("/admin/users");
      if (res.ok && Array.isArray(res.data)) {
        const data: User[] = res.data.map((u: any) => ({
          id: u._id || u.id || String(Math.random()),
          name: u.name || "",
          email: u.email || "",
          systemId: u.systemId || "",
          role: (u.role || "student") as "admin" | "faculty" | "student",
          status: normalizeStatus(
            u.isActive === false ? "inactive" : u.status ?? "active"
          ),
          joinDate: u.createdAt
            ? new Date(u.createdAt).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10),
        }));
        setUsers(data);
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const adminUsers = users.filter(
    (u) =>
      u.role === "admin" &&
      (u.name.toLowerCase().includes(adminSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(adminSearch.toLowerCase()) ||
        u.systemId.toLowerCase().includes(adminSearch.toLowerCase()))
  );

  const facultyUsers = users.filter(
    (u) =>
      u.role === "faculty" &&
      (u.name.toLowerCase().includes(facultySearch.toLowerCase()) ||
        u.email.toLowerCase().includes(facultySearch.toLowerCase()) ||
        u.systemId.toLowerCase().includes(facultySearch.toLowerCase()))
  );

  const studentUsers = users.filter(
    (u) =>
      u.role === "student" &&
      (u.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(studentSearch.toLowerCase())||
        u.systemId.toLowerCase().includes(studentSearch.toLowerCase()))
  );

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setEditFormData({ ...user });
    setIsDialogOpen(true);
  };

  const openPasswordDialog = (user: User) => {
    setPasswordUser(user);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage(null);
    setIsPasswordDialogOpen(true);
  };

  const handleChangePassword = async () => {
    if (!passwordUser) return;

    setPasswordMessage(null);
    if (!newPassword || newPassword.length < 4) {
      setPasswordMessage("Password must be at least 4 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage("Passwords do not match.");
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await api.apiPatch(
        `/admin/users/${passwordUser.id}/password`,
        {
          newPassword,
        }
      );

      setPasswordLoading(false);
      if (!res.ok) {
        setPasswordMessage(res.error?.message || "Failed to update password.");
        return;
      }

      await fetchUsers();

      setPasswordMessage("Password updated successfully.");
      setIsPasswordDialogOpen(false);
    } catch (err: any) {
      console.error("Error updating password:", err);
      setPasswordLoading(false);
      setPasswordMessage("Network error while updating password.");
    }
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    const id = editingUser.id;
    const payload: any = {
      name: editFormData.name,
      email: editFormData.email,
      systemId: editFormData.systemId,
      role: editFormData.role,
    };

    try {
      const res = await api.apiPut(`/admin/users/${id}`, payload);
      if (!res.ok) {
        alert(res.error?.message || "Failed to update user");
        return;
      }
      const updated = res.data?.user || res.data;

      setUsers((prev) =>
        prev.map((u) =>
          u.id === id
            ? {
              id: updated._id || updated.id || id,
              name: updated.name,
              email: updated.email,
              systemId: updated.systemId,
              role: updated.role,
              status: normalizeStatus(
                updated.isActive === false
                  ? "inactive"
                  : updated.status ?? "active"
              ),
              joinDate: updated.createdAt
                ? new Date(updated.createdAt).toISOString().slice(0, 10)
                : u.joinDate,
            }
            : u
        )
      );

      setIsDialogOpen(false);
      setEditingUser(null);
    } catch (err) {
      alert("Network error while updating user");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const ok = confirm(
      "Are you sure you want to delete this user? This action cannot be undone."
    );
    if (!ok) return;

    try {
      const res = await api.apiDelete(`/admin/users/${userId}`);

      if (!res.ok) {
        const serverMessage =
          res.error?.message ||
          (typeof res.error === "string" ? res.error : null) ||
          (res.data && res.data.message) ||
          `Server returned ${res.status || "an unknown status"}`;
        alert(`Failed to delete user: ${serverMessage}`);
        return;
      }

      setUsers((prev) => prev.filter((u) => u.id !== userId));
      alert("User deleted successfully.");
    } catch (err) {
      alert("Network error while deleting user.");
    }
  };

  const openAddDialog = () => {
    setNewName("");
    setNewEmail("");
    setNewIdValue("");
    setNewRole("student");
    setNewCanEditScores(false);
    setAddMessage(null);
    setIsAddOpen(true);
  };

  const handleCreateUser = async () => {
    setAddMessage(null);
    if (!newName || !newEmail || !newIdValue) {
      setAddMessage("Please fill name, email and the ID.");
      return;
    }
    setAddLoading(true);
    try {
      const payload: any = {
        name: newName,
        email: newEmail,
        systemId: newSystemId,
        password: newIdValue,
        role: newRole,
      };
      if (newRole === "faculty") payload.canEditScores = newCanEditScores;

      const res = await api.apiPost("/admin/users", payload);
      setAddLoading(false);
      if (!res.ok) {
        setAddMessage(res.error?.message || "Failed to create user");
        return;
      }

      const created = res.data?.user || res.data || null;
      const newUser: User = {
        id: created?._id || String(Math.random()),
        name: created?.name || newName,
        email: created?.email || newEmail,
        systemId: created?.systemId || newSystemId,
        role: (created?.role || newRole) as any,
        status: normalizeStatus(
          created?.status ??
          (created?.isActive === false ? "inactive" : "active")
        ),
        joinDate: created?.createdAt
          ? new Date(created.createdAt).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10),
      };

      setUsers((prev) => [newUser, ...prev]);
      setIsAddOpen(false);
    } catch (err) {
      setAddLoading(false);
      setAddMessage("Network error while creating user.");
    }
  };

  async function handleBulkFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    setBulkMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkLoading(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) {
        setBulkMessage("CSV seems empty or missing rows.");
        setBulkLoading(false);
        return;
      }

      const headers = lines[0].split(",").map((h) => h.trim());
      const rows = lines.slice(1);
      const arr: any[] = rows.map((r) => {
        const cols = r.split(",");
        const obj: any = {};
        headers.forEach((h, i) => {
          obj[h] = (cols[i] || "").trim();
        });
        return obj;
      });

      const payload: any[] = arr.map((r) => {
        const roleRaw = (r.role || "").toLowerCase();
        const role: "student" | "faculty" =
          roleRaw === "faculty" ? "faculty" : "student";

        const base: any = {
          name: r.name,
          email: r.email,
          systemId: r.systemId || r.system_id || "",
          role,
        };

        let password = r.password || r.pass || r.pwd || "";
        if (!password) {
          if (role === "student") {
            password = r.rollNo || r.roll_no || r.roll || base.systemId;
          } else {
            password =
              r.employeeId || r.employee_id || r.empId || base.systemId;
          }
        }

        base.password = password;

        if (role === "faculty") {
          base.canEditScores =
            String(r.canEditScores || "").toLowerCase().trim() === "true";
        }

        return base;
      });

      const res = await api.apiPost("/admin/bulk/users", payload);
      setBulkLoading(false);
      if (!res.ok) {
        setBulkMessage(res.error?.message || "Bulk upload failed");
        return;
      }

      const appended: User[] = payload.map((p: any) => ({
        id: String(Math.random()),
        name: p.name || "",
        email: p.email || "",
        systemId: p.systemId || "",
        role: (p.role || "student") as any,
        status: normalizeStatus(p.status ?? "active"),
        joinDate: new Date().toISOString().slice(0, 10),
      }));

      setUsers((prev) => [...appended, ...prev]);
      setBulkMessage(
        `Bulk upload successful (${payload.length} records).`
      );
    } catch (err) {
      setBulkLoading(false);
      setBulkMessage("Failed to read or parse file.");
    }
  }

  const renderTable = (title: string, list: User[], search: string, setSearch: any) => (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center px-6 py-3 border-b bg-muted">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Input
          placeholder={`Search ${title.toLowerCase()}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted">
            <tr className="border-b border-border">
              <th className="px-6 py-3 text-left text-sm font-semibold">Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Email</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">System ID</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Role</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Join Date</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loadingUsers ? (
              <tr>
                <td colSpan={6} className="p-6 text-center">
                  Loading...
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">
                  No data found.
                </td>
              </tr>
            ) : (
              list.map((user) => (
                <tr key={user.id} className="border-b hover:bg-muted/30">
                  <td className="px-6 py-4 text-sm">{user.name}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{user.email}</td>
                  <td className="px-6 py-4 text-sm">{user.systemId}</td>
                  <td className="px-6 py-4 text-sm capitalize">{user.role}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{user.joinDate}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(user)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openPasswordDialog(user)}>
                        <Lock className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(user.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">

        {/* Add User Dialog */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={openAddDialog}>
              <Plus className="w-4 h-4" /> Add User
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new user account
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm block mb-1">Full Name</label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>

              <div>
                <label className="text-sm block mb-1">Email Address</label>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              </div>

              <div>
                <label className="text-sm block mb-1">Enter Id</label>
                <Input value={newSystemId} onChange={(e) => setNewSystemId(e.target.value)} />
              </div>

              <div>
                <label className="text-sm block mb-1">Select Role</label>
                <select
                  value={newRole}
                  onChange={(e) =>
                    setNewRole(e.target.value as "admin" | "faculty" | "student")
                  }
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="admin">Admin</option>
                  <option value="faculty">Faculty</option>
                  <option value="student">Student</option>
                </select>
              </div>

              <div>
                <label className="text-sm block mb-1">
                  {newRole === "faculty"
                    ? "Password"
                    : "Student Roll Number Can be Password"}
                </label>
                <Input value={newIdValue} onChange={(e) => setNewIdValue(e.target.value)} />
              </div>

              {newRole === "faculty" && (
                <div className="flex items-center gap-2">
                  <input
                    id="canEdit"
                    type="checkbox"
                    checked={newCanEditScores}
                    onChange={(e) => setNewCanEditScores(e.target.checked)}
                  />
                  <label htmlFor="canEdit">Faculty can edit/override scores</label>
                </div>
              )}

              {addMessage && (
                <div className="text-sm text-red-600">{addMessage}</div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateUser} disabled={addLoading}>
                {addLoading ? "Saving..." : "Create User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="flex items-center gap-2">
          <label className="cursor-pointer inline-flex px-3 py-2 border rounded">
            <input type="file" accept=".csv" onChange={handleBulkFileChange} className="hidden" />
            <span className="text-sm">Upload CSV</span>
          </label>
        </div>
      </div>

      {/* TABLES */}
      {renderTable("Admins", adminUsers, adminSearch, setAdminSearch)}
      {renderTable("Faculty", facultyUsers, facultySearch, setFacultySearch)}
      {renderTable("Students", studentUsers, studentSearch, setStudentSearch)}

      {bulkLoading && <div className="text-sm">Uploading CSV...</div>}
      {bulkMessage && <div className="text-sm text-green-700">{bulkMessage}</div>}

      {/* Edit User Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details</DialogDescription>
          </DialogHeader>

          {editingUser && (
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm block">Name</label>
                <Input
                  value={editFormData.name || ""}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, name: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="text-sm block">Email</label>
                <Input
                  type="email"
                  value={editFormData.email || ""}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, email: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="text-sm block">System Id</label>
                <Input
                  value={editFormData.systemId || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      systemId: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <label className="text-sm block">Role</label>
                <select
                  value={editFormData.role || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      role: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="admin">Admin</option>
                  <option value="faculty">Faculty</option>
                  <option value="student">Student</option>
                </select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Change Password {passwordUser ? `for ${passwordUser.name}` : ""}
            </DialogTitle>
            <DialogDescription>Update user password</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm block">New Password</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm block">Confirm Password</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {passwordMessage && (
              <div className="text-sm text-red-600">{passwordMessage}</div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangePassword} disabled={passwordLoading}>
              {passwordLoading ? "Updating..." : "Update Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
