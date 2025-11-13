/**
 * Email Templates for Scheduled Reports
 *
 * Generates HTML emails for weekly digests and monthly summaries
 */

interface WeeklyDigestData {
  orgName: string;
  userName: string;
  newGrants: Array<{
    id: string;
    title: string;
    agency: string;
    close_date: string | null;
    saved_at: string;
  }>;
  upcomingDeadlines: Array<{
    id: string;
    title: string;
    agency: string;
    close_date: string;
    pipeline_stage: string;
  }>;
  teamActivity: Array<{
    id: string;
    action: string;
    entity_type: string;
    created_at: string;
    user_profiles: { full_name: string };
  }>;
}

interface MonthlySummaryData {
  orgName: string;
  userName: string;
  month: string;
  submissions: {
    total: number;
    byStage: Record<string, number>;
  };
  awards: {
    total: number;
    totalAmount: number;
  };
  pipelineHealth: {
    totalGrants: number;
    byStage: Record<string, number>;
    completionRate: number;
  };
}

/**
 * Generate Weekly Digest Email HTML
 */
export function generateWeeklyDigestEmail(data: WeeklyDigestData): string {
  const hasNewGrants = data.newGrants.length > 0;
  const hasDeadlines = data.upcomingDeadlines.length > 0;
  const hasActivity = data.teamActivity.length > 0;

  const newGrantsHTML = hasNewGrants
    ? `
    <tr>
      <td style="padding: 24px 32px;">
        <h2 style="margin: 0 0 16px; font-size: 20px; color: #111827;">✨ New Grant Matches</h2>
        <p style="margin: 0 0 16px; font-size: 14px; color: #6b7280;">
          ${data.newGrants.length} new ${data.newGrants.length === 1 ? 'grant' : 'grants'} added to your workspace this week
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 6px; overflow: hidden;">
          ${data.newGrants
            .slice(0, 10)
            .map(
              (grant) => `
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
                <div style="font-weight: 600; color: #111827; margin-bottom: 4px;">${grant.title}</div>
                <div style="font-size: 13px; color: #6b7280;">
                  ${grant.agency}
                  ${grant.close_date ? ` • Closes ${new Date(grant.close_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                </div>
              </td>
            </tr>
          `
            )
            .join('')}
        </table>
        ${data.newGrants.length > 10 ? `<p style="margin: 12px 0 0; font-size: 13px; color: #6b7280;">And ${data.newGrants.length - 10} more...</p>` : ''}
      </td>
    </tr>
  `
    : '';

  const deadlinesHTML = hasDeadlines
    ? `
    <tr>
      <td style="padding: 24px 32px; ${hasNewGrants ? 'border-top: 1px solid #e5e7eb;' : ''}">
        <h2 style="margin: 0 0 16px; font-size: 20px; color: #111827;">📅 Upcoming Deadlines</h2>
        <p style="margin: 0 0 16px; font-size: 14px; color: #6b7280;">
          ${data.upcomingDeadlines.length} ${data.upcomingDeadlines.length === 1 ? 'grant is' : 'grants are'} due in the next 30 days
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 6px; overflow: hidden;">
          ${data.upcomingDeadlines
            .slice(0, 10)
            .map((grant) => {
              const daysUntil = Math.ceil(
                (new Date(grant.close_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              );
              const urgentStyle = daysUntil <= 7 ? 'background-color: #fecaca;' : '';
              return `
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #fbbf24; ${urgentStyle}">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                  <div style="flex: 1;">
                    <div style="font-weight: 600; color: #111827; margin-bottom: 4px;">${grant.title}</div>
                    <div style="font-size: 13px; color: #6b7280;">
                      ${grant.agency} • ${grant.pipeline_stage || 'In Progress'}
                    </div>
                  </div>
                  <div style="text-align: right; white-space: nowrap; margin-left: 16px;">
                    <div style="font-weight: 600; color: ${daysUntil <= 7 ? '#dc2626' : '#f59e0b'};">
                      ${daysUntil} ${daysUntil === 1 ? 'day' : 'days'}
                    </div>
                    <div style="font-size: 12px; color: #6b7280;">
                      ${new Date(grant.close_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          `;
            })
            .join('')}
        </table>
        ${data.upcomingDeadlines.length > 10 ? `<p style="margin: 12px 0 0; font-size: 13px; color: #6b7280;">And ${data.upcomingDeadlines.length - 10} more...</p>` : ''}
      </td>
    </tr>
  `
    : '';

  const activityHTML = hasActivity
    ? `
    <tr>
      <td style="padding: 24px 32px; ${hasNewGrants || hasDeadlines ? 'border-top: 1px solid #e5e7eb;' : ''}">
        <h2 style="margin: 0 0 16px; font-size: 20px; color: #111827;">👥 Team Activity</h2>
        <p style="margin: 0 0 16px; font-size: 14px; color: #6b7280;">
          Recent updates from your team
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; border-radius: 6px; overflow: hidden;">
          ${data.teamActivity
            .slice(0, 10)
            .map((activity) => {
              const actionText = formatActivityAction(activity.action, activity.entity_type);
              return `
            <tr>
              <td style="padding: 10px 16px; border-bottom: 1px solid #e5e7eb;">
                <div style="font-size: 14px; color: #374151;">
                  <strong>${activity.user_profiles.full_name}</strong> ${actionText}
                </div>
                <div style="font-size: 12px; color: #9ca3af; margin-top: 2px;">
                  ${new Date(activity.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </div>
              </td>
            </tr>
          `;
            })
            .join('')}
        </table>
      </td>
    </tr>
  `
    : '';

  const emptyStateHTML =
    !hasNewGrants && !hasDeadlines && !hasActivity
      ? `
    <tr>
      <td style="padding: 48px 32px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
        <h2 style="margin: 0 0 8px; font-size: 20px; color: #111827;">All Caught Up!</h2>
        <p style="margin: 0; font-size: 14px; color: #6b7280;">
          No new activity this week. Check back next week for updates.
        </p>
      </td>
    </tr>
  `
      : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Digest</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 28px; color: #ffffff; text-align: center;">📊 Weekly Digest</h1>
              <p style="margin: 8px 0 0; font-size: 16px; color: rgba(255,255,255,0.9); text-align: center;">
                Your weekly summary for ${data.orgName}
              </p>
            </td>
          </tr>

          <!-- Content Sections -->
          ${newGrantsHTML}
          ${deadlinesHTML}
          ${activityHTML}
          ${emptyStateHTML}

          <!-- CTA Button -->
          <tr>
            <td style="padding: 32px; text-align: center; border-top: 1px solid #e5e7eb;">
              <a href="https://grantcue.com/pipeline" style="display: inline-block; padding: 14px 36px; background-color: #7c3aed; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                View Your Pipeline
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e5e7eb; background-color: #f9fafb; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 13px; color: #6b7280; text-align: center;">
                You're receiving this weekly digest for ${data.orgName}.
                <br>
                <a href="https://grantcue.com/settings/reports" style="color: #7c3aed; text-decoration: none;">Manage report settings</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate Monthly Summary Email HTML
 */
export function generateMonthlySummaryEmail(data: MonthlySummaryData): string {
  const stagesHTML = Object.entries(data.pipelineHealth.byStage)
    .map(
      ([stage, count]) => `
    <tr>
      <td style="padding: 8px 16px; border-bottom: 1px solid #e5e7eb;">
        <div style="display: flex; justify-content: space-between;">
          <span style="font-size: 14px; color: #374151;">${stage}</span>
          <span style="font-weight: 600; color: #111827;">${count}</span>
        </div>
      </td>
    </tr>
  `
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Monthly Summary</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 28px; color: #ffffff; text-align: center;">📈 Monthly Summary</h1>
              <p style="margin: 8px 0 0; font-size: 16px; color: rgba(255,255,255,0.9); text-align: center;">
                ${data.month} • ${data.orgName}
              </p>
            </td>
          </tr>

          <!-- Key Metrics -->
          <tr>
            <td style="padding: 32px 32px 24px;">
              <h2 style="margin: 0 0 20px; font-size: 20px; color: #111827; text-align: center;">Key Metrics</h2>
              <table width="100%" cellpadding="0" cellspacing="12">
                <tr>
                  <!-- Submissions -->
                  <td width="33%" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; padding: 20px; text-align: center;">
                    <div style="font-size: 36px; font-weight: 700; color: #ffffff; margin-bottom: 8px;">
                      ${data.submissions.total}
                    </div>
                    <div style="font-size: 14px; color: rgba(255,255,255,0.9); font-weight: 500;">
                      Submissions
                    </div>
                  </td>
                  <!-- Awards -->
                  <td width="33%" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 8px; padding: 20px; text-align: center;">
                    <div style="font-size: 36px; font-weight: 700; color: #ffffff; margin-bottom: 8px;">
                      ${data.awards.total}
                    </div>
                    <div style="font-size: 14px; color: rgba(255,255,255,0.9); font-weight: 500;">
                      Awards
                    </div>
                  </td>
                  <!-- Total Amount -->
                  <td width="33%" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); border-radius: 8px; padding: 20px; text-align: center;">
                    <div style="font-size: 28px; font-weight: 700; color: #ffffff; margin-bottom: 8px;">
                      $${formatCurrency(data.awards.totalAmount)}
                    </div>
                    <div style="font-size: 14px; color: rgba(255,255,255,0.9); font-weight: 500;">
                      Awarded
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Pipeline Health -->
          <tr>
            <td style="padding: 0 32px 24px;">
              <h2 style="margin: 0 0 16px; font-size: 20px; color: #111827;">💼 Pipeline Health</h2>
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                  <span style="font-size: 14px; color: #6b7280;">Total Active Grants</span>
                  <span style="font-weight: 600; color: #111827; font-size: 18px;">${data.pipelineHealth.totalGrants}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="font-size: 14px; color: #6b7280;">Completion Rate</span>
                  <span style="font-weight: 600; color: ${data.pipelineHealth.completionRate >= 50 ? '#10b981' : '#f59e0b'}; font-size: 18px;">
                    ${data.pipelineHealth.completionRate.toFixed(1)}%
                  </span>
                </div>
              </div>

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 6px; overflow: hidden;">
                ${stagesHTML}
              </table>
            </td>
          </tr>

          <!-- Submissions Breakdown -->
          ${
            data.submissions.total > 0
              ? `
          <tr>
            <td style="padding: 0 32px 24px;">
              <h2 style="margin: 0 0 16px; font-size: 20px; color: #111827;">📝 Submissions by Stage</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ecfdf5; border-radius: 6px; overflow: hidden;">
                ${Object.entries(data.submissions.byStage)
                  .map(
                    ([stage, count]) => `
                  <tr>
                    <td style="padding: 8px 16px; border-bottom: 1px solid #d1fae5;">
                      <div style="display: flex; justify-content: space-between;">
                        <span style="font-size: 14px; color: #065f46;">${stage}</span>
                        <span style="font-weight: 600; color: #047857;">${count}</span>
                      </div>
                    </td>
                  </tr>
                `
                  )
                  .join('')}
              </table>
            </td>
          </tr>
          `
              : ''
          }

          <!-- CTA Button -->
          <tr>
            <td style="padding: 32px; text-align: center; border-top: 1px solid #e5e7eb;">
              <a href="https://grantcue.com/metrics" style="display: inline-block; padding: 14px 36px; background-color: #7c3aed; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                View Detailed Metrics
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e5e7eb; background-color: #f9fafb; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 13px; color: #6b7280; text-align: center;">
                You're receiving this monthly summary for ${data.orgName}.
                <br>
                <a href="https://grantcue.com/settings/reports" style="color: #7c3aed; text-decoration: none;">Manage report settings</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Helper function to format activity actions
 */
function formatActivityAction(action: string, entityType: string): string {
  const actionMap: Record<string, string> = {
    created: `created a ${entityType}`,
    updated: `updated a ${entityType}`,
    deleted: `deleted a ${entityType}`,
    commented: `commented on a ${entityType}`,
    status_changed: `changed the status of a ${entityType}`,
    stage_changed: `moved a ${entityType} to a new stage`,
  };

  return actionMap[action] || `performed an action on a ${entityType}`;
}

/**
 * Helper function to format currency
 */
function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)}K`;
  }
  return amount.toString();
}
