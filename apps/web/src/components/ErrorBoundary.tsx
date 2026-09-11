import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./ui/Button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time errors so a broken page shows a recoverable message instead of a blank
 * screen. Does NOT catch errors inside async `load()` calls (React error boundaries never do) —
 * those still need their own try/catch + toast; this is the last-resort backstop.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled error in component tree:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-panel p-8 text-center">
          <p className="text-sm font-medium text-fg">Что-то пошло не так</p>
          <p className="max-w-sm text-sm text-muted">{this.state.error.message}</p>
          <Button variant="secondary" onClick={() => this.setState({ error: null })}>
            Попробовать снова
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
