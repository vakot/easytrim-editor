import { Component, type ErrorInfo, type ReactNode } from "react";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[app] Unhandled React error", {
      error,
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
      componentStack: info.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: window.navigator.userAgent,
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main
        role="alert"
        className="flex min-h-dvh items-center justify-center bg-background p-6 text-foreground"
      >
        <section
          className="w-full max-w-lg rounded-lg border border-border bg-card p-8 text-center shadow-lg"
          aria-labelledby="app-error-title"
        >
          <p className="mb-2 text-sm font-medium text-muted-foreground">EasyTrim Editor</p>
          <h1 id="app-error-title" className="text-2xl font-semibold">
            Something went wrong
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            The application encountered an unexpected error. Restart it to continue.
          </p>
          <button
            type="button"
            className="mt-6 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={() => window.location.reload()}
          >
            Restart application
          </button>
        </section>
      </main>
    );
  }
}

export { AppErrorBoundary };
