# Quick Reference: Header/Footer Usage Summary

## Visual Overview of Current State

```
PAGE TYPE                   | PAGES                                      | HEADER              | FOOTER        | STATUS
---------------------------|--------------------------------------------|--------------------|-------|----------
Public Marketing (optimal)  | /features, /pricing                        | MarketingHeader    | Inline (dup) | ✓ Good
Marketing Special           | /granthub-migration                         | MarketingHeader    | None          | ✓ OK
Marketing Hybrid            | / (homepage)                               | Conditional*       | Inline (dup)  | ⚠ Mixed
Mixed Pages                 | /terms, /privacy, /security, /support      | Conditional**      | None          | ✗ Duplicated
Protected App Pages         | /discover, /saved, /pipeline, /metrics     | AppHeader          | None          | ✓ OK
Settings Pages              | /settings/*                                 | AppHeader (layout) | None          | ✓ OK
Admin Pages                 | /admin/sync-mgmt                            | AppHeader          | None          | ✓ OK
Protected Special           | /onboarding/eligibility                    | None               | None          | ✗ Missing
Auth Pages (BAD)            | /signin, /signup, /reset, /update          | None               | None          | ✗ Missing
Invite/Special              | /accept-invite                              | None               | None          | ✗ Missing
Error Pages                 | 404 (NotFound)                             | None               | None          | ✓ OK (stylized)
```

**Legend:**
- `Conditional*` = Uses MarketingHeader (blurred) if not user, AppHeader if user
- `Conditional**` = Uses custom inline header (duplicated code) if not user, AppHeader if user
- Inline (dup) = Footer code repeated in multiple pages
- AppHeader (layout) = AppHeader wrapped in SettingsLayout

---

## Inconsistency Summary Table

| Severity | Issue | Location(s) | Impact | Lines Affected |
|----------|-------|------------|--------|----------------|
| CRITICAL | Code duplication: Custom headers | TermsPage, PrivacyPage, SecurityPage, SupportPage | 400+ duplicated lines | ~100 per page |
| CRITICAL | Code duplication: Footers | HomePage, FeaturesPage, PricingPage | 3 copies of same code | ~20 per page |
| HIGH | Missing headers | SignInPage, SignUpPage, ResetPasswordPage, UpdatePasswordPage, AcceptInvitePage | Poor UX, no branding | 5 pages |
| MEDIUM | Missing headers | EligibilityWizardPage | Inconsistent protection | 1 page |
| MEDIUM | Styling inconsistency | Various headers | Visual inconsistency | Multiple |
| MEDIUM | No footer on protected pages | Discover, Saved, Pipeline, Metrics, Activity, Settings | Incomplete layout | 6+ pages |

---

## Code Duplication Breakdown

### Footer Code Duplication:
- **HomePage**: Lines 396-423 (28 lines)
- **FeaturesPage**: Lines 789-816 (28 lines)
- **PricingPage**: Lines 455-482 (28 lines)
- **Total duplicated**: 84 lines (3 copies)

### Header Code Duplication:
- **TermsPage**: Lines 17-126 (~110 lines)
- **PrivacyPage**: Lines 17-126 (~110 lines)
- **SecurityPage**: Lines 42-xx (~110 lines)
- **SupportPage**: Lines 42-xx (~110 lines)
- **Total duplicated**: ~440 lines (4 copies)

### TOTAL CODE DUPLICATION: 524+ lines

---

## Quick Implementation Checklist

### Phase 1: Quick Wins (30-60 minutes)
- [ ] Create `/src/components/AppFooter.tsx` (NEW)
- [ ] Update HomePage, FeaturesPage, PricingPage to use AppFooter
- [ ] Replace custom headers in Terms/Privacy/Security/Support with MarketingHeader

### Phase 2: Layout Components (1.5-2 hours)
- [ ] Create `/src/components/PublicPageLayout.tsx` (NEW)
- [ ] Create `/src/components/ProtectedPageLayout.tsx` (NEW)
- [ ] Create `/src/components/AuthPageLayout.tsx` (NEW)

### Phase 3: Page Updates (1-1.5 hours)
- [ ] Wrap SignInPage in AuthPageLayout
- [ ] Wrap SignUpPage in AuthPageLayout
- [ ] Wrap ResetPasswordPage in AuthPageLayout
- [ ] Wrap UpdatePasswordPage in AuthPageLayout
- [ ] Update AcceptInvitePage
- [ ] Update EligibilityWizardPage

### Phase 4: Polish (30-60 minutes)
- [ ] Consistent header styling across all components
- [ ] Verify responsive behavior on mobile
- [ ] Check z-index consistency for sticky headers

---

## Before/After Comparison

### BEFORE (Current State)
```tsx
// TermsPage
{user ? (
  <AppHeader subtitle="Terms of Service" />
) : (
  <Box component="header" px="md" py="lg" style={{...}}>
    {/* 110 lines of custom header code */}
  </Box>
)}
// ... page content ...
// NO FOOTER

// SignInPage
<Container size="xs" style={{ marginTop: '80px' }}>
  {/* NO HEADER - form floating in space */}
  <Paper shadow="md" p="xl" radius="md" withBorder>
    {/* form content */}
  </Paper>
</Container>
// NO FOOTER
```

### AFTER (Recommended)
```tsx
// TermsPage
<PublicPageLayout pageTitle="Terms of Service">
  {/* page content */}
</PublicPageLayout>
// Automatically includes appropriate header and footer

// SignInPage  
<AuthPageLayout>
  {/* form content */}
</AuthPageLayout>
// Automatically includes header and footer
```

---

## Specific File Changes Required

### New Files to Create:
1. **AppFooter.tsx** - Dark footer with branding and links
2. **PublicPageLayout.tsx** - Wrapper for public pages (conditional header + footer)
3. **ProtectedPageLayout.tsx** - Wrapper for protected pages (AppHeader + optional footer)
4. **AuthPageLayout.tsx** - Wrapper for auth pages (MarketingHeader + footer)

### Files to Update (Header):
1. TermsPage.tsx - Lines 13-126: Replace custom header with MarketingHeader
2. PrivacyPage.tsx - Lines 13-126: Replace custom header with MarketingHeader
3. SecurityPage.tsx - Lines 37-62: Replace custom header with MarketingHeader
4. SupportPage.tsx - Lines 37-62: Replace custom header with MarketingHeader

### Files to Update (Footer):
1. HomePage.tsx - Replace lines 396-423 with `<AppFooter />`
2. FeaturesPage.tsx - Replace lines 789-816 with `<AppFooter />`
3. PricingPage.tsx - Replace lines 455-482 with `<AppFooter />`

### Files to Update (Add Layout):
1. SignInPage.tsx - Wrap entire component in `<AuthPageLayout>`
2. SignUpPage.tsx - Wrap entire component in `<AuthPageLayout>`
3. ResetPasswordPage.tsx - Wrap entire component in `<AuthPageLayout>`
4. UpdatePasswordPage.tsx - Wrap entire component in `<AuthPageLayout>`
5. AcceptInvitePage.tsx - Wrap entire component in `<AuthPageLayout>`
6. EligibilityWizardPage.tsx - Wrap content in `<ProtectedPageLayout>`

