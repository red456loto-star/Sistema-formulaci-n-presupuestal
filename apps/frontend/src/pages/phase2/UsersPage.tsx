import { useEffect, useMemo, useState, type FormEvent } from "react";
import { KeyRound, Shield, UserPlus } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useWorkspace } from "../../context/WorkspaceContext";
import { apiRequest, deleteRequest, postJson } from "../../lib/api";
import { DataTable, Field, FormGrid, Message, Tabs } from "../../components/phase2/Ui";

type UserRow = { id: number; company_id: number | null; company_name: string | null; username: string; full_name: string; email: string; active: number; role_codes: string; role_names: string; last_login_at?: string };
type Role = { id: number; code: string; name: string; description: string; active: number };
type Permission = { id: number; code: string; module: string; action: string; description: string };

export function UsersPage() {
  const { user, hasPermission, refresh } = useAuth();
  const { companyId, companies } = useWorkspace();
  const [tab, setTab] = useState("Usuarios");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ company_id: "", username: "", full_name: "", email: "", password: "", role_ids: [] as number[] });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });

  const load = async () => {
    const query = companyId ? `?company_id=${companyId}` : "";
    const [userRows, roleRows, permissionRows] = await Promise.all([
      apiRequest<UserRow[]>(`/api/users${query}`),
      apiRequest<Role[]>("/api/roles"),
      apiRequest<Permission[]>("/api/permissions"),
    ]);
    setUsers(userRows);
    setRoles(roleRows);
    setPermissions(permissionRows);
    if (!form.company_id && companyId) setForm((value) => ({ ...value, company_id: String(companyId) }));
  };

  useEffect(() => { load().catch((error) => setMessage(error instanceof Error ? error.message : String(error))); }, [companyId]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setMessage("");
    try {
      await action();
      setMessage(success);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const createUser = (event: FormEvent) => {
    event.preventDefault();
    run(async () => {
      await postJson("/api/users", { ...form, company_id: form.company_id ? Number(form.company_id) : null, active: true });
      setForm({ company_id: companyId ? String(companyId) : "", username: "", full_name: "", email: "", password: "", role_ids: [] });
    }, "Usuario creado correctamente.");
  };

  const changePassword = (event: FormEvent) => {
    event.preventDefault();
    run(async () => {
      await postJson("/api/auth/change-password", passwordForm);
      setPasswordForm({ currentPassword: "", newPassword: "" });
      await refresh();
    }, "Contraseña actualizada correctamente.");
  };

  const groupedPermissions = useMemo(() => Object.entries(permissions.reduce<Record<string, Permission[]>>((acc, permission) => {
    (acc[permission.module] ??= []).push(permission);
    return acc;
  }, {})), [permissions]);

  return <div className="page-stack">
    <section className="page-heading"><div><span className="eyebrow">Fase 2 · Seguridad</span><h1>Usuarios, roles y permisos</h1><p>Controle el acceso local por empresa, rol y acción autorizada.</p></div></section>
    <Tabs items={["Usuarios", "Roles y permisos", "Mi contraseña"]} active={tab} onChange={setTab} />
    {message && <Message type={message.includes("correctamente") ? "success" : "danger"}>{message}</Message>}

    {tab === "Usuarios" && <div className="grid-2 grid-2--wide">
      <section className="panel">
        <div className="panel__heading"><div><span className="eyebrow">Nuevo acceso</span><h2>Crear usuario</h2></div><UserPlus /></div>
        {hasPermission("USUARIOS:CREAR") ? <form onSubmit={createUser}>
          <FormGrid>
            <Field label="Empresa"><select value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })} required><option value="">Seleccione</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.commercial_name}</option>)}</select></Field>
            <Field label="Usuario"><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></Field>
            <Field label="Nombre completo" span={2}><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></Field>
            <Field label="Correo" span={2}><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
            <Field label="Contraseña inicial" span={2}><input type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></Field>
            <Field label="Roles" span={2}><div className="checkbox-grid">{roles.filter((role) => role.active).map((role) => <label key={role.id} className="checkbox-item"><input type="checkbox" checked={form.role_ids.includes(role.id)} onChange={(e) => setForm({ ...form, role_ids: e.target.checked ? [...form.role_ids, role.id] : form.role_ids.filter((id) => id !== role.id) })} /><span><strong>{role.name}</strong><small>{role.description}</small></span></label>)}</div></Field>
          </FormGrid>
          <button className="button button--primary">Crear usuario</button>
        </form> : <Message>No cuenta con permiso para crear usuarios.</Message>}
      </section>
      <section className="panel panel--grow">
        <div className="panel__heading"><div><span className="eyebrow">Accesos locales</span><h2>Usuarios registrados</h2></div></div>
        <DataTable headers={["Usuario", "Nombre", "Empresa", "Roles", "Estado", "Acción"]} rows={users.map((row) => [row.username, <div><strong>{row.full_name}</strong><small>{row.email}</small></div>, row.company_name ?? "Global", row.role_names || "Sin rol", row.active ? "Activo" : "Inactivo", row.id !== user?.id && hasPermission("USUARIOS:ELIMINAR") ? <button className="button button--danger button--compact" onClick={() => run(() => deleteRequest(`/api/users/${row.id}`), "Usuario desactivado correctamente.")}>Desactivar</button> : "—"])} />
      </section>
    </div>}

    {tab === "Roles y permisos" && <section className="panel">
      <div className="panel__heading"><div><span className="eyebrow">Matriz de acceso</span><h2>Roles configurados</h2></div><Shield /></div>
      <div className="role-grid">{roles.map((role) => <article className="role-card" key={role.id}><span className="status-dot status-dot--active">{role.code}</span><h3>{role.name}</h3><p>{role.description}</p></article>)}</div>
      <div className="permission-matrix">{groupedPermissions.map(([module, items]) => <section key={module}><h3>{module}</h3><div>{items.map((permission) => <span key={permission.id}>{permission.action}</span>)}</div></section>)}</div>
    </section>}

    {tab === "Mi contraseña" && <section className="panel form-panel">
      <div className="panel__heading"><div><span className="eyebrow">Seguridad personal</span><h2>Cambiar contraseña</h2></div><KeyRound /></div>
      <form onSubmit={changePassword}><FormGrid><Field label="Contraseña actual" span={2}><input type="password" minLength={8} value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} required /></Field><Field label="Nueva contraseña" span={2}><input type="password" minLength={8} value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} required /></Field></FormGrid><button className="button button--primary">Actualizar contraseña</button></form>
    </section>}
  </div>;
}
