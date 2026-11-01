import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, BarChart3, Boxes, ClipboardList, CreditCard, BookOpen,
  Headphones, LayoutDashboard, Package, Plus, Search, Settings, ShoppingCart,
  Users, Wrench, Wifi, X, Receipt, RefreshCw, Truck, Wallet, ShoppingBasket, MessageCircle, Phone, ExternalLink,
} from "lucide-react";
import { adjustStock, createProduct, listProductUnits, listProducts, reconcileStock, registerProductUnit, type ProductUnit, type StockDiscrepancy } from "./lib/products";
import { isDesktopRuntime } from "./lib/database";
import { createCustomer, listCustomers, type Customer } from "./lib/customers";
import { checkoutSale, listRecentSales, type RecentSale } from "./lib/sales";
import { createRepair, listRepairs, transitionRepair, type RepairRecord, type RepairStatus } from "./lib/repairs";
import type { Product } from "./types";
const storeLogo = new URL("./assets/IMG-20261031-WA0049.jpg", import.meta.url).href;
import { createSupplier, listSuppliers, type Supplier } from "./lib/suppliers";
import { receivePurchase, listRecentPurchases, type RecentPurchase, type PurchaseLineInput } from "./lib/purchases";
import { listPurchaseReturnableItems, processPurchaseReturn, type ReturnablePurchaseItem } from "./lib/purchase-returns";
import { closeCashSession, getOpenCashSession, openCashSession, recordExpense, type CashSession } from "./lib/cash";
import { getDashboardMetrics, type DashboardMetrics } from "./lib/dashboard";
import { getFinancialSummary, type FinancialSummary } from "./lib/reports";
import { listSaleReturnableItems, processSaleReturn, type ReturnableSaleItem } from "./lib/returns";
import { listCustomerBalances, listSupplierBalances, receiveCustomerPayment, paySupplier, type PartyBalance } from "./lib/settlements";
import { getTrialBalance, listRecentJournalEntries, type TrialBalanceRow, type JournalEntrySummary } from "./lib/accounting";
import { formatMoney } from "./lib/money";

type Section = "dashboard" | "products" | "sales" | "purchases" | "customers" | "suppliers" | "repairs" | "cash" | "accounting" | "reports" | "settings" | "development";
const navigation: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { id: "products", label: "المنتجات والمخزون", icon: Package },
  { id: "sales", label: "المبيعات ونقطة البيع", icon: ShoppingCart },
  { id: "purchases", label: "المشتريات", icon: ShoppingBasket },
  { id: "customers", label: "العملاء", icon: Users },
  { id: "suppliers", label: "الموردون", icon: Truck },
  { id: "repairs", label: "الصيانة والضمان", icon: Wrench },
  { id: "cash", label: "الصندوق والمصروفات", icon: Wallet },
  { id: "accounting", label: "المحاسبة ودفتر الأستاذ", icon: BookOpen },
  { id: "reports", label: "التقارير", icon: BarChart3 },
  { id: "settings", label: "الإعدادات", icon: Settings },
  { id: "development", label: "التطوير والدعم الفني", icon: Headphones },
];

interface CartLine { productId: string; quantity: number; productUnitId?: string }

export default function App() {
  const [section, setSection] = useState<Section>("dashboard");
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<RecentSale[]>([]);
  const [repairs, setRepairs] = useState<RepairRecord[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<RecentPurchase[]>([]);
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceRow[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntrySummary[]>([]);
  const [customerBalances, setCustomerBalances] = useState<PartyBalance[]>([]);
  const [supplierBalances, setSupplierBalances] = useState<PartyBalance[]>([]);
  const [customerPaymentTarget, setCustomerPaymentTarget] = useState<PartyBalance | null>(null);
  const [supplierPaymentTarget, setSupplierPaymentTarget] = useState<PartyBalance | null>(null);
  const [reportFrom, setReportFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [reportTo, setReportTo] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [showCreateRepair, setShowCreateRepair] = useState(false);
  const [showCreateSupplier, setShowCreateSupplier] = useState(false);
  const [saleToReturn, setSaleToReturn] = useState<RecentSale | null>(null);
  const [returnableItems, setReturnableItems] = useState<ReturnableSaleItem[]>([]);
  const [purchaseToReturn, setPurchaseToReturn] = useState<RecentPurchase | null>(null);
  const [returnablePurchaseItems, setReturnablePurchaseItems] = useState<ReturnablePurchaseItem[]>([]);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [unitProduct, setUnitProduct] = useState<Product | null>(null);
  const [stockDiscrepancies, setStockDiscrepancies] = useState<StockDiscrepancy[]>([]);
  const [stockCheckDone, setStockCheckDone] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartProduct, setCartProduct] = useState("");
  const [cartQuantity, setCartQuantity] = useState(1);
  const [saleProductUnits, setSaleProductUnits] = useState<ProductUnit[]>([]);
  const [saleProductUnitId, setSaleProductUnitId] = useState("");
  const [saleCustomer, setSaleCustomer] = useState("");
  const [salePaid, setSalePaid] = useState("0");
  const [salePaymentMethod, setSalePaymentMethod] = useState<"cash" | "card" | "transfer" | "mobile_wallet" | "other">("cash");
  const [purchaseCart, setPurchaseCart] = useState<PurchaseLineInput[]>([]);
  const [purchaseProduct, setPurchaseProduct] = useState("");
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [purchaseUnitCost, setPurchaseUnitCost] = useState("0");
  const [purchaseSupplier, setPurchaseSupplier] = useState("");
  const [purchasePaid, setPurchasePaid] = useState("0");
  const [openingAmount, setOpeningAmount] = useState("0");
  const [closingAmount, setClosingAmount] = useState("0");

  const refreshProducts = useCallback(async (term = "") => {
    if (!isDesktopRuntime()) return;
    setProducts(await listProducts(term));
  }, []);

  const refreshCustomers = useCallback(async (term = "") => {
    if (!isDesktopRuntime()) return;
    const [records, balances] = await Promise.all([listCustomers(term), listCustomerBalances()]);
    setCustomers(records);
    setCustomerBalances(balances);
  }, []);

  const refreshSales = useCallback(async () => {
    if (!isDesktopRuntime()) return;
    setSales(await listRecentSales());
  }, []);

  const refreshRepairs = useCallback(async (term = "") => {
    if (!isDesktopRuntime()) return;
    setRepairs(await listRepairs(term));
  }, []);
  const refreshSuppliers = useCallback(async (term = "") => {
    if (!isDesktopRuntime()) return;
    const [records, balances] = await Promise.all([listSuppliers(term), listSupplierBalances()]);
    setSuppliers(records);
    setSupplierBalances(balances);
  }, []);
  const refreshPurchases = useCallback(async () => {
    if (!isDesktopRuntime()) return;
    setPurchases(await listRecentPurchases());
  }, []);
  const refreshCash = useCallback(async () => {
    if (!isDesktopRuntime()) return;
    setCashSession(await getOpenCashSession());
  }, []);
  const refreshDashboard = useCallback(async () => {
    if (!isDesktopRuntime()) return;
    setDashboardMetrics(await getDashboardMetrics());
  }, []);
  const refreshReport = useCallback(async (from = reportFrom, to = reportTo) => {
    if (!isDesktopRuntime()) return;
    setFinancialSummary(await getFinancialSummary(from, to));
  }, [reportFrom, reportTo]);
  const refreshAccounting = useCallback(async (from = reportFrom, to = reportTo) => {
    if (!isDesktopRuntime()) return;
    const [balance, entries] = await Promise.all([getTrialBalance(from, to), listRecentJournalEntries()]);
    setTrialBalance(balance);
    setJournalEntries(entries);
  }, [reportFrom, reportTo]);

  const refreshAll = useCallback(async () => {
    if (!isDesktopRuntime()) return;
    try {
      await Promise.all([refreshProducts(), refreshCustomers(), refreshSales(), refreshRepairs(), refreshSuppliers(), refreshPurchases(), refreshCash(), refreshDashboard()]);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل بيانات النظام.");
    }
  }, [refreshProducts, refreshCustomers, refreshSales, refreshRepairs, refreshSuppliers, refreshPurchases, refreshCash, refreshDashboard]);

  useEffect(() => {
    setDesktop(isDesktopRuntime());
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!desktop) return;
    const load = async () => {
      try {
        if (section === "products") await refreshProducts(search);
        if (section === "customers") await refreshCustomers(search);
        if (section === "repairs") await refreshRepairs(search);
        if (section === "suppliers") await refreshSuppliers(search);
        if (section === "cash") await refreshCash();
        if (section === "reports") await refreshReport();
        if (section === "accounting") await refreshAccounting();
        if (section === "sales") await Promise.all([refreshProducts(), refreshCustomers(), refreshSales(), refreshCash()]);
        if (section === "purchases") await Promise.all([refreshProducts(), refreshSuppliers(), refreshPurchases(), refreshCash(), refreshDashboard()]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذر تحميل البيانات.");
      }
    };
    void load();
  }, [desktop, section, search, refreshProducts, refreshCustomers, refreshSales, refreshRepairs, refreshSuppliers, refreshPurchases, refreshCash, refreshReport, refreshDashboard, refreshAccounting]);

  const lowStock = useMemo(() => products.filter((p) => p.quantity <= p.minQuantity).length, [products]);
  const purchaseTotal = useMemo(() => purchaseCart.reduce((sum, line) => sum + line.unitCost * line.quantity, 0), [purchaseCart]);
  const cartTotal = useMemo(() => cart.reduce((sum, line) => {
    const product = products.find((item) => item.id === line.productId);
    return sum + (product ? product.salePrice * line.quantity : 0);
  }, 0), [cart, products]);

  async function handleCreateProduct(form: HTMLFormElement) {
    const data = new FormData(form);
    const number = (key: string) => Number(data.get(key));
    setBusy(true);
    try {
      await createProduct({
        sku: String(data.get("sku") ?? ""), name: String(data.get("name") ?? ""),
        category: String(data.get("category") ?? ""), brand: String(data.get("brand") ?? ""),
        costPrice: number("costPrice"), salePrice: number("salePrice"),
        quantity: number("quantity"), minQuantity: number("minQuantity"),
      });
      setShowCreateProduct(false);
      await refreshProducts();
      setNotice("تم حفظ المنتج وتسجيل رصيد المخزون الافتتاحي.");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ المنتج.");
    } finally { setBusy(false); }
  }

  async function handleStockReconciliation() {
    setBusy(true);
    try {
      const discrepancies = await reconcileStock();
      setStockDiscrepancies(discrepancies); setStockCheckDone(true);
      setNotice(discrepancies.length ? `اكتُشفت فروقات في ${discrepancies.length} صنف. راجع التفاصيل قبل أي تعديل.` : "دفتر المخزون متطابق مع أرصدة المنتجات.");
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر فحص المخزون."); }
    finally { setBusy(false); }
  }

  async function handleAdjustStock(form: HTMLFormElement) {
    if (!stockProduct) return;
    const data = new FormData(form);
    setBusy(true);
    try {
      await adjustStock(stockProduct.id, Number(data.get("quantityDelta")), String(data.get("reason") ?? ""));
      setStockProduct(null); await refreshProducts(); setNotice("تم تعديل رصيد المخزون وتسجيل الحركة في الدفتر."); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر تعديل المخزون."); }
    finally { setBusy(false); }
  }

  async function handleRegisterUnit(form: HTMLFormElement) {
    if (!unitProduct) return;
    const data = new FormData(form);
    setBusy(true);
    try {
      await registerProductUnit({ productId: unitProduct.id, imei: String(data.get("imei") ?? ""), serialNumber: String(data.get("serialNumber") ?? ""), condition: String(data.get("condition") ?? "new") as "new" | "used" | "refurbished", warrantyUntil: String(data.get("warrantyUntil") ?? "") });
      setUnitProduct(null); setNotice("تم تسجيل الرقم التسلسلي للجهاز. لم تتغير كمية المخزون لأن التسجيل يربط الوحدة برصيد موجود."); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر تسجيل الجهاز."); }
    finally { setBusy(false); }
  }

  async function handleCreateCustomer(form: HTMLFormElement) {
    const data = new FormData(form);
    setBusy(true);
    try {
      await createCustomer({
        name: String(data.get("name") ?? ""), phone: String(data.get("phone") ?? ""),
        email: String(data.get("email") ?? ""), address: String(data.get("address") ?? ""),
        notes: String(data.get("notes") ?? ""),
      });
      setShowCreateCustomer(false);
      await refreshCustomers();
      setNotice("تم تسجيل العميل بنجاح.");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ العميل.");
    } finally { setBusy(false); }
  }

  async function handleCreateRepair(form: HTMLFormElement) {
    const data = new FormData(form);
    setBusy(true);
    try {
      await createRepair({
        jobNumber: String(data.get("jobNumber") ?? ""),
        customerId: String(data.get("customerId") ?? "") || null,
        deviceType: String(data.get("deviceType") ?? ""),
        deviceModel: String(data.get("deviceModel") ?? ""),
        imei: String(data.get("imei") ?? ""),
        reportedIssue: String(data.get("reportedIssue") ?? ""),
        intakeCondition: String(data.get("intakeCondition") ?? ""),
        estimatedCost: Number(data.get("estimatedCost") ?? 0),
      });
      setShowCreateRepair(false);
      await refreshRepairs();
      setNotice("تم فتح طلب الصيانة وتسجيل أول حالة في سجل التتبع.");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إنشاء طلب الصيانة.");
    } finally { setBusy(false); }
  }

  async function handleSaleProductChange(productId: string) {
    setCartProduct(productId);
    setSaleProductUnitId("");
    if (!productId || !desktop) { setSaleProductUnits([]); return; }
    try { setSaleProductUnits(await listProductUnits(productId)); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر تحميل الأرقام التسلسلية."); }
  }

  function addCartLine() {
    if (!cartProduct || !Number.isSafeInteger(cartQuantity) || cartQuantity < 1) {
      setError("اختر منتجاً وأدخل كمية صحيحة.");
      return;
    }
    const product = products.find((item) => item.id === cartProduct);
    const registeredUnits = saleProductUnits.filter((unit) => unit.status !== "sold");
    const untrackedAvailable = (product?.quantity ?? 0) - registeredUnits.length;
    if (!product || cartQuantity > product.quantity) {
      setError("الكمية المطلوبة تتجاوز المخزون المتاح.");
      return;
    }
    if (saleProductUnitId) {
      if (cartQuantity !== 1 || !saleProductUnits.some((unit) => unit.id === saleProductUnitId && unit.status === "in_stock")) {
        setError("الجهاز ذو الرقم التسلسلي يجب أن يضاف بكمية واحدة وأن يكون متاحاً."); return;
      }
      if (cart.some((line) => line.productUnitId === saleProductUnitId)) {
        setError("هذا الرقم التسلسلي موجود بالفعل في الفاتورة."); return;
      }
      setCart((current) => [...current, { productId: cartProduct, quantity: 1, productUnitId: saleProductUnitId }]);
    } else {
      const alreadyUntracked = cart.filter((line) => line.productId === cartProduct && !line.productUnitId).reduce((sum, line) => sum + line.quantity, 0);
      if (alreadyUntracked + cartQuantity > untrackedAvailable) {
        setError(`يجب اختيار IMEI/Serial للأجهزة المسجلة. الكمية غير المسلسلة المتاحة: ${Math.max(0, untrackedAvailable - alreadyUntracked)}.`); return;
      }
      setCart((current) => [...current, { productId: cartProduct, quantity: cartQuantity }]);
    }
    setError("");
    setCartQuantity(1);
    setSaleProductUnitId("");
  }

  async function completeSale() {
    setBusy(true);
    try {
      const result = await checkoutSale({
        customerId: saleCustomer || null,
        lines: cart,
        paidAmount: Number(salePaid),
        paymentMethod: salePaymentMethod,
      });
      setCart([]);
      setSalePaid("0");
      setSaleCustomer("");
      await Promise.all([refreshProducts(), refreshSales()]);
      setNotice(`تم ترحيل الفاتورة ${result.invoiceNumber}. الإجمالي ${formatMoney(result.total)}، المتبقي ${formatMoney(result.balanceDue)}.`);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إتمام عملية البيع.");
    } finally { setBusy(false); }
  }

  async function openSaleReturn(sale: RecentSale) {
    setBusy(true);
    try {
      const items = await listSaleReturnableItems(sale.id);
      const available = items.filter((item) => item.remainingQuantity > 0);
      if (!available.length) throw new Error("تم إرجاع جميع كميات هذه الفاتورة بالفعل.");
      setReturnableItems(available); setSaleToReturn(sale); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر تحميل بنود المرتجع."); }
    finally { setBusy(false); }
  }

  async function openPurchaseReturn(purchase: RecentPurchase) {
    setBusy(true);
    try {
      const items = await listPurchaseReturnableItems(purchase.id);
      const available = items.filter((item) => item.remainingQuantity > 0 && item.availableStock > 0);
      if (!available.length) throw new Error("لا توجد كميات من هذه الفاتورة متاحة للإرجاع من المخزون الحالي.");
      setReturnablePurchaseItems(available); setPurchaseToReturn(purchase); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر تحميل بنود مرتجع الشراء."); }
    finally { setBusy(false); }
  }

  async function handlePurchaseReturn(form: HTMLFormElement) {
    if (!purchaseToReturn) return;
    const data = new FormData(form); setBusy(true);
    try {
      const result = await processPurchaseReturn({
        purchaseId: purchaseToReturn.id,
        items: [{ purchaseItemId: String(data.get("purchaseItemId") ?? ""), quantity: Number(data.get("quantity")) }],
        refundAmount: Number(data.get("refundAmount")),
        refundMethod: String(data.get("refundMethod") ?? "supplier_credit") as "supplier_credit" | "cash" | "card" | "transfer" | "mobile_wallet" | "other",
        reason: String(data.get("reason") ?? ""),
      });
      setPurchaseToReturn(null);
      await Promise.all([refreshProducts(), refreshPurchases(), refreshSuppliers(), refreshCash(), refreshAccounting(), refreshReport(), refreshDashboard()]);
      setNotice(`تم ترحيل مرتجع الشراء ${result.returnNumber} بقيمة ${formatMoney(result.refundAmount)} وخفض المخزون بمقدار الكميات المرتجعة.`);
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر ترحيل مرتجع الشراء."); }
    finally { setBusy(false); }
  }

  async function handleSaleReturn(form: HTMLFormElement) {
    if (!saleToReturn) return;
    const data = new FormData(form);
    setBusy(true);
    try {
      const result = await processSaleReturn({
        saleId: saleToReturn.id,
        items: [{ saleItemId: String(data.get("saleItemId") ?? ""), quantity: Number(data.get("quantity")) }],
        refundAmount: Number(data.get("refundAmount")),
        refundMethod: String(data.get("refundMethod") ?? "cash") as "cash" | "card" | "transfer" | "mobile_wallet" | "other" | "customer_credit",
        reason: String(data.get("reason") ?? ""),
      });
      setSaleToReturn(null);
      await Promise.all([refreshProducts(), refreshSales(), refreshCash(), refreshReport(), refreshAccounting()]);
      setNotice(`تم ترحيل المرتجع ${result.returnNumber} بقيمة ${formatMoney(result.refundAmount)} مع إعادة الكمية للمخزون.`);
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر ترحيل المرتجع."); }
    finally { setBusy(false); }
  }

  async function handleCustomerReceipt(form: HTMLFormElement) {
    if (!customerPaymentTarget) return;
    const data = new FormData(form); setBusy(true);
    try {
      await receiveCustomerPayment({ customerId: customerPaymentTarget.id, amount: Number(data.get("amount")), method: String(data.get("method") ?? "cash") as "cash" | "card" | "transfer" | "mobile_wallet" | "other", note: String(data.get("note") ?? "") });
      setCustomerPaymentTarget(null); await refreshCustomers(); await refreshAccounting(); setNotice("تم تسجيل تحصيل العميل وتوزيعه على أقدم الفواتير المستحقة مع قيد محاسبي."); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر تسجيل تحصيل العميل."); }
    finally { setBusy(false); }
  }

  async function handleSupplierSettlement(form: HTMLFormElement) {
    if (!supplierPaymentTarget) return;
    const data = new FormData(form); setBusy(true);
    try {
      await paySupplier({ supplierId: supplierPaymentTarget.id, amount: Number(data.get("amount")), method: String(data.get("method") ?? "cash") as "cash" | "card" | "transfer" | "mobile_wallet" | "other", note: String(data.get("note") ?? "") });
      setSupplierPaymentTarget(null); await refreshSuppliers(); await refreshCash(); await refreshAccounting(); setNotice("تم تسجيل سداد المورد وتوزيعه على أقدم فواتير الشراء مع قيد محاسبي."); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر تسجيل سداد المورد."); }
    finally { setBusy(false); }
  }

  async function handleCreateSupplier(form: HTMLFormElement) {
    const data = new FormData(form);
    setBusy(true);
    try {
      await createSupplier({ name: String(data.get("name") ?? ""), phone: String(data.get("phone") ?? ""), email: String(data.get("email") ?? ""), address: String(data.get("address") ?? ""), taxNumber: String(data.get("taxNumber") ?? ""), notes: String(data.get("notes") ?? "") });
      setShowCreateSupplier(false);
      await refreshSuppliers();
      setNotice("تم تسجيل المورد."); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر حفظ المورد."); }
    finally { setBusy(false); }
  }

  function addPurchaseLine() {
    const product = products.find((item) => item.id === purchaseProduct);
    const cost = Number(purchaseUnitCost);
    if (!product || !Number.isSafeInteger(purchaseQuantity) || purchaseQuantity < 1 || !Number.isFinite(cost) || cost < 0) {
      setError("أدخل بيانات صنف الشراء بشكل صحيح."); return;
    }
    setPurchaseCart((current) => [...current, { productId: product.id, quantity: purchaseQuantity, unitCost: cost }]);
    setPurchaseProduct(""); setPurchaseQuantity(1); setPurchaseUnitCost("0"); setError("");
  }

  async function completePurchase() {
    setBusy(true);
    try {
      const result = await receivePurchase({ supplierId: purchaseSupplier, lines: purchaseCart, paidAmount: Number(purchasePaid) });
      setPurchaseCart([]); setPurchasePaid("0"); setPurchaseSupplier("");
      await Promise.all([refreshProducts(), refreshPurchases(), refreshCash()]);
      setNotice(`تم ترحيل فاتورة الشراء ${result.invoiceNumber}. المتبقي للمورد ${formatMoney(result.balanceDue)}.`); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر ترحيل فاتورة الشراء."); }
    finally { setBusy(false); }
  }

  async function handleOpenCash() {
    setBusy(true);
    try { await openCashSession(Number(openingAmount)); await refreshCash(); setNotice("تم فتح وردية الصندوق."); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر فتح الصندوق."); }
    finally { setBusy(false); }
  }

  async function handleCloseCash() {
    setBusy(true);
    try { const result = await closeCashSession(Number(closingAmount)); await refreshCash(); setNotice(`أُغلقت الوردية. الرصيد المتوقع ${formatMoney(result.expected)}، والفرق ${formatMoney(result.variance)}.`); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر إغلاق الصندوق."); }
    finally { setBusy(false); }
  }

  async function handleExpense(form: HTMLFormElement) {
    const data = new FormData(form);
    setBusy(true);
    try {
      await recordExpense({ description: String(data.get("description") ?? ""), amount: Number(data.get("amount")), paymentMethod: String(data.get("paymentMethod") ?? "cash") as "cash" | "card" | "transfer" | "mobile_wallet" | "other", referenceNumber: String(data.get("referenceNumber") ?? ""), notes: String(data.get("notes") ?? "") });
      form.reset(); await refreshCash(); setNotice("تم تسجيل المصروف وربطه بحركة الدفع."); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر تسجيل المصروف."); }
    finally { setBusy(false); }
  }

  async function changeRepairStatus(repair: RepairRecord, status: RepairStatus) {
    setBusy(true);
    try {
      await transitionRepair(repair.id, status);
      await refreshRepairs();
      setNotice(`تم تحديث حالة طلب ${repair.jobNumber}.`);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحديث حالة الصيانة.");
    } finally { setBusy(false); }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><img src={storeLogo} alt="شعار عبدالملك للاتصالات والإلكترونيات" /></div><div><strong>عبدالملك</strong><span>للاتصالات والإلكترونيات</span></div></div>
        <div className="store-label"><span>مساحة العمل</span><span className="status-dot" /></div>
        <button className={section === "sales" ? "pos-shortcut active" : "pos-shortcut"} onClick={() => { setSection("sales"); setSearch(""); setError(""); }}>
          <ShoppingCart size={18} /><span>نقطة البيع السريعة</span><kbd>F2</kbd>
        </button>
        <nav className="navigation" aria-label="التنقل الرئيسي">
          {navigation.map(({ id, label, icon: Icon }, index) => (
            <div className="nav-entry" key={id}>
              {([0, 1, 4, 6, 8, 10].includes(index)) && <p className="nav-caption">{({0:"الرئيسية",1:"العمليات",4:"العلاقات",6:"الخدمات",8:"المالية والتقارير",10:"الإدارة"})[index]}</p>}
              <button className={section === id ? "nav-item active" : "nav-item"} onClick={() => { setSection(id); setSearch(""); setError(""); }}>
                <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-footer"><div className="avatar">ع</div><div><strong>مساحة المتجر</strong><span>الإصدار 0.2 — تطوير</span></div></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="page-heading"><span className="eyebrow">ABDULMALIK STORE MANAGEMENT / مساحة العمل</span><h1>{navigation.find((item) => item.id === section)?.label}</h1></div>
          <label className="header-search"><Search size={16}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث في القسم الحالي..." aria-label="البحث في القسم الحالي"/><kbd>Ctrl K</kbd></label>
          <div className="topbar-actions"><span className={desktop ? "runtime-badge online" : "runtime-badge"}><span />{desktop ? "SQLite محلي" : "وضع المعاينة"}</span><button className="icon-button" aria-label="تحديث البيانات" onClick={() => void refreshAll()}><RefreshCw size={17} /></button></div>
        </header>

        {!desktop && <div className="notice"><Wifi size={18} /><div><strong>هذه معاينة للواجهة</strong><span>شغّل التطبيق عبر Tauri للوصول إلى قاعدة SQLite المحلية وتنفيذ العمليات.</span></div></div>}
        {error && <div className="error-banner" role="alert">{error}</div>}
        {notice && <div className="success-banner" role="status">{notice}<button onClick={() => setNotice("")} aria-label="إغلاق">×</button></div>}

        {section === "dashboard" && (
          <>
            <section className="welcome-panel"><div><span className="welcome-kicker">مرحباً بك في نظامك</span><h2>إدارة متجرك، <em>بوضوح وثقة.</em></h2><p>تابع المنتجات والمبيعات والخدمات من مساحة عمل واحدة.</p></div><div className="welcome-art"><img src={storeLogo} alt="شعار عبدالملك للاتصالات والإلكترونيات" /></div></section>
            <section className="stats-grid">
              <StatCard icon={Boxes} label="إجمالي المنتجات" value={desktop ? (dashboardMetrics?.productCount ?? products.length).toLocaleString("ar") : "—"} detail="منتج نشط" />
              <StatCard icon={ClipboardList} label="منتجات منخفضة" value={desktop ? (dashboardMetrics?.lowStockCount ?? lowStock).toLocaleString("ar") : "—"} detail="تحتاج إلى إعادة طلب" />
              <StatCard icon={Users} label="العملاء" value={desktop ? (dashboardMetrics?.customerCount ?? customers.length).toLocaleString("ar") : "—"} detail="عميل مسجل" />
              <StatCard icon={CreditCard} label="مبيعات اليوم" value={desktop ? (dashboardMetrics?.salesToday ?? 0).toLocaleString("ar") : "—"} detail={desktop ? `إيراد ${formatMoney(dashboardMetrics?.revenueToday ?? 0)}` : "يظهر في تطبيق سطح المكتب"} />
            </section>
            <section className="content-grid">
              <div className="panel"><div className="panel-heading"><div><h3>وحدات التشغيل</h3><p>الوحدات المرتبطة حالياً بقاعدة البيانات</p></div><span className="subtle-tag">الإصدار 0.2</span></div>
                <div className="module-list">
                  <ModuleRow icon={Package} title="إدارة المنتجات" description="إضافة الأصناف والأسعار والأرصدة الافتتاحية" state="متاحة" />
                  <ModuleRow icon={ShoppingCart} title="نقطة البيع" description="ترحيل الفواتير وخصم المخزون وتسجيل التحصيل" state="متاحة أولياً" />
                  <ModuleRow icon={Users} title="إدارة العملاء" description="تسجيل بيانات العملاء والبحث" state="متاحة" />
                  <ModuleRow icon={Wrench} title="الصيانة" description="فتح أوامر الصيانة وتتبع الحالات" state="متاحة أولياً" />
                </div>
              </div>
              <div className="panel side-panel"><div className="panel-heading"><div><h3>مركز التنبيهات</h3><p>ما يحتاج إلى انتباه</p></div><Headphones size={19} /></div>
                <div className="empty-state"><div className="empty-icon"><Activity size={23} /></div><strong>{lowStock ? `${lowStock} منتجات منخفضة المخزون` : "لا توجد تنبيهات مخزون"}</strong><span>راجع المنتجات التي وصلت إلى حد إعادة الطلب.</span></div>
              </div>
            </section>
            <section className="development-cta">
              <div className="development-cta-icon"><MessageCircle size={22}/></div>
              <div className="development-cta-copy"><strong>تحتاج إلى ميزة جديدة أو تطوير خاص لمتجرك؟</strong><span>تواصل مع العصيمي للبرمجيات والحلول التقنية المتطورة لمناقشة احتياجك والاتفاق على التطوير.</span></div>
              <a className="primary-button" href="https://wa.me/message/NEVZVG5DC5CEA1" target="_blank" rel="noreferrer">تواصل عبر واتساب <ExternalLink size={15}/></a>
            </section>
          </>
        )}

        {section === "products" && <section className="panel data-panel">
          <div className="panel-heading"><div><h3>المنتجات والمخزون</h3><p>إدارة الأصناف والأسعار والكميات المتاحة</p></div><div className="panel-actions"><button className="secondary-button" disabled={busy} onClick={()=>void handleStockReconciliation()}>فحص تطابق المخزون</button><button className="primary-button" onClick={() => setShowCreateProduct(true)}><Plus size={17} /> إضافة منتج</button></div></div>
          {stockCheckDone && <div className={stockDiscrepancies.length ? "error-banner" : "success-banner"}>{stockDiscrepancies.length ? `عدد الفروقات: ${stockDiscrepancies.length}` : "الأرصدة متطابقة مع دفتر الحركات."}</div>}
          {stockDiscrepancies.length > 0 && <div className="table-wrap"><table><thead><tr><th>الصنف</th><th>رصيد المنتج</th><th>رصيد الدفتر</th><th>الفرق</th></tr></thead><tbody>{stockDiscrepancies.map((d)=><tr key={d.productId}><td>{d.name} <small>{d.sku}</small></td><td>{d.recordedQuantity}</td><td>{d.ledgerQuantity}</td><td>{d.difference}</td></tr>)}</tbody></table></div>}
          <div className="table-toolbar"><label className="search-box"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الرمز أو العلامة التجارية" /></label><span className="result-count">{products.length} منتج</span></div>
          <div className="table-wrap"><table><thead><tr><th>المنتج</th><th>رمز SKU</th><th>التصنيف</th><th>سعر التكلفة</th><th>سعر البيع</th><th>الكمية</th><th>الحالة</th><th>الإجراءات</th></tr></thead>
            <tbody>{products.map((p) => <tr key={p.id}><td><strong>{p.name}</strong><small>{p.brand || "بدون علامة تجارية"}</small></td><td dir="ltr">{p.sku}</td><td>{p.category}</td><td>{formatMoney(p.costPrice)}</td><td>{formatMoney(p.salePrice)}</td><td><span className={p.quantity <= p.minQuantity ? "quantity low" : "quantity"}>{p.quantity}</span></td><td><span className="pill success">{p.status === "active" ? "نشط" : "متوقف"}</span></td><td className="row-actions"><button className="text-button" onClick={() => setStockProduct(p)}>تعديل المخزون</button><button className="text-button" onClick={() => setUnitProduct(p)}>IMEI / Serial</button></td></tr>)}</tbody>
          </table>{products.length === 0 && <div className="table-empty">لا توجد منتجات مسجلة حتى الآن.</div>}</div>
        </section>}

        {section === "customers" && <section className="panel data-panel">
          <div className="panel-heading"><div><h3>ملف العملاء</h3><p>بيانات الاتصال وسجل التعاملات الأساسي</p></div><button className="primary-button" onClick={() => setShowCreateCustomer(true)}><Plus size={17} /> إضافة عميل</button></div>
          <div className="table-toolbar"><label className="search-box"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث باسم العميل أو رقم الهاتف" /></label><span className="result-count">{customers.length} عميل</span></div>
          <div className="table-wrap"><table><thead><tr><th>اسم العميل</th><th>الهاتف</th><th>البريد الإلكتروني</th><th>العنوان</th><th>تاريخ التسجيل</th><th>الرصيد المستحق</th><th>إجراء</th></tr></thead>
            <tbody>{customers.map((c) => <tr key={c.id}><td><strong>{c.name}</strong></td><td dir="ltr">{c.phone || "—"}</td><td dir="ltr">{c.email || "—"}</td><td>{c.address || "—"}</td><td>{new Date(c.createdAt).toLocaleDateString("ar")}</td><td>{formatMoney(customerBalances.find((b)=>b.id===c.id)?.balance ?? 0)}</td><td><button className="text-button" disabled={(customerBalances.find((b)=>b.id===c.id)?.balance ?? 0)<=0} onClick={()=>setCustomerPaymentTarget(customerBalances.find((b)=>b.id===c.id) ?? null)}>تحصيل</button></td></tr>)}</tbody>
          </table>{customers.length === 0 && <div className="table-empty">لا توجد بيانات عملاء. أضف أول عميل للبدء.</div>}</div>
        </section>}

        {section === "sales" && <section className="sales-layout">
          <div className="panel data-panel"><div className="panel-heading"><div><h3>نقطة البيع</h3><p>أنشئ فاتورة مع التحقق من المخزون قبل الترحيل</p></div><Receipt size={20} /></div>
            <div className="form-grid">
              <label className="field"><span>المنتج</span><select value={cartProduct} onChange={(e) => void handleSaleProductChange(e.target.value)}><option value="">اختر منتجاً</option>{products.filter((p) => p.status === "active" && p.quantity > 0).map((p) => <option key={p.id} value={p.id}>{p.name} — المتاح {p.quantity}</option>)}</select></label>
              <label className="field"><span>الكمية</span><input type="number" min="1" step="1" value={cartQuantity} onChange={(e) => setCartQuantity(Number(e.target.value))} /></label>
            </div>
            {saleProductUnits.some((unit) => unit.status === "in_stock") && <label className="field"><span>IMEI / الرقم التسلسلي (اختياري عند بيع جهاز مسجل)</span><select value={saleProductUnitId} onChange={(e)=>{setSaleProductUnitId(e.target.value);if(e.target.value)setCartQuantity(1);}}><option value="">مخزون غير مسجل تسلسلياً</option>{saleProductUnits.filter((unit)=>unit.status === "in_stock").map((unit)=><option key={unit.id} value={unit.id}>{unit.imei || unit.serialNumber} — {unit.condition === "new" ? "جديد" : unit.condition === "used" ? "مستعمل" : "مجدد"}</option>)}</select></label>}
            <button className="secondary-button add-line-button" onClick={addCartLine}><Plus size={16} /> إضافة إلى الفاتورة</button>
            <div className="table-wrap"><table><thead><tr><th>الصنف</th><th>IMEI / Serial</th><th>السعر</th><th>الكمية</th><th>الإجمالي</th><th></th></tr></thead><tbody>
              {cart.map((line, index) => { const p = products.find((item) => item.id === line.productId); return p ? <tr key={`${line.productId}-${line.productUnitId ?? "bulk"}-${index}`}><td>{p.name}</td><td dir="ltr">{line.productUnitId ? (saleProductUnits.find((unit)=>unit.id===line.productUnitId)?.imei || saleProductUnits.find((unit)=>unit.id===line.productUnitId)?.serialNumber || "مسجل") : "—"}</td><td>{formatMoney(p.salePrice)}</td><td>{line.quantity}</td><td>{formatMoney(p.salePrice * line.quantity)}</td><td><button className="text-button" onClick={() => setCart((current) => current.filter((_, itemIndex) => itemIndex !== index))}>إزالة</button></td></tr> : null; })}
            </tbody></table>{cart.length === 0 && <div className="table-empty">أضف منتجات إلى الفاتورة.</div>}</div>
          </div>
          <div className="panel checkout-panel"><h3>ملخص الفاتورة</h3>
            <label className="field"><span>العميل</span><select value={saleCustomer} onChange={(e) => setSaleCustomer(e.target.value)}><option value="">عميل نقدي</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <div className="checkout-total"><span>الإجمالي</span><strong>{formatMoney(cartTotal)}</strong></div>
            <label className="field"><span>المبلغ المدفوع</span><input type="number" min="0" step="0.01" value={salePaid} onChange={(e) => setSalePaid(e.target.value)} /></label>
            <label className="field"><span>طريقة الدفع</span><select value={salePaymentMethod} onChange={(e) => setSalePaymentMethod(e.target.value as typeof salePaymentMethod)}><option value="cash">نقداً</option><option value="card">بطاقة</option><option value="transfer">تحويل</option><option value="mobile_wallet">محفظة إلكترونية</option><option value="other">أخرى</option></select></label>
            <button className="primary-button checkout-button" disabled={busy || !cart.length} onClick={() => void completeSale()}><CreditCard size={17} /> ترحيل الفاتورة</button>
            <p className="muted-help">يتم ترحيل الفاتورة وخصم المخزون وتسجيل الدفعة في معاملة قاعدة بيانات واحدة.</p>
          </div>
        </section>}

        {section === "sales" && <section className="panel data-panel recent-sales-panel"><div className="panel-heading"><div><h3>آخر فواتير البيع</h3><p>آخر الفواتير المسجلة محلياً</p></div></div><div className="table-wrap"><table><thead><tr><th>رقم الفاتورة</th><th>العميل</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>التاريخ</th><th>إجراء</th></tr></thead><tbody>{sales.map((sale)=><tr key={sale.id}><td dir="ltr">{sale.invoiceNumber}</td><td>{sale.customerName}</td><td>{formatMoney(sale.total)}</td><td>{formatMoney(sale.paidAmount)}</td><td>{formatMoney(sale.total-sale.paidAmount)}</td><td>{new Date(sale.createdAt).toLocaleDateString("ar")}</td><td><button className="text-button" disabled={busy} onClick={()=>void openSaleReturn(sale)}>مرتجع</button></td></tr>)}</tbody></table>{sales.length===0&&<div className="table-empty">لا توجد فواتير بعد.</div>}</div></section>}

        {section === "suppliers" && <section className="panel data-panel">
          <div className="panel-heading"><div><h3>ملف الموردين</h3><p>إدارة جهات التوريد وبيانات التواصل</p></div><button className="primary-button" onClick={() => setShowCreateSupplier(true)}><Plus size={17} /> إضافة مورد</button></div>
          <div className="table-toolbar"><label className="search-box"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث باسم المورد أو الهاتف" /></label><span className="result-count">{suppliers.length} مورد</span></div>
          <div className="table-wrap"><table><thead><tr><th>المورد</th><th>الهاتف</th><th>البريد</th><th>الرقم الضريبي</th><th>العنوان</th><th>الرصيد المستحق</th><th>إجراء</th></tr></thead><tbody>{suppliers.map((v) => <tr key={v.id}><td><strong>{v.name}</strong></td><td dir="ltr">{v.phone || "—"}</td><td dir="ltr">{v.email || "—"}</td><td dir="ltr">{v.taxNumber || "—"}</td><td>{v.address || "—"}</td><td>{formatMoney(supplierBalances.find((b)=>b.id===v.id)?.balance ?? 0)}</td><td><button className="text-button" disabled={(supplierBalances.find((b)=>b.id===v.id)?.balance ?? 0)<=0} onClick={()=>setSupplierPaymentTarget(supplierBalances.find((b)=>b.id===v.id) ?? null)}>سداد</button></td></tr>)}</tbody></table>{suppliers.length === 0 && <div className="table-empty">لا يوجد موردون مسجلون.</div>}</div>
        </section>}

        {section === "purchases" && <section className="sales-layout">
          <div className="panel data-panel"><div className="panel-heading"><div><h3>استلام مشتريات</h3><p>ترحيل فاتورة المورد وزيادة المخزون وتحديث متوسط التكلفة</p></div><ShoppingBasket size={20} /></div>
            <div className="form-grid"><label className="field"><span>المورد</span><select value={purchaseSupplier} onChange={(e) => setPurchaseSupplier(e.target.value)}><option value="">اختر المورد</option>{suppliers.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label><label className="field"><span>المنتج</span><select value={purchaseProduct} onChange={(e) => { setPurchaseProduct(e.target.value); const p=products.find(x=>x.id===e.target.value); if(p)setPurchaseUnitCost(p.costPrice.toString()); }}><option value="">اختر المنتج</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className="field"><span>الكمية</span><input type="number" min="1" step="1" value={purchaseQuantity} onChange={(e) => setPurchaseQuantity(Number(e.target.value))} /></label><label className="field"><span>تكلفة الوحدة</span><input type="number" min="0" step="0.01" value={purchaseUnitCost} onChange={(e) => setPurchaseUnitCost(e.target.value)} /></label></div>
            <button className="secondary-button add-line-button" onClick={addPurchaseLine}><Plus size={16} /> إضافة بند شراء</button>
            <div className="table-wrap"><table><thead><tr><th>المنتج</th><th>الكمية</th><th>تكلفة الوحدة</th><th>الإجمالي</th><th></th></tr></thead><tbody>{purchaseCart.map((line, index) => { const p=products.find(x=>x.id===line.productId); return <tr key={`${line.productId}-${index}`}><td>{p?.name ?? "منتج"}</td><td>{line.quantity}</td><td>{formatMoney(line.unitCost)}</td><td>{formatMoney(line.quantity*line.unitCost)}</td><td><button className="text-button" onClick={() => setPurchaseCart((current) => current.filter((_, i) => i !== index))}>إزالة</button></td></tr>; })}</tbody></table>{purchaseCart.length===0 && <div className="table-empty">أضف الأصناف المستلمة.</div>}</div>
            <div className="panel-heading purchase-history-heading"><div><h3>آخر فواتير الشراء</h3><p>آخر 100 فاتورة مسجلة</p></div></div><div className="table-wrap"><table><thead><tr><th>الفاتورة</th><th>المورد</th><th>الإجمالي</th><th>المدفوع</th><th>التاريخ</th><th>إجراء</th></tr></thead><tbody>{purchases.slice(0,10).map((p)=><tr key={p.id}><td dir="ltr">{p.invoiceNumber}</td><td>{p.supplierName}</td><td>{formatMoney(p.total)}</td><td>{formatMoney(p.paidAmount)}</td><td>{new Date(p.createdAt).toLocaleDateString("ar")}</td><td><button className="text-button" disabled={busy} onClick={()=>void openPurchaseReturn(p)}>مرتجع للمورد</button></td></tr>)}</tbody></table></div>
          </div>
          <div className="panel checkout-panel"><h3>ملخص الشراء</h3><div className="checkout-total"><span>الإجمالي</span><strong>{formatMoney(purchaseTotal)}</strong></div><label className="field"><span>المبلغ المدفوع نقداً</span><input type="number" min="0" step="0.01" value={purchasePaid} onChange={(e)=>setPurchasePaid(e.target.value)} /></label><button className="primary-button checkout-button" disabled={busy || !purchaseCart.length || !purchaseSupplier} onClick={()=>void completePurchase()}><ShoppingBasket size={17}/> ترحيل فاتورة الشراء</button><p className="muted-help">يتطلب السداد النقدي فتح وردية الصندوق. ترحيل المشتريات يحدّث المخزون ومتوسط تكلفة المنتج ضمن معاملة واحدة.</p></div>
        </section>}

        {section === "cash" && <section className="content-grid">
          <div className="panel data-panel"><div className="panel-heading"><div><h3>إدارة الصندوق</h3><p>فتح وإغلاق الوردية ومطابقة الرصيد النقدي</p></div><Wallet size={20}/></div>
            {cashSession ? <><div className="cash-open-state"><span className="status-dot"/> وردية مفتوحة منذ {new Date(cashSession.openedAt).toLocaleString("ar")}</div><label className="field"><span>النقد الفعلي عند الإغلاق</span><input type="number" min="0" step="0.01" value={closingAmount} onChange={(e)=>setClosingAmount(e.target.value)}/></label><button className="primary-button checkout-button" disabled={busy} onClick={()=>void handleCloseCash()}>إغلاق الوردية ومطابقة الصندوق</button></> : <><div className="empty-state"><div className="empty-icon"><Wallet size={23}/></div><strong>لا توجد وردية مفتوحة</strong><span>افتح وردية قبل تسجيل المقبوضات أو المدفوعات النقدية.</span></div><label className="field"><span>رصيد بداية الوردية</span><input type="number" min="0" step="0.01" value={openingAmount} onChange={(e)=>setOpeningAmount(e.target.value)}/></label><button className="primary-button checkout-button" disabled={busy} onClick={()=>void handleOpenCash()}>فتح وردية الصندوق</button></>}
          </div>
          <div className="panel data-panel"><div className="panel-heading"><div><h3>تسجيل مصروف</h3><p>تسجيل المصروف وحركة الدفع المرتبطة</p></div><Receipt size={20}/></div><form onSubmit={(e)=>{e.preventDefault();void handleExpense(e.currentTarget);}}><div className="form-grid"><Field name="description" label="وصف المصروف" required/><Field name="amount" label="المبلغ" type="number" min="0.01" step="0.01" required/><label className="field"><span>طريقة الدفع</span><select name="paymentMethod"><option value="cash">نقداً</option><option value="card">بطاقة</option><option value="transfer">تحويل</option><option value="mobile_wallet">محفظة إلكترونية</option><option value="other">أخرى</option></select></label><Field name="referenceNumber" label="رقم مرجعي"/><Field name="notes" label="ملاحظات"/></div><button className="primary-button add-line-button" disabled={busy} type="submit">حفظ المصروف</button></form></div>
        </section>}

        {section === "repairs" && <section className="panel data-panel">
          <div className="panel-heading"><div><h3>أوامر الصيانة</h3><p>تسجيل الجهاز ومتابعة دورة الإصلاح</p></div><button className="primary-button" onClick={() => setShowCreateRepair(true)}><Plus size={17} /> طلب صيانة جديد</button></div>
          <div className="table-toolbar"><label className="search-box"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث برقم الطلب أو IMEI أو الموديل" /></label><span className="result-count">{repairs.length} طلب</span></div>
          <div className="table-wrap"><table><thead><tr><th>رقم الطلب</th><th>العميل</th><th>الجهاز</th><th>IMEI</th><th>العطل</th><th>الحالة</th><th>تحديث الحالة</th></tr></thead>
            <tbody>{repairs.map((r) => <tr key={r.id}><td dir="ltr">{r.jobNumber}</td><td>{r.customerName}</td><td>{r.deviceType} {r.deviceModel}</td><td dir="ltr">{r.imei || "—"}</td><td>{r.reportedIssue}</td><td><span className="pill">{repairStatusLabel(r.status)}</span></td><td><select aria-label="تحديث حالة الصيانة" value={r.status} disabled={busy || r.status === "delivered" || r.status === "cancelled"} onChange={(e) => void changeRepairStatus(r, e.target.value as RepairStatus)}>{repairNextStatuses(r.status).map((status) => <option key={status} value={status}>{repairStatusLabel(status)}</option>)}</select></td></tr>)}</tbody>
          </table>{repairs.length === 0 && <div className="table-empty">لا توجد طلبات صيانة مسجلة.</div>}</div>
        </section>}

        {section === "accounting" && <section className="panel data-panel">
          <div className="panel-heading"><div><h3>ميزان المراجعة</h3><p>الأرصدة الناتجة عن القيود المرحلة فعلياً</p></div><BookOpen size={20}/></div>
          <div className="report-filters"><label className="field"><span>من تاريخ</span><input type="date" value={reportFrom} onChange={(e)=>setReportFrom(e.target.value)}/></label><label className="field"><span>إلى تاريخ</span><input type="date" value={reportTo} onChange={(e)=>setReportTo(e.target.value)}/></label><button className="primary-button" onClick={()=>void refreshAccounting()}>تحديث الميزان</button></div>
          <div className="table-wrap"><table><thead><tr><th>رمز الحساب</th><th>اسم الحساب</th><th>النوع</th><th>إجمالي المدين</th><th>إجمالي الدائن</th><th>صافي مدين</th></tr></thead><tbody>{trialBalance.map((row)=><tr key={row.code}><td dir="ltr">{row.code}</td><td><strong>{row.name}</strong></td><td>{row.accountType}</td><td>{formatMoney(row.debit)}</td><td>{formatMoney(row.credit)}</td><td>{formatMoney(row.netDebit)}</td></tr>)}</tbody><tfoot><tr><th colSpan={3}>الإجمالي</th><th>{formatMoney(trialBalance.reduce((sum,row)=>sum+row.debit,0))}</th><th>{formatMoney(trialBalance.reduce((sum,row)=>sum+row.credit,0))}</th><th>—</th></tr></tfoot></table>{trialBalance.length===0&&<div className="table-empty">لا توجد حسابات أو قيود محاسبية.</div>}</div>
          <div className="panel-heading purchase-history-heading"><div><h3>آخر القيود المرحلة</h3><p>قيود المبيعات والمشتريات والمصروفات</p></div></div>
          <div className="table-wrap"><table><thead><tr><th>رقم القيد</th><th>المصدر</th><th>البيان</th><th>مدين</th><th>دائن</th><th>التاريخ</th></tr></thead><tbody>{journalEntries.slice(0,20).map((entry)=><tr key={entry.id}><td dir="ltr">{entry.entryNumber}</td><td>{entry.sourceType ?? "يدوي"}</td><td>{entry.description}</td><td>{formatMoney(entry.totalDebit)}</td><td>{formatMoney(entry.totalCredit)}</td><td>{entry.postedAt ? new Date(entry.postedAt).toLocaleDateString("ar") : "—"}</td></tr>)}</tbody></table>{journalEntries.length===0&&<div className="table-empty">لم تُرحّل قيود بعد.</div>}</div>
          <p className="muted-help">القيود المرحلة متوازنة ومحمية من التعديل والحذف. لا يزال يلزم استكمال تسويات العملاء والموردين والمرتجعات والإقفال المحاسبي.</p>
        </section>}

        {section === "reports" && <section className="panel data-panel">
          <div className="panel-heading"><div><h3>ملخص الأداء المالي</h3><p>مؤشرات مشتقة من فواتير البيع وتكلفة الأصناف والمصروفات</p></div><BarChart3 size={20}/></div>
          <div className="report-filters"><label className="field"><span>من تاريخ</span><input type="date" value={reportFrom} onChange={(e)=>setReportFrom(e.target.value)}/></label><label className="field"><span>إلى تاريخ</span><input type="date" value={reportTo} onChange={(e)=>setReportTo(e.target.value)}/></label><button className="primary-button" onClick={()=>void refreshReport()}>تحديث التقرير</button></div>
          {financialSummary && <div className="stats-grid report-stats"><StatCard icon={Receipt} label="عدد الفواتير" value={financialSummary.invoiceCount.toLocaleString("ar")} detail="فواتير مرحّلة"/><StatCard icon={CreditCard} label="إجمالي المبيعات" value={formatMoney(financialSummary.grossSales)} detail="شاملاً الضريبة المسجلة"/><StatCard icon={Boxes} label="تكلفة البضاعة" value={formatMoney(financialSummary.costOfGoods)} detail="حسب تكلفة الأصناف وقت البيع"/><StatCard icon={BarChart3} label="مجمل الربح" value={formatMoney(financialSummary.grossProfit)} detail="المبيعات دون الضريبة ناقص التكلفة"/><StatCard icon={Receipt} label="المصروفات" value={formatMoney(financialSummary.expenses)} detail="المصروفات المسجلة خلال الفترة"/><StatCard icon={Wallet} label="صافي الربح التقديري" value={formatMoney(financialSummary.netProfit)} detail="قبل قيود محاسبية إضافية"/><StatCard icon={Package} label="قيمة المخزون" value={formatMoney(financialSummary.inventoryValue)} detail="كمية المنتجات × متوسط التكلفة"/></div>}
          <p className="muted-help">هذا تقرير تشغيلي أولي وليس قوائم مالية معتمدة أو إقراراً ضريبياً. لا يشمل بعد التسويات المحاسبية والمرتجعات والضرائب القابلة للاسترداد.</p>
        </section>}
        {section === "settings" && <section className="settings-page">
          <div className="panel placeholder-panel"><div className="empty-icon"><ClipboardList size={25}/></div><h3>إعدادات النظام</h3><p>إعدادات المتجر والضريبة والمستخدمين والنسخ الاحتياطي تحتاج إلى استكمال قبل الاستخدام التجاري.</p><span className="subtle-tag">قيد التطوير</span></div>
          <div className="panel settings-support">
            <div><span className="subtle-tag">التطوير والدعم الفني</span><h3>هل تحتاج إلى ميزة إضافية أو تخصيص للنظام؟</h3><p>تواصل مع العصيمي للبرمجيات والحلول التقنية المتطورة لمناقشة المتطلبات والاتفاق على التطوير.</p></div>
            <div className="panel-actions"><a className="primary-button" href="https://wa.me/message/NEVZVG5DC5CEA1" target="_blank" rel="noreferrer"><MessageCircle size={16}/> واتساب</a><a className="secondary-button" href="tel:+967776778675"><Phone size={16}/> 00967776778675</a><button className="secondary-button" onClick={()=>setSection("development")}>التفاصيل</button></div>
          </div>
        </section>}
        {section === "development" && <section className="development-page">
          <div className="development-hero">
            <div className="development-hero-icon"><Headphones size={30}/></div>
            <span className="development-kicker">التطوير والدعم الفني</span>
            <h2>نطوّر النظام ليناسب طريقة عملك</h2>
            <p>هل تحتاج إلى إضافة ميزة جديدة، أو تعديل سير العمل، أو تطوير تقرير خاص بمتجرك؟ تواصل معنا لمناقشة المتطلبات والاتفاق على نطاق العمل والتكلفة والمدة قبل البدء.</p>
            <div className="development-actions">
              <a className="primary-button development-whatsapp" href="https://wa.me/message/NEVZVG5DC5CEA1" target="_blank" rel="noreferrer"><MessageCircle size={18}/> مراسلة العصيمي عبر واتساب <ExternalLink size={15}/></a>
              <a className="secondary-button development-phone" href="tel:+967776778675"><Phone size={17}/> 00967776778675</a>
            </div>
          </div>
          <div className="development-details">
            <article className="panel">
              <div className="development-detail-icon"><MessageCircle size={20}/></div>
              <h3>طلب تطوير أو ميزة جديدة</h3>
              <p>أرسل وصفاً للميزة المطلوبة، وسنناقش إمكانية تنفيذها والتكلفة والجدول الزمني. لا تُعد أي ميزة إضافية ضمن النظام إلا بعد الاتفاق عليها.</p>
              <a href="https://wa.me/message/NEVZVG5DC5CEA1" target="_blank" rel="noreferrer">ابدأ المحادثة عبر واتساب <ExternalLink size={14}/></a>
            </article>
            <article className="panel">
              <div className="development-detail-icon"><Phone size={20}/></div>
              <h3>التواصل المباشر</h3>
              <p>للاستفسارات والتنسيق بشأن التطوير والدعم الفني.</p>
              <a href="tel:+967776778675" dir="ltr">00967776778675</a>
            </article>
          </div>
          <div className="panel about-developer">
            <div><span className="subtle-tag">جهة التطوير</span><h3>العصيمي للبرمجيات والحلول التقنية المتطورة</h3><p>خدمات تطوير البرمجيات، وتخصيص الأنظمة، وإضافة الميزات، والحلول التقنية وخدمات التطوير الرقمي.</p></div>
            <span className="about-mark">ع</span>
          </div>
          <p className="development-note">تخضع الميزات والتعديلات الإضافية لمتطلبات واتفاق مستقل. التواصل لا يعني تفعيل ميزة أو الالتزام بتنفيذها قبل الاتفاق.</p>
        </section>}
      </main>

      {showCreateProduct && <Modal title="إضافة منتج جديد" subtitle="أدخل بيانات الصنف الأساسية" onClose={() => setShowCreateProduct(false)} onSubmit={handleCreateProduct} busy={busy}>
        <div className="form-grid"><Field name="name" label="اسم المنتج" required /><Field name="sku" label="رمز SKU" required /><Field name="category" label="التصنيف" required /><Field name="brand" label="العلامة التجارية" /><Field name="costPrice" label="سعر التكلفة" type="number" min="0" step="0.01" required /><Field name="salePrice" label="سعر البيع" type="number" min="0" step="0.01" required /><Field name="quantity" label="الكمية الافتتاحية" type="number" min="0" required /><Field name="minQuantity" label="حد التنبيه" type="number" min="0" required /></div>
      </Modal>}
      {showCreateCustomer && <Modal title="إضافة عميل" subtitle="بيانات الاتصال الأساسية" onClose={() => setShowCreateCustomer(false)} onSubmit={handleCreateCustomer} busy={busy}>
        <div className="form-grid"><Field name="name" label="اسم العميل" required /><Field name="phone" label="رقم الهاتف" /><Field name="email" label="البريد الإلكتروني" type="email" /><Field name="address" label="العنوان" /><Field name="notes" label="ملاحظات" /></div>
      </Modal>}
      {customerPaymentTarget && <Modal title={`تحصيل من العميل: ${customerPaymentTarget.name}`} subtitle={`الرصيد المستحق: ${formatMoney(customerPaymentTarget.balance)}`} onClose={()=>setCustomerPaymentTarget(null)} onSubmit={handleCustomerReceipt} busy={busy}>
        <div className="form-grid"><Field name="amount" label="مبلغ التحصيل" type="number" min="0.01" step="0.01" required/><label className="field"><span>طريقة التحصيل</span><select name="method"><option value="cash">نقداً</option><option value="card">بطاقة</option><option value="transfer">تحويل</option><option value="mobile_wallet">محفظة إلكترونية</option><option value="other">أخرى</option></select></label><Field name="note" label="ملاحظات / مرجع"/></div><p className="muted-help">سيتم توزيع المبلغ آلياً على أقدم فواتير العميل المستحقة. لا يسمح النظام بتجاوز إجمالي الرصيد.</p>
      </Modal>}
      {supplierPaymentTarget && <Modal title={`سداد للمورد: ${supplierPaymentTarget.name}`} subtitle={`الرصيد المستحق للمورد: ${formatMoney(supplierPaymentTarget.balance)}`} onClose={()=>setSupplierPaymentTarget(null)} onSubmit={handleSupplierSettlement} busy={busy}>
        <div className="form-grid"><Field name="amount" label="مبلغ السداد" type="number" min="0.01" step="0.01" required/><label className="field"><span>طريقة السداد</span><select name="method"><option value="cash">نقداً</option><option value="card">بطاقة</option><option value="transfer">تحويل</option><option value="mobile_wallet">محفظة إلكترونية</option><option value="other">أخرى</option></select></label><Field name="note" label="ملاحظات / مرجع"/></div><p className="muted-help">سيتم توزيع المبلغ آلياً على أقدم فواتير المورد المستحقة. السداد النقدي يتطلب رصيداً كافياً في وردية مفتوحة.</p>
      </Modal>}
      {purchaseToReturn && <Modal title={`مرتجع فاتورة شراء ${purchaseToReturn.invoiceNumber}`} subtitle="اختر الصنف والكمية وأدخل مبلغ الاسترداد وسبب الإرجاع" onClose={()=>setPurchaseToReturn(null)} onSubmit={handlePurchaseReturn} busy={busy}>
        <div className="form-grid">
          <label className="field"><span>الصنف المرتجع</span><select name="purchaseItemId" required>{returnablePurchaseItems.map((item)=><option key={item.purchaseItemId} value={item.purchaseItemId}>{item.productName} — المتبقي من الفاتورة {item.remainingQuantity} — المتاح بالمخزون {item.availableStock}</option>)}</select></label>
          <label className="field"><span>الكمية</span><input name="quantity" type="number" min="1" max={Math.max(...returnablePurchaseItems.map((item)=>Math.min(item.remainingQuantity,item.availableStock)))} defaultValue="1" required/></label>
          <Field name="refundAmount" label="قيمة الاسترداد من المورد" type="number" min="0.01" step="0.01" required/>
          <label className="field"><span>طريقة التسوية</span><select name="refundMethod"><option value="supplier_credit">رصيد دائن لدى المورد (يخفض المستحق)</option><option value="cash">استرداد نقدي</option><option value="transfer">تحويل بنكي</option><option value="card">بطاقة</option><option value="mobile_wallet">محفظة إلكترونية</option><option value="other">أخرى</option></select></label>
          <Field name="reason" label="سبب الإرجاع" required/>
        </div>
        <p className="muted-help">لا يسمح النظام بإرجاع كمية سبق بيعها أو استهلاكها. تتم إعادة احتساب قيمة المخزون بسعر التكلفة المتوسط الحالي، وتسجيل حركة مخزون وقيد عكسي. الرصيد الدائن يقتصر على المبلغ غير المدفوع للمورد.</p>
      </Modal>}
      {saleToReturn && <Modal title={`مرتجع فاتورة ${saleToReturn.invoiceNumber}`} subtitle="اختر الصنف والكمية وأدخل مبلغ الاسترداد وسبب الإرجاع" onClose={() => setSaleToReturn(null)} onSubmit={handleSaleReturn} busy={busy}>
        <div className="form-grid">
          <label className="field"><span>الصنف المرتجع</span><select name="saleItemId" required>{returnableItems.map((item)=><option key={item.saleItemId} value={item.saleItemId}>{item.productName} — المتبقي {item.remainingQuantity}</option>)}</select></label>
          <label className="field"><span>الكمية</span><input name="quantity" type="number" min="1" max={Math.max(...returnableItems.map((item)=>item.remainingQuantity))} defaultValue="1" required/></label>
          <Field name="refundAmount" label="مبلغ الاسترداد" type="number" min="0.01" step="0.01" required/>
          <label className="field"><span>طريقة الاسترداد</span><select name="refundMethod"><option value="cash">نقداً</option><option value="card">بطاقة</option><option value="transfer">تحويل</option><option value="mobile_wallet">محفظة إلكترونية</option><option value="other">أخرى</option><option value="customer_credit">خصم من رصيد العميل المستحق</option></select></label>
          <Field name="reason" label="سبب الإرجاع" required/>
        </div>
        <p className="muted-help">سيتم التحقق من الكميات المستردة سابقاً وسقف الاسترداد بعد خصم الفاتورة وضريبتها، وتسجيل حركة مخزون وقيد محاسبي عكسي.</p>
      </Modal>}
      {stockProduct && <Modal title={`تعديل مخزون: ${stockProduct.name}`} subtitle={`الرصيد الحالي: ${stockProduct.quantity}`} onClose={() => setStockProduct(null)} onSubmit={handleAdjustStock} busy={busy}>
        <div className="form-grid"><Field name="quantityDelta" label="فرق الكمية (+ إضافة / - سحب)" type="number" step="1" required/><Field name="reason" label="سبب التعديل" required/></div>
      </Modal>}
      {unitProduct && <Modal title={`تسجيل جهاز: ${unitProduct.name}`} subtitle="اربط IMEI أو الرقم التسلسلي بوحدة فعلية موجودة في المخزون" onClose={() => setUnitProduct(null)} onSubmit={handleRegisterUnit} busy={busy}>
        <div className="form-grid"><Field name="imei" label="IMEI (15 رقماً)"/><Field name="serialNumber" label="الرقم التسلسلي"/><label className="field"><span>حالة الجهاز</span><select name="condition"><option value="new">جديد</option><option value="used">مستعمل</option><option value="refurbished">مجدد</option></select></label><Field name="warrantyUntil" label="انتهاء الضمان" type="date"/></div>
      </Modal>}
      {showCreateSupplier && <Modal title="إضافة مورد" subtitle="بيانات جهة التوريد" onClose={() => setShowCreateSupplier(false)} onSubmit={handleCreateSupplier} busy={busy}>
        <div className="form-grid"><Field name="name" label="اسم المورد" required/><Field name="phone" label="رقم الهاتف"/><Field name="email" label="البريد الإلكتروني" type="email"/><Field name="taxNumber" label="الرقم الضريبي"/><Field name="address" label="العنوان"/><Field name="notes" label="ملاحظات"/></div>
      </Modal>}
      {showCreateRepair && <Modal title="فتح طلب صيانة" subtitle="وثّق حالة الجهاز عند الاستلام" onClose={() => setShowCreateRepair(false)} onSubmit={handleCreateRepair} busy={busy}>
        <div className="form-grid"><Field name="jobNumber" label="رقم الطلب" required /><label className="field"><span>العميل</span><select name="customerId"><option value="">بدون عميل</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><Field name="deviceType" label="نوع الجهاز" required /><Field name="deviceModel" label="الموديل" /><Field name="imei" label="IMEI / Serial" /><Field name="estimatedCost" label="التكلفة التقديرية" type="number" min="0" step="0.01" /><Field name="reportedIssue" label="وصف العطل" required /><Field name="intakeCondition" label="حالة الجهاز عند الاستلام" /></div>
      </Modal>}
    </div>
  );
}

function repairStatusLabel(status: RepairStatus): string {
  const labels: Record<RepairStatus, string> = { received: "مستلم", diagnosing: "قيد التشخيص", waiting_parts: "بانتظار قطع", in_progress: "قيد الإصلاح", completed: "مكتمل", delivered: "تم التسليم", cancelled: "ملغي" };
  return labels[status];
}
function repairNextStatuses(status: RepairStatus): RepairStatus[] {
  const next: Record<RepairStatus, RepairStatus[]> = { received: ["received", "diagnosing", "cancelled"], diagnosing: ["diagnosing", "waiting_parts", "in_progress", "cancelled"], waiting_parts: ["waiting_parts", "in_progress", "cancelled"], in_progress: ["in_progress", "waiting_parts", "completed", "cancelled"], completed: ["completed", "delivered"], delivered: ["delivered"], cancelled: ["cancelled"] };
  return next[status];
}
function Modal({ title, subtitle, onClose, onSubmit, busy, children }: { title: string; subtitle: string; onClose: () => void; onSubmit: (form: HTMLFormElement) => Promise<void>; busy: boolean; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><form className="modal" onSubmit={(e) => { e.preventDefault(); void onSubmit(e.currentTarget); }}><div className="modal-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="إغلاق"><X size={19} /></button></div>{children}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>إلغاء</button><button className="primary-button" type="submit" disabled={busy}>{busy ? "جارٍ الحفظ..." : "حفظ"}</button></div></form></div>;
}
function StatCard({ icon: Icon, label, value, detail }: { icon: typeof Package; label: string; value: string; detail: string }) {
  return <article className="stat-card"><div className="stat-top"><span>{label}</span><div className="stat-icon"><Icon size={19} /></div></div><strong className="stat-value">{value}</strong><span className="stat-detail">{detail}</span></article>;
}
function ModuleRow({ icon: Icon, title, description, state }: { icon: typeof Package; title: string; description: string; state: string }) {
  return <div className="module-row"><div className="module-icon"><Icon size={19} /></div><div className="module-copy"><strong>{title}</strong><span>{description}</span></div><span className="module-state">{state}</span></div>;
}
function Field({ name, label, type = "text", required = false, min, step }: { name: string; label: string; type?: string; required?: boolean; min?: string; step?: string }) {
  return <label className="field"><span>{label}{required && " *"}</span><input name={name} type={type} required={required} min={min} step={step} /></label>;
}
