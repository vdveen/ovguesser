import { Component, type ReactNode } from "react";
import { DICTIONARIES } from "../i18n/strings";

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("render error", error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    const t = document.documentElement.lang === "en" ? DICTIONARIES.en : DICTIONARIES.nl;
    return (
      <div className="crash" role="alert">
        <div className="band">
          <h1>{t.crashTitle}</h1>
        </div>
        <div className="body">
          <p>{t.crashBody}</p>
          <button type="button" className="btn" onClick={() => location.reload()}>
            {t.reload}
          </button>
        </div>
      </div>
    );
  }
}
