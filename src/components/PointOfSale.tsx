import { useEffect, useMemo, useRef, useState } from "react";
import { createSale } from "../lib/sales";
import { findProductByBarcode, listProducts } from "../lib/products";
import type { Product } from "../types";
import { Barcode, Camera, CheckCircle2, Minus, Plus, Printer, Search, ShoppingCart, Trash2 } from "lucide-react";

type CartLine = { product: Product; quantity: number };
type Props = { onSaleCompleted?: () => void };

const money = (value: number) => new Intl.NumberFormat("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

export default function PointOfSale({ onSaleCompleted }: Props) {
  const scannerRef = useRef<HTMLInputElement>(null);
  const [barcode, setBarcode] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState("0");
  const [paid, setPaid] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [lastInvoice, setLastInvoice] = useState<{ number: string; total: number; date: string } | null>(null);

  useEffect(() => { scannerRef.current?.focus(); }, []);
  useEffect(() => {
    let alive = true;
    if (!query.trim()) { setResults([]); return; }
    void listProducts(query).then((items) => { if (alive) setResults(items.slice(0, 8)); }).catch((e) => setMessage(String(e)));
    return () => { alive = false; };
  }, [query]);

  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + line.product.salePrice * line.quantity, 0), [cart]);
  const discountValue = Math.max(0, Math.min(subtotal, Number(discount) || 0));
  const total = Math.max(0, subtotal - discountValue);

  function addProduct(product: Product) {
    if (product.quantity <= 0) { setMessage("هذا المنتج غير متوفر في المخزون."); return; }
    setCart((current) => {
      const found = current.find((line) => line.product.id === product.id);
      if (found) {
        if (found.quantity >= product.quantity) { setMessage("الكمية المطلوبة تتجاوز المخزون المتاح."); return current; }
        return current.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line);
      }
      return [...current, { product, quantity: 1 }];
    });
    setMessage("");
    setQuery("");
    setBarcode("");
    scannerRef.current?.focus();
  }

  async function handleScan(event: React.FormEvent) {
    event.preventDefault();
    const code = barcode.trim();
    if (!code) return;
    try {
      const product = await findProductByBarcode(code);
      if (!product) { setMessage("لم يتم العثور على منتج بهذا الباركود."); return; }
      addProduct(product);
    } catch (e) { setMessage(e instanceof Error ? e.message : "تعذر البحث عن الباركود."); }
  }

  function changeQuantity(id: string, delta: number) {
    setCart((current) => current.map((line) => line.product.id === id
      ? { ...line, quantity: Math.max(0, Math.min(line.product.quantity, line.quantity + delta)) }
      : line).filter((line) => line.quantity > 0));
  }

  async function checkout() {
    if (!cart.length || busy) return;
    const paidAmount = paid.trim() === "" ? total : Number(paid);
    if (!Number.isFinite(paidAmount) || paidAmount < total) { setMessage("المبلغ المدفوع يجب أن يساوي الإجمالي أو يزيد عليه."); return; }
    setBusy(true); setMessage("");
    try {
      const result = await createSale({ items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })), discount: discountValue, paidAmount });
      setLastInvoice({ number: result.invoiceNumber, total: result.total, date: new Date().toLocaleString("ar-SA") });
      setCart([]); setDiscount("0"); setPaid(""); setMessage("تم حفظ البيع وتحديث المخزون بنجاح.");
      onSaleCompleted?.();
      window.setTimeout(() => scannerRef.current?.focus(), 0);
    } catch (e) { setMessage(e instanceof Error ? e.message : "تعذر إتمام عملية البيع."); }
    finally { setBusy(false); }
  }

  return <div className="pos-layout">
    <section className="panel pos-catalog">
      <div className="panel-heading"><div><h3>نقطة البيع المباشرة</h3><p>امسح الباركود أو ابحث عن المنتج</p></div><span className="subtle-tag">محلي · SQLite</span></div>
      <form className="pos-scan" onSubmit={handleScan}>
        <Barcode size={22}/><input ref={scannerRef} value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="امسح الباركود هنا ثم Enter" autoComplete="off" autoFocus/><button className="primary-button" type="submit">إضافة</button>
      </form>
      <label className="search-box pos-search"><Search size={17}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث باسم المنتج أو SKU أو الباركود"/></label>
      {results.length > 0 && <div className="pos-search-results">{results.map((p) => <button key={p.id} onClick={() => addProduct(p)}><span><strong>{p.name}</strong><small>{p.sku} · المتاح {p.quantity}</small></span><b>{money(p.salePrice)}</b></button>)}</div>}
      <div className="pos-hint"><Camera size={18}/><span>قارئ الباركود USB الذي يعمل كلوحة مفاتيح مدعوم: وجّه المؤشر إلى حقل المسح وامسح الرمز.</span></div>
      {message && <div className={message.startsWith("تم") ? "success-banner" : "error-banner"} role="status">{message}</div>}
    </section>
    <section className="panel pos-cart">
      <div className="panel-heading"><div><h3>سلة البيع</h3><p>{cart.length} أصناف</p></div><ShoppingCart size={20}/></div>
      <div className="pos-cart-lines">{cart.map(({ product, quantity }) => <article className="pos-line" key={product.id}>
        <div className="pos-product-thumb">{product.imageData ? <img src={product.imageData} alt=""/> : <span>صورة</span>}</div>
        <div className="pos-line-info"><strong>{product.name}</strong><small>{money(product.salePrice)} × {quantity}</small><b>{money(product.salePrice * quantity)}</b></div>
        <div className="pos-quantity"><button aria-label="تقليل" onClick={() => changeQuantity(product.id, -1)}><Minus size={14}/></button><span>{quantity}</span><button aria-label="زيادة" onClick={() => changeQuantity(product.id, 1)}><Plus size={14}/></button><button className="remove-line" aria-label="حذف" onClick={() => setCart((c) => c.filter((x) => x.product.id !== product.id))}><Trash2 size={15}/></button></div>
      </article>)}
      {!cart.length && <div className="pos-empty"><ShoppingCart size={30}/><strong>السلة فارغة</strong><span>امسح باركود المنتج للبدء بالبيع.</span></div>}</div>
      <div className="pos-totals"><div><span>الإجمالي قبل الخصم</span><strong>{money(subtotal)}</strong></div><label><span>الخصم</span><input type="number" min="0" max={subtotal} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)}/></label><div className="pos-grand-total"><span>المطلوب</span><strong>{money(total)}</strong></div><label><span>المبلغ المستلم</span><input type="number" min={total} step="0.01" value={paid} placeholder={String(total.toFixed(2))} onChange={(e) => setPaid(e.target.value)}/></label><div><span>الباقي للعميل</span><strong>{money(Math.max(0, (Number(paid) || total) - total))}</strong></div></div>
      <button className="primary-button pos-checkout" disabled={!cart.length || busy} onClick={() => void checkout()}>{busy ? "جارٍ حفظ الفاتورة..." : "إتمام البيع وحفظ الفاتورة"}</button>
    </section>
    {lastInvoice && <section className="panel pos-last-sale"><CheckCircle2 size={20}/><div><strong>آخر فاتورة: {lastInvoice.number}</strong><span>{lastInvoice.date} · {money(lastInvoice.total)}</span></div><button className="secondary-button" onClick={() => window.print()}><Printer size={16}/> طباعة</button></section>}
  </div>;
}
