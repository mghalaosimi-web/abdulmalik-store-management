import { useEffect, useMemo, useRef, useState } from "react";
import { createSale } from "../lib/sales";
import { findProductByBarcode, listProducts } from "../lib/products";
import type { Product } from "../types";
import { Barcode, Camera, CheckCircle2, Minus, Plus, Printer, Search, ShoppingCart, Trash2 } from "lucide-react";

type CartLine = { product: Product; quantity: number };
type Props = { onSaleCompleted?: () => void };
const money = (value: number) => new Intl.NumberFormat("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

export default function PointOfSale({ onSaleCompleted }: Props) {
 const scannerRef=useRef<HTMLInputElement>(null);
 const [barcode,setBarcode]=useState(""); const [query,setQuery]=useState(""); const [results,setResults]=useState<Product[]>([]);
 const [cart,setCart]=useState<CartLine[]>([]); const [discount,setDiscount]=useState("0"); const [paid,setPaid]=useState("");
 const [busy,setBusy]=useState(false); const [message,setMessage]=useState(""); const [invoice,setInvoice]=useState("");
 useEffect(()=>{scannerRef.current?.focus()},[]);
 useEffect(()=>{let active=true;if(!query.trim()){setResults([]);return} void listProducts(query).then(v=>{if(active)setResults(v.slice(0,8))}).catch(e=>setMessage(String(e)));return()=>{active=false}},[query]);
 const subtotal=useMemo(()=>cart.reduce((s,l)=>s+l.product.salePrice*l.quantity,0),[cart]);
 const discountValue=Math.min(subtotal,Math.max(0,Number(discount)||0)); const total=subtotal-discountValue;
 function add(p:Product){if(p.quantity<1){setMessage("المنتج غير متوفر");return}setCart(c=>{const x=c.find(l=>l.product.id===p.id);if(x){if(x.quantity>=p.quantity){setMessage("الكمية تتجاوز المخزون");return c}return c.map(l=>l.product.id===p.id?{...l,quantity:l.quantity+1}:l)}return [...c,{product:p,quantity:1}]});setMessage("");setBarcode("");setQuery("");scannerRef.current?.focus()}
 async function scan(e:React.FormEvent){e.preventDefault();try{const p=await findProductByBarcode(barcode);if(!p){setMessage("الباركود غير مسجل");return}add(p)}catch(err){setMessage(String(err))}}
 async function checkout(){if(!cart.length||busy)return;const amount=paid===""?total:Number(paid);if(!Number.isFinite(amount)||amount<total){setMessage("المبلغ المدفوع أقل من الإجمالي");return}setBusy(true);try{const sale=await createSale({items:cart.map(l=>({productId:l.product.id,quantity:l.quantity})),discount:discountValue,paidAmount:amount});setInvoice(sale.invoiceNumber);setCart([]);setDiscount("0");setPaid("");setMessage("تم حفظ الفاتورة وتحديث المخزون");onSaleCompleted?.();scannerRef.current?.focus()}catch(err){setMessage(err instanceof Error?err.message:String(err))}finally{setBusy(false)}}
 return <div className="pos-layout"><section className="panel pos-catalog"><div className="panel-heading"><div><h3>نقطة البيع المباشرة</h3><p>امسح الباركود أو ابحث عن المنتج</p></div><span className="subtle-tag">محلي · SQLite</span></div>
 <form className="pos-scan" onSubmit={scan}><Barcode size={22}/><input ref={scannerRef} value={barcode} onChange={e=>setBarcode(e.target.value)} placeholder="امسح الباركود ثم Enter" autoComplete="off"/><button className="primary-button">إضافة</button></form>
 <label className="search-box pos-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="بحث باسم المنتج أو الرمز"/></label>
 {results.length>0&&<div className="pos-search-results">{results.map(p=><button key={p.id} onClick={()=>add(p)}><span><strong>{p.name}</strong><small>{p.sku} · المتاح {p.quantity}</small></span><b>{money(p.salePrice)}</b></button>)}</div>}
 <div className="pos-hint"><Camera size={18}/><span>قارئ USB يعمل كلوحة مفاتيح مدعوم؛ ركّز حقل الباركود وامسح الرمز.</span></div>
 {message&&<div className={message.startsWith("تم")?"success-banner":"error-banner"} role="status">{message}</div>}
 </section><section className="panel pos-cart"><div className="panel-heading"><div><h3>سلة البيع</h3><p>{cart.length} أصناف</p></div><ShoppingCart size={20}/></div>
 <div className="pos-cart-lines">{cart.map(({product,quantity})=><article className="pos-line" key={product.id}><div className="pos-product-thumb">{product.imageData?<img src={product.imageData} alt=""/>:<span>صورة</span>}</div><div className="pos-line-info"><strong>{product.name}</strong><small>{money(product.salePrice)} × {quantity}</small><b>{money(product.salePrice*quantity)}</b></div><div className="pos-quantity"><button onClick={()=>setCart(c=>c.map(l=>l.product.id===product.id?{...l,quantity:Math.max(0,l.quantity-1)}:l).filter(l=>l.quantity>0))}>−</button><span>{quantity}</span><button onClick={()=>add(product)}>+</button><button onClick={()=>setCart(c=>c.filter(l=>l.product.id!==product.id))}><Trash2 size={15}/></button></div></article>)}{!cart.length&&<div className="pos-empty"><ShoppingCart size={30}/><strong>السلة فارغة</strong><span>امسح باركود المنتج للبدء.</span></div>}</div>
 <div className="pos-totals"><div><span>الإجمالي</span><strong>{money(subtotal)}</strong></div><label><span>الخصم</span><input type="number" min="0" max={subtotal} step="0.01" value={discount} onChange={e=>setDiscount(e.target.value)}/></label><div className="pos-grand-total"><span>المطلوب</span><strong>{money(total)}</strong></div><label><span>المبلغ المستلم</span><input type="number" min={total} step="0.01" value={paid} placeholder={total.toFixed(2)} onChange={e=>setPaid(e.target.value)}/></label></div>
 <button className="primary-button pos-checkout" disabled={!cart.length||busy} onClick={()=>void checkout()}>{busy?"جارٍ الحفظ...":"إتمام البيع وحفظ الفاتورة"}</button>
 {invoice&&<div className="pos-last-sale"><CheckCircle2 size={18}/><strong>آخر فاتورة: {invoice}</strong><button className="secondary-button" onClick={()=>window.print()}><Printer size={16}/> طباعة</button></div>}
 </section></div>;
}
