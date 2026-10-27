import React from 'react';

/** Catches render errors so one broken screen does not blank the whole app. */
export class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Studio render error', error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ padding: 32, maxWidth: 640 }}>
        <h1>This screen hit an error</h1>
        <p>Your saved work is not affected. Reload the page to continue. If it happens again, send this message to your administrator:</p>
        <pre className="code">{String(this.state.error && this.state.error.message)}</pre>
        <button className="btn primary" onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }
}
