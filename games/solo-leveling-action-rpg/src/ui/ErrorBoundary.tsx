import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled game UI error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="fatal-screen" role="alert">
        <div className="sys-panel p-8" style={{ maxWidth: 620 }}>
          <div className="sys-title" style={{ fontSize: 14 }}>
            [ SYSTEM ERROR ]
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: '12px 0' }}>The System encountered a fault</h1>
          <p style={{ color: '#cfe6ff', lineHeight: 1.6 }}>
            {this.state.error.message || 'An unexpected error interrupted the game.'}
          </p>
          <p style={{ color: '#9ad8ff', fontSize: 13 }}>
            Your last autosave is safe. Reload to continue from it. If the problem persists, clear this site&apos;s data
            and report the error.
          </p>
          <button className="sys-btn pur mt-4" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
