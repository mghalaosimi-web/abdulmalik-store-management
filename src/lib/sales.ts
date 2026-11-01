import { getDatabase } from "./database";
export async function createSale(input: { items: Array<{productId:string;quantity:number}>; discount:number; paidAmount:number }) {
 const db=await getDatabase();
 if(!input.items.length) throw new Error("السلة فارغة");
 const id=crypto.randomUUID();
 const invoice="INV-"+Date.now();
 await db.execute("BEGIN IMMEDIATE");
 try {
  let subtotal=0; const rows=[];
  for(const item of input.items){
   const found=await db.select<Array<{id:string;name:string;sale_price:number;cost_price:number;quantity:number;status:string}>>("SELECT id,name,sale_price,cost_price,quantity,status FROM products WHERE id=$1",[item.productId]);
   const p=found[0]; if(!p||p.status!=="active"||p.quantity<item.quantity) throw new Error("المنتج غير متاح أو المخزون غير كافٍ");
   subtotal+=p.sale_price*item.quantity; rows.push({p,quantity:item.quantity});
  }
  const discount=Math.min(Math.max(0,input.discount),subtotal); const total=subtotal-discount;
  if(input.paidAmount<total) throw new Error("المبلغ المدفوع أقل من الإجمالي");
  await db.execute("INSERT INTO sales(id,invoice_number,subtotal,discount,tax_amount,total,paid_amount,status) VALUES($1,$2,$3,$4,0,$5,$6,'posted')",[id,invoice,subtotal,discount,total,input.paidAmount]);
  let remaining=discount;
  for(const row of rows){const p=row.p;const q=row.quantity;const lineDiscount=Math.min(remaining,p.sale_price*q);remaining-=lineDiscount;
   await db.execute("INSERT INTO sale_items(id,sale_id,product_id,quantity,unit_price,unit_cost,discount,line_total) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[crypto.randomUUID(),id,p.id,q,p.sale_price,p.cost_price,lineDiscount,p.sale_price*q-lineDiscount]);
   const changed=await db.execute("UPDATE products SET quantity=quantity-$1,updated_at=datetime('now') WHERE id=$2 AND quantity >= $1",[q,p.id]); if(changed.rowsAffected!==1) throw new Error("تعذر تحديث المخزون");
   await db.execute("INSERT INTO stock_movements(id,product_id,movement_type,quantity_delta,reference_type,reference_id,note) VALUES($1,$2,'sale',$3,'sale',$4,$5)",[crypto.randomUUID(),p.id,-q,id,invoice]);
  }
  if(input.paidAmount>0) await db.execute("INSERT INTO payments(id,direction,method,amount,reference_type,reference_id) VALUES($1,'in','cash',$2,'sale',$3)",[crypto.randomUUID(),input.paidAmount,id]);
  await db.execute("COMMIT"); return {saleId:id,invoiceNumber:invoice,subtotal,discount,total,paidAmount:input.paidAmount};
 } catch(e){try{await db.execute("ROLLBACK")}catch{} throw e;}
}
