import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { Tabs, Message } from "../../components/phase2/Ui";
import { apiRequest, API_BASE_URL } from "../../lib/api";
import { useWorkspace } from "../../context/WorkspaceContext";
import { FinancialSettingsPanel } from "./FinancialSettingsPanel";
import { ItemCatalog } from "./ItemCatalog";
import { MasterCrudSection, type MasterField } from "./MasterCrudSection";
import { BalanceSheetView, IncomeStatementView } from "./MasterReports";
import type {
  BalanceSheet,
  CostRow,
  ExpenseRow,
  FinancialSettings,
  IncomeStatement,
  InventoryRow,
  InvestmentRow,
  MasterItem,
  MasterSummary,
  OrganizationHierarchy,
  ProductionRow,
  PurchaseRow,
  SaleRow,
} from "./types";
import "../../phase6-master-budget.css";

const tabs = ["Resumen", "Ventas", "Inventarios", "Compras", "Producción", "Costos", "Gastos", "Inversiones", "Resultados", "Situación financiera"] as const;
type TabName = typeof tabs[number];

interface UnitRow { id: number; code: string; name: string; active: number; }

const emptySettings: FinancialSettings = {
  tax_rate: 29.5,
  collection_rate: 100,
  payment_rate: 100,
  opening_cash: 0,
  opening_receivables: 0,
  opening_ppe: 0,
  opening_payables: 0,
  opening_debt: 0,
  notes: null,
};

const emptySummary: MasterSummary = {
  sales_total: 0,
  inventory_final_value: 0,
  purchases_total: 0,
  production_units: 0,
  production_cost: 0,
  expenses_total: 0,
  investments_total: 0,
  net_income: 0,
  balance_ok: true,
  counts: {},
};

const emptyIncome: IncomeStatement = {
  settings: emptySettings,
  monthly: [],
  annual: {
    sales: 0, materials: 0, direct_labor: 0, manufacturing_overhead: 0,
    production_cost: 0, gross_profit: 0, operating_expenses: 0,
    depreciation: 0, operating_income: 0, income_tax: 0, net_income: 0,
  },
};

const emptyBalance: BalanceSheet = {
  settings: emptySettings,
  opening: { inventory: 0, assets: 0, liabilities: 0, equity: 0 },
  monthly: [],
  annual: null,
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

function quantity(value: number) {
  return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 4 }).format(value);
}

export function MasterBudgetPage({ initialTab = "Resumen" }: { initialTab?: TabName }) {
  const { companyId, exerciseId, exercise, versionId, version, periods } = useWorkspace();
  const [activeTab, setActiveTab] = useState<TabName>(initialTab);
  const [hierarchy, setHierarchy] = useState<OrganizationHierarchy | null>(null);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [items, setItems] = useState<MasterItem[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [inventories, setInventories] = useState<InventoryRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [production, setProduction] = useState<ProductionRow[]>([]);
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [investments, setInvestments] = useState<InvestmentRow[]>([]);
  const [settings, setSettings] = useState<FinancialSettings>(emptySettings);
  const [summary, setSummary] = useState<MasterSummary>(emptySummary);
  const [income, setIncome] = useState<IncomeStatement>(emptyIncome);
  const [balance, setBalance] = useState<BalanceSheet>(emptyBalance);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setActiveTab(initialTab), [initialTab]);

  const contextReady = Boolean(companyId && exerciseId && versionId && version?.version_type === "ORIGINAL");
  const locked = version?.status !== "BORRADOR";
  const currency = exercise?.currency_code ?? "PEN";
  const query = contextReady ? `company_id=${companyId}&exercise_id=${exerciseId}&version_id=${versionId}` : "";

  const clear = () => {
    setHierarchy(null); setUnits([]); setItems([]); setSales([]); setInventories([]);
    setPurchases([]); setProduction([]); setCosts([]); setExpenses([]); setInvestments([]);
    setSettings(emptySettings); setSummary(emptySummary); setIncome(emptyIncome); setBalance(emptyBalance);
  };

  const loadData = async () => {
    if (!companyId || !exerciseId || !versionId || version?.version_type !== "ORIGINAL") {
      clear(); return;
    }
    setBusy(true); setError("");
    try {
      const [organization, unitRows, itemRows, saleRows, inventoryRows, purchaseRows, productionRows, costRows, expenseRows, investmentRows, settingRow, summaryRow, incomeRow, balanceRow] = await Promise.all([
        apiRequest<OrganizationHierarchy>(`/api/organization/hierarchy?company_id=${companyId}`),
        apiRequest<UnitRow[]>("/api/catalog/unidades"),
        apiRequest<MasterItem[]>(`/api/master-budget/items?company_id=${companyId}`),
        apiRequest<SaleRow[]>(`/api/master-budget/sales?${query}`),
        apiRequest<InventoryRow[]>(`/api/master-budget/inventories?${query}`),
        apiRequest<PurchaseRow[]>(`/api/master-budget/purchases?${query}`),
        apiRequest<ProductionRow[]>(`/api/master-budget/production?${query}`),
        apiRequest<CostRow[]>(`/api/master-budget/costs?${query}`),
        apiRequest<ExpenseRow[]>(`/api/master-budget/expenses?${query}`),
        apiRequest<InvestmentRow[]>(`/api/master-budget/investments?${query}`),
        apiRequest<FinancialSettings>(`/api/master-budget/settings?${query}`),
        apiRequest<MasterSummary>(`/api/master-budget/summary?${query}`),
        apiRequest<IncomeStatement>(`/api/master-budget/income-statement?${query}`),
        apiRequest<BalanceSheet>(`/api/master-budget/balance-sheet?${query}`),
      ]);
      setHierarchy(organization);
      setUnits(unitRows.filter((item) => item.active));
      setItems(itemRows);
      setSales(saleRows); setInventories(inventoryRows); setPurchases(purchaseRows);
      setProduction(productionRows); setCosts(costRows); setExpenses(expenseRows);
      setInvestments(investmentRows); setSettings(settingRow); setSummary(summaryRow);
      setIncome(incomeRow); setBalance(balanceRow);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible cargar el presupuesto maestro.");
    } finally { setBusy(false); }
  };

  useEffect(() => { void loadData(); }, [companyId, exerciseId, versionId, version?.status, version?.version_type]);

  const centers = useMemo(() => hierarchy?.organizational.flatMap((site) => site.centers) ?? [], [hierarchy]);
  const accounts = useMemo(() => {
    const all = hierarchy?.budget.flatMap((group) => group.elements.flatMap((element) => element.accounts)) ?? [];
    return [...new Map(all.map((account) => [account.id, account])).values()];
  }, [hierarchy]);
  const periodOptions = periods.map((period) => ({ id: period.id, label: `${String(period.period_number).padStart(2, "0")} · ${period.name}${period.status === "CERRADO" ? " (cerrado)" : ""}` }));
  const centerOptions = centers.map((center) => ({ id: center.id, label: `${center.code} · ${center.name}` }));
  const productiveCenterOptions = centers.filter((center) => center.center_type === "PRODUCTIVO").map((center) => ({ id: center.id, label: `${center.code} · ${center.name}` }));
  const accountOptions = accounts.map((account) => ({ id: account.id, label: `${account.code} · ${account.name}` }));
  const productOptions = items.filter((item) => item.item_type === "PRODUCTO" && item.active).map((item) => ({ id: item.id, label: `${item.code} · ${item.name}` }));
  const materialOptions = items.filter((item) => item.item_type === "MATERIAL" && item.active).map((item) => ({ id: item.id, label: `${item.code} · ${item.name}` }));
  const allItemOptions = items.filter((item) => item.active).map((item) => ({ id: item.id, label: `${item.code} · ${item.name}` }));
  const unitOptions = units.map((unit) => ({ id: unit.id, label: `${unit.code} · ${unit.name}` }));
  const contextPayload = { company_id: companyId ?? 0, exercise_id: exerciseId ?? 0, version_id: versionId ?? 0 };
  const baseInitial = { period_id: String(periods.find((period) => period.status === "ABIERTO")?.id ?? periods[0]?.id ?? ""), center_id: String(centers[0]?.id ?? ""), account_id: String(accounts[0]?.id ?? "") };

  const baseFields = (centerChoices = centerOptions): MasterField[] => [
    { key: "period_id", label: "Periodo", type: "select", number: true, required: true, options: periodOptions },
    { key: "center_id", label: "Centro", type: "select", number: true, required: true, options: centerChoices },
    { key: "account_id", label: "Cuenta", type: "select", number: true, required: true, options: accountOptions },
  ];

  const exportComponent = async (component: string) => {
    if (!contextReady) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/master-budget/export/${component}?${query}`);
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message ?? "No fue posible exportar el archivo Excel.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `presupuesto-maestro-${component}-v${versionId}.xlsx`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible exportar el archivo Excel.");
    } finally { setBusy(false); }
  };

  const exportForTab: Record<TabName, string> = {
    Resumen: "all", Ventas: "sales", Inventarios: "inventories", Compras: "purchases",
    Producción: "production", Costos: "costs", Gastos: "expenses", Inversiones: "investments",
    Resultados: "income-statement", "Situación financiera": "balance-sheet",
  };

  return <div className="page-stack">
    <section className="page-heading master-heading">
      <div><span className="eyebrow">Fase 6 · Presupuesto maestro</span><h1>Presupuesto operativo y financiero integrado</h1><p>Ventas, inventarios, compras, producción, costos, gastos e inversiones alimentan automáticamente los estados financieros presupuestados.</p></div>
      <div className="button-row"><button className="button button--ghost" disabled={busy || !contextReady} onClick={() => void loadData()}><RefreshCw size={16} />Actualizar</button><button className="button button--primary" disabled={busy || !contextReady} onClick={() => void exportComponent(exportForTab[activeTab])}><Download size={16} />Exportar {activeTab === "Resumen" ? "todo" : "componente"}</button></div>
    </section>

    {error && <Message type="danger">{error}</Message>}
    {!companyId || !exerciseId || !versionId ? <Message>Seleccione empresa, ejercicio y versión en la barra superior.</Message> : null}
    {version && version.version_type !== "ORIGINAL" ? <Message type="danger">Seleccione una versión ORIGINAL anual. El forecast corresponde a una fase posterior.</Message> : null}
    {contextReady && <>
      <div className="master-context-note"><strong>{version?.code}</strong><span>{locked ? `Versión ${version?.status?.toLowerCase()} · solo consulta` : "Versión en borrador · editable"}</span></div>
      <Tabs items={[...tabs]} active={activeTab} onChange={(value) => setActiveTab(value as TabName)} />

      {activeTab === "Resumen" && <>
        <section className="metric-grid master-summary-grid">
          <Metric label="Ventas" value={money(summary.sales_total, currency)} />
          <Metric label="Inventario final" value={money(summary.inventory_final_value, currency)} />
          <Metric label="Compras" value={money(summary.purchases_total, currency)} />
          <Metric label="Producción requerida" value={quantity(summary.production_units)} />
          <Metric label="Costos productivos" value={money(summary.production_cost, currency)} />
          <Metric label="Gastos" value={money(summary.expenses_total, currency)} />
          <Metric label="Inversiones" value={money(summary.investments_total, currency)} />
          <Metric label="Resultado neto" value={money(summary.net_income, currency)} />
          <Metric label="Situación financiera" value={summary.balance_ok ? "Balanceada" : "Por revisar"} />
        </section>
        <section className="panel master-flow-panel"><div className="panel__heading"><div><span className="eyebrow">Trazabilidad de cálculo</span><h2>Flujo del presupuesto maestro</h2></div></div><div className="master-flow"><span>Ventas</span><b>→</b><span>Producción</span><b>→</b><span>Compras e inventarios</span><b>→</b><span>Costos y gastos</span><b>→</b><span>Resultados</span><b>→</b><span>Situación financiera</span></div></section>
        <ItemCatalog companyId={companyId as number} items={items} units={unitOptions} locked={locked} onChanged={loadData} />
        <FinancialSettingsPanel context={contextPayload} settings={settings} locked={locked} onChanged={loadData} />
      </>}

      {activeTab === "Ventas" && <MasterCrudSection<SaleRow>
        title="Presupuesto de ventas" description="Venta presupuestada = cantidad × precio unitario."
        endpoint="/api/master-budget/sales" rows={sales} locked={locked} busy={busy} onChanged={loadData} contextPayload={contextPayload}
        initial={{ ...baseInitial, item_id: String(productOptions[0]?.id ?? ""), quantity: "0", unit_price: "0", comment: "" }}
        fields={[...baseFields(), { key: "item_id", label: "Producto", type: "select", number: true, required: true, options: productOptions }, { key: "quantity", label: "Cantidad", type: "number", number: true, required: true, step: "0.0001" }, { key: "unit_price", label: "Precio unitario", type: "number", number: true, required: true, step: "0.01" }, { key: "comment", label: "Comentario", type: "textarea", nullable: true, span: 2 }]}
        columns={[{ label: "Periodo", render: (row) => row.period_name }, { label: "Centro / cuenta", render: (row) => <>{row.center_code}<br /><span className="muted">{row.account_code}</span></> }, { label: "Producto", render: (row) => `${row.item_code} · ${row.item_name}` }, { label: "Cantidad", render: (row) => quantity(row.quantity) }, { label: "Precio", render: (row) => money(row.unit_price, currency) }, { label: "Venta", render: (row) => money(row.sale_amount, currency) }]}
      />}

      {activeTab === "Inventarios" && <MasterCrudSection<InventoryRow>
        title="Presupuesto de inventarios" description="Inventario final calculado = inicial + entradas − salidas; se conserva además el inventario final deseado."
        endpoint="/api/master-budget/inventories" rows={inventories} locked={locked} busy={busy} onChanged={loadData} contextPayload={contextPayload}
        initial={{ ...baseInitial, item_id: String(allItemOptions[0]?.id ?? ""), initial_quantity: "0", entries_quantity: "0", exits_quantity: "0", desired_final_quantity: "0", unit_cost: "0", comment: "" }}
        fields={[...baseFields(), { key: "item_id", label: "Producto o material", type: "select", number: true, required: true, options: allItemOptions }, { key: "initial_quantity", label: "Inventario inicial", type: "number", number: true, required: true, step: "0.0001" }, { key: "entries_quantity", label: "Entradas", type: "number", number: true, required: true, step: "0.0001" }, { key: "exits_quantity", label: "Salidas", type: "number", number: true, required: true, step: "0.0001" }, { key: "desired_final_quantity", label: "Inventario final deseado", type: "number", number: true, required: true, step: "0.0001" }, { key: "unit_cost", label: "Costo unitario", type: "number", number: true, required: true, step: "0.01" }, { key: "comment", label: "Comentario", type: "textarea", nullable: true, span: 2 }]}
        columns={[{ label: "Periodo", render: (row) => row.period_name }, { label: "Ítem", render: (row) => `${row.item_code} · ${row.item_name}` }, { label: "Inicial", render: (row) => quantity(row.initial_quantity) }, { label: "Entradas / salidas", render: (row) => `${quantity(row.entries_quantity)} / ${quantity(row.exits_quantity)}` }, { label: "Final calculado", render: (row) => quantity(row.final_quantity) }, { label: "Final deseado", render: (row) => quantity(row.desired_final_quantity) }, { label: "Valor final", render: (row) => money(row.inventory_value, currency) }, { label: "Centro / cuenta", render: (row) => `${row.center_code} · ${row.account_code}` }]}
      />}

      {activeTab === "Compras" && <MasterCrudSection<PurchaseRow>
        title="Presupuesto de compras" description="Compras = necesidades + inventario final deseado − inventario inicial."
        endpoint="/api/master-budget/purchases" rows={purchases} locked={locked} busy={busy} onChanged={loadData} contextPayload={contextPayload}
        initial={{ ...baseInitial, item_id: String(materialOptions[0]?.id ?? ""), needs_quantity: "0", initial_inventory_quantity: "0", desired_final_quantity: "0", unit_price: "0", comment: "" }}
        fields={[...baseFields(), { key: "item_id", label: "Material", type: "select", number: true, required: true, options: materialOptions }, { key: "needs_quantity", label: "Necesidades", type: "number", number: true, required: true, step: "0.0001" }, { key: "initial_inventory_quantity", label: "Inventario inicial", type: "number", number: true, required: true, step: "0.0001" }, { key: "desired_final_quantity", label: "Inventario final deseado", type: "number", number: true, required: true, step: "0.0001" }, { key: "unit_price", label: "Precio de compra", type: "number", number: true, required: true, step: "0.01" }, { key: "comment", label: "Comentario", type: "textarea", nullable: true, span: 2 }]}
        columns={[{ label: "Periodo", render: (row) => row.period_name }, { label: "Material", render: (row) => `${row.item_code} · ${row.item_name}` }, { label: "Necesidades", render: (row) => quantity(row.needs_quantity) }, { label: "Cantidad compra", render: (row) => quantity(row.purchase_quantity) }, { label: "Precio", render: (row) => money(row.unit_price, currency) }, { label: "Total", render: (row) => money(row.purchase_total, currency) }, { label: "Centro / cuenta", render: (row) => `${row.center_code} · ${row.account_code}` }]}
      />}

      {activeTab === "Producción" && <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Componente calculado</span><h2>Presupuesto de producción</h2><p>Ventas previstas + inventario final deseado − inventario inicial = producción requerida.</p></div></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Periodo</th><th>Producto</th><th>Centro / cuenta</th><th>Ventas</th><th>Inv. final deseado</th><th>Inv. inicial</th><th>Producción requerida</th><th>Observación</th></tr></thead><tbody>{production.length ? production.map((row) => <tr key={`${row.period_id}-${row.item_id}-${row.center_id}-${row.account_id}`}><td>{row.period_name}</td><td>{row.item_code} · {row.item_name}</td><td>{row.center_code} · {row.account_code}</td><td>{quantity(row.sales_quantity)}</td><td>{quantity(row.desired_final_inventory)}</td><td>{quantity(row.initial_inventory)}</td><td>{quantity(row.production_required)}</td><td>{row.warning ?? "Fórmula consistente"}</td></tr>) : <tr><td colSpan={8} className="table-empty">Registre ventas e inventarios de productos para calcular la producción.</td></tr>}</tbody></table></div></section>}

      {activeTab === "Costos" && <MasterCrudSection<CostRow>
        title="Costos por centro productivo" description="Clasificación de materiales, mano de obra y costos indirectos, además de fijo/variable y directo/indirecto."
        endpoint="/api/master-budget/costs" rows={costs} locked={locked} busy={busy} onChanged={loadData} contextPayload={contextPayload}
        initial={{ ...baseInitial, center_id: String(productiveCenterOptions[0]?.id ?? ""), item_id: "", cost_category: "MATERIALES", behavior: "VARIABLE", traceability: "DIRECTO", quantity: "1", unit_cost: "0", comment: "" }}
        fields={[...baseFields(productiveCenterOptions), { key: "item_id", label: "Producto o material (opcional)", type: "select", number: true, nullable: true, options: allItemOptions }, { key: "cost_category", label: "Categoría", type: "select", required: true, options: [{ id: "MATERIALES", label: "Materiales" }, { id: "MANO_OBRA", label: "Mano de obra" }, { id: "CIF", label: "Costos indirectos de fabricación" }] }, { key: "behavior", label: "Comportamiento", type: "select", required: true, options: [{ id: "FIJO", label: "Fijo" }, { id: "VARIABLE", label: "Variable" }] }, { key: "traceability", label: "Trazabilidad", type: "select", required: true, options: [{ id: "DIRECTO", label: "Directo" }, { id: "INDIRECTO", label: "Indirecto" }] }, { key: "quantity", label: "Cantidad", type: "number", number: true, required: true, step: "0.0001" }, { key: "unit_cost", label: "Costo unitario", type: "number", number: true, required: true, step: "0.01" }, { key: "comment", label: "Comentario", type: "textarea", nullable: true, span: 2 }]}
        columns={[{ label: "Periodo", render: (row) => row.period_name }, { label: "Centro / cuenta", render: (row) => `${row.center_code} · ${row.account_code}` }, { label: "Categoría", render: (row) => row.cost_category }, { label: "Clasificación", render: (row) => `${row.behavior} · ${row.traceability}` }, { label: "Cantidad", render: (row) => quantity(row.quantity) }, { label: "Costo unitario", render: (row) => money(row.unit_cost, currency) }, { label: "Costo total", render: (row) => money(row.cost_amount, currency) }]}
      />}

      {activeTab === "Gastos" && <MasterCrudSection<ExpenseRow>
        title="Gastos por centro" description="Consolidación trazable por centro, grupo, elemento, cuenta, periodo y versión."
        endpoint="/api/master-budget/expenses" rows={expenses} locked={locked} busy={busy} onChanged={loadData} contextPayload={contextPayload}
        initial={{ ...baseInitial, behavior: "FIJO", traceability: "INDIRECTO", amount: "0", comment: "" }}
        fields={[...baseFields(), { key: "behavior", label: "Comportamiento", type: "select", required: true, options: [{ id: "FIJO", label: "Fijo" }, { id: "VARIABLE", label: "Variable" }] }, { key: "traceability", label: "Trazabilidad", type: "select", required: true, options: [{ id: "DIRECTO", label: "Directo" }, { id: "INDIRECTO", label: "Indirecto" }] }, { key: "amount", label: "Importe", type: "number", number: true, required: true, step: "0.01" }, { key: "comment", label: "Comentario", type: "textarea", nullable: true, span: 2 }]}
        columns={[{ label: "Periodo", render: (row) => row.period_name }, { label: "Centro", render: (row) => `${row.center_code} · ${row.center_name}` }, { label: "Grupo / elemento", render: (row) => `${row.group_code} / ${row.element_code}` }, { label: "Cuenta", render: (row) => `${row.account_code} · ${row.account_name}` }, { label: "Clasificación", render: (row) => `${row.behavior} · ${row.traceability}` }, { label: "Importe", render: (row) => money(row.amount, currency) }]}
      />}

      {activeTab === "Inversiones" && <MasterCrudSection<InvestmentRow>
        title="Presupuesto de inversión" description="Importe, vida útil, depreciación presupuestada y fuente de financiamiento."
        endpoint="/api/master-budget/investments" rows={investments} locked={locked} busy={busy} onChanged={loadData} contextPayload={contextPayload}
        initial={{ ...baseInitial, description: "", amount: "0", useful_life_months: "", financing_source: "CAJA", comment: "" }}
        fields={[...baseFields(), { key: "description", label: "Descripción", required: true, span: 2 }, { key: "amount", label: "Importe", type: "number", number: true, required: true, step: "0.01" }, { key: "useful_life_months", label: "Vida útil (meses)", type: "number", number: true, nullable: true, step: "1" }, { key: "financing_source", label: "Fuente de financiamiento", type: "select", required: true, options: [{ id: "CAJA", label: "Caja" }, { id: "DEUDA", label: "Deuda" }, { id: "CAPITAL", label: "Capital" }] }, { key: "comment", label: "Comentario", type: "textarea", nullable: true, span: 2 }]}
        columns={[{ label: "Periodo", render: (row) => row.period_name }, { label: "Descripción", render: (row) => row.description }, { label: "Centro / cuenta", render: (row) => `${row.center_code} · ${row.account_code}` }, { label: "Importe", render: (row) => money(row.amount, currency) }, { label: "Vida útil", render: (row) => row.useful_life_months ? `${row.useful_life_months} meses` : "No aplica" }, { label: "Depreciación anual", render: (row) => money(row.depreciation_budgeted, currency) }, { label: "Financiamiento", render: (row) => row.financing_source }]}
      />}

      {activeTab === "Resultados" && <><FinancialSettingsPanel context={contextPayload} settings={settings} locked={locked} onChanged={loadData} /><IncomeStatementView report={income} currency={currency} /></>}
      {activeTab === "Situación financiera" && <><FinancialSettingsPanel context={contextPayload} settings={settings} locked={locked} onChanged={loadData} /><BalanceSheetView report={balance} currency={currency} /></>}
    </>}
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="metric-card"><div><span>{label}</span><strong>{value}</strong></div></article>;
}
