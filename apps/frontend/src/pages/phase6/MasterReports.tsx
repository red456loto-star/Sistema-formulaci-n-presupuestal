import type { BalanceSheet, IncomeStatement } from "./types";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

export function IncomeStatementView({ report, currency }: { report: IncomeStatement; currency: string }) {
  return <section className="panel">
    <div className="panel__heading">
      <div><span className="eyebrow">Estado financiero derivado</span><h2>Estado de resultados presupuestado</h2><p>Se calcula desde ventas, costos, gastos e inversiones del contexto activo.</p></div>
    </div>
    <div className="table-wrap"><table className="data-table master-financial-table">
      <thead><tr><th>Periodo</th><th>Ventas</th><th>Materiales</th><th>Mano de obra</th><th>CIF</th><th>Costo producción</th><th>Utilidad bruta</th><th>Gastos</th><th>Depreciación</th><th>Resultado operativo</th><th>Impuesto</th><th>Resultado neto</th></tr></thead>
      <tbody>
        {report.monthly.map((row) => <tr key={row.period_id}>
          <td>{String(row.period_number).padStart(2, "0")} · {row.period_name}</td>
          <td>{money(row.sales, currency)}</td><td>{money(row.materials, currency)}</td><td>{money(row.direct_labor, currency)}</td><td>{money(row.manufacturing_overhead, currency)}</td>
          <td>{money(row.production_cost, currency)}</td><td>{money(row.gross_profit, currency)}</td><td>{money(row.operating_expenses, currency)}</td><td>{money(row.depreciation, currency)}</td>
          <td>{money(row.operating_income, currency)}</td><td>{money(row.income_tax, currency)}</td><td>{money(row.net_income, currency)}</td>
        </tr>)}
        <tr className="master-total-row"><td>Total anual</td><td>{money(report.annual.sales, currency)}</td><td>{money(report.annual.materials, currency)}</td><td>{money(report.annual.direct_labor, currency)}</td><td>{money(report.annual.manufacturing_overhead, currency)}</td><td>{money(report.annual.production_cost, currency)}</td><td>{money(report.annual.gross_profit, currency)}</td><td>{money(report.annual.operating_expenses, currency)}</td><td>{money(report.annual.depreciation, currency)}</td><td>{money(report.annual.operating_income, currency)}</td><td>{money(report.annual.income_tax, currency)}</td><td>{money(report.annual.net_income, currency)}</td></tr>
      </tbody>
    </table></div>
  </section>;
}

export function BalanceSheetView({ report, currency }: { report: BalanceSheet; currency: string }) {
  return <section className="panel">
    <div className="panel__heading">
      <div><span className="eyebrow">Estado financiero derivado</span><h2>Estado de situación financiera presupuestado</h2><p>El efectivo o el financiamiento de corto plazo actúan como partidas de equilibrio derivadas.</p></div>
      <span className={`status-pill ${report.annual?.balanced ? "status-pill--success" : "status-pill--warning"}`}>{report.annual?.balanced ? "Balanceado" : "Por revisar"}</span>
    </div>
    <div className="table-wrap"><table className="data-table master-financial-table">
      <thead><tr><th>Periodo</th><th>Efectivo</th><th>CxC</th><th>Inventarios</th><th>PP&E neto</th><th>Total activos</th><th>CxP</th><th>Financ. corto</th><th>Deuda largo</th><th>Total pasivos</th><th>Patrimonio</th><th>Pasivo + patrimonio</th><th>Diferencia</th></tr></thead>
      <tbody>{report.monthly.map((row) => <tr key={row.period_id}>
        <td>{String(row.period_number).padStart(2, "0")} · {row.period_name}</td>
        <td>{money(row.cash, currency)}</td><td>{money(row.receivables, currency)}</td><td>{money(row.inventory, currency)}</td><td>{money(row.net_property_plant_equipment, currency)}</td><td>{money(row.total_assets, currency)}</td>
        <td>{money(row.accounts_payable, currency)}</td><td>{money(row.short_term_financing, currency)}</td><td>{money(row.long_term_debt, currency)}</td><td>{money(row.total_liabilities, currency)}</td><td>{money(row.equity, currency)}</td><td>{money(row.total_liabilities_and_equity, currency)}</td><td>{money(row.balance_difference, currency)}</td>
      </tr>)}</tbody>
    </table></div>
  </section>;
}
