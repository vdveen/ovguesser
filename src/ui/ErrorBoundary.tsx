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
      <div className="overlay show">
        <div className="sheet" role="alert">
          <h2>{t.crashTitle}</h2>
          <p className="sub">{t.crashBody}</p>
          <button type="button" className="btn btn-primary wide" onClick={() => location.reload()}>
            {t.reload}
          </button>
        </div>
      </div>
    );
  }
}
