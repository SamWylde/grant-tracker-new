/**
 * Data Export Email Template
 *
 * Generates HTML email notification when a personal data export is ready for download
 */

/**
 * Data Export Ready Email Data Interface
 */
export interface DataExportReadyData {
  userName: string;
  userEmail: string;
  exportId: string;
  downloadToken: string;
  format: string;
  fileSize: number;
  expiresAt: string; // ISO 8601 date string
  requestedAt: string; // ISO 8601 date string
}

/**
 * Helper function to format file size
 */
function formatFileSize(bytes: number): string {
  if (bytes >= 1073741824) {
    return `${(bytes / 1073741824).toFixed(2)} GB`;
  } else if (bytes >= 1048576) {
    return `${(bytes / 1048576).toFixed(2)} MB`;
  } else if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${bytes} bytes`;
}

/**
 * Generate Data Export Ready Email HTML
 */
export function generateDataExportReadyEmail(data: DataExportReadyData): string {
  const expiresDate = new Date(data.expiresAt);
  const requestedDate = new Date(data.requestedAt);
  const daysUntilExpiry = Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const downloadUrl = `https://grantcue.com/api/data-export/download?token=${data.downloadToken}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Personal Data Export is Ready</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 26px; color: #ffffff; text-align: center;">
                🔒 Your Personal Data Export is Ready
              </h1>
              <p style="margin: 12px 0 0; font-size: 16px; color: rgba(255,255,255,0.9); text-align: center;">
                Download your complete data archive
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #111827;">
                Hi ${data.userName},
              </p>
              <p style="margin: 0 0 24px; font-size: 15px; color: #374151; line-height: 1.6;">
                Your personal data export that you requested on ${requestedDate.toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })} is now ready for download.
              </p>

              <!-- Export Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0;">
                          <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">Format</div>
                          <div style="font-size: 15px; font-weight: 600; color: #111827;">${data.format.toUpperCase()}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
                          <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">File Size</div>
                          <div style="font-size: 15px; font-weight: 600; color: #111827;">${formatFileSize(data.fileSize)}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
                          <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">Download Link Expires</div>
                          <div style="font-size: 15px; font-weight: 600; color: ${daysUntilExpiry <= 2 ? '#dc2626' : '#111827'};">
                            ${expiresDate.toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric'
                            })} (${daysUntilExpiry} ${daysUntilExpiry === 1 ? 'day' : 'days'})
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- What's Included -->
              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px; padding: 16px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px; font-size: 15px; color: #1e40af;">📦 What's Included</h3>
                <ul style="margin: 0; padding-left: 20px; color: #1e40af;">
                  <li style="margin-bottom: 6px; font-size: 14px;">Your profile information</li>
                  <li style="margin-bottom: 6px; font-size: 14px;">All grants you've saved or created</li>
                  <li style="margin-bottom: 6px; font-size: 14px;">Tasks assigned to you</li>
                  <li style="margin-bottom: 6px; font-size: 14px;">Comments and activity history</li>
                  <li style="margin-bottom: 6px; font-size: 14px;">Organization memberships</li>
                  <li style="margin-bottom: 6px; font-size: 14px;">Documents you've uploaded</li>
                  <li style="font-size: 14px;">Notification preferences</li>
                </ul>
              </div>

              <!-- Download Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center" style="padding: 24px 0;">
                    <a href="${downloadUrl}" style="display: inline-block; padding: 16px 48px; background-color: #7c3aed; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 18px; box-shadow: 0 2px 4px rgba(124, 58, 237, 0.3);">
                      Download Your Data
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Security Notice -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 16px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 8px; font-size: 15px; color: #92400e;">🔐 Security Notice</h3>
                <p style="margin: 0; font-size: 14px; color: #92400e; line-height: 1.5;">
                  This download link is unique and secure. It will expire in ${daysUntilExpiry} ${daysUntilExpiry === 1 ? 'day' : 'days'}.
                  For your privacy, the export file will be permanently deleted after expiration.
                  Please keep your downloaded data secure and don't share this link with anyone.
                </p>
              </div>

              <!-- Alternative Download Link -->
              <p style="margin: 0 0 16px; font-size: 13px; color: #6b7280; line-height: 1.5;">
                If the button above doesn't work, you can copy and paste this link into your browser:
              </p>
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 12px; margin-bottom: 24px; word-break: break-all;">
                <code style="font-size: 12px; color: #111827; font-family: 'Courier New', monospace;">
                  ${downloadUrl}
                </code>
              </div>

              <!-- Help -->
              <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.5;">
                Questions about your data export? Visit our
                <a href="https://grantcue.com/support" style="color: #7c3aed; text-decoration: none;">Help Center</a>
                or contact us at
                <a href="mailto:privacy@grantcue.com" style="color: #7c3aed; text-decoration: none;">privacy@grantcue.com</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e5e7eb; background-color: #f9fafb; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280; text-align: center;">
                This export was requested from IP address associated with ${data.userEmail}
              </p>
              <p style="margin: 0; font-size: 13px; color: #6b7280; text-align: center;">
                If you didn't request this export, please
                <a href="https://grantcue.com/security" style="color: #dc2626; text-decoration: none; font-weight: 600;">secure your account immediately</a>.
              </p>
            </td>
          </tr>
        </table>

        <!-- Privacy Notice -->
        <table width="600" cellpadding="0" cellspacing="0" style="margin-top: 24px;">
          <tr>
            <td style="padding: 16px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.6;">
                This export is part of your GDPR data portability rights.
                We take your privacy seriously and handle your data in accordance with our
                <a href="https://grantcue.com/privacy" style="color: #7c3aed; text-decoration: none;">Privacy Policy</a>.
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
