import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  X, ChevronLeft, ChevronRight, Play, Pause, RotateCcw,
  Volume2, VolumeX, Maximize2, Minimize2, Sun, Moon,
  Timer, Sparkles, ZoomIn, ZoomOut, ExternalLink,
  PenTool, Eraser, Trash2, CheckCircle2,
  Eye, EyeOff
} from 'lucide-react';
import { marked } from 'marked';
import { parseWhiteboardStages, splitStageContent } from '../utils/whiteboardParser';

// Built-in Web Audio API chime (C5-E5-G5-C6 harmonic bell)
function playClassroomChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.50];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.15);
      gain.gain.setValueAtTime(0, now + idx * 0.15);
      gain.gain.linearRampToValueAtTime(0.22, now + idx * 0.15 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.15 + 0.65);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.15);
      osc.stop(now + idx * 0.15 + 0.7);
    });
  } catch (err) {
    console.warn('Web Audio chime unavailable:', err);
  }
}

export default function WhiteboardView({
  isOpen,
  onClose,
  content = '',
  topic = '',
  educationStage = 'secondary'
}) {
  const [activeStage, setActiveStage] = useState(0);
  const [theme, setTheme] = useState('dark'); // 'dark' | 'light'
  const [fontScale, setFontScale] = useState('large'); // 'normal' | 'large' | 'xlarge' | 'huge'
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState('presenter'); // 'presenter' (answers shown) | 'pupil' (answers hidden)
  const [pupilWindowConnected, setPupilWindowConnected] = useState(false);

  // Timer State
  const [showTimer, setShowTimer] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(300); // 5 mins default
  const [timerInitial, setTimerInitial] = useState(300);
  const [timerRunning, setTimerRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Timer Dragging & Pinning
  const [timerPos, setTimerPos] = useState({ x: 40, y: 120 });
  const [isTimerPinned, setIsTimerPinned] = useState(false);
  const [isDraggingTimer, setIsDraggingTimer] = useState(false);
  const timerDragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

  // Interactive Pen Tool
  const [isPenActive, setIsPenActive] = useState(false);
  const [penColor, setPenColor] = useState('#fbbf24'); // Amber default
  const [penSize, setPenSize] = useState(4);
  const [isHighlighter, setIsHighlighter] = useState(false);
  const [isEraser, setIsEraser] = useState(false);
  const [showPenMenu, setShowPenMenu] = useState(false);
  const penMenuRef = useRef(null);
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const [drawingHistory, setDrawingHistory] = useState({});

  // Close pen dropdown when clicking outside
  useEffect(() => {
    if (!showPenMenu) return;
    const handleOutsideClick = (e) => {
      if (penMenuRef.current && !penMenuRef.current.contains(e.target) && !e.target.closest('button[title*="Pen"]')) {
        setShowPenMenu(false);
      }
    };
    window.addEventListener('pointerdown', handleOutsideClick);
    return () => window.removeEventListener('pointerdown', handleOutsideClick);
  }, [showPenMenu]);

  // BroadcastChannel for syncing with the Pupil Projector window
  const channelRef = useRef(null);

  // Stage Parser
  const stages = useMemo(() => {
    return parseWhiteboardStages(content, topic || 'Lesson Deck');
  }, [content, topic]);

  // Broadcast state updates to Pupil window and persist to localStorage
  const broadcastSyncData = useCallback(() => {
    const data = {
      content,
      topic,
      activeStage,
      theme,
      fontScale,
      timerVisible: showTimer,
      timerSeconds,
      timerRunning
    };

    try {
      localStorage.setItem('jruss_whiteboard_data', JSON.stringify(data));
      if (channelRef.current) {
        channelRef.current.postMessage({ type: 'UPDATE_DATA', data });
      }
    } catch {
      // ignore
    }
  }, [content, topic, activeStage, theme, fontScale, showTimer, timerSeconds, timerRunning]);

  const broadcastSyncDataRef = useRef(broadcastSyncData);
  useEffect(() => {
    broadcastSyncDataRef.current = broadcastSyncData;
  }, [broadcastSyncData]);

  // Set up BroadcastChannel communication
  useEffect(() => {
    try {
      const ch = new BroadcastChannel('jruss_whiteboard_sync');
      channelRef.current = ch;
      ch.onmessage = (e) => {
        if (e.data?.type === 'PUPIL_WINDOW_READY') {
          setPupilWindowConnected(true);
          broadcastSyncDataRef.current?.();
        }
      };
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }

    return () => {
      if (channelRef.current) channelRef.current.close();
    };
  }, []);

  // Sync whenever activeStage, theme, fontScale, or timer changes
  useEffect(() => {
    broadcastSyncData();
  }, [broadcastSyncData]);

  // Open separate Pupil Whiteboard window
  const handleOpenPupilWindow = () => {
    broadcastSyncData();
    const currentUrl = window.location.href.split('#')[0];
    const pupilUrl = `${currentUrl}#/whiteboard-pupil`;
    const pupilWin = window.open(
      pupilUrl,
      'JRUSS_Whiteboard_Pupil',
      'width=1280,height=800,menubar=no,toolbar=no,location=no,status=no'
    );
    if (pupilWin) {
      setPupilWindowConnected(true);
    }
  };

  // Current stage object
  const currentStageObj = stages[activeStage] || stages[0];
  const nextStageObj = stages[activeStage + 1] || null;

  // Split stage content into:
  // 1. Pupil Content (Student Tasks, Questions, Prompts)
  // 2. Teacher Guidance & Answers (Hidden on pupil display)
  const { pupilContent, teacherGuidance } = useMemo(() => {
    const raw = currentStageObj?.content || '';
    return splitStageContent(raw);
  }, [currentStageObj]);

  const renderedPupilHtml = useMemo(() => marked.parse(pupilContent), [pupilContent]);
  const renderedTeacherNotesHtml = useMemo(() => (teacherGuidance ? marked.parse(teacherGuidance) : ''), [teacherGuidance]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        setActiveStage(prev => Math.min(stages.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setActiveStage(prev => Math.max(0, prev - 1));
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, stages.length, onClose]);

  // Countdown timer interval
  useEffect(() => {
    let interval = null;
    if (timerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(sec => {
          if (sec <= 1) {
            setTimerRunning(false);
            if (soundEnabled) playClassroomChime();
            return 0;
          }
          return sec - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning, timerSeconds, soundEnabled]);

  // Draggable timer logic
  const handleTimerPointerDown = (e) => {
    if (isTimerPinned) return;
    setIsDraggingTimer(true);
    timerDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: timerPos.x,
      initialY: timerPos.y
    };
  };

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!isDraggingTimer) return;
      const dx = e.clientX - timerDragRef.current.startX;
      const dy = e.clientY - timerDragRef.current.startY;
      setTimerPos({
        x: Math.max(10, Math.min(window.innerWidth - 300, timerDragRef.current.initialX + dx)),
        y: Math.max(10, Math.min(window.innerHeight - 180, timerDragRef.current.initialY + dy))
      });
    };

    const handlePointerUp = () => {
      setIsDraggingTimer(false);
    };

    if (isDraggingTimer) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDraggingTimer]);

  // Canvas Drawing logic for Presenter Annotation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      if (drawingHistory[activeStage]) {
        const img = new Image();
        img.src = drawingHistory[activeStage];
        img.onload = () => ctx.drawImage(img, 0, 0);
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [activeStage, drawingHistory]);

  const startDrawing = (e) => {
    if (!isPenActive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    isDrawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);

    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 24;
    } else if (isHighlighter) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = penColor + '66';
      ctx.lineWidth = 20;
      ctx.lineCap = 'square';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  };

  const draw = (e) => {
    if (!isDrawingRef.current || !isPenActive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      setDrawingHistory(prev => ({
        ...prev,
        [activeStage]: canvas.toDataURL()
      }));
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDrawingHistory(prev => {
      const copy = { ...prev };
      delete copy[activeStage];
      return copy;
    });
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const formatTimer = (sec) => {
    const mins = Math.floor(sec / 60);
    const remaining = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  const isLight = theme === 'light';
  const fontClasses = {
    normal: 'text-base sm:text-lg',
    large: 'text-lg sm:text-xl md:text-2xl',
    xlarge: 'text-xl sm:text-2xl md:text-3xl',
    huge: 'text-2xl sm:text-3xl md:text-4xl'
  }[fontScale] || 'text-lg sm:text-xl md:text-2xl';

  return (
    <div
      style={{
        backgroundColor: isLight ? '#f1f5f9' : '#0b0f19',
        color: isLight ? '#0f172a' : '#f8fafc'
      }}
      className={`fixed inset-0 z-50 flex flex-col select-none transition-colors duration-200 ${
        isLight ? 'whiteboard-container-light' : 'whiteboard-container-dark'
      }`}
    >
      {/* Top Presenter Control Header */}
      <header
        style={{
          backgroundColor: isLight ? '#ffffff' : '#0f172a',
          borderColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)'
        }}
        className={`px-4 py-2.5 sm:px-6 sm:py-3 border-b flex items-center justify-between gap-3 shrink-0 relative z-50 transition-colors ${
          isLight ? 'whiteboard-header-light' : 'whiteboard-header-dark'
        }`}
      >
        {/* Left: Lesson Title & Presenter Mode Badge */}
        <div className="flex items-center gap-3 overflow-hidden">
          <div
            className={`p-2 rounded-xl border shrink-0 ${
              educationStage === 'primary'
                ? 'bg-amber-500/20 border-amber-400/40 text-amber-400'
                : 'bg-indigo-500/20 border-indigo-400/40 text-indigo-400'
            }`}
          >
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="truncate">
            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-sm font-bold truncate m-0">
                {topic || 'Classroom Lesson'}
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                Presenter Console
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] opacity-60 truncate m-0 font-medium">
              Stage {activeStage + 1} of {stages.length}: {currentStageObj?.title}
            </p>
          </div>
        </div>

        {/* Center: Stage Scrubber Buttons */}
        <div className="hidden lg:flex items-center gap-1.5 overflow-x-auto max-w-xl py-1 px-2 rounded-xl bg-black/10 dark:bg-white/5 border border-black/5 dark:border-white/5">
          {stages.map((stg, idx) => {
            const isActive = idx === activeStage;
            return (
              <button
                key={stg.id}
                type="button"
                onClick={() => setActiveStage(idx)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md font-bold'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {idx + 1}. {stg.title.split(/[:\-(]/)[0].trim().slice(0, 15)}
              </button>
            );
          })}
        </div>

        {/* Right: Controls & Secondary Window Launcher */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Open Pupil Projector Window Button */}
          <button
            type="button"
            onClick={handleOpenPupilWindow}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition ${
              pupilWindowConnected
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white'
            }`}
            title="Open dedicated clean whiteboard window to display on classroom projector"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {pupilWindowConnected ? '● Projector Open' : 'Open Pupil Window'}
            </span>
            <span className="sm:hidden">Projector</span>
          </button>

          {/* View Mode Toggle: Presenter Mode vs Pupil Mode Preview */}
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'presenter' ? 'pupil' : 'presenter')}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition ${
              viewMode === 'presenter'
                ? 'bg-indigo-600/30 border-indigo-400 text-indigo-200'
                : 'bg-emerald-600/30 border-emerald-400 text-emerald-200'
            }`}
            title={viewMode === 'presenter' ? 'Viewing Teacher Console (Answers Visible)' : 'Previewing Pupil View (Answers Hidden)'}
          >
            {viewMode === 'presenter' ? <Eye className="w-3.5 h-3.5 text-indigo-400" /> : <EyeOff className="w-3.5 h-3.5 text-emerald-400" />}
            <span className="text-[11px] hidden md:inline">
              {viewMode === 'presenter' ? 'Answers Shown' : 'Pupil View'}
            </span>
          </button>

          {/* Pen Tool Toggle & Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsPenActive(!isPenActive);
                setShowPenMenu(true);
              }}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                isPenActive
                  ? 'bg-amber-500 text-black border-amber-300 font-bold shadow-md'
                  : isLight
                  ? 'bg-slate-200 border-slate-300 text-slate-800'
                  : 'bg-slate-900 border-white/15 text-slate-200'
              }`}
              title="Board Drawing Pen Tool"
            >
              <PenTool className="w-4 h-4" />
              <span className="hidden sm:inline">{isPenActive ? 'Pen On' : 'Pen'}</span>
            </button>

            {isPenActive && showPenMenu && (
              <div
                ref={penMenuRef}
                style={{
                  backgroundColor: isLight ? '#ffffff' : '#0f172a',
                  borderColor: isLight ? '#cbd5e1' : '#f59e0b',
                  color: isLight ? '#0f172a' : '#ffffff'
                }}
                className={`absolute right-0 top-full mt-2 z-[100] p-3.5 rounded-2xl border shadow-2xl flex flex-col gap-2.5 w-60 select-none ${
                  isLight ? 'whiteboard-menu-light' : 'whiteboard-menu-dark'
                }`}
              >
                <div>
                  <label className="text-[10px] font-bold uppercase opacity-60 block mb-1">Color</label>
                  <div className="flex items-center gap-2">
                    {['#fbbf24', '#ef4444', '#38bdf8', '#10b981', '#ffffff', '#000000'].map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => {
                          setPenColor(color);
                          setIsEraser(false);
                        }}
                        style={{ backgroundColor: color }}
                        className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                          penColor === color && !isEraser ? 'border-amber-400 scale-110' : 'border-black/30 dark:border-white/30'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEraser(false);
                      setIsHighlighter(false);
                      setPenSize(3);
                    }}
                    className={`flex-1 py-1 rounded-lg text-xs font-semibold border ${
                      !isEraser && !isHighlighter && penSize === 3 ? 'bg-amber-500 text-black font-bold' : 'border-white/10'
                    }`}
                  >
                    Fine
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEraser(false);
                      setIsHighlighter(false);
                      setPenSize(7);
                    }}
                    className={`flex-1 py-1 rounded-lg text-xs font-semibold border ${
                      !isEraser && !isHighlighter && penSize === 7 ? 'bg-amber-500 text-black font-bold' : 'border-white/10'
                    }`}
                  >
                    Marker
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEraser(false);
                      setIsHighlighter(true);
                    }}
                    className={`flex-1 py-1 rounded-lg text-xs font-semibold border ${
                      isHighlighter ? 'bg-amber-500 text-black font-bold' : 'border-white/10'
                    }`}
                  >
                    Highlight
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEraser(true);
                      setIsHighlighter(false);
                    }}
                    className={`p-1.5 rounded-lg border ${
                      isEraser ? 'bg-rose-600 text-white font-bold' : 'border-white/10'
                    }`}
                    title="Eraser"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="pt-1 border-t border-black/10 dark:border-white/10 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPenMenu(false)}
                    className="text-xs opacity-60 hover:opacity-100"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Timer Toggle */}
          <button
            type="button"
            onClick={() => setShowTimer(!showTimer)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
              showTimer || timerRunning
                ? 'bg-violet-600 text-white border-violet-400 shadow-md'
                : isLight
                ? 'bg-slate-200 border-slate-300 text-slate-800'
                : 'bg-slate-900 border-white/15 text-slate-200'
            }`}
            title="Classroom Task Countdown Timer"
          >
            <Timer className="w-3.5 h-3.5 text-violet-300" />
            <span className="font-mono text-[11px]">
              {timerRunning ? formatTimer(timerSeconds) : 'Timer'}
            </span>
          </button>

          {/* Theme Switcher */}
          <button
            type="button"
            onClick={() => setTheme(isLight ? 'dark' : 'light')}
            className={`p-1.5 sm:p-2 rounded-xl border text-xs transition ${
              isLight ? 'bg-slate-200 border-slate-300 text-slate-800' : 'bg-slate-900 border-white/15 text-slate-200'
            }`}
          >
            {isLight ? <Moon className="w-4 h-4 text-indigo-600" /> : <Sun className="w-4 h-4 text-amber-400" />}
          </button>

          {/* Font Scale Zoom Controls */}
          <div className="hidden sm:flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => {
                const scales = ['normal', 'large', 'xlarge', 'huge'];
                const idx = scales.indexOf(fontScale);
                if (idx > 0) setFontScale(scales[idx - 1]);
              }}
              className={`p-1.5 rounded-xl border text-xs transition ${
                isLight ? 'bg-slate-200 border-slate-300 text-slate-800' : 'bg-slate-900 border-white/15 text-slate-200'
              }`}
              title="Decrease Font Size"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                const scales = ['normal', 'large', 'xlarge', 'huge'];
                const idx = scales.indexOf(fontScale);
                if (idx < scales.length - 1) setFontScale(scales[idx + 1]);
              }}
              className={`p-1.5 rounded-xl border text-xs transition ${
                isLight ? 'bg-slate-200 border-slate-300 text-slate-800' : 'bg-slate-900 border-white/15 text-slate-200'
              }`}
              title="Increase Font Size"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className={`p-1.5 sm:p-2 rounded-xl border text-xs transition ${
              isLight ? 'bg-slate-200 border-slate-300 text-slate-800' : 'bg-slate-900 border-white/15 text-slate-200'
            }`}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close Presenter Console */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl bg-rose-600/85 hover:bg-rose-500 text-white font-bold transition ml-1"
            title="Exit Whiteboard Mode (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Presenter Layout: Stage Content + Teacher Notes & Answer Key */}
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 flex justify-center items-start relative">
        {/* Drawing Canvas Overlay */}
        <canvas
          ref={canvasRef}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          className={`absolute inset-0 z-20 w-full h-full ${
            isPenActive ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'
          }`}
        />

        <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-6 relative z-10">
          {/* Left/Center Column: Active Stage Content */}
          <div className="flex-1 flex flex-col gap-6">
            {/* Stage Title Banner */}
            <div
              style={{
                backgroundColor: isLight ? '#ffffff' : '#131b2e',
                borderColor: isLight ? '#cbd5e1' : '#334155'
              }}
              className={`p-5 sm:p-7 rounded-3xl border shadow-xl flex flex-col gap-2 transition-colors ${
                isLight ? 'whiteboard-card-light' : 'whiteboard-card-dark'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase tracking-wider px-3.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  ● Stage {activeStage + 1} of {stages.length}
                </span>
                <span className="text-xs opacity-50 font-mono">
                  [←] Prev • [→ / Space] Next
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight m-0">
                {currentStageObj?.title}
              </h2>
            </div>

            {/* Stage Body Content */}
            <div
              style={{
                backgroundColor: isLight ? '#ffffff' : '#131b2e',
                borderColor: isLight ? '#cbd5e1' : '#334155'
              }}
              className={`p-6 sm:p-8 rounded-3xl border shadow-xl transition-colors ${
                isLight ? 'whiteboard-card-light' : 'whiteboard-card-dark'
              }`}
            >
              <div
                className={`whiteboard-markdown-body ${fontClasses} ${
                  isLight ? 'whiteboard-light' : 'whiteboard-dark'
                }`}
                dangerouslySetInnerHTML={{ __html: renderedPupilHtml }}
              />
            </div>

            {/* Teacher Guidance & Model Answer Key (Only visible in Presenter View) */}
            {viewMode === 'presenter' && teacherGuidance && (
              <div
                style={{
                  backgroundColor: isLight ? '#f0fdf4' : '#062c22',
                  borderColor: isLight ? '#10b981' : '#059669',
                  color: isLight ? '#064e3b' : '#d1fae5'
                }}
                className={`p-6 rounded-3xl border-2 shadow-xl flex flex-col gap-3 transition-colors ${
                  isLight ? 'whiteboard-teacher-notes-light' : 'whiteboard-teacher-notes-dark'
                }`}
              >
                <div className="flex items-center justify-between border-b border-emerald-500/40 pb-2.5">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>💡 Teacher Answer Key &amp; Model Solutions</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold">
                    Presenter Screen Only (Hidden from Pupils)
                  </span>
                </div>
                <div
                  className={`whiteboard-markdown-body text-sm sm:text-base leading-relaxed ${
                    isLight ? 'text-emerald-950' : 'text-emerald-100'
                  }`}
                  dangerouslySetInnerHTML={{ __html: renderedTeacherNotesHtml }}
                />
              </div>
            )}
          </div>

          {/* Right Column: Presenter Sidebar (Next Stage Preview & Jump List) */}
          <div className="w-full lg:w-72 flex flex-col gap-4 shrink-0">
            {/* Next Stage Preview Box */}
            <div
              style={{
                backgroundColor: isLight ? '#ffffff' : '#131b2e',
                borderColor: isLight ? '#cbd5e1' : '#334155'
              }}
              className={`p-4 rounded-2xl border shadow-lg flex flex-col gap-2 ${
                isLight ? 'whiteboard-card-light' : 'whiteboard-card-dark'
              }`}
            >
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-60">
                Next Stage Sneak Peek
              </span>
              {nextStageObj ? (
                <>
                  <h4 className="text-sm font-bold m-0 text-indigo-400 truncate">
                    {nextStageObj.title}
                  </h4>
                  <p className="text-xs opacity-70 line-clamp-3 m-0 leading-relaxed font-sans">
                    {nextStageObj.content.replace(/^#{1,3}\s+.*$/gm, '').trim().slice(0, 140)}...
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveStage(prev => Math.min(stages.length - 1, prev + 1))}
                    className="mt-1 py-1.5 px-3 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-400/30 rounded-xl text-xs font-semibold text-indigo-200 transition"
                  >
                    Advance to Next Stage ➔
                  </button>
                </>
              ) : (
                <p className="text-xs opacity-50 m-0 italic">This is the final stage of the lesson.</p>
              )}
            </div>

            {/* Quick Stage Jump Navigator */}
            <div
              style={{
                backgroundColor: isLight ? '#ffffff' : '#131b2e',
                borderColor: isLight ? '#cbd5e1' : '#334155'
              }}
              className={`p-4 rounded-2xl border shadow-lg flex flex-col gap-2 ${
                isLight ? 'whiteboard-card-light' : 'whiteboard-card-dark'
              }`}
            >
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-60">
                Lesson Stages ({stages.length})
              </span>
              <div className="flex flex-col gap-1 max-h-64 overflow-y-auto pr-1">
                {stages.map((stg, idx) => (
                  <button
                    key={stg.id}
                    type="button"
                    onClick={() => setActiveStage(idx)}
                    className={`text-left p-2 rounded-xl text-xs transition flex items-center justify-between ${
                      idx === activeStage
                        ? 'bg-indigo-600 text-white font-bold shadow-sm'
                        : isLight
                        ? 'hover:bg-slate-200 text-slate-700'
                        : 'hover:bg-white/10 text-slate-300'
                    }`}
                  >
                    <span className="truncate">{idx + 1}. {stg.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Draggable & Pinnable Countdown Task Timer */}
      {showTimer && (
        <div
          style={{
            position: 'fixed',
            left: `${timerPos.x}px`,
            top: `${timerPos.y}px`,
            zIndex: 40,
            backgroundColor: isLight ? '#ffffff' : '#131b2e',
            borderColor: isLight ? '#cbd5e1' : '#8b5cf6',
            color: isLight ? '#0f172a' : '#ffffff'
          }}
          className={`p-4 rounded-2xl border shadow-2xl flex flex-col gap-2.5 w-72 select-none transition-shadow ${
            isLight ? 'whiteboard-timer-light' : 'whiteboard-timer-dark'
          }`}
        >
          {/* Draggable Header with Pin Button */}
          <div
            onPointerDown={handleTimerPointerDown}
            className={`flex items-center justify-between pb-2 border-b border-black/10 dark:border-white/10 select-none ${
              isTimerPinned ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-xs">
              <Timer className="w-4 h-4 text-violet-400" />
              <span>Task Timer {isTimerPinned ? '(Pinned)' : '(Drag to move)'}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsTimerPinned(!isTimerPinned)}
                className={`p-1 rounded-lg text-xs transition ${
                  isTimerPinned ? 'bg-violet-600 text-white font-bold' : 'hover:bg-white/10 opacity-70'
                }`}
                title={isTimerPinned ? 'Timer is pinned (Click to unpin and drag)' : 'Pin timer in place'}
              >
                📌
              </button>
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-1 rounded-lg hover:bg-white/10 text-xs"
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-violet-400" /> : <VolumeX className="w-3.5 h-3.5 opacity-40" />}
              </button>
              <button
                type="button"
                onClick={() => setShowTimer(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Clock Display */}
          <div className="text-center py-1">
            <span
              className={`font-mono text-5xl font-black tracking-wider ${
                timerSeconds <= 30 && timerSeconds > 0
                  ? 'text-rose-500 animate-ping'
                  : timerSeconds === 0
                  ? 'text-rose-500 font-extrabold'
                  : 'text-violet-400'
              }`}
            >
              {formatTimer(timerSeconds)}
            </span>
            {timerSeconds === 0 && (
              <p className="text-xs text-rose-400 font-bold m-0 mt-1">Time's Up! ✍️</p>
            )}
          </div>

          {/* Presets */}
          <div className="grid grid-cols-4 gap-1.5 text-xs font-mono font-bold">
            {[1, 2, 5, 10].map(mins => (
              <button
                key={mins}
                type="button"
                onClick={() => {
                  setTimerRunning(false);
                  setTimerSeconds(mins * 60);
                  setTimerInitial(mins * 60);
                }}
                className="py-1 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-violet-600 hover:text-white transition border border-black/5 dark:border-white/5"
              >
                +{mins}m
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setTimerRunning(!timerRunning)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 text-white transition ${
                timerRunning ? 'bg-amber-600 hover:bg-amber-500' : 'bg-violet-600 hover:bg-violet-500 shadow-md'
              }`}
            >
              {timerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{timerRunning ? 'Pause' : 'Start'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTimerRunning(false);
                setTimerSeconds(timerInitial);
              }}
              className="p-2 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-white/20 transition"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bottom Sticky Stage Navigation Bar */}
      <footer
        className={`px-4 py-3 sm:px-8 sm:py-4 border-t flex items-center justify-between shrink-0 backdrop-blur-md transition-colors ${
          isLight ? 'bg-white/95 border-slate-200' : 'bg-slate-950/90 border-white/10'
        }`}
      >
        <button
          type="button"
          onClick={() => setActiveStage(prev => Math.max(0, prev - 1))}
          disabled={activeStage === 0}
          className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl border text-xs sm:text-sm font-bold flex items-center gap-2 transition disabled:opacity-30 disabled:pointer-events-none hover-scale"
          style={{
            backgroundColor: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)',
            borderColor: isLight ? '#cbd5e1' : 'rgba(255,255,255,0.15)'
          }}
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous Stage</span>
        </button>

        <div className="flex items-center gap-2">
          {stages.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveStage(idx)}
              className={`transition-all rounded-full ${
                idx === activeStage ? 'w-6 h-2 bg-indigo-500' : 'w-2 h-2 bg-slate-400/40 hover:bg-slate-400/80'
              }`}
              title={`Stage ${idx + 1}`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setActiveStage(prev => Math.min(stages.length - 1, prev + 1))}
          disabled={activeStage >= stages.length - 1}
          className="px-4 py-2 sm:px-6 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 text-white bg-indigo-600 hover:bg-indigo-500 transition shadow-lg disabled:opacity-30 disabled:pointer-events-none hover-scale"
        >
          <span>Next Stage</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </footer>
    </div>
  );
}
