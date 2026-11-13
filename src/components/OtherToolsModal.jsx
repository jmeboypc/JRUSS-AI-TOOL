import React, { useState, useEffect } from 'react';
import {
  Wrench, ArrowLeft, ArrowRight, Shuffle, Calculator, ClipboardList, Users
} from 'lucide-react';

export default function OtherToolsModal({ isOpen, onClose }) {
  // Navigation inside the tools modal: 'hub' | 'student_picker'
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
                  {activeTool === 'student_picker' && 'Random Student Name Picker'}
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                {activeTool === 'hub' && 'Specialised teacher utilities and classroom tools.'}
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
          className="p-4 sm:p-6 space-y-6"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
          }}
        >

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
                {/* TOOL CARD 1: Student Name Randomizer */}
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
                        Classroom Tool • Ready
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-white group-hover:text-violet-300 transition">
                      Student Name Randomizer & Picker
                    </h4>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      Fair, low-stakes student selector for classroom cold calling, questioning routines, and group assignments. Quick paste from your markbook or Arbor register.
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs font-semibold text-violet-400 flex items-center gap-1 group-hover:translate-x-1 transition">
                      Open Randomizer <ArrowRight className="w-4 h-4" />
                    </span>
                    <span className="text-[11px] text-slate-500">Live whiteboard friendly</span>
                  </div>
                </div>

                {/* TOOL CARD 2: Random Group & Seating Generator (Coming Soon) */}
                <div className="p-5 rounded-2xl bg-slate-900/40 border border-white/5 opacity-70 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-3 rounded-xl bg-slate-800 text-slate-400">
                        <Users className="w-6 h-6" />
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-slate-500 border border-white/5 uppercase tracking-wider">
                        Coming Soon
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-300">
                      Random Group & Pair Generator
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Split a class roster into balanced pairs or table groups with optional "keep apart" rules.
                    </p>
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

                {/* TOOL CARD 4: Grade Boundary Calculator (Coming Soon) */}
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
              VIEW 2: RANDOM STUDENT NAME PICKER
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
