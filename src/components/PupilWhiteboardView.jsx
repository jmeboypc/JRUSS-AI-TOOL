import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Maximize2, Minimize2, Sun, Moon, ZoomIn, ZoomOut,
  PenTool, Eraser, Trash2, Timer, Volume2, VolumeX, Sparkles
} from 'lucide-react';
import { marked } from 'marked';
import { parseWhiteboardStages, splitStageContent } from '../utils/whiteboardParser';

// Built-in Web Audio API chime
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

export default function PupilWhiteboardView() {
  // Sync state loaded from BroadcastChannel or localStorage
  const [boardData, setBoardData] = useState(() => {
    try {
      const saved = localStorage.getItem('jruss_whiteboard_data');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeStage, setActiveStage] = useState(() => boardData?.activeStage || 0);
  const [theme, setTheme] = useState(() => boardData?.theme || 'dark');
  const [fontScale, setFontScale] = useState(() => boardData?.fontScale || 'large');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Timer state (synced with presenter)
  const [timerVisible, setTimerVisible] = useState(() => boardData?.timerVisible || false);
  const [timerSeconds, setTimerSeconds] = useState(() => boardData?.timerSeconds || 300);
  const [timerRunning, setTimerRunning] = useState(() => boardData?.timerRunning || false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Timer drag & pin
  const [timerPos, setTimerPos] = useState({ x: 40, y: 100 });
  const [isTimerPinned, setIsTimerPinned] = useState(false);
  const [isDraggingTimer, setIsDraggingTimer] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, initialX: 0, initialY: 0 });

  // Interactive Pen Tool for Whiteboard
  const [isPenActive, setIsPenActive] = useState(false);
  const [penColor, setPenColor] = useState('#fbbf24'); // Amber default
  const [penSize, setPenSize] = useState(4);
  const [isHighlighter, setIsHighlighter] = useState(false);
  const [isEraser, setIsEraser] = useState(false);
  const [showPenMenu, setShowPenMenu] = useState(false);
  const penMenuRef = useRef(null);

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

  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const [drawingHistory, setDrawingHistory] = useState({}); // stageIndex -> canvasDataUrl

  // BroadcastChannel listener for real-time synchronization with Presenter window
  useEffect(() => {
    let channel = null;
    try {
      channel = new BroadcastChannel('jruss_whiteboard_sync');
      channel.onmessage = (event) => {
        const msg = event.data;
        if (!msg || !msg.type) return;

        switch (msg.type) {
          case 'UPDATE_DATA':
            setBoardData(msg.data);
            if (typeof msg.data.activeStage === 'number') setActiveStage(msg.data.activeStage);
            if (msg.data.theme) setTheme(msg.data.theme);
            if (msg.data.fontScale) setFontScale(msg.data.fontScale);
            break;
          case 'SET_STAGE':
            setActiveStage(msg.stageIndex);
            break;
          case 'SET_THEME':
            setTheme(msg.theme);
            break;
          case 'SET_FONT_SCALE':
            setFontScale(msg.fontScale);
            break;
          case 'UPDATE_TIMER':
            if (typeof msg.seconds === 'number') setTimerSeconds(msg.seconds);
            if (typeof msg.running === 'boolean') setTimerRunning(msg.running);
            if (typeof msg.visible === 'boolean') setTimerVisible(msg.visible);
            break;
          default:
            break;
        }
      };
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }

    // Storage fallback listener
    const handleStorage = (e) => {
      if (e.key === 'jruss_whiteboard_data' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setBoardData(parsed);
          if (typeof parsed.activeStage === 'number') setActiveStage(parsed.activeStage);
          if (parsed.theme) setTheme(parsed.theme);
          if (parsed.fontScale) setFontScale(parsed.fontScale);
          if (typeof parsed.timerSeconds === 'number') setTimerSeconds(parsed.timerSeconds);
          if (typeof parsed.timerRunning === 'boolean') setTimerRunning(parsed.timerRunning);
          if (typeof parsed.timerVisible === 'boolean') setTimerVisible(parsed.timerVisible);
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (channel) channel.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Timer countdown
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

  // Stage Parser
  const stages = useMemo(() => {
    const rawContent = boardData?.content || '';
    return parseWhiteboardStages(rawContent, boardData?.topic || 'Classroom Whiteboard');
  }, [boardData]);

  const currentStageObj = stages[activeStage] || stages[0];

  // Pupil Content: Strictly strip all model solutions, answers, teacher guidance, and mark schemes
  const cleanPupilContent = useMemo(() => {
    const raw = currentStageObj?.content || '';
    return splitStageContent(raw).pupilContent;
  }, [currentStageObj]);

  const renderedHtml = useMemo(() => marked.parse(cleanPupilContent), [cleanPupilContent]);

  // Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Canvas Drawing logic for Interactive Whiteboard
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      // Restore drawings for this stage if exists
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
      ctx.strokeStyle = penColor + '66'; // ~40% alpha
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

  // Draggable Timer Pointer Events
  const handleTimerPointerDown = (e) => {
    if (isTimerPinned) return;
    setIsDraggingTimer(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialX: timerPos.x,
      initialY: timerPos.y
    };
  };

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!isDraggingTimer) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setTimerPos({
        x: Math.max(10, Math.min(window.innerWidth - 300, dragStartRef.current.initialX + dx)),
        y: Math.max(10, Math.min(window.innerHeight - 180, dragStartRef.current.initialY + dy))
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

  const formatTimer = (sec) => {
    const mins = Math.floor(sec / 60);
    const remaining = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  const isLight = theme === 'light';
  const fontClasses = {
    normal: 'text-lg sm:text-xl',
    large: 'text-xl sm:text-2xl md:text-3xl',
    xlarge: 'text-2xl sm:text-3xl md:text-4xl',
    huge: 'text-3xl sm:text-4xl md:text-5xl'
  }[fontScale] || 'text-xl sm:text-2xl md:text-3xl';

  return (
    <div
      style={{
        backgroundColor: isLight ? '#f1f5f9' : '#0b0f19',
        color: isLight ? '#0f172a' : '#f8fafc'
      }}
      className={`fixed inset-0 z-50 flex flex-col select-none transition-colors duration-200 overflow-hidden ${
        isLight ? 'whiteboard-container-light' : 'whiteboard-container-dark'
      }`}
    >
      {/* Top Projector Header */}
      <header
        style={{
          backgroundColor: isLight ? '#ffffff' : '#0f172a',
          borderColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)'
        }}
        className={`px-6 py-3 border-b flex items-center justify-between gap-3 shrink-0 relative z-50 transition-colors ${
          isLight ? 'whiteboard-header-light' : 'whiteboard-header-dark'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-400 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight m-0">
              {boardData?.topic || 'Interactive Classroom Whiteboard'}
            </h1>
            <p className="text-xs opacity-60 font-medium m-0">
              Stage {activeStage + 1} of {stages.length}: {currentStageObj?.title}
            </p>
          </div>
        </div>

        {/* Classroom Interactive Toolbar */}
        <div className="flex items-center gap-2">
          {/* Pen / Annotation Tool Toggle & Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsPenActive(!isPenActive);
                setShowPenMenu(true);
              }}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                isPenActive
                  ? 'bg-amber-500 text-black border-amber-300 shadow-md font-bold'
                  : isLight
                  ? 'bg-slate-200/80 hover:bg-slate-300 border-slate-300 text-slate-800'
                  : 'bg-slate-900 hover:bg-slate-800 border-white/15 text-slate-200'
              }`}
              title="Board Drawing & Annotation Pen Tool"
            >
              <PenTool className="w-4 h-4" />
              <span>{isPenActive ? 'Pen On' : 'Draw'}</span>
            </button>

            {/* Pen Options Dropdown Menu */}
            {isPenActive && showPenMenu && (
              <div
                ref={penMenuRef}
                style={{
                  backgroundColor: isLight ? '#ffffff' : '#0f172a',
                  borderColor: isLight ? '#cbd5e1' : '#f59e0b',
                  color: isLight ? '#0f172a' : '#ffffff'
                }}
                className={`absolute right-0 top-full mt-2 z-[100] p-3 rounded-2xl border shadow-2xl flex flex-col gap-2.5 w-60 select-none ${
                  isLight ? 'whiteboard-menu-light' : 'whiteboard-menu-dark'
                }`}
              >
                {/* Pen Colors */}
                <div>
                  <label className="text-[10px] font-bold uppercase opacity-60 block mb-1">Color Palette</label>
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
                          penColor === color && !isEraser ? 'border-amber-400 scale-110 shadow-md' : 'border-black/30 dark:border-white/30'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Pen Type & Size */}
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEraser(false);
                      setIsHighlighter(false);
                      setPenSize(3);
                    }}
                    className={`flex-1 py-1 rounded-lg text-xs font-semibold border ${
                      !isEraser && !isHighlighter ? 'bg-amber-500 text-black border-amber-400 font-bold' : 'border-white/10 hover:bg-white/5'
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
                      !isEraser && !isHighlighter && penSize === 7 ? 'bg-amber-500 text-black border-amber-400 font-bold' : 'border-white/10 hover:bg-white/5'
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
                      isHighlighter ? 'bg-amber-500 text-black border-amber-400 font-bold' : 'border-white/10 hover:bg-white/5'
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
                      isEraser ? 'bg-rose-600 text-white border-rose-400 font-bold' : 'border-white/10 hover:bg-white/5'
                    }`}
                    title="Eraser"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Clear Board Button */}
                <div className="pt-1 border-t border-black/10 dark:border-white/10 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Annotations</span>
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

          {/* Text Size Controls */}
          <div className="flex items-center bg-black/10 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl p-0.5">
            <button
              type="button"
              onClick={() => {
                const order = ['normal', 'large', 'xlarge', 'huge'];
                const idx = order.indexOf(fontScale);
                if (idx > 0) setFontScale(order[idx - 1]);
              }}
              className="p-1.5 rounded-lg hover:bg-white/10 text-xs"
              title="Decrease text size"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono px-1.5 uppercase font-semibold opacity-70">
              {fontScale.slice(0, 3)}
            </span>
            <button
              type="button"
              onClick={() => {
                const order = ['normal', 'large', 'xlarge', 'huge'];
                const idx = order.indexOf(fontScale);
                if (idx < order.length - 1) setFontScale(order[idx + 1]);
              }}
              className="p-1.5 rounded-lg hover:bg-white/10 text-xs"
              title="Increase text size"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Theme Switcher */}
          <button
            type="button"
            onClick={() => setTheme(isLight ? 'dark' : 'light')}
            className={`p-2 rounded-xl border text-xs transition ${
              isLight ? 'bg-slate-200 border-slate-300 text-slate-800' : 'bg-slate-900 border-white/15 text-slate-200'
            }`}
          >
            {isLight ? <Moon className="w-4 h-4 text-indigo-600" /> : <Sun className="w-4 h-4 text-amber-400" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className={`p-2 rounded-xl border text-xs transition ${
              isLight ? 'bg-slate-200 border-slate-300 text-slate-800' : 'bg-slate-900 border-white/15 text-slate-200'
            }`}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Canvas & Presentation Area */}
      <main className="flex-1 overflow-y-auto px-6 py-8 flex justify-center items-start relative">
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

        <div className="w-full max-w-5xl mx-auto flex flex-col gap-6 relative z-10">
          {/* Stage Hero Title Card */}
          <div
            style={{
              backgroundColor: isLight ? '#ffffff' : '#131b2e',
              borderColor: isLight ? '#cbd5e1' : '#334155'
            }}
            className={`p-6 sm:p-8 rounded-3xl border shadow-xl flex flex-col gap-3 transition-colors ${
              isLight ? 'whiteboard-card-light' : 'whiteboard-card-dark'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider px-3.5 py-1 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
                ● Stage {activeStage + 1} of {stages.length}
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight m-0">
              {currentStageObj?.title}
            </h2>
          </div>

          {/* Pupil-Clean Stage Content (Answers stripped) */}
          <div
            style={{
              backgroundColor: isLight ? '#ffffff' : '#131b2e',
              borderColor: isLight ? '#cbd5e1' : '#334155'
            }}
            className={`p-8 sm:p-12 rounded-3xl border shadow-2xl transition-colors ${
              isLight ? 'whiteboard-card-light' : 'whiteboard-card-dark'
            }`}
          >
            <div
              className={`whiteboard-markdown-body ${fontClasses} ${
                isLight ? 'whiteboard-light' : 'whiteboard-dark'
              }`}
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          </div>
        </div>
      </main>

      {/* Draggable & Pinnable Task Countdown Timer */}
      {timerVisible && (
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
            </div>
          </div>

          {/* Clock Display */}
          <div className="text-center py-1">
            <span
              className={`font-mono text-5xl font-black tracking-wider ${
                timerSeconds <= 30 && timerSeconds > 0
                  ? 'text-rose-500 animate-ping'
                  : timerSeconds === 0
                  ? 'text-rose-500'
                  : 'text-violet-400'
              }`}
            >
              {formatTimer(timerSeconds)}
            </span>
            {timerSeconds === 0 && (
              <p className="text-xs text-rose-400 font-bold m-0 mt-1">Time's Up! ✍️</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
