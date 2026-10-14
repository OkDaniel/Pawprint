import { Component, type ReactNode } from 'react';

export class GameBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return this.props.fallback ?? <p role="alert">This part of the Store couldn’t open. <button type="button" onClick={() => this.setState({ failed: false })}>Try again</button></p>;
    return this.props.children;
  }
}
