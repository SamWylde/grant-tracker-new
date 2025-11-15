# Approval Workflows Feature - Implementation Summary

## Overview

A comprehensive approval workflows system has been implemented for the GrantCue grant tracking platform. This feature enables organizations to define and enforce approval requirements before grant stage transitions, supporting multi-level approval chains with email notifications.

## Features Implemented

### Core Functionality

1. **Approval Workflow Configuration**
   - Define which stage transitions require approval (e.g., "Drafting → Submitted")
   - Multi-level approval chains with configurable approvers
   - Role-based or specific user approvals
   - Advanced settings: require all levels, self-approval, admin auto-approval

2. **Approval Request Management**
   - Create approval requests when attempting restricted stage transitions
   - Track approval progress through multiple levels
   - Support for approval or rejection at each level
   - Automatic grant status updates upon full approval

3. **Email Notifications**
   - Automated email notifications to approvers via Resend
   - Beautifully formatted HTML emails with approval links
   - Notifications sent when requests are created and when levels advance

4. **In-App Notifications**
   - Real-time in-app notifications for approval requests
   - Integrated with existing notification system
   - Database triggers for automatic notification creation

## Database Schema

### Tables Created

#### 1. `approval_workflows`
Stores workflow definitions for stage transition approvals.

**Key Columns:**
- `id`: UUID primary key
- `org_id`: Organization reference
- `name`: Workflow name
- `description`: Optional description
- `from_stage`, `to_stage`: Stage transition definition
- `approval_chain`: JSONB array of approval levels
- `is_active`: Workflow status
- `require_all_levels`: Whether all levels must approve
- `allow_self_approval`: Allow requester to approve
- `auto_approve_admin`: Admins bypass workflow

**Approval Chain Structure:**
```json
[
  {
    "level": 1,
    "role": "admin",
    "required_approvers": 1,
    "specific_users": ["uuid1", "uuid2"]
  }
]
```

#### 2. `approval_requests`
Individual approval requests for grant stage transitions.

**Key Columns:**
- `id`: UUID primary key
- `org_id`, `workflow_id`, `grant_id`: References
- `requested_by`: User who created the request
- `from_stage`, `to_stage`: Stage transition
- `status`: pending | approved | rejected | cancelled
- `current_approval_level`: Current level in approval chain
- `approvals`: JSONB array of approval decisions
- `request_notes`: Requester's notes
- `expires_at`: Request expiration (7 days default)

#### 3. `approval_request_approvers`
Denormalized table tracking individual approvers.

**Key Columns:**
- `request_id`, `user_id`: References
- `approval_level`: Level this approver can approve
- `has_approved`: Boolean status
- `decision`: approved | rejected
- `comments`: Approver's comments
- `notified_at`: When notification was sent

### Database Functions & Triggers

1. **`create_approval_request_approvers()`**
   - Automatically creates approver records when request is created
   - Parses workflow approval chain
   - Assigns approvers based on role or specific users

2. **`create_approval_notifications()`**
   - Creates in-app notifications for approvers
   - Triggers on request creation and level advancement
   - Marks approvers as notified

3. **Row Level Security (RLS)**
   - Comprehensive RLS policies for all tables
   - Members can view, admins can manage
   - Service role for background operations

## Backend API Endpoints

### 1. `/api/approval-workflows.ts`

**GET**: List workflows
- Query params: `org_id`, `active_only`
- Returns: Array of workflows with creator info

**POST**: Create workflow
- Body: Workflow configuration
- Validates: Stage transitions, approval chain
- Checks: Existing active workflows for same transition

**PATCH**: Update workflow
- Query param: `id`
- Body: Partial workflow updates
- Validates: Conflicts with other active workflows

**DELETE**: Delete workflow
- Query param: `id`
- Checks: No pending approval requests
- Suggestion: Deactivate instead of delete

### 2. `/api/approval-requests.ts`

**GET**: List approval requests
- Query params: `org_id`, `status`, `grant_id`, `pending_for_user`
- Returns: Array of requests with related data

**POST**: Create approval request
- Body: `grant_id`, `from_stage`, `to_stage`, `request_notes`
- Validates: Grant status matches from_stage
- Checks: Active workflow exists
- Handles: Admin auto-approval
- Sends: Email notifications to first-level approvers

**PATCH**: Approve or reject request
- Query param: `id`
- Body: `decision` (approved/rejected), `comments`
- Validates: User is current-level approver
- Handles: Multi-level progression
- Updates: Grant status on final approval

**DELETE**: Cancel request
- Query param: `id`
- Validates: Requester or admin only
- Sets: Status to cancelled

### Email Notification Service

Integrated email service using Resend API:
- HTML email templates with grant and transition details
- Approval action URLs linking to the app
- Configurable via `RESEND_API_KEY` environment variable
- Graceful degradation if email service unavailable

## Frontend Implementation

### Type Definitions (`src/types/approvals.ts`)

Comprehensive TypeScript types:
- `ApprovalWorkflow`, `ApprovalRequest`, `ApprovalLevel`
- `GrantStage` enum with all grant stages
- Helper functions: `getStageLabel()`, `formatTransitionLabel()`
- Progress calculation utilities

### API Utilities (`src/utils/approvalsApi.ts`)

Client-side API wrapper functions:
- `fetchWorkflows()`, `createWorkflow()`, `updateWorkflow()`, `deleteWorkflow()`
- `fetchApprovalRequests()`, `createApprovalRequest()`, `approveOrRejectRequest()`
- `checkTransitionRequiresApproval()` - helper for stage transitions
- Automatic authentication header management

### UI Components

#### 1. `ApprovalWorkflowManager.tsx`
Full-featured workflow management interface:
- **WorkflowForm**: Modal for creating/editing workflows
  - Stage selection (from/to)
  - Multi-level approval chain builder
  - Role or specific user selection
  - Advanced settings toggles
- **Workflow List**: Table view of all workflows
  - Status badges (Active/Inactive)
  - Toggle activation
  - Edit/Delete actions
  - Validation prevents deletion with pending requests

#### 2. `PendingApprovalsList.tsx`
Approval request dashboard:
- **Three Tabs**:
  - Pending: All pending requests in org
  - My Approvals: Requests pending user's review
  - Completed: Approved/rejected/cancelled requests
- **ApprovalRequestCard**: Rich request display
  - Grant title and transition
  - Progress bar for multi-level approvals
  - Requester info and timestamps
  - Action buttons for approvers
  - Rejection reason display
- **ApprovalActionModal**: Review interface
  - Two-tab layout (Approve/Reject)
  - Comment/reason text areas
  - Validation and submission

#### 3. `StageTransitionButton.tsx`
Smart stage transition component:
- Dropdown menu of available transitions
- Automatic approval requirement detection
- Badges indicating approval-required transitions
- **TransitionModal**:
  - Shows transition preview
  - Alert for approval vs. direct update
  - Notes/comments field
  - Submits approval request or direct update

### Pages

#### 1. `ApprovalWorkflowsPage.tsx`
Admin settings page at `/settings/workflows`:
- Title and description
- Embeds `ApprovalWorkflowManager` component
- Admin-only route (uses `AdminRoute`)

#### 2. `ApprovalsPage.tsx`
Main approvals page at `/approvals`:
- Title and description
- Embeds `PendingApprovalsList` component
- Protected route (all authenticated users)

### Routing Updates (`App.tsx`)

Added routes:
```tsx
<Route path="/settings/workflows" element={<AdminRoute><ApprovalWorkflowsPage /></AdminRoute>} />
<Route path="/approvals" element={<ProtectedRoute><ApprovalsPage /></ProtectedRoute>} />
```

## Integration Points

### Existing Features Used

1. **Authentication & Authorization**
   - `AuthContext` for user authentication
   - `OrganizationContext` for org/role management
   - `AdminRoute` and `ProtectedRoute` for access control

2. **Database**
   - Supabase client for database operations
   - Existing RLS policy patterns
   - Integration with `org_grants_saved` table

3. **Notifications**
   - Existing `in_app_notifications` table
   - Notification display system

4. **Email Service**
   - Resend API (already configured)
   - Environment variable: `RESEND_API_KEY`

5. **UI Components**
   - Mantine UI component library
   - React Query for data fetching
   - Existing notification toast system

### Usage in Grant Pipeline

To integrate the `StageTransitionButton` component into grant detail views:

```tsx
import { StageTransitionButton } from '../components/StageTransitionButton';

// In your grant detail component:
<StageTransitionButton
  grantId={grant.id}
  orgId={grant.org_id}
  currentStage={grant.status}
  onStageChanged={() => {
    // Refresh grant data
    queryClient.invalidateQueries(['savedGrants']);
  }}
/>
```

## File Structure

```
grant-tracker-new/
├── supabase/migrations/
│   └── 20250205_add_approval_workflows.sql       # Database schema
├── api/
│   ├── approval-workflows.ts                     # Workflows API
│   └── approval-requests.ts                      # Requests API
├── src/
│   ├── types/
│   │   └── approvals.ts                          # TypeScript types
│   ├── utils/
│   │   └── approvalsApi.ts                       # API client utilities
│   ├── components/
│   │   ├── ApprovalWorkflowManager.tsx           # Workflow configuration UI
│   │   ├── PendingApprovalsList.tsx              # Approval dashboard
│   │   └── StageTransitionButton.tsx             # Stage change component
│   ├── pages/
│   │   ├── ApprovalWorkflowsPage.tsx             # Workflows settings page
│   │   └── ApprovalsPage.tsx                     # Approvals page
│   └── App.tsx                                    # Updated with new routes
```

## Environment Variables

Ensure these are configured:

```env
# Supabase (already configured)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Resend Email API (already configured)
RESEND_API_KEY=your-resend-api-key
```

## Database Migration

To apply the database schema, run the migration:

```bash
# If using Supabase CLI
supabase db push

# Or apply the SQL file manually via Supabase dashboard
# Navigate to: SQL Editor > New Query > Paste contents of 20250205_add_approval_workflows.sql
```

## Testing Workflow

### 1. Setup Workflows (Admin)
1. Navigate to `/settings/workflows`
2. Click "Create Workflow"
3. Configure:
   - Name: "Director Approval for Submission"
   - From Stage: "Drafting"
   - To Stage: "Submitted"
   - Approval Levels: Add one or more levels
   - Select approvers (by role or specific users)
4. Save workflow

### 2. Request Approval (Contributor)
1. View a grant in "Drafting" stage
2. Click "Change Stage" button
3. Select "Submit Application"
4. See "Approval Required" indicator
5. Enter request notes
6. Submit approval request
7. Check email notifications sent to approvers

### 3. Review Approval (Approver)
1. Navigate to `/approvals`
2. See pending request in "My Approvals" tab
3. Click "Review Request"
4. Choose Approve or Reject tab
5. Add comments (required for rejection)
6. Submit decision
7. For multi-level: Request advances to next level
8. For final level: Grant status updates automatically

### 4. Monitor Progress
1. View all requests in "Pending" tab
2. See progress bars for multi-level approvals
3. Check "Completed" tab for history
4. View rejection reasons if applicable

## Advanced Features

### Multi-Level Approvals
- Configure multiple approval levels in workflow
- Each level can have different approvers and requirements
- Progress tracked through `current_approval_level`
- Automatic advancement when level requirements met

### Conditional Approval
- `require_all_levels`: All levels must approve (default)
- If false: Any level approval completes the request
- Useful for parallel approval scenarios

### Admin Privileges
- `auto_approve_admin`: Admins bypass workflow
- Direct stage updates without approval request
- Useful for urgent changes or corrections

### Expiration Handling
- Requests expire after 7 days (configurable)
- Expired requests automatically cancelled
- Visual indicators for expired requests

### Self-Approval
- `allow_self_approval`: Requester can be approver
- Disabled by default for separation of duties
- Enable for workflows requiring acknowledgment vs. approval

## Security Considerations

1. **RLS Policies**: All tables protected by row-level security
2. **Role Validation**: API endpoints verify user roles
3. **Org Membership**: Users can only access their org's data
4. **Service Role**: Background operations use service role
5. **Approval Chain**: Validated on workflow creation
6. **Email Validation**: Graceful handling of missing emails

## Performance Optimizations

1. **Denormalized Approvers**: `approval_request_approvers` table for fast queries
2. **Indexed Queries**: Strategic indexes on frequently queried columns
3. **React Query**: Client-side caching and optimistic updates
4. **Database Triggers**: Automatic approver creation reduces round trips
5. **JSONB Fields**: Efficient storage and querying of approval chain/history

## Future Enhancements (Not Implemented)

1. **Approval Delegation**: Allow approvers to delegate to others
2. **Conditional Rules**: Workflow activation based on grant properties (amount, category)
3. **Approval Templates**: Pre-configured workflows for common scenarios
4. **Analytics Dashboard**: Approval metrics and bottleneck identification
5. **Slack Integration**: Send approval notifications to Slack
6. **Mobile App**: Native mobile approval interface
7. **Bulk Approvals**: Approve multiple requests at once
8. **Approval Comments Thread**: Discussion forum for each request
9. **Deadline Escalation**: Auto-escalate if not approved within timeframe
10. **Approval History Export**: Download approval audit logs

## Troubleshooting

### Emails Not Sending
- Check `RESEND_API_KEY` environment variable
- Verify user profiles have email addresses
- Check Resend dashboard for delivery status

### Workflow Not Applying
- Verify workflow is active (`is_active = true`)
- Check stage transition matches exactly
- Ensure no conflicts with other active workflows

### Permission Errors
- Verify user is member of organization
- Check user role (admin vs. contributor)
- Review RLS policies in database

### Approval Not Progressing
- Verify required approvals met for current level
- Check approver is assigned to current level
- Ensure request not expired

## Success Metrics

This implementation provides:

✅ **Complete MVP** of approval workflows feature
✅ **Database schema** with triggers and RLS policies
✅ **Backend APIs** for workflows and approval requests
✅ **Frontend UI** for configuration and management
✅ **Email notifications** with professional templates
✅ **Multi-level approval chains** with progress tracking
✅ **Role-based and user-specific** approver assignment
✅ **Integration hooks** for existing grant pipeline
✅ **Comprehensive documentation** and testing guide

## Conclusion

The Approval Workflows feature is fully implemented and ready for use. It provides organizations with powerful control over their grant stage transitions, ensuring proper oversight and accountability through configurable multi-level approval chains. The system is secure, scalable, and well-integrated with the existing GrantCue platform.

All core functionality requested has been delivered, including database migrations, backend APIs, frontend components, and email notifications. The feature is production-ready and can be deployed immediately.
