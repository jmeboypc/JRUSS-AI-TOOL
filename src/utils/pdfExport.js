import jsPDF from 'jspdf';

/**
 * Strips basic Markdown symbols for clean plain-text measurement/rendering
 */
function stripMarkdownFormatting(text) {
  if (!text) return '';
  return text
    .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

/**
 * Exports markdown text to a clean, beautifully formatted PDF document.
 * Supports Portrait and Landscape orientations.
 *
 * @param {string} markdown - The raw markdown content to export
 * @param {string} fileName - Destination filename (.pdf)
 * @param {string} orientation - 'portrait' or 'landscape'
 */
export async function exportMarkdownToPdf(markdown, fileName = 'TeacherMaterials.pdf', orientation = 'portrait') {
  const isLandscape = orientation === 'landscape';
  
  // A4 dimensions in mm: portrait 210 x 297; landscape 297 x 210
  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = isLandscape ? 297 : 210;
  const pageHeight = isLandscape ? 210 : 297;
  const margin = 18;
  const contentWidth = pageWidth - (margin * 2);
  let y = margin;

  const checkPageBreak = (neededHeight) => {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
      return true;
    }
    return false;
  };

  const lines = (markdown || '').split(/\r?\n/);
  let inTable = false;
  let tableRows = [];

  const flushTable = () => {
    if (!inTable || tableRows.length === 0) return;

    const numCols = Math.max(...tableRows.map(r => r.length));
    if (numCols > 0) {
      const colWidth = contentWidth / numCols;
      const cellPadding = 2.5;

      checkPageBreak(12);

      tableRows.forEach((row, rIdx) => {
        const isHeader = rIdx === 0;
        doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
        doc.setFontSize(8.5);

        // Calculate max lines needed for any cell in this row
        let maxLines = 1;
        const cellWrappedTexts = [];
        for (let c = 0; c < numCols; c++) {
          const rawCell = stripMarkdownFormatting(row[c] || '');
          const wrapped = doc.splitTextToSize(rawCell, colWidth - (cellPadding * 2));
          cellWrappedTexts.push(wrapped);
          if (wrapped.length > maxLines) maxLines = wrapped.length;
        }

        const rowHeight = Math.max(7, maxLines * 4.2 + (cellPadding * 2));
        checkPageBreak(rowHeight);

        // Draw row backgrounds
        if (isHeader) {
          doc.setFillColor(241, 245, 249); // slate-100
          doc.rect(margin, y, contentWidth, rowHeight, 'F');
        } else if (rIdx % 2 === 1) {
          doc.setFillColor(248, 250, 252); // slate-50
          doc.rect(margin, y, contentWidth, rowHeight, 'F');
        }

        // Draw cell borders and text
        for (let c = 0; c < numCols; c++) {
          const cellX = margin + (c * colWidth);
          doc.setDrawColor(203, 213, 225); // slate-300
          doc.setLineWidth(0.2);
          doc.rect(cellX, y, colWidth, rowHeight, 'S');

          doc.setTextColor(isHeader ? 15 : 51, isHeader ? 23 : 65, isHeader ? 42 : 85);
          const wrapped = cellWrappedTexts[c];
          doc.text(wrapped, cellX + cellPadding, y + cellPadding + 3);
        }

        y += rowHeight;
      });

      y += 4;
    }

    tableRows = [];
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Table row detection
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const isSeparator = /^\|(\s*:?-+:?\s*\|)+$/.test(trimmed);
      if (isSeparator) continue;
      inTable = true;
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map(c => c.trim());
      tableRows.push(cells);
      continue;
    } else {
      if (inTable) flushTable();
    }

    // Empty line / paragraph gap
    if (!trimmed) {
      y += 3;
      continue;
    }

    // Divider
    if (/^(\*\*\*|---|___)$/.test(trimmed)) {
      checkPageBreak(6);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;
      continue;
    }

    // Headings
    const h1Match = trimmed.match(/^#\s+(.+)$/);
    const h2Match = trimmed.match(/^##\s+(.+)$/);
    const h3Match = trimmed.match(/^###\s+(.+)$/);
    const h4Match = trimmed.match(/^####+\s+(.+)$/);

    if (h1Match) {
      checkPageBreak(14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59); // slate-800
      const text = stripMarkdownFormatting(h1Match[1]);
      const wrapped = doc.splitTextToSize(text, contentWidth);
      doc.text(wrapped, margin, y);
      y += (wrapped.length * 7) + 3;
      continue;
    }

    if (h2Match) {
      checkPageBreak(11);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(71, 85, 105); // slate-600
      const text = stripMarkdownFormatting(h2Match[1]);
      const wrapped = doc.splitTextToSize(text, contentWidth);
      doc.text(wrapped, margin, y);
      y += (wrapped.length * 6) + 2.5;
      continue;
    }

    if (h3Match) {
      checkPageBreak(9);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(100, 116, 139); // slate-500
      const text = stripMarkdownFormatting(h3Match[1]);
      const wrapped = doc.splitTextToSize(text, contentWidth);
      doc.text(wrapped, margin, y);
      y += (wrapped.length * 5) + 2;
      continue;
    }

    if (h4Match) {
      checkPageBreak(8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      const text = stripMarkdownFormatting(h4Match[1]);
      const wrapped = doc.splitTextToSize(text, contentWidth);
      doc.text(wrapped, margin, y);
      y += (wrapped.length * 4.5) + 2;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      checkPageBreak(8);
      const quoteText = stripMarkdownFormatting(trimmed.replace(/^>\s*/, ''));
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9.5);
      doc.setTextColor(100, 116, 139);
      const wrapped = doc.splitTextToSize(quoteText, contentWidth - 8);
      
      const blockHeight = (wrapped.length * 4.5) + 2;
      checkPageBreak(blockHeight);
      
      // Draw bar on left
      doc.setDrawColor(139, 92, 246); // purple bar
      doc.setLineWidth(0.8);
      doc.line(margin, y - 3, margin, y - 3 + blockHeight);

      doc.text(wrapped, margin + 4, y);
      y += blockHeight + 1.5;
      continue;
    }

    // Bullet or numbered list item
    const bulletMatch = trimmed.match(/^([-*+]|\d+\.)\s+(.+)$/);
    if (bulletMatch) {
      checkPageBreak(6);
      const bulletSymbol = bulletMatch[1].endsWith('.') ? bulletMatch[1] : '•';
      const itemText = stripMarkdownFormatting(bulletMatch[2]);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      
      doc.text(bulletSymbol, margin + 2, y);
      
      const wrapped = doc.splitTextToSize(itemText, contentWidth - 8);
      doc.text(wrapped, margin + 7, y);
      y += (wrapped.length * 4.5) + 1.5;
      continue;
    }

    // Regular paragraph
    checkPageBreak(6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    const plainText = stripMarkdownFormatting(trimmed);
    const wrapped = doc.splitTextToSize(plainText, contentWidth);
    doc.text(wrapped, margin, y);
    y += (wrapped.length * 4.5) + 2;
  }

  if (inTable) flushTable();

  // Add subtle footer page numbering
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      `JRUSS Teaching Materials | Page ${p} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  // Trigger download
  const cleanName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  doc.save(cleanName);
}
