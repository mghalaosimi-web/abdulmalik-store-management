import { getDatabase } from "./database";
import { fromMinorUnits, toMinorUnits } from "./money";
import { postJournalEntryInTransaction, type JournalLineInput } from "./accounting";

export interface SaleReturnLineInput { saleItemId: string; quantity: number }
export interface SaleReturnInput {
  saleId: string;
  items: SaleReturnLineInput[];
  refundAmount: number;
  refundMethod: "cash" | "card" | "transfer" | "mobile_wallet" | "other" | "customer_credit";
  reason: string;
}
export interface SaleReturnResult { returnId: string; returnNumber: string; refundAmount: number; taxRefundAmount: number; costReturned: number }
export interface ReturnableSaleItem {
  saleItemId: string; productId: string; productName: string; soldQuantity: number;
  returnedQuantity: number; remainingQuantity: number; unitPrice: number; unitCost: number;
}

/** Distribute a refund across returned lines without losing or creating minor units. */
export function allocateRefundMinorUnits(totalRefundMinor: number, lineValueMinor: number[]): number[] {
  if (!Number.isSafeInteger(totalRefundMinor) || totalRefundMinor <= 0 || lineValueMinor.length === 0 ||
      lineValueMinor.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error("بيانات توزيع مبلغ المرتجع غير صالحة.");
  }
  const totalValue = lineValueMinor.reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(totalValue) || totalValue <= 0) throw new Error("قيمة الأصناف المرتجعة غير صالحة.");
  let cumulativeValue = 0;
  let allocated = 0;
  return lineValueMinor.map((value, index) => {
    cumulativeValue += value;
    const cumulativeAllocation = index === lineValueMinor.length - 1
      ? totalRefundMinor
      : Math.round((totalRefundMinor * cumulativeValue) / totalValue);
    const amount = cumulativeAllocation - allocated;
    allocated = cumulativeAllocation;
    return amount;
  });
}

export async function listSaleReturnableItems(saleId: string): Promise<ReturnableSaleItem[]> {
  const db = await getDatabase();
  const rows = await db.select<Array<{
    sale_item_id: string; product_id: string; product_name: string; sold_quantity: number;
    returned_quantity: number; unit_price: number; unit_cost: number;
  }>>(
    `SELECT si.id AS sale_item_id, si.product_id, p.name AS product_name,
            si.quantity AS sold_quantity,
            COALESCE((SELECT SUM(sri.quantity) FROM sale_return_items sri WHERE sri.sale_item_id = si.id), 0) AS returned_quantity,
            si.unit_price, si.unit_cost
     FROM sale_items si JOIN products p ON p.id = si.product_id
     WHERE si.sale_id = ? ORDER BY p.name COLLATE NOCASE`,
    [saleId],
  );
  return rows.map((row) => ({
    saleItemId: row.sale_item_id, productId: row.product_id, productName: row.product_name,
    soldQuantity: row.sold_quantity, returnedQuantity: row.returned_quantity,
    remainingQuantity: row.sold_quantity - row.returned_quantity,
    unitPrice: row.unit_price, unitCost: row.unit_cost,
  }));
}

export async function processSaleReturn(input: SaleReturnInput): Promise<SaleReturnResult> {
  if (!input.saleId || !input.items.length) throw new Error("حدد الفاتورة والأصناف المراد إرجاعها.");
  const reason = input.reason.trim();
  if (reason.length < 4) throw new Error("سبب المرتجع مطلوب للتدقيق.");
  const refundMinor = toMinorUnits(input.refundAmount);
  if (refundMinor <= 0) throw new Error("قيمة المبلغ المسترد يجب أن تكون أكبر من صفر.");
  const requested = new Map<string, number>();
  for (const line of input.items) {
    if (!line.saleItemId || !Number.isSafeInteger(line.quantity) || line.quantity <= 0) throw new Error("كمية المرتجع غير صالحة.");
    requested.set(line.saleItemId, (requested.get(line.saleItemId) ?? 0) + line.quantity);
  }

  const db = await getDatabase();
  const returnId = crypto.randomUUID();
  const returnNumber = "RET-" + new Date().toISOString().slice(0, 10).replaceAll("-", "") + "-" + crypto.randomUUID().slice(0, 8).toUpperCase();
  await db.execute("BEGIN IMMEDIATE");
  try {
    const sales = await db.select<Array<{ id: string; subtotal: number; total: number; tax_amount: number; paid_amount: number; later_paid: number; customer_id: string | null; status: string }>>(
      `SELECT s.id, s.subtotal, s.total, s.tax_amount, s.paid_amount, s.customer_id, s.status,
              COALESCE((SELECT SUM(a.amount) FROM sale_payment_allocations a WHERE a.sale_id = s.id), 0) AS later_paid
       FROM sales s WHERE s.id = ? LIMIT 1`, [input.saleId],
    );
    const sale = sales[0];
    if (!sale || !["posted", "returned"].includes(sale.status)) throw new Error("الفاتورة غير موجودة أو لا تقبل المرتجعات.");
    const saleSubtotalMinor = toMinorUnits(sale.subtotal);
    const saleTotalMinor = toMinorUnits(sale.total);
    if (saleSubtotalMinor <= 0 || refundMinor > saleTotalMinor) throw new Error("قيمة المرتجع تتجاوز قيمة الفاتورة.");

    const allLines = await db.select<Array<{
      id: string; product_id: string; quantity: number; unit_price: number;
      unit_cost: number; line_total: number; product_unit_id: string | null;
    }>>(
      "SELECT id, product_id, quantity, unit_price, unit_cost, product_unit_id FROM sale_items WHERE sale_id = ?", [input.saleId],
    );
    const returnRows: Array<{ saleItemId: string; productId: string; quantity: number; valueMinor: number; costMinor: number; productUnitId: string | null }> = [];
    let currentReturnValueMinor = 0;
    let currentCostMinor = 0;
    let previousReturnValueMinor = 0;
    for (const line of allLines) {
      const prior = await db.select<Array<{ quantity: number }>>(
        "SELECT COALESCE(SUM(quantity), 0) AS quantity FROM sale_return_items WHERE sale_item_id = ?", [line.id],
      );
      const returnedQuantity = prior[0]?.quantity ?? 0;
      const requestedQuantity = requested.get(line.id) ?? 0;
      if (requestedQuantity > line.quantity - returnedQuantity) throw new Error("كمية المرتجع تتجاوز الكمية المتبقية من أحد الأصناف.");
      const originalLineValue = toMinorUnits(line.line_total);
      previousReturnValueMinor += Math.round(originalLineValue * returnedQuantity / line.quantity);
      if (requestedQuantity > 0) {
        const valueMinor = Math.round(originalLineValue * requestedQuantity / line.quantity);
        const costMinor = toMinorUnits(line.unit_cost) * requestedQuantity;
        currentReturnValueMinor += valueMinor;
        currentCostMinor += costMinor;
        returnRows.push({ saleItemId: line.id, productId: line.product_id, quantity: requestedQuantity, valueMinor, costMinor, productUnitId: line.product_unit_id });
      }
    }
    if (returnRows.length !== requested.size) throw new Error("أحد بنود الفاتورة غير موجود.");
    if (!returnRows.length) throw new Error("لا توجد كميات صالحة للإرجاع.");

    const priorReturns = await db.select<Array<{ refund_amount: number; cash_refunds: number; customer_credits: number }>>(
      `SELECT COALESCE(SUM(refund_amount), 0) AS refund_amount,
              COALESCE(SUM(CASE WHEN refund_method <> 'customer_credit' THEN refund_amount ELSE 0 END), 0) AS cash_refunds,
              COALESCE(SUM(CASE WHEN refund_method = 'customer_credit' THEN refund_amount ELSE 0 END), 0) AS customer_credits
       FROM sale_returns WHERE sale_id = ?`, [input.saleId],
    );
    const previousRefundMinor = toMinorUnits(priorReturns[0]?.refund_amount ?? 0);
    const previousCashRefundMinor = toMinorUnits(priorReturns[0]?.cash_refunds ?? 0);
    const previousCustomerCreditMinor = toMinorUnits(priorReturns[0]?.customer_credits ?? 0);
    const cumulativeReturnValueMinor = Math.round(previousReturnValueMinor + currentReturnValueMinor);
    const cumulativeRefundCap = Math.round((saleTotalMinor * cumulativeReturnValueMinor) / saleSubtotalMinor);
    const remainingRefundCap = Math.min(saleTotalMinor - previousRefundMinor, cumulativeRefundCap - previousRefundMinor);
    if (refundMinor > remainingRefundCap) throw new Error("المبلغ المسترد يتجاوز القيمة المتاحة للأصناف المرتجعة بعد احتساب خصم وضريبة الفاتورة.");
    if (input.refundMethod === "customer_credit") {
      if (!sale.customer_id) throw new Error("لا يمكن ترحيل رصيد عميل لعملية بيع نقدية غير مرتبطة بعميل.");
      const totalPaidMinor = toMinorUnits(sale.paid_amount) + toMinorUnits(sale.later_paid);
      const availableCreditMinor = Math.max(0, saleTotalMinor - totalPaidMinor - previousCustomerCreditMinor);
      if (refundMinor > availableCreditMinor) throw new Error("قيمة الرصيد الدائن تتجاوز المبلغ المستحق على العميل في هذه الفاتورة.");
    } else {
      const totalPaidMinor = toMinorUnits(sale.paid_amount) + toMinorUnits(sale.later_paid);
      const availablePaidMinor = Math.max(0, totalPaidMinor - previousCashRefundMinor);
      if (refundMinor > availablePaidMinor) throw new Error("لا يمكن رد مبلغ أكبر مما تم تحصيله فعلياً؛ استخدم خصم رصيد العميل للجزء المستحق غير المدفوع.");
    }

    let cashSessionId: string | null = null;
    if (input.refundMethod === "cash") {
      const sessions = await db.select<Array<{ id: string; balance: number }>>(
        `SELECT cs.id, cs.opening_amount + COALESCE((SELECT SUM(CASE WHEN p.direction = 'in' THEN p.amount ELSE -p.amount END) FROM payments p WHERE p.cash_session_id = cs.id), 0) AS balance
         FROM cash_sessions cs WHERE cs.status = 'open' LIMIT 1`,
      );
      cashSessionId = sessions[0]?.id ?? null;
      if (!cashSessionId) throw new Error("افتح وردية الصندوق قبل رد مبلغ نقدي.");
      if (toMinorUnits(sessions[0].balance) < refundMinor) throw new Error("رصيد الصندوق غير كافٍ لصرف المرتجع نقداً.");
    }

    const taxRefundMinor = saleTotalMinor > 0
      ? Math.min(refundMinor, Math.round((toMinorUnits(sale.tax_amount) * refundMinor) / saleTotalMinor))
      : 0;
    await db.execute(
      `INSERT INTO sale_returns(id, return_number, sale_id, refund_amount, tax_refund_amount, cost_returned, refund_method, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [returnId, returnNumber, input.saleId, fromMinorUnits(refundMinor), fromMinorUnits(taxRefundMinor), fromMinorUnits(currentCostMinor), input.refundMethod, reason],
    );

    const itemRefundAllocations = allocateRefundMinorUnits(refundMinor, returnRows.map((row) => row.valueMinor));
    for (const [index, row] of returnRows.entries()) {
      await db.execute(
        `INSERT INTO sale_return_items(id, return_id, sale_item_id, quantity, refund_amount, cost_returned)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), returnId, row.saleItemId, row.quantity, fromMinorUnits(itemRefundAllocations[index]), fromMinorUnits(row.costMinor)],
      );
      await db.execute(
        "UPDATE products SET quantity = quantity + ?, updated_at = datetime('now') WHERE id = ?",
        [row.quantity, row.productId],
      );
      await db.execute(
        `INSERT INTO stock_movements(id, product_id, movement_type, quantity_delta, reference_type, reference_id, note)
         VALUES (?, ?, 'sale_return', ?, 'sale_return', ?, ?)`,
        [crypto.randomUUID(), row.productId, row.quantity, returnId, "مرتجع فاتورة " + returnNumber],
      );
      if (row.productUnitId) {
        await db.execute("UPDATE product_units SET status = 'in_stock' WHERE id = ? AND status = 'sold'", [row.productUnitId]);
      }
    }

    if (input.refundMethod !== "customer_credit") {
      await db.execute(
        `INSERT INTO payments(id, direction, method, amount, reference_type, reference_id, note, cash_session_id)
         VALUES (?, 'out', ?, ?, 'sale_return', ?, ?, ?)`,
        [crypto.randomUUID(), input.refundMethod, fromMinorUnits(refundMinor), returnId, "صرف مرتجع " + returnNumber, cashSessionId],
      );
    }

    const journalLines: JournalLineInput[] = [];
    const netRefundMinor = refundMinor - taxRefundMinor;
    if (netRefundMinor > 0) journalLines.push({ accountCode: "4100", debitMinor: netRefundMinor, memo: "مرتجعات المبيعات" });
    if (taxRefundMinor > 0) journalLines.push({ accountCode: "2100", debitMinor: taxRefundMinor, memo: "عكس ضريبة المخرجات" });
    journalLines.push({ accountCode: input.refundMethod === "customer_credit" ? "1100" : input.refundMethod === "cash" ? "1000" : "1010", creditMinor: refundMinor, memo: input.refundMethod === "customer_credit" ? "تخفيض ذمم العميل" : "رد قيمة المرتجع" });
    if (currentCostMinor > 0) {
      journalLines.push({ accountCode: "1200", debitMinor: currentCostMinor, memo: "إعادة البضاعة للمخزون" });
      journalLines.push({ accountCode: "5000", creditMinor: currentCostMinor, memo: "عكس تكلفة البضاعة المباعة" });
    }
    await postJournalEntryInTransaction(db, {
      sourceType: "sale_return", sourceId: returnId,
      description: "قيد مرتجع المبيعات " + returnNumber,
      lines: journalLines,
    });
    await db.execute(
      "INSERT INTO audit_logs(id, action, entity_type, entity_id, after_json) VALUES (?, 'sale.returned', 'sale_return', ?, ?)",
      [crypto.randomUUID(), returnId, JSON.stringify({ saleId: input.saleId, refund: fromMinorUnits(refundMinor), reason })],
    );
    await db.execute("COMMIT");
    return { returnId, returnNumber, refundAmount: fromMinorUnits(refundMinor), taxRefundAmount: fromMinorUnits(taxRefundMinor), costReturned: fromMinorUnits(currentCostMinor) };
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }
}
