import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateUser } from "@/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle } from "lucide-react";

export function Profile() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [profileForm, setProfileForm] = useState({
    full_name: user?.full_name ?? "",
    email: user?.email ?? "",
  });

  const [passwordForm, setPasswordForm] = useState({
    current: "",
    newPass: "",
    confirm: "",
  });

  const [digestEnabled, setDigestEnabled] = useState(
    user?.email_digest_enabled ?? false
  );

  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const profileMutation = useMutation({
    mutationFn: (data: { full_name: string; email: string }) =>
      updateUser(user!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      setProfileSuccess(true);
      setProfileError("");
      setTimeout(() => setProfileSuccess(false), 3000);
    },
    onError: (err: any) => {
      setProfileError(err.response?.data?.detail ?? "Failed to update profile");
      setProfileSuccess(false);
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (data: { password: string }) => updateUser(user!.id, data),
    onSuccess: () => {
      setPasswordSuccess(true);
      setPasswordError("");
      setPasswordForm({ current: "", newPass: "", confirm: "" });
      setTimeout(() => setPasswordSuccess(false), 3000);
    },
    onError: (err: any) => {
      setPasswordError(err.response?.data?.detail ?? "Failed to change password");
      setPasswordSuccess(false);
    },
  });

  const digestMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      updateUser(user!.id, { email_digest_enabled: enabled }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm.full_name.trim()) return;
    profileMutation.mutate({
      full_name: profileForm.full_name.trim(),
      email: profileForm.email.trim(),
    });
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPass !== passwordForm.confirm) {
      setPasswordError("New passwords do not match");
      return;
    }
    if (passwordForm.newPass.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }
    passwordMutation.mutate({ password: passwordForm.newPass });
  };

  const handleDigestToggle = (enabled: boolean) => {
    setDigestEnabled(enabled);
    digestMutation.mutate(enabled);
  };

  const passwordMismatch =
    passwordForm.confirm && passwordForm.newPass !== passwordForm.confirm;

  if (!user) return <p className="text-gray-400 text-sm">Not authenticated.</p>;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Profile</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your account settings</p>
      </div>

      {/* User info header */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold flex-shrink-0">
          {user.full_name?.[0] ?? "?"}
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-lg">{user.full_name}</p>
          <p className="text-sm text-gray-500">{user.username}</p>
          <Badge variant={user.role === "admin" ? "warning" : "secondary"} className="mt-1">
            {user.role}
          </Badge>
        </div>
      </div>

      {/* Edit profile */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Personal Information</h2>
        <form onSubmit={handleProfileSave} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <Input
              value={profileForm.full_name}
              onChange={(e) => setProfileForm((f) => ({ ...f, full_name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <Input
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="your@email.com"
            />
          </div>

          {profileSuccess && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
              <CheckCircle size={14} /> Profile updated successfully.
            </div>
          )}
          {profileError && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              <AlertCircle size={14} /> {profileError}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              disabled={profileMutation.isPending || !profileForm.full_name.trim()}
            >
              {profileMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>

      {/* Change password */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Change Password</h2>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Password
            </label>
            <Input
              type="password"
              value={passwordForm.current}
              onChange={(e) =>
                setPasswordForm((f) => ({ ...f, current: e.target.value }))
              }
              placeholder="Enter current password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password *</label>
            <Input
              type="password"
              value={passwordForm.newPass}
              onChange={(e) =>
                setPasswordForm((f) => ({ ...f, newPass: e.target.value }))
              }
              required
              placeholder="At least 6 characters"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm New Password *
            </label>
            <Input
              type="password"
              value={passwordForm.confirm}
              onChange={(e) =>
                setPasswordForm((f) => ({ ...f, confirm: e.target.value }))
              }
              required
              placeholder="Repeat new password"
              className={passwordMismatch ? "border-red-400 focus:ring-red-400" : ""}
            />
            {passwordMismatch && (
              <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
            )}
          </div>

          {passwordSuccess && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
              <CheckCircle size={14} /> Password changed successfully.
            </div>
          )}
          {passwordError && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              <AlertCircle size={14} /> {passwordError}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              disabled={
                passwordMutation.isPending ||
                !passwordForm.newPass ||
                !passwordForm.confirm ||
                !!passwordMismatch
              }
            >
              {passwordMutation.isPending ? "Changing…" : "Change Password"}
            </Button>
          </div>
        </form>
      </div>

      {/* Notifications */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Notifications</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">Email Digest</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Receive a daily summary of project activity via email.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={digestEnabled}
            onClick={() => handleDigestToggle(!digestEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
              digestEnabled ? "bg-blue-600" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                digestEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        {digestMutation.isPending && (
          <p className="text-xs text-gray-400 mt-2">Saving preference…</p>
        )}
      </div>
    </div>
  );
}
