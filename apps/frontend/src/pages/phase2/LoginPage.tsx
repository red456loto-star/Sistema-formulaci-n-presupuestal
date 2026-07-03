import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { LockKeyhole, ShieldCheck, WalletCards } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export function LoginPage() {
  const { user, login } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try { await login(username, password); }
    catch (currentError) { setError(currentError instanceof Error ? currentError.message : String(currentError)); }
    finally { setBusy(false); }
  };

  return <main className="login-page">
    <section className="login-hero">
      <div className="login-brand"><span>PC</span><strong>PresuControl Empresarial</strong></div>
      <div>
        <span className="eyebrow eyebrow--light">Gestión presupuestal offline</span>
        <h1>Seguridad local y control por responsabilidades.</h1>
        <p>La Fase 2 incorpora usuarios, roles, permisos, empresas y una estructura presupuestal jerárquica preparada para las siguientes fases.</p>
      </div>
      <ul className="login-benefits">
        <li><ShieldCheck size={20} /> Acceso por roles y permisos</li>
        <li><WalletCards size={20} /> Separación estricta por empresa</li>
        <li><LockKeyhole size={20} /> Contraseñas protegidas con hash</li>
      </ul>
    </section>
    <section className="login-panel">
      <form className="login-card" onSubmit={submit}>
        <div className="brand__mark brand__mark--large">PC</div>
        <h2>Iniciar sesión</h2>
        <p>Ingrese sus credenciales locales.</p>
        <label className="field"><span>Usuario</span><input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required /></label>
        <label className="field"><span>Contraseña</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
        {error && <div className="inline-message inline-message--danger">{error}</div>}
        <button className="button button--primary button--wide" disabled={busy}>{busy ? "Validando..." : "Ingresar"}</button>
        <div className="demo-credentials"><strong>Acceso inicial de demostración</strong><span>Usuario: admin</span><span>Consulte la contraseña inicial en README_FASE_2.md.</span></div>
      </form>
    </section>
  </main>;
}
