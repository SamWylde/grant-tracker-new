# Grant Tracker Pipeline & Details Page Analysis

## 1. CURRENT PIPELINE PAGE IMPLEMENTATION

### Location
- **File**: `/home/user/grant-tracker-new/src/pages/PipelinePage.tsx`
- **Routes**: 
  - `/pipeline` (main route)
  - `/saved` (redirects to `/pipeline?view=list`)

### Pipeline Stages
The page displays grants organized in 4 pipeline stages:
- **Researching** (blue)
- **Drafting** (grape) 
- **Submitted** (orange)
- **Awarded** (green)

### Display Modes
The pipeline supports two view modes (toggled via button):

#### Board View (Kanban)
- Horizontal scrollable columns for each stage
- Individual grant cards in each column
- Drag-and-drop between stages to change status
- Card size: 280px width

#### List View
- Vertical list of all grants (sorted, not grouped by stage)
- More detailed layout per grant
- Bulk selection and operations
- Sort options: deadline (asc/desc), saved date (newest/oldest)

### Grant Card Display (Board View)
Each card shows:
```
[Drag Handle]              [Priority Badge]
[ALN Badge] [Success Score Badge]
[Tag Badges] (max 3)
Grant Title (2 lines max)
Agency Name
[Copy-to-clipboard] Grant ID
Description preview (2 lines, 150 chars max)
[Calendar Icon] Deadline (color-coded if urgent/overdue)
[Days remaining badge]
[External link] [Menu with move/archive/delete options]
```

### Grant Card Display (List View)
Each card shows:
```
[Checkbox]  [Status Badge] [Priority] [ALN] [Success Score] [Tag Badges (max 4)]
[External Link Icon] Grant Title
Agency Name
Description preview (2 lines, 200 chars max)
[Delete Button]
─────────────────────────────────────
[Posted Date]           [Closes Date with days remaining/overdue badge]
```

### Current Features
- **View Toggle**: Board ↔ List views with URL persistence (`?view=list`)
- **Filtering**: 
  - By priority (low/medium/high/urgent)
  - By assignee
  - Show "My grants only" toggle
- **Sorting**: Deadline asc/desc, saved date newest/oldest
- **Drag & Drop**: Move grants between stages (updates status immediately)
- **Bulk Operations** (list view only):
  - Select multiple grants
  - Bulk update status
  - Bulk update priority
  - Bulk delete
- **Import/Export**:
  - Import grants modal
  - Export to CSV
  - Print board packet/report
- **Mutations** (optimistic updates with rollback):
  - `updateStatusMutation`: Change grant stage
  - `archiveGrantMutation`: Archive grant (status: "archived")
  - `removeFromPipelineMutation`: Delete grant permanently

### URL Parameters
- `?view=list` - Switch to list view (default is board)
- `?grant=<grantId>` - Deep link to open grant details
- `?comment=<commentId>` - Deep link + highlight specific comment

---

## 2. CURRENT DETAILS PAGE IMPLEMENTATION

### Location & Opening
- **Component**: `GrantDetailDrawer` (side panel drawer)
- **File**: `/home/user/grant-tracker-new/src/components/GrantDetailDrawer.tsx`
- **Size**: Extra large (xl) right-side drawer
- **Trigger**: Click any grant card on pipeline page

### Header Section
Shows editable inline selectors:
- **Priority**: Low, Medium, High, Urgent (with color-coded background)
- **Status**: Researching, Drafting, Submitted, Awarded (blue background)
- **Title**: Grant title as main heading

### Basic Information Section
```
[Building Icon] Agency Name
ALN: <aln-code>
```

### Deadline Section (Color-coded box)
```
[Calendar Icon]
Deadline: [Date formatted as "MMM D, YYYY"]
[Subtext showing days remaining, color-coded]

[Clock Icon] (if open_date exists)
Open Date: [Date]
```

### Description Section
- Full description with HTML stripped
- Gray background box

### Grant Information Section (Expandable details)
Displays in key-value format:
- Grant ID (clickable to copy)
- Assistance Listing Number (ALN) if available
- Source (external_source, typically "Grants.gov")
- Added to Pipeline (saved_at timestamp)
- Last Stage Change (stage_updated_at if available)

### Quick Action Buttons
- "View on Grants.gov" - Opens external link to grants.gov
- "Print Brief" - Prints grant details document

### Tabbed Sections (Below divider)

#### Tasks Tab (Default)
- List of associated tasks
- Component: `TaskList`
- Lets users track action items for the grant

#### Documents Tab
- Upload/manage grant-related documents
- Component: `DocumentsTab`

#### Budget Tab
- Track budgeting information
- Component: `BudgetTab`
- Icon: Dollar sign

#### Payments Tab
- Payment schedule management
- Component: `PaymentScheduleTab`
- Icon: Receipt

#### Compliance Tab
- Compliance tracking
- Component: `ComplianceTab`
- Icon: Shield check

#### AI Summary Tab
- AI-generated summary of grant
- Component: `AISummaryTab`
- Icon: Sparkles

#### Notes Tab
- Edit/view personal notes about grant
- Features:
  - Mention team members with @mentions
  - Mentioned users get in-app notifications
  - Saves to database
  - Edit/view modes

#### Comments Tab
- Team discussions on grants
- Features:
  - Add comments with @mentions
  - Reply to comments
  - Edit/delete comments
  - Deep linking to specific comments
  - Comment count badge on tab
  - Highlight specific comment (from URL parameter)

---

## 3. DATABASE SCHEMA FOR GRANTS

### Table: `org_grants_saved`

```typescript
{
  id: string;                    // Internal unique ID
  org_id: string;                // Organization ID (foreign key)
  user_id: string;               // User who saved it
  external_source: string;       // "Grants.gov" or other source
  external_id: string;           // Grants.gov opportunity number
  title: string;                 // Grant title
  agency: string | null;         // Funding agency name
  aln: string | null;            // Assistance Listing Number
  open_date: string | null;      // Grant opens (ISO 8601 date)
  close_date: string | null;     // Grant closes/deadline (ISO 8601 date)
  description: string | null;    // Full grant description (may have HTML)
  status: string;                // Pipeline stage: researching | drafting | submitted | awarded | archived
  priority: string | null;       // Priority: low | medium | high | urgent
  assigned_to: string | null;    // User ID of assigned person
  notes: string | null;          // User's internal notes
  saved_at: string;              // When grant was saved to pipeline (ISO 8601)
  stage_updated_at: string | null; // When status was last changed
  created_at: string;            // Database record creation timestamp
}
```

### Related Tables Used in Details View
- `tasks` - Tasks associated with grants
- `documents` - Documents for grants
- `budget_items` - Budget tracking
- `payment_schedule_items` - Payment tracking
- `compliance_items` - Compliance tracking
- `in_app_notifications` - When mentions happen
- `grant_comments` - Comments on grants

---

## 4. DATA FLOW & ROUTING

### How Clicking a Card Navigates to Details

```
1. User clicks grant card on PipelinePage
   ↓
2. onClick handler: setSelectedGrant(grant)
   ↓
3. State updates selectedGrant from SavedGrant type
   ↓
4. GrantDetailDrawer checks if opened={!!selectedGrant}
   ↓
5. Drawer opens with grant data passed as prop
   ↓
6. User closes drawer: setSelectedGrant(null)
```

### Deep Linking
The pipeline page accepts URL parameters for direct access:
```
/pipeline?grant=123abc&comment=456def
     ↓
Page loads → useEffect checks URL params
     ↓
If grant ID found in data → Auto-open drawer + highlight comment
     ↓
Clear URL params after opening
```

### Data Fetching Flow
```
useSavedGrants() hook
    ↓
GET /api/saved?org_id=${currentOrg.id}
    ↓
Returns: { grants: SavedGrant[] }
    ↓
Cached in React Query with 30-second stale time
    ↓
PipelinePage filters/sorts/groups this data
    ↓
When grant is clicked, grant object passed to GrantDetailDrawer
    ↓
Drawer fetches related data (tasks, comments, etc.) separately
```

---

## 5. AVAILABLE GRANT DATA FIELDS

### Always Available (from SavedGrant)
- `id` - Internal database ID
- `title` - Grant name
- `org_id` - Organization
- `user_id` - User who saved it
- `external_id` - Grants.gov opportunity number (for linking)
- `external_source` - Source system
- `status` - Current pipeline stage
- `saved_at` - When saved
- `created_at` - When record created

### Often Available (nullable fields)
- `agency` - Funding agency name
- `aln` - Assistance Listing Number
- `open_date` - When grant opens
- `close_date` - Deadline date
- `description` - Full description
- `priority` - User-set priority level
- `assigned_to` - Assigned team member
- `notes` - User notes
- `stage_updated_at` - Last status change timestamp

### Related Data (via separate API calls)
- `tasks` - Associated action items
- `comments` - Team discussion
- `documents` - Uploaded files
- `budget_items` - Financial tracking
- `payment_schedule` - Payment milestones
- `compliance_items` - Compliance requirements
- `tags` - User tags/categories
- `success_score` - AI-calculated fit score

---

## 6. EXISTING COMPONENTS & UTILITIES

### Grant-Related Components
```
/src/components/
├── GrantDetailDrawer.tsx      ← Main details panel
├── GrantFilters.tsx           ← Filter UI
├── GrantTagBadges.tsx         ← Tag display
├── SuccessScoreBadge.tsx      ← Fit score badge
├── SaveToPipelineModal.tsx    ← Save dialog
├── TaskList.tsx               ← Tasks tab
├── DocumentsTab.tsx           ← Documents tab
├── BudgetTab.tsx              ← Budget tab
├── PaymentScheduleTab.tsx     ← Payments tab
├── ComplianceTab.tsx          ← Compliance tab
├── AISummaryTab.tsx           ← AI Summary tab
├── CommentThread.tsx          ← Comments rendering
├── CommentInput.tsx           ← Comment input
└── MentionTextarea.tsx        ← @mention support
```

### Utilities
```
/src/utils/
├── printGrant.ts              ← Grant brief printing
├── printBoardPacket.ts        ← Batch printing
├── htmlUtils.ts               ← stripHtml() for descriptions
├── fieldMapper.ts             ← Field mapping utilities
├── csvUtils.ts                ← CSV export
└── ...
```

### Hooks
```
/src/hooks/
├── useSavedGrants.ts          ← Fetch saved grants
├── useSavedGrantIds.ts        ← Grant ID Set
├── usePermission.ts           ← Role checks
└── useAIFeatures.ts           ← AI feature flags
```

### Types
```
/src/types/grants.ts
- GrantsGovOpportunity         ← API response type
- NormalizedGrant              ← Normalized data
- SavedGrant                   ← Database type  
- GrantDetail                  ← Detailed view type
- SearchResponse               ← Search results
```

---

## 7. SUGGESTED ENHANCEMENTS FOR DETAILS PAGE

### Currently Missing but Could Be Added
1. **Grant Analysis Section**
   - Eligibility checklist (from organization profile)
   - Fit score explanation
   - Pros/cons analysis
   - Estimated effort to apply

2. **Timeline/Activity View**
   - When was grant found/saved
   - When status changed (with who made change)
   - All activities (comments, tasks, changes) in chronological order
   - Export timeline

3. **Document Analysis**
   - Preview uploaded documents
   - Extract key requirements/terms
   - Generate checklist from documents

4. **Financial Projections**
   - Expected funding amount range (if available from Grants.gov)
   - Budget template generator
   - Return on investment calculator

5. **Team Collaboration**
   - Show who's assigned (already there)
   - Activity feed showing last activity
   - @mention notifications (already there)
   - Team member workload view

6. **Reminders & Alerts**
   - Set custom deadline reminders
   - Milestone alerts
   - Inactivity alerts
   - Deadline approaching notifications

7. **Historical Data**
   - Similar grants previously awarded
   - Success rate for this grant
   - Deadline change history
   - Amendment history

8. **Related Information**
   - Similar grants from same agency
   - Grants by funding category
   - Grant history for organization
   - Recommended next steps

9. **External Data Integration**
   - Full Grants.gov page embedded
   - SAM.gov eligibility info
   - DUNS/SAM registration status

10. **Export Options**
    - Export grant + all documents as PDF packet
    - Generate proposal outline
    - Create presentation deck
    - Email to team member

11. **Version Control**
    - Track changes to notes/status
    - Restore previous notes
    - View edit history

12. **Mobile Optimization**
    - Responsive drawer for mobile
    - Simplified mobile view
    - Mobile-friendly tab layout

---

## 8. API ENDPOINTS USED

### Grants Operations
- `GET /api/saved?org_id=${orgId}` - List saved grants
- `PATCH /api/saved-status?id=${grantId}` - Update status
- `PATCH /api/saved?id=${grantId}` - Update grant (notes, priority, etc)
- `DELETE /api/saved?id=${grantId}` - Remove grant from pipeline

### Related Data
- `GET /api/tasks?grant_id=${grantId}` - Get tasks
- `GET /api/comments/grant-comments?grant_id=${grantId}` - Get comments
- `GET /api/grants/tags?external_id=${grantId}` - Get grant tags
- `GET /api/grants/success-score?external_id=${grantId}&org_id=${orgId}` - Get fit score

### Mutations
- `PUT /api/comments/grant-comments?id=${commentId}` - Edit comment
- `DELETE /api/comments/grant-comments?id=${commentId}` - Delete comment
- `POST /api/comments/grant-comments` - Create comment

---

## 9. KEY IMPLEMENTATION PATTERNS

### Optimistic Updates
All mutations use optimistic updates with rollback:
- Update UI immediately
- Show success notification
- Rollback on error with error notification

### Query Invalidation
- After mutations, invalidate `['savedGrants']` cache
- Forces fresh data fetch
- Keeps UI in sync

### Deep Linking
- URL params persisted in state
- Auto-open drawer on page load if grant ID in URL
- Clear params after handling

### View State Persistence
- Board/List view preference saved in URL (`?view=list`)
- Allows sharing links with preserved view

### Accessibility
- Keyboard navigation (Enter/Space to open)
- ARIA labels on interactive elements
- Semantic HTML structure
- Color not sole indicator

---

## Summary Statistics

- **Files in current implementation**: 5 main + 15+ supporting
- **Database fields per grant**: 16 stored fields + relationships
- **Available data fields**: ~30+ when including related data
- **Tab sections in details**: 8 tabs
- **Pipeline stages**: 4
- **View modes**: 2 (board + list)
- **Bulk operations**: 3 (status, priority, delete)
- **Lines of code in PipelinePage**: 1,257
- **Lines of code in GrantDetailDrawer**: 719

