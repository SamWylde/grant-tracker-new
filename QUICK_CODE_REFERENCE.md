# Quick Code Reference - Grant Pipeline & Details

## File Paths Quick Access

### Core Implementation Files

| Purpose | File Path | Lines | Key Export |
|---------|-----------|-------|------------|
| Pipeline Page | `/src/pages/PipelinePage.tsx` | 1,257 | `PipelinePage` component |
| Details Drawer | `/src/components/GrantDetailDrawer.tsx` | 719 | `GrantDetailDrawer` component |
| Data Fetching | `/src/hooks/useSavedGrants.ts` | 79 | `useSavedGrants()` hook |
| Grant Types | `/src/types/grants.ts` | 146 | `SavedGrant`, `GrantDetail` |
| DB Schema | `/src/lib/database.types.ts` | 305 | `Database.org_grants_saved` |

## Key Type Definitions

```typescript
// From /src/hooks/useSavedGrants.ts and /src/types/grants.ts

interface SavedGrant {
  id: string;
  org_id: string;
  user_id: string;
  external_id: string;
  external_source: string;
  title: string;
  agency: string | null;
  aln: string | null;
  open_date: string | null;
  close_date: string | null;
  description: string | null;
  status: string; // 'researching' | 'drafting' | 'submitted' | 'awarded' | 'archived'
  priority: string | null; // 'low' | 'medium' | 'high' | 'urgent'
  assigned_to: string | null;
  notes: string | null;
  saved_at: string;
  stage_updated_at: string | null;
  created_at: string;
}
```

## Key Constants

```typescript
// Pipeline stages (from PipelinePage.tsx line 62-67)
const PIPELINE_STAGES = [
  { id: "researching", label: "Researching", color: "blue" },
  { id: "drafting", label: "Drafting", color: "grape" },
  { id: "submitted", label: "Submitted", color: "orange" },
  { id: "awarded", label: "Awarded", color: "green" },
] as const;

// Priority colors (from GrantDetailDrawer.tsx line 76-81)
const PRIORITY_COLORS: Record<string, string> = {
  low: "gray",
  medium: "blue",
  high: "orange",
  urgent: "red",
};
```

## Important State Management Patterns

### In PipelinePage.tsx

```typescript
// View state
const [view, setView] = useState<'board' | 'list'>('board');

// Selected grant (opens drawer)
const [selectedGrant, setSelectedGrant] = useState<SavedGrant | null>(null);

// Filtering
const [filters, setFilters] = useState<GrantFilterValues>({
  priority: [],
  assignedTo: [],
});

// Bulk operations
const [selectedGrantIds, setSelectedGrantIds] = useState<Set<string>>(new Set());

// Data fetching
const { data, isLoading, error } = useSavedGrants();
```

### Deep Linking from URL
```typescript
// Lines 111-127 in PipelinePage.tsx
useEffect(() => {
  const grantId = searchParams.get('grant');
  const commentId = searchParams.get('comment');

  if (grantId && data) {
    const grant = data.grants.find((g: SavedGrant) => g.id === grantId);
    if (grant) {
      setSelectedGrant(grant);
      if (commentId) {
        setHighlightCommentId(commentId);
      }
      setSearchParams({});
    }
  }
}, [searchParams, data, setSearchParams]);
```

## API Mutations

### Update Status
```typescript
const updateStatusMutation = useMutation({
  mutationFn: async ({ grantId, newStatus }: { grantId: string; newStatus: PipelineStage }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await fetch(`/api/saved-status?id=${grantId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ status: newStatus }),
    });

    if (!response.ok) throw new Error('Failed to update');
    return response.json();
  },
  onMutate: async ({ grantId, newStatus }) => {
    // Optimistic update...
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["savedGrants"] });
  },
  onError: (error, _variables, context) => {
    // Rollback...
  },
});
```

### Delete Grant
```typescript
const removeFromPipelineMutation = useMutation({
  mutationFn: async (grantId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`/api/saved?id=${grantId}`, {
      method: "DELETE",
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to remove grant');
    return response.json();
  },
  onMutate: async (grantId) => {
    // Optimistic remove from list...
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["savedGrants"] });
  },
});
```

## Board View Rendering

```typescript
// Lines 802-1038 in PipelinePage.tsx
{PIPELINE_STAGES.map((stage) => (
  <Box
    key={stage.id}
    style={{ minWidth: 280, maxWidth: 280 }}
    onDragOver={handleDragOver}
    onDrop={(e) => handleDrop(e, stage.id)}
  >
    {/* Column Header */}
    <Card padding="md" mb="md" withBorder bg={`var(--mantine-color-${stage.color}-0)`}>
      <Group justify="space-between">
        <Text fw={600} size="lg">{stage.label}</Text>
        <Badge color={stage.color} variant="filled">
          {grantsByStage[stage.id].length}
        </Badge>
      </Group>
    </Card>

    {/* Grant Cards */}
    <Stack gap="sm">
      {grantsByStage[stage.id].map((grant) => (
        <Card
          key={grant.id}
          padding="md"
          withBorder
          draggable
          onDragStart={(e) => handleDragStart(e, grant.id)}
          onDragEnd={handleDragEnd}
          onClick={() => setSelectedGrant(grant)}
        >
          {/* Card content */}
        </Card>
      ))}
    </Stack>
  </Box>
))}
```

## Details Drawer Tabs Structure

```typescript
// Lines 575-599 in GrantDetailDrawer.tsx
<Tabs value={activeTab} onChange={setActiveTab}>
  <Tabs.List>
    <Tabs.Tab value="tasks">Tasks</Tabs.Tab>
    <Tabs.Tab value="documents" leftSection={<IconFile size={14} />}>
      Documents
    </Tabs.Tab>
    <Tabs.Tab value="budget" leftSection={<IconCurrencyDollar size={14} />}>
      Budget
    </Tabs.Tab>
    <Tabs.Tab value="payments" leftSection={<IconReceipt size={14} />}>
      Payments
    </Tabs.Tab>
    <Tabs.Tab value="compliance" leftSection={<IconShieldCheck size={14} />}>
      Compliance
    </Tabs.Tab>
    <Tabs.Tab value="ai-summary" leftSection={<IconSparkles size={14} />}>
      AI Summary
    </Tabs.Tab>
    <Tabs.Tab value="notes">Notes</Tabs.Tab>
    <Tabs.Tab value="comments">
      Comments
      {commentsData?.total_count ? ` (${commentsData.total_count})` : ''}
    </Tabs.Tab>
  </Tabs.List>

  <Tabs.Panel value="tasks" pt="md">
    <TaskList grantId={grant.id} orgId={grant.org_id} />
  </Tabs.Panel>
  {/* ... other panels ... */}
</Tabs>
```

## Drag and Drop Handlers

```typescript
// Lines 518-538 in PipelinePage.tsx
const handleDragStart = (e: React.DragEvent, grantId: string) => {
  setDraggedItem(grantId);
  e.dataTransfer.effectAllowed = "move";
};

const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
};

const handleDrop = (e: React.DragEvent, newStatus: PipelineStage) => {
  e.preventDefault();
  if (draggedItem) {
    updateStatusMutation.mutate({ grantId: draggedItem, newStatus });
    setDraggedItem(null);
  }
};

const handleDragEnd = () => {
  setDraggedItem(null);
};
```

## Filtering Logic

```typescript
// Lines 469-489 in PipelinePage.tsx
const filteredGrants = data?.grants ? data.grants.filter((grant) => {
  // Exclude archived grants
  if (grant.status === "archived") return false;

  // Filter by priority
  if (filters.priority && filters.priority.length > 0) {
    if (!grant.priority || !filters.priority.includes(grant.priority)) return false;
  }

  // Filter by assignee
  if (filters.assignedTo && filters.assignedTo.length > 0) {
    if (!grant.assigned_to || !filters.assignedTo.includes(grant.assigned_to)) return false;
  }

  // Show only user's grants if toggle is enabled
  if (showMyGrantsOnly && user) {
    if (grant.assigned_to !== user.id) return false;
  }

  return true;
}) : [];
```

## Sorting Logic

```typescript
// Lines 491-509 in PipelinePage.tsx
const sortedAndFilteredGrants = [...filteredGrants].sort((a, b) => {
  switch (sortBy) {
    case "deadline-asc":
      if (!a.close_date) return 1;
      if (!b.close_date) return -1;
      return new Date(a.close_date).getTime() - new Date(b.close_date).getTime();
    case "deadline-desc":
      if (!a.close_date) return 1;
      if (!b.close_date) return -1;
      return new Date(b.close_date).getTime() - new Date(a.close_date).getTime();
    case "saved-newest":
      return new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime();
    case "saved-oldest":
      return new Date(a.saved_at).getTime() - new Date(b.saved_at).getTime();
    default:
      return 0;
  }
});
```

## Using useSavedGrants Hook

```typescript
// From /src/hooks/useSavedGrants.ts
import { useSavedGrants } from '../hooks/useSavedGrants';

export function MyComponent() {
  const { data, isLoading, error } = useSavedGrants();
  
  // Access grants
  if (isLoading) return <Loader />;
  if (error) return <Text c="red">{error.message}</Text>;
  
  return (
    <div>
      {data?.grants.map((grant) => (
        <div key={grant.id}>{grant.title}</div>
      ))}
    </div>
  );
}
```

## Common Import Patterns

```typescript
// UI Components
import { Box, Container, Stack, Group, Title, Text, Badge, Card, Drawer, Tabs, Button } from "@mantine/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

// App-specific
import { useOrganization } from "../contexts/OrganizationContext";
import { useAuth } from "../contexts/AuthContext";
import { useSavedGrants } from "../hooks/useSavedGrants";
import { supabase } from "../lib/supabase";

// Utils
import dayjs from "dayjs";
import { stripHtml } from "../utils/htmlUtils";
import { notifications } from "@mantine/notifications";
```

## Testing/Debugging Tips

```typescript
// Console logging pattern (used in PipelinePage)
console.log('[PipelinePage] PATCH request to:', url, 'with status:', newStatus);
console.log('[PipelinePage] Response status:', response.status, response.statusText);

// Accessing grant ID for clipboard
grant.external_id  // This is the Grants.gov opportunity number

// Checking deadline urgency
const daysUntilClose = grant.close_date
  ? dayjs(grant.close_date).diff(dayjs(), "day")
  : null;
const isClosingSoon = daysUntilClose !== null && daysUntilClose <= 30;
const isOverdue = daysUntilClose !== null && daysUntilClose < 0;

// URL parameters
const grantId = searchParams.get('grant');
const commentId = searchParams.get('comment');
const viewMode = searchParams.get('view');
```

## Key Helper Functions Used

```typescript
// HTML stripping (from /src/utils/htmlUtils.ts)
import { stripHtml } from "../utils/htmlUtils";
const cleanDescription = stripHtml(grant.description);

// Printing (from /src/utils/printGrant.ts)
import { printGrantBrief } from "../utils/printGrant";
printGrantBrief(grant, tasksData?.tasks);

// Batch printing & CSV export (from /src/utils/printBoardPacket.ts)
import { printBoardPacket, exportGrantsToCSV } from "../utils/printBoardPacket";
printBoardPacket(filteredGrants, { title: 'Pipeline Board Packet' });
exportGrantsToCSV(filteredGrants, 'Organization Name');
```

## Component Props Reference

```typescript
// GrantDetailDrawer Props
interface GrantDetailDrawerProps {
  grant: Grant | null;
  opened: boolean;
  onClose: () => void;
  highlightCommentId?: string | null;
}

// SaveToPipelineModal Props
interface SaveToPipelineModalProps {
  opened: boolean;
  onClose: () => void;
  onSave: (data: SaveToPipelineData) => Promise<void>;
  grantTitle: string;
  saving?: boolean;
}

// GrantDetailDrawer Grant Type
interface Grant {
  id: string;
  external_id: string;
  external_source: string;
  title: string;
  agency: string | null;
  aln: string | null;
  open_date: string | null;
  close_date: string | null;
  description: string | null;
  status: string;
  priority: string | null;
  notes: string | null;
  org_id: string;
  user_id: string;
  assigned_to: string | null;
  saved_at: string;
  stage_updated_at: string | null;
  created_at: string;
}
```

## Router Configuration

```typescript
// From /src/App.tsx lines 83-90
<Route path="/discover" element={<ProtectedRoute><DiscoverPage /></ProtectedRoute>} />
<Route path="/saved" element={<Navigate to="/pipeline?view=list" replace />} />
<Route path="/pipeline" element={<ProtectedRoute><PipelinePage /></ProtectedRoute>} />
<Route path="/metrics" element={<ProtectedRoute><MetricsPage /></ProtectedRoute>} />
<Route path="/activity" element={<ProtectedRoute><ActivityPage /></ProtectedRoute>} />
<Route path="/import/granthub" element={<ProtectedRoute><GrantHubImportPage /></ProtectedRoute>} />
<Route path="/onboarding/eligibility" element={<ProtectedRoute><EligibilityWizardPage /></ProtectedRoute>} />
```

---

Use this reference guide while developing! Keep the full analysis docs open for detailed context.
