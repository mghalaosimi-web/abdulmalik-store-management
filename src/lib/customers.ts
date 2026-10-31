import { getDatabase } from "./database";

export interface PartyInput {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export interface Customer extends PartyInput {
  id: string;
  createdAt: string;
}

interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

function mapCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? "",
    email: row.email ?? "",
    address: row.address ?? "",
    notes: row.notes ?? "",
    createdAt: row.created_at,
  };
}

function normalize(input: PartyInput): PartyInput {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 160) throw new Error("اسم العميل يجب أن يكون بين حرفين و160 حرفاً.");
  const phone = input.phone?.trim() ?? "";
  if (phone && !/^[+\d][\d\s()-]{5,24}$/.test(phone)) throw new Error("رقم الهاتف غير صالح.");
  const email = input.email?.trim() ?? "";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("البريد الإلكتروني غير صالح.");
  return { name, phone, email, address: input.address?.trim() ?? "", notes: input.notes?.trim() ?? "" };
}

export async function listCustomers(search = ""): Promise<Customer[]> {
  const db = await getDatabase();
  const term = `%${search.trim()}%`;
  const rows = await db.select<CustomerRow[]>(
    `SELECT id, name, phone, email, address, notes, created_at
     FROM customers
     WHERE (? = '%%' OR name LIKE ? OR COALESCE(phone, '') LIKE ?)
     ORDER BY name COLLATE NOCASE LIMIT 500`,
    [term, term, term],
  );
  return rows.map(mapCustomer);
}

export async function createCustomer(input: PartyInput): Promise<string> {
  const value = normalize(input);
  const db = await getDatabase();
  const id = crypto.randomUUID();
  await db.execute(
    `INSERT INTO customers(id, name, phone, email, address, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, value.name, value.phone || null, value.email || null, value.address || null, value.notes || null],
  );
  return id;
}

export async function updateCustomer(id: string, input: PartyInput): Promise<void> {
  const value = normalize(input);
  const db = await getDatabase();
  const result = await db.execute(
    `UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, notes = ?
     WHERE id = ?`,
    [value.name, value.phone || null, value.email || null, value.address || null, value.notes || null, id],
  );
  if (result.rowsAffected !== 1) throw new Error("العميل غير موجود أو تعذر تحديثه.");
}

export async function deleteCustomer(id: string): Promise<void> {
  const db = await getDatabase();
  try {
    const result = await db.execute("DELETE FROM customers WHERE id = ?", [id]);
    if (result.rowsAffected !== 1) throw new Error("العميل غير موجود.");
  } catch {
    throw new Error("لا يمكن حذف العميل لوجود عمليات مرتبطة به. يمكنك الاحتفاظ به في السجل.");
  }
}
