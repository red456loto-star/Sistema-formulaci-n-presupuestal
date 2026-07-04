import { DatabaseManager } from "../../../../packages/database/src/index";
import { TargetKey } from "./catalog-specs";
import { ValidatedRow, WriteResult } from "./import-types";
import { writeOrganizational } from "./write-organizational";
import { writeBudget } from "./write-budget";
import { writeParameters } from "./write-parameters";

export function writeMasterRow(database: DatabaseManager, target: TargetKey, companyId: number | null, row: ValidatedRow, updateExisting: boolean): WriteResult {
  const result = writeOrganizational(database, target, companyId, row.values, updateExisting)
    ?? writeBudget(database, target, companyId, row.values, updateExisting)
    ?? writeParameters(database, target, row.values, updateExisting);
  if (!result) throw Object.assign(new Error("La tabla destino no cuenta con un escritor configurado."), { statusCode: 400 });
  return result;
}
