"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[GlobalErrorBoundary] Uncaught error:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-2xl font-semibold text-red-600">
            Something went wrong
          </h1>
          <p className="max-w-md text-gray-600">
            An unexpected error occurred. Please try again, or refresh the page
            if the problem persists.
          </p>
          {this.state.error && (
            <pre className="max-w-lg overflow-auto rounded bg-gray-100 p-4 text-left text-sm text-gray-800">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReset}
            className="rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}