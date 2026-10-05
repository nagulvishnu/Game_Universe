"use client";

import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { GameUnavailable } from "./GameUnavailable";

interface Props {
  children: ReactNode;
  title?: string;
}

/** Keeps a failure inside the launcher from taking down the whole hub. */
export class GameErrorBoundary extends Component<Props, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[GameUniverse] launcher error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <GameUnavailable
          title={this.props.title}
          message="The launcher hit an unexpected problem. The rest of the universe is fine."
          onRetry={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}
