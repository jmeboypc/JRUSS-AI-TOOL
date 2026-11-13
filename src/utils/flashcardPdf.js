import jsPDF from 'jspdf';

/**
 * Parses pasted lines into { front, back } flashcard pairs.
 * Supports tab-separated (Excel/Quizlet), pipe (|), colon (:), spaced dash ( - ), or CSV (,).
 */
export function parseFlashcardInput(rawText) {
  if (!rawText || !rawText.trim()) return [];
  const lines = rawText.split(/\r?\n/);
  const cards = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    let front = '';
    let back = '';

    if (line.includes('\t')) {
      const idx = line.indexOf('\t');
      front = line.slice(0, idx).trim();
      back = line.slice(idx + 1).trim();
    } else if (line.includes('|')) {
      const idx = line.indexOf('|');
      front = line.slice(0, idx).trim();
      back = line.slice(idx + 1).trim();
    } else if (line.includes(':')) {
      const idx = line.indexOf(':');
      front = line.slice(0, idx).trim();
      back = line.slice(idx + 1).trim();
    } else if (/\s[-–—]\s/.test(line)) {
      const match = line.match(/\s[-–—]\s/);
      front = line.slice(0, match.index).trim();
      back = line.slice(match.index + match[0].length).trim();
    } else if (line.includes(',')) {
      const idx = line.indexOf(',');
      front = line.slice(0, idx).trim();
      back = line.slice(idx + 1).trim();
    } else {
      front = line;
      back = '';
    }

    if (front || back) {
      cards.push({ front, back });
    }
  }

  return cards;
}

const ACCENT_RGB = {
  indigo: [79, 70, 229],
  emerald: [16, 185, 129],
  teal: [13, 148, 136],
  amber: [217, 119, 6],
  slate: [51, 65, 85],
};

/**
 * Draws centered, auto-wrapped text inside a card rectangle, scaling font size down if needed.
 */
function drawCenteredCardText(doc, text, x, y, w, h, { maxFont = 13, minFont = 7.5, bold = false, color = [15, 23, 42] } = {}) {
  const padX = 6;
  const padY = 8;
  const maxWidth = w - padX * 2;
  const maxHeight = h - padY * 2;

  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setTextColor(...color);

  let fontSize = maxFont;
  let lines = [];
  let lineHeight = fontSize * 0.45;

  while (fontSize >= minFont) {
    doc.setFontSize(fontSize);
    lines = doc.splitTextToSize(text || '', maxWidth);
    lineHeight = fontSize * 0.44;
    const totalHeight = lines.length * lineHeight;
    if (totalHeight <= maxHeight) break;
    fontSize -= 0.5;
  }

  const totalTextHeight = lines.length * lineHeight;
  const startY = y + (h - totalTextHeight) / 2 + lineHeight * 0.78;
  doc.text(lines, x + w / 2, startY, { align: 'center', lineHeightFactor: 1.25 });
}

/**
 * Generates and downloads a print-ready A4 PDF of flashcards or match-up cards.
 */
export function generateFlashcardsPdf(cards, options = {}) {
  const {
    title = 'Revision Flashcards',
    mode = 'duplex', // 'duplex' | 'matchup'
    cardsPerPage = 8, // 8 (2x4), 6 (2x3), 4 (2x2)
    accent = 'indigo',
    showCutGuides = true,
  } = options;

  if (!cards || cards.length === 0) return;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const marginX = 12;
  const headerH = 14;
  const marginBottom = 12;
  const gap = 4;

  const rgb = ACCENT_RGB[accent] || ACCENT_RGB.indigo;
  const cols = 2;
  const rows = mode === 'matchup' ? Math.max(2, Math.floor(cardsPerPage / 2)) : Math.max(2, Math.floor(cardsPerPage / 2));
  const perPage = mode === 'matchup' ? rows : cols * rows;

  const usableW = pageW - marginX * 2;
  const usableH = pageH - headerH - marginBottom;
  const cardW = (usableW - gap * (cols - 1)) / cols;
  const cardH = (usableH - gap * (rows - 1)) / rows;

  const drawPageHeader = (subtitle) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...rgb);
    doc.text(title || 'Revision Flashcards', marginX, 9.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(subtitle, pageW - marginX, 9.5, { align: 'right' });
  };

  const drawCardFrame = (x, y, labelText, isFront) => {
    // Card border
    doc.setDrawColor(showCutGuides ? 180 : 210, showCutGuides ? 188 : 216, showCutGuides ? 200 : 224);
    doc.setLineWidth(0.35);
    if (showCutGuides && doc.setLineDashPattern) {
      doc.setLineDashPattern([2, 2], 0);
    }
    doc.roundedRect(x, y, cardW, cardH, 2.5, 2.5, 'S');
    if (doc.setLineDashPattern) {
      doc.setLineDashPattern([], 0);
    }

    // Top accent bar inside card
    doc.setFillColor(...(isFront ? rgb : [241, 245, 249]));
    doc.rect(x + 0.3, y + 0.3, cardW - 0.6, 5.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...(isFront ? [255, 255, 255] : [71, 85, 105]));
    doc.text(labelText, x + 3.5, y + 4.1);
  };

  const totalPages = Math.ceil(cards.length / perPage);

  if (mode === 'matchup') {
    // Match-up mode: each row is [Term] | [Definition] on the same page
    for (let p = 0; p < totalPages; p++) {
      if (p > 0) doc.addPage();
      drawPageHeader(`Match-Up Cut-Out Sheet • Page ${p + 1} of ${totalPages}`);

      const slice = cards.slice(p * perPage, (p + 1) * perPage);
      slice.forEach((card, r) => {
        const y = headerH + r * (cardH + gap);
        const xLeft = marginX;
        const xRight = marginX + cardW + gap;
        const cardNum = p * perPage + r + 1;

        drawCardFrame(xLeft, y, `TERM #${cardNum}`, true);
        drawCenteredCardText(doc, card.front, xLeft, y + 5, cardW, cardH - 5, {
          maxFont: 13,
          bold: true,
          color: [15, 23, 42],
        });

        drawCardFrame(xRight, y, `DEFINITION #${cardNum}`, false);
        drawCenteredCardText(doc, card.back, xRight, y + 5, cardW, cardH - 5, {
          maxFont: 11,
          bold: false,
          color: [30, 41, 59],
        });
      });
    }
  } else {
    // Duplex mode: Fronts page, then horizontally mirrored Backs page
    for (let p = 0; p < totalPages; p++) {
      if (p > 0) doc.addPage();
      const slice = cards.slice(p * perPage, (p + 1) * perPage);

      // Page A: Fronts
      drawPageHeader(`FRONTS (Print Duplex: Flip on Long Edge) • Set ${p + 1} of ${totalPages}`);
      slice.forEach((card, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = marginX + col * (cardW + gap);
        const y = headerH + row * (cardH + gap);
        const cardNum = p * perPage + idx + 1;

        drawCardFrame(x, y, `CARD ${cardNum} • TERM`, true);
        drawCenteredCardText(doc, card.front, x, y + 5, cardW, cardH - 5, {
          maxFont: 13.5,
          bold: true,
          color: [15, 23, 42],
        });
      });

      // Page B: Backs (mirrored horizontally per row so long-edge duplex aligns)
      doc.addPage();
      drawPageHeader(`BACKS (Mirrored for Duplex Printing) • Set ${p + 1} of ${totalPages}`);
      slice.forEach((card, idx) => {
        const col = idx % cols;
        const mirroredCol = cols - 1 - col;
        const row = Math.floor(idx / cols);
        const x = marginX + mirroredCol * (cardW + gap);
        const y = headerH + row * (cardH + gap);
        const cardNum = p * perPage + idx + 1;

        drawCardFrame(x, y, `CARD ${cardNum} • ANSWER`, false);
        drawCenteredCardText(doc, card.back, x, y + 5, cardW, cardH - 5, {
          maxFont: 11,
          bold: false,
          color: [30, 41, 59],
        });
      });
    }
  }

  const safeName = (title || 'Revision_Flashcards').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`${safeName}.pdf`);
}
