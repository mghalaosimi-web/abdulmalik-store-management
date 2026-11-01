import { invoke } from "@tauri-apps/api/core";
import { getDatabase } from "./database";

type SaleItemInput = { productId: string; quantity: number };
type SaleInput = { saleId: string; invoiceNumber: string; items: SaleItemInput[]; discount: number; paidAmount: number };
export type SaleResult = { saleId: string; invoiceNumber: string; subtotal: number; discount: number; total: number; paidAmount: number };

export async function createSale(input: Omit<SaleInput, "saleId" | "invoiceNumber">): Promise<SaleResult> {
  if (!input.items.length) throw new Error("السلة فارغة.");
  if (!Number.isFinite(input.discount) || input.discount < 0 || !Number.isFinite(input.paidAmount) || input.paidAmount < 0) {
    throw new Error("قيمة الخصم أو المبلغ المدفوع غير صحيحة.");
  }
  const quantities = new Map<string, number>();
  for (const item of input.items) {
    if (!item.productId || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("كمية المنتج غير صحيحة.");
    }
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }

  // Wait for the SQL plugin and all registered migrations before invoking the native transaction.
  await getDatabase();
  const saleId = crypto.randomUUID();
  const invoiceNumber = "INV-" + new Date().toISOString().slice(0, 10).replaceAll("-", "") + "-" + crypto.randomUUID().slice(0, 8).toUpperCase();

  return invoke<SaleResult>("create_sale", {
    input: {
      saleId,
      invoiceNumber,
      items: Array.from(quantities, ([productId, quantity]) => ({ productId, quantity })),
      discount: input.discount,
      paidAmount: input.paidAmount,
    },
  });
}
