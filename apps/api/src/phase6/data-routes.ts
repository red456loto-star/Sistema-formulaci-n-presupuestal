import type { Express, Request, Response } from "express";
import { z } from "zod";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { audit } from "../phase2/common";
import { httpError } from "../phase3/common";
import {
  ensureCenterAccount,
  ensureItem,
  ensurePeriod,
  ensureUnit,
  getMasterContext,
  numericId,
  optionalText,
  type MasterContext,
} from "./common";
import {
  getFinancialSettings,
  listCosts,
  listExpenses,
  listInventories,
  listInvestments,
  listItems,
  listPurchases,
  listSales,
} from "./calculations";

const positiveId = z.coerce.number().int().positive();
const nonNegative = z.coerce.number().finite().min(0);
const text = (max: number) => z.string().trim().min(1).max(max);
const optionalTextSchema = z.string().trim().max(1000).optional().nullable();
const activeSchema = z.union([z.boolean(), z.coerce.number().int().min(0).max(1)]).optional().default(true)
  .transform((value) => typeof value === "boolean" ? (value ? 1 : 0) : value);

const contextFields = {
  company_id: positiveId,
  exercise_id: positiveId,
  version_id: positiveId,
  period_id: positiveId,
};

const itemSchema = z.object({
  company_id: positiveId,
  code: text(40).transform((value) => value.toUpperCase()),
  name: text(160),
  item_type: z.enum(["PRODUCTO", "MATERIAL"]),
  unit_id: positiveId.optional().nullable(),
  active: activeSchema,
});

const saleSchema = z.object({
  ...contextFields,
  item_id: positiveId,
  center_id: positiveId,
  account_id: positiveId,
  quantity: nonNegative,
  unit_price: nonNegative,
  comment: optionalTextSchema,
});

const inventorySchema = z.object({
  ...contextFields,
  item_id: positiveId,
  center_id: positiveId,
  account_id: positiveId,
  initial_quantity: nonNegative,
  entries_quantity: nonNegative,
  exits_quantity: nonNegative,
  desired_final_quantity: nonNegative,
  unit_cost: nonNegative,
  comment: optionalTextSchema,
});

const purchaseSchema = z.object({
  ...contextFields,
  item_id: positiveId,
  center_id: positiveId,
  account_id: positiveId,
  needs_quantity: nonNegative,
  initial_inventory_quantity: nonNegative,
  desired_final_quantity: nonNegative,
  unit_price: nonNegative,
  comment: optionalTextSchema,
});

const costSchema = z.object({
  ...contextFields,
  center_id: positiveId,
  account_id: positiveId,
  item_id: positiveId.optional().nullable(),
  cost_category: z.enum(["MATERIALES", "MANO_OBRA", "CIF"]),
  behavior: z.enum(["FIJO", "VARIABLE"]),
  traceability: z.enum(["DIRECTO", "INDIRECTO"]),
  quantity: nonNegative,
  unit_cost: nonNegative,
  comment: optionalTextSchema,
});

const expenseSchema = z.object({
  ...contextFields,
  center_id: positiveId,
  account_id: positiveId,
  behavior: z.enum(["FIJO", "VARIABLE"]),
  traceability: z.enum(["DIRECTO", "INDIRECTO"]),
  amount: nonNegative,
  comment: optionalTextSchema,
});

const investmentSchema = z.object({
  ...contextFields,
  center_id: positiveId,
  account_id: positiveId,
  description: text(240),
  amount: nonNegative,
  useful_life_months: z.coerce.number().int().positive().optional().nullable(),
  financing_source: z.enum(["CAJA", "DEUDA", "CAPITAL"]),
  comment: optionalTextSchema,
});

const settingsSchema = z.object({
  company_id: positiveId,
  exercise_id: positiveId,
  version_id: positiveId,
  tax_rate: nonNegative.max(100),
  collection_rate: nonNegative.max(100),
  payment_rate: nonNegative.max(100),
  opening_cash: z.coerce.number().finite(),
  opening_receivables: nonNegative,
  opening_ppe: nonNegative,
  opening_payables: nonNegative,
  opening_debt: nonNegative,
  notes: optionalTextSchema,
});

type TableName = "master_sales" | "master_inventories" | "master_purchases" | "master_costs" | "master_expenses" | "master_investments";

function contextFromInput(database: DatabaseManager, input: { company_id: number; exercise_id: number; version_id: number; period_id: number }) {
  const context = getMasterContext(database, input.company_id, input.exercise_id, input.version_id, true);
  ensurePeriod(database, context, input.period_id, true);
  return context;
}

function getEditableRow(database: DatabaseManager, table: TableName, id: number) {
  const row = database.connection.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id) as Record<string, unknown> | undefined;
  if (!row) httpError("El registro del presupuesto maestro no existe.", 404);
  const context = getMasterContext(database, Number(row.company_id), Number(row.exercise_id), Number(row.version_id), true);
  ensurePeriod(database, context, Number(row.period_id), true);
  return { row, context };
}

function validateDimensions(database: DatabaseManager, context: MasterContext, centerId: number, accountId: number) {
  return ensureCenterAccount(database, context.companyId, centerId, accountId);
}

function validateInventory(input: z.infer<typeof inventorySchema>) {
  const finalQuantity = input.initial_quantity + input.entries_quantity - input.exits_quantity;
  if (finalQuantity < 0) httpError("El inventario final calculado no puede ser negativo.", 400);
}

function validatePurchase(input: z.infer<typeof purchaseSchema>) {
  const purchaseQuantity = input.needs_quantity + input.desired_final_quantity - input.initial_inventory_quantity;
  if (purchaseQuantity < 0) httpError("La cantidad de compra calculada no puede ser negativa.", 400);
}

function normalizePatch<T extends z.ZodTypeAny>(schema: T, before: Record<string, unknown>, body: unknown): z.infer<T> {
  return schema.parse({ ...before, ...(body as Record<string, unknown>) });
}

export function registerMasterDataRoutes(app: Express, database: DatabaseManager) {
  app.get("/api/master-budget/items", (request: Request, response: Response) => {
    const companyId = numericId(request.query.company_id, "una empresa");
    response.json(listItems(database, companyId));
  });

  app.post("/api/master-budget/items", (request: Request, response: Response) => {
    const input = itemSchema.parse(request.body);
    if (!database.connection.prepare("SELECT id FROM companies WHERE id=? AND active=1").get(input.company_id)) {
      httpError("La empresa seleccionada no existe o está inactiva.", 400);
    }
    ensureUnit(database, input.unit_id);
    const stamp = new Date().toISOString();
    const result = database.connection.prepare(`INSERT INTO master_items
      (company_id,code,name,item_type,unit_id,active,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?)`).run(input.company_id, input.code, input.name, input.item_type, input.unit_id ?? null, input.active, stamp, stamp);
    const id = Number(result.lastInsertRowid);
    audit(database, "CREAR", "master_items", id, input.company_id, "Producto o material del presupuesto maestro creado.", undefined, input);
    response.status(201).json({ id, message: "Producto o material registrado correctamente." });
  });

  app.patch("/api/master-budget/items/:id", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const before = database.connection.prepare("SELECT * FROM master_items WHERE id=?").get(id) as Record<string, unknown> | undefined;
    if (!before) httpError("El producto o material no existe.", 404);
    const input = normalizePatch(itemSchema, before, request.body);
    if (Number(before.company_id) !== input.company_id) httpError("No se puede trasladar el registro a otra empresa.", 400);
    ensureUnit(database, input.unit_id);
    const stamp = new Date().toISOString();
    database.connection.prepare(`UPDATE master_items SET code=?,name=?,item_type=?,unit_id=?,active=?,updated_at=? WHERE id=?`)
      .run(input.code, input.name, input.item_type, input.unit_id ?? null, input.active, stamp, id);
    audit(database, "EDITAR", "master_items", id, input.company_id, "Producto o material actualizado.", before, input);
    response.json({ message: "Producto o material actualizado correctamente." });
  });

  app.delete("/api/master-budget/items/:id", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const before = database.connection.prepare("SELECT * FROM master_items WHERE id=?").get(id) as Record<string, unknown> | undefined;
    if (!before) httpError("El producto o material no existe.", 404);
    const references = ["master_sales", "master_inventories", "master_purchases", "master_costs"]
      .reduce((total, table) => total + Number((database.connection.prepare(`SELECT COUNT(*) total FROM ${table} WHERE item_id=?`).get(id) as { total: number }).total), 0);
    if (references > 0) httpError("El registro ya tiene movimientos. Desactívelo en lugar de eliminarlo.", 409);
    database.connection.prepare("DELETE FROM master_items WHERE id=?").run(id);
    audit(database, "ELIMINAR", "master_items", id, Number(before.company_id), "Producto o material eliminado.", before);
    response.json({ message: "Producto o material eliminado correctamente." });
  });

  app.get("/api/master-budget/sales", (request: Request, response: Response) => {
    const context = getMasterContext(database, numericId(request.query.company_id, "una empresa"), numericId(request.query.exercise_id, "un ejercicio"), numericId(request.query.version_id, "una versión"));
    response.json(listSales(database, context));
  });

  app.post("/api/master-budget/sales", (request: Request, response: Response) => {
    const input = saleSchema.parse(request.body);
    const context = contextFromInput(database, input);
    ensureItem(database, context.companyId, input.item_id, "PRODUCTO");
    validateDimensions(database, context, input.center_id, input.account_id);
    const stamp = new Date().toISOString();
    const result = database.connection.prepare(`INSERT INTO master_sales
      (company_id,exercise_id,version_id,period_id,item_id,center_id,account_id,quantity,unit_price,comment,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(input.company_id, input.exercise_id, input.version_id, input.period_id, input.item_id, input.center_id, input.account_id, input.quantity, input.unit_price, optionalText(input.comment), stamp, stamp);
    const id = Number(result.lastInsertRowid);
    audit(database, "CREAR", "master_sales", id, input.company_id, "Línea del presupuesto de ventas creada.", undefined, input);
    response.status(201).json({ id, message: "Venta presupuestada registrada." });
  });

  app.patch("/api/master-budget/sales/:id", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const { row, context } = getEditableRow(database, "master_sales", id);
    const input = normalizePatch(saleSchema, row, request.body);
    if (input.company_id !== context.companyId || input.exercise_id !== context.exerciseId || input.version_id !== context.versionId) httpError("No se puede cambiar el contexto del registro.", 400);
    ensurePeriod(database, context, input.period_id, true);
    ensureItem(database, context.companyId, input.item_id, "PRODUCTO");
    validateDimensions(database, context, input.center_id, input.account_id);
    database.connection.prepare(`UPDATE master_sales SET period_id=?,item_id=?,center_id=?,account_id=?,quantity=?,unit_price=?,comment=?,updated_at=? WHERE id=?`)
      .run(input.period_id, input.item_id, input.center_id, input.account_id, input.quantity, input.unit_price, optionalText(input.comment), new Date().toISOString(), id);
    audit(database, "EDITAR", "master_sales", id, context.companyId, "Línea del presupuesto de ventas actualizada.", row, input);
    response.json({ message: "Venta presupuestada actualizada." });
  });

  app.delete("/api/master-budget/sales/:id", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const { row, context } = getEditableRow(database, "master_sales", id);
    database.connection.prepare("DELETE FROM master_sales WHERE id=?").run(id);
    audit(database, "ELIMINAR", "master_sales", id, context.companyId, "Línea del presupuesto de ventas eliminada.", row);
    response.json({ message: "Venta presupuestada eliminada." });
  });

  app.get("/api/master-budget/inventories", (request: Request, response: Response) => {
    const context = getMasterContext(database, numericId(request.query.company_id, "una empresa"), numericId(request.query.exercise_id, "un ejercicio"), numericId(request.query.version_id, "una versión"));
    response.json(listInventories(database, context));
  });

  app.post("/api/master-budget/inventories", (request: Request, response: Response) => {
    const input = inventorySchema.parse(request.body);
    validateInventory(input);
    const context = contextFromInput(database, input);
    ensureItem(database, context.companyId, input.item_id);
    validateDimensions(database, context, input.center_id, input.account_id);
    const stamp = new Date().toISOString();
    const result = database.connection.prepare(`INSERT INTO master_inventories
      (company_id,exercise_id,version_id,period_id,item_id,center_id,account_id,initial_quantity,entries_quantity,exits_quantity,desired_final_quantity,unit_cost,comment,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(input.company_id, input.exercise_id, input.version_id, input.period_id, input.item_id, input.center_id, input.account_id, input.initial_quantity, input.entries_quantity, input.exits_quantity, input.desired_final_quantity, input.unit_cost, optionalText(input.comment), stamp, stamp);
    const id = Number(result.lastInsertRowid);
    audit(database, "CREAR", "master_inventories", id, input.company_id, "Línea del presupuesto de inventarios creada.", undefined, input);
    response.status(201).json({ id, message: "Inventario presupuestado registrado." });
  });

  app.patch("/api/master-budget/inventories/:id", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const { row, context } = getEditableRow(database, "master_inventories", id);
    const input = normalizePatch(inventorySchema, row, request.body);
    validateInventory(input);
    if (input.company_id !== context.companyId || input.exercise_id !== context.exerciseId || input.version_id !== context.versionId) httpError("No se puede cambiar el contexto del registro.", 400);
    ensurePeriod(database, context, input.period_id, true);
    ensureItem(database, context.companyId, input.item_id);
    validateDimensions(database, context, input.center_id, input.account_id);
    database.connection.prepare(`UPDATE master_inventories SET period_id=?,item_id=?,center_id=?,account_id=?,initial_quantity=?,entries_quantity=?,exits_quantity=?,desired_final_quantity=?,unit_cost=?,comment=?,updated_at=? WHERE id=?`)
      .run(input.period_id, input.item_id, input.center_id, input.account_id, input.initial_quantity, input.entries_quantity, input.exits_quantity, input.desired_final_quantity, input.unit_cost, optionalText(input.comment), new Date().toISOString(), id);
    audit(database, "EDITAR", "master_inventories", id, context.companyId, "Línea del presupuesto de inventarios actualizada.", row, input);
    response.json({ message: "Inventario presupuestado actualizado." });
  });

  app.delete("/api/master-budget/inventories/:id", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const { row, context } = getEditableRow(database, "master_inventories", id);
    database.connection.prepare("DELETE FROM master_inventories WHERE id=?").run(id);
    audit(database, "ELIMINAR", "master_inventories", id, context.companyId, "Línea del presupuesto de inventarios eliminada.", row);
    response.json({ message: "Inventario presupuestado eliminado." });
  });

  app.get("/api/master-budget/purchases", (request: Request, response: Response) => {
    const context = getMasterContext(database, numericId(request.query.company_id, "una empresa"), numericId(request.query.exercise_id, "un ejercicio"), numericId(request.query.version_id, "una versión"));
    response.json(listPurchases(database, context));
  });

  app.post("/api/master-budget/purchases", (request: Request, response: Response) => {
    const input = purchaseSchema.parse(request.body);
    validatePurchase(input);
    const context = contextFromInput(database, input);
    ensureItem(database, context.companyId, input.item_id, "MATERIAL");
    validateDimensions(database, context, input.center_id, input.account_id);
    const stamp = new Date().toISOString();
    const result = database.connection.prepare(`INSERT INTO master_purchases
      (company_id,exercise_id,version_id,period_id,item_id,center_id,account_id,needs_quantity,initial_inventory_quantity,desired_final_quantity,unit_price,comment,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(input.company_id, input.exercise_id, input.version_id, input.period_id, input.item_id, input.center_id, input.account_id, input.needs_quantity, input.initial_inventory_quantity, input.desired_final_quantity, input.unit_price, optionalText(input.comment), stamp, stamp);
    const id = Number(result.lastInsertRowid);
    audit(database, "CREAR", "master_purchases", id, input.company_id, "Línea del presupuesto de compras creada.", undefined, input);
    response.status(201).json({ id, message: "Compra presupuestada registrada." });
  });

  app.patch("/api/master-budget/purchases/:id", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const { row, context } = getEditableRow(database, "master_purchases", id);
    const input = normalizePatch(purchaseSchema, row, request.body);
    validatePurchase(input);
    if (input.company_id !== context.companyId || input.exercise_id !== context.exerciseId || input.version_id !== context.versionId) httpError("No se puede cambiar el contexto del registro.", 400);
    ensurePeriod(database, context, input.period_id, true);
    ensureItem(database, context.companyId, input.item_id, "MATERIAL");
    validateDimensions(database, context, input.center_id, input.account_id);
    database.connection.prepare(`UPDATE master_purchases SET period_id=?,item_id=?,center_id=?,account_id=?,needs_quantity=?,initial_inventory_quantity=?,desired_final_quantity=?,unit_price=?,comment=?,updated_at=? WHERE id=?`)
      .run(input.period_id, input.item_id, input.center_id, input.account_id, input.needs_quantity, input.initial_inventory_quantity, input.desired_final_quantity, input.unit_price, optionalText(input.comment), new Date().toISOString(), id);
    audit(database, "EDITAR", "master_purchases", id, context.companyId, "Línea del presupuesto de compras actualizada.", row, input);
    response.json({ message: "Compra presupuestada actualizada." });
  });

  app.delete("/api/master-budget/purchases/:id", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const { row, context } = getEditableRow(database, "master_purchases", id);
    database.connection.prepare("DELETE FROM master_purchases WHERE id=?").run(id);
    audit(database, "ELIMINAR", "master_purchases", id, context.companyId, "Línea del presupuesto de compras eliminada.", row);
    response.json({ message: "Compra presupuestada eliminada." });
  });

  app.get("/api/master-budget/costs", (request: Request, response: Response) => {
    const context = getMasterContext(database, numericId(request.query.company_id, "una empresa"), numericId(request.query.exercise_id, "un ejercicio"), numericId(request.query.version_id, "una versión"));
    response.json(listCosts(database, context));
  });

  app.post("/api/master-budget/costs", (request: Request, response: Response) => {
    const input = costSchema.parse(request.body);
    const context = contextFromInput(database, input);
    const dimensions = validateDimensions(database, context, input.center_id, input.account_id);
    if (String(dimensions.center_type) !== "PRODUCTIVO") httpError("Los costos de producción deben asignarse a un centro de tipo PRODUCTIVO.", 400);
    if (input.item_id) ensureItem(database, context.companyId, input.item_id);
    const stamp = new Date().toISOString();
    const result = database.connection.prepare(`INSERT INTO master_costs
      (company_id,exercise_id,version_id,period_id,center_id,account_id,item_id,cost_category,behavior,traceability,quantity,unit_cost,comment,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(input.company_id, input.exercise_id, input.version_id, input.period_id, input.center_id, input.account_id, input.item_id ?? null, input.cost_category, input.behavior, input.traceability, input.quantity, input.unit_cost, optionalText(input.comment), stamp, stamp);
    const id = Number(result.lastInsertRowid);
    audit(database, "CREAR", "master_costs", id, input.company_id, "Costo productivo presupuestado creado.", undefined, input);
    response.status(201).json({ id, message: "Costo productivo registrado." });
  });

  app.patch("/api/master-budget/costs/:id", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const { row, context } = getEditableRow(database, "master_costs", id);
    const input = normalizePatch(costSchema, row, request.body);
    if (input.company_id !== context.companyId || input.exercise_id !== context.exerciseId || input.version_id !== context.versionId) httpError("No se puede cambiar el contexto del registro.", 400);
    ensurePeriod(database, context, input.period_id, true);
    const dimensions = validateDimensions(database, context, input.center_id, input.account_id);
    if (String(dimensions.center_type) !== "PRODUCTIVO") httpError("Los costos de producción deben asignarse a un centro PRODUCTIVO.", 400);
    if (input.item_id) ensureItem(database, context.companyId, input.item_id);
    database.connection.prepare(`UPDATE master_costs SET period_id=?,center_id=?,account_id=?,item_id=?,cost_category=?,behavior=?,traceability=?,quantity=?,unit_cost=?,comment=?,updated_at=? WHERE id=?`)
      .run(input.period_id, input.center_id, input.account_id, input.item_id ?? null, input.cost_category, input.behavior, input.traceability, input.quantity, input.unit_cost, optionalText(input.comment), new Date().toISOString(), id);
    audit(database, "EDITAR", "master_costs", id, context.companyId, "Costo productivo actualizado.", row, input);
    response.json({ message: "Costo productivo actualizado." });
  });

  app.delete("/api/master-budget/costs/:id", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const { row, context } = getEditableRow(database, "master_costs", id);
    database.connection.prepare("DELETE FROM master_costs WHERE id=?").run(id);
    audit(database, "ELIMINAR", "master_costs", id, context.companyId, "Costo productivo eliminado.", row);
    response.json({ message: "Costo productivo eliminado." });
  });

  app.get("/api/master-budget/expenses", (request: Request, response: Response) => {
    const context = getMasterContext(database, numericId(request.query.company_id, "una empresa"), numericId(request.query.exercise_id, "un ejercicio"), numericId(request.query.version_id, "una versión"));
    response.json(listExpenses(database, context));
  });

  app.post("/api/master-budget/expenses", (request: Request, response: Response) => {
    const input = expenseSchema.parse(request.body);
    const context = contextFromInput(database, input);
    validateDimensions(database, context, input.center_id, input.account_id);
    const stamp = new Date().toISOString();
    const result = database.connection.prepare(`INSERT INTO master_expenses
      (company_id,exercise_id,version_id,period_id,center_id,account_id,behavior,traceability,amount,comment,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(input.company_id, input.exercise_id, input.version_id, input.period_id, input.center_id, input.account_id, input.behavior, input.traceability, input.amount, optionalText(input.comment), stamp, stamp);
    const id = Number(result.lastInsertRowid);
    audit(database, "CREAR", "master_expenses", id, input.company_id, "Gasto por centro creado.", undefined, input);
    response.status(201).json({ id, message: "Gasto presupuestado registrado." });
  });

  app.patch("/api/master-budget/expenses/:id", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const { row, context } = getEditableRow(database, "master_expenses", id);
    const input = normalizePatch(expenseSchema, row, request.body);
    if (input.company_id !== context.companyId || input.exercise_id !== context.exerciseId || input.version_id !== context.versionId) httpError("No se puede cambiar el contexto del registro.", 400);
    ensurePeriod(database, context, input.period_id, true);
    validateDimensions(database, context, input.center_id, input.account_id);
    database.connection.prepare(`UPDATE master_expenses SET period_id=?,center_id=?,account_id=?,behavior=?,traceability=?,amount=?,comment=?,updated_at=? WHERE id=?`)
      .run(input.period_id, input.center_id, input.account_id, input.behavior, input.traceability, input.amount, optionalText(input.comment), new Date().toISOString(), id);
    audit(database, "EDITAR", "master_expenses", id, context.companyId, "Gasto por centro actualizado.", row, input);
    response.json({ message: "Gasto presupuestado actualizado." });
  });

  app.delete("/api/master-budget/expenses/:id", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const { row, context } = getEditableRow(database, "master_expenses", id);
    database.connection.prepare("DELETE FROM master_expenses WHERE id=?").run(id);
    audit(database, "ELIMINAR", "master_expenses", id, context.companyId, "Gasto por centro eliminado.", row);
    response.json({ message: "Gasto presupuestado eliminado." });
  });

  app.get("/api/master-budget/investments", (request: Request, response: Response) => {
    const context = getMasterContext(database, numericId(request.query.company_id, "una empresa"), numericId(request.query.exercise_id, "un ejercicio"), numericId(request.query.version_id, "una versión"));
    response.json(listInvestments(database, context));
  });

  app.post("/api/master-budget/investments", (request: Request, response: Response) => {
    const input = investmentSchema.parse(request.body);
    const context = contextFromInput(database, input);
    validateDimensions(database, context, input.center_id, input.account_id);
    const stamp = new Date().toISOString();
    const result = database.connection.prepare(`INSERT INTO master_investments
      (company_id,exercise_id,version_id,period_id,center_id,account_id,description,amount,useful_life_months,financing_source,comment,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(input.company_id, input.exercise_id, input.version_id, input.period_id, input.center_id, input.account_id, input.description, input.amount, input.useful_life_months ?? null, input.financing_source, optionalText(input.comment), stamp, stamp);
    const id = Number(result.lastInsertRowid);
    audit(database, "CREAR", "master_investments", id, input.company_id, "Inversión presupuestada creada.", undefined, input);
    response.status(201).json({ id, message: "Inversión presupuestada registrada." });
  });

  app.patch("/api/master-budget/investments/:id", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const { row, context } = getEditableRow(database, "master_investments", id);
    const input = normalizePatch(investmentSchema, row, request.body);
    if (input.company_id !== context.companyId || input.exercise_id !== context.exerciseId || input.version_id !== context.versionId) httpError("No se puede cambiar el contexto del registro.", 400);
    ensurePeriod(database, context, input.period_id, true);
    validateDimensions(database, context, input.center_id, input.account_id);
    database.connection.prepare(`UPDATE master_investments SET period_id=?,center_id=?,account_id=?,description=?,amount=?,useful_life_months=?,financing_source=?,comment=?,updated_at=? WHERE id=?`)
      .run(input.period_id, input.center_id, input.account_id, input.description, input.amount, input.useful_life_months ?? null, input.financing_source, optionalText(input.comment), new Date().toISOString(), id);
    audit(database, "EDITAR", "master_investments", id, context.companyId, "Inversión presupuestada actualizada.", row, input);
    response.json({ message: "Inversión presupuestada actualizada." });
  });

  app.delete("/api/master-budget/investments/:id", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const { row, context } = getEditableRow(database, "master_investments", id);
    database.connection.prepare("DELETE FROM master_investments WHERE id=?").run(id);
    audit(database, "ELIMINAR", "master_investments", id, context.companyId, "Inversión presupuestada eliminada.", row);
    response.json({ message: "Inversión presupuestada eliminada." });
  });

  app.get("/api/master-budget/settings", (request: Request, response: Response) => {
    const context = getMasterContext(database, numericId(request.query.company_id, "una empresa"), numericId(request.query.exercise_id, "un ejercicio"), numericId(request.query.version_id, "una versión"));
    response.json(getFinancialSettings(database, context));
  });

  app.put("/api/master-budget/settings", (request: Request, response: Response) => {
    const input = settingsSchema.parse(request.body);
    const context = getMasterContext(database, input.company_id, input.exercise_id, input.version_id, true);
    const before = database.connection.prepare("SELECT * FROM master_financial_settings WHERE company_id=? AND exercise_id=? AND version_id=?")
      .get(context.companyId, context.exerciseId, context.versionId) as Record<string, unknown> | undefined;
    const stamp = new Date().toISOString();
    database.connection.prepare(`INSERT INTO master_financial_settings
      (company_id,exercise_id,version_id,tax_rate,collection_rate,payment_rate,opening_cash,opening_receivables,opening_ppe,opening_payables,opening_debt,notes,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(company_id,exercise_id,version_id) DO UPDATE SET
      tax_rate=excluded.tax_rate,collection_rate=excluded.collection_rate,payment_rate=excluded.payment_rate,
      opening_cash=excluded.opening_cash,opening_receivables=excluded.opening_receivables,opening_ppe=excluded.opening_ppe,
      opening_payables=excluded.opening_payables,opening_debt=excluded.opening_debt,notes=excluded.notes,updated_at=excluded.updated_at`)
      .run(input.company_id, input.exercise_id, input.version_id, input.tax_rate, input.collection_rate, input.payment_rate, input.opening_cash, input.opening_receivables, input.opening_ppe, input.opening_payables, input.opening_debt, optionalText(input.notes), stamp, stamp);
    audit(database, before ? "EDITAR" : "CREAR", "master_financial_settings", before ? Number(before.id) : null, context.companyId, "Supuestos financieros del presupuesto maestro guardados.", before, input);
    response.json({ message: "Supuestos financieros guardados correctamente." });
  });
}
