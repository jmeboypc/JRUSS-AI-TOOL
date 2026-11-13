/**
 * Utility for parsing Arbor MIS Timetable exports and converting them into
 * standard RFC 5545 .ics (iCalendar) calendar files for Microsoft Outlook & Google Calendar.
 */

export const MONTH_MAP = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11
};

export const DEFAULT_BELL_TIMES = {
  'AM tutor': { start: '08:45', end: '09:05' },
  'Period 1': { start: '09:05', end: '10:05' },
  'Period 2': { start: '10:05', end: '11:05' },
  'Period 3': { start: '11:25', end: '12:25' },
  'PM tutor': { start: '13:20', end: '13:30' },
  'Period 4': { start: '13:30', end: '14:30' },
  'Period 5': { start: '14:30', end: '15:30' },
  'Period 6': { start: '15:30', end: '16:30' },
  'Registration': { start: '08:40', end: '09:00' },
  'Assembly': { start: '09:00', end: '09:30' }
};

/**
 * Robust CSV / TSV parser that handles quotes, escaped quotes, tabs, and newlines.
 * Auto-detects tab-separated input (e.g. copy-pasted directly from an Arbor HTML table).
 */
export function parseCsvRows(csvText) {
  if (!csvText) return [];

  // Detect delimiter from first non-empty line: tab if tabs are present without unquoted commas
  const firstLine = csvText.split(/\r?\n/).find(l => l.trim().length > 0) || '';
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter = tabCount > 0 && tabCount >= commaCount ? '\t' : ',';

  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n of CRLF
      }
      currentRow.push(currentField.trim());
      // Only push non-empty rows
      if (currentRow.some(f => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Parses individual Arbor timetable cell content
 * Typical patterns:
 * - "Business Studies (A Level): Year 12: 12C/Bs, DT5 "
 * - "Tutor - Year 11: 11LF, ICT1 "
 * - "Computer Science (GCSE): Year 10: 10C/Cs, ICT1 "
 * - "PPA"
 */
export function parseTimetableCell(cellText) {
  if (!cellText || !cellText.trim()) return null;
  const raw = cellText.trim();

  // PPA slot detection
  if (/^PPA\b/i.test(raw)) {
    return {
      isPpa: true,
      subject: 'PPA',
      year: '',
      classGroup: '',
      room: '',
      raw
    };
  }

  // Extract room after final comma if present
  let mainPart = raw;
  let room = '';
  const lastCommaIndex = raw.lastIndexOf(',');
  if (lastCommaIndex !== -1) {
    room = raw.slice(lastCommaIndex + 1).trim();
    mainPart = raw.slice(0, lastCommaIndex).trim();
  }

  // Split by colons: e.g. ["Business Studies (A Level)", "Year 12", "12C/Bs"]
  const colonParts = mainPart.split(':').map(p => p.trim());
  let subject = '';
  let year = '';
  let classGroup = '';

  if (colonParts.length >= 3) {
    subject = colonParts[0];
    year = colonParts[1];
    classGroup = colonParts.slice(2).join(' : ');
  } else if (colonParts.length === 2) {
    subject = colonParts[0];
    classGroup = colonParts[1];
  } else {
    subject = mainPart;
  }

  return {
    isPpa: false,
    subject: subject || raw,
    year,
    classGroup,
    room,
    raw
  };
}

/**
 * Parses an entire Arbor export CSV
 */
export function parseArborCsv(csvText, customOptions = {}) {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    return {
      success: false,
      error: 'The CSV file does not contain enough rows (header row and at least one staff row required).',
      staffList: [],
      eventsByStaff: {},
      allPeriods: []
    };
  }

  const headerRow = rows[0];
  const staffRows = rows.slice(1);

  // Auto-detect base year from options, or current year
  const currentYear = new Date().getFullYear();
  let baseYear = customOptions.baseYear ? parseInt(customOptions.baseYear, 10) : currentYear;

  // Header column regex: e.g. "Thursday 12th Nov: AM tutor"
  const headerRegex = /^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)(?:\s+(\d{4}))?:\s*(.+)$/i;

  // Inspect column headers
  const columnMappings = [];
  const allPeriodsSet = new Set();
  const allDatesList = [];

  for (let c = 1; c < headerRow.length; c++) {
    const headerStr = headerRow[c];
    const match = headerStr.match(headerRegex);
    if (!match) continue;

    const [_, dayName, dayStr, monthStr, explicitYearStr, periodNameRaw] = match;
    const periodName = periodNameRaw.trim();
    allPeriodsSet.add(periodName);

    const monthKey = monthStr.toLowerCase().slice(0, 3);
    const monthNum = MONTH_MAP[monthKey];
    if (monthNum === undefined) continue;

    const dayNum = parseInt(dayStr, 10);
    const explicitYear = explicitYearStr ? parseInt(explicitYearStr, 10) : null;

    columnMappings.push({
      colIndex: c,
      dayName,
      dayNum,
      monthNum,
      monthName: monthStr,
      explicitYear,
      periodName
    });
  }

  if (columnMappings.length === 0) {
    // Fallback: try parsing as a row-per-event table (e.g. from Arbor User Profile > Calendar > Events)
    const eventListResult = parseArborEventsTable(rows, baseYear);
    if (eventListResult) return eventListResult;

    return {
      success: false,
      error: 'Could not detect standard Arbor timetable headers (e.g. "Thursday 12th Nov: Period 1") or Calendar Events columns (Start / End / Event). Please check your CSV or pasted table.',
      staffList: [],
      eventsByStaff: {},
      allPeriods: []
    };
  }

  // Detect starting month of the export to calculate academic year rollover
  const firstCol = columnMappings[0];
  const firstMonthNum = firstCol.monthNum; // 0..11

  // Extract staff rows
  const staffList = [];
  const eventsByStaff = {};

  staffRows.forEach((row, rIdx) => {
    const rawStaffName = row[0] || `Staff Member ${rIdx + 1}`;
    // Format name if "Fauceglia, Luigi" -> "Luigi Fauceglia" or keep as-is
    let staffName = rawStaffName;
    if (rawStaffName.includes(',')) {
      const [last, first] = rawStaffName.split(',').map(s => s.trim());
      if (first && last) staffName = `${first} ${last}`;
    }

    if (!staffList.includes(staffName)) {
      staffList.push(staffName);
    }
    eventsByStaff[staffName] = [];

    columnMappings.forEach(mapping => {
      const cellVal = row[mapping.colIndex];
      if (!cellVal || !cellVal.trim()) return; // Free period / no lesson

      const parsedCell = parseTimetableCell(cellVal);
      if (!parsedCell) return;

      // Determine year for this date:
      // If export starts in Autumn (month >= 8 e.g. Sep/Oct/Nov/Dec), and mapping month is Jan..Jul (month < 8),
      // then year is baseYear + 1.
      let eventYear = mapping.explicitYear || baseYear;
      if (!mapping.explicitYear) {
        if (firstMonthNum >= 7 && mapping.monthNum < 7) {
          eventYear = baseYear + 1;
        } else if (firstMonthNum < 7 && mapping.monthNum >= 7) {
          // If export starts in Spring (e.g. Jan), but wraps into Sep, rare but handled
          eventYear = baseYear - 1;
        }
      }

      const isoDate = `${eventYear}-${String(mapping.monthNum + 1).padStart(2, '0')}-${String(mapping.dayNum).padStart(2, '0')}`;
      allDatesList.push(isoDate);

      eventsByStaff[staffName].push({
        id: `ev_${rIdx}_${mapping.colIndex}_${Date.now()}`,
        staff: staffName,
        date: isoDate,
        dayName: mapping.dayName,
        dayNum: mapping.dayNum,
        monthName: mapping.monthName,
        year: eventYear,
        period: mapping.periodName,
        ...parsedCell
      });
    });
  });

  const sortedDates = Array.from(new Set(allDatesList)).sort();

  return {
    success: true,
    staffList,
    eventsByStaff,
    allPeriods: Array.from(allPeriodsSet),
    dateRange: {
      start: sortedDates[0] || '',
      end: sortedDates[sortedDates.length - 1] || '',
      totalDays: sortedDates.length
    },
    detectedYear: baseYear
  };
}

/**
 * Parses common Arbor date/time strings into { isoDate, timeStr, dayName, dayNum, monthName, year }
 */
function parseArborDateTime(str, fallbackYear) {
  if (!str) return null;
  const clean = str.trim();

  // Extract HH:MM (24h or 12h am/pm) if present
  let timeStr = '';
  const timeMatch = clean.match(/\b(\d{1,2}):(\d{2})(?:\s*(am|pm))?\b/i);
  if (timeMatch) {
    let hh = parseInt(timeMatch[1], 10);
    const mm = timeMatch[2];
    const ampm = timeMatch[3] ? timeMatch[3].toLowerCase() : '';
    if (ampm === 'pm' && hh < 12) hh += 12;
    if (ampm === 'am' && hh === 12) hh = 0;
    timeStr = `${String(hh).padStart(2, '0')}:${mm}`;
  }

  let year = fallbackYear;
  let monthNum;
  let dayNum;

  // 1. ISO: YYYY-MM-DD
  const isoMatch = clean.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  // 2. UK slash: DD/MM/YYYY or DD/MM/YY
  const ukMatch = clean.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  // 3. Text month: "13 Nov 2026" or "Fri 13th November 2026" or "13 Nov"
  const textMatch = clean.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})(?:,?\s+(20\d{2}))?\b/i);

  if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    monthNum = parseInt(isoMatch[2], 10) - 1;
    dayNum = parseInt(isoMatch[3], 10);
  } else if (ukMatch) {
    dayNum = parseInt(ukMatch[1], 10);
    monthNum = parseInt(ukMatch[2], 10) - 1;
    const yrRaw = parseInt(ukMatch[3], 10);
    year = yrRaw < 100 ? 2000 + yrRaw : yrRaw;
  } else if (textMatch) {
    const mKey = textMatch[2].toLowerCase().slice(0, 3);
    if (MONTH_MAP[mKey] !== undefined) {
      dayNum = parseInt(textMatch[1], 10);
      monthNum = MONTH_MAP[mKey];
      if (textMatch[3]) year = parseInt(textMatch[3], 10);
    }
  }

  if (monthNum === undefined || !dayNum || monthNum < 0 || monthNum > 11) {
    return timeStr ? { isoDate: '', timeStr, dayName: '', dayNum: 0, monthName: '', year } : null;
  }

  const dObj = new Date(year, monthNum, dayNum);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const isoDate = `${year}-${String(monthNum + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

  return {
    isoDate,
    timeStr,
    dayName: dayNames[dObj.getDay()] || '',
    dayNum,
    monthName: monthNames[monthNum] || '',
    year
  };
}

/**
 * Fallback parser for row-per-event CSV/TSV exports (e.g. Arbor User Profile > Calendar > Events)
 */
function parseArborEventsTable(rows, baseYear) {
  if (!rows || rows.length < 2) return null;

  // Find header row within first 5 rows
  let headerIdx = 0;
  let cols = {};
  for (let r = 0; r < Math.min(5, rows.length); r++) {
    const lower = rows[r].map(c => (c || '').toLowerCase().trim());
    const findCol = (patterns) => lower.findIndex(h => patterns.some(p => h === p || h.includes(p)));

    const titleCol = findCol(['event', 'title', 'summary', 'name', 'session', 'lesson', 'subject', 'description']);
    const startCol = findCol(['start date', 'start time', 'start', 'from', 'date & time', 'date']);
    const endCol = findCol(['end date', 'end time', 'end', 'to', 'finish']);
    const timeCol = findCol(['time', 'times', 'duration']);
    const roomCol = findCol(['location', 'room', 'venue', 'place']);
    const staffCol = findCol(['staff', 'teacher', 'organiser', 'organizer']);

    if (startCol !== -1 && (titleCol !== -1 || endCol !== -1)) {
      headerIdx = r;
      cols = { titleCol, startCol, endCol, timeCol, roomCol, staffCol };
      break;
    }
  }

  // If no explicit header matched, try heuristic on row 0/1 if row has date+time
  if (cols.startCol === undefined || cols.startCol === -1) return null;

  const eventsByStaff = {};
  const allDatesList = [];
  const dataRows = rows.slice(headerIdx + 1);

  dataRows.forEach((row, idx) => {
    const startRaw = cols.startCol !== -1 ? (row[cols.startCol] || '') : '';
    if (!startRaw.trim()) return;

    const startParsed = parseArborDateTime(startRaw, baseYear);
    if (!startParsed || !startParsed.isoDate) return;

    const endRaw = cols.endCol !== -1 ? (row[cols.endCol] || '') : '';
    const endParsed = endRaw ? parseArborDateTime(endRaw, startParsed.year) : null;

    let startTime = startParsed.timeStr;
    let endTime = endParsed?.timeStr || '';

    // Check combined time range e.g. "09:05 - 10:05" in startRaw or timeCol
    const timeRangeSource = (cols.timeCol !== -1 ? row[cols.timeCol] : '') || startRaw;
    const rangeMatch = timeRangeSource.match(/(\d{1,2}:\d{2})\s*[-–to]+\s*(\d{1,2}:\d{2})/i);
    if (rangeMatch) {
      startTime = startTime || rangeMatch[1].padStart(5, '0');
      endTime = endTime || rangeMatch[2].padStart(5, '0');
    }

    if (!startTime) startTime = '09:00';
    if (!endTime) {
      const [sh, sm] = startTime.split(':').map(Number);
      const eh = (sh + 1) % 24;
      endTime = `${String(eh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
    }

    const titleRaw = cols.titleCol !== -1 ? (row[cols.titleCol] || '').trim() : 'Arbor Event';
    const roomRaw = cols.roomCol !== -1 ? (row[cols.roomCol] || '').trim() : '';
    const staffName = (cols.staffCol !== -1 && row[cols.staffCol]?.trim()) ? row[cols.staffCol].trim() : 'My Calendar';

    const parsedCell = parseTimetableCell(roomRaw ? titleRaw : titleRaw) || {
      isPpa: /^PPA\b/i.test(titleRaw),
      subject: titleRaw,
      year: '',
      classGroup: '',
      room: '',
      raw: titleRaw
    };
    if (roomRaw && !parsedCell.room) parsedCell.room = roomRaw;

    if (!eventsByStaff[staffName]) eventsByStaff[staffName] = [];
    allDatesList.push(startParsed.isoDate);

    eventsByStaff[staffName].push({
      id: `ev_list_${idx}_${Date.now()}`,
      staff: staffName,
      date: startParsed.isoDate,
      dayName: startParsed.dayName,
      dayNum: startParsed.dayNum,
      monthName: startParsed.monthName,
      year: parsedCell.year || startParsed.year,
      period: `${startTime}-${endTime}`,
      startTime,
      endTime,
      ...parsedCell
    });
  });

  const staffList = Object.keys(eventsByStaff);
  if (staffList.length === 0 || allDatesList.length === 0) return null;

  const sortedDates = Array.from(new Set(allDatesList)).sort();

  return {
    success: true,
    isEventList: true,
    staffList,
    eventsByStaff,
    allPeriods: [],
    dateRange: {
      start: sortedDates[0] || '',
      end: sortedDates[sortedDates.length - 1] || '',
      totalDays: sortedDates.length
    },
    detectedYear: baseYear
  };
}

/**
 * Escapes text for iCalendar RFC 5545 format
 */
function escapeIcsText(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Formats date and time into iCalendar local format: YYYYMMDDTHHMMSS
 */
function formatIcsDateTime(isoDate, timeStr) {
  const datePart = (isoDate || '').replace(/-/g, '');
  const timePart = (timeStr || '09:00').replace(/:/g, '') + '00';
  return `${datePart}T${timePart}`;
}

/**
 * Generates RFC 5545 standard .ics calendar string
 */
export function generateIcsCalendar(events, options = {}) {
  const {
    calendarName = 'Arbor Timetable',
    teacherName = '',
    bellTimes = DEFAULT_BELL_TIMES,
    includePpa = true,
    titleFormat = 'class_subject_room', // 'class_subject_room', 'subject_class_room', 'period_class_subject', 'class_room'
    reminderMinutes = 10, // 0 = none, 5, 10, 15
    timezone = 'Europe/London'
  } = options;

  const validEvents = (events || []).filter(e => {
    if (e.isPpa && !includePpa) return false;
    return true;
  });

  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//JRUSS AI Tool//Arbor Timetable Converter//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName + (teacherName ? ` - ${teacherName}` : ''))}`,
    `X-WR-TIMEZONE:${timezone}`,
    // Include London timezone specification with British Summer Time (BST) & GMT transitions
    'BEGIN:VTIMEZONE',
    `TZID:${timezone}`,
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0000',
    'TZOFFSETTO:+0100',
    'TZNAME:BST',
    'DTSTART:19700329T010000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0000',
    'TZNAME:GMT',
    'DTSTART:19701025T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE'
  ];

  validEvents.forEach((ev, idx) => {
    const timing = (ev.startTime && ev.endTime)
      ? { start: ev.startTime, end: ev.endTime }
      : (bellTimes[ev.period] || { start: '09:00', end: '10:00' });
    const dtStart = formatIcsDateTime(ev.date, timing.start);
    const dtEnd = formatIcsDateTime(ev.date, timing.end);

    // Format Event Title (Summary)
    let summary = '';
    if (ev.isPpa) {
      summary = 'PPA (Planning & Preparation)';
    } else {
      const roomSuffix = ev.room ? ` (${ev.room})` : '';
      switch (titleFormat) {
        case 'subject_class_room':
          summary = `${ev.subject || 'Lesson'}${ev.classGroup ? ` - ${ev.classGroup}` : ''}${roomSuffix}`;
          break;
        case 'period_class_subject':
          summary = `${ev.period}: ${ev.classGroup || ev.subject}${ev.subject && ev.classGroup ? ` - ${ev.subject}` : ''}${roomSuffix}`;
          break;
        case 'class_room':
          summary = `${ev.classGroup || ev.subject}${roomSuffix}`;
          break;
        case 'class_subject_room':
        default:
          summary = `${ev.classGroup ? `${ev.classGroup} - ` : ''}${ev.subject || 'Lesson'}${roomSuffix}`;
          break;
      }
    }

    // Build event description
    const descParts = [];
    if (ev.isPpa) {
      descParts.push('Planning, Preparation and Assessment (PPA)');
    } else {
      if (ev.subject) descParts.push(`Subject: ${ev.subject}`);
      if (ev.classGroup) descParts.push(`Class: ${ev.classGroup}`);
      if (ev.year) descParts.push(`Year Group: ${ev.year}`);
      if (ev.room) descParts.push(`Room: ${ev.room}`);
      if (ev.period) descParts.push(`Period: ${ev.period} (${timing.start} - ${timing.end})`);
      if (ev.staff) descParts.push(`Teacher: ${ev.staff}`);
    }
    descParts.push('Converted with JRUSS AI Tool');

    const uid = `${ev.date.replace(/-/g, '')}-${(ev.period || 'period').replace(/\s+/g, '_')}-${idx}@jruss.co.uk`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART;TZID=${timezone}:${dtStart}`);
    lines.push(`DTEND;TZID=${timezone}:${dtEnd}`);
    lines.push(`SUMMARY:${escapeIcsText(summary)}`);
    if (ev.room) {
      lines.push(`LOCATION:${escapeIcsText(ev.room)}`);
    }
    lines.push(`DESCRIPTION:${escapeIcsText(descParts.join('\n'))}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:OPAQUE');

    // Optional notification alarm
    if (reminderMinutes > 0) {
      lines.push('BEGIN:VALARM');
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:Reminder: ${escapeIcsText(summary)}`);
      lines.push(`TRIGGER:-PT${reminderMinutes}M`);
      lines.push('END:VALARM');
    }

    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Downloads a generated .ics file in browser
 */
export function downloadIcsFile(icsContent, filename = 'Arbor_Timetable.ics') {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

