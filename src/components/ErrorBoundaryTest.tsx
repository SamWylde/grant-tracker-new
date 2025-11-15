import { useState } from 'react';
import { Button, Stack, Title, Text, Paper } from '@mantine/core';
import { IconBug } from '@tabler/icons-react';
import { ErrorBoundary } from './ErrorBoundary';

/**
 * ErrorBoundaryTest Component
 *
 * This component is used for testing Error Boundary functionality.
 * It provides buttons to trigger different types of errors to verify
 * that the Error Boundary correctly catches and displays them.
 *
 * Usage:
 * Import this component in a page and render it to test error handling.
 *
 * Example:
 * ```tsx
 * import { ErrorBoundaryTest } from '../components/ErrorBoundaryTest';
 *
 * function TestPage() {
 *   return <ErrorBoundaryTest />;
 * }
 * ```
 */

// Component that throws an error when render error is triggered
function ThrowErrorComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test Error: This is a simulated render error!');
  }
  return <Text c="green">No error - component rendered successfully</Text>;
}

export function ErrorBoundaryTest() {
  const [throwError, setThrowError] = useState(false);

  return (
    <Stack gap="lg" p="xl">
      <Title order={2}>Error Boundary Testing</Title>

      <Paper p="md" withBorder>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Click the button below to trigger an error and test the Error Boundary.
            The error will be caught and a fallback UI will be displayed with a retry button.
          </Text>

          <ErrorBoundary
            boundaryName="TestErrorBoundary"
            showDetails={true}
            onReset={() => {
              console.log('Error boundary reset triggered');
              setThrowError(false);
            }}
          >
            <Stack gap="sm">
              <ThrowErrorComponent shouldThrow={throwError} />

              <Button
                leftSection={<IconBug size={16} />}
                onClick={() => setThrowError(true)}
                color="red"
                variant="light"
              >
                Trigger Render Error
              </Button>
            </Stack>
          </ErrorBoundary>
        </Stack>
      </Paper>

      <Paper p="md" withBorder bg="gray.0">
        <Stack gap="xs">
          <Text size="sm" fw={600}>How to test:</Text>
          <Text size="sm">1. Click the "Trigger Render Error" button</Text>
          <Text size="sm">2. Observe the error boundary fallback UI</Text>
          <Text size="sm">3. Click "Try Again" to reset the error boundary</Text>
          <Text size="sm">4. Check the browser console for error logs</Text>
        </Stack>
      </Paper>
    </Stack>
  );
}
