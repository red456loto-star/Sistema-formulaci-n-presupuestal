import type { FinancialSnapshot, HorizontalResult } from "./types";

function money(value: number | null, currency: string) {
  if (value === null) return "No disponible";
  return new Intl.NumberFormat("es-PE", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

function numberValue(value: number | null, suffix = "") {
  return value === null ? "No disponible" : `${new Intl.NumberFormat("es-PE", { maximumFractionDigits: 4 }).format(value)}${suffix}`;
}

export function StatementsView({ snapshot, currency }: { snapshot: FinancialSnapshot; currency: string }) {
  const income = snapshot.income_statement;
  const balance = snapshot.balance_sheet;
  const incomeRows: Array<[string, number | null]> = [
    ["Ventas", income.sales], ["Costos", income.cost_of_sales], ["Utilidad bruta", income.gross_profit],
    ["Gastos", income.operating_expenses], ["Utilidad operativa", income.operating_income],
    ["Resultado antes de impuestos", income.pre_tax_income], ["Impuesto", income.income_tax], ["Resultado neto", income.net_income],
  ];
  const balanceRows: Array<[string, number]> = [
    ["Activos corrientes", balance.current_assets], ["Activos no corrientes", balance.noncurrent_assets],
    ["Total activos", balance.total_assets], ["Pasivos corrientes", balance.current_liabilities],
    ["Pasivos no corrientes", balance.noncurrent_liabilities], ["Total pasivos", balance.total_liabilities],
    ["Patrimonio", balance.equity], ["Total pasivo y patrimonio", balance.total_liabilities_and_equity],
  ];
  return <div className="analysis-grid-2">
    <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Estado financiero</span><h2>Estado de resultados</h2><p>{snapshot.context.period_label}</p></div></div><table className="statement-table"><tbody>{incomeRows.map(([label, value]) => <tr key={label} className={label.startsWith("Utilidad") || label.startsWith("Resultado") ? "statement-total" : ""}><th>{label}</th><td>{money(value, currency)}</td></tr>)}</tbody></table></section>
    <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Estado financiero</span><h2>Estado de situación financiera</h2><p>{snapshot.context.period_label}</p></div><span className={`status-pill ${balance.balanced ? "status-pill--success" : "status-pill--danger"}`}>{balance.balanced ? "Balanceado" : "Descuadrado"}</span></div><table className="statement-table"><tbody>{balanceRows.map(([label, value]) => <tr key={label} className={label.startsWith("Total") ? "statement-total" : ""}><th>{label}</th><td>{money(value, currency)}</td></tr>)}<tr><th>Diferencia</th><td>{money(balance.balance_difference, currency)}</td></tr></tbody></table></section>
  </div>;
}

export function VerticalView({ snapshot, currency }: { snapshot: FinancialSnapshot; currency: string }) {
  return <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Análisis vertical</span><h2>Participación sobre la base de 100 %</h2><p>Resultados sobre ventas; situación financiera sobre total activos o total pasivo y patrimonio.</p></div></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Estado</th><th>Partida</th><th>Valor</th><th>Base</th><th>Valor base</th><th>Participación</th></tr></thead><tbody>{snapshot.vertical_analysis.map((row) => <tr key={`${row.statement}-${row.key}`}><td>{row.statement}</td><td>{row.label}</td><td>{money(row.value, currency)}</td><td>{row.base_label}</td><td>{money(row.base_value, currency)}</td><td>{numberValue(row.percentage, " %")}</td></tr>)}</tbody></table></div></section>;
}

export function RatiosView({ snapshot }: { snapshot: FinancialSnapshot }) {
  return <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Ratios financieros</span><h2>Liquidez, gestión, solvencia y rentabilidad</h2><p>Los resultados no disponibles no se sustituyen por valores inventados.</p></div></div><div className="ratio-grid">{snapshot.ratios.map((ratio) => <article className="ratio-card" key={ratio.name}><header><span>{ratio.category}</span><strong>{ratio.name}</strong></header><div className="ratio-card__value">{numberValue(ratio.result, ` ${ratio.unit}`)}</div><dl><div><dt>Fórmula</dt><dd>{ratio.formula}</dd></div><div><dt>Variables</dt><dd>{Object.entries(ratio.variables).map(([key, value]) => `${key}: ${value ?? "No disponible"}`).join(" · ")}</dd></div><div><dt>Interpretación</dt><dd>{ratio.interpretation}</dd></div><div><dt>Fuente</dt><dd>{ratio.sources.join(" | ") || "Sin fuente disponible"}</dd></div></dl></article>)}</div></section>;
}

export function DupontEvaView({ snapshot, currency }: { snapshot: FinancialSnapshot; currency: string }) {
  return <div className="analysis-grid-2">
    <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Análisis Dupont</span><h2>Descomposición de la rentabilidad</h2></div></div><div className="formula-flow"><Metric label="Margen neto" value={numberValue(snapshot.dupont.net_margin, " %")} /><b>×</b><Metric label="Rotación de activos" value={numberValue(snapshot.dupont.asset_turnover)} /><b>×</b><Metric label="Multiplicador financiero" value={numberValue(snapshot.dupont.financial_multiplier)} /><b>=</b><Metric label="ROE" value={numberValue(snapshot.dupont.roe, " %")} /></div><p className="formula-text">{snapshot.dupont.formula}</p><p>{snapshot.dupont.interpretation}</p></section>
    <section className="panel"><div className="panel__heading"><div><span className="eyebrow">EVA</span><h2>Valor económico agregado</h2></div></div><table className="statement-table"><tbody><tr><th>NOPAT</th><td>{money(snapshot.eva.nopat, currency)}</td></tr><tr><th>Capital invertido</th><td>{money(snapshot.eva.invested_capital, currency)}</td></tr><tr><th>Costo de capital</th><td>{numberValue(snapshot.eva.cost_of_capital_rate, " %")}</td></tr><tr><th>Cargo de capital</th><td>{money(snapshot.eva.capital_charge, currency)}</td></tr><tr className="statement-total"><th>EVA</th><td>{money(snapshot.eva.eva, currency)}</td></tr></tbody></table><p className="formula-text">{snapshot.eva.formula}</p><p>{snapshot.eva.interpretation}</p></section>
  </div>;
}

export function HorizontalView({ result, currency }: { result: HorizontalResult | null; currency: string }) {
  if (!result) return <section className="panel"><p className="muted">Seleccione los escenarios inicial y final, luego ejecute la comparación.</p></section>;
  return <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Análisis horizontal</span><h2>{result.initial.version_code} → {result.final.version_code}</h2><p>{result.initial.period_label} frente a {result.final.period_label}</p></div></div>{result.warnings.length > 0 && <div className="analysis-warning-list">{result.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}<div className="table-wrap"><table className="data-table"><thead><tr><th>Estado</th><th>Partida</th><th>Inicial</th><th>Final</th><th>Diferencia monetaria</th><th>Variación %</th></tr></thead><tbody>{result.rows.map((row) => <tr key={`${row.statement}-${row.key}`}><td>{row.statement}</td><td>{row.label}</td><td>{money(row.initial_value, currency)}</td><td>{money(row.final_value, currency)}</td><td>{money(row.monetary_difference, currency)}</td><td>{numberValue(row.percentage_variation, " %")}</td></tr>)}</tbody></table></div></section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="formula-metric"><span>{label}</span><strong>{value}</strong></div>;
}
