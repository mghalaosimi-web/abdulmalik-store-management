import { getDatabase } from "./database";
import type { Product } from "../types";
import { validateProductInput, isValidImei } from "./validation";

interface ProductRow {
  id: string;
  sku: string;
  name: string;
  category: string;
  brand: string | null;
  cost_price: number;
  sale_price: number;
  quantity: number;
  min_quantity: number;
  status: "active" | "inactive";
  created_at: string;
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    brand: row.brand,
    costPrice: row.cost_price,
    salePrice: row.sale_price,
    quantity: row.quantity,
    minQuantity: row.min_quantity,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function listProducts(search = ""): Promise<Product[]> {
  const db = await getDatabase();
  const term = `%${search.trim()}%`;
  const rows = await db.select<ProductRow[]>(
    `SELECT id, sku, name, category, brand, cost_price, sale_price,
            quantity, min_quantity, status, created_at
     FROM products
     WHERE ($1 = '%%' OR name LIKE $2 OR sku LIKE $3 OR COALESCE(brand, '') LIKE $4)
     ORDER BY created_at DESC`,
    [term, term, term, term],
  );
  return rows.map(mapProduct);
}

export async function createProduct(input: {
  sku: string;
  name: string;
  category: string;
  brand?: string;
  costPrice: number;
  salePrice: number;
  quantity: number;
  minQuantity: number;
}): Promise<void> {
  validateProductInput(input);
  const db = await getDatabase();
  const id = crypto.randomUUID();
  await db.execute(
    `INSERT INTO products
      (id, sku, name, category, brand, cost_price, sale_price, quantity, min_quantity, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')`,
    [
      id, input.sku.trim(), input.name.trim(), input.category.trim(),
      input.brand?.trim() || null, Math.round((input.costPrice + Number.EPSILON) * 100) / 100,
      Math.round((input.salePrice + Number.EPSILON) * 100) / 100,
      input.quantity, input.minQuantity,
    ],
  );
}


export interface StockMovement {
  id: string; productId: string; movementType: string; quantityDelta: number;
  referenceType: string | null; referenceId: string | null; note: string | null; createdAt: string;
}

export async function adjustStock(productId: string, quantityDelta: number, reason: string): Promise<void> {
  if (!Number.isSafeInteger(quantityDelta) || quantityDelta === 0) throw new Error("يجب أن يكون تعديل المخزون عدداً صحيحاً غير صفر.");
  if (reason.trim().length < 4) throw new Error("سبب تعديل المخزون مطلوب للتدقيق.");
  const db = await getDatabase();
  await db.execute("BEGIN IMMEDIATE");
  try {
    const rows = await db.select<Array<{ id: string; name: string; quantity: number }>>(
      "SELECT id, name, quantity FROM products WHERE id = ? LIMIT 1", [productId],
    );
    const product = rows[0];
    if (!product) throw new Error("المنتج غير موجود.");
    const newQuantity = product.quantity + quantityDelta;
    if (newQuantity < 0) throw new Error("لا يمكن أن يصبح المخزون سالباً.");
    await db.execute("UPDATE products SET quantity = ?, updated_at = datetime('now') WHERE id = ?", [newQuantity, productId]);
    await db.execute(
      `INSERT INTO stock_movements(id, product_id, movement_type, quantity_delta, reference_type, reference_id, note)
       VALUES (?, ?, 'adjustment', ?, 'manual_adjustment', ?, ?)`,
      [crypto.randomUUID(), productId, quantityDelta, crypto.randomUUID(), reason.trim()],
    );
    await db.execute(
      `INSERT INTO audit_logs(id, action, entity_type, entity_id, before_json, after_json)
       VALUES (?, 'stock.adjusted', 'product', ?, ?, ?)`,
      [crypto.randomUUID(), productId, JSON.stringify({ quantity: product.quantity }), JSON.stringify({ quantity: newQuantity, delta: quantityDelta, reason: reason.trim() })],
    );
    await db.execute("COMMIT");
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }
}

export async function registerProductUnit(input: {
  productId: string; imei?: string; serialNumber?: string;
  condition: "new" | "used" | "refurbished"; warrantyUntil?: string;
}): Promise<string> {
  const imei = input.imei?.replace(/\s+/g, "") ?? "";
  const serialNumber = input.serialNumber?.trim() ?? "";
  if (!imei && !serialNumber) throw new Error("أدخل IMEI أو الرقم التسلسلي على الأقل.");
  if (imei && !isValidImei(imei)) throw new Error("رقم IMEI غير صالح وفق خوارزمية Luhn.");
  if (serialNumber.length > 120) throw new Error("الرقم التسلسلي طويل جداً.");
  if (input.warrantyUntil) {
    const date = new Date(input.warrantyUntil + "T00:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.warrantyUntil) || Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== input.warrantyUntil) {
      throw new Error("تاريخ الضمان غير صالح.");
    }
  }
  const db = await getDatabase();
  const id = crypto.randomUUID();
  await db.execute("BEGIN IMMEDIATE");
  try {
    const products = await db.select<Array<{ quantity: number }>>("SELECT quantity FROM products WHERE id = ? LIMIT 1", [input.productId]);
    if (!products[0] || products[0].quantity < 1) throw new Error("لا يوجد رصيد مخزون لهذا المنتج لربط جهاز متسلسل به.");
    const units = await db.select<Array<{ count: number }>>(
      "SELECT COUNT(*) AS count FROM product_units WHERE product_id = ? AND status = 'in_stock'", [input.productId],
    );
    if ((units[0]?.count ?? 0) >= products[0].quantity) throw new Error("عدد الأجهزة المسجلة تسلسلياً وصل إلى رصيد المخزون؛ لا يمكن إضافة وحدة زائدة.");
    await db.execute(
      `INSERT INTO product_units(id, product_id, imei, serial_number, condition, warranty_until)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.productId, imei || null, serialNumber || null, input.condition, input.warrantyUntil || null],
    );
    await db.execute("INSERT INTO audit_logs(id, action, entity_type, entity_id, after_json) VALUES (?, 'product_unit.registered', 'product_unit', ?, ?)", [crypto.randomUUID(), id, JSON.stringify({ productId: input.productId, imei: imei || null, serialNumber: serialNumber || null })]);
    await db.execute("COMMIT");
    return id;
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }
}

export async function listStockMovements(productId: string): Promise<StockMovement[]> {
  const db = await getDatabase();
  const rows = await db.select<Array<{
    id: string; product_id: string; movement_type: string; quantity_delta: number;
    reference_type: string | null; reference_id: string | null; note: string | null; created_at: string;
  }>>(
    `SELECT id, product_id, movement_type, quantity_delta, reference_type, reference_id, note, created_at
     FROM stock_movements WHERE product_id = ? ORDER BY created_at DESC LIMIT 500`, [productId],
  );
  return rows.map((row) => ({ id: row.id, productId: row.product_id, movementType: row.movement_type, quantityDelta: row.quantity_delta, referenceType: row.reference_type, referenceId: row.reference_id, note: row.note, createdAt: row.created_at }));
}


export interface ProductUnit {
  id: string; productId: string; imei: string | null; serialNumber: string | null;
  condition: "new" | "used" | "refurbished"; warrantyUntil: string | null;
  status: "in_stock" | "reserved" | "sold" | "returned" | "repair"; createdAt: string;
}

export async function listProductUnits(productId: string): Promise<ProductUnit[]> {
  const db = await getDatabase();
  const rows = await db.select<Array<{
    id: string; product_id: string; imei: string | null; serial_number: string | null;
    condition: ProductUnit["condition"]; warranty_until: string | null;
    status: ProductUnit["status"]; created_at: string;
  }>>(
    `SELECT id, product_id, imei, serial_number, condition, warranty_until, status, created_at
     FROM product_units WHERE product_id = ? ORDER BY created_at DESC LIMIT 500`, [productId],
  );
  return rows.map((row) => ({ id: row.id, productId: row.product_id, imei: row.imei, serialNumber: row.serial_number, condition: row.condition, warrantyUntil: row.warranty_until, status: row.status, createdAt: row.created_at }));
}

export interface StockDiscrepancy {
  productId: string; sku: string; name: string; recordedQuantity: number;
  ledgerQuantity: number; difference: number;
}

export async function reconcileStock(): Promise<StockDiscrepancy[]> {
  const db = await getDatabase();
  const rows = await db.select<Array<{
    id: string; sku: string; name: string; quantity: number; ledger_quantity: number;
  }>>(
    `SELECT p.id, p.sku, p.name, p.quantity,
            COALESCE(SUM(sm.quantity_delta), 0) AS ledger_quantity
     FROM products p LEFT JOIN stock_movements sm ON sm.product_id = p.id
     GROUP BY p.id, p.sku, p.name, p.quantity
     HAVING p.quantity <> COALESCE(SUM(sm.quantity_delta), 0)
     ORDER BY p.name COLLATE NOCASE`,
  );
  return rows.map((row) => ({
    productId: row.id, sku: row.sku, name: row.name,
    recordedQuantity: row.quantity, ledgerQuantity: row.ledger_quantity,
    difference: row.quantity - row.ledger_quantity,
  }));
}
