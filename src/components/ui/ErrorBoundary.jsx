import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100dvh',
          background: '#0c1021',
          color: 'white',
          padding: '20px',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{
            background: '#1a1f35',
            border: '1px solid #ef4444',
            borderRadius: '12px',
            padding: '16px',
            marginTop: '40px',
          }}>
            <h2 style={{ color: '#f87171', fontSize: '18px', marginBottom: '8px' }}>
              Something went wrong
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '12px' }}>
              The app crashed. Here's the error:
            </p>
            <pre style={{
              background: '#0c1021',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '11px',
              color: '#fbbf24',
              overflow: 'auto',
              maxHeight: '200px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}>
              {this.state.error?.toString()}
            </pre>
            {this.state.errorInfo && (
              <pre style={{
                background: '#0c1021',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '10px',
                color: '#6b7280',
                overflow: 'auto',
                maxHeight: '200px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                marginTop: '8px',
              }}>
                {this.state.errorInfo.componentStack}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: '16px',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
