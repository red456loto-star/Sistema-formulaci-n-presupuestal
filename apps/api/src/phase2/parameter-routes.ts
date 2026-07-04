import type { Express, Request, Response } from "express";
import { z } from "zod";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { activeField, audit, codeField, normalizeActive, nullableText, positiveId, text } from "./common";

const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener el formato AAAA-MM-DD.").refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "La fecha indicada no es válida.");
const currencySchema = z.object({ code: codeField(3, 3), name: text(2, 100), symbol: text(1, 8), decimals: z.coerce.number().int().min(0).max(6), active: activeField });
const rateSchema = z.object({ currency_id: positiveId, rate_date: dateField, buy_rate: z.coerce.number().positive(), sell_rate: z.coerce.number().positive(), source: nullableText(120), active: activeField });
const unitSchema = z.object({ code: codeField(1, 20), name: text(2, 100), category: codeField(2, 80), active: activeField });

function ensureCurrency(database: DatabaseManager, currencyId: number) {
  if (!database.connection.prepare("SELECT id FROM currencies WHERE id=? AND active=1").get(currencyId)) {
    const error = new Error("La moneda seleccionada no existe o se encuentra inactiva.");
    Object.assign(error, { statusCode: 400 });
    throw error;
  }
}

export function registerParameterRoutes(app: Express, database: DatabaseManager) {
  app.get("/api/catalog/monedas", (_request, response) => response.json(database.connection.prepare("SELECT * FROM currencies ORDER BY code").all()));
  app.post("/api/catalog/monedas", (request: Request, response: Response) => {
    const input = currencySchema.parse(request.body); const stamp = new Date().toISOString();
    const result = database.connection.prepare("INSERT INTO currencies (code, name, symbol, decimals, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(input.code, input.name, input.symbol, input.decimals, normalizeActive(input.active ?? 1), stamp, stamp);
    const id = Number(result.lastInsertRowid); audit(database, "CREAR", "currencies", id, null, `Moneda ${input.code} creada.`, undefined, input); response.status(201).json({ id, message: "Moneda creada correctamente." });
  });
  app.patch("/api/catalog/monedas/:id", (request: Request, response: Response) => {
    const id = Number(request.params.id); const input = currencySchema.partial().parse(request.body); const before = database.connection.prepare("SELECT * FROM currencies WHERE id=?").get(id) as Record<string, unknown> | undefined;
    if (!before) { response.status(404).json({ code: "NOT_FOUND", message: "Moneda no encontrada." }); return; } const values = { ...before, ...input, active: normalizeActive(input.active ?? before.active) } as Record<string, unknown>;
    database.connection.prepare("UPDATE currencies SET code=?, name=?, symbol=?, decimals=?, active=?, updated_at=? WHERE id=?").run(values.code, values.name, values.symbol, values.decimals, values.active, new Date().toISOString(), id);
    audit(database, "EDITAR", "currencies", id, null, "Moneda actualizada.", before, values); response.json({ message: "Moneda actualizada correctamente." });
  });
  app.delete("/api/catalog/monedas/:id", (request: Request, response: Response) => deactivateCurrency(database, request, response));

  app.get("/api/catalog/tipos-cambio", (_request, response) => response.json(database.connection.prepare("SELECT * FROM exchange_rates ORDER BY rate_date DESC").all()));
  app.post("/api/catalog/tipos-cambio", (request: Request, response: Response) => {
    const input = rateSchema.parse(request.body); ensureCurrency(database, input.currency_id); const stamp = new Date().toISOString();
    const result = database.connection.prepare("INSERT INTO exchange_rates (currency_id, rate_date, buy_rate, sell_rate, source, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(input.currency_id, input.rate_date, input.buy_rate, input.sell_rate, input.source ?? null, normalizeActive(input.active ?? 1), stamp, stamp);
    const id = Number(result.lastInsertRowid); audit(database, "CREAR", "exchange_rates", id, null, `Tipo de cambio ${input.rate_date} creado.`, undefined, input); response.status(201).json({ id, message: "Tipo de cambio creado correctamente." });
  });
  app.patch("/api/catalog/tipos-cambio/:id", (request: Request, response: Response) => {
    const id = Number(request.params.id); const input = rateSchema.partial().parse(request.body); const before = database.connection.prepare("SELECT * FROM exchange_rates WHERE id=?").get(id) as Record<string, unknown> | undefined;
    if (!before) { response.status(404).json({ code: "NOT_FOUND", message: "Tipo de cambio no encontrado." }); return; } const values = { ...before, ...input, active: normalizeActive(input.active ?? before.active) } as Record<string, unknown>;
    ensureCurrency(database, Number(values.currency_id));
    database.connection.prepare("UPDATE exchange_rates SET currency_id=?, rate_date=?, buy_rate=?, sell_rate=?, source=?, active=?, updated_at=? WHERE id=?").run(values.currency_id, values.rate_date, values.buy_rate, values.sell_rate, values.source, values.active, new Date().toISOString(), id);
    audit(database, "EDITAR", "exchange_rates", id, null, "Tipo de cambio actualizado.", before, values); response.json({ message: "Tipo de cambio actualizado correctamente." });
  });
  app.delete("/api/catalog/tipos-cambio/:id", (request: Request, response: Response) => deactivateRate(database, request, response));

  app.get("/api/catalog/unidades", (_request, response) => response.json(database.connection.prepare("SELECT * FROM units_of_measure ORDER BY code").all()));
  app.post("/api/catalog/unidades", (request: Request, response: Response) => {
    const input = unitSchema.parse(request.body); const stamp = new Date().toISOString();
    const result = database.connection.prepare("INSERT INTO units_of_measure (code, name, category, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(input.code, input.name, input.category, normalizeActive(input.active ?? 1), stamp, stamp);
    const id = Number(result.lastInsertRowid); audit(database, "CREAR", "units_of_measure", id, null, `Unidad ${input.code} creada.`, undefined, input); response.status(201).json({ id, message: "Unidad creada correctamente." });
  });
  app.patch("/api/catalog/unidades/:id", (request: Request, response: Response) => {
    const id = Number(request.params.id); const input = unitSchema.partial().parse(request.body); const before = database.connection.prepare("SELECT * FROM units_of_measure WHERE id=?").get(id) as Record<string, unknown> | undefined;
    if (!before) { response.status(404).json({ code: "NOT_FOUND", message: "Unidad no encontrada." }); return; } const values = { ...before, ...input, active: normalizeActive(input.active ?? before.active) } as Record<string, unknown>;
    database.connection.prepare("UPDATE units_of_measure SET code=?, name=?, category=?, active=?, updated_at=? WHERE id=?").run(values.code, values.name, values.category, values.active, new Date().toISOString(), id);
    audit(database, "EDITAR", "units_of_measure", id, null, "Unidad actualizada.", before, values); response.json({ message: "Unidad actualizada correctamente." });
  });
  app.delete("/api/catalog/unidades/:id", (request: Request, response: Response) => deactivateUnit(database, request, response));
}

function deactivateCurrency(database: DatabaseManager, request: Request, response: Response) {
  const id = Number(request.params.id); const before = database.connection.prepare("SELECT * FROM currencies WHERE id=?").get(id) as Record<string, unknown> | undefined;
  if (!before) { response.status(404).json({ code: "NOT_FOUND", message: "Moneda no encontrada." }); return; }
  database.connection.prepare("UPDATE currencies SET active=0, updated_at=? WHERE id=?").run(new Date().toISOString(), id); audit(database, "ELIMINAR", "currencies", id, null, "Moneda desactivada.", before, { ...before, active: 0 }); response.json({ message: "Moneda desactivada correctamente." });
}
function deactivateRate(database: DatabaseManager, request: Request, response: Response) {
  const id = Number(request.params.id); const before = database.connection.prepare("SELECT * FROM exchange_rates WHERE id=?").get(id) as Record<string, unknown> | undefined;
  if (!before) { response.status(404).json({ code: "NOT_FOUND", message: "Tipo de cambio no encontrado." }); return; }
  database.connection.prepare("UPDATE exchange_rates SET active=0, updated_at=? WHERE id=?").run(new Date().toISOString(), id); audit(database, "ELIMINAR", "exchange_rates", id, null, "Tipo de cambio desactivado.", before, { ...before, active: 0 }); response.json({ message: "Tipo de cambio desactivado correctamente." });
}
function deactivateUnit(database: DatabaseManager, request: Request, response: Response) {
  const id = Number(request.params.id); const before = database.connection.prepare("SELECT * FROM units_of_measure WHERE id=?").get(id) as Record<string, unknown> | undefined;
  if (!before) { response.status(404).json({ code: "NOT_FOUND", message: "Unidad no encontrada." }); return; }
  database.connection.prepare("UPDATE units_of_measure SET active=0, updated_at=? WHERE id=?").run(new Date().toISOString(), id); audit(database, "ELIMINAR", "units_of_measure", id, null, "Unidad desactivada.", before, { ...before, active: 0 }); response.json({ message: "Unidad desactivada correctamente." });
}
