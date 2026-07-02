import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="panel empty-state">
      <span className="eyebrow">Error 404</span>
      <h1>Página no encontrada</h1>
      <p>La ruta solicitada no forma parte de la navegación disponible.</p>
      <Link className="button button--primary" to="/">Volver al inicio</Link>
    </section>
  );
}
