# Implementation Checklist: Option 3 (Recommended)

## Phase 1: Quick Win (3-5 days)

### Prep Work (0.5 days)
- [ ] Review GrantDetailDrawer.tsx current structure
- [ ] Identify most-used tabs from user data
- [ ] Create design mockups for new tab layout
- [ ] Get design/UX feedback

### Create Overview Tab Component (1-1.5 days)

**File:** `/home/user/grant-tracker-new/src/components/GrantOverviewTab.tsx` (NEW)

Structure:
```typescript
interface OverviewTabProps {
  grant: Grant;
  tasksData?: Task[];
  commentsData?: { total_count: number };
  budgetSummary?: BudgetSummary;
}

Components:
- GrantHeaderSummary (Title, Agency, ALN)
- DeadlineCard (with countdown)
- StatusBadges (Priority, Status)
- QuickMetrics (Tasks count, Comments count, Documents count, Budget allocated)
- NextSteps (suggested next actions)
- QuickActions (View on Grants.gov, Print Brief)
```

- [ ] Create component file
- [ ] Design layout with Mantine Stack/Group
- [ ] Add icons for each section
- [ ] Add color coding for urgency
- [ ] Test with sample data

### Reorganize Tab Structure (1 day)

**File:** `/home/user/grant-tracker-new/src/components/GrantDetailDrawer.tsx` (MODIFY)

Current:
```
[Tasks] [Documents] [Budget] [Payments] [Compliance] [AI Summary] [Notes] [Comments]
```

New:
```
[Overview] [Tasks] [Notes] [Comments] [More ▼]
                              ├─ Budget
                              ├─ Payments
                              ├─ Compliance
                              ├─ AI Summary
                              └─ Documents
```

Changes needed:
- [ ] Remove large header sections (move to Overview tab)
- [ ] Add Overview tab as first tab
- [ ] Reorganize Tabs.List with Menu for secondary tabs
- [ ] Update default tab to "overview" instead of "tasks"
- [ ] Move priority/status selectors to Overview or keep in header
- [ ] Remove grant description from header (put in Overview)
- [ ] Remove additional grant info section (put in Overview)

### Implement Menu for Secondary Tabs (0.5 days)

**File:** `/home/user/grant-tracker-new/src/components/GrantDetailDrawer.tsx`

Add:
```typescript
<Menu position="bottom-end">
  <Menu.Target>
    <Tabs.Tab value="_more" component="div">
      More <IconChevronDown size={14} />
    </Tabs.Tab>
  </Menu.Target>
  <Menu.Dropdown>
    <Menu.Item onClick={() => setActiveTab('budget')}>
      Budget
    </Menu.Item>
    <Menu.Item onClick={() => setActiveTab('payments')}>
      Payments
    </Menu.Item>
    {/* ... others ... */}
  </Menu.Dropdown>
</Menu>
```

- [ ] Import Menu, IconChevronDown from Mantine/Tabler
- [ ] Create menu structure for secondary tabs
- [ ] Test click handling
- [ ] Add visual feedback on selected secondary tab

### Add Content Indicators (0.5 days)

**File:** `/home/user/grant-tracker-new/src/components/GrantDetailDrawer.tsx`

Add:
```typescript
// Determine if sections have new/updated content
const hasNewComments = commentsData?.total_count > 0;
const hasOpenTasks = tasksData?.tasks?.some(t => !t.completed);
const hasBudgetData = budgetData?.total_allocated > 0;
```

- [ ] Add badge indicators to tab names
- [ ] Show comment count in Comments tab
- [ ] Show open task count in Tasks tab
- [ ] Show badge for "New" content
- [ ] Add visual hierarchy (color, size)

### Testing & Refinement (1-1.5 days)

- [ ] Test tab navigation (primary and secondary)
- [ ] Test menu functionality
- [ ] Verify all content still accessible
- [ ] Test with different screen sizes
- [ ] Performance test (check for render delays)
- [ ] Accessibility review (keyboard nav, screen readers)
- [ ] Cross-browser testing
- [ ] User acceptance testing with sample users

---

## Phase 2: Enhancement (2-3 days)

### Add Stage-Specific Next Steps (1 day)

**File:** `/home/user/grant-tracker-new/src/components/NextStepsSection.tsx` (NEW)

Content by stage:
- Researching: "Next: Schedule research discussion, compile findings"
- Drafting: "Next: Complete draft section 3, submit for review"
- Submitted: "Next: Monitor for updates, follow up in 30 days"
- Awarded: "Next: Set up payment schedule, review compliance requirements"

- [ ] Create configuration for stage-to-next-steps mapping
- [ ] Create component showing suggested next steps
- [ ] Add to Overview tab
- [ ] Add icons for each step
- [ ] Make interactive (click to create task)

### Implement Smart Suggestions (1 day)

**File:** `/home/user/grant-tracker-new/src/components/SmartSuggestions.tsx` (NEW)

Rules:
- If no deadline set: "Add deadline to track progress"
- If no tasks: "Create tasks for this grant"
- If many comments: "Review comments and create tasks"
- If budget not allocated: "Set up budget allocation"
- If overdue: "This grant is overdue - review status"

- [ ] Create suggestion engine with rules
- [ ] Create UI for suggestions
- [ ] Add dismissal functionality
- [ ] Test suggestion logic
- [ ] Add persistence (remember dismissed suggestions)

### Enhance Overview Tab Visuals (0.5 days)

- [ ] Add color-coded status indicators
- [ ] Create summary cards with icons
- [ ] Add progress indicators
- [ ] Improve spacing and typography
- [ ] Add hover states
- [ ] Test visual hierarchy

---

## Phase 3: Advanced Features (Future)

### Context-Aware Tab Reordering (2-3 days)

- [ ] Create STAGE_TAB_CONFIG mapping
- [ ] Implement conditional tab rendering
- [ ] Add stage-specific hints/tooltips
- [ ] Test all stage combinations

### Optional: Full Page Implementation (5-7 days)

- [ ] Create GrantDetailsPage.tsx
- [ ] Set up routing
- [ ] Create page layout
- [ ] Implement sidebar navigation
- [ ] Test integration with drawer

---

## Files Summary

### New Files to Create
1. `/home/user/grant-tracker-new/src/components/GrantOverviewTab.tsx`
   - Overview summary component
   - Est. 150-200 lines

2. `/home/user/grant-tracker-new/src/components/NextStepsSection.tsx` (Phase 2)
   - Stage-specific next steps
   - Est. 80-120 lines

3. `/home/user/grant-tracker-new/src/components/SmartSuggestions.tsx` (Phase 2)
   - Smart suggestion engine
   - Est. 100-150 lines

### Files to Modify
1. `/home/user/grant-tracker-new/src/components/GrantDetailDrawer.tsx`
   - Remove header clutter
   - Reorganize tabs
   - Add menu for secondary tabs
   - Import new components
   - Est. 150-200 lines changed

### No Changes Needed
- PipelinePage.tsx
- App.tsx (routing)
- SavedGrantsPage.tsx
- Individual tab components

---

## Testing Plan

### Unit Tests
- [ ] Overview tab renders correctly
- [ ] Menu items navigate to correct tabs
- [ ] Content indicators show accurate counts
- [ ] Stage detection works correctly

### Integration Tests
- [ ] Tab navigation works end-to-end
- [ ] Data flows correctly from parent to children
- [ ] Comments/tasks update properly
- [ ] Drawer closes correctly

### User Tests
- [ ] Quick lookup workflow (5-6 seconds or less)
- [ ] Finding specific information (improved discoverability)
- [ ] Menu interaction is intuitive
- [ ] Secondary tabs are accessible

### Performance Tests
- [ ] No increase in initial render time
- [ ] Tab switching is smooth
- [ ] No memory leaks on multiple grant opens
- [ ] Large datasets (100+ tasks) still performant

---

## Rollback Plan

If issues arise:
1. Revert GrantDetailDrawer.tsx to previous state
2. Remove GrantOverviewTab.tsx import
3. Keep git commit for reference
4. Create ticket for investigation

---

## Success Criteria

- [ ] 50% reduction in visible tabs (8 → 4-5)
- [ ] Tab discovery time reduced
- [ ] No data loss or inaccessibility
- [ ] Performance maintained
- [ ] User feedback positive (>80% satisfaction)
- [ ] No regressions in existing features

---

## Timeline Estimate

```
Phase 1: 3-5 days
├─ Prep: 0.5 days
├─ Overview Tab: 1-1.5 days
├─ Tab Reorganization: 1 day
├─ Menu Implementation: 0.5 days
├─ Content Indicators: 0.5 days
└─ Testing: 1-1.5 days

Phase 2: 2-3 days (optional)
├─ Next Steps: 1 day
├─ Smart Suggestions: 1 day
└─ Visual Enhancement: 0.5 days

Total: 5-8 days
Recommended Sprint: 1 week
```

---

## Questions to Answer Before Starting

1. Which tabs are most frequently used?
   - Current assumption: Tasks, Notes, Comments
   
2. Should primary/secondary tabs be user-configurable?
   - Current: No, but could be added later
   
3. What are the most important metrics to show?
   - Current: Tasks count, Comments count, Budget allocated
   
4. Should Overview tab include edit capability?
   - Current: View only, edits via individual tabs
   
5. Should "Next Steps" be generated or manual?
   - Current: Stage-based templates, could be manual later

---

## Deployment Checklist

- [ ] Code review completed
- [ ] All tests passing
- [ ] No performance regressions
- [ ] Accessibility review done
- [ ] Documentation updated
- [ ] Changelog entry added
- [ ] Staging environment tested
- [ ] Team trained on new layout
- [ ] Release notes prepared
- [ ] Monitor usage post-deployment

