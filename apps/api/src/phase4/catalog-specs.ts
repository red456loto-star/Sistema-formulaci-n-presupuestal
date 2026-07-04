export type TargetKey = "empresas" | "sedes" | "responsables" | "centros" | "grupos" | "elementos" | "cuentas" | "monedas" | "tipos-cambio" | "unidades";

export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
}

export interface ImportTarget {
  key: TargetKey;
  label: string;
  companyScoped: boolean;
  fields: ImportField[];
}

const field = (key: string, label: string, required: boolean, aliases: string[]): ImportField => ({ key, label, required, aliases });

export const importTargets: Record<TargetKey, ImportTarget> = {
  empresas: {
    key: "empresas", label: "Empresas", companyScoped: false,
    fields: [
      field("code", "Código", true, ["codigo", "cod", "empresa_codigo"]),
      field("commercial_name", "Nombre comercial", true, ["nombre_comercial", "empresa", "nombre"]),
      field("legal_name", "Razón social", true, ["razon_social", "nombre_legal"]),
      field("tax_id", "RUC", true, ["ruc", "identificacion_tributaria"]),
      field("sector", "Sector", true, ["sector", "actividad"]),
      field("currency_code", "Moneda", true, ["moneda", "codigo_moneda", "currency"]),
      field("address", "Dirección", false, ["direccion", "domicilio"]),
      field("email", "Correo", false, ["correo", "email"]),
      field("phone", "Teléfono", false, ["telefono", "celular"]),
      field("active", "Activo", false, ["activo", "estado"]),
    ],
  },
  sedes: {
    key: "sedes", label: "Sedes", companyScoped: true,
    fields: [field("code", "Código", true, ["codigo", "cod"]), field("name", "Nombre", true, ["nombre", "sede"]), field("address", "Dirección", false, ["direccion"]), field("city", "Ciudad", false, ["ciudad"]), field("country", "País", false, ["pais"]), field("active", "Activo", false, ["activo", "estado"])],
  },
  responsables: {
    key: "responsables", label: "Responsables", companyScoped: true,
    fields: [field("code", "Código", true, ["codigo", "cod"]), field("full_name", "Nombre completo", true, ["nombre_completo", "responsable", "nombre"]), field("position", "Cargo", true, ["cargo", "puesto"]), field("email", "Correo", true, ["correo", "email"]), field("phone", "Teléfono", false, ["telefono", "celular"]), field("active", "Activo", false, ["activo", "estado"])],
  },
  centros: {
    key: "centros", label: "Centros de actividad", companyScoped: true,
    fields: [field("site_code", "Código de sede", true, ["sede_codigo", "codigo_sede", "sede"]), field("responsible_code", "Código de responsable", true, ["responsable_codigo", "codigo_responsable", "responsable"]), field("code", "Código", true, ["codigo", "centro_codigo"]), field("name", "Nombre", true, ["nombre", "centro"]), field("center_type", "Tipo", true, ["tipo", "tipo_centro"]), field("description", "Descripción", false, ["descripcion"]), field("active", "Activo", false, ["activo", "estado"])],
  },
  grupos: {
    key: "grupos", label: "Grupos presupuestales", companyScoped: true,
    fields: [field("code", "Código", true, ["codigo", "grupo_codigo"]), field("name", "Nombre", true, ["nombre", "grupo"]), field("description", "Descripción", false, ["descripcion"]), field("active", "Activo", false, ["activo", "estado"])],
  },
  elementos: {
    key: "elementos", label: "Elementos presupuestales", companyScoped: true,
    fields: [field("group_code", "Código de grupo", true, ["grupo_codigo", "codigo_grupo", "grupo"]), field("code", "Código", true, ["codigo", "elemento_codigo"]), field("name", "Nombre", true, ["nombre", "elemento"]), field("description", "Descripción", false, ["descripcion"]), field("active", "Activo", false, ["activo", "estado"])],
  },
  cuentas: {
    key: "cuentas", label: "Cuentas presupuestales", companyScoped: true,
    fields: [field("element_code", "Código de elemento", true, ["elemento_codigo", "codigo_elemento", "elemento"]), field("code", "Código", true, ["codigo", "cuenta_codigo"]), field("name", "Nombre", true, ["nombre", "cuenta"]), field("nature", "Naturaleza", true, ["naturaleza"]), field("movement_type", "Tipo de movimiento", false, ["tipo_movimiento", "movimiento"]), field("description", "Descripción", false, ["descripcion"]), field("active", "Activo", false, ["activo", "estado"])],
  },
  monedas: {
    key: "monedas", label: "Monedas", companyScoped: false,
    fields: [field("code", "Código", true, ["codigo", "moneda"]), field("name", "Nombre", true, ["nombre"]), field("symbol", "Símbolo", true, ["simbolo"]), field("decimals", "Decimales", true, ["decimales"]), field("active", "Activo", false, ["activo", "estado"])],
  },
  "tipos-cambio": {
    key: "tipos-cambio", label: "Tipos de cambio", companyScoped: false,
    fields: [field("currency_code", "Código de moneda", true, ["moneda", "codigo_moneda"]), field("rate_date", "Fecha", true, ["fecha", "fecha_tipo_cambio"]), field("buy_rate", "Compra", true, ["compra", "tipo_compra"]), field("sell_rate", "Venta", true, ["venta", "tipo_venta"]), field("source", "Fuente", false, ["fuente"]), field("active", "Activo", false, ["activo", "estado"])],
  },
  unidades: {
    key: "unidades", label: "Unidades de medida", companyScoped: false,
    fields: [field("code", "Código", true, ["codigo", "unidad"]), field("name", "Nombre", true, ["nombre"]), field("category", "Categoría", true, ["categoria", "tipo"]), field("active", "Activo", false, ["activo", "estado"])],
  },
};

export function normalizeHeader(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function suggestedMapping(target: ImportTarget, headers: string[]) {
  const normalized = headers.map(normalizeHeader);
  return Object.fromEntries(target.fields.map((item) => {
    const candidates = [item.key, ...item.aliases].map(normalizeHeader);
    const index = normalized.findIndex((header) => candidates.includes(header));
    return [item.key, index >= 0 ? headers[index] : ""];
  }));
}
