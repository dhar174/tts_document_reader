import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MAX_CHUNK_LENGTH } from './constants';
import { Chunk, DocumentState, PlayerState, VoiceName } from './types';
import { generateSpeechFromText, chunkText } from './services/geminiService';
import { decodeBase64, decodeAudioData, AudioContextManager } from './services/audioUtils';
import { Reader } from './components/Reader';
import { VoiceSelector } from './components/VoiceSelector';
import { Visualizer } from './components/Visualizer';
import { DriveBrowser } from './components/DriveBrowser';

export default function App() {
  // --- State ---
  const [docState, setDocState] = useState<DocumentState | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState>({
    isPlaying: false,
    playbackRate: 1.0,
    voice: VoiceName.Kore,
    volume: 1.0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // New state for Drive Integration
  const [showDrive, setShowDrive] = useState(false);

  // --- Refs ---
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const nextAudioBufferRef = useRef<AudioBuffer | null>(null);
  const isFetchingRef = useRef(false);

  // --- Initialization ---
  useEffect(() => {
    const manager = AudioContextManager.getInstance();
    audioContextRef.current = manager.context;
    
    // Create gain node
    const gainNode = manager.context.createGain();
    gainNode.connect(manager.context.destination);
    gainNodeRef.current = gainNode;

    // Create analyser
    const analyser = manager.context.createAnalyser();
    analyser.fftSize = 256;
    analyser.connect(gainNode); // We'll connect source -> analyser -> gain -> dest
    analyserRef.current = analyser;

    return () => {
      manager.context.close();
    };
  }, []);

  // --- Audio Logic ---
  const stopAudio = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (e) { /* ignore if already stopped */ }
      sourceNodeRef.current = null;
    }
  }, []);

  const playChunk = useCallback(async (index: number) => {
    if (!docState || index >= docState.chunks.length) return;

    // Ensure Audio Context is running
    const ctx = audioContextRef.current;
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume();
    }

    const chunk = docState.chunks[index];
    let buffer = chunk.audioBuffer;

    // If no buffer, we might have it in the prefetch ref if it was the next one
    if (!buffer && nextAudioBufferRef.current && docState.chunks[index].id === docState.chunks[index].id) {
         // Logic to match ID would be better, but index is sufficient if linear
         // For now, let's assume if it's not in chunk, we fetch it.
    }

    if (!buffer) {
      try {
        setIsLoading(true);
        const base64 = await generateSpeechFromText(chunk.text, playerState.voice);
        
        // Handle undefined (empty text) response gracefully
        if (!base64) {
             setIsLoading(false);
             // Skip to next chunk immediately
             setTimeout(() => handleNextChunk(), 0); 
             return;
        }

        if (!ctx) throw new Error("Audio Context unavailable");
        
        const audioBytes = decodeBase64(base64);
        // Using manual PCM decoding (24kHz, 1 channel)
        buffer = decodeAudioData(audioBytes, ctx, 24000, 1);
        
        // Cache it in state to avoid re-fetching (memory tradeoff)
        setDocState(prev => {
           if (!prev) return null;
           const newChunks = [...prev.chunks];
           newChunks[index] = { ...newChunks[index], audioBuffer: buffer };
           return { ...prev, chunks: newChunks };
        });
      } catch (err) {
        console.error(err);
        setError("Failed to fetch audio for this section.");
        setIsLoading(false);
        setPlayerState(p => ({...p, isPlaying: false}));
        return;
      } finally {
        setIsLoading(false);
      }
    }

    // Play it
    stopAudio();
    if (!ctx || !buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playerState.playbackRate;
    
    // Connect chain: Source -> Analyser -> Gain -> Dest
    if (analyserRef.current && gainNodeRef.current) {
        source.connect(analyserRef.current);
        // Analyser is already connected to gain in init
        // Gain is connected to dest in init
    } else {
        source.connect(ctx.destination);
    }

    source.onended = () => {
        // Automatically go to next
        if (playerState.isPlaying) { // Only advance if we haven't been stopped manually
           handleNextChunk();
        }
    };

    sourceNodeRef.current = source;
    source.start(0);
    setPlayerState(prev => ({ ...prev, isPlaying: true }));
    
    // Update index
    setDocState(prev => prev ? { ...prev, currentIndex: index } : null);

    // Prefetch next
    prefetchNext(index + 1);

  }, [docState, playerState.voice, playerState.playbackRate, playerState.isPlaying, stopAudio]);

  // Wrapper to handle next chunk logic with React state freshness
  const handleNextChunk = () => {
      setDocState(currentDocState => {
          if (!currentDocState) return null;
          const nextIndex = currentDocState.currentIndex + 1;
          if (nextIndex < currentDocState.chunks.length) {
              // We need to call playChunk, but playChunk depends on docState.
              // This is a common pitfall. 
              // Instead of calling playChunk here directly which might close over stale state,
              // we trigger an effect or use a ref-based approach.
              // For simplicity, we'll schedule it.
              setTimeout(() => playChunk(nextIndex), 0);
              return { ...currentDocState, currentIndex: nextIndex };
          } else {
              setPlayerState(p => ({ ...p, isPlaying: false }));
              return currentDocState;
          }
      });
  };

  const prefetchNext = async (index: number) => {
      if (!docState || index >= docState.chunks.length || isFetchingRef.current) return;
      const nextChunk = docState.chunks[index];
      if (nextChunk.audioBuffer) return; // Already have it

      try {
          isFetchingRef.current = true;
          const base64 = await generateSpeechFromText(nextChunk.text, playerState.voice);
          if (base64 && audioContextRef.current) {
              const audioBytes = decodeBase64(base64);
              const buffer = decodeAudioData(audioBytes, audioContextRef.current, 24000, 1);
               setDocState(prev => {
                if (!prev) return null;
                const newChunks = [...prev.chunks];
                if (newChunks[index]) {
                     newChunks[index] = { ...newChunks[index], audioBuffer: buffer };
                }
                return { ...prev, chunks: newChunks };
             });
          }
      } catch (e) {
          console.error("Prefetch failed", e);
      } finally {
          isFetchingRef.current = false;
      }
  };


  // --- Event Handlers ---

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setPlayerState(p => ({ ...p, isPlaying: false }));
    stopAudio();

    try {
      const text = await file.text();
      loadDocument(text, file.name);
    } catch (err) {
      setError("Could not read file. Please upload a valid text file.");
      setIsLoading(false);
    }
  };

  const loadDocument = (text: string, fileName: string) => {
    try {
      const rawChunks = chunkText(text, MAX_CHUNK_LENGTH);
      const chunks: Chunk[] = rawChunks.map((t, i) => ({
        id: `chunk-${i}`,
        text: t,
        status: 'pending',
      }));

      setDocState({
        fileName: fileName,
        chunks,
        currentIndex: 0,
      });
      setShowDrive(false);
    } catch (err) {
      setError("Failed to process document content.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayPause = () => {
    if (playerState.isPlaying) {
      stopAudio();
      setPlayerState(prev => ({ ...prev, isPlaying: false }));
    } else {
      if (docState) {
        playChunk(docState.currentIndex);
      }
    }
  };

  const handleSkip = (direction: 'prev' | 'next') => {
      if (!docState) return;
      const newIndex = direction === 'next' 
          ? Math.min(docState.chunks.length - 1, docState.currentIndex + 1)
          : Math.max(0, docState.currentIndex - 1);
      
      playChunk(newIndex);
  };

  const handleVoiceChange = (newVoice: VoiceName) => {
      setPlayerState(prev => ({ ...prev, voice: newVoice, isPlaying: false }));
      stopAudio();
      // Clear audio buffers as they are voice specific
      setDocState(prev => {
          if(!prev) return null;
          return {
              ...prev,
              chunks: prev.chunks.map(c => ({...c, audioBuffer: undefined})) // Invalidate cache
          }
      });
  };

  const updateSpeed = (rate: number) => {
      setPlayerState(prev => ({ ...prev, playbackRate: rate }));
      if (sourceNodeRef.current) {
          sourceNodeRef.current.playbackRate.value = rate;
      }
  };

  // --- Render ---

  if (!docState) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 rounded-2xl border border-slate-800 p-8 shadow-2xl text-center space-y-8">
            <div className="space-y-2">
                <div className="w-16 h-16 bg-brand-500 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-brand-500/20">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                </div>
                <h1 className="text-3xl font-bold text-white tracking-tight">DriveReader AI</h1>
                <p className="text-slate-400">Transform your documents into lifelike speech with Gemini's advanced neural voices.</p>
            </div>

            {showDrive ? (
                <DriveBrowser 
                  onFileSelect={(text, name) => {
                      setIsLoading(true);
                      loadDocument(text, name);
                  }}
                  onCancel={() => setShowDrive(false)}
                />
            ) : (
                <div className="space-y-4">
                    <label className="block w-full cursor-pointer group">
                        <div className="relative overflow-hidden rounded-xl bg-slate-800 border-2 border-dashed border-slate-700 group-hover:border-brand-500 group-hover:bg-slate-800/80 transition-all p-8">
                            <div className="flex flex-col items-center gap-3">
                                <svg className="w-10 h-10 text-slate-500 group-hover:text-brand-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                <span className="font-semibold text-slate-300">Upload Text File</span>
                                <span className="text-xs text-slate-500">Supports .TXT, .MD, .JSON</span>
                            </div>
                        </div>
                        <input type="file" onChange={handleFileUpload} accept=".txt,.md,.json,.csv" className="hidden" />
                    </label>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                            <div className="w-full border-t border-slate-800"></div>
                        </div>
                        <div className="relative flex justify-center">
                            <span className="bg-slate-900 px-2 text-xs text-slate-500 uppercase">Or</span>
                        </div>
                    </div>

                    <button 
                      onClick={() => setShowDrive(true)}
                      className="w-full flex items-center justify-center gap-2 bg-slate-800 text-slate-200 py-3 rounded-xl border border-slate-700 hover:bg-slate-750 hover:border-slate-600 transition-all"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.01 1.9c-1.22 0-2.34.62-2.96 1.69L3.4 13.06c-.63 1.08-.63 2.39 0 3.47l.02.04c.61 1.06 1.73 1.69 2.96 1.69h10.37c1.37 0 2.65-.77 3.32-2l-5.18-9-2.91-5.04c-.65-1.23-1.93-2.02-3.32-2.02h-.65zM5.9 14.88l3.15-5.45 2.58 4.46H5.9zm6.65-6.32l2.6 4.5h-5.18l2.58-4.5zm-5.18 7.17h9.4l-2.6 4.5H6.38l-2.6-4.5z"/></svg>
                        <span>Select from Google Drive</span>
                    </button>
                </div>
            )}
            
            {error && <p className="text-red-400 text-sm">{error}</p>}
            {isLoading && <p className="text-brand-400 text-sm animate-pulse">Processing document...</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-950 flex flex-col md:flex-row overflow-hidden text-slate-200">
        
        {/* Main Reader Area */}
        <main className="flex-1 flex flex-col h-full relative z-0 p-4 gap-4">
             <Reader 
                chunks={docState.chunks} 
                currentIndex={docState.currentIndex} 
                fileName={docState.fileName}
                onChunkClick={(index) => playChunk(index)}
             />
        </main>

        {/* Sidebar Controls */}
        <aside className="w-full md:w-96 bg-slate-900 border-l border-slate-800 p-6 flex flex-col gap-8 z-10 shadow-2xl overflow-y-auto">
            
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-100">Controls</h3>
                <button 
                  onClick={() => {stopAudio(); setDocState(null);}} 
                  className="text-xs text-slate-400 hover:text-white underline"
                >
                    Close Document
                </button>
            </div>

            {/* Visualizer */}
            <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Audio Output</label>
                <Visualizer analyser={analyserRef.current} isPlaying={playerState.isPlaying} />
            </div>

            {/* Playback Controls */}
            <div className="flex flex-col gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                <div className="flex justify-center items-center gap-6">
                    <button 
                        onClick={() => handleSkip('prev')}
                        className="p-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                    </button>
                    
                    <button 
                        onClick={handlePlayPause}
                        className={`
                            w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all transform hover:scale-105
                            ${playerState.isPlaying ? 'bg-brand-500 text-white shadow-brand-500/30' : 'bg-slate-100 text-slate-900'}
                        `}
                    >
                        {isLoading ? (
                            <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : playerState.isPlaying ? (
                            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                        ) : (
                             <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        )}
                    </button>

                    <button 
                         onClick={() => handleSkip('next')}
                        className="p-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                    </button>
                </div>

                {/* Speed Control */}
                 <div className="flex items-center justify-between px-2">
                    <span className="text-xs text-slate-400">0.5x</span>
                    <input 
                        type="range" 
                        min="0.5" 
                        max="2" 
                        step="0.1" 
                        value={playerState.playbackRate}
                        onChange={(e) => updateSpeed(parseFloat(e.target.value))}
                        className="w-full mx-3 accent-brand-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-xs text-slate-400">2x</span>
                </div>
            </div>

            {/* Voice Selection */}
            <VoiceSelector 
                selectedVoice={playerState.voice} 
                onVoiceChange={handleVoiceChange} 
                disabled={isLoading}
            />

            {/* Info */}
            <div className="mt-auto pt-6 border-t border-slate-800 text-center">
                <p className="text-xs text-slate-500">
                    Powered by Google Gemini 2.5 Flash TTS.<br/>
                    Currently reading chunk {docState.currentIndex + 1} of {docState.chunks.length}.
                </p>
            </div>
        </aside>

        {/* Global Loading Overlay if needed */}
        {isLoading && !playerState.isPlaying && (
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-none">
                <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-xl flex items-center gap-3">
                    <svg className="w-5 h-5 animate-spin text-brand-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span className="text-sm font-medium text-slate-200">Processing...</span>
                </div>
            </div>
        )}
    </div>
  );
}