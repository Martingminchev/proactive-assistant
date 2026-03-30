// =============================================================================
// NEXUS - Error Boundary Component
// Catches React errors and provides graceful error recovery
// =============================================================================

import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw, Bug, ArrowLeft } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  showDetails: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, showDetails: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    this.setState({ errorInfo });

    // Log to electron if available
    if (window.electronAPI && typeof window.electronAPI !== 'undefined') {
      // Use console.error which is captured by electron-log
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoBack = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    this.props.onReset?.();
  };

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] p-8">
          {/* Ambient Glow */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-red-500/10 rounded-full blur-[120px] pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative max-w-lg w-full bg-[var(--color-bg-secondary)]/80 backdrop-blur-xl border border-[var(--color-border)] rounded-2xl p-8 shadow-2xl"
          >
            {/* Error Icon */}
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
                <AlertCircle className="w-10 h-10 text-red-400" />
              </div>

              <h1 className="text-2xl font-display font-semibold text-white mb-2">
                Something went wrong
              </h1>
              <p className="text-[var(--color-text-secondary)] mb-6 max-w-sm">
                The application encountered an unexpected error. You can try reloading the app or going back.
              </p>

              {/* Error Message Preview */}
              {this.state.error && (
                <div className="w-full bg-red-500/5 border border-red-500/10 rounded-lg p-3 mb-6">
                  <code className="text-sm text-red-300 font-mono break-all">
                    {this.state.error.message}
                  </code>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                {this.props.onReset && (
                  <button
                    onClick={this.handleGoBack}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-tertiary)]/80 border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] transition-all flex-1"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Go Back</span>
                  </button>
                )}
                <button
                  onClick={this.handleReload}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-nexus-violet to-nexus-cyan hover:opacity-90 rounded-lg text-white font-medium transition-all flex-1"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Reload App</span>
                </button>
              </div>

              {/* Show Details Toggle */}
              <button
                onClick={this.toggleDetails}
                className="flex items-center gap-2 mt-6 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
              >
                <Bug className="w-4 h-4" />
                <span>{this.state.showDetails ? 'Hide Details' : 'Show Technical Details'}</span>
              </button>

              {/* Technical Details */}
              {this.state.showDetails && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="w-full mt-4 text-left overflow-hidden"
                >
                  <div className="bg-black/50 rounded-lg p-4 overflow-auto max-h-64">
                    {this.state.error && (
                      <div className="mb-4">
                        <h4 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">
                          Error
                        </h4>
                        <pre className="text-xs text-red-300 font-mono whitespace-pre-wrap break-all">
                          {this.state.error.stack || this.state.error.message}
                        </pre>
                      </div>
                    )}
                    {this.state.errorInfo && (
                      <div>
                        <h4 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">
                          Component Stack
                        </h4>
                        <pre className="text-xs text-[var(--color-text-secondary)] font-mono whitespace-pre-wrap">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Footer */}
          <p className="absolute bottom-8 text-sm text-[var(--color-text-tertiary)]">
            NEXUS Assistant • {new Date().getFullYear()}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
