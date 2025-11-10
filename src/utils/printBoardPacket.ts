import dayjs from 'dayjs';

interface Grant {
  id: string;
  external_id: string;
  title: string;
  agency: string | null;
  aln: string | null;
  close_date: string | null;
  status: string;
  priority: string | null;
  assigned_to: string | null;
}

interface BoardPacketOptions {
  title?: string;
  includeTimeline?: boolean;
  filterByStatus?: string[];
  filterByPriority?: string[];
}

/**
 * Print multiple grants as a board packet / summary report
 */
export function printBoardPacket(
  grants: Grant[],
  options: BoardPacketOptions = {}
) {
  const {
    title = 'Grant Pipeline Board Packet',
    includeTimeline = true,
  } = options;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print the board packet');
    return;
  }

  // Sort grants by deadline
  const sortedGrants = [...grants].sort((a, b) => {
    if (!a.close_date) return 1;
    if (!b.close_date) return -1;
    return new Date(a.close_date).getTime() - new Date(b.close_date).getTime();
  });

  // Group grants by status
  const grantsByStatus = sortedGrants.reduce((acc, grant) => {
    const status = grant.status || 'unknown';
    if (!acc[status]) acc[status] = [];
    acc[status].push(grant);
    return acc;
  }, {} as Record<string, Grant[]>);

  // Calculate statistics
  const totalGrants = grants.length;

  const upcomingDeadlines = sortedGrants
    .filter(g => g.close_date && dayjs(g.close_date).diff(dayjs(), 'days') <= 30 && dayjs(g.close_date).diff(dayjs(), 'days') >= 0)
    .slice(0, 5);

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page {
            size: letter landscape;
            margin: 0.5in;
          }

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
            font-size: 10pt;
            line-height: 1.5;
            color: #000;
          }

          .header {
            border-bottom: 3px solid #228be6;
            padding-bottom: 0.5rem;
            margin-bottom: 1rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          h1 {
            font-size: 18pt;
            color: #1a1a1a;
          }

          h2 {
            font-size: 13pt;
            margin-top: 1.25rem;
            margin-bottom: 0.5rem;
            color: #228be6;
            border-bottom: 1px solid #e9ecef;
            padding-bottom: 0.25rem;
          }

          h3 {
            font-size: 11pt;
            margin-top: 1rem;
            margin-bottom: 0.5rem;
            color: #495057;
          }

          .stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 0.75rem;
            margin-bottom: 1.25rem;
          }

          .stat-card {
            background: #f8f9fa;
            padding: 0.75rem;
            border-radius: 4px;
            text-align: center;
          }

          .stat-value {
            font-size: 20pt;
            font-weight: 700;
            color: #228be6;
          }

          .stat-label {
            font-size: 9pt;
            color: #868e96;
            margin-top: 0.25rem;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 0.5rem;
            font-size: 9pt;
          }

          th {
            background: #f8f9fa;
            padding: 0.5rem;
            text-align: left;
            font-weight: 600;
            border-bottom: 2px solid #dee2e6;
          }

          td {
            padding: 0.5rem;
            border-bottom: 1px solid #e9ecef;
          }

          tr:hover {
            background: #f8f9fa;
          }

          .badge {
            display: inline-block;
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
            font-size: 8pt;
            font-weight: 600;
          }

          .badge-urgent { background: #ffe0e0; color: #c92a2a; }
          .badge-high { background: #fff4e6; color: #d9480f; }
          .badge-medium { background: #e7f5ff; color: #1971c2; }
          .badge-low { background: #f1f3f5; color: #495057; }

          .badge-researching { background: #e7f5ff; color: #1971c2; }
          .badge-drafting { background: #f3e5f5; color: #7c3aed; }
          .badge-submitted { background: #fff4e6; color: #d9480f; }
          .badge-awarded { background: #d3f9d8; color: #2f9e44; }
          .badge-rejected { background: #ffe0e0; color: #c92a2a; }
          .badge-withdrawn { background: #f1f3f5; color: #495057; }

          .deadline-urgent {
            color: #c92a2a;
            font-weight: 600;
          }

          .deadline-soon {
            color: #d9480f;
            font-weight: 600;
          }

          .timeline {
            margin-top: 1rem;
            padding: 1rem;
            background: #f8f9fa;
            border-radius: 4px;
          }

          .timeline-row {
            display: flex;
            align-items: center;
            margin-bottom: 0.75rem;
            padding-bottom: 0.75rem;
            border-bottom: 1px solid #dee2e6;
          }

          .timeline-row:last-child {
            margin-bottom: 0;
            padding-bottom: 0;
            border-bottom: none;
          }

          .timeline-date {
            width: 120px;
            flex-shrink: 0;
            font-weight: 600;
            color: #495057;
          }

          .timeline-grant {
            flex: 1;
          }

          .footer {
            margin-top: 1.5rem;
            padding-top: 0.75rem;
            border-top: 1px solid #e9ecef;
            font-size: 8pt;
            color: #868e96;
            text-align: center;
            page-break-after: avoid;
          }

          .page-break {
            page-break-before: always;
          }

          @media print {
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>${title}</h1>
            <div style="color: #868e96; font-size: 9pt; margin-top: 0.25rem;">
              Generated ${dayjs().format('MMMM D, YYYY [at] h:mm A')}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 9pt; color: #868e96;">Total Grants</div>
            <div style="font-size: 24pt; font-weight: 700; color: #228be6;">${totalGrants}</div>
          </div>
        </div>

        <div class="stats">
          <div class="stat-card">
            <div class="stat-value">${grantsByStatus.researching?.length || 0}</div>
            <div class="stat-label">RESEARCHING</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${grantsByStatus.drafting?.length || 0}</div>
            <div class="stat-label">DRAFTING</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${grantsByStatus.submitted?.length || 0}</div>
            <div class="stat-label">SUBMITTED</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${grantsByStatus.awarded?.length || 0}</div>
            <div class="stat-label">AWARDED</div>
          </div>
        </div>

        ${upcomingDeadlines.length > 0 ? `
          <h2>⚡ Upcoming Deadlines (Next 30 Days)</h2>
          <table>
            <thead>
              <tr>
                <th>Deadline</th>
                <th>Grant Title</th>
                <th>Agency</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Days Left</th>
              </tr>
            </thead>
            <tbody>
              ${upcomingDeadlines.map(grant => {
                const daysLeft = grant.close_date ? dayjs(grant.close_date).diff(dayjs(), 'days') : null;
                const isUrgent = daysLeft !== null && daysLeft <= 7;
                return `
                  <tr>
                    <td class="${isUrgent ? 'deadline-urgent' : 'deadline-soon'}">
                      ${grant.close_date ? dayjs(grant.close_date).format('MMM D, YYYY') : 'N/A'}
                    </td>
                    <td><strong>${grant.title}</strong></td>
                    <td>${grant.agency || 'N/A'}</td>
                    <td><span class="badge badge-${grant.status}">${grant.status.toUpperCase()}</span></td>
                    <td>${grant.priority ? `<span class="badge badge-${grant.priority}">${grant.priority.toUpperCase()}</span>` : ''}</td>
                    <td class="${isUrgent ? 'deadline-urgent' : 'deadline-soon'}">${daysLeft} days</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        ` : ''}

        <h2>All Grants by Status</h2>

        ${Object.entries(grantsByStatus).map(([status, statusGrants]) => `
          <h3>${status.charAt(0).toUpperCase() + status.slice(1)} (${statusGrants.length})</h3>
          <table>
            <thead>
              <tr>
                <th>Grant Title</th>
                <th>Agency</th>
                <th>ALN</th>
                <th>Priority</th>
                <th>Deadline</th>
              </tr>
            </thead>
            <tbody>
              ${statusGrants.map(grant => {
                const daysLeft = grant.close_date ? dayjs(grant.close_date).diff(dayjs(), 'days') : null;
                const isOverdue = daysLeft !== null && daysLeft < 0;
                const isUrgent = daysLeft !== null && daysLeft <= 7 && daysLeft >= 0;
                return `
                  <tr>
                    <td><strong>${grant.title}</strong></td>
                    <td>${grant.agency || 'N/A'}</td>
                    <td>${grant.aln || 'N/A'}</td>
                    <td>${grant.priority ? `<span class="badge badge-${grant.priority}">${grant.priority.toUpperCase()}</span>` : ''}</td>
                    <td class="${isOverdue ? 'deadline-urgent' : isUrgent ? 'deadline-soon' : ''}">
                      ${grant.close_date ? dayjs(grant.close_date).format('MMM D, YYYY') : 'No deadline'}
                      ${daysLeft !== null && !isOverdue ? ` (${daysLeft}d)` : ''}
                      ${isOverdue ? ` (OVERDUE)` : ''}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `).join('')}

        ${includeTimeline && upcomingDeadlines.length > 0 ? `
          <div class="page-break"></div>
          <h2>📅 Timeline View - Next 30 Days</h2>
          <div class="timeline">
            ${upcomingDeadlines.map(grant => `
              <div class="timeline-row">
                <div class="timeline-date">${grant.close_date ? dayjs(grant.close_date).format('MMM D, YYYY') : 'TBD'}</div>
                <div class="timeline-grant">
                  <div><strong>${grant.title}</strong></div>
                  <div style="font-size: 8pt; color: #868e96; margin-top: 0.25rem;">
                    ${grant.agency || 'N/A'} •
                    <span class="badge badge-${grant.status}">${grant.status.toUpperCase()}</span>
                    ${grant.priority ? `<span class="badge badge-${grant.priority}">${grant.priority.toUpperCase()}</span>` : ''}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div class="footer">
          <div>Grant Pipeline Board Packet • ${grants.length} Total Grants</div>
          <div style="margin-top: 0.25rem;">For internal use only • Generated by GrantCue</div>
        </div>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();

  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
}
