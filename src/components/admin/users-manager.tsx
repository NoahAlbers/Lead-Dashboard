"use client";

import { useState, useTransition } from "react";
import { createUser, updateUser, deleteUser } from "@/actions/user.actions";
import { sendInvite } from "@/actions/invite.actions";
import { Plus, Pencil, UserX, Send } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/use-toast";
import type { Role } from "@prisma/client";

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
  lastActiveAt?: string | null;
  inviteExpiresAt?: string | null;
}

function lastActiveLabel(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const ROLES: { value: Role; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "INTAKE", label: "Intake Staff" },
  { value: "SALES", label: "Sales / BD" },
  { value: "MANAGER", label: "Manager" },
];

export function UsersManager({ initialUsers }: { initialUsers: UserItem[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [editing, setEditing] = useState<UserItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [invitingId, setInvitingId] = useState<string | null>(null);

  const [confirmState, setConfirmState] = useState<{ action: () => void } | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "INTAKE" as Role,
    active: true,
  });

  function resetForm() {
    setForm({ name: "", email: "", password: "", role: "INTAKE", active: true });
    setEditing(null);
    setIsCreating(false);
  }

  function startEdit(user: UserItem) {
    setEditing(user);
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      active: user.active,
    });
    setIsCreating(true);
  }

  function handleSave() {
    const data = {
      name: form.name,
      email: form.email,
      role: form.role,
      active: form.active,
      ...(form.password ? { password: form.password } : {}),
    };

    startTransition(async () => {
      if (editing) {
        await updateUser(editing.id, data);
      } else {
        await createUser({ ...data, password: form.password });
      }
      resetForm();
      window.location.reload();
    });
  }

  function handleDeactivate(id: string) {
    setConfirmState({
      action: () => {
        startTransition(async () => {
          await deleteUser(id);
          setUsers(users.map((u) => (u.id === id ? { ...u, active: false } : u)));
        });
      },
    });
  }

  async function handleInvite(user: UserItem) {
    setInvitingId(user.id);
    try {
      const res = await sendInvite(user.id);
      if (res.success) {
        toast({ title: `Invite sent to ${user.email}`, variant: "success" });
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, inviteExpiresAt: res.expiresAt ?? null } : u))
        );
      } else {
        toast({ title: `Invite failed: ${res.error ?? "unknown error"}`, variant: "destructive" });
      }
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Invite failed",
        variant: "destructive",
      });
    } finally {
      setInvitingId(null);
    }
  }

  const inputClass =
    "mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

  return (
    <div className="space-y-4">
      {/* Users List */}
      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Name
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Email
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Role
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Last active
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className={`border-b ${!user.active ? "opacity-50" : ""}`}
              >
                <td className="px-4 py-3 font-medium">{user.name}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      user.active
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {user.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm">{lastActiveLabel(user.lastActiveAt)}</div>
                  {!user.lastActiveAt && user.inviteExpiresAt && (
                    <div className="text-xs text-muted-foreground">
                      {new Date(user.inviteExpiresAt).getTime() > Date.now()
                        ? "Invite pending"
                        : "Invite expired"}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end items-center gap-1">
                    {user.active && (
                      <button
                        onClick={() => handleInvite(user)}
                        disabled={invitingId === user.id}
                        className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50"
                        title={user.inviteExpiresAt ? "Resend the set-password link" : "Email a set-password link"}
                      >
                        <Send className="h-3 w-3" />
                        {invitingId === user.id
                          ? "Sending..."
                          : user.inviteExpiresAt
                            ? "Resend invite"
                            : "Send invite"}
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(user)}
                      className="p-1 hover:bg-muted rounded"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {user.active && (
                      <button
                        onClick={() => handleDeactivate(user.id)}
                        className="p-1 hover:bg-muted rounded text-destructive"
                      >
                        <UserX className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Form */}
      {isCreating ? (
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <h3 className="font-semibold">
            {editing ? "Edit User" : "New User"}
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Password {editing ? "(leave blank to keep)" : "*"}
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Role</label>
              <select
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value as Role })
                }
                className={inputClass}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Active
          </label>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={
                isPending ||
                !form.name ||
                !form.email ||
                (!editing && !form.password)
              }
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {editing ? "Update User" : "Create User"}
            </button>
            <button
              onClick={resetForm}
              className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors w-full justify-center"
        >
          <Plus className="h-4 w-4" />
          Add User
        </button>
      )}
      <ConfirmDialog
        open={!!confirmState}
        title="Deactivate User"
        message="Are you sure you want to deactivate this user?"
        confirmLabel="Deactivate"
        destructive
        onConfirm={() => { confirmState?.action(); setConfirmState(null); }}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
