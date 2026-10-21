import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUsers, createUser, updateUser } from "@/api";
import type { User, UserRole } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Plus, Pencil, ShieldCheck, User as UserIcon } from "lucide-react";

const ROLES: UserRole[] = ["admin", "member"];

export function Users() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [error, setError] = useState("");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof createUser>[0]) => createUser(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setShowCreate(false);
      setError("");
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail ?? "Failed to create user");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateUser>[1] }) =>
      updateUser(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setEditUser(null);
      setError("");
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail ?? "Failed to update user");
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} registered users</p>
        </div>
        <Button size="sm" onClick={() => { setShowCreate(true); setError(""); }}>
          <Plus size={14} /> Add User
        </Button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <p className="text-sm text-gray-400 p-6">Loading…</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-gray-400 p-6 text-center">No users found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Name", "Username", "Email", "Role", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {u.full_name?.[0] ?? "?"}
                      </div>
                      <span className="font-medium text-gray-900">{u.full_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{u.username}</td>
                  <td className="px-5 py-3 text-gray-500">{u.email}</td>
                  <td className="px-5 py-3">
                    <Badge
                      variant={u.role === "admin" ? "warning" : "secondary"}
                      className="flex items-center gap-1 w-fit"
                    >
                      {u.role === "admin" ? (
                        <ShieldCheck size={10} />
                      ) : (
                        <UserIcon size={10} />
                      )}
                      {u.role}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant={u.is_active ? "success" : "danger"}>
                      {u.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setEditUser(u); setError(""); }}
                    >
                      <Pencil size={13} /> Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create User Dialog */}
      <CreateUserDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={(data) => createMutation.mutate(data)}
        loading={createMutation.isPending}
        error={error}
      />

      {/* Edit User Dialog */}
      {editUser && (
        <EditUserDialog
          user={editUser}
          onClose={() => setEditUser(null)}
          onSubmit={(data) => updateMutation.mutate({ id: editUser.id, data })}
          loading={updateMutation.isPending}
          error={error}
        />
      )}
    </div>
  );
}

// ── Create User Dialog ────────────────────────────────────────────────────────

function CreateUserDialog({
  open, onClose, onSubmit, loading, error,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { full_name: string; username: string; email: string; role: UserRole; password: string; is_active: boolean }) => void;
  loading: boolean;
  error: string;
}) {
  const [form, setForm] = useState({
    full_name: "",
    username: "",
    email: "",
    role: "member" as UserRole,
    password: "",
    confirmPassword: "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      return;
    }
    onSubmit({
      full_name: form.full_name,
      username: form.username,
      email: form.email,
      role: form.role,
      password: form.password,
      is_active: true,
    });
  };

  const passwordMismatch = form.confirmPassword && form.password !== form.confirmPassword;

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} title="Add User">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
          <Input
            value={form.full_name}
            onChange={(e) => set("full_name", e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
            <Input
              value={form.username}
              onChange={(e) => set("username", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <Select value={form.role} onChange={(e) => set("role", e.target.value)}>
              {ROLES.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
            </Select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
          <Input
            type="password"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
          <Input
            type="password"
            value={form.confirmPassword}
            onChange={(e) => set("confirmPassword", e.target.value)}
            required
            className={passwordMismatch ? "border-red-400 focus:ring-red-400" : ""}
          />
          {passwordMismatch && (
            <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            disabled={
              loading ||
              !form.full_name ||
              !form.username ||
              !form.password ||
              !!passwordMismatch
            }
          >
            {loading ? "Creating…" : "Create User"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ── Edit User Dialog ──────────────────────────────────────────────────────────

function EditUserDialog({
  user, onClose, onSubmit, loading, error,
}: {
  user: User;
  onClose: () => void;
  onSubmit: (data: Partial<User> & { password?: string }) => void;
  loading: boolean;
  error: string;
}) {
  const [form, setForm] = useState({
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    is_active: user.is_active,
    newPassword: "",
    confirmPassword: "",
  });

  const set = (k: string, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Partial<User> & { password?: string } = {
      full_name: form.full_name,
      email: form.email,
      role: form.role,
      is_active: form.is_active,
    };
    if (form.newPassword) {
      data.password = form.newPassword;
    }
    onSubmit(data);
  };

  const passwordMismatch =
    form.confirmPassword && form.newPassword !== form.confirmPassword;

  return (
    <Dialog open={true} onClose={onClose} title={`Edit User — ${user.username}`}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
          <Input
            value={form.full_name}
            onChange={(e) => set("full_name", e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <Select value={form.role} onChange={(e) => set("role", e.target.value)}>
              {ROLES.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <Select
              value={form.is_active ? "active" : "inactive"}
              onChange={(e) => set("is_active", e.target.value === "active")}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-medium text-gray-500 uppercase mb-2">Reset Password (optional)</p>
          <div className="space-y-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <Input
                type="password"
                value={form.newPassword}
                onChange={(e) => set("newPassword", e.target.value)}
                placeholder="Leave blank to keep current"
              />
            </div>
            {form.newPassword && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <Input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => set("confirmPassword", e.target.value)}
                  className={passwordMismatch ? "border-red-400 focus:ring-red-400" : ""}
                />
                {passwordMismatch && (
                  <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
                )}
              </div>
            )}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            disabled={
              loading ||
              !form.full_name ||
              !!(form.newPassword && passwordMismatch)
            }
          >
            {loading ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
