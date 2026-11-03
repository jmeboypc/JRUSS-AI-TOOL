/**
 * Whiteboard Presentation Stage & Content Parser
 * Splits raw generated markdown lessons into projection-ready stages
 * and strictly isolates Pupil-Facing content from Teacher Guidance, Timers, & Answers.
 */

/**
 * Checks if a line initiates a teacher-only section (Teacher Guidance, Tips, Answers, Mark Schemes, Timers).
 */
export function isTeacherTrigger(line) {
  if (!line) return false;
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Headings like ## Teacher Guidance, ### Model Answers, ### Teacher Notes
  if (/^#{1,4}\s+.*(?:Teacher|Guidance|Notes?|Tips?|Answers?|Model\s+Solutions?|Marking\s+Scheme|Indicative\s+Content|Check\s+for\s+Understanding)/i.test(trimmed)) {
    return true;
  }

  // Bullet points like:
  // - **Teacher Guidance**: ...
  // - **Teacher Notes**: ...
  // - **Teacher Tips**: ...
  // - **Teacher Instructions**: ...
  // - **Teacher Script**: ...
  // - **Teacher Reflection**: ...
  // - **Pedagogical Guidance**: ...
  // - **Answers**: ...
  // - **Model Answer(s)**: ...
  // - **Solutions**: ...
  // - **Marking Scheme**: ...
  // - **Check for Understanding**: ...
  if (/^[-*+]\s+(?:>+\s*)?(?:\*{1,3}|_{1,3})?(Teacher\s+(?:Guidance|Notes?|Tips?|Instructions?|Script|Prompts?|Advice|Reflection|Check)|Pedagogical\s+(?:Guidance|Notes?)|Answers?|Model\s+(?:Answers?|Solutions?)|Solutions?|Marking\s+Scheme|Indicative\s+Content|Grading\s+Rubric|Expected\s+Answers?|Check\s+for\s+Understanding)(\*{1,3}|_{1,3})?:?/i.test(trimmed)) {
    return true;
  }

  // Standalone bold triggers like **Teacher Guidance**: ..., **Answers**: ...
  if (/^(?:>+\s*)?(?:\*{1,3}|_{1,3})(Teacher\s+(?:Guidance|Notes?|Tips?|Instructions?|Script|Prompts?|Advice|Reflection|Check)|Pedagogical\s+(?:Guidance|Notes?)|Answers?|Model\s+(?:Answers?|Solutions?)|Solutions?|Marking\s+Scheme|Indicative\s+Content|Grading\s+Rubric|Expected\s+Answers?|Check\s+for\s+Understanding)(\*{1,3}|_{1,3})?:?/i.test(trimmed)) {
    return true;
  }

  // Direct Teacher timer or advice instructions like:
  // - "Set a timer for 3 minutes..."
  // - "Teacher Note: ..."
  // - "[Teacher Note: ...]"
  // - "(Teacher Guidance: ...)"
  if (/^(?:[-*+]\s+)?(?:>+\s*)?(?:\*{1,3})?Set a timer for\b/i.test(trimmed)) {
    return true;
  }
  if (/^(?:[-*+]\s+)?(?:>+\s*)?(?:\*{1,3})?(?:Teacher\s+Tip|Teacher\s+Note|Teacher\s+Guidance):/i.test(trimmed)) {
    return true;
  }
  if (/^(?:[-*+]\s+)?\[Teacher\s+Note:/i.test(trimmed)) {
    return true;
  }
  if (/^(?:[-*+]\s+)?\(Teacher\s+Guidance:/i.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Checks if a line marks the return to pupil-facing content (Student Task, WALT, Bronze/Silver/Gold, Questions, etc.)
 */
export function isPupilTrigger(line) {
  if (!line) return false;
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Headings that are NOT teacher triggers
  if (/^#{1,4}\s+/.test(trimmed) && !isTeacherTrigger(line)) {
    return true;
  }

  // Explicit pupil bullet points
  if (/^[-*+]\s+(?:>+\s*)?(?:\*{1,3}|_{1,3})?(Student|Pupil|Do-Now|Starter|Task|WALT|WILF|Success\s+Criteria|Bronze|Silver|Gold|Scaffold|Stretch|Extension|Key\s+Vocab|Vocabulary|Core\s+Explanation|Worked\s+Example|Activity|Paired|Exit\s+Ticket|Self-Assessment|Questions?|Instructions?|Challenge|Practice)(\*{1,3}|_{1,3})?:?/i.test(trimmed)) {
    return true;
  }

  // Any bullet point in bold that does not start with teacher/answer keywords
  if (/^[-*+]\s+\*\*(?!(?:Teacher|Pedagog|Answer|Model\s+Answer|Solution|Marking\s+Scheme|Indicative|Grading\s+Rubric|Expected|Check\s+for\s+Understanding)\b)[A-Z]/i.test(trimmed)) {
    return true;
  }

  // Horizontal divider rule
  if (trimmed === '---' || trimmed === '***') {
    return true;
  }

  return false;
}

/**
 * Splits a stage's raw text into clean pupilContent and teacherGuidance.
 */
export function splitStageContent(rawText = '') {
  if (!rawText || !rawText.trim()) {
    return { pupilContent: '', teacherGuidance: '' };
  }

  const lines = rawText.split('\n');
  const pupilLines = [];
  const teacherLines = [];
  let inTeacherSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isTeacherTrigger(line)) {
      inTeacherSection = true;
      teacherLines.push(line);
      continue;
    }

    if (inTeacherSection) {
      if (isPupilTrigger(line)) {
        inTeacherSection = false;
        pupilLines.push(line);
      } else {
        teacherLines.push(line);
      }
    } else {
      pupilLines.push(line);
    }
  }

  return {
    pupilContent: pupilLines.join('\n').trim(),
    teacherGuidance: teacherLines.join('\n').trim()
  };
}

/**
 * Parses full lesson markdown into discrete presentation stages.
 */
export function parseWhiteboardStages(content = '', defaultTopic = 'Classroom Lesson') {
  if (!content || !content.trim()) {
    return [{
      id: 0,
      title: 'Ready to Teach',
      content: '# Ready to Teach\n\nNo lesson content generated yet.'
    }];
  }

  const lines = content.split('\n');
  const parsedStages = [];
  let currentTitle = 'Lesson Introduction';
  let currentLines = [];
  let stageCount = 0;

  const isStageHeader = (line) => {
    const trimmed = line.trim();
    return (
      /^#{1,3}\s+(Stage\s*\d+|Step\s*\d+|Part\s*\d+|Starter|Do-Now|Retrieval|Learning\s+Objectives?|WALT|Success\s+Criteria|Direct\s+Instruction|Core\s+Teaching|Guided\s+Practice|Independent\s+(?:Task|Activity|Work)|Plenary|Exit\s+Ticket)/i.test(trimmed) ||
      (/^#{2,3}\s+/.test(trimmed) && trimmed.length < 90 && !trimmed.toLowerCase().includes('section'))
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Stage boundary on --- followed shortly by a heading
    if (line.trim() === '---' && currentLines.length > 3) {
      const nextHeading = lines.slice(i + 1, i + 5).find(l => /^#{1,3}\s+/.test(l.trim()));
      if (nextHeading) {
        if (currentLines.length > 0) {
          stageCount++;
          parsedStages.push({
            id: stageCount - 1,
            title: currentTitle.replace(/^#{1,3}\s+/, '').replace(/\*/g, '').trim(),
            content: currentLines.join('\n').trim()
          });
          currentLines = [];
        }
        continue;
      }
    }

    if (isStageHeader(line)) {
      if (currentLines.length > 0) {
        stageCount++;
        parsedStages.push({
          id: stageCount - 1,
          title: currentTitle.replace(/^#{1,3}\s+/, '').replace(/\*/g, '').trim(),
          content: currentLines.join('\n').trim()
        });
        currentLines = [];
      }
      currentTitle = line;
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    stageCount++;
    parsedStages.push({
      id: stageCount - 1,
      title: currentTitle.replace(/^#{1,3}\s+/, '').replace(/\*/g, '').trim(),
      content: currentLines.join('\n').trim()
    });
  }

  return parsedStages.length > 0 ? parsedStages : [{ id: 0, title: defaultTopic, content }];
}

