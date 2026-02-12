'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, RefreshCw, Search, Trash2, Users } from 'lucide-react';

interface StaffUser {
  _id: string;
  name: string;
  role: 'Surgeon' | 'Doctor' | 'Nurse' | 'Admin';
  employeeId: string;
  createdAt: string;
  descriptorsCount: number;
}

interface UserCrudPanelProps {
  refreshKey: number;
}

const ROLE_OPTIONS = ['Surgeon', 'Doctor', 'Nurse', 'Admin'] as const;

export default function UserCrudPanel({ refreshKey }: UserCrudPanelProps) {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<StaffUser | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState('');

  const [editPayload, setEditPayload] = useState({
    name: '',
    role: 'Doctor',
    employeeId: '',
  });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      params.set('limit', '200');

      const response = await fetch(`/api/users?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Gagal memuat data user.');
        setUsers([]);
        return;
      }

      setUsers(data.users ?? []);
    } catch {
      setError('Gagal memuat data user.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers, refreshKey]);

  const openEdit = useCallback((user: StaffUser) => {
    setEditingUser(user);
    setEditPayload({
      name: user.name,
      role: user.role,
      employeeId: user.employeeId,
    });
    setNotice(null);
    setError(null);
  }, []);

  const submitEdit = useCallback(async () => {
    if (!editingUser) return;

    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/users/${editingUser._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editPayload),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Gagal update user.');
        return;
      }

      setNotice('User berhasil diperbarui.');
      setEditingUser(null);
      await loadUsers();
    } catch {
      setError('Gagal update user.');
    }
  }, [editPayload, editingUser, loadUsers]);

  const submitDelete = useCallback(async () => {
    if (!deleteUser) return;
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/users/${deleteUser._id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmployeeId: deleteConfirmId }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Gagal menghapus user.');
        return;
      }

      setNotice(`User ${deleteUser.name} berhasil dihapus.`);
      setDeleteUser(null);
      setDeleteConfirmId('');
      await loadUsers();
    } catch {
      setError('Gagal menghapus user.');
    }
  }, [deleteConfirmId, deleteUser, loadUsers]);

  const summary = useMemo(() => {
    if (loading) return 'Memuat data user...';
    return `${users.length} user ditemukan`;
  }, [loading, users.length]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-300/30">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center text-lg font-semibold text-slate-900">
          <Users className="mr-2 h-5 w-5 text-cyan-600" suppressHydrationWarning />
          User Management
        </h2>
        <button
          type="button"
          onClick={() => void loadUsers()}
          className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900"
        >
          <RefreshCw className="mr-1 h-3.5 w-3.5" suppressHydrationWarning />
          Refresh
        </button>
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
        <Search className="h-4 w-4 text-slate-400" suppressHydrationWarning />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void loadUsers();
            }
          }}
          placeholder="Cari nama / employee ID / role"
          className="w-full bg-transparent text-sm text-slate-700 outline-none"
        />
      </div>

      <p className="mb-3 text-xs text-slate-500">{summary}</p>

      <div className="max-h-[360px] overflow-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Employee ID</th>
              <th className="px-3 py-2">Face Data</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user._id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-800">{user.name}</td>
                <td className="px-3 py-2 text-slate-600">{user.role}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-600">{user.employeeId}</td>
                <td className="px-3 py-2 text-slate-600">{user.descriptorsCount} descriptor</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(user)}
                      className="inline-flex items-center rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-cyan-300 hover:text-cyan-700"
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" suppressHydrationWarning />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteUser(user);
                        setDeleteConfirmId('');
                        setNotice(null);
                        setError(null);
                      }}
                      className="inline-flex items-center rounded-md border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" suppressHydrationWarning />
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  Tidak ada data user.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {notice && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {editingUser && (
        <div className="mt-4 space-y-3 rounded-xl border border-cyan-200 bg-cyan-50/50 p-4">
          <p className="text-sm font-semibold text-cyan-800">Edit user: {editingUser.name}</p>
          <input
            value={editPayload.name}
            onChange={(e) => setEditPayload((prev) => ({ ...prev, name: e.target.value }))}
            className="w-full rounded-lg border border-cyan-200 px-3 py-2 text-sm outline-none"
            placeholder="Nama"
          />
          <select
            value={editPayload.role}
            onChange={(e) => setEditPayload((prev) => ({ ...prev, role: e.target.value }))}
            className="w-full rounded-lg border border-cyan-200 px-3 py-2 text-sm outline-none"
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <input
            value={editPayload.employeeId}
            onChange={(e) => setEditPayload((prev) => ({ ...prev, employeeId: e.target.value }))}
            className="w-full rounded-lg border border-cyan-200 px-3 py-2 text-sm font-mono outline-none"
            placeholder="Employee ID"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void submitEdit()}
              className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-700"
            >
              Simpan Perubahan
            </button>
            <button
              type="button"
              onClick={() => setEditingUser(null)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-white"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {deleteUser && (
        <div className="mt-4 space-y-3 rounded-xl border border-rose-200 bg-rose-50/60 p-4">
          <p className="text-sm font-semibold text-rose-800">Hapus user: {deleteUser.name}</p>
          <p className="text-xs text-rose-700">
            Untuk konfirmasi, masukkan Employee ID user ini: <span className="font-mono">{deleteUser.employeeId}</span>
          </p>
          <input
            value={deleteConfirmId}
            onChange={(e) => setDeleteConfirmId(e.target.value)}
            className="w-full rounded-lg border border-rose-200 px-3 py-2 text-sm font-mono outline-none"
            placeholder="Ketik employee ID untuk konfirmasi"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void submitDelete()}
              className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
            >
              Ya, Hapus User
            </button>
            <button
              type="button"
              onClick={() => {
                setDeleteUser(null);
                setDeleteConfirmId('');
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-white"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
