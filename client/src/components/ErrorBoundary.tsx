import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught boundary error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.hash = '/'; // Redirect to dashboard safety net
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 no-print">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-8 text-center space-y-6">
            <div className="inline-flex p-3 bg-red-50 dark:bg-red-950/20 text-red-500 rounded-full animate-bounce">
              <AlertTriangle size={28} />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">Something went wrong</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                A component crashed during rendering. You can attempt recovery or go back to the home page.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded text-left overflow-auto max-h-36">
                <p className="text-[10px] font-mono text-red-650 dark:text-red-400 font-bold whitespace-pre-wrap">
                  {this.state.error.message}
                </p>
                <p className="text-[9px] font-mono text-slate-400 dark:text-slate-500 mt-2 whitespace-pre-wrap">
                  {this.state.error.stack?.split('\n').slice(0, 3).join('\n')}
                </p>
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="w-full py-2.5 bg-teal-600 dark:bg-teal-500 text-white font-bold rounded-lg text-xs hover:bg-teal-700 transition flex items-center justify-center gap-2"
            >
              <RefreshCw size={14} />
              <span>Recover & Return to Dashboard</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
