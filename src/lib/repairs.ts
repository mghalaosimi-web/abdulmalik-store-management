import { getDatabase } from "./database";
import { isValidImei } from "./validation";

export type RepairStatus = "received" | "diagnosing" | "waiting_parts" | "in_progress" | "completed" | "delivered" | "cancelled";

const transitions: Record<RepairStatus, RepairStatus[]> = {
  received: ["diagnosing", "cancelled"],
  diagnosing: ["waiting_parts", "in_progress", "cancelled"],
  waiting_parts: ["in_progress", "cancelled"],
  in_progress: ["waiting_parts", "completed", "cancelled"],
  completed: ["delivered"],
  delivered: [],
  cancelled: [],
};

export interface RepairInput {
  jobNumber: string;
  customerId?: string | null;
  deviceType: string;
  deviceModel?: string;
  imei?: string;
  reportedIssue: string;
  intakeCondition?: string;
  estimatedCost?: number;
}

export async function createRepair(input: RepairInput): Promise<string> {
  if (input.jobNumber.trim().length < 3) throw new Error("رقم طلب الصيانة غير صالح.");
  if (input.deviceType.trim().length < 2 || input.reportedIssue.trim().length < 5) throw new Error("أدخل نوع الجهاز ووصف العطل بشكل صحيح.");
  if (input.imei?.trim() && !isValidImei(input.imei)) throw new Error("رقم IMEI المدخل غير صالح.");
  if ((input.estimatedCost ?? 0) < 0 || !Number.isFinite(input.estimatedCost ?? 0)) throw new Error("التكلفة التقديرية غير صالحة.");
  const db = await getDatabase();
  const id = crypto.randomUUID();
  await db.execute("BEGIN IMMEDIATE");
  try {
    await db.execute(
      `INSERT INTO repairs(id, job_number, customer_id, device_type, device_model, imei, reported_issue, intake_condition, estimated_cost)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.jobNumber.trim(), input.customerId || null, input.deviceType.trim(), input.deviceModel?.trim() || null, input.imei?.trim() || null, input.reportedIssue.trim(), input.intakeCondition?.trim() || null, input.estimatedCost ?? 0],
    );
    await db.execute(
      `INSERT INTO repair_status_history(id, repair_id, from_status, to_status, note)
       VALUES (?, ?, NULL, 'received', 'تم استلام الجهاز')`,
      [crypto.randomUUID(), id],
    );
    await db.execute(
      `INSERT INTO audit_logs(id, action, entity_type, entity_id)
       VALUES (?, 'repair.created', 'repair', ?)`,
      [crypto.randomUUID(), id],
    );
    await db.execute("COMMIT");
    return id;
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }
}

export async function transitionRepair(id: string, next: RepairStatus, note = ""): Promise<void> {
  const db = await getDatabase();
  await db.execute("BEGIN IMMEDIATE");
  try {
    const rows = await db.select<Array<{ status: RepairStatus }>>("SELECT status FROM repairs WHERE id = ? LIMIT 1", [id]);
    const current = rows[0]?.status;
    if (!current) throw new Error("طلب الصيانة غير موجود.");
    if (!transitions[current].includes(next)) throw new Error(`لا يمكن نقل حالة الصيانة من ${current} إلى ${next}.`);
    await db.execute(
      `UPDATE repairs SET status = ?, delivered_at = CASE WHEN ? = 'delivered' THEN datetime('now') ELSE delivered_at END
       WHERE id = ?`,
      [next, next, id],
    );
    await db.execute(
      `INSERT INTO repair_status_history(id, repair_id, from_status, to_status, note)
       VALUES (?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), id, current, next, note.trim() || null],
    );
    await db.execute(
      `INSERT INTO audit_logs(id, action, entity_type, entity_id, before_json, after_json)
       VALUES (?, 'repair.status_changed', 'repair', ?, ?, ?)`,
      [crypto.randomUUID(), id, JSON.stringify({ status: current }), JSON.stringify({ status: next, note })],
    );
    await db.execute("COMMIT");
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }
}

export interface RepairRecord {
  id: string;
  jobNumber: string;
  customerName: string;
  deviceType: string;
  deviceModel: string;
  imei: string;
  reportedIssue: string;
  status: RepairStatus;
  receivedAt: string;
}

export async function listRepairs(search = ""): Promise<RepairRecord[]> {
  const db = await getDatabase();
  const term = `%${search.trim()}%`;
  const rows = await db.select<Array<{
    id: string; job_number: string; customer_name: string | null;
    device_type: string; device_model: string | null; imei: string | null;
    reported_issue: string; status: RepairStatus; received_at: string;
  }>>(
    `SELECT r.id, r.job_number, c.name AS customer_name, r.device_type,
            r.device_model, r.imei, r.reported_issue, r.status, r.received_at
     FROM repairs r LEFT JOIN customers c ON c.id = r.customer_id
     WHERE (? = '%%' OR r.job_number LIKE ? OR COALESCE(r.imei, '') LIKE ? OR r.device_model LIKE ?)
     ORDER BY r.received_at DESC LIMIT 200`,
    [term, term, term, term],
  );
  return rows.map((row) => ({
    id: row.id, jobNumber: row.job_number, customerName: row.customer_name ?? "بدون عميل",
    deviceType: row.device_type, deviceModel: row.device_model ?? "", imei: row.imei ?? "",
    reportedIssue: row.reported_issue, status: row.status, receivedAt: row.received_at,
  }));
}
