export type Role = 'OWNER' | 'MANAGER' | 'CASHIER';

/**
 * RBAC Rules:
 * - OWNER (Admin): Full control (delete products, delete customers, manage staff, switch/create stores).
 * - MANAGER: Can manage (add, edit) products, customers, stock adjustments, and purchases.
 *            CANNOT delete products or customers.
 * - CASHIER: Counter POS billing, view products, search customers, record bill payments.
 *            CANNOT delete or manage staff.
 */

export function canDeleteProduct(role: Role): boolean {
  return role === 'OWNER';
}

export function canDeleteCustomer(role: Role): boolean {
  return role === 'OWNER';
}

export function canManageStaff(role: Role): boolean {
  return role === 'OWNER';
}

export function canManageInventory(role: Role): boolean {
  return role === 'OWNER' || role === 'MANAGER';
}

export function canManageCustomers(role: Role): boolean {
  return role === 'OWNER' || role === 'MANAGER';
}

export function canDeleteInventoryOrCustomer(role: Role): boolean {
  return role === 'OWNER';
}
