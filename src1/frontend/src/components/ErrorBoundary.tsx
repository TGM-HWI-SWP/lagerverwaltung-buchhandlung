import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message?: string;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return { hasError: true, message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center p-6">
          <h1 className="text-2xl font-semibold">UI-Fehler</h1>
          <p className="mt-2 text-sm text-gray-500">{this.state.message}</p>
          <button
            className="mt-6 w-fit rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
            onClick={() => window.location.reload()}
          >
            Seite neu laden
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
