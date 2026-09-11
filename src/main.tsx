import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  componentDidCatch(error: Error) {
    console.error('Game error:', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: '100%', height: '100vh', background: '#000',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', color: '#fff', fontFamily: 'monospace', padding: '20px'
        }}>
          <h1 style={{ color: '#ff4444' }}>Something went wrong</h1>
          <p style={{ color: '#888', marginTop: '10px' }}>{this.state.error}</p>
          <button
            onClick={() => { this.setState({ hasError: false, error: '' }); window.location.reload(); }}
            style={{
              marginTop: '20px', padding: '10px 20px', background: '#333',
              color: '#ffaa00', border: '2px solid #ffaa00', cursor: 'pointer',
              fontFamily: 'monospace', fontSize: '14px'
            }}
          >
            Reload Game
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
