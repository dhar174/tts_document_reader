import React, { useEffect, useRef } from 'react';
import { Chunk } from '../types';

interface ReaderProps {
  chunks: Chunk[];
  currentIndex: number;
  fileName: string;
  onChunkClick: (index: number) => void;
}

export const Reader: React.FC<ReaderProps> = ({ chunks, currentIndex, fileName, onChunkClick }) => {
  const activeChunkRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto scroll to active chunk
    if (activeChunkRef.current && containerRef.current) {
      activeChunkRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentIndex]);

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-xl border border-slate-800 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800/80 backdrop-blur-md border-b border-slate-700 px-6 py-4 flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-500/20 rounded-lg">
                <svg className="w-5 h-5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            </div>
            <div>
                <h2 className="text-sm font-bold text-slate-100">{fileName}</h2>
                <p className="text-xs text-slate-400">{chunks.length} segments • {Math.ceil(chunks.length * 500 / 1000)} min read approx.</p>
            </div>
        </div>
      </div>

      {/* Content */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto p-6 md:p-12 reader-scroll relative"
      >
        <div className="max-w-3xl mx-auto space-y-6 pb-24">
          {chunks.map((chunk, index) => {
            const isActive = index === currentIndex;
            const isPast = index < currentIndex;
            
            return (
              <div
                key={chunk.id}
                ref={isActive ? activeChunkRef : null}
                onClick={() => onChunkClick(index)}
                className={`
                  transition-all duration-500 cursor-pointer rounded-lg p-4 -mx-4
                  ${isActive 
                    ? 'bg-slate-800/50 border-l-4 border-brand-500 shadow-lg scale-[1.02]' 
                    : 'border-l-4 border-transparent hover:bg-slate-800/30'}
                `}
              >
                <p 
                  className={`
                    font-serif text-lg leading-relaxed
                    ${isActive ? 'text-slate-100' : isPast ? 'text-slate-500' : 'text-slate-300'}
                  `}
                >
                  {chunk.text}
                </p>
                {isActive && (
                    <div className="mt-2 flex items-center gap-2">
                         <span className="text-[10px] uppercase tracking-wider font-bold text-brand-400 bg-brand-900/40 px-2 py-0.5 rounded-full">
                            Reading Now
                         </span>
                    </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
