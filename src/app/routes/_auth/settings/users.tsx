import React, { useState } from 'react';
import { createFileRoute, getRouteApi } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, UserPlus, Shield, UserCheck, UserX, Trash2, Mail, Clock, RefreshCw } from 'lucide-react';
import {
  listStaffFn,
  addStaffFn,
  updateStaffRoleFn,
  toggleStaffStatusFn,
  removeStaffFn,
} from '../../../../features/settings/server';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Badge } from '../../../../components/ui/badge';
import { Modal } from '../../../../components/ui/modal';

const authRoute = getRouteApi('/_auth');

export const Route = createFileRoute('/_auth/settings/users')({
  component: UsersSettingsComponent,
  errorComponent: ({ error, reset }) => (
    <div className="max-w-4xl mx-auto w-full p-6 bg-rose-50 border border-rose-200 rounded-xl text-center space-y-3">
      <h3 className="text-base font-bold text-rose-900">Failed to load Staff & Roles</h3>
      <p className="text-xs text-rose-700">{(error as any)?.message || 'An error occurred while loading this page.'}</p>
      <div className="flex justify-center gap-2">
        <Button size="sm" variant="outline" onClick={() => reset()}>
          Try Again
        </Button>
      </div>
    </div>
  ),
});

function UsersSettingsComponent() {
  const queryClient = useQueryClient();
  const viewer = authRoute.useLoaderData();
  const userRole = viewer?.user?.role || 'CASHIER';
  const isOwner = userRole === 'OWNER';
  const isManager = userRole === 'MANAGER';

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'OWNER' | 'MANAGER' | 'CASHIER'>('CASHIER');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    data: staffData,
    isLoading: isStaffLoading,
    isError,
    error: staffQueryError,
    refetch,
  } = useQuery({
    queryKey: ['settings', 'staff'],
    queryFn: async () => {
      const res = await listStaffFn();
      if (!Array.isArray(res)) {
        return [];
      }
      return res;
    },
    staleTime: 30000,
  });

  const staff = Array.isArray(staffData) ? staffData : [];

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || !isOwner) return;
    setError('');
    setIsLoading(true);

    try {
      await addStaffFn({
        data: {
          email: email.trim().toLowerCase(),
          role,
        },
      });

      setIsAddModalOpen(false);
      setEmail('');
      setRole('CASHIER');
      await queryClient.invalidateQueries({ queryKey: ['settings', 'staff'] });
    } catch (err: any) {
      setError(err?.message || 'Failed to add staff member');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (membershipId: string, currentStatus: boolean) => {
    if (!isOwner) return;
    try {
      await toggleStaffStatusFn({ data: { membershipId, isActive: !currentStatus } });
      await queryClient.invalidateQueries({ queryKey: ['settings', 'staff'] });
    } catch (err: any) {
      alert(err?.message || 'Failed to toggle status');
    }
  };

  const handleRoleChange = async (membershipId: string, newRole: 'OWNER' | 'MANAGER' | 'CASHIER') => {
    if (!isOwner) return;
    try {
      await updateStaffRoleFn({ data: { membershipId, role: newRole } });
      await queryClient.invalidateQueries({ queryKey: ['settings', 'staff'] });
    } catch (err: any) {
      alert(err?.message || 'Failed to update role');
    }
  };

  const handleRemove = async (membershipId: string, staffEmail: string) => {
    if (!isOwner) return;
    if (!confirm(`Are you sure you want to remove ${staffEmail} from this store?`)) return;
    try {
      await removeStaffFn({ data: { membershipId } });
      await queryClient.invalidateQueries({ queryKey: ['settings', 'staff'] });
    } catch (err: any) {
      alert(err?.message || 'Failed to remove staff member');
    }
  };

  const getRoleBadgeVariant = (r: string) => {
    switch (r) {
      case 'OWNER':
        return 'brand';
      case 'MANAGER':
        return 'neutral';
      default:
        return 'outline';
    }
  };

  if (!isOwner && !isManager) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-xl border border-slate-200 text-center shadow-xs">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <Shield className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Access Restricted</h2>
        <p className="text-xs text-slate-500 mb-6">
          Only Store Owners and Managers can access the Staff & Roles directory. Your current role is <strong>{userRole}</strong>.
        </p>
        <Button onClick={() => window.history.back()} variant="outline" size="sm">
          Go Back
        </Button>
      </div>
    );
  }

  if (isStaffLoading) {
    return (
      <div className="max-w-4xl mx-auto w-full space-y-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Staff & Roles</h2>
          <p className="text-xs text-slate-500">Manage cashier, manager, and owner access for this store</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center justify-center text-slate-400 shadow-xs">
          <RefreshCw className="w-6 h-6 animate-spin mb-2 text-brand-600" />
          <p className="text-xs text-slate-500">Loading staff members...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto w-full space-y-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Staff & Roles</h2>
          <p className="text-xs text-slate-500">Manage cashier, manager, and owner access for this store</p>
        </div>
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-center space-y-3">
          <p className="text-sm font-semibold text-rose-800">
            {(staffQueryError as any)?.message || 'Failed to load staff list'}
          </p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Staff & Roles</h2>
          <p className="text-xs text-slate-500">
            {isOwner
              ? 'Manage cashier, manager, and owner access for this store'
              : 'View cashier, manager, and owner access for this store'}
          </p>
        </div>
        {isOwner ? (
          <Button size="md" onClick={() => setIsAddModalOpen(true)}>
            <UserPlus className="w-4 h-4" /> Add Staff Member
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold">
            <Shield className="w-3.5 h-3.5" /> View Only (Manager)
          </span>
        )}
      </div>

      {isManager && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 flex items-start gap-2.5">
          <Shield className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div>
            <span className="font-bold">Manager Mode: View Only</span>
            <p className="text-blue-700 text-[11px] mt-0.5">
              You can view active staff and assigned store roles. Only the Store Owner can add new staff, modify roles, or deactivate members.
            </p>
          </div>
        </div>
      )}

      {/* Role explanation banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <span className="font-bold text-slate-800">👑 Owner (Admin)</span>
          <p className="text-[11px] text-slate-500 mt-0.5">Full control. Can delete inventory & customers, manage staff, and switch stores.</p>
        </div>
        <div>
          <span className="font-bold text-slate-800">💼 Manager</span>
          <p className="text-[11px] text-slate-500 mt-0.5">Can add/update items, stock, purchases, and customers. Cannot delete records or staff.</p>
        </div>
        <div>
          <span className="font-bold text-slate-800">💳 Cashier</span>
          <p className="text-[11px] text-slate-500 mt-0.5">Counter billing, POS sales, view products, and record customer payments.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px] uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Member / Email</th>
              <th className="py-3 px-4">Store Role</th>
              <th className="py-3 px-4">Access Status</th>
              {isOwner && <th className="py-3 px-4 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staff.length === 0 ? (
              <tr>
                <td colSpan={isOwner ? 4 : 3} className="py-8 text-center text-slate-400 text-xs">
                  No staff members found
                </td>
              </tr>
            ) : (
              staff.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-slate-900">{u.name}</div>
                      {u.isPending && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
                          <Clock className="w-2.5 h-2.5" /> Pending Invite
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3" /> {u.email}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {isOwner ? (
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as any)}
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 focus:ring-brand-500 focus:border-brand-500"
                      >
                        <option value="CASHIER">CASHIER</option>
                        <option value="MANAGER">MANAGER</option>
                        <option value="OWNER">OWNER</option>
                      </select>
                    ) : (
                      <Badge variant={getRoleBadgeVariant(u.role)}>
                        {u.role}
                      </Badge>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={u.isActive ? 'success' : 'danger'}>
                      {u.isActive ? 'Active' : 'Disabled'}
                    </Badge>
                  </td>
                  {isOwner && (
                    <td className="py-3 px-4 text-right space-x-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggle(u.id, u.isActive)}
                        className="text-xs"
                      >
                        {u.isActive ? (
                          <>
                            <UserX className="w-3.5 h-3.5 text-rose-500" /> Deactivate
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3.5 h-3.5 text-emerald-500" /> Activate
                          </>
                        )}
                      </Button>
                      <button
                        type="button"
                        onClick={() => handleRemove(u.id, u.email)}
                        title="Remove Member"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ADD STAFF MODAL */}
      {isOwner && (
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Add Staff Member"
          description="Add a user by email. If they have an account, the store appears instantly when they log in. If not, access activates when they register."
        >
          <form onSubmit={handleAddStaff} className="space-y-4">
            {error && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {error}
              </div>
            )}

            <Input
              label="Staff Email Address *"
              type="email"
              placeholder="e.g. cashier@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Assign Role *</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-brand-500"
              >
                <option value="CASHIER">CASHIER (Counter POS, Billing & Customer Payments)</option>
                <option value="MANAGER">MANAGER (Add/Edit Inventory & Customers, Stock Adjustments, Purchases)</option>
                <option value="OWNER">OWNER (Full Admin: Delete Items/Customers, Manage Staff, Settings)</option>
              </select>
            </div>

            <Button type="submit" isLoading={isLoading} className="w-full">
              Add to Store
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
