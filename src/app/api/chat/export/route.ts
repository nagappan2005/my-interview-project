import { NextRequest, NextResponse } from 'next/server';

interface ExportSource {
  id: string;
  filename: string;
  chunkIndex: number;
  content: string;
  score: number;
}

interface ExportMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ExportSource[];
  confidence?: number;
  feedback?: 'positive' | 'negative';
  timestamp: string;
}

interface ExportRequest {
  messages: ExportMessage[];
  options: {
    includeSources: boolean;
    includeTimestamps: boolean;
    format: 'pdf' | 'txt';
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTimestamp(ts: string): string {
  try {
    const date = new Date(ts);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return ts;
  }
}

function getConfidenceLabel(confidence: number | undefined): { label: string; color: string } {
  if (confidence === undefined || confidence === 0) return { label: 'N/A', color: '#6b7280' };
  if (confidence >= 0.2) return { label: 'High', color: '#34d399' };
  if (confidence >= 0.1) return { label: 'Medium', color: '#fbbf24' };
  return { label: 'Low', color: '#f87171' };
}

function generateHTML(messages: ExportMessage[], options: ExportRequest['options']): string {
  const now = new Date();
  const exportDate = now.toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const totalMessages = messages.length;
  const totalSources = messages.reduce((sum, m) => sum + (m.sources?.length ?? 0), 0);
  const userMessages = messages.filter((m) => m.role === 'user').length;
  const assistantMessages = messages.filter((m) => m.role === 'assistant').length;

  const messageSections = messages
    .map((msg, index) => {
      const isUser = msg.role === 'user';
      const roleLabel = isUser ? 'You' : 'DocQA Assistant';
      const roleIcon = isUser ? '&#128100;' : '&#10024;';
      const roleColor = isUser ? '#a78bfa' : '#34d399';
      const borderColor = isUser ? '#7c3aed' : '#059669';
      const bgColor = isUser ? 'rgba(124, 58, 237, 0.06)' : 'rgba(5, 150, 105, 0.06)';

      let html = `
      <div class="message ${isUser ? 'user-message' : 'assistant-message'}" style="margin-bottom: 24px; page-break-inside: avoid;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
          <div style="width: 32px; height: 32px; border-radius: 10px; background: ${bgColor}; border: 1px solid ${borderColor}33; display: flex; align-items: center; justify-content: center; font-size: 14px;">
            ${roleIcon}
          </div>
          <div style="flex: 1;">
            <span style="font-weight: 600; color: ${roleColor}; font-size: 13px;">${roleLabel}</span>
            ${options.includeTimestamps ? `<span style="font-size: 10px; color: #6b7280; margin-left: 10px;">${formatTimestamp(msg.timestamp)}</span>` : ''}
          </div>
          <span style="font-size: 10px; color: #374151; font-family: monospace;">#${index + 1}</span>
        </div>
        <div style="background: ${bgColor}; border-left: 3px solid ${borderColor}; border-radius: 0 10px 10px 0; padding: 14px 18px; margin-left: 21px;">
          <div style="color: #e5e7eb; font-size: 13px; line-height: 1.7; white-space: pre-wrap; word-break: break-word;">${escapeHtml(msg.content)}</div>
        </div>`;

      // Confidence indicator for assistant messages
      if (!isUser && msg.confidence !== undefined) {
        const conf = getConfidenceLabel(msg.confidence);
        const confPercent = Math.round(msg.confidence * 100);
        html += `
        <div style="margin-left: 21px; margin-top: 8px; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 10px; color: #6b7280;">Confidence:</span>
          <div style="width: 80px; height: 4px; background: #1f2937; border-radius: 2px; overflow: hidden;">
            <div style="width: ${confPercent}%; height: 100%; background: ${conf.color}; border-radius: 2px;"></div>
          </div>
          <span style="font-size: 10px; color: ${conf.color}; font-weight: 600;">${conf.label} (${confPercent}%)</span>
        </div>`;
      }

      // Source citations for assistant messages
      if (!isUser && options.includeSources && msg.sources && msg.sources.length > 0) {
        html += `
        <div style="margin-left: 21px; margin-top: 12px;">
          <div style="font-size: 11px; color: #a78bfa; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
            &#128218; Source Citations
            <span style="background: rgba(167, 139, 250, 0.15); color: #a78bfa; font-size: 9px; padding: 1px 6px; border-radius: 4px; font-weight: 700;">${msg.sources.length}</span>
          </div>`;

        msg.sources.forEach((source, srcIdx) => {
          const scorePercent = Math.round(source.score * 100);
          const scoreColor =
            source.score >= 0.2 ? '#34d399' : source.score >= 0.1 ? '#fbbf24' : '#6b7280';
          html += `
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 10px 14px; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="width: 20px; height: 20px; border-radius: 6px; background: rgba(167, 139, 250, 0.12); display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: #a78bfa;">${srcIdx + 1}</span>
                <span style="font-size: 11px; color: #9ca3af;">${escapeHtml(source.filename)}</span>
                <span style="font-size: 9px; color: #6b7280;">Chunk ${source.chunkIndex}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 50px; height: 3px; background: #1f2937; border-radius: 2px; overflow: hidden;">
                  <div style="width: ${Math.max(scorePercent, 2)}%; height: 100%; background: ${scoreColor}; border-radius: 2px;"></div>
                </div>
                <span style="font-size: 9px; color: ${scoreColor}; font-weight: 600;">${scorePercent}%</span>
              </div>
            </div>
            <div style="font-size: 11px; color: #6b7280; line-height: 1.6; white-space: pre-wrap; word-break: break-word; background: rgba(0,0,0,0.2); border-radius: 6px; padding: 8px 10px; max-height: 120px; overflow: hidden;">${escapeHtml(source.content)}</div>
          </div>`;
        });

        html += `</div>`;
      }

      html += `</div>`;
      return html;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DocQA Chat Export</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    @page {
      size: A4;
      margin: 20mm 15mm 25mm 15mm;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #000000;
      color: #f3f4f6;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    @media print {
      body { background: #111827; }
      .no-print { display: none !important; }
      .page-header { position: running(headerFixed); }
    }

    .page-header {
      background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%);
      border-bottom: 2px solid #7c3aed;
      padding: 10px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 100;
    }

    @media print {
      .page-header {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
      }
    }

    .header-logo {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header-logo-icon {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: linear-gradient(135deg, #7c3aed, #6d28d9);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }

    .header-logo-text {
      font-size: 14px;
      font-weight: 700;
      color: #a78bfa;
      letter-spacing: -0.3px;
    }

    .header-meta {
      font-size: 9px;
      color: #6b7280;
      text-align: right;
    }

    .content {
      margin-top: 60px;
      padding: 0 4px;
    }

    /* Title page */
    .title-page {
      text-align: center;
      padding: 80px 20px 60px;
      page-break-after: always;
    }

    .title-icon {
      width: 64px;
      height: 64px;
      border-radius: 20px;
      background: linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(109, 40, 217, 0.1));
      border: 1px solid rgba(124, 58, 237, 0.3);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      margin-bottom: 24px;
    }

    .title-page h1 {
      font-size: 28px;
      font-weight: 700;
      color: #f3f4f6;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }

    .title-page .subtitle {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 40px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      max-width: 480px;
      margin: 0 auto 40px;
    }

    .stat-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      padding: 16px 12px;
      text-align: center;
    }

    .stat-value {
      font-size: 22px;
      font-weight: 700;
      color: #a78bfa;
    }

    .stat-label {
      font-size: 10px;
      color: #6b7280;
      margin-top: 4px;
    }

    .export-info {
      font-size: 10px;
      color: #4b5563;
      margin-top: 32px;
    }

    .export-info span {
      color: #6b7280;
    }

    /* Footer with page number */
    .page-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 8px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9px;
      color: #4b5563;
      border-top: 1px solid rgba(255, 255, 255, 0.04);
      background: #000000;
    }

    @media print {
      .page-footer {
        position: fixed;
        bottom: 0;
      }
    }

    /* Messages */
    .message {
      margin-bottom: 24px;
      page-break-inside: avoid;
    }

    /* Print button */
    .print-btn {
      position: fixed;
      bottom: 30px;
      right: 30px;
      background: linear-gradient(135deg, #7c3aed, #6d28d9);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      z-index: 200;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 24px rgba(124, 58, 237, 0.4);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .print-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 30px rgba(124, 58, 237, 0.5);
    }
  </style>
</head>
<body>
  <!-- Fixed Header -->
  <div class="page-header no-print">
    <div class="header-logo">
      <div class="header-logo-icon">&#10024;</div>
      <span class="header-logo-text">DocQA</span>
    </div>
    <div class="header-meta">
      Chat Export &bull; ${escapeHtml(exportDate)}
    </div>
  </div>

  <!-- Content -->
  <div class="content">
    <!-- Title Page -->
    <div class="title-page">
      <div class="title-icon">&#128218;</div>
      <h1>DocQA Chat Export</h1>
      <div class="subtitle">Document Q&A Conversation Transcript</div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${totalMessages}</div>
          <div class="stat-label">Messages</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${userMessages}</div>
          <div class="stat-label">Questions</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${assistantMessages}</div>
          <div class="stat-label">Responses</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalSources}</div>
          <div class="stat-label">Sources</div>
        </div>
      </div>

      <div class="export-info">
        Exported on <span>${escapeHtml(exportDate)}</span><br/>
        ${options.includeSources ? '&#10003; Sources included' : '&#10007; Sources excluded'} &bull;
        ${options.includeTimestamps ? '&#10003; Timestamps included' : '&#10007; Timestamps excluded'}
      </div>
    </div>

    <!-- Messages -->
    ${messageSections}
  </div>

  <!-- Footer -->
  <div class="page-footer no-print">
    <span>DocQA Chat Export</span>
    <span>${escapeHtml(exportDate)}</span>
  </div>

  <!-- Print Button -->
  <button class="print-btn no-print" onclick="window.print()">
    &#128424; Save as PDF
  </button>

  <script>
    // Auto-trigger print dialog after a brief delay
    // Commented out to let user preview first — click the button to save
    // setTimeout(() => window.print(), 500);
  </script>
</body>
</html>`;
}

function generateTXT(messages: ExportMessage[], options: ExportRequest['options']): string {
  const now = new Date();
  const exportDate = now.toLocaleString();
  const separator = '─'.repeat(60);

  let text = '';
  text += `${separator}\n`;
  text += `  DocQA Chat Export\n`;
  text += `  Exported: ${exportDate}\n`;
  text += `  Messages: ${messages.length} | Sources: ${messages.reduce((s, m) => s + (m.sources?.length ?? 0), 0)}\n`;
  text += `${separator}\n\n`;

  messages.forEach((msg, index) => {
    const isUser = msg.role === 'user';
    const roleLabel = isUser ? 'YOU' : 'ASSISTANT';

    text += `${separator}\n`;
    text += `  [#${index + 1}] ${roleLabel}`;
    if (options.includeTimestamps) {
      text += ` — ${formatTimestamp(msg.timestamp)}`;
    }
    text += `\n`;
    text += `${separator}\n\n`;
    text += `${msg.content}\n\n`;

    if (!isUser && msg.confidence !== undefined && msg.confidence > 0) {
      const conf = getConfidenceLabel(msg.confidence);
      text += `  Confidence: ${conf.label} (${Math.round(msg.confidence * 100)}%)\n\n`;
    }

    if (!isUser && options.includeSources && msg.sources && msg.sources.length > 0) {
      text += `  Sources (${msg.sources.length}):\n`;
      msg.sources.forEach((source, srcIdx) => {
        const scorePercent = Math.round(source.score * 100);
        text += `    ${srcIdx + 1}. ${source.filename} (Chunk ${source.chunkIndex}, Score: ${scorePercent}%)\n`;
        text += `       ${source.content.substring(0, 200)}${source.content.length > 200 ? '...' : ''}\n\n`;
      });
    }
  });

  text += `${separator}\n`;
  text += `  End of Export — ${exportDate}\n`;
  text += `${separator}\n`;

  return text;
}

export async function POST(request: NextRequest) {
  try {
    const body: ExportRequest = await request.json();

    const { messages, options } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided for export' }, { status: 400 });
    }

    const format = options?.format || 'pdf';
    const includeSources = options?.includeSources !== false;
    const includeTimestamps = options?.includeTimestamps !== false;

    const exportOptions = { includeSources, includeTimestamps, format };

    if (format === 'txt') {
      const textContent = generateTXT(messages, exportOptions);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);

      return new NextResponse(textContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="docqa-export-${timestamp}.txt"`,
        },
      });
    }

    // Default: generate HTML for PDF printing
    const htmlContent = generateHTML(messages, exportOptions);

    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': 'inline; filename="docqa-export.html"',
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to generate export. Please try again.' },
      { status: 500 }
    );
  }
}
