import type { Express, Response } from "express";
import { z } from "zod";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { activeField, audit, normalizeActive, nullableText, positiveId, requirePermission, text, type AuthenticatedRequest, validateCompanyAccess } from "./common";

const groupSchema = z.object({ company_id: positiveId, code: text(2,30), name: text(2,160), description: nullableText(), active: activeField });
const elementSchema = z.object({ company_id: positiveId, group_id: positiveId, code: text(2,30), name: text(2,160), description: nullableText(), active: activeField });

export function registerGroupElementRoutes(app: Express, database: DatabaseManager) {
  app.get("/api/catalog/grupos", requirePermission("ESTRUCTURA:LEER"), (request: AuthenticatedRequest, response: Response) => {
    const companyId = Number(request.query.company_id || request.identity!.companyId); validateCompanyAccess(request.identity!, companyId); response.json(database.connection.prepare("SELECT * FROM budget_groups WHERE company_id=? ORDER BY code").all(companyId));
  });
  app.post("/api/catalog/grupos", requirePermission("ESTRUCTURA:CREAR"), (request: AuthenticatedRequest, response: Response) => {
    const input = groupSchema.parse(request.body); validateCompanyAccess(request.identity!, input.company_id); const stamp = new Date().toISOString();
    const result = database.connection.prepare("INSERT INTO budget_groups (company_id,code,name,description,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(input.company_id,input.code,input.name,input.description??null,normalizeActive(input.active??1),stamp,stamp);
    const id=Number(result.lastInsertRowid); audit(database,request.identity!,"CREAR","budget_groups",id,input.company_id,`Grupo ${input.name} creado.`,undefined,input); response.status(201).json({id,message:"Grupo creado correctamente."});
  });
  app.patch("/api/catalog/grupos/:id", requirePermission("ESTRUCTURA:EDITAR"), (request: AuthenticatedRequest, response: Response) => {
    const id=Number(request.params.id); const input=groupSchema.partial().parse(request.body); const before=database.connection.prepare("SELECT * FROM budget_groups WHERE id=?").get(id) as Record<string,unknown>|undefined;
    if(!before){response.status(404).json({code:"NOT_FOUND",message:"Grupo no encontrado."});return;} const companyId=Number(input.company_id??before.company_id); validateCompanyAccess(request.identity!,companyId); const values={...before,...input,active:normalizeActive(input.active??before.active)} as Record<string,unknown>;
    database.connection.prepare("UPDATE budget_groups SET company_id=?,code=?,name=?,description=?,active=?,updated_at=? WHERE id=?").run(values.company_id,values.code,values.name,values.description,values.active,new Date().toISOString(),id); audit(database,request.identity!,"EDITAR","budget_groups",id,companyId,"Grupo actualizado.",before,values); response.json({message:"Grupo actualizado correctamente."});
  });
  app.delete("/api/catalog/grupos/:id", requirePermission("ESTRUCTURA:ELIMINAR"), (request: AuthenticatedRequest, response: Response) => {
    const id=Number(request.params.id); const before=database.connection.prepare("SELECT * FROM budget_groups WHERE id=?").get(id) as Record<string,unknown>|undefined; if(!before){response.status(404).json({code:"NOT_FOUND",message:"Grupo no encontrado."});return;} validateCompanyAccess(request.identity!,Number(before.company_id)); database.connection.prepare("UPDATE budget_groups SET active=0,updated_at=? WHERE id=?").run(new Date().toISOString(),id); audit(database,request.identity!,"ELIMINAR","budget_groups",id,Number(before.company_id),"Grupo desactivado.",before,{...before,active:0}); response.json({message:"Grupo desactivado correctamente."});
  });

  app.get("/api/catalog/elementos", requirePermission("ESTRUCTURA:LEER"), (request: AuthenticatedRequest, response: Response) => {
    const companyId=Number(request.query.company_id||request.identity!.companyId); validateCompanyAccess(request.identity!,companyId); response.json(database.connection.prepare("SELECT * FROM budget_elements WHERE company_id=? ORDER BY code").all(companyId));
  });
  app.post("/api/catalog/elementos", requirePermission("ESTRUCTURA:CREAR"), (request: AuthenticatedRequest, response: Response) => {
    const input=elementSchema.parse(request.body); validateCompanyAccess(request.identity!,input.company_id); if(!database.connection.prepare("SELECT id FROM budget_groups WHERE id=? AND company_id=?").get(input.group_id,input.company_id)){response.status(400).json({code:"INVALID_GROUP",message:"El grupo no pertenece a la empresa activa."});return;} const stamp=new Date().toISOString(); const result=database.connection.prepare("INSERT INTO budget_elements (company_id,group_id,code,name,description,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run(input.company_id,input.group_id,input.code,input.name,input.description??null,normalizeActive(input.active??1),stamp,stamp); const id=Number(result.lastInsertRowid); audit(database,request.identity!,"CREAR","budget_elements",id,input.company_id,`Elemento ${input.name} creado.`,undefined,input); response.status(201).json({id,message:"Elemento creado correctamente."});
  });
  app.patch("/api/catalog/elementos/:id", requirePermission("ESTRUCTURA:EDITAR"), (request: AuthenticatedRequest, response: Response) => {
    const id=Number(request.params.id); const input=elementSchema.partial().parse(request.body); const before=database.connection.prepare("SELECT * FROM budget_elements WHERE id=?").get(id) as Record<string,unknown>|undefined; if(!before){response.status(404).json({code:"NOT_FOUND",message:"Elemento no encontrado."});return;} const companyId=Number(input.company_id??before.company_id); validateCompanyAccess(request.identity!,companyId); const values={...before,...input,active:normalizeActive(input.active??before.active)} as Record<string,unknown>; if(!database.connection.prepare("SELECT id FROM budget_groups WHERE id=? AND company_id=?").get(values.group_id,companyId)){response.status(400).json({code:"INVALID_GROUP",message:"El grupo no pertenece a la empresa activa."});return;} database.connection.prepare("UPDATE budget_elements SET company_id=?,group_id=?,code=?,name=?,description=?,active=?,updated_at=? WHERE id=?").run(values.company_id,values.group_id,values.code,values.name,values.description,values.active,new Date().toISOString(),id); audit(database,request.identity!,"EDITAR","budget_elements",id,companyId,"Elemento actualizado.",before,values); response.json({message:"Elemento actualizado correctamente."});
  });
  app.delete("/api/catalog/elementos/:id", requirePermission("ESTRUCTURA:ELIMINAR"), (request: AuthenticatedRequest, response: Response) => {
    const id=Number(request.params.id); const before=database.connection.prepare("SELECT * FROM budget_elements WHERE id=?").get(id) as Record<string,unknown>|undefined; if(!before){response.status(404).json({code:"NOT_FOUND",message:"Elemento no encontrado."});return;} validateCompanyAccess(request.identity!,Number(before.company_id)); database.connection.prepare("UPDATE budget_elements SET active=0,updated_at=? WHERE id=?").run(new Date().toISOString(),id); audit(database,request.identity!,"ELIMINAR","budget_elements",id,Number(before.company_id),"Elemento desactivado.",before,{...before,active:0}); response.json({message:"Elemento desactivado correctamente."});
  });
}
