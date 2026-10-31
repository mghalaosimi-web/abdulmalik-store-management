/**
 * Money helpers use integer minor units for all calculations.
 * SQLite's initial schema stores REAL values, so conversion happens only at
 * the persistence boundary. Never accumulate monetary values as floats.
 */
export function toMinorUnits(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("المبلغ يجب أن يكون رقماً صالحاً غير سالب.");
  }
  const minor = Math.round((value + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(minor)) {
    throw new Error("المبلغ أكبر من النطاق المسموح.");
  }
  return minor;
}

export function fromMinorUnits(value: number): number {
  if (!Number.isSafeInteger(value)) {
    throw new Error("وحدة المبلغ غير صالحة.");
  }
  return value / 100;
}

export function calculateLineTotal(unitPrice: number, quantity: number, discount = 0): number {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error("الكمية يجب أن تكون عدداً صحيحاً أكبر من صفر.");
  }
  const gross = toMinorUnits(unitPrice) * quantity;
  const discountMinor = toMinorUnits(discount);
  if (!Number.isSafeInteger(gross) || discountMinor > gross) {
    throw new Error("الخصم لا يمكن أن يتجاوز إجمالي البند.");
  }
  return gross - discountMinor;
}

export function formatMoney(value: number, currency = "YER"): string {
  return new Intl.NumberFormat("ar", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
