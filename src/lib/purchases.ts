import { getDatabase } from "./database";
import { fromMinorUnits, toMinorUnits } from "./money";
import { postJournalEntryInTransaction, type JournalLineInput } from "./accounting";

export interface PurchaseLineInput { productId: string; quantity: number; unitCost: number }
export interface PurchaseInput {
  supplierId: string;
  lines: PurchaseLineInput[];
  discount?: number;
  taxAmount?: number;
  paidAmount: number;
  paymentMethod?: "cash" | "card" | "transfer" | "mobile_wallet" | "other";
  notes?: string;
}
export interface PurchaseResult {
  purchaseId: string; invoiceNumber: string; total: number; paidAmount: number; balanceDue: number;
}

interface ProductStock { id: string; name: string; quantity: number; cost_price: number }

export async function receivePurchase(input: PurchaseInput): Promise<PurchaseResult> {
  if (!input.supplierId) throw new Error("اختر المورد.");
  if (!input.lines.length) throw new Error("أضف صنفاً واحداً على الأقل.");
  const discountMinor = toMinorUnits(input.discount ?? 0);
  const taxMinor = toMinorUnits(input.taxAmount ?? 0);
  const paidMinor = toMinorUnits(input.paidAmount);
  const db = await getDatabase();
  const purchaseId = crypto.randomUUID();
  const invoiceNumber = `PUR-${new Date().toISOString().slice(0,10).replaceAll("-", "")}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
  const normalized = new Map<string, { quantity: number; costMinor: number }>();
  for (const line of input.lines) {
    if (!line.productId || !Number.isSafeInteger(line.quantity) || line.quantity <= 0) throw new Error("بيانات صنف الشراء غير صحيحة.");
    const costMinor = toMinorUnits(line.unitCost);
    const existing = normalized.get(line.productId);
    if (existing && existing.costMinor !== costMinor) throw new Error("لا تكرر الصنف في الفاتورة بتكاليف مختلفة؛ افصل السطرين.");
    normalized.set(line.productId, { quantity: (existing?.quantity ?? 0) + line.quantity, costMinor });
  }

  await db.execute("BEGIN IMMEDIATE");
  try {
    const supplier = await db.select<Array<{ id: string }>>("SELECT id FROM suppliers WHERE id = ? LIMIT 1", [input.supplierId]);
    if (!supplier[0]) throw new Error("المورد المحدد غير موجود.");
    const rows: Array<{ product: ProductStock; quantity: number; costMinor: number; lineMinor: number }> = [];
    let subtotalMinor = 0;
    for (const [productId, line] of normalized) {
      const found = await db.select<ProductStock[]>(
        "SELECT id, name, quantity, cost_price FROM products WHERE id = ? AND status = 'active' LIMIT 1",
        [productId],
      );
      const product = found[0];
      if (!product) throw new Error("أحد المنتجات غير موجود أو غير نشط.");
      const lineMinor = line.costMinor * line.quantity;
      if (!Number.isSafeInteger(lineMinor)) throw new Error("قيمة بند الشراء أكبر من النطاق المسموح.");
      subtotalMinor += lineMinor;
      if (!Number.isSafeInteger(subtotalMinor)) throw new Error("إجمالي فاتورة الشراء أكبر من النطاق المسموح.");
      rows.push({ product, quantity: line.quantity, costMinor: line.costMinor, lineMinor });
    }
    if (discountMinor > subtotalMinor) throw new Error("الخصم يتجاوز قيمة الشراء.");
    const totalMinor = subtotalMinor - discountMinor + taxMinor;
    if (!Number.isSafeInteger(totalMinor)) throw new Error("إجمالي فاتورة الشراء أكبر من النطاق المسموح.");
    if (paidMinor > totalMinor) throw new Error("المبلغ المدفوع يتجاوز إجمالي فاتورة الشراء.");

    await db.execute(
      `INSERT INTO purchase_orders(id, invoice_number, supplier_id, subtotal, discount, tax_amount, total, paid_amount, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'posted', ?)`,
      [purchaseId, invoiceNumber, input.supplierId, fromMinorUnits(subtotalMinor), fromMinorUnits(discountMinor), fromMinorUnits(taxMinor), fromMinorUnits(totalMinor), fromMinorUnits(paidMinor), input.notes?.trim() || null],
    );

    let allocatedDiscountMinor = 0;
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const allocated = index === rows.length - 1
        ? discountMinor - allocatedDiscountMinor
        : Number((BigInt(discountMinor) * BigInt(row.lineMinor)) / BigInt(subtotalMinor || 1));
      allocatedDiscountMinor += allocated;
      const netLineMinor = row.lineMinor - allocated;
      const effectiveUnitCostMinor = Math.round(netLineMinor / row.quantity);
      await db.execute(
        "INSERT INTO purchase_items(id, purchase_id, product_id, quantity, unit_cost, line_total) VALUES (?, ?, ?, ?, ?, ?)",
        [crypto.randomUUID(), purchaseId, row.product.id, row.quantity, fromMinorUnits(effectiveUnitCostMinor), fromMinorUnits(netLineMinor)],
      );
      const newQuantity = row.product.quantity + row.quantity;
      if (!Number.isSafeInteger(newQuantity)) throw new Error("كمية المخزون الجديدة أكبر من النطاق المسموح.");
      const oldValue = toMinorUnits(row.product.cost_price) * row.product.quantity;
      const newAverageCost = Math.round((oldValue + netLineMinor) / newQuantity);
      await db.execute(
        "UPDATE products SET quantity = ?, cost_price = ?, updated_at = datetime('now') WHERE id = ?",
        [newQuantity, fromMinorUnits(newAverageCost), row.product.id],
      );
      await db.execute(
        "INSERT INTO stock_movements(id, product_id, movement_type, quantity_delta, reference_type, reference_id, note) VALUES (?, ?, 'purchase', ?, 'purchase', ?, ?)",
        [crypto.randomUUID(), row.product.id, row.quantity, purchaseId, "فاتورة شراء " + invoiceNumber],
      );
    }
    if (paidMinor > 0) {
      let cashSessionId: string | null = null;
      if ((input.paymentMethod ?? "cash") === "cash") {
        const sessions = await db.select<Array<{ id: string; balance: number }>>(
          `SELECT cs.id, cs.opening_amount + COALESCE((SELECT SUM(CASE WHEN p.direction = 'in' THEN p.amount ELSE -p.amount END) FROM payments p WHERE p.cash_session_id = cs.id), 0) AS balance
           FROM cash_sessions cs WHERE cs.status = 'open' LIMIT 1`,
        );
        cashSessionId = sessions[0]?.id ?? null;
        if (!cashSessionId) throw new Error("افتح وردية الصندوق قبل تسجيل سداد نقدي.");
        if (toMinorUnits(sessions[0].balance) < paidMinor) throw new Error("رصيد الصندوق غير كافٍ لإتمام السداد النقدي.");
      }
      await db.execute(
        `INSERT INTO payments(id, direction, method, amount, reference_type, reference_id, note, cash_session_id)
         VALUES (?, 'out', ?, ?, 'purchase', ?, ?, ?)`,
        [crypto.randomUUID(), input.paymentMethod ?? "cash", fromMinorUnits(paidMinor), purchaseId, `سداد فاتورة شراء ${invoiceNumber}`, cashSessionId],
      );
    }
    const journalLines: JournalLineInput[] = [];
    const netInventoryMinor = subtotalMinor - discountMinor;
    if (netInventoryMinor > 0) journalLines.push({ accountCode: "1200", debitMinor: netInventoryMinor, memo: "إضافة المخزون بعد الخصم" });
    if (taxMinor > 0) journalLines.push({ accountCode: "1300", debitMinor: taxMinor, memo: "ضريبة المدخلات" });
    if (paidMinor > 0) journalLines.push({ accountCode: (input.paymentMethod ?? "cash") === "cash" ? "1000" : "1010", creditMinor: paidMinor, memo: "سداد المورد" });
    if (totalMinor - paidMinor > 0) journalLines.push({ accountCode: "2000", creditMinor: totalMinor - paidMinor, memo: "ذمم المورد" });
    if (journalLines.length >= 2) {
      await postJournalEntryInTransaction(db, {
        sourceType: "purchase", sourceId: purchaseId,
        description: "ترحيل القيد المحاسبي لفاتورة الشراء " + invoiceNumber,
        lines: journalLines,
      });
    }

    await db.execute(
      "INSERT INTO audit_logs(id, action, entity_type, entity_id, after_json) VALUES (?, 'purchase.received', 'purchase', ?, ?)",
      [crypto.randomUUID(), purchaseId, JSON.stringify({ invoiceNumber, total: fromMinorUnits(totalMinor), itemCount: rows.length })],
    );
    await db.execute("COMMIT");
    return { purchaseId, invoiceNumber, total: fromMinorUnits(totalMinor), paidAmount: fromMinorUnits(paidMinor), balanceDue: fromMinorUnits(totalMinor - paidMinor) };
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }
}

export interface RecentPurchase { id: string; invoiceNumber: string; supplierName: string; total: number; paidAmount: number; createdAt: string }
export async function listRecentPurchases(): Promise<RecentPurchase[]> {
  const db = await getDatabase();
  const rows = await db.select<Array<{ id: string; invoice_number: string; supplier_name: string; total: number; paid_amount: number; created_at: string }>>(
    `SELECT p.id, p.invoice_number, s.name AS supplier_name, p.total, p.paid_amount, p.created_at
     FROM purchase_orders p JOIN suppliers s ON s.id = p.supplier_id
     ORDER BY p.created_at DESC LIMIT 100`,
  );
  return rows.map((row) => ({ id: row.id, invoiceNumber: row.invoice_number, supplierName: row.supplier_name, total: row.total, paidAmount: row.paid_amount, createdAt: row.created_at }));
}
