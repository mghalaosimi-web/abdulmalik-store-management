import { getDatabase } from "./database";
type SaleItemInput = { productId: string; quantity: number };
type ProductRow = { id: string; name: string; sale_price: number; cost_price: number; quantity: number; status: string };
export async function createSale(input: { items: SaleItemInput[]; discount: number; paidAmount: number }) {
 if (!input.items.length) throw new Error("السلة فارغة.");
 if (!Number.isFinite(input.discount) || input.discount < 0 || !Number.isFinite(input.paidAmount) || input.paidAmount < 0) throw new Error("قيمة الخصم أو المدفوع غير صحيحة.");
 const quantities = new Map<string, number>();
 for (const item of input.items) {
  if (!item.productId || !Number.isInteger(item.quantity) || item.quantity <= 0) throw new Error("كمية المنتج غير صحيحة.");
  quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
 }
 const db = await getDatabase();
 const saleId = crypto.randomUUID();
 const invoiceNumber = "INV-" + new Date().toISOString().slice(0,10).replaceAll("-","") + "-" + crypto.randomUUID().slice(0,8).toUpperCase();
 await db.execute("BEGIN IMMEDIATE");
 try {
  let subtotal = 0;
  const lines: Array<{product:ProductRow;quantity:number}> = [];
  for (const [productId, quantity] of quantities) {
   const found = await db.select<ProductRow[]>("SELECT id,name,sale_price,cost_price,quantity,status FROM products WHERE id=$1 LIMIT 1",[productId]);
   const product = found[0];
   if (!product || product.status !== "active") throw new Error("أحد المنتجات غير موجود أو غير نشط.");
   if (product.quantity < quantity) throw new Error("المخزون غير كافٍ للمنتج: " + product.name);
   subtotal += product.sale_price * quantity;
   lines.push({product,quantity});
  }
  const discount = Math.min(input.discount,subtotal);
  const total = Math.max(0,subtotal-discount);
  if (input.paidAmount < total) throw new Error("المبلغ المدفوع أقل من الإجمالي.");
  await db.execute("INSERT INTO sales(id,invoice_number,subtotal,discount,tax_amount,total,paid_amount,status) VALUES($1,$2,$3,$4,0,$5,$6,'posted')",[saleId,invoiceNumber,subtotal,discount,total,input.paidAmount]);
  let remainingDiscount = discount;
  for (const line of lines) {
   const lineSubtotal = line.product.sale_price * line.quantity;
   const lineDiscount = Math.min(remainingDiscount,lineSubtotal);
   remainingDiscount -= lineDiscount;
   await db.execute("INSERT INTO sale_items(id,sale_id,product_id,quantity,unit_price,unit_cost,discount,line_total) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[crypto.randomUUID(),saleId,line.product.id,line.quantity,line.product.sale_price,line.product.cost_price,lineDiscount,lineSubtotal-lineDiscount]);
   const changed = await db.execute("UPDATE products SET quantity=quantity-$1,updated_at=datetime('now') WHERE id=$2 AND quantity >= $1",[line.quantity,line.product.id]);
   if (changed.rowsAffected !== 1) throw new Error("تعذر تحديث مخزون المنتج.");
   await db.execute("INSERT INTO stock_movements(id,product_id,movement_type,quantity_delta,reference_type,reference_id,note) VALUES($1,$2,'sale',$3,'sale',$4,$5)",[crypto.randomUUID(),line.product.id,-line.quantity,saleId,invoiceNumber]);
  }
  if (input.paidAmount > 0) await db.execute("INSERT INTO payments(id,direction,method,amount,reference_type,reference_id,note) VALUES($1,'in','cash',$2,'sale',$3,$4)",[crypto.randomUUID(),input.paidAmount,saleId,"Payment for "+invoiceNumber]);
  await db.execute("INSERT INTO audit_logs(id,action,entity_type,entity_id,after_json) VALUES($1,'create','sale',$2,$3)",[crypto.randomUUID(),saleId,JSON.stringify({invoiceNumber,subtotal,discount,total,paidAmount:input.paidAmount})]);
  await db.execute("COMMIT");
  return {saleId,invoiceNumber,subtotal,discount,total,paidAmount:input.paidAmount};
 } catch (error) {
  try { await db.execute("ROLLBACK"); } catch {
   // Preserve the original transaction error if rollback itself fails.
  }
  throw error;
 }
}
