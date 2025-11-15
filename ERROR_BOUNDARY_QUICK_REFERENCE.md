# Error Boundary Quick Reference

## Quick Start

### Import and Use

```typescript
import { ErrorBoundary } from './components/ErrorBoundary';

// Basic usage
<ErrorBoundary boundaryName="MyComponent">
  <MyComponent />
</ErrorBoundary>
```

## Common Patterns

### Page-Level Protection

```typescript
<Route
  path="/my-page"
  element={
    <ProtectedRoute>
      <ErrorBoundary boundaryName="MyPage">
        <MyPage />
      </ErrorBoundary>
    </ProtectedRoute>
  }
/>
```

### Modal/Drawer Protection

```typescript
export function MyModal({ opened, onClose }) {
  return (
    <Modal opened={opened} onClose={onClose}>
      <ErrorBoundary boundaryName="MyModal">
        <Stack>
          {/* Modal content */}
        </Stack>
      </ErrorBoundary>
    </Modal>
  );
}
```

### Custom Error Handler

```typescript
<ErrorBoundary
  boundaryName="CriticalSection"
  onError={(error, errorInfo) => {
    console.error('Custom error handler:', error);
    // Send to analytics, etc.
  }}
  onReset={() => {
    console.log('User clicked retry');
    // Reset component state
  }}
>
  <MyComponent />
</ErrorBoundary>
```

### Higher-Order Component

```typescript
import { withErrorBoundary } from './components/ErrorBoundary';

const MyComponent = () => {
  // Component code
};

export default withErrorBoundary(MyComponent, {
  boundaryName: 'MyComponent',
});
```

## Testing

### Using the Test Component

```typescript
import { ErrorBoundaryTest } from './components/ErrorBoundaryTest';

function TestPage() {
  return <ErrorBoundaryTest />;
}
```

### Triggering Errors Manually

```typescript
function ComponentWithError() {
  const [shouldError, setShouldError] = useState(false);

  if (shouldError) {
    throw new Error('Test error');
  }

  return (
    <Button onClick={() => setShouldError(true)}>
      Trigger Error
    </Button>
  );
}

// Wrap with error boundary
<ErrorBoundary boundaryName="Test">
  <ComponentWithError />
</ErrorBoundary>
```

## Best Practices

1. **Always name your boundaries**: Use descriptive `boundaryName` props for easier debugging
2. **Wrap at appropriate levels**: Don't wrap too broadly or too narrowly
3. **Provide custom reset handlers**: Help users recover by resetting state
4. **Log errors properly**: Use the `onError` callback for analytics
5. **Test error scenarios**: Use the ErrorBoundaryTest component

## Error Boundary Locations

### Current Implementation

- **App-level**: Wraps entire application
- **Router-level**: Wraps all routes
- **Page-level**: Each major page has its own boundary
- **Component-level**: Critical modals and drawers

### Where to Add New Boundaries

Add error boundaries when:
- Creating new pages
- Building complex modals/drawers
- Integrating third-party components
- Working with async data fetching
- Implementing experimental features

## Troubleshooting

### Error Boundary Not Catching Errors

Error boundaries don't catch:
- Errors in event handlers (use try/catch)
- Async errors (use try/catch in async functions)
- Server-side rendering errors
- Errors in the error boundary itself

### Example: Event Handler Errors

```typescript
// ❌ Not caught by error boundary
<Button onClick={() => {
  throw new Error('This will not be caught');
}}>
  Click Me
</Button>

// ✅ Handle with try/catch
<Button onClick={async () => {
  try {
    await riskyOperation();
  } catch (error) {
    console.error(error);
    notifications.show({
      title: 'Error',
      message: error.message,
      color: 'red',
    });
  }
}}>
  Click Me
</Button>
```

## Future Sentry Integration

```typescript
// In ErrorBoundary.tsx componentDidCatch:
import * as Sentry from "@sentry/react";

componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  Sentry.captureException(error, {
    contexts: {
      react: {
        componentStack: errorInfo.componentStack,
      },
    },
    tags: {
      boundaryName: this.props.boundaryName || 'Unknown',
    },
  });
}
```

## Related Files

- `/home/user/grant-tracker-new/src/components/ErrorBoundary.tsx` - Main component
- `/home/user/grant-tracker-new/src/components/ErrorBoundaryTest.tsx` - Test component
- `/home/user/grant-tracker-new/src/App.tsx` - App-level implementation
- `/home/user/grant-tracker-new/ERROR_BOUNDARY_IMPLEMENTATION.md` - Full documentation
