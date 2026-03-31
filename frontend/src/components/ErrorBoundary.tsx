import React, { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', background: '#121212',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: '#282828', borderRadius: 8, padding: '48px 32px',
            maxWidth: 400, width: '100%', textAlign: 'center',
          }}>
            <p style={{
              fontFamily: '"Courier New", monospace', fontWeight: 'bold',
              fontSize: 24, color: '#FFFFFF', textTransform: 'uppercase',
              marginBottom: 24,
            }}>
              SOMETHING WENT WRONG
            </p>
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.href = '/'; }}
              style={{
                background: '#1DB954', color: '#FFFFFF', border: 'none',
                borderRadius: 500, padding: '12px 28px',
                fontFamily: '"Courier New", monospace', fontWeight: 'bold',
                fontSize: 14, textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              GO HOME
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
