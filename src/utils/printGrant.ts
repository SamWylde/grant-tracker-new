import dayjs from 'dayjs';

interface Grant {
  id: string;
  external_id: string;
  title: string;
  agency: string | null;
  aln: string | null;
  open_date: string | null;
  close_date: string | null;
  status: string;
  priority: string | null;
  notes: string | null;
  assigned_to: string | null;
}

interface Task {
  id: string;
  title: string;
  completed: boolean;
  due_date: string | null;
}

/**
 * Print a single grant as a detailed brief
 */
export function printGrantBrief(grant: Grant, tasks?: Task[], assigneeName?: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print the grant brief');
    return;
  }

  const daysUntilDeadline = grant.close_date
    ? dayjs(grant.close_date).diff(dayjs(), 'days')
    : null;

  const isOverdue = daysUntilDeadline !== null && daysUntilDeadline < 0;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Grant Brief: ${grant.title}</title>
        <style>
          @page {
            size: letter;
            margin: 0.75in;
          }

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #000;
          }

          .header {
            border-bottom: 3px solid #228be6;
            padding-bottom: 0.5rem;
            margin-bottom: 1.5rem;
          }

          h1 {
            font-size: 20pt;
            margin-bottom: 0.5rem;
            color: #1a1a1a;
          }

          h2 {
            font-size: 14pt;
            margin-top: 1.5rem;
            margin-bottom: 0.75rem;
            color: #228be6;
            border-bottom: 1px solid #e9ecef;
            padding-bottom: 0.25rem;
          }

          .metadata {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
            margin-bottom: 1.5rem;
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 4px;
          }

          .metadata-item {
            margin-bottom: 0.5rem;
          }

          .metadata-label {
            font-weight: 600;
            color: #495057;
            margin-bottom: 0.25rem;
          }

          .metadata-value {
            color: #1a1a1a;
          }

          .badge {
            display: inline-block;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 9pt;
            font-weight: 600;
            margin-right: 0.5rem;
          }

          .badge-urgent { background: #ffe0e0; color: #c92a2a; }
          .badge-high { background: #fff4e6; color: #d9480f; }
          .badge-medium { background: #e7f5ff; color: #1971c2; }
          .badge-low { background: #f1f3f5; color: #495057; }

          .badge-researching { background: #e7f5ff; color: #1971c2; }
          .badge-drafting { background: #f3e5f5; color: #7c3aed; }
          .badge-submitted { background: #fff4e6; color: #d9480f; }
          .badge-awarded { background: #d3f9d8; color: #2f9e44; }

          .deadline-box {
            background: ${isOverdue ? '#ffe0e0' : '#fff4e6'};
            border-left: 4px solid ${isOverdue ? '#c92a2a' : '#f59f00'};
            padding: 1rem;
            margin: 1rem 0;
          }

          .deadline-box strong {
            font-size: 12pt;
            color: ${isOverdue ? '#c92a2a' : '#d9480f'};
          }

          .task-list {
            margin-top: 0.5rem;
          }

          .task-item {
            padding: 0.5rem 0;
            border-bottom: 1px solid #e9ecef;
            display: flex;
            align-items: flex-start;
          }

          .task-item:last-child {
            border-bottom: none;
          }

          .task-checkbox {
            width: 16px;
            height: 16px;
            border: 2px solid #495057;
            border-radius: 4px;
            margin-right: 0.75rem;
            flex-shrink: 0;
            margin-top: 0.25rem;
            position: relative;
          }

          .task-checkbox.completed {
            background: #228be6;
            border-color: #228be6;
          }

          .task-checkbox.completed::after {
            content: '✓';
            color: white;
            position: absolute;
            top: -2px;
            left: 2px;
            font-size: 12pt;
            font-weight: bold;
          }

          .task-content {
            flex: 1;
          }

          .task-title {
            font-weight: 500;
          }

          .task-title.completed {
            text-decoration: line-through;
            color: #868e96;
          }

          .task-due {
            font-size: 9pt;
            color: #868e96;
            margin-top: 0.25rem;
          }

          .notes {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 4px;
            white-space: pre-wrap;
            font-size: 10pt;
          }

          .footer {
            margin-top: 2rem;
            padding-top: 1rem;
            border-top: 1px solid #e9ecef;
            font-size: 9pt;
            color: #868e96;
            text-align: center;
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
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <h1>Grant Brief</h1>
              <div style="color: #868e96; margin-top: 0.25rem;">
                Generated ${dayjs().format('MMMM D, YYYY [at] h:mm A')}
              </div>
            </div>
            <div style="text-align: right;">
              ${grant.priority ? `<span class="badge badge-${grant.priority}">${grant.priority.toUpperCase()}</span>` : ''}
              <span class="badge badge-${grant.status}">${grant.status.toUpperCase()}</span>
            </div>
          </div>
        </div>

        <h1 style="margin-bottom: 1rem; font-size: 18pt;">${grant.title}</h1>

        ${grant.close_date ? `
          <div class="deadline-box">
            <strong>Deadline: ${dayjs(grant.close_date).format('MMMM D, YYYY')}</strong>
            ${daysUntilDeadline !== null ? `
              <div style="margin-top: 0.25rem;">
                ${isOverdue
                  ? `⚠ Overdue by ${Math.abs(daysUntilDeadline)} days`
                  : `${daysUntilDeadline} days remaining`
                }
              </div>
            ` : ''}
          </div>
        ` : ''}

        <div class="metadata">
          <div>
            ${grant.agency ? `
              <div class="metadata-item">
                <div class="metadata-label">Agency</div>
                <div class="metadata-value">${grant.agency}</div>
              </div>
            ` : ''}

            ${grant.aln ? `
              <div class="metadata-item">
                <div class="metadata-label">ALN</div>
                <div class="metadata-value">${grant.aln}</div>
              </div>
            ` : ''}

            ${grant.open_date ? `
              <div class="metadata-item">
                <div class="metadata-label">Open Date</div>
                <div class="metadata-value">${dayjs(grant.open_date).format('MMMM D, YYYY')}</div>
              </div>
            ` : ''}
          </div>

          <div>
            <div class="metadata-item">
              <div class="metadata-label">Grants.gov ID</div>
              <div class="metadata-value">${grant.external_id}</div>
            </div>

            ${assigneeName ? `
              <div class="metadata-item">
                <div class="metadata-label">Assigned To</div>
                <div class="metadata-value">${assigneeName}</div>
              </div>
            ` : ''}
          </div>
        </div>

        ${tasks && tasks.length > 0 ? `
          <h2>Tasks & Milestones</h2>
          <div class="task-list">
            ${tasks.map(task => `
              <div class="task-item">
                <div class="task-checkbox ${task.completed ? 'completed' : ''}"></div>
                <div class="task-content">
                  <div class="task-title ${task.completed ? 'completed' : ''}">${task.title}</div>
                  ${task.due_date ? `
                    <div class="task-due">Due: ${dayjs(task.due_date).format('MMM D, YYYY')}</div>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${grant.notes ? `
          <h2>Notes</h2>
          <div class="notes">${grant.notes}</div>
        ` : ''}

        <div class="footer">
          <div>Grant Brief • ${grant.title}</div>
          <div>View full details at: https://www.grants.gov/search-results-detail/${grant.external_id}</div>
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
