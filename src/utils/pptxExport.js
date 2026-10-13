import pptxgen from 'pptxgenjs';

/**
 * Strips markdown emphasis/bold/code formatting
 */
function cleanMarkdownText(text) {
  if (!text) return '';
  return text
    .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

/**
 * Creates and downloads a clean, beautifully formatted PowerPoint (.pptx) presentation
 * from generated Markdown lesson content.
 *
 * @param {string} markdown - The markdown content to convert
 * @param {string} fileName - Destination filename (.pptx)
 * @param {string} title - Optional presentation title
 */
export async function exportMarkdownToPptx(markdown, fileName = 'Presentation.pptx', title = 'Lesson Presentation') {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9'; // 10.0 x 5.625 inches in pptxgenjs

  // Theme Colors
  const theme = {
    bg: '0F172A',         // Slate 900
    cardBg: '1E293B',     // Slate 800
    text: 'F8FAFC',       // Slate 50
    subtext: '94A3B8',    // Slate 400
    accent: '8B5CF6',     // Violet 500
    accentBorder: '334155'// Slate 700
  };

  const lines = (markdown || '').split(/\r?\n/);

  // Parse lines into slide objects
  const slidesData = [];
  let currentSlide = {
    title: '',
    bullets: [],
    notes: ''
  };

  const pushCurrentSlide = () => {
    if (currentSlide.title || currentSlide.bullets.length > 0) {
      slidesData.push({ ...currentSlide });
      currentSlide = { title: '', bullets: [], notes: '' };
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // Check for slide separators or headers:
    // e.g. "## Slide 4: Interactive Task...", "## Slide 4 - ...", "# Slide 4", or general "## Heading"
    const isSlideHeader = 
      trimmed.match(/^##?\s+(?:Slide\s*\d+[\s:–-]*\s*)?(.+)$/i) || 
      trimmed.match(/^###\s+Slide\s*\d+[\s:–-]*\s*(.+)$/i);

    if (isSlideHeader) {
      pushCurrentSlide();
      currentSlide.title = cleanMarkdownText(isSlideHeader[1]);
      continue;
    }

    // Teacher notes detector (can start with bullet or bold or quote)
    const isTeacherNote = 
      /^(?:[-*+]\s*)?(?:\*\*|>|\*)*\s*Teacher\s*Notes?[\s:–-]*(.*)$/i.exec(trimmed);

    if (isTeacherNote) {
      const noteContent = cleanMarkdownText(isTeacherNote[1] || trimmed);
      currentSlide.notes += (currentSlide.notes ? '\n\n' : '') + `Teacher Notes: ${noteContent}`;
      continue;
    }

    // Bullets or numbered items
    const bulletMatch = trimmed.match(/^([-*+]|\d+\.)\s+(.+)$/);
    if (bulletMatch) {
      const itemRaw = bulletMatch[2];
      // Check if this bullet item is actually teacher notes
      if (/^Teacher\s*Notes?[\s:–-]/i.test(itemRaw.replace(/[*_`]/g, '').trim())) {
        const noteContent = cleanMarkdownText(itemRaw.replace(/^Teacher\s*Notes?[\s:–-]*/i, ''));
        currentSlide.notes += (currentSlide.notes ? '\n\n' : '') + `Teacher Notes: ${noteContent}`;
        continue;
      }
      const cleanBullet = cleanMarkdownText(itemRaw);
      if (cleanBullet) currentSlide.bullets.push(cleanBullet);
      continue;
    }

    // H3 / subheader
    if (trimmed.startsWith('###')) {
      const sub = cleanMarkdownText(trimmed.replace(/^###\s+/, ''));
      if (sub) currentSlide.bullets.push(sub);
      continue;
    }

    // Regular line
    if (!trimmed.startsWith('|') && !trimmed.startsWith('---') && !trimmed.startsWith('___')) {
      const cleanLine = cleanMarkdownText(trimmed);
      if (cleanLine.length > 0) {
        currentSlide.bullets.push(cleanLine);
      }
    }
  }
  pushCurrentSlide();

  // If no slides were parsed, fallback
  if (slidesData.length === 0) {
    slidesData.push({
      title: title || 'Lesson Overview',
      bullets: lines.filter(l => l.trim()).slice(0, 6).map(l => cleanMarkdownText(l.replace(/^[#*-\s]+/, ''))),
      notes: ''
    });
  }

  // Generate 16:9 slides (Dimensions: 10.0 inches wide x 5.625 inches high)
  slidesData.forEach((sData, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: theme.bg };

    const isFirstSlide = index === 0;

    if (isFirstSlide) {
      // Title Hero Slide layout
      slide.addShape(pptx.shapes.RECTANGLE, {
        x: 0.6,
        y: 0.8,
        w: 8.8,
        h: 4.0,
        fill: { color: theme.cardBg },
        line: { color: theme.accent, width: 2 }
      });

      slide.addText(sData.title || title || 'Lesson Presentation', {
        x: 0.9,
        y: 1.2,
        w: 8.2,
        h: 1.4,
        fontSize: 26,
        bold: true,
        color: theme.text,
        align: 'left',
        valign: 'middle'
      });

      if (sData.bullets.length > 0) {
        const titleBullets = sData.bullets.slice(0, 4).map(b => ({
          text: b,
          options: {
            fontSize: 14,
            color: theme.subtext,
            bullet: true,
            breakLine: true
          }
        }));

        slide.addText(titleBullets, {
          x: 0.9,
          y: 2.7,
          w: 8.2,
          h: 1.8,
          lineSpacing: 22,
          valign: 'top'
        });
      }
    } else {
      // Content Slide layout (10.0 x 5.625)
      // Top accent badge / bar
      slide.addShape(pptx.shapes.RECTANGLE, {
        x: 0.6,
        y: 0.4,
        w: 0.12,
        h: 0.55,
        fill: { color: theme.accent }
      });

      // Slide Title
      slide.addText(sData.title || `Slide ${index + 1}`, {
        x: 0.85,
        y: 0.35,
        w: 8.55,
        h: 0.65,
        fontSize: 20,
        bold: true,
        color: theme.text,
        valign: 'middle'
      });

      // Card container for bullets
      slide.addShape(pptx.shapes.RECTANGLE, {
        x: 0.6,
        y: 1.15,
        w: 8.8,
        h: 3.9,
        fill: { color: theme.cardBg },
        line: { color: theme.accentBorder, width: 1 }
      });

      // Dynamic sizing based on bullet count so text never overflows
      const bulletCount = sData.bullets.length;
      let fontSize = 14;
      let lineSpacing = 20;

      if (bulletCount > 6) {
        fontSize = 11.5;
        lineSpacing = 16;
      } else if (bulletCount > 4) {
        fontSize = 12.5;
        lineSpacing = 18;
      }

      // Slide bullet items
      const textItems = sData.bullets.slice(0, 8).map(b => ({
        text: b,
        options: {
          fontSize: fontSize,
          color: theme.text,
          bullet: true,
          breakLine: true
        }
      }));

      if (textItems.length > 0) {
        slide.addText(textItems, {
          x: 0.9,
          y: 1.35,
          w: 8.2,
          h: 3.5,
          lineSpacing: lineSpacing,
          valign: 'top',
          margin: 0
        });
      }
    }

    // Slide footer (bottom right)
    slide.addText(`JRUSS AI Lesson Presentation | Slide ${index + 1} of ${slidesData.length}`, {
      x: 0.6,
      y: 5.15,
      w: 8.8,
      h: 0.35,
      fontSize: 8.5,
      color: theme.subtext,
      align: 'right',
      valign: 'middle'
    });

    // Add speaker notes into PowerPoint's native notes pane
    if (sData.notes) {
      slide.addNotes(sData.notes);
    }
  });

  const cleanName = fileName.endsWith('.pptx') ? fileName : `${fileName}.pptx`;
  await pptx.writeFile({ fileName: cleanName });
}
