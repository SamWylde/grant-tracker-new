import React, { Component, ReactNode, ErrorInfo } from 'react';
import { Container, Title, Text, Button, Group, Stack, Paper, Code, Collapse } from '@mantine/core';
import { IconAlertTriangle, IconRefresh, IconBug } from '@tabler/icons-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
  showDetails?: boolean;
  boundaryName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showErrorDetails: boolean;
}

/**
 * ErrorBoundary Component
 *
 * A reusable React Error Boundary component that catches JavaScript errors
 * anywhere in the child component tree, logs those errors, and displays
 * a fallback UI instead of the component tree that crashed.
 *
 * Features:
 * - Catches errors in child components
 * - Displays user-friendly error message
 * - Provides retry functionality to recover from errors
 * - Logs errors to console (can be extended with Sentry integration)
 * - Configurable fallback UI
 * - Optional error details display for debugging
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary boundaryName="MainApp">
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 *
 * Future Enhancement:
 * To integrate with Sentry or other error tracking services, add the following
 * in the componentDidCatch method:
 *
 * ```typescript
 * import * as Sentry from "@sentry/react";
 *
 * componentDidCatch(error: Error, errorInfo: ErrorInfo) {
 *   // Send error to Sentry
 *   Sentry.captureException(error, {
 *     contexts: {
 *       react: {
 *         componentStack: errorInfo.componentStack,
 *       },
 *     },
 *   });
 * }
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showErrorDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { boundaryName = 'Unknown', onError } = this.props;

    // Log error to console
    console.group(`🚨 Error Boundary Caught Error: ${boundaryName}`);
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Component Stack:', errorInfo.componentStack);
    console.groupEnd();

    // Store error info in state
    this.setState({
      errorInfo,
    });

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo);
    }

    // TODO: Send error to error tracking service (e.g., Sentry)
    // Example:
    // Sentry.captureException(error, {
    //   contexts: {
    //     react: {
    //       componentStack: errorInfo.componentStack,
    //     },
    //   },
    //   tags: {
    //     boundaryName,
    //   },
    // });
  }

  handleReset = (): void => {
    const { onReset } = this.props;

    // Reset error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showErrorDetails: false,
    });

    // Call custom reset handler if provided
    if (onReset) {
      onReset();
    }
  };

  handleReportError = (): void => {
    const { error, errorInfo } = this.state;
    const { boundaryName = 'Unknown' } = this.props;

    // Create error report data
    const errorReport = {
      boundaryName,
      error: {
        message: error?.message,
        stack: error?.stack,
      },
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Log to console (in production, this would send to a backend service)
    console.log('📧 Error Report:', errorReport);

    // TODO: Implement actual error reporting
    // Example:
    // fetch('/api/error-report', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(errorReport),
    // });

    alert('Error report has been logged. In production, this would be sent to our support team.');
  };

  toggleErrorDetails = (): void => {
    this.setState((prevState) => ({
      showErrorDetails: !prevState.showErrorDetails,
    }));
  };

  render() {
    const { hasError, error, errorInfo, showErrorDetails } = this.state;
    const { children, fallback, showDetails = true } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return <>{fallback}</>;
      }

      // Default fallback UI
      return (
        <Container size="sm" py="xl" style={{ minHeight: '400px', display: 'flex', alignItems: 'center' }}>
          <Paper shadow="md" p="xl" radius="md" withBorder style={{ width: '100%' }}>
            <Stack gap="lg">
              <Group>
                <IconAlertTriangle size={40} color="var(--mantine-color-red-6)" />
                <div style={{ flex: 1 }}>
                  <Title order={2} c="red">
                    Something went wrong
                  </Title>
                  <Text size="sm" c="dimmed" mt={4}>
                    We encountered an unexpected error
                  </Text>
                </div>
              </Group>

              <Text>
                We're sorry, but something went wrong. The error has been logged and our team will look into it.
                You can try refreshing the page or returning to the previous screen.
              </Text>

              {error && (
                <Paper p="md" bg="gray.0" radius="sm">
                  <Text size="sm" fw={600} mb="xs">
                    Error Message:
                  </Text>
                  <Code block color="red">
                    {error.message}
                  </Code>
                </Paper>
              )}

              {showDetails && errorInfo && (
                <>
                  <Button
                    variant="subtle"
                    size="xs"
                    onClick={this.toggleErrorDetails}
                    leftSection={<IconBug size={16} />}
                  >
                    {showErrorDetails ? 'Hide' : 'Show'} Technical Details
                  </Button>

                  <Collapse in={showErrorDetails}>
                    <Paper p="md" bg="gray.0" radius="sm">
                      <Text size="sm" fw={600} mb="xs">
                        Component Stack:
                      </Text>
                      <Code block style={{ fontSize: '11px', maxHeight: '200px', overflow: 'auto' }}>
                        {errorInfo.componentStack}
                      </Code>
                      {error?.stack && (
                        <>
                          <Text size="sm" fw={600} mt="md" mb="xs">
                            Error Stack:
                          </Text>
                          <Code block style={{ fontSize: '11px', maxHeight: '200px', overflow: 'auto' }}>
                            {error.stack}
                          </Code>
                        </>
                      )}
                    </Paper>
                  </Collapse>
                </>
              )}

              <Group justify="center" mt="md">
                <Button
                  leftSection={<IconRefresh size={16} />}
                  onClick={this.handleReset}
                  size="md"
                >
                  Try Again
                </Button>
                <Button
                  variant="light"
                  onClick={this.handleReportError}
                  size="md"
                >
                  Report Error
                </Button>
              </Group>

              <Text size="xs" c="dimmed" ta="center">
                If this problem persists, please contact support at support@granttracker.com
              </Text>
            </Stack>
          </Paper>
        </Container>
      );
    }

    return children;
  }
}

/**
 * Higher-order component to wrap any component with an ErrorBoundary
 *
 * Usage:
 * ```tsx
 * const ProtectedComponent = withErrorBoundary(MyComponent, {
 *   boundaryName: 'MyComponent',
 * });
 * ```
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const ComponentWithErrorBoundary = (props: P) => {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${
    WrappedComponent.displayName || WrappedComponent.name || 'Component'
  })`;

  return ComponentWithErrorBoundary;
}
