import JSZip from 'jszip';

/**
 * Escapes characters for XML
 */
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Pre-processes text to clean raw markdown artifacts, checkboxes, and inline HTML
 */
function cleanMarkdownArtifacts(text) {
  if (!text) return '';
  return text
    // Replace checkboxes
    .replace(/\[\s\]/g, '☐ ')
    .replace(/\[[xX]\]/g, '☑ ')
    // Replace <br> or <br/> with newline
    .replace(/<br\s*\/?>/gi, '\n')
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Strip image syntax ![alt](url) -> alt
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Strip HTML tags leaving inner text
    .replace(/<\/?(?:span|div|p|b|i|strong|em|code)[^>]*>/gi, '');
}

/**
 * Converts inline Markdown (bold, italic, code, strikethrough, links) into Word XML run elements.
 * Strips all residual markdown characters so no raw syntax leaks into Word documents.
 * 
 * @param {string} text - Raw inline text with Markdown
 * @param {object} baseStyle - Optional default typography (font, sz, color, bold)
 * @returns {string} Word OpenXML runs
 */
function formatInlineRuns(text, baseStyle = {}) {
  if (!text) return '';

  const cleanText = cleanMarkdownArtifacts(text);

  // Regex matching inline markdown elements:
  // 1: Bold-Italic (***...*** or ___...___)
  // 2: Bold (**...** or __...__)
  // 3: Italic (*...* or _..._)
  // 4: Strikethrough (~~...~~)
  // 5: Inline code (`...`)
  // 6: Markdown link ([text](url))
  // 7: Explicit line breaks (\n)
  const regex = /(\*\*\*[\s\S]+?\*\*\*|___[\s\S]+?___|\*\*[\s\S]+?\*\*|__[\s\S]+?__|(?<!\w)\*[^*\n]+?\*(?!\w)|(?<!\w)_[^_\n]+?_(?!\w)|~~[\s\S]+?~~|`[^`\n]+`|\[[^\]]+\]\([^)]+\)|\n)/g;

  const tokens = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(cleanText)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', val: cleanText.substring(lastIndex, match.index) });
    }
    const m = match[0];
    if (m === '\n') {
      tokens.push({ type: 'break' });
    } else if ((m.startsWith('***') && m.endsWith('***')) || (m.startsWith('___') && m.endsWith('___'))) {
      tokens.push({ type: 'bold-italic', val: m.slice(3, -3) });
    } else if ((m.startsWith('**') && m.endsWith('**')) || (m.startsWith('__') && m.endsWith('__'))) {
      tokens.push({ type: 'bold', val: m.slice(2, -2) });
    } else if ((m.startsWith('*') && m.endsWith('*')) || (m.startsWith('_') && m.endsWith('_'))) {
      tokens.push({ type: 'italic', val: m.slice(1, -1) });
    } else if (m.startsWith('~~') && m.endsWith('~~')) {
      tokens.push({ type: 'strike', val: m.slice(2, -2) });
    } else if (m.startsWith('`') && m.endsWith('`')) {
      tokens.push({ type: 'code', val: m.slice(1, -1) });
    } else if (m.startsWith('[')) {
      const linkMatch = m.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        tokens.push({ type: 'link', val: linkMatch[1], href: linkMatch[2] });
      } else {
        tokens.push({ type: 'text', val: m });
      }
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < cleanText.length) {
    tokens.push({ type: 'text', val: cleanText.substring(lastIndex) });
  }

  const baseRPr = [];
  if (baseStyle.font) baseRPr.push(`<w:rFonts w:ascii="${baseStyle.font}" w:hAnsi="${baseStyle.font}"/>`);
  if (baseStyle.bold) baseRPr.push('<w:b/>');
  if (baseStyle.color) baseRPr.push(`<w:color w:val="${baseStyle.color}"/>`);
  if (baseStyle.sz) baseRPr.push(`<w:sz w:val="${baseStyle.sz}"/>`);
  const baseRPrXml = baseRPr.join('');

  return tokens.map(tok => {
    if (tok.type === 'break') {
      return '<w:r><w:br/></w:r>';
    }

    // Strip any residual stray markdown tokens from value so asterisks never leak
    const cleanVal = (tok.val || '').replace(/[*_`~]/g, '');
    const escaped = escapeXml(cleanVal);

    switch (tok.type) {
      case 'bold':
        return `<w:r><w:rPr>${baseRPrXml}<w:b/></w:rPr><w:t xml:space="preserve">${escaped}</w:t></w:r>`;
      case 'italic':
        return `<w:r><w:rPr>${baseRPrXml}<w:i/></w:rPr><w:t xml:space="preserve">${escaped}</w:t></w:r>`;
      case 'bold-italic':
        return `<w:r><w:rPr>${baseRPrXml}<w:b/><w:i/></w:rPr><w:t xml:space="preserve">${escaped}</w:t></w:r>`;
      case 'strike':
        return `<w:r><w:rPr>${baseRPrXml}<w:strike/></w:rPr><w:t xml:space="preserve">${escaped}</w:t></w:r>`;
      case 'code':
        return `<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:color w:val="7C3AED"/><w:shd w:val="clear" w:color="auto" w:fill="F3F4F6"/></w:rPr><w:t xml:space="preserve">${escaped}</w:t></w:r>`;
      case 'link':
        return `<w:r><w:rPr>${baseRPrXml}<w:color w:val="2563EB"/><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">${escaped}</w:t></w:r>`;
      default:
        // Plain text: strip stray unparsed markdown if any
        return `<w:r>${baseRPrXml ? `<w:rPr>${baseRPrXml}</w:rPr>` : ''}<w:t xml:space="preserve">${escapeXml(cleanVal)}</w:t></w:r>`;
    }
  }).join('');
}

/**
 * Builds the Word OpenXML document content from markdown lines, converting all Markdown
 * syntax into Word structures (headings, tables, lists, quotes, dividers) without leaving
 * any markdown symbols behind.
 */
function markdownToWordXml(markdown, isVisionImpaired = false) {
  let cleaned = (markdown || '').trim();
  // Strip outer markdown fences if the whole response is enclosed in ```markdown ... ```
  cleaned = cleaned.replace(/^```(?:markdown|md)?\s*\r?\n([\s\S]*?)\r?\n```\s*$/i, '$1');

  const lines = cleaned.split(/\r?\n/);
  const elements = [];
  let inTable = false;
  let tableRows = [];
  let inCodeBlock = false;

  const flushTable = () => {
    if (!inTable || tableRows.length === 0) return;

    let tableXml = `<w:tbl>
      <w:tblPr>
        <w:tblStyle w:val="TableGrid"/>
        <w:tblW w:w="5000" w:type="pct"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
        </w:tblBorders>
      </w:tblPr>`;

    tableRows.forEach((row, rIdx) => {
      const isHeader = rIdx === 0;
      tableXml += `<w:tr>`;
      row.forEach(cell => {
        const bg = isHeader ? `<w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>` : '';
        tableXml += `<w:tc>
          <w:tcPr>
            ${bg}
            <w:tcMar>
              <w:top w:w="${isVisionImpaired ? '200' : '120'}" w:type="dxa"/>
              <w:bottom w:w="${isVisionImpaired ? '200' : '120'}" w:type="dxa"/>
              <w:left w:w="${isVisionImpaired ? '240' : '160'}" w:type="dxa"/>
              <w:right w:w="${isVisionImpaired ? '240' : '160'}" w:type="dxa"/>
            </w:tcMar>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:spacing w:after="0" w:line="${isVisionImpaired ? '360' : '240'}" w:lineRule="auto"/>
            </w:pPr>
            ${formatInlineRuns(cell, { bold: isHeader, font: isVisionImpaired ? 'Arial' : undefined, sz: isVisionImpaired ? '72' : undefined })}
          </w:p>
        </w:tc>`;
      });
      tableXml += `</w:tr>`;
    });

    tableXml += `</w:tbl><w:p/>`;
    elements.push(tableXml);
    tableRows = [];
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Code block toggle (```...)
    if (/^```/.test(trimmed)) {
      if (inTable) flushTable();
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      elements.push(`<w:p>
        <w:pPr>
          <w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/>
          <w:pBdr><w:left w:val="single" w:sz="12" w:space="8" w:color="CBD5E1"/></w:pBdr>
          <w:ind w:left="200" w:right="100"/>
          <w:spacing w:after="40" w:line="220" w:lineRule="auto"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>
            <w:color w:val="334155"/>
            <w:sz w:val="${isVisionImpaired ? '48' : '20'}"/>
          </w:rPr>
          <w:t xml:space="preserve">${escapeXml(rawLine)}</w:t>
        </w:r>
      </w:p>`);
      continue;
    }

    // Table row detection
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const isSeparator = /^\|(\s*:?-+:?\s*\|)+$/.test(trimmed);
      if (isSeparator) {
        continue;
      }
      inTable = true;
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map(c => c.trim());
      tableRows.push(cells);
      continue;
    } else {
      if (inTable) {
        flushTable();
      }
    }

    // Blank line
    if (!trimmed) {
      elements.push(`<w:p><w:pPr><w:spacing w:after="${isVisionImpaired ? '240' : '100'}"/></w:pPr></w:p>`);
      continue;
    }

    // Headings (H1 to H6)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      // Strip trailing #s
      const titleContent = headingMatch[2].replace(/\s+#+$/, '');

      let styleName = 'Heading1';
      let font = isVisionImpaired ? 'Arial' : 'Georgia';
      let sz = isVisionImpaired ? '112' : '36'; // 56pt vs 18pt
      let color = '1E293B';
      let before = isVisionImpaired ? '360' : '240';
      let after = isVisionImpaired ? '200' : '120';

      if (level === 2) {
        styleName = 'Heading2';
        font = isVisionImpaired ? 'Arial' : 'Georgia';
        sz = isVisionImpaired ? '104' : '28'; // 52pt vs 14pt
        color = '334155';
        before = isVisionImpaired ? '320' : '200';
        after = isVisionImpaired ? '160' : '80';
      } else if (level === 3) {
        styleName = 'Heading3';
        font = isVisionImpaired ? 'Arial' : 'Calibri';
        sz = isVisionImpaired ? '96' : '24'; // 48pt vs 12pt
        color = '475569';
        before = isVisionImpaired ? '280' : '160';
        after = isVisionImpaired ? '140' : '60';
      } else if (level >= 4) {
        styleName = `Heading${level}`;
        font = isVisionImpaired ? 'Arial' : 'Calibri';
        sz = isVisionImpaired ? '96' : '22'; // 48pt vs 11pt
        color = '64748B';
        before = isVisionImpaired ? '240' : '120';
        after = isVisionImpaired ? '120' : '40';
      }

      elements.push(`<w:p>
        <w:pPr>
          <w:pStyle w:val="${styleName}"/>
          <w:spacing w:before="${before}" w:after="${after}"/>
        </w:pPr>
        ${formatInlineRuns(titleContent, { font, sz, color, bold: true })}
      </w:p>`);
      continue;
    }

    // Horizontal Rule (---, ***, ___, - - -, etc.)
    if (/^(?:[-*_]\s*){3,}$/.test(trimmed)) {
      elements.push(`<w:p>
        <w:pPr>
          <w:pBdr>
            <w:bottom w:val="single" w:sz="${isVisionImpaired ? '16' : '8'}" w:space="1" w:color="CBD5E1"/>
          </w:pBdr>
          <w:spacing w:before="${isVisionImpaired ? '200' : '120'}" w:after="${isVisionImpaired ? '200' : '120'}"/>
        </w:pPr>
      </w:p>`);
      continue;
    }

    // Blockquote
    if (/^>+\s*/.test(trimmed)) {
      let quoteText = trimmed.replace(/^>+\s*/, '');
      // Strip markdown alert style tags: [!NOTE], [!TIP], etc.
      quoteText = quoteText.replace(/^\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i, '');

      elements.push(`<w:p>
        <w:pPr>
          <w:pBdr>
            <w:left w:val="single" w:sz="${isVisionImpaired ? '36' : '24'}" w:space="8" w:color="0284C7"/>
          </w:pBdr>
          <w:shd w:val="clear" w:color="auto" w:fill="F0F9FF"/>
          <w:ind w:left="${isVisionImpaired ? '350' : '200'}" w:right="100"/>
          <w:spacing w:before="${isVisionImpaired ? '160' : '80'}" w:after="${isVisionImpaired ? '160' : '80'}" w:line="${isVisionImpaired ? '480' : '276'}" w:lineRule="auto"/>
        </w:pPr>
        ${formatInlineRuns(quoteText, isVisionImpaired ? { font: 'Arial', sz: '96', color: '0F172A' } : { color: '475569' })}
      </w:p>`);
      continue;
    }

    // Bullet lists (including nested bullets with leading whitespace and checkboxes)
    const bulletMatch = rawLine.match(/^(\s*)([-*+]|\u2022)\s+(.*)$/);
    if (bulletMatch) {
      const indentSpaces = bulletMatch[1].length;
      const leftIndent = 400 + Math.floor(indentSpaces / 2) * 200;
      let itemText = bulletMatch[3];

      // Checkbox support
      if (/^\[\s\]\s*/.test(itemText)) {
        itemText = '☐ ' + itemText.replace(/^\[\s\]\s*/, '');
      } else if (/^\[[xX]\]\s*/.test(itemText)) {
        itemText = '☑ ' + itemText.replace(/^\[[xX]\]\s*/, '');
      }

      elements.push(`<w:p>
        <w:pPr>
          <w:ind w:left="${isVisionImpaired ? leftIndent + 150 : leftIndent}" w:hanging="${isVisionImpaired ? '300' : '200'}"/>
          <w:spacing w:after="${isVisionImpaired ? '160' : '60'}" w:line="${isVisionImpaired ? '480' : '276'}" w:lineRule="auto"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="${isVisionImpaired ? 'Arial' : 'Symbol'}" w:hAnsi="${isVisionImpaired ? 'Arial' : 'Symbol'}"/>
            ${isVisionImpaired ? '<w:sz w:val="96"/><w:b/>' : ''}
          </w:rPr>
          <w:t>• </w:t>
        </w:r>
        ${formatInlineRuns(itemText, isVisionImpaired ? { font: 'Arial', sz: '96' } : {})}
      </w:p>`);
      continue;
    }

    // Numbered lists (e.g. "1. " or "1) ")
    const numMatch = rawLine.match(/^(\s*)(\d+)[.)]\s+(.*)$/);
    if (numMatch) {
      const indentSpaces = numMatch[1].length;
      const leftIndent = 400 + Math.floor(indentSpaces / 2) * 200;
      const num = numMatch[2];
      const itemText = numMatch[3];
      elements.push(`<w:p>
        <w:pPr>
          <w:ind w:left="${isVisionImpaired ? leftIndent + 150 : leftIndent}" w:hanging="${isVisionImpaired ? '350' : '250'}"/>
          <w:spacing w:after="${isVisionImpaired ? '160' : '60'}" w:line="${isVisionImpaired ? '480' : '276'}" w:lineRule="auto"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="${isVisionImpaired ? 'Arial' : 'Calibri'}" w:hAnsi="${isVisionImpaired ? 'Arial' : 'Calibri'}"/>
            <w:b/>
            ${isVisionImpaired ? '<w:sz w:val="96"/>' : ''}
          </w:rPr>
          <w:t>${num}. </w:t>
        </w:r>
        ${formatInlineRuns(itemText, isVisionImpaired ? { font: 'Arial', sz: '96' } : {})}
      </w:p>`);
      continue;
    }

    // Standard body paragraph
    elements.push(`<w:p>
      <w:pPr>
        <w:spacing w:after="${isVisionImpaired ? '280' : '120'}" w:line="${isVisionImpaired ? '480' : '276'}" w:lineRule="auto"/>
      </w:pPr>
      ${formatInlineRuns(trimmed, isVisionImpaired ? { font: 'Arial', sz: '96' } : {})}
    </w:p>`);
  }

  if (inTable) {
    flushTable();
  }

  return elements.join('\n');
}

/**
 * Creates and downloads a Microsoft Word (.docx) file from Markdown text
 * @param {string} markdown - The markdown content to convert
 * @param {string} fileName - Destination filename
 * @param {string} orientation - 'portrait' or 'landscape'
 * @param {object} options - Optional settings (e.g. isVisionImpaired)
 */
export async function exportMarkdownToDocx(markdown, fileName = 'TeacherMaterials.docx', orientation = 'portrait', options = {}) {
  const zip = new JSZip();
  const isLandscape = orientation === 'landscape';
  const isVisionImpaired = Boolean(
    (options && options.isVisionImpaired) ||
    /vision\s*impaired|large\s*print|arial\s*48/i.test(markdown) ||
    /vision_impaired/i.test(fileName)
  );

  // 1. [Content_Types].xml
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`);

  // 2. _rels/.rels
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  // 3. word/_rels/document.xml.rels
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);

  // 4. word/styles.xml
  const bodyFont = isVisionImpaired ? 'Arial' : 'Calibri';
  const headingFont = isVisionImpaired ? 'Arial' : 'Georgia';
  const h1Sz = isVisionImpaired ? '112' : '36';
  const h2Sz = isVisionImpaired ? '104' : '28';
  const h3Sz = isVisionImpaired ? '96' : '24';
  const h4Sz = isVisionImpaired ? '96' : '22';
  const bodySz = isVisionImpaired ? '96' : '22';

  zip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="${bodyFont}" w:hAnsi="${bodyFont}" w:cs="${bodyFont}"/>
        <w:sz w:val="${bodySz}"/>
        <w:szCs w:val="${bodySz}"/>
        <w:color w:val="0F172A"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:rPr>
      <w:rFonts w:ascii="${headingFont}" w:hAnsi="${headingFont}"/>
      <w:b/>
      <w:color w:val="1E293B"/>
      <w:sz w:val="${h1Sz}"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:rPr>
      <w:rFonts w:ascii="${headingFont}" w:hAnsi="${headingFont}"/>
      <w:b/>
      <w:color w:val="334155"/>
      <w:sz w:val="${h2Sz}"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:rPr>
      <w:rFonts w:ascii="${bodyFont}" w:hAnsi="${bodyFont}"/>
      <w:b/>
      <w:color w:val="475569"/>
      <w:sz w:val="${h3Sz}"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading4">
    <w:name w:val="heading 4"/>
    <w:rPr>
      <w:rFonts w:ascii="${bodyFont}" w:hAnsi="${bodyFont}"/>
      <w:b/>
      <w:color w:val="64748B"/>
      <w:sz w:val="${h4Sz}"/>
    </w:rPr>
  </w:style>
</w:styles>`);

  // 5. word/document.xml
  const bodyXml = markdownToWordXml(markdown, isVisionImpaired);
  const pageSizeXml = isLandscape
    ? '<w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>'
    : '<w:pgSz w:w="11906" w:h="16838"/>';

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyXml}
    <w:sectPr>
      ${pageSizeXml}
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  zip.file('word/document.xml', documentXml);

  // Generate binary package and trigger browser download
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.docx') ? fileName : `${fileName}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
