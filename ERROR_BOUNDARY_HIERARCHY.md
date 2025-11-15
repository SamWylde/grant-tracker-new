# Error Boundary Hierarchy Diagram

## Visual Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Level 1: Application Boundary (boundaryName: "App")            │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ MantineProvider                                             │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ QueryClientProvider                                     │ │ │
│ │ │ ┌─────────────────────────────────────────────────────┐ │ │ │
│ │ │ │ AuthProvider                                        │ │ │ │
│ │ │ │ ┌─────────────────────────────────────────────────┐ │ │ │ │
│ │ │ │ │ OrganizationProvider                            │ │ │ │ │
│ │ │ │ │ ┌─────────────────────────────────────────────┐ │ │ │ │ │
│ │ │ │ │ │ BrowserRouter                               │ │ │ │ │ │
│ │ │ │ │ │ ┌─────────────────────────────────────────┐ │ │ │ │ │ │
│ │ │ │ │ │ │ Level 2: Router Boundary (Router)      │ │ │ │ │ │ │
│ │ │ │ │ │ │ ┌─────────────────────────────────────┐ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │ Routes                              │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │                                     │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │ Level 3: Page Boundaries           │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │ ┌─────────────────────────────────┐ │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │ │ DiscoverPage (DiscoverPage)   │ │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │ │   ├─ Level 4: Modals          │ │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │ │   │  └─ SaveToPipelineModal   │ │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │ │   └─ QuickSearchModal         │ │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │ └─────────────────────────────────┘ │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │ ┌─────────────────────────────────┐ │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │ │ PipelinePage (PipelinePage)   │ │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │ └─────────────────────────────────┘ │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │ ┌─────────────────────────────────┐ │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │ │ GrantDetailPage               │ │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │ │   └─ Level 4: Drawers         │ │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │ │      └─ GrantDetailDrawer     │ │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │ └─────────────────────────────────┘ │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │ ┌─────────────────────────────────┐ │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │ │ FundersPage (FundersPage)     │ │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │ │   └─ FunderDetailDrawer       │ │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │ └─────────────────────────────────┘ │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │ ┌─────────────────────────────────┐ │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │ │ MetricsPage (MetricsPage)     │ │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │ └─────────────────────────────────┘ │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │ ┌─────────────────────────────────┐ │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │ │ ... 17 more pages ...         │ │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │ └─────────────────────────────────┘ │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ └─────────────────────────────────────┘ │ │ │ │ │ │ │
│ │ │ │ │ │ └─────────────────────────────────────────┘ │ │ │ │ │ │
│ │ │ │ │ └─────────────────────────────────────────────┘ │ │ │ │ │
│ │ │ │ └─────────────────────────────────────────────────┘ │ │ │ │
│ │ │ └─────────────────────────────────────────────────────┘ │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Error Propagation Flow

When an error occurs, it propagates upward through the boundary hierarchy:

```
Error Occurs
    │
    ↓
Level 4: Component Boundary (if present)
    │ catches? ─→ YES ─→ Display component-level fallback UI
    │
    ↓ NO
Level 3: Page Boundary
    │ catches? ─→ YES ─→ Display page-level fallback UI
    │
    ↓ NO
Level 2: Router Boundary
    │ catches? ─→ YES ─→ Display router-level fallback UI
    │
    ↓ NO
Level 1: App Boundary
    │ catches? ─→ YES ─→ Display app-level fallback UI
    │
    ↓ NO
Unhandled Error (Browser Error Screen)
```

## Boundary Coverage Map

### Level 1: Application (1 boundary)
```
App.tsx
└─ ErrorBoundary (boundaryName: "App")
```

### Level 2: Router (1 boundary)
```
App.tsx > BrowserRouter
└─ ErrorBoundary (boundaryName: "Router")
   └─ Routes
```

### Level 3: Pages (22 boundaries)

#### Core Feature Pages (10)
```
/discover          → ErrorBoundary (boundaryName: "DiscoverPage")
/pipeline          → ErrorBoundary (boundaryName: "PipelinePage")
/pipeline/grant/:id → ErrorBoundary (boundaryName: "GrantDetailPage")
/funders           → ErrorBoundary (boundaryName: "FundersPage")
/metrics           → ErrorBoundary (boundaryName: "MetricsPage")
/analytics         → ErrorBoundary (boundaryName: "AnalyticsPage")
/activity          → ErrorBoundary (boundaryName: "ActivityPage")
/import/granthub   → ErrorBoundary (boundaryName: "GrantHubImportPage")
/onboarding/eligibility → ErrorBoundary (boundaryName: "EligibilityWizardPage")
/approvals         → ErrorBoundary (boundaryName: "ApprovalsPage")
```

#### Settings Pages (13)
```
/settings/profile      → ErrorBoundary (boundaryName: "ProfilePage")
/settings/org          → ErrorBoundary (boundaryName: "OrganizationPage")
/settings/team         → ErrorBoundary (boundaryName: "TeamPage")
/settings/team/performance → ErrorBoundary (boundaryName: "TeamPerformancePage")
/settings/notifications → ErrorBoundary (boundaryName: "NotificationsPage")
/settings/alerts       → ErrorBoundary (boundaryName: "AlertsPage")
/settings/calendar     → ErrorBoundary (boundaryName: "CalendarPage")
/settings/billing      → ErrorBoundary (boundaryName: "BillingPage")
/settings/reports      → ErrorBoundary (boundaryName: "ReportsPage")
/settings/workflows    → ErrorBoundary (boundaryName: "ApprovalWorkflowsPage")
/settings/privacy      → ErrorBoundary (boundaryName: "PrivacyDataPage")
/settings/admin        → ErrorBoundary (boundaryName: "AdminPage")
/settings/danger       → ErrorBoundary (boundaryName: "DangerZonePage")
```

### Level 4: Components (5 boundaries)

#### Drawers (2)
```
GrantDetailDrawer.tsx
└─ ErrorBoundary (boundaryName: "GrantDetailDrawer")
   └─ Drawer content (tasks, budget, compliance, comments, etc.)

FunderDetailDrawer.tsx
└─ ErrorBoundary (boundaryName: "FunderDetailDrawer")
   └─ Drawer content (contacts, grants, interactions)
```

#### Modals (3)
```
SaveToPipelineModal.tsx
└─ ErrorBoundary (boundaryName: "SaveToPipelineModal")
   └─ Modal content (stage, priority, assignee selection)

QuickSearchModal.tsx
└─ ErrorBoundary (boundaryName: "QuickSearchModal")
   └─ Modal content (search input, recent searches)

QuickAddGrantModal.tsx
└─ ErrorBoundary (boundaryName: "QuickAddGrantModal")
   └─ Modal content (URL input, grant ID extraction)
```

## Error Isolation Examples

### Example 1: Drawer Error (Isolated)
```
User opens Grant Detail Drawer
    ↓
Error occurs in DocumentsTab component
    ↓
Caught by GrantDetailDrawer boundary
    ↓
Result: Drawer shows fallback UI, page remains functional
User can: Close drawer, work with other features
```

### Example 2: Page Error (Isolated)
```
User navigates to /metrics
    ↓
Error occurs in chart rendering
    ↓
Caught by MetricsPage boundary
    ↓
Result: Page shows fallback UI, app header remains functional
User can: Navigate to other pages, retry metrics page
```

### Example 3: App Error (Catastrophic)
```
Error in AuthProvider or core context
    ↓
Not caught by any lower boundary
    ↓
Caught by App boundary
    ↓
Result: Full app fallback UI shown
User can: Retry entire app, see error details, contact support
```

## Boundary Naming Convention

All boundaries follow a consistent naming pattern:

- **Pattern**: `{ComponentName}` or `{FeatureName}`
- **Examples**:
  - Page: `"DiscoverPage"`, `"PipelinePage"`
  - Component: `"GrantDetailDrawer"`, `"SaveToPipelineModal"`
  - System: `"App"`, `"Router"`

This naming helps with:
- Debugging (console logs show exact boundary)
- Error tracking (Sentry tags by boundary name)
- Monitoring (analytics by component)

## Console Log Format

When an error is caught, it appears in console as:

```
🚨 Error Boundary Caught Error: DiscoverPage
  Error: TypeError: Cannot read property 'map' of undefined
  Error Info: {componentStack: "..."}
  Component Stack:
    at GrantCard (http://...)
    at Grid (http://...)
    at DiscoverPage (http://...)
```

## Testing Each Level

### Level 1: App Boundary
```typescript
// Simulate by throwing error in AuthProvider or OrganizationProvider
throw new Error('Critical app error');
```

### Level 2: Router Boundary
```typescript
// Simulate by throwing error during route rendering
// (Hard to trigger, mostly for routing library errors)
```

### Level 3: Page Boundary
```typescript
// Add ErrorBoundaryTest component to any page
import { ErrorBoundaryTest } from './components/ErrorBoundaryTest';
// Render and click "Trigger Render Error"
```

### Level 4: Component Boundary
```typescript
// Simulate error in drawer/modal content
// Add throw new Error() in component render
```

## Benefits of This Hierarchy

1. **Granular Isolation**: Errors contained at appropriate level
2. **User Experience**: Maximum functionality preserved during errors
3. **Developer Experience**: Clear error sources from boundary names
4. **Scalability**: Easy to add new boundaries as app grows
5. **Monitoring**: Ready for production error tracking integration
