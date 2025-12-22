import React from 'react';
import { VoiceName } from '../types';
import { ALL_VOICES } from '../constants';

interface VoiceSelectorProps {
  selectedVoice: VoiceName;
  onVoiceChange: (voice: VoiceName) => void;
  disabled?: boolean;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({ selectedVoice, onVoiceChange, disabled }) => {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Voice Persona</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {ALL_VOICES.map((voice) => (
          <button
            key={voice.name}
            disabled={disabled}
            onClick={() => onVoiceChange(voice.name)}
            className={`
              flex flex-col items-start p-3 rounded-lg border text-left transition-all
              ${selectedVoice === voice.name 
                ? 'bg-brand-900/40 border-brand-500 ring-1 ring-brand-500' 
                : 'bg-slate-800 border-slate-700 hover:border-slate-600 hover:bg-slate-750'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <div className="flex items-center justify-between w-full">
              <span className={`font-medium ${selectedVoice === voice.name ? 'text-brand-300' : 'text-slate-200'}`}>
                {voice.name}
              </span>
              {selectedVoice === voice.name && (
                <span className="flex h-2 w-2 rounded-full bg-brand-400 animate-pulse"></span>
              )}
            </div>
            <span className="text-xs text-slate-400 mt-1">{voice.gender} • {voice.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
