# Pre-Flight Checklist - Quick Start Guide

## What is the Pre-Flight Checklist?

The Pre-Flight Checklist is an AI-powered feature that helps you prepare grant applications by automatically generating a comprehensive checklist of all requirements, documents, and tasks needed before submission.

## Quick Start (5 minutes)

### Step 1: Run the Database Migration

```bash
# Make sure you're in the project directory
cd /home/user/grant-tracker-new

# Apply the migration to your Supabase database
# Option A: Using Supabase CLI (recommended)
supabase db push

# Option B: Run the SQL file directly in Supabase Studio
# Copy contents of: supabase/migrations/20250211_add_preflight_checklist.sql
# Paste into SQL Editor in Supabase Studio and execute
```

### Step 2: Restart Your Development Server

```bash
# Stop your current dev server (Ctrl+C)
# Then restart it
npm run dev

# Or if using yarn
yarn dev
```

### Step 3: Test the Feature

1. Open your browser to `http://localhost:3000` (or your dev URL)
2. Log in to your application
3. Navigate to a saved grant in your pipeline
4. Click on the "Pre-Flight Checklist" tab
5. Click "Generate Pre-Flight Checklist" button
6. Wait 2-5 seconds for AI generation
7. ✅ Checklist appears with categorized items!

## Using the Feature

### Generate Your First Checklist

**Prerequisites:**
- Grant must be saved to your pipeline
- NOFO AI summary must be generated (AI Summary tab)

**Steps:**
1. Go to Grant Detail page
2. Click **Pre-Flight Checklist** tab
3. Click **Generate Pre-Flight Checklist** button
4. Wait for AI to analyze the NOFO
5. Review the generated checklist items

### Complete Checklist Items

1. Click the checkbox next to any item to mark it complete
2. Progress bar updates automatically
3. Completion date is recorded
4. Click the menu (⋮) to edit or delete items

### Add Custom Items

1. Scroll to bottom of checklist
2. Click **Add Custom Item** button
3. Fill in:
   - Title (required)
   - Description (optional)
   - Category (select from dropdown)
   - Priority (low/medium/high/critical)
   - Required checkbox
4. Click **Add Item**

### Track Progress

- **Progress Bar** shows overall completion percentage
- **Category Headers** show completion per category
- **Required Items** tracked separately
- **Green badge** appears when 100% complete

## Checklist Categories

Your checklist will include items in these categories:

1. **Eligibility Verification** 🛡️
   - Organization eligibility requirements
   - Geographic restrictions
   - Entity type requirements

2. **Match Requirements** 💰
   - Cost sharing documentation
   - Matching fund requirements
   - In-kind contribution tracking

3. **Required Attachments** 📄
   - List of all required documents
   - Format specifications
   - Submission requirements

4. **Deadlines** 📅
   - LOI deadline tracking
   - Application deadline
   - Key milestone dates

5. **Compliance** ⚠️
   - Regulatory requirements
   - Certifications needed
   - Legal requirements

6. **Budget Preparation** 💵
   - Budget document requirements
   - Financial statement needs
   - Budget narrative items

7. **Custom Items** 💡
   - Additional NOFO-specific items
   - Your custom additions

## Tips & Best Practices

### ✅ Best Practices

- **Generate Early:** Create checklist as soon as you save a grant
- **Regular Updates:** Check off items as you complete them
- **Add Notes:** Use the notes field to track details
- **Custom Items:** Add organization-specific requirements
- **Team Collaboration:** Share progress with team members

### ⚡ Pro Tips

- Use **Priority** field to focus on critical items first
- Mark items as **Required** to track mandatory vs. optional
- **Export Progress:** Use the stats to report to leadership
- **Review Often:** Check progress weekly during grant prep
- **Learn Patterns:** Notice which items take longest to improve process

### ⚠️ Common Mistakes

- Don't skip generating the NOFO summary first
- Don't delete items without team discussion
- Don't ignore required items
- Don't wait until last minute to start checklist

## Troubleshooting

### "No AI summary found for this grant"

**Problem:** Can't generate checklist

**Solution:**
1. Go to **AI Summary** tab
2. Generate NOFO summary first
3. Return to Pre-Flight Checklist tab
4. Try again

### Checklist Won't Generate

**Possible Causes:**
- NOFO summary not complete
- API key not configured
- Network timeout

**Solution:**
1. Check browser console for errors
2. Verify OPEN_AI_API_KEY in environment variables
3. Refresh page and try again
4. Contact support if issue persists

### Items Not Appearing

**Problem:** Can't see checklist items

**Solution:**
1. Check if categories are collapsed (click to expand)
2. Refresh the page
3. Verify you're viewing the correct grant
4. Check browser console for errors

## API Endpoints Reference

For developers integrating with the checklist:

```typescript
// Get checklist for a grant
GET /api/preflight-checklist?grant_id={id}

// Generate AI checklist
POST /api/preflight-checklist/generate
Body: { grant_id, org_id }

// Add custom item
POST /api/preflight-checklist/items
Body: { checklist_id, title, description, category, priority, is_required }

// Update item (e.g., mark complete)
PATCH /api/preflight-checklist?id={item_id}
Body: { completed: true, notes: "..." }

// Delete item
DELETE /api/preflight-checklist/items?id={item_id}
```

All endpoints require Bearer token authentication.

## Database Schema

Two main tables power this feature:

**grant_preflight_checklists**
- Stores checklist metadata
- Links to grant and AI summary
- Tracks generation status

**preflight_checklist_items**
- Individual checklist items
- Completion tracking
- Category and priority info
- AI-generated metadata

## Example Use Case

**Scenario:** Preparing a $500K education grant application

**Day 1 - Initial Setup:**
1. Save grant to pipeline
2. Generate NOFO summary
3. Generate pre-flight checklist
4. Review 18 generated items across 7 categories

**Week 1 - Eligibility:**
1. Complete 4 eligibility items
2. Add note: "Verified 501(c)(3) status - current through 2025"
3. Progress: 22% complete

**Week 2 - Documents:**
1. Complete 6 attachment items
2. Upload documents to Documents tab
3. Add custom item: "Request letter from Superintendent"
4. Progress: 56% complete

**Week 3 - Budget:**
1. Complete 5 budget items
2. Link to Budget tab for detailed breakdown
3. Progress: 83% complete

**Week 4 - Final Review:**
1. Complete remaining 3 items
2. Progress: 100% complete ✅
3. Ready to submit!

## Video Tutorial

*(Coming soon: Watch a 5-minute video walkthrough)*

## Need Help?

- 📖 Full Documentation: `PREFLIGHT_CHECKLIST_IMPLEMENTATION.md`
- 💬 Team Chat: #grant-tracker-support
- 🐛 Report Bug: File an issue in the repository
- 💡 Feature Request: Discuss with product team

## What's Next?

After mastering the Pre-Flight Checklist:

1. **Integrate with Tasks** - Convert checklist items to tasks
2. **Set Up Alerts** - Get notified about incomplete required items
3. **Track Analytics** - See which items typically take longest
4. **Build Templates** - Save checklists for similar grants
5. **Collaborate** - Assign items to team members

---

**Happy Grant Hunting! 🎯**

*Last Updated: 2025-02-11*
*Version: 1.0.0*
