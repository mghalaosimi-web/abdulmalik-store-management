import { getDatabase } from "./database";
import { fromMinorUnits, toMinorUnits } from "./money";
import { allocateRefundMinorUnits } from "./returns";
import { postJournalEntryInTransaction, type JournalLineInput } from "./accounting";

/** Return cap for a cumulative portion of the discounted purchase lines, rounded in minor units. */
export function calculatePurchaseReturnRefundCapMinor(
  purchaseTotalMinor: number,
  netSubtotalMinor: number,
  cumulativeReturnedBaseMinor: number,
  previousRefundMinor: number,
): number {
  const values = [purchaseTotalMinor, netSubtotalMinor, cumulativeReturnedBaseMinor, previousRefundMinor];
  if (values.some((value) => !Number.isSafeInteger(value) || value < 0) ||
      purchaseTotalMinor <= 0 || netSubtotalMinor <= 0 || cumulativeReturnedBaseMinor <= 0 ||
      cumulativeReturnedBaseMinor > netSubtotalMinor || previousRefundMinor > purchaseTotalMinor) {
    throw new Error("بيانات احتساب سقف مرتجع المشتريات غير صالحة.");
  }
  const numerator = BigInt(purchaseTotalMinor) * BigInt(cumulativeReturnedBaseMinor);
  const cap = Number((numerator + BigInt(netSubtotalMinor) / 2n) / BigInt(netSubtotalMinor));
  if (!Number.isSafeInteger(cap)) throw new Error("قيمة سقف مرتجع المشتريات أكبر من النطاق المسموح.");
  return Math.max(0, Math.min(purchaseTotalMinor - previousRefundMinor, cap - previousRefundMinor));
}

export interface PurchaseReturnLineInput { purchaseItemId: string; quantity: number }
export interface PurchaseReturnInput {
  purchaseId: string;
  items: PurchaseReturnLineInput[];
  refundAmount: number;
  refundMethod: "supplier_credit" | "cash" | "card" | "transfer" | "mobile_wallet" | "other";
  reason: string;
}
export interface ReturnablePurchaseItem {
  purchaseItemId: string;
  productId: string;
  productName: string;
  purchasedQuantity: number;
  returnedQuantity: number;
  remainingQuantity: number;
  availableStock: number;
  unitCost: number;
}
export interface PurchaseReturnResult {
  returnId: string;
  returnNumber: string;
  refundAmount: number;
  taxRefundAmount: number;
  inventoryValueReturned: number;
}

export async function listPurchaseReturnableItems(purchaseId: string): Promise<ReturnablePurchaseItem[]> {
  const db = await getDatabase();
  const rows = await db.select<Array<{
    purchase_item_id: string; product_id: string; product_name: string; purchased_quantity: number;
    returned_quantity: number; available_stock: number; unit_cost: number;
  }>>(
    `SELECT pi.id AS purchase_item_id, pi.product_id, p.name AS product_name,
            pi.quantity AS purchased_quantity,
            COALESCE((SELECT SUM(pri.quantity) FROM purchase_return_items pri WHERE pri.purchase_item_id = pi.id), 0) AS returned_quantity,
            p.quantity AS available_stock, pi.unit_cost
     FROM purchase_items pi JOIN products p ON p.id = pi.product_id
     WHERE pi.purchase_id = ? ORDER BY p.name COLLATE NOCASE`,
    [purchaseId],
  );
  return rows.map((row) => ({
    purchaseItemId: row.purchase_item_id, productId: row.product_id, productName: row.product_name,
    purchasedQuantity: row.purchased_quantity, returnedQuantity: row.returned_quantity,
    remainingQuantity: row.purchased_quantity - row.returned_quantity,
    availableStock: row.available_stock, unitCost: row.unit_cost,
  }));
}

export async function processPurchaseReturn(input: PurchaseReturnInput): Promise<PurchaseReturnResult> {
  if (!input.purchaseId || !input.items.length) throw new Error("حدد فاتورة الشراء والأصناف المراد إرجاعها.");
  const reason = input.reason.trim();
  if (reason.length < 4) throw new Error("سبب مرتجع المشتريات مطلوب للتدقيق.");
  const refundMinor = toMinorUnits(input.refundAmount);
  if (refundMinor <= 0) throw new Error("قيمة استرداد المورد يجب أن تكون أكبر من صفر.");
  const requested = new Map<string, number>();
  for (const line of input.items) {
    if (!line.purchaseItemId || !Number.isSafeInteger(line.quantity) || line.quantity <= 0) throw new Error("كمية مرتجع المشتريات غير صالحة.");
    requested.set(line.purchaseItemId, (requested.get(line.purchaseItemId) ?? 0) + line.quantity);
  }

  const db = await getDatabase();
  const returnId = crypto.randomUUID();
  const returnNumber = "PRT-" + new Date().toISOString().slice(0, 10).replaceAll("-", "") + "-" + crypto.randomUUID().slice(0, 8).toUpperCase();
  await db.execute("BEGIN IMMEDIATE");
  try {
    const purchases = await db.select<Array<{
      id: string; subtotal: number; discount: number; total: number; tax_amount: number;
      paid_amount: number; supplier_id: string; status: string;
    }>>(
      "SELECT id, subtotal, discount, total, tax_amount, paid_amount, supplier_id, status FROM purchase_orders WHERE id = ? LIMIT 1",
      [input.purchaseId],
    );
    const purchase = purchases[0];
    if (!purchase || purchase.status !== "posted") throw new Error("فاتورة الشراء غير موجودة أو لا تقبل المرتجعات.");
    const purchaseNetSubtotalMinor = toMinorUnits(purchase.subtotal) - toMinorUnits(purchase.discount);
    const purchaseTotalMinor = toMinorUnits(purchase.total);
    if (purchaseNetSubtotalMinor <= 0 || refundMinor > purchaseTotalMinor) throw new Error("قيمة المرتجع تتجاوز قيمة فاتورة الشراء.");

    const allLines = await db.select<Array<{
      id: string; product_id: string; quantity: number; line_total: number;
      unit_cost: number; product_name: string; available_stock: number; current_cost: number;
    }>>(
      `SELECT pi.id, pi.product_id, pi.quantity, pi.line_total, pi.unit_cost,
              p.name AS product_name, p.quantity AS available_stock, p.cost_price AS current_cost
       FROM purchase_items pi JOIN products p ON p.id = pi.product_id
       WHERE pi.purchase_id = ?`,
      [input.purchaseId],
    );
    const returnRows: Array<{
      purchaseItemId: string; productId: string; productName: string; quantity: number;
      lineValueMinor: number; inventoryValueMinor: number;
    }> = [];
    let currentReturnBaseMinor = 0;
    let previousReturnBaseMinor = 0;
    let inventoryValueMinor = 0;
    for (const line of allLines) {
      const prior = await db.select<Array<{ quantity: number }>>(
        "SELECT COALESCE(SUM(quantity), 0) AS quantity FROM purchase_return_items WHERE purchase_item_id = ?",
        [line.id],
      );
      const returnedQuantity = prior[0]?.quantity ?? 0;
      const requestedQuantity = requested.get(line.id) ?? 0;
      if (requestedQuantity > line.quantity - returnedQuantity) throw new Error(`كمية المرتجع تتجاوز الكمية المتبقية من فاتورة الشراء: ${line.product_name}.`);
      if (requestedQuantity > line.available_stock) throw new Error(`المخزون الحالي لا يكفي لإرجاع ${requestedQuantity} من ${line.product_name}؛ لا يمكن إعادة كمية تم بيعها أو استهلاكها.`);
      const originalLineValueMinor = toMinorUnits(line.line_total);
      previousReturnBaseMinor += Math.round(originalLineValueMinor * returnedQuantity / line.quantity);
      if (requestedQuantity > 0) {
        const lineValueMinor = Math.round(originalLineValueMinor * requestedQuantity / line.quantity);
        const currentInventoryValueMinor = toMinorUnits(line.current_cost) * requestedQuantity;
        currentReturnBaseMinor += lineValueMinor;
        inventoryValueMinor += currentInventoryValueMinor;
        returnRows.push({
          purchaseItemId: line.id, productId: line.product_id, productName: line.product_name,
          quantity: requestedQuantity, lineValueMinor, inventoryValueMinor: currentInventoryValueMinor,
        });
      }
    }
    if (returnRows.length !== requested.size) throw new Error("أحد بنود فاتورة الشراء غير موجود.");
    if (!returnRows.length) throw new Error("لا توجد كميات صالحة للإرجاع.");
    if (![currentReturnBaseMinor, previousReturnBaseMinor, inventoryValueMinor].every(Number.isSafeInteger)) {
      throw new Error("قيمة أو تكلفة مرتجع المشتريات أكبر من النطاق المسموح.");
    }

    const priorReturns = await db.select<Array<{
      refund_amount: number; supplier_credits: number; cash_refunds: number;
    }>>(
      `SELECT COALESCE(SUM(refund_amount), 0) AS refund_amount,
              COALESCE(SUM(CASE WHEN refund_method = 'supplier_credit' THEN refund_amount ELSE 0 END), 0) AS supplier_credits,
              COALESCE(SUM(CASE WHEN refund_method <> 'supplier_credit' THEN refund_amount ELSE 0 END), 0) AS cash_refunds
       FROM purchase_returns WHERE purchase_id = ?`,
      [input.purchaseId],
    );
    const previousRefundMinor = toMinorUnits(priorReturns[0]?.refund_amount ?? 0);
    const previousSupplierCreditMinor = toMinorUnits(priorReturns[0]?.supplier_credits ?? 0);
    const previousCashRefundMinor = toMinorUnits(priorReturns[0]?.cash_refunds ?? 0);
    const cumulativeReturnBaseMinor = previousReturnBaseMinor + currentReturnBaseMinor;
    const remainingRefundCapMinor = calculatePurchaseReturnRefundCapMinor(
      purchaseTotalMinor, purchaseNetSubtotalMinor, cumulativeReturnBaseMinor, previousRefundMinor,
    );
    if (refundMinor > remainingRefundCapMinor) throw new Error("مبلغ الاسترداد يتجاوز قيمة الأصناف المرتجعة بعد احتساب الخصم والضريبة.");

    if (input.refundMethod === "supplier_credit") {
      const availablePayableMinor = Math.max(0, purchaseTotalMinor - toMinorUnits(purchase.paid_amount) - previousSupplierCreditMinor);
      if (refundMinor > availablePayableMinor) throw new Error("رصيد المورد غير المدفوع لا يكفي لإضافة هذا المبلغ كرصيد دائن؛ استخدم طريقة استرداد فعلية للمبالغ المدفوعة.");
    } else {
      const availablePaidMinor = Math.max(0, toMinorUnits(purchase.paid_amount) - previousCashRefundMinor);
      if (refundMinor > availablePaidMinor) throw new Error("لا يمكن استرداد مبلغ أكبر مما تم دفعه فعلياً للمورد.");
    }

    let cashSessionId: string | null = null;
    if (input.refundMethod === "cash") {
      const sessions = await db.select<Array<{ id: string }>>("SELECT id FROM cash_sessions WHERE status = 'open' LIMIT 1");
      cashSessionId = sessions[0]?.id ?? null;
      if (!cashSessionId) throw new Error("افتح وردية الصندوق قبل استلام استرداد نقدي من المورد.");
    }

    const taxRefundMinor = purchaseTotalMinor > 0
      ? Math.min(refundMinor, Math.round((toMinorUnits(purchase.tax_amount) * refundMinor) / purchaseTotalMinor))
      : 0;
    const itemRefundAllocations = allocateRefundMinorUnits(refundMinor, returnRows.map((row) => row.lineValueMinor));
    await db.execute(
      `INSERT INTO purchase_returns(id, return_number, purchase_id, refund_amount, tax_refund_amount, inventory_value_returned, refund_method, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [returnId, returnNumber, input.purchaseId, fromMinorUnits(refundMinor), fromMinorUnits(taxRefundMinor), fromMinorUnits(inventoryValueMinor), input.refundMethod, reason],
    );

    for (const [index, row] of returnRows.entries()) {
      await db.execute(
        `INSERT INTO purchase_return_items(id, return_id, purchase_item_id, quantity, refund_amount, inventory_value_returned)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), returnId, row.purchaseItemId, row.quantity, fromMinorUnits(itemRefundAllocations[index]), fromMinorUnits(row.inventoryValueMinor)],
      );
      const updated = await db.execute(
        "UPDATE products SET quantity = quantity - ?, updated_at = datetime('now') WHERE id = ? AND quantity >= ?",
        [row.quantity, row.productId, row.quantity],
      );
      if (updated.rowsAffected !== 1) throw new Error(`تعذر خصم الكمية المرتجعة من مخزون ${row.productName}.`);
      await db.execute(
        `INSERT INTO stock_movements(id, product_id, movement_type, quantity_delta, reference_type, reference_id, note)
         VALUES (?, ?, 'purchase_return', ?, 'purchase_return', ?, ?)`,
        [crypto.randomUUID(), row.productId, -row.quantity, returnId, "مرتجع فاتورة شراء " + returnNumber],
      );
    }

    if (input.refundMethod !== "supplier_credit") {
      await db.execute(
        `INSERT INTO payments(id, direction, method, amount, reference_type, reference_id, note, cash_session_id)
         VALUES (?, 'in', ?, ?, 'purchase_return', ?, ?, ?)`,
        [crypto.randomUUID(), input.refundMethod, fromMinorUnits(refundMinor), returnId, "استرداد مرتجع شراء " + returnNumber, cashSessionId],
      );
    }

    const journalLines: JournalLineInput[] = [{
      accountCode: input.refundMethod === "supplier_credit" ? "2000" : input.refundMethod === "cash" ? "1000" : "1010",
      debitMinor: refundMinor,
      memo: input.refundMethod === "supplier_credit" ? "تخفيض ذمم المورد" : "استرداد من المورد",
    }];
    if (taxRefundMinor > 0) journalLines.push({ accountCode: "1300", creditMinor: taxRefundMinor, memo: "عكس ضريبة المدخلات" });
    if (inventoryValueMinor > 0) journalLines.push({ accountCode: "1200", creditMinor: inventoryValueMinor, memo: "إخراج البضاعة المرتجعة من المخزون" });
    const varianceMinor = refundMinor - taxRefundMinor - inventoryValueMinor;
    if (varianceMinor > 0) journalLines.push({ accountCode: "5100", creditMinor: varianceMinor, memo: "فرق مردودات المشتريات" });
    if (varianceMinor < 0) journalLines.push({ accountCode: "5100", debitMinor: -varianceMinor, memo: "فرق تكلفة مردودات المشتريات" });
    await postJournalEntryInTransaction(db, {
      sourceType: "purchase_return", sourceId: returnId,
      description: "قيد مرتجع المشتريات " + returnNumber,
      lines: journalLines,
    });
    await db.execute(
      "INSERT INTO audit_logs(id, action, entity_type, entity_id, after_json) VALUES (?, 'purchase.returned', 'purchase_return', ?, ?)",
      [crypto.randomUUID(), returnId, JSON.stringify({ purchaseId: input.purchaseId, refund: fromMinorUnits(refundMinor), reason })],
    );
    await db.execute("COMMIT");
    return {
      returnId, returnNumber, refundAmount: fromMinorUnits(refundMinor),
      taxRefundAmount: fromMinorUnits(taxRefundMinor), inventoryValueReturned: fromMinorUnits(inventoryValueMinor),
    };
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }
}
