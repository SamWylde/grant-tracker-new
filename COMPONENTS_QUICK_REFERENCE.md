# Components Quick Reference

## Pipeline Components (/src/components/pipeline/)

### PipelineHeader.tsx
- **Purpose:** Page header with title, description, and action buttons
- **Props:** view, filteredGrants, orgName, onImportClick
- **Features:** Import grants button, Export menu (Print/CSV)

### PipelineViewToggle.tsx
- **Purpose:** Toggle between board and list views
- **Props:** view, onViewChange, filteredCount, totalCount
- **Features:** Board/List segmented control, grant count display

### PipelineFilters.tsx
- **Purpose:** Filter and sort controls for grants
- **Props:** view, filters, onFiltersChange, sortBy, onSortChange, showMyGrantsOnly, onShowMyGrantsOnlyChange
- **Features:** Priority filter, Assignee filter, Sort dropdown, "My grants only" toggle

### BulkActionsToolbar.tsx
- **Purpose:** Bulk operations toolbar for list view
- **Props:** selectedCount, onDeselectAll, onBulkUpdateStatus, onBulkUpdatePriority, onBulkDelete, isOperating
- **Features:** Bulk status update, Bulk priority update, Bulk delete

### PipelineBoardView.tsx
- **Purpose:** Kanban board view with drag-and-drop
- **Props:** grantsByStage, draggedItem, onDragStart, onDragEnd, onDragOver, onDrop, onUpdateStatus, onArchive, onRemove
- **Features:** 7 pipeline stages, Drag-and-drop cards, Grant cards with deadlines, Move menu

### PipelineListView.tsx
- **Purpose:** List view of grants with selection
- **Props:** grants, selectedGrantIds, onToggleSelection, onSelectAll, onDeselectAll, onRemove, isLoading
- **Features:** Grant cards with checkboxes, Select all/deselect all, Sortable list

---

## Discover Components (/src/components/discover/)

### DiscoverHeader.tsx
- **Purpose:** Discover page header
- **Props:** savedGrantsCount, onQuickAddClick
- **Features:** Quick Add from URL button, View Saved button with count

### DiscoverFilters.tsx
- **Purpose:** Search and filter panel
- **Props:** keyword, category, agency, dueInDays, sortBy, statusPosted, statusForecasted, + change handlers
- **Features:** Keyword search, Category dropdown, Agency dropdown, Due date filter, Sort options, Status checkboxes

### DiscoverResultsHeader.tsx
- **Purpose:** Results count and controls
- **Props:** currentPage, itemsPerPage, resultsCount, totalCount, isLoading, onRefresh
- **Features:** Pagination info, Refresh button

### GrantCard.tsx
- **Purpose:** Individual grant card in search results
- **Props:** grant, isSaved, category, orgId, onViewDetails, onSaveToggle
- **Features:** Grant badges, Success score, Tags, Deadline display, Save/Details buttons

### GrantDetailsModal.tsx
- **Purpose:** Full grant details modal
- **Props:** opened, onClose, grantDetails, isLoading, error, selectedGrantId
- **Features:** Full description, Key dates, Funding info, Eligibility, External link

---

## Calendar Components (/src/components/calendar/)

### ICSFeedSection.tsx
- **Purpose:** ICS calendar feed management
- **Props:** icsUrl, isAdmin, onShowInstructions, onRegenerate
- **Features:** Copy ICS URL, Regenerate URL (admin only), Setup instructions link

### GoogleCalendarSection.tsx
- **Purpose:** Google Calendar OAuth integration
- **Props:** isConnected, isAdmin, orgId, userId, onDisconnect, isDisconnecting
- **Features:** Connection status, OAuth flow, Disconnect (admin only)

### IntegrationsSection.tsx
- **Purpose:** Third-party integrations management
- **Props:** slackIntegration, teamsIntegration, webhooks, isAdmin, + handlers
- **Features:** Slack integration, Teams integration, Custom webhooks CRUD

### CalendarModals.tsx
- **Purpose:** All calendar-related modals
- **Props:** Various modal states and handlers
- **Features:** Regenerate confirmation, Setup instructions, Teams connection, Webhook configuration

---

## Grant Detail Components (/src/components/grant-detail/)

### GrantHeader.tsx
- **Purpose:** Grant header with inline editors
- **Props:** title, agency, aln, priority, status, onUpdatePriority, onUpdateStatus
- **Features:** Inline priority selector, Inline status selector, Grant title and agency

### GrantDeadlineInfo.tsx
- **Purpose:** Deadline information box
- **Props:** closeDate, openDate
- **Features:** Color-coded deadline box, Days remaining, Overdue indicator, Open date

### GrantInfoSection.tsx
- **Purpose:** Grant details and actions
- **Props:** description, externalId, aln, externalSource, savedAt, stageUpdatedAt, onPrintBrief
- **Features:** Description, Grant ID/ALN/Source, Timestamps, Quick actions (View/Print)

---

## Usage Examples

### Pipeline Page
```tsx
import { PipelineHeader } from "../components/pipeline/PipelineHeader";
import { PipelineBoardView } from "../components/pipeline/PipelineBoardView";
import { PipelineListView } from "../components/pipeline/PipelineListView";

<PipelineHeader
  view={view}
  filteredGrants={filteredGrants}
  orgName={currentOrg?.name || 'Organization'}
  onImportClick={() => setImportWizardOpen(true)}
/>

{view === 'board' ? (
  <PipelineBoardView
    grantsByStage={grantsByStage}
    draggedItem={draggedItem}
    onDragStart={handleDragStart}
    onDragEnd={handleDragEnd}
    onDrop={handleDrop}
    // ... other props
  />
) : (
  <PipelineListView
    grants={sortedGrants}
    selectedGrantIds={selectedGrantIds}
    onToggleSelection={toggleGrantSelection}
    // ... other props
  />
)}
```

### Discover Page
```tsx
import { DiscoverHeader } from "../components/discover/DiscoverHeader";
import { DiscoverFilters } from "../components/discover/DiscoverFilters";
import { GrantCard } from "../components/discover/GrantCard";

<DiscoverHeader
  savedGrantsCount={savedGrants?.grants.length || 0}
  onQuickAddClick={() => setQuickAddModalOpen(true)}
/>

<DiscoverFilters
  keyword={keyword}
  onKeywordChange={setKeyword}
  category={category}
  onCategoryChange={setCategory}
  // ... other props
/>

{sortedGrants.map((grant) => (
  <GrantCard
    key={grant.id}
    grant={grant}
    isSaved={savedGrantIds.has(grant.id)}
    onViewDetails={handleViewDetails}
    onSaveToggle={handleSaveToggle}
  />
))}
```

### Calendar Page
```tsx
import { ICSFeedSection } from "../components/calendar/ICSFeedSection";
import { GoogleCalendarSection } from "../components/calendar/GoogleCalendarSection";
import { IntegrationsSection } from "../components/calendar/IntegrationsSection";

<ICSFeedSection
  icsUrl={icsUrl}
  isAdmin={isAdmin}
  onShowInstructions={() => setInstructionsModal(true)}
  onRegenerate={() => setRegenerateModal(true)}
/>

<GoogleCalendarSection
  isConnected={isGoogleConnected}
  isAdmin={isAdmin}
  orgId={currentOrg.id}
  userId={user.id}
  onDisconnect={() => disconnectMutation.mutate('google_calendar')}
  isDisconnecting={disconnectMutation.isPending}
/>
```

### Grant Detail Drawer
```tsx
import { GrantHeader } from "../components/grant-detail/GrantHeader";
import { GrantDeadlineInfo } from "../components/grant-detail/GrantDeadlineInfo";
import { GrantInfoSection } from "../components/grant-detail/GrantInfoSection";

<GrantHeader
  title={grant.title}
  agency={grant.agency}
  aln={grant.aln}
  priority={grant.priority}
  status={grant.status}
  onUpdatePriority={(priority) => updateMutation.mutate({ field: 'priority', value: priority })}
  onUpdateStatus={(status) => updateMutation.mutate({ field: 'status', value: status })}
/>

<GrantDeadlineInfo
  closeDate={grant.close_date}
  openDate={grant.open_date}
/>

<GrantInfoSection
  description={grant.description}
  externalId={grant.external_id}
  aln={grant.aln}
  externalSource={grant.external_source}
  savedAt={grant.saved_at}
  stageUpdatedAt={grant.stage_updated_at}
  onPrintBrief={handlePrintBrief}
/>
```
