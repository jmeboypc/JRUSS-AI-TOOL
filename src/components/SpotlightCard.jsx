import React, { useState, useRef } from 'react';

export default function SpotlightCard({ children, className = "", spotlightColor = "rgba(139, 92, 246, 0.15)", ...props }) {
  const cardRef = useRef(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isFocused, setIsFocused] = useState(false);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div
      ref={cardRef}
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md transition-all duration-300 ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsFocused(true)}
      onMouseLeave={() => setIsFocused(false)}
      style={{
        background: isFocused 
          ? `radial-gradient(800px circle at ${coords.x}px ${coords.y}px, ${spotlightColor}, transparent 40%), rgba(15, 23, 42, 0.6)`
          : 'rgba(15, 23, 42, 0.6)'
      }}
      {...props}
    >
      {/* Decorative border spotlight */}
      {isFocused && (
        <div 
          className="pointer-events-none absolute inset-0 rounded-2xl border border-violet-500/30 transition-opacity duration-300"
          style={{
            maskImage: `radial-gradient(150px circle at ${coords.x}px ${coords.y}px, black, transparent)`,
            WebkitMaskImage: `radial-gradient(150px circle at ${coords.x}px ${coords.y}px, black, transparent)`
          }}
        />
      )}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
