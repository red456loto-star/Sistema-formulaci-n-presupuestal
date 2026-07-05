import { DatabaseManager } from "../../../../packages/database/src/index";
import { getPeriods, type MasterContext, roundAmount } from "./common";

type Row = Record<string, unknown>;

function contextParams(context: MasterContext) {
  return [context.companyId, context.exerciseId, context.versionId] as const;
}

function baseDimensionSelect(alias: string) {
  return `${alias}.*,
    p.period_number,p.name period_name,p.status period_status,
    c.code center_code,c.name center_name,c.center_type,
    a.code account_code,a.name account_name,
    e.id element_id,e.code element_code,e.name element_name,
    g.id group_id,g.code group_code,g.name group_name`;
}

function baseDimensionJoins(alias: string) {
  return `JOIN budget_periods p ON p.id=${alias}.period_id
    JOIN activity_centers c ON c.id=${alias}.center_id
    JOIN budget_accounts a ON a.id=${alias}.account_id
    JOIN budget_elements e ON e.id=a.element_id
    JOIN budget_groups g ON g.id=e.group_id`;
}

export function listItems(database: DatabaseManager, companyId: number) {
  return database.connection.prepare(`SELECT i.*,u.code unit_code,u.name unit_name
    FROM master_items i LEFT JOIN units_of_measure u ON u.id=i.unit_id
    WHERE i.company_id=? ORDER BY i.item_type,i.code`).all(companyId) as Row[];
}

export function listSales(database: DatabaseManager, context: MasterContext) {
  const rows = database.connection.prepare(`SELECT ${baseDimensionSelect("s")},
    i.code item_code,i.name item_name,i.item_type,u.code unit_code
    FROM master_sales s
    ${baseDimensionJoins("s")}
    JOIN master_items i ON i.id=s.item_id
    LEFT JOIN units_of_measure u ON u.id=i.unit_id
    WHERE s.company_id=? AND s.exercise_id=? AND s.version_id=?
    ORDER BY p.period_number,i.code,c.code,a.code`).all(...contextParams(context)) as Row[];
  return rows.map((row) => ({ ...row, sale_amount: roundAmount(Number(row.quantity) * Number(row.unit_price)) }));
}

export function listInventories(database: DatabaseManager, context: MasterContext) {
  const rows = database.connection.prepare(`SELECT ${baseDimensionSelect("v")},
    i.code item_code,i.name item_name,i.item_type,u.code unit_code
    FROM master_inventories v
    ${baseDimensionJoins("v")}
    JOIN master_items i ON i.id=v.item_id
    LEFT JOIN units_of_measure u ON u.id=i.unit_id
    WHERE v.company_id=? AND v.exercise_id=? AND v.version_id=?
    ORDER BY p.period_number,i.code,c.code,a.code`).all(...contextParams(context)) as Row[];
  return rows.map((row) => {
    const finalQuantity = Number(row.initial_quantity) + Number(row.entries_quantity) - Number(row.exits_quantity);
    return {
      ...row,
      final_quantity: roundAmount(finalQuantity, 4),
      inventory_value: roundAmount(finalQuantity * Number(row.unit_cost)),
      desired_inventory_value: roundAmount(Number(row.desired_final_quantity) * Number(row.unit_cost)),
    };
  });
}

export function listPurchases(database: DatabaseManager, context: MasterContext) {
  const rows = database.connection.prepare(`SELECT ${baseDimensionSelect("b")},
    i.code item_code,i.name item_name,i.item_type,u.code unit_code
    FROM master_purchases b
    ${baseDimensionJoins("b")}
    JOIN master_items i ON i.id=b.item_id
    LEFT JOIN units_of_measure u ON u.id=i.unit_id
    WHERE b.company_id=? AND b.exercise_id=? AND b.version_id=?
    ORDER BY p.period_number,i.code,c.code,a.code`).all(...contextParams(context)) as Row[];
  return rows.map((row) => {
    const purchaseQuantity = Number(row.needs_quantity) + Number(row.desired_final_quantity) - Number(row.initial_inventory_quantity);
    return {
      ...row,
      purchase_quantity: roundAmount(purchaseQuantity, 4),
      purchase_total: roundAmount(purchaseQuantity * Number(row.unit_price)),
    };
  });
}

export function listCosts(database: DatabaseManager, context: MasterContext) {
  const rows = database.connection.prepare(`SELECT ${baseDimensionSelect("k")},
    i.code item_code,i.name item_name,u.code unit_code
    FROM master_costs k
    ${baseDimensionJoins("k")}
    LEFT JOIN master_items i ON i.id=k.item_id
    LEFT JOIN units_of_measure u ON u.id=i.unit_id
    WHERE k.company_id=? AND k.exercise_id=? AND k.version_id=?
    ORDER BY p.period_number,c.code,k.cost_category,a.code`).all(...contextParams(context)) as Row[];
  return rows.map((row) => ({ ...row, cost_amount: roundAmount(Number(row.quantity) * Number(row.unit_cost)) }));
}

export function listExpenses(database: DatabaseManager, context: MasterContext) {
  return database.connection.prepare(`SELECT ${baseDimensionSelect("x")}
    FROM master_expenses x
    ${baseDimensionJoins("x")}
    WHERE x.company_id=? AND x.exercise_id=? AND x.version_id=?
    ORDER BY p.period_number,c.code,a.code`).all(...contextParams(context)) as Row[];
}

export function listInvestments(database: DatabaseManager, context: MasterContext) {
  const rows = database.connection.prepare(`SELECT ${baseDimensionSelect("n")}
    FROM master_investments n
    ${baseDimensionJoins("n")}
    WHERE n.company_id=? AND n.exercise_id=? AND n.version_id=?
    ORDER BY p.period_number,c.code,n.description`).all(...contextParams(context)) as Row[];
  return rows.map((row) => {
    const life = row.useful_life_months === null ? null : Number(row.useful_life_months);
    const monthly = life && life > 0 ? Number(row.amount) / life : 0;
    const monthsInYear = life ? Math.min(life, 13 - Number(row.period_number)) : 0;
    return {
      ...row,
      monthly_depreciation: roundAmount(monthly),
      depreciation_budgeted: roundAmount(monthly * monthsInYear),
    };
  });
}

export function listProduction(database: DatabaseManager, context: MasterContext) {
  const sales = listSales(database, context);
  const inventories = listInventories(database, context).filter((row) => row.item_type === "PRODUCTO");
  const rows = new Map<string, Row>();

  const keyFor = (row: Row) => [row.period_id, row.item_id, row.center_id, row.account_id].join(":");
  const seed = (row: Row) => {
    const key = keyFor(row);
    if (!rows.has(key)) {
      rows.set(key, {
        period_id: row.period_id,
        period_number: row.period_number,
        period_name: row.period_name,
        period_status: row.period_status,
        item_id: row.item_id,
        item_code: row.item_code,
        item_name: row.item_name,
        unit_code: row.unit_code,
        center_id: row.center_id,
        center_code: row.center_code,
        center_name: row.center_name,
        account_id: row.account_id,
        account_code: row.account_code,
        account_name: row.account_name,
        sales_quantity: 0,
        initial_inventory: 0,
        desired_final_inventory: 0,
      });
    }
    return rows.get(key) as Row;
  };

  for (const sale of sales) {
    const target = seed(sale);
    target.sales_quantity = Number(target.sales_quantity) + Number(sale.quantity);
  }
  for (const inventory of inventories) {
    const target = seed(inventory);
    target.initial_inventory = Number(inventory.initial_quantity);
    target.desired_final_inventory = Number(inventory.desired_final_quantity);
  }

  return [...rows.values()]
    .map((row) => {
      const formulaResult = Number(row.sales_quantity) + Number(row.desired_final_inventory) - Number(row.initial_inventory);
      return {
        ...row,
        formula_result: roundAmount(formulaResult, 4),
        production_required: roundAmount(Math.max(0, formulaResult), 4),
        warning: formulaResult < 0 ? "El inventario inicial cubre las ventas y el inventario final deseado; no se requiere producir." : null,
      };
    })
    .sort((left, right) => Number(left.period_number) - Number(right.period_number)
      || String(left.item_code).localeCompare(String(right.item_code)));
}

export interface FinancialSettings extends Row {
  tax_rate: number;
  collection_rate: number;
  payment_rate: number;
  opening_cash: number;
  opening_receivables: number;
  opening_ppe: number;
  opening_payables: number;
  opening_debt: number;
  notes: string | null;
}

export function getFinancialSettings(database: DatabaseManager, context: MasterContext): FinancialSettings {
  const row = database.connection.prepare(`SELECT * FROM master_financial_settings
    WHERE company_id=? AND exercise_id=? AND version_id=?`).get(...contextParams(context)) as FinancialSettings | undefined;
  return row ?? {
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
}

function depreciationForMonth(investment: Row, periodNumber: number) {
  const life = investment.useful_life_months === null ? 0 : Number(investment.useful_life_months);
  const start = Number(investment.period_number);
  if (!life || periodNumber < start || periodNumber - start >= life) return 0;
  return Number(investment.amount) / life;
}

export function getIncomeStatement(database: DatabaseManager, context: MasterContext) {
  const periods = getPeriods(database, context);
  const sales = listSales(database, context);
  const costs = listCosts(database, context);
  const expenses = listExpenses(database, context);
  const investments = listInvestments(database, context);
  const settings = getFinancialSettings(database, context);

  const monthly = periods.map((period) => {
    const number = Number(period.period_number);
    const salesAmount = sales.filter((row) => Number(row.period_id) === Number(period.id))
      .reduce((sum, row) => sum + Number(row.sale_amount), 0);
    const materials = costs.filter((row) => Number(row.period_id) === Number(period.id) && row.cost_category === "MATERIALES")
      .reduce((sum, row) => sum + Number(row.cost_amount), 0);
    const labor = costs.filter((row) => Number(row.period_id) === Number(period.id) && row.cost_category === "MANO_OBRA")
      .reduce((sum, row) => sum + Number(row.cost_amount), 0);
    const overhead = costs.filter((row) => Number(row.period_id) === Number(period.id) && row.cost_category === "CIF")
      .reduce((sum, row) => sum + Number(row.cost_amount), 0);
    const expenseAmount = expenses.filter((row) => Number(row.period_id) === Number(period.id))
      .reduce((sum, row) => sum + Number(row.amount), 0);
    const depreciation = investments.reduce((sum, row) => sum + depreciationForMonth(row, number), 0);
    const productionCost = materials + labor + overhead;
    const grossProfit = salesAmount - productionCost;
    const operatingIncome = grossProfit - expenseAmount - depreciation;
    const tax = Math.max(0, operatingIncome) * Number(settings.tax_rate) / 100;
    const netIncome = operatingIncome - tax;
    return {
      period_id: period.id,
      period_number: number,
      period_name: period.name,
      sales: roundAmount(salesAmount),
      materials: roundAmount(materials),
      direct_labor: roundAmount(labor),
      manufacturing_overhead: roundAmount(overhead),
      production_cost: roundAmount(productionCost),
      gross_profit: roundAmount(grossProfit),
      operating_expenses: roundAmount(expenseAmount),
      depreciation: roundAmount(depreciation),
      operating_income: roundAmount(operatingIncome),
      income_tax: roundAmount(tax),
      net_income: roundAmount(netIncome),
    };
  });

  const annual = monthly.reduce((total, row) => {
    for (const key of ["sales","materials","direct_labor","manufacturing_overhead","production_cost","gross_profit","operating_expenses","depreciation","operating_income","income_tax","net_income"] as const) {
      total[key] = roundAmount(total[key] + Number(row[key]));
    }
    return total;
  }, {
    sales: 0,
    materials: 0,
    direct_labor: 0,
    manufacturing_overhead: 0,
    production_cost: 0,
    gross_profit: 0,
    operating_expenses: 0,
    depreciation: 0,
    operating_income: 0,
    income_tax: 0,
    net_income: 0,
  });

  return { settings, monthly, annual };
}

function inventoryAtPeriod(inventories: Row[], periodNumber: number) {
  const latest = new Map<string, Row>();
  for (const row of inventories) {
    if (Number(row.period_number) > periodNumber) continue;
    const key = [row.item_id, row.center_id, row.account_id].join(":");
    const current = latest.get(key);
    if (!current || Number(row.period_number) > Number(current.period_number)) latest.set(key, row);
  }
  return [...latest.values()].reduce((sum, row) => sum + Number(row.inventory_value), 0);
}

export function getBalanceSheet(database: DatabaseManager, context: MasterContext) {
  const periods = getPeriods(database, context);
  const sales = listSales(database, context);
  const inventories = listInventories(database, context);
  const purchases = listPurchases(database, context);
  const investments = listInvestments(database, context);
  const income = getIncomeStatement(database, context);
  const settings = income.settings;
  const firstPeriodInventory = inventories.filter((row) => Number(row.period_number) === 1)
    .reduce((sum, row) => sum + Number(row.initial_quantity) * Number(row.unit_cost), 0);
  const openingAssets = Number(settings.opening_cash) + Number(settings.opening_receivables)
    + firstPeriodInventory + Number(settings.opening_ppe);
  const openingLiabilities = Number(settings.opening_payables) + Number(settings.opening_debt);
  const openingEquity = openingAssets - openingLiabilities;

  const monthly = periods.map((period) => {
    const number = Number(period.period_number);
    const cumulativeSales = sales.filter((row) => Number(row.period_number) <= number)
      .reduce((sum, row) => sum + Number(row.sale_amount), 0);
    const cumulativePurchases = purchases.filter((row) => Number(row.period_number) <= number)
      .reduce((sum, row) => sum + Number(row.purchase_total), 0);
    const cumulativeInvestments = investments.filter((row) => Number(row.period_number) <= number)
      .reduce((sum, row) => sum + Number(row.amount), 0);
    const cumulativeDebtFinancing = investments.filter((row) => Number(row.period_number) <= number && row.financing_source === "DEUDA")
      .reduce((sum, row) => sum + Number(row.amount), 0);
    const cumulativeCapital = investments.filter((row) => Number(row.period_number) <= number && row.financing_source === "CAPITAL")
      .reduce((sum, row) => sum + Number(row.amount), 0);
    const cumulativeDepreciation = income.monthly.filter((row) => Number(row.period_number) <= number)
      .reduce((sum, row) => sum + Number(row.depreciation), 0);
    const cumulativeNetIncome = income.monthly.filter((row) => Number(row.period_number) <= number)
      .reduce((sum, row) => sum + Number(row.net_income), 0);

    const receivables = Number(settings.opening_receivables)
      + cumulativeSales * (1 - Number(settings.collection_rate) / 100);
    const inventory = inventoryAtPeriod(inventories, number);
    const netPpe = Math.max(0, Number(settings.opening_ppe) + cumulativeInvestments - cumulativeDepreciation);
    const payables = Number(settings.opening_payables)
      + cumulativePurchases * (1 - Number(settings.payment_rate) / 100);
    const longTermDebt = Number(settings.opening_debt) + cumulativeDebtFinancing;
    const equity = openingEquity + cumulativeCapital + cumulativeNetIncome;
    const assetsWithoutCash = receivables + inventory + netPpe;
    const liabilitiesAndEquityBeforeBalance = payables + longTermDebt + equity;
    const balancingAmount = liabilitiesAndEquityBeforeBalance - assetsWithoutCash;
    const cash = Math.max(0, balancingAmount);
    const shortTermFinancing = Math.max(0, -balancingAmount);
    const totalAssets = cash + assetsWithoutCash;
    const totalLiabilities = payables + longTermDebt + shortTermFinancing;
    const totalLiabilitiesAndEquity = totalLiabilities + equity;
    const difference = totalAssets - totalLiabilitiesAndEquity;

    return {
      period_id: period.id,
      period_number: number,
      period_name: period.name,
      cash: roundAmount(cash),
      receivables: roundAmount(receivables),
      inventory: roundAmount(inventory),
      net_property_plant_equipment: roundAmount(netPpe),
      total_assets: roundAmount(totalAssets),
      accounts_payable: roundAmount(payables),
      short_term_financing: roundAmount(shortTermFinancing),
      long_term_debt: roundAmount(longTermDebt),
      total_liabilities: roundAmount(totalLiabilities),
      equity: roundAmount(equity),
      total_liabilities_and_equity: roundAmount(totalLiabilitiesAndEquity),
      balance_difference: roundAmount(difference),
      balanced: Math.abs(difference) < 0.01,
    };
  });

  return {
    settings,
    opening: {
      inventory: roundAmount(firstPeriodInventory),
      assets: roundAmount(openingAssets),
      liabilities: roundAmount(openingLiabilities),
      equity: roundAmount(openingEquity),
    },
    monthly,
    annual: monthly.at(-1) ?? null,
  };
}

export function getMasterSummary(database: DatabaseManager, context: MasterContext) {
  const sales = listSales(database, context);
  const inventories = listInventories(database, context);
  const purchases = listPurchases(database, context);
  const production = listProduction(database, context);
  const costs = listCosts(database, context);
  const expenses = listExpenses(database, context);
  const investments = listInvestments(database, context);
  const income = getIncomeStatement(database, context);
  const balance = getBalanceSheet(database, context);
  return {
    sales_total: roundAmount(sales.reduce((sum, row) => sum + Number(row.sale_amount), 0)),
    inventory_final_value: roundAmount(balance.annual ? Number(balance.annual.inventory) : 0),
    purchases_total: roundAmount(purchases.reduce((sum, row) => sum + Number(row.purchase_total), 0)),
    production_units: roundAmount(production.reduce((sum, row) => sum + Number(row.production_required), 0), 4),
    production_cost: roundAmount(costs.reduce((sum, row) => sum + Number(row.cost_amount), 0)),
    expenses_total: roundAmount(expenses.reduce((sum, row) => sum + Number(row.amount), 0)),
    investments_total: roundAmount(investments.reduce((sum, row) => sum + Number(row.amount), 0)),
    net_income: income.annual.net_income,
    balance_ok: Boolean(balance.annual?.balanced),
    counts: {
      sales: sales.length,
      inventories: inventories.length,
      purchases: purchases.length,
      production: production.length,
      costs: costs.length,
      expenses: expenses.length,
      investments: investments.length,
    },
  };
}
