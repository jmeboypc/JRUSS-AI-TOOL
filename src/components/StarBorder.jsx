import React from 'react';

export default function StarBorder({ 
  children, 
  className = "", 
  color = "#8b5cf6", 
  speed = "6s", 
  ...props 
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-[1px] ${className}`} {...props}>
      {/* Moving shooting star border gradient */}
      <div 
        className="absolute inset-[-150%] animate-[spin_6s_linear_infinite] z-0 pointer-events-none"
        style={{
          background: `conic-gradient(from 0deg, transparent 0%, transparent 40%, ${color} 50%, #06b6d4 60%, transparent 70%, transparent 100%)`,
          animationDuration: speed
        }}
      />
      {/* Content wrapper with matching borders */}
      <div className="relative z-10 w-full h-full rounded-[15px] bg-[#0b0f19]/90 backdrop-blur-md">
        {children}
      </div>
    </div>
  );
}
