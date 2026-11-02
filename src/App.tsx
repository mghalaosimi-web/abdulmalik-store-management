import { useEffect, useMemo, useState } from "react";
import {
  Activity, BarChart3, Boxes, BriefcaseBusiness, ClipboardList, CreditCard,
  Headphones, LayoutDashboard, Package, Plus, Search, Settings, ShoppingCart,
  Users, Wrench, Wifi, X,
} from "lucide-react";
import { createProduct, listProducts } from "./lib/products";
import { isDesktopRuntime } from "./lib/database";
import type { Product } from "./types";
import PointOfSale from "./components/PointOfSale";

type Section = "dashboard" | "products" | "accessories" | "sales" | "customers" | "repairs" | "reports" | "settings";

const navigation: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { id: "products", label: "المنتجات والمخزون", icon: Package },
  { id: "accessories", label: "الأكسسوارات", icon: Headphones },
  { id: "sales", label: "المبيعات ونقطة البيع", icon: ShoppingCart },
  { id: "customers", label: "العملاء والموردون", icon: Users },
  { id: "repairs", label: "الصيانة والضمان", icon: Wrench },
  { id: "reports", label: "التقارير", icon: BarChart3 },
  { id: "settings", label: "الإعدادات", icon: Settings },
];

export default function App() {
  const [section, setSection] = useState<Section>("dashboard");
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [error, setError] = useState("");

  async function refreshProducts(term = search) {
    if (!isDesktopRuntime()) return;
    try {
      setProducts(await listProducts(term));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل المنتجات.");
    }
  }

  useEffect(() => {
    setDesktop(isDesktopRuntime());
    void refreshProducts("");
  }, []);

  useEffect(() => {
    if (section === "products" && desktop) void refreshProducts(search);
  }, [search, section, desktop]);

  const lowStock = useMemo(() => products.filter((p) => p.quantity <= p.minQuantity).length, [products]);
  const isAccessories = section === "accessories";
  const visibleProducts = useMemo(() => isAccessories
    ? products.filter((p) => /^(الأكسسوارات|الاكسسوارات|إكسسوارات|اكسسوارات)$/u.test(p.category.trim()))
    : products, [products, isAccessories]);

  async function handleCreate(form: HTMLFormElement, forcedCategory?: string) {
    const data = new FormData(form);
    const number = (key: string) => Number(data.get(key));
    try {
      const imageFile = data.get("image");
      const imageData = imageFile instanceof File && imageFile.size > 0 ? await readImage(imageFile) : null;
      await createProduct({
        sku: String(data.get("sku") ?? ""),
        barcode: String(data.get("barcode") ?? ""),
        name: String(data.get("name") ?? ""),
        category: String(data.get("category") ?? ""),
        brand: String(data.get("brand") ?? ""),
        costPrice: number("costPrice"),
        salePrice: number("salePrice"),
        quantity: number("quantity"),
        minQuantity: number("minQuantity"),
        imageData,
      });
      setShowCreate(false);
      await refreshProducts("");
      setSearch("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ المنتج.");
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Wifi size={22} /></div>
          <div><strong>عبدالملك</strong><span>للاتصالات والإلكترونيات</span></div>
        </div>
        <div className="store-label">إدارة المتجر <span className="status-dot" /></div>
        <nav className="navigation" aria-label="التنقل الرئيسي">
          <p className="nav-caption">القائمة الرئيسية</p>
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} className={section === id ? "nav-item active" : "nav-item"} onClick={() => setSection(id)}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer"><div className="avatar">ع</div><div><strong>مساحة المتجر</strong><span>الإصدار التأسيسي 0.1</span></div></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div><span className="eyebrow">نظام إدارة المتجر</span><h1>{navigation.find((item) => item.id === section)?.label}</h1></div>
          <div className="topbar-actions"><span className={desktop ? "runtime-badge online" : "runtime-badge"}><span />{desktop ? "قاعدة محلية" : "وضع المعاينة"}</span><button className="icon-button" aria-label="النشاط"><Activity size={19} /></button></div>
        </header>

        {!desktop && <div className="notice"><Wifi size={18} /><div><strong>هذه معاينة للواجهة</strong><span>شغّل التطبيق عبر Tauri للوصول إلى قاعدة SQLite المحلية وحفظ البيانات.</span></div></div>}
        {error && <div className="error-banner" role="alert">{error}</div>}

        {section === "dashboard" && (
          <>
            <section className="welcome-panel"><div><span className="welcome-kicker">مرحباً بك في نظامك</span><h2>إدارة متجرك، <em>بوضوح وثقة.</em></h2><p>تابع المنتجات والمبيعات والخدمات من مساحة عمل واحدة.</p></div><div className="welcome-art"><BriefcaseBusiness size={72} strokeWidth={1} /></div></section>
            <section className="stats-grid">
              <StatCard icon={Boxes} label="إجمالي المنتجات" value={desktop ? products.length.toLocaleString("ar") : "—"} detail="منتج مسجل" />
              <StatCard icon={ClipboardList} label="منتجات منخفضة" value={desktop ? lowStock.toLocaleString("ar") : "—"} detail="تحتاج إلى مراجعة" />
              <StatCard icon={Users} label="العملاء" value="—" detail="يظهر بعد تفعيل وحدة العملاء" />
              <StatCard icon={CreditCard} label="مبيعات اليوم" value="—" detail="تظهر بعد تفعيل نقطة البيع" />
            </section>
            <section className="content-grid"><div className="panel"><div className="panel-heading"><div><h3>نظرة عامة</h3><p>ملخص وحدات النظام</p></div><span className="subtle-tag">التأسيس</span></div><div className="module-list"><ModuleRow icon={Package} title="إدارة المنتجات" description="الأصناف والأسعار والكميات" state="متاحة مبدئياً" /><ModuleRow icon={ShoppingCart} title="نقطة البيع" description="الفواتير والمدفوعات والمرتجعات" state="قيد التطوير" /><ModuleRow icon={Wrench} title="الصيانة والضمان" description="طلبات الإصلاح ومتابعة الأجهزة" state="قيد التطوير" /><ModuleRow icon={BarChart3} title="التقارير المالية" description="الأرباح والمصروفات وحركة الصندوق" state="قيد التطوير" /></div></div><div className="panel side-panel"><div className="panel-heading"><div><h3>مركز التنبيهات</h3><p>ما يحتاج إلى انتباه</p></div><Headphones size={19} /></div><div className="empty-state"><div className="empty-icon"><Activity size={23} /></div><strong>لا توجد تنبيهات بعد</strong><span>ستظهر هنا تنبيهات المخزون والعمليات عند توفر البيانات.</span></div></div></section>
          </>
        )}

        {(section === "products" || isAccessories) && <section className="panel data-panel"><div className="panel-heading"><div><h3>{isAccessories ? "الأكسسوارات" : "المنتجات والمخزون"}</h3><p>{isAccessories ? "إدارة أغطية الجوالات والسماعات والشواحن وبقية ملحقات المحل" : "إدارة الأصناف والأسعار والكميات المتاحة"}</p></div><button className="primary-button" onClick={() => setShowCreate(true)}><Plus size={17} /> {isAccessories ? "إضافة أكسسوار" : "إضافة منتج"}</button></div><div className="table-toolbar"><label className="search-box"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isAccessories ? "ابحث عن أكسسوار بالاسم أو الرمز أو العلامة" : "ابحث بالاسم أو الرمز أو العلامة التجارية"} /></label><span className="result-count">{visibleProducts.length} {isAccessories ? "أكسسوار" : "منتج"}</span></div><div className="table-wrap"><table><thead><tr><th>المنتج</th><th>رمز SKU</th><th>الباركود</th><th>التصنيف</th><th>سعر التكلفة</th><th>سعر البيع</th><th>الكمية</th><th>الحالة</th></tr></thead><tbody>{visibleProducts.map((p) => <tr key={p.id}><td><div className="product-name-cell">{p.imageData ? <img src={p.imageData} alt="" /> : <span className="product-image-placeholder">صورة</span>}<div><strong>{p.name}</strong><small>{p.brand || "بدون علامة تجارية"}</small></div></div></td><td dir="ltr">{p.sku}</td><td dir="ltr">{p.barcode || "—"}</td><td>{p.category}</td><td>{p.costPrice.toLocaleString("ar")}</td><td>{p.salePrice.toLocaleString("ar")}</td><td><span className={p.quantity <= p.minQuantity ? "quantity low" : "quantity"}>{p.quantity}</span></td><td><span className="pill success">نشط</span></td></tr>)}</tbody></table>{visibleProducts.length === 0 && <div className="table-empty">{isAccessories ? "لا توجد أكسسوارات مسجلة. أضف أول أكسسوار للمحل." : "لا توجد منتجات مسجلة حتى الآن."}</div>}</div></section>}

        {section === "sales" && <PointOfSale onSaleCompleted={() => void refreshProducts("")} />}
        {section !== "dashboard" && section !== "products" && section !== "accessories" && section !== "sales" && <section className="panel placeholder-panel"><div className="empty-icon"><ClipboardList size={25} /></div><h3>{navigation.find((item) => item.id === section)?.label}</h3><p>هذه الوحدة مدرجة في خارطة التنفيذ. لن تُعرض كوظيفة مكتملة قبل تنفيذ منطقها وربطها واختبارها.</p><span className="subtle-tag">قيد التطوير</span></section>}
      </main>

      {showCreate && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}><form className="modal" onSubmit={(e) => { e.preventDefault(); void handleCreate(e.currentTarget, isAccessories ? "الأكسسوارات" : undefined); }}><div className="modal-heading"><div><h2>{isAccessories ? "إضافة أكسسوار جديد" : "إضافة منتج جديد"}</h2><p>{isAccessories ? "أدخل بيانات الأكسسوار وسعره وكميته" : "أدخل بيانات الصنف الأساسية"}</p></div><button type="button" className="icon-button" onClick={() => setShowCreate(false)} aria-label="إغلاق"><X size={19} /></button></div><div className="form-grid"><Field name="name" label="اسم المنتج" required /><Field name="image" label="صورة المنتج" type="file" /><Field name="sku" label="رمز SKU" required /><Field name="barcode" label="الباركود (EAN/UPC)" />{!isAccessories && <Field name="category" label="التصنيف" required />}<Field name="brand" label="العلامة التجارية" /><Field name="costPrice" label="سعر التكلفة" type="number" min="0" step="0.01" required /><Field name="salePrice" label="سعر البيع" type="number" min="0" step="0.01" required /><Field name="quantity" label="الكمية الافتتاحية" type="number" min="0" required /><Field name="minQuantity" label="حد التنبيه" type="number" min="0" required /></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowCreate(false)}>إلغاء</button><button className="primary-button" type="submit">حفظ المنتج</button></div></form></div>}
    </div>
  );
}

function readImage(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("تعذر قراءة الصورة.")); reader.onerror = () => reject(new Error("تعذر قراءة الصورة.")); reader.readAsDataURL(file); }); }

function StatCard({ icon: Icon, label, value, detail }: { icon: typeof Package; label: string; value: string; detail: string }) {
  return <article className="stat-card"><div className="stat-top"><span>{label}</span><div className="stat-icon"><Icon size={19} /></div></div><strong className="stat-value">{value}</strong><span className="stat-detail">{detail}</span></article>;
}
function ModuleRow({ icon: Icon, title, description, state }: { icon: typeof Package; title: string; description: string; state: string }) {
  return <div className="module-row"><div className="module-icon"><Icon size={19} /></div><div className="module-copy"><strong>{title}</strong><span>{description}</span></div><span className="module-state">{state}</span></div>;
}
function Field({ name, label, type = "text", required = false, min, step }: { name: string; label: string; type?: string; required?: boolean; min?: string; step?: string }) {
  return <label className="field"><span>{label}{required && " *"}</span><input name={name} type={type} required={required} min={min} step={step} /></label>;
}
