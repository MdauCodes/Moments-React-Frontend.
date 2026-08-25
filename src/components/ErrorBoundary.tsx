import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Top-level render-error guard — without this, any uncaught exception anywhere in the tree
 * (a null deref, a malformed API response shape) unmounts the whole app to a blank white screen,
 * including mid-checkout or mid-payment-polling. Deliberately simple: no error-reporting service
 * wired in (none exists in this codebase yet), just a recovery path so the customer isn't stuck
 * on a blank page with no way forward but closing the tab.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Unhandled render error caught by ErrorBoundary:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
          <h1 className="font-display text-2xl">Something went wrong</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            We hit an unexpected error. Reloading the page usually fixes it — if it keeps
            happening, please contact us.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
