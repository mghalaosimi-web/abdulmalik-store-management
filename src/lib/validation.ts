export function parseNonNegativeInteger(value: string): number {
  if (!/^\d+$/.test(value.trim())) {
    throw new Error("القيمة يجب أن تكون عدداً صحيحاً غير سالب.");
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error("القيمة أكبر من النطاق المسموح.");
  }
  return parsed;
}

export function normalizeSearchTerm(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
