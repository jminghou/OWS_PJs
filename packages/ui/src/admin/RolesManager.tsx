'use client';

import { useEffect, useState, useCallback } from 'react';
import type { RbacPermission, RbacRole, User } from '../types';

export interface RolesManagerApi {
  getPermissions: () => Promise<{ modules: Record<string, RbacPermission[]> }>;
  getRoles: () => Promise<{ roles: RbacRole[] }>;
  createRole: (data: { code: string; name?: Record<string, string>; permissions?: string[] }) => Promise<{ role: RbacRole }>;
  updateRole: (id: number, data: { permissions?: string[]; is_active?: boolean }) => Promise<{ role: RbacRole }>;
  deleteRole: (id: number) => Promise<{ message: string }>;
  getUsers: () => Promise<{ users: User[] }>;
  getUserRoles: (userId: number) => Promise<{ roles: string[] }>;
  setUserRoles: (userId: number, roles: string[]) => Promise<{ roles: string[] }>;
}

export interface RolesManagerProps {
  api: RolesManagerApi;
  lang?: string;
}

function roleName(role: RbacRole, lang: string): string {
  return role.name?.[lang] || role.name?.['zh-TW'] || role.code;
}

export function RolesManager({ api, lang = 'zh-TW' }: RolesManagerProps) {
  const [modules, setModules] = useState<Record<string, RbacPermission[]>>({});
  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [userRoles, setUserRoles] = useState<Record<number, string[]>>({});
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [draftPerms, setDraftPerms] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [newRoleCode, setNewRoleCode] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, r, u] = await Promise.all([api.getPermissions(), api.getRoles(), api.getUsers()]);
      setModules(p.modules);
      setRoles(r.roles);
      setUsers(u.users);
      const ur: Record<number, string[]> = {};
      await Promise.all(u.users.map(async (usr) => {
        try { ur[usr.id] = (await api.getUserRoles(usr.id)).roles; } catch { ur[usr.id] = []; }
      }));
      setUserRoles(ur);
      if (r.roles.length && selectedRoleId === null) {
        setSelectedRoleId(r.roles[0].id);
        setDraftPerms(new Set(r.roles[0].permissions));
      }
    } catch (e: any) {
      setMsg(e?.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [api, selectedRoleId]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectRole = (role: RbacRole) => {
    setSelectedRoleId(role.id);
    setDraftPerms(new Set(role.permissions));
    setMsg(null);
  };

  const togglePerm = (code: string) => {
    setDraftPerms((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const selectedRole = roles.find((r) => r.id === selectedRoleId) || null;

  const savePerms = async () => {
    if (!selectedRole) return;
    setSaving(true);
    setMsg(null);
    try {
      const { role } = await api.updateRole(selectedRole.id, { permissions: Array.from(draftPerms) });
      setRoles((prev) => prev.map((r) => (r.id === role.id ? role : r)));
      setMsg('已儲存權限變更');
    } catch (e: any) {
      setMsg(e?.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const createRole = async () => {
    const code = newRoleCode.trim();
    if (!code) return;
    setSaving(true);
    try {
      const { role } = await api.createRole({ code, name: { 'zh-TW': code }, permissions: [] });
      setRoles((prev) => [...prev, role]);
      setNewRoleCode('');
      selectRole(role);
    } catch (e: any) {
      setMsg(e?.message || '建立失敗');
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (role: RbacRole) => {
    if (!confirm(`確定刪除角色「${roleName(role, lang)}」？`)) return;
    try {
      await api.deleteRole(role.id);
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
      if (selectedRoleId === role.id) setSelectedRoleId(null);
    } catch (e: any) {
      setMsg(e?.message || '刪除失敗');
    }
  };

  const toggleUserRole = async (userId: number, roleCode: string) => {
    const current = userRoles[userId] || [];
    const next = current.includes(roleCode)
      ? current.filter((c) => c !== roleCode)
      : [...current, roleCode];
    setUserRoles((prev) => ({ ...prev, [userId]: next }));
    try {
      await api.setUserRoles(userId, next);
    } catch (e: any) {
      setMsg(e?.message || '指派失敗');
      setUserRoles((prev) => ({ ...prev, [userId]: current })); // revert
    }
  };

  if (loading) return <div className="p-8 text-gray-500">載入中…</div>;

  return (
    <div className="p-6 space-y-8">
      {msg && (
        <div className="px-4 py-2 rounded-md bg-admin-accent-50 text-admin-accent-800 text-sm">{msg}</div>
      )}

      {/* ===== 角色與權限 ===== */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">角色與權限</h2>
        <div className="flex gap-6">
          {/* Role list */}
          <div className="w-56 shrink-0 space-y-1">
            {roles.map((role) => (
              <div
                key={role.id}
                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer ${
                  selectedRoleId === role.id ? 'bg-admin-accent-500 text-white' : 'hover:bg-gray-100 text-gray-700'
                }`}
                onClick={() => selectRole(role)}
              >
                <span className="text-sm">
                  {roleName(role, lang)}
                  {role.is_system && <span className="ml-1 text-xs opacity-70">(系統)</span>}
                </span>
                {!role.is_system && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteRole(role); }}
                    className="text-xs opacity-60 hover:opacity-100"
                    title="刪除角色"
                  >✕</button>
                )}
              </div>
            ))}
            <div className="flex gap-1 pt-2">
              <input
                value={newRoleCode}
                onChange={(e) => setNewRoleCode(e.target.value)}
                placeholder="新角色代碼"
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-admin-accent-500 focus:outline-none"
              />
              <button
                onClick={createRole}
                disabled={saving || !newRoleCode.trim()}
                className="px-2 py-1 bg-admin-accent-500 text-white rounded text-sm disabled:opacity-50"
              >新增</button>
            </div>
          </div>

          {/* Permission matrix */}
          <div className="flex-1">
            {selectedRole ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-500">
                    勾選「{roleName(selectedRole, lang)}」可執行的權限
                  </span>
                  <button
                    onClick={savePerms}
                    disabled={saving}
                    className="px-4 py-1.5 bg-admin-accent-600 text-white rounded-lg text-sm disabled:opacity-50"
                  >{saving ? '儲存中…' : '儲存'}</button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(modules).map(([module, perms]) => (
                    <div key={module} className="border border-gray-200 rounded-lg p-3">
                      <div className="font-medium text-sm text-gray-800 mb-2 capitalize">{module}</div>
                      <div className="space-y-1">
                        {perms.map((p) => (
                          <label key={p.code} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={draftPerms.has(p.code)}
                              onChange={() => togglePerm(p.code)}
                              className="rounded border-gray-300 text-admin-accent-500 focus:ring-admin-accent-500"
                            />
                            {p.name?.[lang] || p.name?.['zh-TW'] || p.action}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-gray-400 text-sm">請選擇左側角色</div>
            )}
          </div>
        </div>
      </section>

      {/* ===== 使用者角色指派 ===== */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">使用者角色指派</h2>
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">使用者</th>
                {roles.map((r) => (
                  <th key={r.id} className="px-4 py-2 font-medium text-gray-600 text-center">{roleName(r, lang)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-800">{u.username}</td>
                  {roles.map((r) => (
                    <td key={r.id} className="px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={(userRoles[u.id] || []).includes(r.code)}
                        onChange={() => toggleUserRole(u.id, r.code)}
                        className="rounded border-gray-300 text-admin-accent-500 focus:ring-admin-accent-500"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default RolesManager;
