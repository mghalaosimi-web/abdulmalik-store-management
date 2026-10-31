import { getDatabase } from "./database";
import { fromMinorUnits, toMinorUnits } from "./money";
import { postJournalEntryInTransaction } from "./accounting";

export type SettlementMethod = "cash" | "card" | "transfer" | "mobile_wallet" | "other";
export interface PartyBalance { id: string; name: string; documentCount: number; gross: number; settled: number; balance: number }

export async function listCustomerBalances(): Promise<PartyBalance[]> {
  const db = await getDatabase();
  const rows = await db.select<Array<{
    id: string; name: string; document_count: number; gross: number; initial_paid: number;
    later_paid: number; credits: number;
  }>>(
    `SELECT c.id, c.name, COUNT(s.id) AS document_count,
            COALESCE(SUM(s.total), 0) AS gross,
            COALESCE(SUM(s.paid_amount), 0) AS initial_paid,
            COALESCE(SUM((SELECT SUM(a.amount) FROM sale_payment_allocations a WHERE a.sale_id = s.id)), 0) AS later_paid,
            COALESCE(SUM((SELECT SUM(r.refund_amount) FROM sale_returns r WHERE r.sale_id = s.id AND r.refund_method = 'customer_credit')), 0) AS credits
     FROM customers c LEFT JOIN sales s ON s.customer_id = c.id AND s.status IN ('posted','returned')
     GROUP BY c.id, c.name ORDER BY c.name COLLATE NOCASE`,
  );
  return rows.map((row) => {
    const settled = row.initial_paid + row.later_paid + row.credits;
    return { id: row.id, name: row.name, documentCount: row.document_count, gross: row.gross, settled, balance: Math.max(0, row.gross - settled) };
  });
}

export async function listSupplierBalances(): Promise<PartyBalance[]> {
  const db = await getDatabase();
  const rows = await db.select<Array<{
    id: string; name: string; document_count: number; gross: number; initial_paid: number; later_paid: number;
  }>>(
    `SELECT s.id, s.name, COUNT(p.id) AS document_count,
            COALESCE(SUM(p.total), 0) AS gross,
            COALESCE(SUM(p.paid_amount), 0) AS initial_paid,
            COALESCE(SUM((SELECT SUM(a.amount) FROM purchase_payment_allocations a WHERE a.purchase_id = p.id)), 0) AS later_paid
     FROM suppliers s LEFT JOIN purchase_orders p ON p.supplier_id = s.id AND p.status = 'posted'
     GROUP BY s.id, s.name ORDER BY s.name COLLATE NOCASE`,
  );
  return rows.map((row) => {
    const settled = row.initial_paid + row.later_paid;
    return { id: row.id, name: row.name, documentCount: row.document_count, gross: row.gross, settled, balance: Math.max(0, row.gross - settled) };
  });
}

export async function receiveCustomerPayment(input: { customerId: string; amount: number; method: SettlementMethod; note?: string }): Promise<string> {
  const amountMinor = toMinorUnits(input.amount);
  if (amountMinor <= 0) throw new Error("مبلغ التحصيل يجب أن يكون أكبر من صفر.");
  const db = await getDatabase();
  const paymentId = crypto.randomUUID();
  await db.execute("BEGIN IMMEDIATE");
  try {
    const customers = await db.select<Array<{ id: string }>>("SELECT id FROM customers WHERE id = ? LIMIT 1", [input.customerId]);
    if (!customers[0]) throw new Error("العميل غير موجود.");
    const invoices = await db.select<Array<{
      id: string; total: number; paid_amount: number; later_paid: number; credits: number;
    }>>(
      `SELECT s.id, s.total, s.paid_amount,
              COALESCE((SELECT SUM(a.amount) FROM sale_payment_allocations a WHERE a.sale_id = s.id), 0) AS later_paid,
              COALESCE((SELECT SUM(r.refund_amount) FROM sale_returns r WHERE r.sale_id = s.id AND r.refund_method = 'customer_credit'), 0) AS credits
       FROM sales s WHERE s.customer_id = ? AND s.status IN ('posted','returned')
       ORDER BY s.created_at ASC, s.invoice_number ASC`,
      [input.customerId],
    );
    const allocations: Array<{ saleId: string; amountMinor: number }> = [];
    let remaining = amountMinor;
    let outstandingTotal = 0;
    for (const invoice of invoices) {
      const due = Math.max(0, toMinorUnits(invoice.total) - toMinorUnits(invoice.paid_amount) - toMinorUnits(invoice.later_paid) - toMinorUnits(invoice.credits));
      outstandingTotal += due;
      if (remaining <= 0 || due <= 0) continue;
      const allocation = Math.min(remaining, due);
      allocations.push({ saleId: invoice.id, amountMinor: allocation });
      remaining -= allocation;
    }
    if (remaining > 0) throw new Error(`مبلغ التحصيل يتجاوز رصيد العميل المستحق. الرصيد المتاح: ${fromMinorUnits(outstandingTotal).toFixed(2)}.`);

    let cashSessionId: string | null = null;
    if (input.method === "cash") {
      const sessions = await db.select<Array<{ id: string }>>("SELECT id FROM cash_sessions WHERE status = 'open' LIMIT 1");
      cashSessionId = sessions[0]?.id ?? null;
      if (!cashSessionId) throw new Error("افتح وردية الصندوق قبل استلام مبلغ نقدي.");
    }
    await db.execute(
      `INSERT INTO payments(id, direction, method, amount, reference_type, reference_id, note, cash_session_id)
       VALUES (?, 'in', ?, ?, 'customer_receipt', ?, ?, ?)`,
      [paymentId, input.method, fromMinorUnits(amountMinor), input.customerId, input.note?.trim() || "تحصيل من العميل", cashSessionId],
    );
    for (const allocation of allocations) {
      await db.execute(
        "INSERT INTO sale_payment_allocations(id, payment_id, sale_id, amount) VALUES (?, ?, ?, ?)",
        [crypto.randomUUID(), paymentId, allocation.saleId, fromMinorUnits(allocation.amountMinor)],
      );
    }
    await postJournalEntryInTransaction(db, {
      sourceType: "customer_receipt", sourceId: paymentId,
      description: "تحصيل من العميل",
      lines: [
        { accountCode: input.method === "cash" ? "1000" : "1010", debitMinor: amountMinor, memo: "استلام دفعة العميل" },
        { accountCode: "1100", creditMinor: amountMinor, memo: "تخفيض الذمم المدينة" },
      ],
    });
    await db.execute("INSERT INTO audit_logs(id, action, entity_type, entity_id, after_json) VALUES (?, 'customer.payment_received', 'customer', ?, ?)", [crypto.randomUUID(), input.customerId, JSON.stringify({ paymentId, amount: fromMinorUnits(amountMinor), allocations })]);
    await db.execute("COMMIT");
    return paymentId;
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }
}

export async function paySupplier(input: { supplierId: string; amount: number; method: SettlementMethod; note?: string }): Promise<string> {
  const amountMinor = toMinorUnits(input.amount);
  if (amountMinor <= 0) throw new Error("مبلغ السداد يجب أن يكون أكبر من صفر.");
  const db = await getDatabase();
  const paymentId = crypto.randomUUID();
  await db.execute("BEGIN IMMEDIATE");
  try {
    const suppliers = await db.select<Array<{ id: string }>>("SELECT id FROM suppliers WHERE id = ? LIMIT 1", [input.supplierId]);
    if (!suppliers[0]) throw new Error("المورد غير موجود.");
    const invoices = await db.select<Array<{ id: string; total: number; paid_amount: number; later_paid: number }>>(
      `SELECT p.id, p.total, p.paid_amount,
              COALESCE((SELECT SUM(a.amount) FROM purchase_payment_allocations a WHERE a.purchase_id = p.id), 0) AS later_paid
       FROM purchase_orders p WHERE p.supplier_id = ? AND p.status = 'posted'
       ORDER BY p.created_at ASC, p.invoice_number ASC`,
      [input.supplierId],
    );
    const allocations: Array<{ purchaseId: string; amountMinor: number }> = [];
    let remaining = amountMinor;
    let outstandingTotal = 0;
    for (const invoice of invoices) {
      const due = Math.max(0, toMinorUnits(invoice.total) - toMinorUnits(invoice.paid_amount) - toMinorUnits(invoice.later_paid));
      outstandingTotal += due;
      if (remaining <= 0 || due <= 0) continue;
      const allocation = Math.min(remaining, due);
      allocations.push({ purchaseId: invoice.id, amountMinor: allocation });
      remaining -= allocation;
    }
    if (remaining > 0) throw new Error(`مبلغ السداد يتجاوز رصيد المورد المستحق. الرصيد المتاح: ${fromMinorUnits(outstandingTotal).toFixed(2)}.`);

    let cashSessionId: string | null = null;
    if (input.method === "cash") {
      const sessions = await db.select<Array<{ id: string; balance: number }>>(
        `SELECT cs.id, cs.opening_amount + COALESCE((SELECT SUM(CASE WHEN p.direction = 'in' THEN p.amount ELSE -p.amount END) FROM payments p WHERE p.cash_session_id = cs.id), 0) AS balance
         FROM cash_sessions cs WHERE cs.status = 'open' LIMIT 1`,
      );
      cashSessionId = sessions[0]?.id ?? null;
      if (!cashSessionId) throw new Error("افتح وردية الصندوق قبل السداد النقدي للمورد.");
      if (toMinorUnits(sessions[0].balance) < amountMinor) throw new Error("رصيد الصندوق غير كافٍ لسداد المورد نقداً.");
    }
    await db.execute(
      `INSERT INTO payments(id, direction, method, amount, reference_type, reference_id, note, cash_session_id)
       VALUES (?, 'out', ?, ?, 'supplier_payment', ?, ?, ?)`,
      [paymentId, input.method, fromMinorUnits(amountMinor), input.supplierId, input.note?.trim() || "سداد للمورد", cashSessionId],
    );
    for (const allocation of allocations) {
      await db.execute(
        "INSERT INTO purchase_payment_allocations(id, payment_id, purchase_id, amount) VALUES (?, ?, ?, ?)",
        [crypto.randomUUID(), paymentId, allocation.purchaseId, fromMinorUnits(allocation.amountMinor)],
      );
    }
    await postJournalEntryInTransaction(db, {
      sourceType: "supplier_payment", sourceId: paymentId,
      description: "سداد مستحقات المورد",
      lines: [
        { accountCode: "2000", debitMinor: amountMinor, memo: "تخفيض الذمم الدائنة" },
        { accountCode: input.method === "cash" ? "1000" : "1010", creditMinor: amountMinor, memo: "سداد المورد" },
      ],
    });
    await db.execute("INSERT INTO audit_logs(id, action, entity_type, entity_id, after_json) VALUES (?, 'supplier.payment_made', 'supplier', ?, ?)", [crypto.randomUUID(), input.supplierId, JSON.stringify({ paymentId, amount: fromMinorUnits(amountMinor), allocations })]);
    await db.execute("COMMIT");
    return paymentId;
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }
}
