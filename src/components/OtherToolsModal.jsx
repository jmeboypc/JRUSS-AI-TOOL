import React, { useState, useEffect, useMemo } from 'react';
import {
  Wrench, ArrowLeft, ArrowRight, Shuffle, Layers, Video,
  Download, Copy, Check, Sparkles, AlertCircle, FileText, Scissors
} from 'lucide-react';
import { parseFlashcardInput, generateFlashcardsPdf } from '../utils/flashcardPdf';
import { generateContent, sanitizeApiKey } from '../utils/ai';
import { exportMarkdownToPdf } from '../utils/pdfExport';

const SAMPLE_FLASHCARDS = `CPU : Central Processing Unit — fetches, decodes, and executes instructions
RAM : Volatile main memory storing currently running programs and data
ROM : Non-volatile memory storing the boot-up BIOS/UEFI firmware
Cache : Fast, small memory inside the CPU storing frequently used instructions
Clock Speed : Number of fetch-execute cycles per second, measured in GHz
ALU : Arithmetic Logic Unit — performs mathematical and logical operations`;

export default function OtherToolsModal({ isOpen, onClose }) {
  // Navigation inside the tools modal: 'hub' | 'flashcards' | 'video_worksheet' | 'student_picker'
  const [activeTool, setActiveTool] = useState('hub');

  // Keyboard shortcut: Escape to go back or close
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
  // TOOL 1: FLASHCARD & REVISION CARD PDF MAKER
  // ==========================================
  const [deckTitle, setDeckTitle] = useState('CPU Architecture Revision');
  const [flashcardRaw, setFlashcardRaw] = useState(SAMPLE_FLASHCARDS);
  const [cardMode, setCardMode] = useState('duplex'); // 'duplex' | 'matchup'
  const [cardsPerPage, setCardsPerPage] = useState(8);
  const [cardAccent, setCardAccent] = useState('indigo');
  const [showCutGuides, setShowCutGuides] = useState(true);
  const [pdfExported, setPdfExported] = useState(false);

  const parsedCards = useMemo(() => parseFlashcardInput(flashcardRaw), [flashcardRaw]);

  const handleExportFlashcardsPdf = () => {
    if (parsedCards.length === 0) return;
    generateFlashcardsPdf(parsedCards, {
      title: deckTitle,
      mode: cardMode,
      cardsPerPage,
      accent: cardAccent,
      showCutGuides,
    });
    setPdfExported(true);
    setTimeout(() => setPdfExported(false), 3000);
  };

  // ==========================================
  // TOOL 2: VIDEO TRANSCRIPT -> WORKSHEET & GAP-FILL
  // ==========================================
  const [videoTitle, setVideoTitle] = useState('');
  const [videoStage, setVideoStage] = useState('GCSE / KS4');
  const [transcriptText, setTranscriptText] = useState('');
  const [includeQuestions, setIncludeQuestions] = useState(true);
  const [includeCloze, setIncludeCloze] = useState(true);
  const [includeGlossary, setIncludeGlossary] = useState(true);
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [videoResult, setVideoResult] = useState('');
  const [videoError, setVideoError] = useState('');
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [resultCopied, setResultCopied] = useState(false);

  const buildVideoPrompts = () => {
    const sections = [];
    if (includeQuestions) sections.push('1. **Viewing Comprehension Questions** (8–10 questions in chronological order of the video, with mark allocations in brackets like `[2 marks]`).');
    if (includeCloze) sections.push('2. **Cloze / Gap-Fill Summary** (a concise summary paragraph with `________` blanks and a shuffled **Word Bank** box above it).');
    if (includeGlossary) sections.push('3. **Key Vocabulary Glossary** (5–8 essential terms from the video with student-friendly definitions).');
    if (includeAnswers) sections.push('4. **Teacher Answer Key** (clearly separated at the bottom for easy removal before printing).');

    const systemPrompt = `You are an expert UK secondary school teacher. Convert raw video transcripts into clean, print-ready classroom worksheets formatted in clear Markdown. Use British English spelling.`;
    const userPrompt = [
      `Create a student-ready video worksheet for **${videoStage}**${videoTitle.trim() ? ` on the topic/video: "${videoTitle.trim()}"` : ''}.`,
      '',
      'Include the following sections:',
      sections.join('\n'),
      '',
      '--- VIDEO TRANSCRIPT ---',
      transcriptText.trim(),
    ].join('\n');

    return { systemPrompt, userPrompt };
  };

  const handleGenerateVideoWorksheet = async () => {
    if (!transcriptText.trim()) {
      setVideoError('Please paste a video transcript first.');
      return;
    }
    if (!includeQuestions && !includeCloze && !includeGlossary) {
      setVideoError('Select at least one worksheet section to generate.');
      return;
    }

    const provider = localStorage.getItem('ai_provider') || 'gemini';
    const apiKey = sanitizeApiKey(localStorage.getItem('ai_apikey') || '');
    const customModel = (localStorage.getItem('ai_custom_model') || '').trim();
    const model = customModel || localStorage.getItem('ai_model') || 'gemini-2.5-flash';

    if (!apiKey) {
      setVideoError('No API key configured in Settings — you can either add one in Settings or use "Copy Prompt" below to paste into Copilot / ChatGPT / Gemini.');
      return;
    }

    setVideoError('');
    setIsGeneratingVideo(true);
    try {
      const { systemPrompt, userPrompt } = buildVideoPrompts();
      const output = await generateContent({ provider, apiKey, model, systemPrompt, userPrompt });
      setVideoResult(output || '');
    } catch (err) {
      setVideoError(err?.message || 'Failed to generate worksheet.');
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handleCopyVideoPrompt = async () => {
    if (!transcriptText.trim()) {
      setVideoError('Please paste a video transcript first.');
      return;
    }
    setVideoError('');
    const { systemPrompt, userPrompt } = buildVideoPrompts();
    try {
      await navigator.clipboard.writeText(`${systemPrompt}\n\n${userPrompt}`);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyVideoResult = async () => {
    if (!videoResult) return;
    try {
      await navigator.clipboard.writeText(videoResult);
      setResultCopied(true);
      setTimeout(() => setResultCopied(false), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportVideoPdf = async () => {
    if (!videoResult) return;
    const safeName = (videoTitle.trim() || 'Video_Worksheet').replace(/[^a-zA-Z0-9_-]/g, '_');
    await exportMarkdownToPdf(videoResult, `${safeName}.pdf`, 'portrait');
  };

  // ==========================================
  // TOOL 3: STUDENT RANDOM PICKER
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
      className="fixed inset-0 z-50 bg-[#080b11]/90 backdrop-blur-md p-3 sm:p-5 flex justify-center items-start animate-fade-in"
      style={{
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-slate-950 border border-white/10 rounded-2xl shadow-2xl my-auto"
        style={{
          height: '88vh',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================
            STICKY HEADER (WITH BREADCRUMB / BACK BUTTON)
            ======================================================== */}
        <div
          className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-slate-900/95"
          style={{ flexShrink: 0 }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {activeTool !== 'hub' ? (
              <button
                type="button"
                onClick={() => setActiveTool('hub')}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold shrink-0"
                title="Return to Other Tools catalog"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>All Tools</span>
              </button>
            ) : (
              <div className="p-2.5 rounded-xl bg-teal-500/20 border border-teal-500/40 text-teal-400 shadow-sm shrink-0">
                <Wrench className="w-5 h-5" />
              </div>
            )}

            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide truncate">
                {activeTool === 'hub' && 'Teacher Toolkit & Other Tools'}
                {activeTool === 'flashcards' && 'Printable Flashcard & Match-Up PDF Maker'}
                {activeTool === 'video_worksheet' && 'YouTube / Video Transcript → Worksheet'}
                {activeTool === 'student_picker' && 'Random Student Name Picker'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 mb-0 truncate">
                {activeTool === 'hub' && 'Specialised teacher utilities and classroom tools.'}
                {activeTool === 'flashcards' && 'Paste Term : Definition pairs and export print-ready A4 duplex flashcards or match-up sheets.'}
                {activeTool === 'video_worksheet' && 'Turn any YouTube or video transcript into comprehension questions, a gap-fill, and an answer key.'}
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
            SCROLLABLE BODY
            ======================================================== */}
        <div
          className="p-4 sm:p-6"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
          }}
        >

          {/* ========================================================
              VIEW 1: TOOLS HUB CATALOG
              ======================================================== */}
          {activeTool === 'hub' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="border-b border-white/10 pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 m-0">
                  Select a Tool to Launch
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* TOOL CARD 1: Printable Flashcard PDF Maker */}
                <div
                  onClick={() => setActiveTool('flashcards')}
                  className="p-5 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-indigo-500/30 hover:border-indigo-400/60 transition group cursor-pointer shadow-lg flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-3 rounded-xl bg-indigo-500/15 border border-indigo-500/40 text-indigo-400 group-hover:scale-105 transition">
                        <Layers className="w-6 h-6" />
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider">
                        Offline • PDF Export
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-white group-hover:text-indigo-300 transition">
                      Flashcard &amp; Match-Up PDF Maker
                    </h4>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      Paste key terms and definitions to generate print-ready A4 <strong className="text-slate-200">double-sided flashcards</strong> (auto-mirrored for duplex) or <strong className="text-slate-200">cut-out match-up sheets</strong>.
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs font-semibold text-indigo-400 flex items-center gap-1 transition">
                      Open Flashcard Maker <ArrowRight className="w-4 h-4" />
                    </span>
                    <span className="text-[11px] text-slate-500">Zero formatting hassle</span>
                  </div>
                </div>

                {/* TOOL CARD 2: YouTube / Video Transcript -> Worksheet */}
                <div
                  onClick={() => setActiveTool('video_worksheet')}
                  className="p-5 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-rose-500/30 hover:border-rose-400/60 transition group cursor-pointer shadow-lg flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-400 group-hover:scale-105 transition">
                        <Video className="w-6 h-6" />
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase tracking-wider">
                        AI + Prompt Mode
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-white group-hover:text-rose-300 transition">
                      Video Transcript → Worksheet &amp; Gap-Fill
                    </h4>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      Paste a YouTube or video transcript to build chronological <strong className="text-slate-200">viewing questions</strong>, a <strong className="text-slate-200">cloze gap-fill</strong> with word bank, and a <strong className="text-slate-200">teacher answer key</strong>.
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs font-semibold text-rose-400 flex items-center gap-1 transition">
                      Open Video Worksheet <ArrowRight className="w-4 h-4" />
                    </span>
                    <span className="text-[11px] text-slate-500">Export straight to PDF</span>
                  </div>
                </div>

                {/* TOOL CARD 3: Student Name Randomizer */}
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
                      Student Name Randomizer &amp; Picker
                    </h4>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      Fair, low-stakes student selector for classroom cold calling, questioning routines, and group assignments.
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs font-semibold text-violet-400 flex items-center gap-1 transition">
                      Open Randomizer <ArrowRight className="w-4 h-4" />
                    </span>
                    <span className="text-[11px] text-slate-500">Live whiteboard friendly</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              VIEW 2: FLASHCARD & MATCH-UP PDF MAKER
              ======================================================== */}
          {activeTool === 'flashcards' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Deck Settings Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900/70 border border-white/10 rounded-xl p-4" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Deck / Topic Title (printed in page header):
                    </label>
                    <input
                      type="text"
                      value={deckTitle}
                      onChange={(e) => setDeckTitle(e.target.value)}
                      placeholder="e.g. GCSE Computer Science — Memory"
                      className="w-full bg-slate-950 text-white text-xs border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Layout Mode:
                      </label>
                      <select
                        value={cardMode}
                        onChange={(e) => setCardMode(e.target.value)}
                        className="w-full bg-slate-950 text-white text-xs border border-white/10 rounded-lg px-2.5 py-2 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="duplex">Double-Sided Flashcards</option>
                        <option value="matchup">Match-Up Cut-Out Grid</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Density:
                      </label>
                      <select
                        value={cardsPerPage}
                        onChange={(e) => setCardsPerPage(parseInt(e.target.value, 10))}
                        className="w-full bg-slate-950 text-white text-xs border border-white/10 rounded-lg px-2.5 py-2 focus:outline-none focus:border-indigo-500"
                      >
                        <option value={8}>8 cards / page (2×4)</option>
                        <option value={6}>6 cards / page (2×3)</option>
                        <option value={4}>4 cards / page (2×2 large)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/70 border border-white/10 rounded-xl p-4" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                      Card Accent Colour:
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {[
                        { id: 'indigo', label: 'Indigo', hex: '#4f46e5' },
                        { id: 'emerald', label: 'Emerald', hex: '#10b981' },
                        { id: 'teal', label: 'Teal', hex: '#0d9488' },
                        { id: 'amber', label: 'Amber', hex: '#d97706' },
                        { id: 'slate', label: 'Mono', hex: '#334155' },
                      ].map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setCardAccent(c.id)}
                          style={{
                            border: cardAccent === c.id ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.12)',
                            backgroundColor: 'rgba(2, 6, 23, 0.7)',
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-200 flex items-center gap-1.5 transition"
                        >
                          <span style={{ width: '10px', height: '10px', borderRadius: '9999px', backgroundColor: c.hex, display: 'inline-block' }} />
                          <span>{c.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={showCutGuides}
                      onChange={(e) => setShowCutGuides(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900"
                    />
                    <Scissors className="w-3.5 h-3.5 text-slate-400" />
                    <span>Show dashed cut-out guides</span>
                  </label>
                </div>
              </div>

              {/* Input Textarea */}
              <div className="bg-slate-900/70 border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Cards Input ({parsedCards.length} cards detected)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFlashcardRaw(SAMPLE_FLASHCARDS)}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 underline"
                    >
                      Load Example
                    </button>
                    <button
                      type="button"
                      onClick={() => setFlashcardRaw('')}
                      className="text-[11px] text-slate-400 hover:text-white underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mb-2">
                  One card per line using <code className="text-indigo-300">:</code>, <code className="text-indigo-300">|</code>, <code className="text-indigo-300"> - </code>, or paste 2 columns directly from Excel / Quizlet.
                </p>
                <textarea
                  rows={7}
                  value={flashcardRaw}
                  onChange={(e) => setFlashcardRaw(e.target.value)}
                  placeholder="Term : Definition&#10;Question | Answer"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Action Bar + Live Preview */}
              <div
                className="p-4 rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(49, 46, 129, 0.45), rgba(15, 23, 42, 0.92))',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}
              >
                <div style={{ minWidth: '220px', flex: '1 1 260px' }}>
                  <h4 className="text-sm font-bold text-white m-0">
                    {cardMode === 'duplex' ? 'Ready for Double-Sided A4 Print' : 'Ready for Match-Up Cut-Out Sheet'}
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 mb-0">
                    {cardMode === 'duplex'
                      ? 'Backs are automatically horizontally mirrored so printing Duplex (Flip on Long Edge) lines up every card.'
                      : 'Terms and definitions appear side-by-side in 2 columns for quick guillotine/scissors prep.'}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={parsedCards.length === 0}
                  onClick={handleExportFlashcardsPdf}
                  style={{
                    background: parsedCards.length > 0 ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'rgba(51,65,85,0.5)',
                    padding: '0.625rem 1.25rem',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    opacity: parsedCards.length === 0 ? 0.5 : 1,
                  }}
                  className="rounded-xl text-white text-xs font-bold flex items-center gap-2 hover-scale transition"
                >
                  {pdfExported ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>PDF Downloaded!</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Download Flashcards PDF ({parsedCards.length})</span>
                    </>
                  )}
                </button>
              </div>

              {/* Card Preview Grid */}
              {parsedCards.length > 0 && (
                <div className="bg-slate-900/70 border border-white/10 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-white/10 bg-slate-950/50 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Card Preview ({parsedCards.length})
                  </div>
                  <div
                    style={{ maxHeight: '220px', overflowY: 'auto' }}
                    className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5"
                  >
                    {parsedCards.map((c, idx) => (
                      <div key={idx} className="bg-slate-950 border border-white/10 rounded-lg p-3 text-xs">
                        <div className="font-bold text-indigo-300 mb-1">
                          #{idx + 1} • {c.front || '(Blank front)'}
                        </div>
                        <div className="text-slate-300 text-[11px] leading-relaxed">
                          {c.back || <span className="text-slate-500 italic">(Blank back)</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              VIEW 3: YOUTUBE / VIDEO TRANSCRIPT -> WORKSHEET
              ======================================================== */}
          {activeTool === 'video_worksheet' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="bg-slate-900/70 border border-white/10 rounded-xl p-4" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Video Title / Topic (optional):
                    </label>
                    <input
                      type="text"
                      value={videoTitle}
                      onChange={(e) => setVideoTitle(e.target.value)}
                      placeholder="e.g. How Does DNS Work? — Computerphile"
                      className="w-full bg-slate-950 text-white text-xs border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Key Stage / Level:
                    </label>
                    <select
                      value={videoStage}
                      onChange={(e) => setVideoStage(e.target.value)}
                      className="w-full bg-slate-950 text-white text-xs border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:border-rose-500"
                    >
                      <option value="KS3 (Years 7-9)">KS3 (Years 7–9)</option>
                      <option value="GCSE / KS4">GCSE / KS4</option>
                      <option value="A-Level / KS5">A-Level / KS5</option>
                    </select>
                  </div>
                </div>

                {/* Output Checkboxes */}
                <div className="flex flex-wrap gap-4 pt-1 text-xs text-slate-300">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={includeQuestions} onChange={(e) => setIncludeQuestions(e.target.checked)} />
                    <span>Comprehension Questions</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={includeCloze} onChange={(e) => setIncludeCloze(e.target.checked)} />
                    <span>Gap-Fill + Word Bank</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={includeGlossary} onChange={(e) => setIncludeGlossary(e.target.checked)} />
                    <span>Key Vocabulary</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={includeAnswers} onChange={(e) => setIncludeAnswers(e.target.checked)} />
                    <span>Teacher Answer Key</span>
                  </label>
                </div>

                {/* Transcript Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-400">
                      Paste Video Transcript:
                    </label>
                    <span className="text-[10px] text-slate-500">
                      YouTube tip: click <strong>...more</strong> → <strong>Show transcript</strong> → copy &amp; paste
                    </span>
                  </div>
                  <textarea
                    rows={6}
                    value={transcriptText}
                    onChange={(e) => setTranscriptText(e.target.value)}
                    placeholder="Paste the video transcript here (timestamps are fine — they will be cleaned up automatically)..."
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-rose-500"
                  />
                </div>

                {videoError && (
                  <div className="p-3 bg-red-950/50 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{videoError}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-3 flex-wrap pt-1">
                  <button
                    type="button"
                    disabled={isGeneratingVideo}
                    onClick={handleGenerateVideoWorksheet}
                    style={{
                      background: 'linear-gradient(135deg, #e11d48, #be123c)',
                      padding: '0.6rem 1.25rem',
                      opacity: isGeneratingVideo ? 0.65 : 1,
                    }}
                    className="rounded-xl text-white text-xs font-bold flex items-center gap-2 hover-scale transition"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isGeneratingVideo ? 'Generating Worksheet...' : 'Generate Worksheet with AI'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyVideoPrompt}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition"
                  >
                    {promptCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{promptCopied ? 'Prompt Copied!' : 'Copy Prompt (for Copilot / ChatGPT)'}</span>
                  </button>
                </div>
              </div>

              {/* Generated Worksheet Output */}
              {videoResult && (
                <div className="bg-slate-900/80 border border-emerald-500/30 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/10 bg-slate-950/60 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                      <FileText className="w-4 h-4" />
                      <span>Generated Worksheet</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyVideoResult}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition"
                      >
                        {resultCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{resultCopied ? 'Copied!' : 'Copy Text'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleExportVideoPdf}
                        style={{ background: 'linear-gradient(135deg, #10b981, #0d9488)' }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export PDF</span>
                      </button>
                    </div>
                  </div>
                  <pre
                    style={{ maxHeight: '300px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}
                    className="p-4 text-xs text-slate-200 font-sans leading-relaxed m-0"
                  >
                    {videoResult}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              VIEW 4: RANDOM STUDENT NAME PICKER
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
        <div
          className="p-4 border-t border-white/10 bg-slate-900/95 flex items-center justify-between"
          style={{ flexShrink: 0 }}
        >
          <div className="text-[11px] text-slate-500 truncate mr-2">
            Teacher Toolkit • JRUSS AI Tool
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
