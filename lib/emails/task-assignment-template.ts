/**
 * Email Template for Task Assignment Notifications
 *
 * Generates HTML emails for task assignment and reassignment notifications
 */

interface TaskAssignmentEmailData {
  assignee_name: string;
  assigner_name: string;
  task_title: string;
  task_description?: string;
  task_due_date?: string;
  grant_title: string;
  grant_id: string;
  task_id: string;
  org_name: string;
  is_reassignment?: boolean;
}

/**
 * Generates HTML email for task assignment notifications
 */
export function generateTaskAssignmentEmail(data: TaskAssignmentEmailData): string {
  const actionText = data.is_reassignment ? 'reassigned' : 'assigned';
  const titleText = data.is_reassignment ? 'Task Reassigned to You' : 'New Task Assigned';

  // Format due date if provided
  const dueDateHTML = data.task_due_date
    ? `
    <tr>
      <td style="padding: 8px 0;">
        <strong style="color: #374151;">Due Date:</strong>
        <div style="margin-top: 4px; color: #111827;">
          ${new Date(data.task_due_date).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          })}
        </div>
      </td>
    </tr>
  `
    : '';

  // Format description if provided
  const descriptionHTML = data.task_description
    ? `
    <tr>
      <td style="padding: 8px 0;">
        <strong style="color: #374151;">Description:</strong>
        <div style="margin-top: 4px; padding: 12px; background-color: #f9fafb; border-radius: 6px; color: #111827;">
          ${data.task_description}
        </div>
      </td>
    </tr>
  `
    : '';

  const taskUrl = `https://grantcue.com/grants/${data.grant_id}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titleText}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; border-bottom: 1px solid #e5e7eb;">
              <h1 style="margin: 0; font-size: 24px; color: #111827;">✅ ${titleText}</h1>
              <p style="margin: 8px 0 0; font-size: 16px; color: #6b7280;">
                ${data.assigner_name} has ${actionText} a task to you.
              </p>
            </td>
          </tr>

          <!-- Task Details -->
          <tr>
            <td style="padding: 24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 8px 0;">
                    <strong style="color: #374151;">Task:</strong>
                    <div style="margin-top: 4px; font-size: 18px; font-weight: 600; color: #111827;">${data.task_title}</div>
                  </td>
                </tr>
                ${descriptionHTML}
                <tr>
                  <td style="padding: 8px 0;">
                    <strong style="color: #374151;">Grant:</strong>
                    <div style="margin-top: 4px; color: #111827;">${data.grant_title}</div>
                  </td>
                </tr>
                ${dueDateHTML}
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 24px 32px; text-align: center;">
              <a href="${taskUrl}" style="display: inline-block; padding: 12px 32px; background-color: #7c3aed; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">
                View Task Details
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e5e7eb; background-color: #f9fafb; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 14px; color: #6b7280; text-align: center;">
                You're receiving this email because you were assigned a task in ${data.org_name}.
                <br>
                <a href="https://grantcue.com/settings/notifications" style="color: #7c3aed; text-decoration: none;">Manage your notification settings</a>
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
