export const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'OTHER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const CHARGE_TYPES = ['labour', 'service', 'installation', 'delivery', 'other'] as const;
export type ChargeType = (typeof CHARGE_TYPES)[number];

export const USER_ROLES = ['OWNER', 'STAFF'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const CHARGE_LABELS: Record<ChargeType, string> = {
  labour: 'Labour Charges',
  service: 'Service Fee',
  installation: 'Installation Fee',
  delivery: 'Delivery Fee',
  other: 'Other Charge',
};
