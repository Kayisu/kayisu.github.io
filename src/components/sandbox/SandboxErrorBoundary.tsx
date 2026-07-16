import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class SandboxErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Sandbox rendering failed:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="sandbox-app__status sandbox-app__status--error" role="alert">
          The sandbox could not start. Return to Earth Games and try again.
        </div>
      );
    }

    return this.props.children;
  }
}
