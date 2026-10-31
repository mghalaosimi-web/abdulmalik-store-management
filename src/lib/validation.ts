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

export function isValidImei(value: string): boolean {
  const imei = value.replace(/\s+/g, "");
  if (!/^\d{15}$/.test(imei)) return false;
  let sum = 0;
  for (let index = 0; index < imei.length; index += 1) {
    let digit = Number(imei[index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

export function validateProductInput(input: {
  sku: string; name: string; category: string; costPrice: number; salePrice: number;
  quantity: number; minQuantity: number;
}): void {
  if (input.sku.trim().length < 2 || input.sku.trim().length > 64) throw new Error("رمز SKU يجب أن يكون بين حرفين و64 حرفاً.");
  if (input.name.trim().length < 2 || input.name.trim().length > 180) throw new Error("اسم المنتج يجب أن يكون بين حرفين و180 حرفاً.");
  if (input.category.trim().length < 2 || input.category.trim().length > 100) throw new Error("التصنيف مطلوب ويجب ألا يتجاوز 100 حرف.");
  for (const [label, value] of [["التكلفة", input.costPrice], ["سعر البيع", input.salePrice]] as const) {
    if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * 100))) throw new Error(`قيمة ${label} غير صالحة.`);
  }
  for (const [label, value] of [["الكمية", input.quantity], ["حد التنبيه", input.minQuantity]] as const) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} يجب أن يكون عدداً صحيحاً غير سالب.`);
  }
}
