
import React, { useState } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top' }) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div 
      className="relative flex items-center group inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className={`absolute z-50 px-3 py-2 text-xs font-medium text-white bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl backdrop-blur-md w-48 text-center pointer-events-none animate-in fade-in zoom-in duration-150 ${positionClasses[position]}`}>
          {content}
          <div className={`absolute w-2 h-2 bg-zinc-900 border-zinc-800 rotate-45 ${
            position === 'top' ? 'bottom-[-5px] left-1/2 -translate-x-1/2 border-b border-r' :
            position === 'bottom' ? 'top-[-5px] left-1/2 -translate-x-1/2 border-t border-l' :
            position === 'left' ? 'right-[-5px] top-1/2 -translate-y-1/2 border-t border-r' :
            'left-[-5px] top-1/2 -translate-y-1/2 border-b border-l'
          }`} />
        </div>
      )}
    </div>
  );
};

export default Tooltip;
