import React, { useState, useEffect, useMemo } from 'react';
import {
  Wrench, Calendar, Clock, Download, Upload, FileText, CheckCircle2,
  AlertCircle, ChevronDown, ChevronUp, Search, Info, Settings,
  MapPin, Sparkles, Check, ArrowLeft, ArrowRight, Shuffle, Calculator,
  ClipboardList
} from 'lucide-react';
import {
  parseArborCsv,
  generateIcsCalendar,
  downloadIcsFile,
  DEFAULT_BELL_TIMES
} from '../utils/arborIcs';

export default function OtherToolsModal({ isOpen, onClose }) {
  // Navigation inside the tools modal: 'hub' | 'arbor_timetable' | 'student_picker'
  const [activeTool, setActiveTool] = useState('hub');

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        if (activeTool !== 'hub') {
          setActiveTool('hub');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeTool, onClose]);

  // ==========================================
  // ARBOR TIMETABLE CONVERTER STATES
  // ==========================================
  const [inputTab, setInputTab] = useState('upload'); // 'upload' | 'paste'
  const [pastedText, setPastedText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [rawCsvData, setRawCsvData] = useState('');
  const [parseError, setParseError] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState('');

  // Options & Configurations
  const [startYear, setStartYear] = useState(() => new Date().getFullYear());
  const [includePpa, setIncludePpa] = useState(true);
  const [titleFormat, setTitleFormat] = useState('class_subject_room');
  const [reminderMinutes, setReminderMinutes] = useState(10);
  const [showBellTimesSettings, setShowBellTimesSettings] = useState(false);
  const [showOutlookGuide, setShowOutlookGuide] = useState(false);
  const [previewSearch, setPreviewSearch] = useState('');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Bell times configuration saved in localStorage
  const [bellTimes, setBellTimes] = useState(() => {
    try {
      const saved = localStorage.getItem('jruss_arbor_bell_times');
      return saved ? { ...DEFAULT_BELL_TIMES, ...JSON.parse(saved) } : { ...DEFAULT_BELL_TIMES };
    } catch {
      return { ...DEFAULT_BELL_TIMES };
    }
  });

  const handleUpdateBellTime = (period, field, value) => {
    setBellTimes(prev => {
      const next = {
        ...prev,
        [period]: {
          ...(prev[period] || { start: '09:00', end: '10:00' }),
          [field]: value
        }
      };
      try {
        localStorage.setItem('jruss_arbor_bell_times', JSON.stringify(next));
      } catch (e) {
        console.error('Failed to save bell times:', e);
      }
      return next;
    });
  };

  const handleResetBellTimes = () => {
    setBellTimes({ ...DEFAULT_BELL_TIMES });
    try {
      localStorage.removeItem('jruss_arbor_bell_times');
    } catch (e) {
      console.error(e);
    }
  };

  // Re-parse when raw data or base year changes
  const runParser = (csvText, yearOverride = startYear) => {
    if (!csvText || !csvText.trim()) {
      setParsedData(null);
      setParseError('');
      return;
    }

    try {
      const result = parseArborCsv(csvText, { baseYear: yearOverride });
      if (!result.success) {
        setParseError(result.error || 'Failed to parse timetable.');
        setParsedData(null);
      } else {
        setParseError('');
        setParsedData(result);
        if (result.staffList && result.staffList.length > 0) {
          if (!result.staffList.includes(selectedStaff)) {
            setSelectedStaff(result.staffList[0]);
          }
        }
        result.allPeriods.forEach(p => {
          if (!bellTimes[p]) {
            handleUpdateBellTime(p, 'start', '09:00');
            handleUpdateBellTime(p, 'end', '10:00');
          }
        });
      }
    } catch (err) {
      console.error(err);
      setParseError('An unexpected error occurred while parsing the CSV: ' + err.message);
      setParsedData(null);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setUploadedFileName(file.name);

    const yearMatch = file.name.match(/\b(202\d)\b/);
    let detectedYear = startYear;
    if (yearMatch && yearMatch[1]) {
      detectedYear = parseInt(yearMatch[1], 10);
      setStartYear(detectedYear);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      setRawCsvData(content);
      runParser(content, detectedYear);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handlePasteChange = (text) => {
    setPastedText(text);
    setRawCsvData(text);
    runParser(text);
  };

  const currentEvents = useMemo(() => {
    if (!parsedData || !selectedStaff) return [];
    const list = parsedData.eventsByStaff[selectedStaff] || [];
    return list.filter(ev => {
      if (ev.isPpa && !includePpa) return false;
      return true;
    });
  }, [parsedData, selectedStaff, includePpa]);

  const previewEvents = useMemo(() => {
    if (!previewSearch.trim()) return currentEvents;
    const q = previewSearch.toLowerCase();
    return currentEvents.filter(ev =>
      (ev.subject && ev.subject.toLowerCase().includes(q)) ||
      (ev.classGroup && ev.classGroup.toLowerCase().includes(q)) ||
      (ev.room && ev.room.toLowerCase().includes(q)) ||
      (ev.period && ev.period.toLowerCase().includes(q)) ||
      (ev.date && ev.date.toLowerCase().includes(q))
    );
  }, [currentEvents, previewSearch]);

  const handleDownloadIcs = () => {
    if (!currentEvents.length) return;

    const icsContent = generateIcsCalendar(currentEvents, {
      calendarName: 'Arbor Timetable',
      teacherName: selectedStaff,
      bellTimes,
      includePpa,
      titleFormat,
      reminderMinutes,
      timezone: 'Europe/London'
    });

    const sanitizedStaff = (selectedStaff || 'Staff').replace(/[^a-zA-Z0-9_-]/g, '_');
    const startStr = parsedData?.dateRange?.start ? parsedData.dateRange.start.replace(/-/g, '') : 'Schedule';
    const filename = `Arbor_Timetable_${sanitizedStaff}_${startStr}.ics`;

    downloadIcsFile(icsContent, filename);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3500);
  };

  // ==========================================
  // STUDENT RANDOM PICKER (MINI TOOL)
  // ==========================================
  const [studentInput, setStudentInput] = useState('');
  const [pickedStudent, setPickedStudent] = useState('');
  const [pickAnimation, setPickAnimation] = useState(false);

  const handlePickRandomStudent = () => {
    const list = studentInput.split('\n').map(s => s.trim()).filter(Boolean);
    if (list.length === 0) return;
    setPickAnimation(true);
    let counter = 0;
    const interval = setInterval(() => {
      const rand = list[Math.floor(Math.random() * list.length)];
      setPickedStudent(rand);
      counter++;
      if (counter > 12) {
        clearInterval(interval);
        setPickAnimation(false);
      }
    }, 80);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl h-[90vh] max-h-[90vh] flex flex-col bg-slate-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================
            STICKY HEADER (WITH BREADCRUMB / BACK BUTTON)
            ======================================================== */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-slate-900/95 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {activeTool !== 'hub' ? (
              <button
                type="button"
                onClick={() => setActiveTool('hub')}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold shrink-0"
                title="Return to Other Tools catalog"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">All Tools</span>
              </button>
            ) : (
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 border border-teal-500/40 text-teal-400 shadow-sm shrink-0">
                <Wrench className="w-5 h-5" />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide truncate">
                  {activeTool === 'hub' && 'Teacher Toolkit & Other Tools'}
                  {activeTool === 'arbor_timetable' && 'Arbor Timetable to Outlook (.ics)'}
                  {activeTool === 'student_picker' && 'Random Student Name Picker'}
                </h2>
                {activeTool === 'arbor_timetable' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                    .ics Converter
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                {activeTool === 'hub' && 'Specialised teacher utilities, MIS converters, and classroom tools.'}
                {activeTool === 'arbor_timetable' && 'Convert your exported Arbor MIS staff timetable CSV directly into an Outlook / Office 365 calendar.'}
                {activeTool === 'student_picker' && 'Quick, fair student selector for cold calling and classroom questioning.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-xl hover:bg-white/10 font-bold transition shrink-0 ml-2 border border-white/5"
            title="Close (Esc)"
          >
            ✕ Close
          </button>
        </div>

        {/* ========================================================
            SCROLLABLE BODY (FIXED WITH min-h-0 overflow-y-auto)
            ======================================================== */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6 overscroll-contain">

          {/* ========================================================
              VIEW 1: TOOLS HUB CATALOG (GRID OF TOOLS)
              ======================================================== */}
          {activeTool === 'hub' && (
            <div className="space-y-6">
              <div className="border-b border-white/10 pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Select a Tool to Launch
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* TOOL CARD 1: Arbor Timetable Converter */}
                <div
                  onClick={() => setActiveTool('arbor_timetable')}
                  className="p-5 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-emerald-500/30 hover:border-emerald-500/60 transition group cursor-pointer shadow-lg flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 group-hover:scale-105 transition">
                        <Calendar className="w-6 h-6" />
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider">
                        MIS Converter • Ready
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-white group-hover:text-emerald-300 transition">
                      Arbor Timetable to Outlook (.ics)
                    </h4>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      Upload your exported Arbor staff timetable CSV to instantly generate a standard <strong className="text-slate-200">.ics calendar file</strong>. Automatically extracts rooms, classes, and bell times for 1-click Outlook import.
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 group-hover:translate-x-1 transition">
                      Launch Converter <ArrowRight className="w-4 h-4" />
                    </span>
                    <span className="text-[11px] text-slate-500">Supports all date ranges</span>
                  </div>
                </div>

                {/* TOOL CARD 2: Student Name Randomizer */}
                <div
                  onClick={() => setActiveTool('student_picker')}
                  className="p-5 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-white/10 hover:border-violet-500/50 transition group cursor-pointer shadow-lg flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-3 rounded-xl bg-violet-500/15 border border-violet-500/40 text-violet-400 group-hover:scale-105 transition">
                        <Shuffle className="w-6 h-6" />
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/40 uppercase tracking-wider">
                        Classroom Tool
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-white group-hover:text-violet-300 transition">
                      Student Name Randomizer & Picker
                    </h4>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      Fair, low-stakes student selector for classroom cold calling, questioning routines, and group assignments. Quick paste from your markbook or SIMS/Arbor register.
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs font-semibold text-violet-400 flex items-center gap-1 group-hover:translate-x-1 transition">
                      Open Randomizer <ArrowRight className="w-4 h-4" />
                    </span>
                    <span className="text-[11px] text-slate-500">Live whiteboard friendly</span>
                  </div>
                </div>

                {/* TOOL CARD 3: Supply / Cover Note Builder (Coming Soon) */}
                <div className="p-5 rounded-2xl bg-slate-900/40 border border-white/5 opacity-70 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-3 rounded-xl bg-slate-800 text-slate-400">
                        <ClipboardList className="w-6 h-6" />
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-slate-500 border border-white/5 uppercase tracking-wider">
                        Coming Soon
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-300">
                      Supply Teacher Cover Sheet
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Instant print-ready supply cover note with room directives, emergency contacts, student seating arrangements, and reward tokens.
                    </p>
                  </div>
                </div>

                {/* TOOL CARD 4: Grade Boundary Calculator */}
                <div className="p-5 rounded-2xl bg-slate-900/40 border border-white/5 opacity-70 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-3 rounded-xl bg-slate-800 text-slate-400">
                        <Calculator className="w-6 h-6" />
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-slate-500 border border-white/5 uppercase tracking-wider">
                        Coming Soon
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-300">
                      Exam Grade Boundary Calculator
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Quick raw-mark to percentage and GCSE / A-Level grade converter for rapid mock and assessment moderation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              VIEW 2: ARBOR TIMETABLE CONVERTER (ACTIVE TOOL)
              ======================================================== */}
          {activeTool === 'arbor_timetable' && (
            <div className="space-y-6">

              {/* 1. Input Section: Upload or Paste */}
              <div className="bg-slate-900/70 border border-white/10 rounded-xl p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      1. Import Arbor Timetable
                    </span>
                    <span className="text-[11px] text-slate-500">
                      (Export from Arbor: Timetable ➔ Printable / Staff Timetable ➔ Download CSV)
                    </span>
                  </div>

                  {/* Input mode toggle */}
                  <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-white/5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setInputTab('upload')}
                      className={`px-3 py-1 rounded-md transition flex items-center gap-1.5 ${inputTab === 'upload' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload File</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputTab('paste')}
                      className={`px-3 py-1 rounded-md transition flex items-center gap-1.5 ${inputTab === 'paste' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Paste Text</span>
                    </button>
                  </div>
                </div>

                {inputTab === 'upload' ? (
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-white/15 hover:border-emerald-500/50 rounded-xl p-6 bg-slate-950/50 transition group cursor-pointer text-center relative">
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      title="Upload Arbor Staff Timetable CSV"
                    />
                    <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition mb-3">
                      <Upload className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-semibold text-white">
                      {uploadedFileName ? `Selected: ${uploadedFileName}` : 'Click or drag & drop your Arbor Timetable (.csv) file here'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Supports exported CSV files (e.g. <span className="font-mono text-emerald-300">Staff Timetable.csv</span>)
                    </p>
                  </div>
                ) : (
                  <div>
                    <textarea
                      value={pastedText}
                      onChange={(e) => handlePasteChange(e.target.value)}
                      placeholder="Paste your exported Arbor CSV contents here (including the header row)..."
                      rows={4}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                )}

                {/* Parse Error Notice */}
                {parseError && (
                  <div className="mt-3 p-3 bg-red-950/50 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{parseError}</span>
                  </div>
                )}
              </div>

              {/* 2. Detected Timetable & Configuration */}
              {parsedData && (
                <div className="space-y-6 animate-fade-in">
                  {/* Summary Bar */}
                  <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white">
                            {selectedStaff || 'Staff Member'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            {currentEvents.length} Sessions Ready
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                          <span>📅 Date Range: <strong className="text-slate-200">{parsedData.dateRange.start}</strong> to <strong className="text-slate-200">{parsedData.dateRange.end}</strong></span>
                          <span>⏱️ Total Days: <strong className="text-slate-200">{parsedData.dateRange.totalDays} days</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Multiple Staff Selector if CSV contains multiple staff */}
                    {parsedData.staffList.length > 1 && (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-semibold text-slate-400">Teacher:</span>
                        <select
                          value={selectedStaff}
                          onChange={(e) => setSelectedStaff(e.target.value)}
                          className="bg-slate-950 text-white text-xs border border-white/10 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 font-medium"
                        >
                          {parsedData.staffList.map((st) => (
                            <option key={st} value={st}>
                              {st} ({parsedData.eventsByStaff[st]?.length || 0} sessions)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* 3. Export Options & Settings Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Event Format Controls */}
                    <div className="bg-slate-900/70 border border-white/10 rounded-xl p-4 space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                        <Settings className="w-4 h-4 text-emerald-400" />
                        <span>Calendar Event Preferences</span>
                      </h3>

                      {/* Title Format */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Event Title Format in Outlook:
                        </label>
                        <select
                          value={titleFormat}
                          onChange={(e) => setTitleFormat(e.target.value)}
                          className="w-full bg-slate-950 text-white text-xs border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 font-medium"
                        >
                          <option value="class_subject_room">10C/Cs - Computer Science (ICT1) [Class - Subject (Room)]</option>
                          <option value="subject_class_room">Computer Science - 10C/Cs (ICT1) [Subject - Class (Room)]</option>
                          <option value="period_class_subject">Period 1: 10C/Cs - Computer Science (ICT1) [Period: Class - Subject]</option>
                          <option value="class_room">10C/Cs (ICT1) [Short Class & Room]</option>
                        </select>
                      </div>

                      {/* Academic Year Selector */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                            Academic Year Start:
                          </label>
                          <input
                            type="number"
                            min="2020"
                            max="2035"
                            value={startYear}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              setStartYear(val);
                              runParser(rawCsvData, val);
                            }}
                            className="w-full bg-slate-950 text-white text-xs border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                            Outlook Notification:
                          </label>
                          <select
                            value={reminderMinutes}
                            onChange={(e) => setReminderMinutes(parseInt(e.target.value, 10))}
                            className="w-full bg-slate-950 text-white text-xs border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 font-medium"
                          >
                            <option value={0}>No reminder popup</option>
                            <option value={5}>5 minutes before</option>
                            <option value={10}>10 minutes before (Standard)</option>
                            <option value={15}>15 minutes before</option>
                          </select>
                        </div>
                      </div>

                      {/* PPA Checkbox */}
                      <label className="flex items-center gap-2 cursor-pointer pt-1 text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={includePpa}
                          onChange={(e) => setIncludePpa(e.target.checked)}
                          className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 bg-slate-900"
                        />
                        <span>Include PPA (Planning & Prep) sessions in calendar</span>
                      </label>
                    </div>

                    {/* Bell Times Summary Card */}
                    <div className="bg-slate-900/70 border border-white/10 rounded-xl p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-emerald-400" />
                            <span>School Bell Times ({parsedData.allPeriods.length} Periods)</span>
                          </h3>
                          <button
                            type="button"
                            onClick={() => setShowBellTimesSettings(!showBellTimesSettings)}
                            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                          >
                            <span>{showBellTimesSettings ? 'Hide Adjustments' : 'Edit Timings'}</span>
                            {showBellTimesSettings ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Standard bell times are applied automatically. Click "Edit Timings" to adjust exact start/end times for your school.
                        </p>

                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {parsedData.allPeriods.slice(0, 6).map(p => {
                            const t = bellTimes[p] || { start: '09:00', end: '10:00' };
                            return (
                              <span key={p} className="px-2 py-1 bg-slate-950 border border-white/5 rounded-md text-[10px] text-slate-300 font-medium">
                                {p}: <strong className="text-white">{t.start}-{t.end}</strong>
                              </span>
                            );
                          })}
                          {parsedData.allPeriods.length > 6 && (
                            <span className="px-2 py-1 bg-slate-950 text-[10px] text-slate-500 rounded-md">
                              +{parsedData.allPeriods.length - 6} more
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quick Action Button in panel */}
                      <div className="pt-3 mt-3 border-t border-white/10 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">
                          Times are remembered for future exports.
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowBellTimesSettings(!showBellTimesSettings)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg font-semibold transition"
                        >
                          Customize Times
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Bell Times Configurator */}
                  {showBellTimesSettings && (
                    <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-4 sm:p-5 space-y-4 animate-fade-in">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-emerald-400" />
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                            Configure School Bell Schedule
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={handleResetBellTimes}
                          className="text-[11px] text-slate-400 hover:text-white transition underline"
                        >
                          Reset to Default Secondary Times
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {parsedData.allPeriods.map(period => {
                          const timing = bellTimes[period] || { start: '09:00', end: '10:00' };
                          return (
                            <div key={period} className="bg-slate-950 p-3 rounded-lg border border-white/10 flex flex-col gap-1.5">
                              <span className="text-xs font-bold text-slate-200 truncate">
                                {period}
                              </span>
                              <div className="flex items-center gap-2">
                                <div className="flex-1">
                                  <span className="text-[9px] uppercase tracking-wider text-slate-500 block mb-0.5">Start</span>
                                  <input
                                    type="time"
                                    value={timing.start}
                                    onChange={(e) => handleUpdateBellTime(period, 'start', e.target.value)}
                                    className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                                  />
                                </div>
                                <span className="text-slate-500 pt-3">-</span>
                                <div className="flex-1">
                                  <span className="text-[9px] uppercase tracking-wider text-slate-500 block mb-0.5">End</span>
                                  <input
                                    type="time"
                                    value={timing.end}
                                    onChange={(e) => handleUpdateBellTime(period, 'end', e.target.value)}
                                    className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 4. Download Action Banner */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-950/70 via-slate-900 to-teal-950/70 border border-emerald-500/40 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
                    <div>
                      <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        Ready to Generate Outlook Calendar (.ics)
                      </h4>
                      <p className="text-xs text-slate-300 mt-1">
                        Outputs <strong className="text-white">{currentEvents.length} lessons</strong> formatted with UK London timezone, room locations, and calendar alerts.
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={handleDownloadIcs}
                        className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover-scale transition"
                      >
                        {downloadSuccess ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Downloaded .ics!</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            <span>Download Outlook Calendar (.ics)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 5. Live Events Preview Table */}
                  <div className="bg-slate-900/70 border border-white/10 rounded-xl overflow-hidden">
                    <div className="p-3.5 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950/40">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                          Live Schedule Preview
                        </span>
                        <span className="text-xs text-slate-500">
                          ({previewEvents.length} shown)
                        </span>
                      </div>

                      {/* Search box */}
                      <div className="relative w-full sm:w-64">
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Filter by class, subject, or room..."
                          value={previewSearch}
                          onChange={(e) => setPreviewSearch(e.target.value)}
                          className="w-full bg-slate-900 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
                      {previewEvents.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-500">
                          No matching lessons found.
                        </div>
                      ) : (
                        previewEvents.map((ev, idx) => {
                          const timing = bellTimes[ev.period] || { start: '09:00', end: '10:00' };
                          return (
                            <div key={idx} className="p-3 hover:bg-slate-800/50 transition flex items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-3 min-w-0">
                                {/* Date / Time Pill */}
                                <div className="bg-slate-950 px-2.5 py-1.5 rounded-lg border border-white/5 text-center shrink-0 w-28">
                                  <span className="text-[10px] text-emerald-400 font-bold block leading-tight">
                                    {ev.dayName} {ev.dayNum} {ev.monthName}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {timing.start} - {timing.end}
                                  </span>
                                </div>

                                {/* Class & Subject */}
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-white truncate">
                                      {ev.isPpa ? 'PPA (Planning & Prep)' : (ev.classGroup || ev.subject)}
                                    </span>
                                    {ev.period && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-800 text-slate-300 font-medium">
                                        {ev.period}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-400 truncate">
                                    {ev.subject} {ev.year ? `• ${ev.year}` : ''}
                                  </div>
                                </div>
                              </div>

                              {/* Room Badge */}
                              {ev.room && (
                                <div className="px-2 py-1 rounded bg-slate-800 border border-white/10 text-cyan-300 font-mono text-[11px] flex items-center gap-1 shrink-0">
                                  <MapPin className="w-3 h-3 text-cyan-400" />
                                  <span>{ev.room}</span>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* 6. Step-by-Step Outlook Import Guide */}
                  <div className="bg-slate-900/60 border border-white/10 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowOutlookGuide(!showOutlookGuide)}
                      className="w-full p-4 text-left flex items-center justify-between hover:bg-slate-800/40 transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span className="text-xs font-bold text-white">
                          How to import the downloaded .ics file into Microsoft Outlook / Office 365
                        </span>
                      </div>
                      {showOutlookGuide ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>

                    {showOutlookGuide && (
                      <div className="p-4 pt-1 border-t border-white/10 bg-slate-950/60 text-xs text-slate-300 space-y-3 animate-fade-in">
                        <div>
                          <strong className="text-emerald-400">Method A: Outlook on the Web / Office 365 (Recommended)</strong>
                          <ol className="list-decimal pl-5 mt-1 space-y-1 text-slate-400 text-[11px]">
                            <li>Open your school email in browser and switch to <strong>Calendar</strong>.</li>
                            <li>Click <strong>Add calendar</strong> in the left sidebar navigation.</li>
                            <li>Select <strong>Upload from file</strong>.</li>
                            <li>Click <strong>Browse</strong>, select your downloaded <span className="text-white font-mono">.ics</span> file, choose your primary Calendar, and click <strong>Import</strong>.</li>
                            <li>All lessons, rooms, and bell times are instantly imported!</li>
                          </ol>
                        </div>

                        <div>
                          <strong className="text-cyan-400">Method B: Classic Outlook Desktop App</strong>
                          <ol className="list-decimal pl-5 mt-1 space-y-1 text-slate-400 text-[11px]">
                            <li>Double-click the downloaded <span className="text-white font-mono">.ics</span> file on Windows, or drag it into Outlook.</li>
                            <li>When prompted by Outlook, choose <strong>"Import"</strong> (to merge into your existing calendar) or <strong>"Open as New"</strong> (to keep as a separate timetable overlay).</li>
                          </ol>
                        </div>

                        <div>
                          <strong className="text-amber-400">Google Calendar & Apple Calendar:</strong>
                          <p className="text-slate-400 text-[11px] mt-0.5">
                            In Google Calendar: Settings ➔ Import & Export ➔ Select the .ics file. In Apple Calendar: File ➔ Import.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              )}

            </div>
          )}

          {/* ========================================================
              VIEW 3: RANDOM STUDENT NAME PICKER
              ======================================================== */}
          {activeTool === 'student_picker' && (
            <div className="space-y-6 max-w-xl mx-auto">
              <div className="bg-slate-900/80 border border-violet-500/30 rounded-2xl p-6 text-center space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-400">
                  Classroom Questioning Selector
                </span>

                <div className="h-28 flex items-center justify-center bg-slate-950/80 rounded-xl border border-white/10 p-4">
                  <span className={`text-2xl sm:text-3xl font-extrabold transition-all duration-75 ${
                    pickAnimation ? 'text-amber-300 scale-105' : pickedStudent ? 'text-emerald-400 scale-110' : 'text-slate-500'
                  }`}>
                    {pickedStudent || 'Ready to Pick Student'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handlePickRandomStudent}
                  className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl font-bold text-sm shadow-lg hover-scale transition flex items-center justify-center gap-2"
                >
                  <Shuffle className="w-4 h-4" />
                  <span>Pick Random Student</span>
                </button>
              </div>

              <div className="bg-slate-900/60 border border-white/10 rounded-xl p-4">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Paste Class Student Roster (One name per line):
                </label>
                <textarea
                  rows={6}
                  value={studentInput}
                  onChange={(e) => setStudentInput(e.target.value)}
                  placeholder="e.g.&#10;Alice Smith&#10;Ben Jones&#10;Chloe Davies&#10;Daniel Brown&#10;Emma Wilson..."
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-violet-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  {studentInput.split('\n').filter(s => s.trim()).length} students currently loaded.
                </span>
              </div>
            </div>
          )}

        </div>

        {/* ========================================================
            STICKY FOOTER (ALWAYS VISIBLE & ACCESSIBLE)
            ======================================================== */}
        <div className="p-4 border-t border-white/10 bg-slate-900/95 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 truncate mr-2">
            {activeTool === 'arbor_timetable'
              ? '💡 Timetable data stays 100% on your device and is never sent to any server.'
              : 'Teacher Toolkit • JRUSS AI Tool'}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeTool !== 'hub' && (
              <button
                type="button"
                onClick={() => setActiveTool('hub')}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition"
              >
                ← Back to Tools
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
