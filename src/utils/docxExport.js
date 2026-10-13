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
 * Converts inline Markdown (bold, italic, code) into Word XML run elements
 */
function formatInlineRuns(text) {
  if (!text) return '';

  const tokens = [];
  const regex = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', val: text.substring(lastIndex, match.index) });
    }
    const m = match[0];
    if (m.startsWith('***') && m.endsWith('***')) {
      tokens.push({ type: 'bold-italic', val: m.slice(3, -3) });
    } else if (m.startsWith('**') && m.endsWith('**')) {
      tokens.push({ type: 'bold', val: m.slice(2, -2) });
    } else if (m.startsWith('*') && m.endsWith('*')) {
      tokens.push({ type: 'italic', val: m.slice(1, -1) });
    } else if (m.startsWith('`') && m.endsWith('`')) {
      tokens.push({ type: 'code', val: m.slice(1, -1) });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', val: text.substring(lastIndex) });
  }

  return tokens.map(tok => {
    const escaped = escapeXml(tok.val);
    switch (tok.type) {
      case 'bold':
        return `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escaped}</w:t></w:r>`;
      case 'italic':
        return `<w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">${escaped}</w:t></w:r>`;
      case 'bold-italic':
        return `<w:r><w:rPr><w:b/><w:i/></w:rPr><w:t xml:space="preserve">${escaped}</w:t></w:r>`;
      case 'code':
        return `<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:color w:val="7C3AED"/><w:shd w:val="clear" w:color="auto" w:fill="F3F4F6"/></w:rPr><w:t xml:space="preserve">${escaped}</w:t></w:r>`;
      default:
        return `<w:r><w:t xml:space="preserve">${escaped}</w:t></w:r>`;
    }
  }).join('');
}

/**
 * Builds the Word OpenXML document content from markdown lines
 */
function markdownToWordXml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const elements = [];
  let inTable = false;
  let tableRows = [];

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
        const bold = isHeader ? `<w:b/>` : '';
        tableXml += `<w:tc>
          <w:tcPr>
            ${bg}
            <w:tcMar>
              <w:top w:w="120" w:type="dxa"/>
              <w:bottom w:w="120" w:type="dxa"/>
              <w:left w:w="160" w:type="dxa"/>
              <w:right w:w="160" w:type="dxa"/>
            </w:tcMar>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:spacing w:after="0" w:line="240" w:lineRule="auto"/>
            </w:pPr>
            <w:r>
              <w:rPr>${bold}</w:rPr>
              <w:t>${escapeXml(cell)}</w:t>
            </w:r>
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
      elements.push(`<w:p><w:pPr><w:spacing w:after="100"/></w:pPr></w:p>`);
      continue;
    }

    // Headings
    if (trimmed.startsWith('# ')) {
      elements.push(`<w:p>
        <w:pPr>
          <w:pStyle w:val="Heading1"/>
          <w:spacing w:before="240" w:after="120"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/>
            <w:b/>
            <w:color w:val="1E293B"/>
            <w:sz w:val="36"/>
          </w:rPr>
          <w:t>${escapeXml(trimmed.slice(2))}</w:t>
        </w:r>
      </w:p>`);
      continue;
    }

    if (trimmed.startsWith('## ')) {
      elements.push(`<w:p>
        <w:pPr>
          <w:pStyle w:val="Heading2"/>
          <w:spacing w:before="200" w:after="80"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/>
            <w:b/>
            <w:color w:val="334155"/>
            <w:sz w:val="28"/>
          </w:rPr>
          <w:t>${escapeXml(trimmed.slice(3))}</w:t>
        </w:r>
      </w:p>`);
      continue;
    }

    if (trimmed.startsWith('### ')) {
      elements.push(`<w:p>
        <w:pPr>
          <w:pStyle w:val="Heading3"/>
          <w:spacing w:before="160" w:after="60"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
            <w:b/>
            <w:color w:val="475569"/>
            <w:sz w:val="24"/>
          </w:rPr>
          <w:t>${escapeXml(trimmed.slice(4))}</w:t>
        </w:r>
      </w:p>`);
      continue;
    }

    // Horizontal Rule
    if (/^(\*\*\*|---|___)$/.test(trimmed)) {
      elements.push(`<w:p>
        <w:pPr>
          <w:pBdr>
            <w:bottom w:val="single" w:sz="8" w:space="1" w:color="CBD5E1"/>
          </w:pBdr>
          <w:spacing w:before="120" w:after="120"/>
        </w:pPr>
      </w:p>`);
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      const quoteText = trimmed.slice(2);
      elements.push(`<w:p>
        <w:pPr>
          <w:pBdr>
            <w:left w:val="single" w:sz="24" w:space="8" w:color="8B5CF6"/>
          </w:pBdr>
          <w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/>
          <w:ind w:left="200" w:right="100"/>
          <w:spacing w:before="80" w:after="80"/>
        </w:pPr>
        <w:r>
          <w:rPr><w:i/><w:color w:val="475569"/></w:rPr>
          <w:t xml:space="preserve">${escapeXml(quoteText)}</w:t>
        </w:r>
      </w:p>`);
      continue;
    }

    // Bullet lists
    if (/^[-*+]\s+/.test(trimmed)) {
      const itemText = trimmed.replace(/^[-*+]\s+/, '');
      elements.push(`<w:p>
        <w:pPr>
          <w:ind w:left="400" w:hanging="200"/>
          <w:spacing w:after="60"/>
        </w:pPr>
        <w:r>
          <w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol"/></w:rPr>
          <w:t>• </w:t>
        </w:r>
        ${formatInlineRuns(itemText)}
      </w:p>`);
      continue;
    }

    // Numbered lists
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      const num = numMatch[1];
      const itemText = numMatch[2];
      elements.push(`<w:p>
        <w:pPr>
          <w:ind w:left="400" w:hanging="250"/>
          <w:spacing w:after="60"/>
        </w:pPr>
        <w:r>
          <w:rPr><w:b/></w:rPr>
          <w:t>${num}. </w:t>
        </w:r>
        ${formatInlineRuns(itemText)}
      </w:p>`);
      continue;
    }

    // Standard body paragraph
    elements.push(`<w:p>
      <w:pPr>
        <w:spacing w:after="120" w:line="276" w:lineRule="auto"/>
      </w:pPr>
      ${formatInlineRuns(rawLine)}
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
 */
export async function exportMarkdownToDocx(markdown, fileName = 'TeacherMaterials.docx', orientation = 'portrait') {
  const zip = new JSZip();
  const isLandscape = orientation === 'landscape';

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
  zip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:color w:val="0F172A"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`);

  // 5. word/document.xml
  const bodyXml = markdownToWordXml(markdown);
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
