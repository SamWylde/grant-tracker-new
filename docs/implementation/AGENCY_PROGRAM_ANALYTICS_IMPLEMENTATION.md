# Agency & Program Analytics Implementation

## Overview

This document describes the comprehensive implementation of agency and program breakdown reports in the grant tracker application. This feature enables users to analyze their grant portfolio by funding agency and specific programs, with rich visualizations and export capabilities.

## Features Implemented

### 1. Database Schema Enhancement
- **Migration File**: `/supabase/migrations/20250213_add_program_field.sql`
- Added `program` field to `org_grants_saved` table to track specific programs within funding agencies
- Created indexes for optimized query performance:
  - `idx_org_grants_saved_program` - For program-based queries
  - `idx_org_grants_saved_agency_program` - For combined agency+program queries

### 2. Backend API Endpoint
- **API File**: `/api/reports/agency-program-breakdown.ts`
- **Endpoint**: `POST /api/reports/agency-program-breakdown`
- **Capabilities**:
  - Agency-level breakdown with nested program details
  - Program-level flat breakdown across all agencies
  - Timeline analysis (funding trends over time)
  - Flexible filtering by date range and grant status
  - CSV export functionality
  - Grant count and funding metrics
  - Status distribution analytics

#### API Parameters
```typescript
{
  org_id: string,              // Required: Organization ID
  group_by: 'agency' | 'program' | 'both',  // Grouping preference
  start_date?: string,         // Optional: Filter by start date
  end_date?: string,           // Optional: Filter by end date
  status?: string[],           // Optional: Filter by grant statuses
  timeline_granularity?: 'month' | 'quarter' | 'year',  // Timeline grouping
  format?: 'csv'               // Optional: Request CSV export
}
```

#### API Response
```typescript
{
  agencyBreakdown: AgencyBreakdown[],
  programBreakdown: ProgramBreakdown[],
  timeline: TimelineDataPoint[],
  filters: {...},
  generatedAt: string
}
```

### 3. Frontend Analytics Page
- **Page File**: `/src/pages/AnalyticsPage.tsx`
- **Route**: `/analytics`
- **Features**:
  - Summary statistics cards (Total Funding, Total Grants, Agency Count, Average Funding)
  - Interactive timeline chart showing funding trends
  - Tabbed interface for Agency and Program views
  - Expandable agency cards with nested program details
  - Status distribution badges
  - Bar charts for top 10 agencies/programs
  - Responsive design for mobile and desktop
  - Real-time data filtering by timeframe and status

#### Key Components
1. **Summary Cards**: High-level metrics with icons
2. **Timeline Chart**: Line chart showing funding and grant counts over time
3. **Agency Tab**:
   - Bar chart of top 10 agencies
   - Accordion with expandable agency details
   - Nested program breakdowns
   - Status distribution
4. **Program Tab**:
   - Bar chart of top 10 programs
   - Table with all programs and their metrics
   - Status badges

### 4. Data Visualization
- **Library**: Recharts (v2.14.1)
- **Chart Types**:
  - Bar Charts: Agency and program funding comparisons
  - Line Charts: Timeline trends with dual Y-axes (funding + grant count)
  - Progress Indicators: Visual funding representation
  - Color-coded Status Badges

### 5. Export Functionality
- **Format**: CSV
- **Contents**:
  - Agency breakdown with funding metrics
  - Nested program data under each agency
  - Status distribution counts
  - Timeline data with period, agency, program, funding, and grant count
- **File Naming**: `agency-program-breakdown-YYYY-MM-DD.csv`

### 6. Type Definitions
- **File**: `/src/types/grants.ts`
- Updated `SavedGrant` interface to include `program` field
- Maintains backward compatibility (program field is nullable)

### 7. Navigation Integration
- Added "Analytics" link to main navigation header
- Available in both desktop and mobile navigation menus
- Positioned between "Metrics" and "Activity" in navigation flow

### 8. API Integration Updates
- **File**: `/api/saved.ts`
- Updated `SavedGrantRequest` interface to include `program` field
- Modified POST handler to accept and save program data
- Modified PATCH handler to allow program field updates
- Program field added to allowed fields for updates

## File Structure

```
grant-tracker-new/
├── api/
│   ├── reports/
│   │   └── agency-program-breakdown.ts    # New API endpoint
│   └── saved.ts                           # Updated to support program field
├── src/
│   ├── pages/
│   │   └── AnalyticsPage.tsx              # New analytics page
│   ├── types/
│   │   └── grants.ts                      # Updated with program field
│   ├── components/
│   │   └── AppHeader.tsx                  # Updated with Analytics link
│   └── App.tsx                            # Updated with Analytics route
├── supabase/
│   └── migrations/
│       └── 20250213_add_program_field.sql # Database migration
└── package.json                           # Updated with recharts dependency
```

## How to Access and Test

### 1. Running the Migration
```bash
# Apply the database migration
supabase db push

# Or if using Supabase CLI
supabase migration up
```

### 2. Install Dependencies
```bash
npm install
# or
yarn install
```

### 3. Access the Analytics Page
1. Sign in to the application
2. Navigate to the main navigation menu
3. Click on "Analytics" (between "Metrics" and "Activity")
4. Or directly visit: `https://your-domain.com/analytics`

### 4. Using the Analytics Features

#### Filtering Data
- **Timeframe**: Select from dropdown (All Time, Last 30 Days, Last 90 Days, Last Year)
- **Status**: Filter by grant status (All, Awarded, Submitted, In Progress, Saved)

#### Viewing Agency Breakdown
1. Click on "By Agency" tab
2. View the bar chart showing top 10 agencies
3. Expand any agency accordion to see:
   - Status distribution
   - List of programs under that agency
   - Funding metrics for each program

#### Viewing Program Breakdown
1. Click on "By Program" tab
2. View the bar chart showing top 10 programs
3. Scroll through the table to see all programs
4. View status badges for each program

#### Exporting Data
1. Click the "Export CSV" button in the top-right
2. CSV file will download automatically
3. Open in Excel, Google Sheets, or any CSV viewer

### 5. Testing the Implementation

#### Test Cases

1. **Empty State**
   - Access analytics with no grants saved
   - Verify "No data available" message displays

2. **Data Filtering**
   - Add grants with different agencies and programs
   - Test timeframe filters (30 days, 90 days, 1 year, all)
   - Test status filters (awarded, submitted, etc.)
   - Verify charts update accordingly

3. **Agency View**
   - Add grants with multiple agencies
   - Verify agencies are sorted by total funding (descending)
   - Expand agency accordion
   - Verify programs are listed correctly
   - Verify status distribution is accurate

4. **Program View**
   - Verify programs from all agencies are listed
   - Verify sorting by funding amount
   - Check status badges display correctly

5. **Timeline**
   - Add grants over different time periods
   - Verify timeline chart displays trends
   - Check both funding and grant count lines

6. **CSV Export**
   - Click export button
   - Open CSV file
   - Verify all data is present and formatted correctly
   - Check agency breakdown section
   - Check program breakdown section
   - Check timeline section

7. **Mobile Responsiveness**
   - Access page on mobile device or narrow browser
   - Verify navigation menu works
   - Verify charts are responsive
   - Verify tables are scrollable

## Data Flow

```
User Action (Filter/Load Page)
    ↓
Frontend (AnalyticsPage.tsx)
    ↓
API Request (/api/reports/agency-program-breakdown)
    ↓
Database Query (org_grants_saved table)
    ↓
Data Processing & Aggregation
    ↓
Response (JSON or CSV)
    ↓
Frontend Rendering (Charts, Tables, Cards)
```

## Funding Calculation Logic

The system calculates funding based on grant status:
1. **Awarded grants**: Uses `award_amount` field
2. **Other grants**: Uses `requested_amount` field
3. **Fallback**: Returns 0 if no amount is available

This ensures accurate tracking of both secured and potential funding.

## Performance Considerations

1. **Database Indexes**: Optimized queries with indexes on agency and program fields
2. **Data Limiting**: Bar charts show top 10 entries to maintain readability
3. **Lazy Loading**: Charts only render when tabs are active
4. **Query Optimization**: Single API call fetches all data needed for the page
5. **Caching**: React Query caches results to minimize API calls

## Future Enhancements

### Recommended Features
1. **PDF Export**: Add PDF generation for reports with charts included
2. **Custom Date Ranges**: Allow users to select specific date ranges
3. **Saved Reports**: Allow users to save filter configurations
4. **Scheduled Reports**: Integrate with existing scheduled reports system
5. **Comparison Mode**: Compare funding across multiple time periods
6. **Geographic Breakdown**: Add geographic analysis if location data is available
7. **Predictive Analytics**: ML-based funding predictions
8. **Collaborative Filtering**: Recommend programs based on successful grants
9. **Dashboard Widgets**: Add agency/program widgets to main dashboard
10. **Email Alerts**: Notify users of significant changes in funding patterns

### Technical Improvements
1. **Pagination**: Add pagination for large datasets
2. **Virtual Scrolling**: Implement for long lists
3. **Data Export Formats**: Support Excel, JSON formats
4. **Print-Friendly Views**: CSS for printing reports
5. **Accessibility**: Enhanced screen reader support
6. **Internationalization**: Multi-language support
7. **Dark Mode**: Theme support for charts

## API Rate Limiting

The API endpoint respects organization-level authentication and enforces:
- User must be authenticated
- User must be a member of the requested organization
- No rate limiting currently implemented (consider adding for production)

## Security Considerations

1. **Authentication Required**: All endpoints require valid session token
2. **Organization-Based Access**: Users can only view data for their organizations
3. **SQL Injection Protection**: Supabase client handles parameterization
4. **CORS Configuration**: Configured for frontend access only
5. **Input Validation**: API validates all input parameters

## Troubleshooting

### Issue: Charts not rendering
- **Solution**: Ensure recharts is installed (`npm install recharts`)
- **Solution**: Check browser console for errors
- **Solution**: Verify data is being returned from API

### Issue: No data showing
- **Solution**: Verify grants have agency or program fields populated
- **Solution**: Check date filters aren't excluding all data
- **Solution**: Verify database migration has been applied

### Issue: CSV export not working
- **Solution**: Check browser allows downloads
- **Solution**: Verify API endpoint is accessible
- **Solution**: Check for CORS errors in browser console

### Issue: Navigation link missing
- **Solution**: Clear browser cache and refresh
- **Solution**: Verify AppHeader.tsx changes are deployed
- **Solution**: Check if user is authenticated

## Metrics and Insights

The analytics page provides the following key insights:

1. **Funding Distribution**: Understand which agencies provide the most funding
2. **Program Performance**: Identify most successful programs
3. **Temporal Trends**: Track funding growth or decline over time
4. **Status Analysis**: See conversion rates from saved to awarded
5. **Portfolio Diversity**: Assess funding source diversification
6. **Average Funding**: Understand typical grant sizes by agency/program
7. **Success Patterns**: Identify which agencies/programs have highest award rates

## Support and Maintenance

### Regular Maintenance Tasks
1. Monitor API performance and response times
2. Review database query efficiency
3. Update chart libraries when new versions available
4. Gather user feedback on report usefulness
5. Add new visualization types based on user needs

### Known Limitations
1. Funding calculations depend on accurate `award_amount` and `requested_amount` data
2. Timeline granularity limited to month, quarter, or year
3. Top 10 limitation on bar charts (by design for readability)
4. CSV export doesn't include charts (consider PDF for visual exports)

## Conclusion

This implementation provides a comprehensive analytics solution for understanding grant funding by agency and program. The modular design allows for easy extension and the export capabilities ensure users can further analyze data in their preferred tools.

For questions or issues, please refer to the troubleshooting section or contact the development team.
