function add(db, table, values) {
  const keys = Object.keys(values);
  return Number(db.prepare(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`)
    .run(...keys.map((key) => values[key])).lastInsertRowid);
}

export function seedPhase9(database) {
  const db = database.connection;
  const stamp = new Date().toISOString();
  return db.transaction(() => {
    const company = db.prepare("SELECT id,currency_id FROM companies WHERE code='DEMO'").get();
    const site = db.prepare("SELECT id FROM sites WHERE company_id=? LIMIT 1").get(company.id);
    const responsible = db.prepare("SELECT id FROM responsibles WHERE company_id=? LIMIT 1").get(company.id);
    const exerciseId = add(db, "budget_exercises", {
      company_id: company.id, code: "EJ-F9-2041", budget_year: 2041,
      start_date: "2041-01-01", end_date: "2041-12-31", currency_id: company.currency_id,
      notes: "Fixture sintético F9", active: 1, created_at: stamp, updated_at: stamp,
    });
    const names = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    const periods = names.map((name, index) => add(db, "budget_periods", {
      company_id: company.id, exercise_id: exerciseId, period_number: index + 1, name,
      start_date: `2041-${String(index + 1).padStart(2,"0")}-01`, end_date: `2041-${String(index + 1).padStart(2,"0")}-28`,
      status: "ABIERTO", notes: "Fixture F9", created_at: stamp, updated_at: stamp,
    }));
    const originalVersionId = add(db, "budget_versions", {
      company_id: company.id, exercise_id: exerciseId, period_id: null, source_version_id: null,
      copied_from_version_id: null, responsible_id: responsible.id, code: "ORI-F9", name: "Original F9",
      version_type: "ORIGINAL", version_number: 1, status: "APROBADO", notes: "Sintético", created_at: stamp, updated_at: stamp,
    });
    const forecastVersionId = add(db, "budget_versions", {
      company_id: company.id, exercise_id: exerciseId, period_id: periods[0], source_version_id: originalVersionId,
      copied_from_version_id: null, responsible_id: responsible.id, code: "FC-F9", name: "Forecast F9",
      version_type: "FORECAST", version_number: 1, status: "BORRADOR", notes: "Sintético", created_at: stamp, updated_at: stamp,
    });
    add(db, "forecast_profiles", {
      company_id: company.id, exercise_id: exerciseId, forecast_version_id: forecastVersionId,
      original_version_id: originalVersionId, cutoff_period_number: 1, revision_number: 1,
      responsible_id: responsible.id, observation: "Fixture F9", created_at: stamp, updated_at: stamp,
    });
    const center = (code, name) => add(db, "activity_centers", {
      company_id: company.id, site_id: site.id, responsible_id: responsible.id, code, name,
      center_type: "PRODUCTIVO", description: "Fixture", active: 1, created_at: stamp, updated_at: stamp,
    });
    const centerA = center("C-F9-A", "Centro A");
    const centerB = center("C-F9-B", "Centro B");
    const groupId = add(db, "budget_groups", { company_id: company.id, code: "GR-F9", name: "Grupo F9", description: "Fixture", active: 1, created_at: stamp, updated_at: stamp });
    const elementId = add(db, "budget_elements", { company_id: company.id, group_id: groupId, code: "EL-F9", name: "Elemento F9", description: "Fixture", active: 1, created_at: stamp, updated_at: stamp });
    const account = (code, name, nature) => add(db, "budget_accounts", {
      company_id: company.id, element_id: elementId, code, name, nature, movement_type: "DETALLE",
      description: "Fixture sintético", active: 1, created_at: stamp, updated_at: stamp,
    });
    const accounts = {
      sales: account("V-F9", "Ventas F9", "INGRESO"), fixed: account("CF-F9", "Costo fijo F9", "COSTO"),
      variable: account("CV-F9", "Costo variable F9", "COSTO"), expense: account("G-F9", "Gasto F9", "GASTO"),
      zero: account("G0-F9", "Gasto base cero F9", "GASTO"),
    };
    const actuals = [[centerA,accounts.sales,1000,1100],[centerA,accounts.fixed,400,460],[centerA,accounts.variable,200,180],[centerB,accounts.expense,100,130],[centerB,accounts.zero,0,50]];
    actuals.forEach(([center_id,account_id,budgeted_value,actual_value]) => add(db, "actual_values", {
      company_id: company.id, exercise_id: exerciseId, original_version_id: originalVersionId, period_id: periods[0],
      center_id, account_id, budget_type: "PRESUPUESTO_ORIGINAL", budgeted_value, actual_value,
      source_type: "DEMOSTRATIVO", source_reference: "Fixture sintético F9", source_period: "2041-01",
      source_date: "2041-01-31", responsible_id: responsible.id, comment: "No oficial",
      registered_at: stamp, created_at: stamp, updated_at: stamp,
    }));
    const forecasts = [[centerA,accounts.sales,1000,1050],[centerA,accounts.fixed,400,430],[centerA,accounts.variable,200,190],[centerB,accounts.expense,100,120],[centerB,accounts.zero,0,20]];
    forecasts.forEach(([center_id,account_id,original_budget,forecast_value]) => add(db, "forecast_values", {
      company_id: company.id, exercise_id: exerciseId, forecast_version_id: forecastVersionId,
      original_version_id: originalVersionId, period_id: periods[0], center_id, group_id: groupId,
      element_id: elementId, account_id, original_budget, actual_value: null, projected_value: forecast_value,
      forecast_value, value_origin: "PROYECCION", comment: "Fixture", source_reference: "Fixture sintético F9",
      responsible_id: responsible.id, created_at: stamp, updated_at: stamp,
    }));
    [[accounts.fixed,"CIF","FIJO","DIRECTO",400],[accounts.variable,"MATERIALES","VARIABLE","INDIRECTO",200]]
      .forEach(([account_id,cost_category,behavior,traceability,unit_cost]) => add(db, "master_costs", {
        company_id: company.id, exercise_id: exerciseId, version_id: originalVersionId, period_id: periods[0],
        center_id: centerA, account_id, item_id: null, cost_category, behavior, traceability,
        quantity: 1, unit_cost, comment: "Fixture", created_at: stamp, updated_at: stamp,
      }));
    [[accounts.expense,100],[accounts.zero,0]].forEach(([account_id,amount]) => add(db, "master_expenses", {
      company_id: company.id, exercise_id: exerciseId, version_id: originalVersionId, period_id: periods[0],
      center_id: centerB, account_id, behavior: "FIJO", traceability: "INDIRECTO", amount,
      comment: "Fixture", created_at: stamp, updated_at: stamp,
    }));
    return { companyId: company.id, exerciseId, originalVersionId, forecastVersionId, centerA, centerB, groupId, elementId, accounts };
  })();
}

export function phase9Body(ids, comparison = "ORIGINAL_REAL", extra = {}) {
  return {
    company_id: ids.companyId, exercise_id: ids.exerciseId, original_version_id: ids.originalVersionId,
    forecast_version_id: comparison === "ORIGINAL_REAL" ? null : ids.forecastVersionId,
    period_number: null, center_id: null, group_id: null, element_id: null, account_id: null,
    budget_type: null, comparison, materiality_threshold: 10, ...extra,
  };
}
