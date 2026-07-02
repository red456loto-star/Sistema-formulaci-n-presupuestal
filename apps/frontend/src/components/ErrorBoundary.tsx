import React from "react";

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Se produjo un error inesperado.",
    };
  }

  componentDidCatch(error: unknown) {
    console.error("Error global de interfaz", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="fatal-error">
          <section className="panel fatal-error__panel">
            <span className="eyebrow">PresuControl Empresarial</span>
            <h1>No se pudo mostrar la aplicación</h1>
            <p>{this.state.message}</p>
            <button type="button" className="button button--primary" onClick={() => window.location.reload()}>
              Recargar aplicación
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
