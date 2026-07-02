import { Construction, Layers3 } from "lucide-react";

export function ModulePage({ title, description }: { title: string; description: string }) {
  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Módulo preparado</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </section>

      <section className="panel empty-state">
        <span className="empty-state__icon"><Construction size={32} /></span>
        <h2>Base de navegación disponible</h2>
        <p>
          Este módulo fue reservado en la arquitectura de la aplicación. Sus formularios, reglas y cálculos se implementarán en la fase correspondiente.
        </p>
        <div className="empty-state__note">
          <Layers3 size={18} />
          <span>No se adelantaron funcionalidades para conservar el desarrollo ordenado por fases.</span>
        </div>
      </section>
    </div>
  );
}
