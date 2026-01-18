import React, { useState, useEffect } from 'react';
import { initGoogleScripts, authenticate, listGoogleDocs, getFileContent } from '../services/driveService';
import { DriveFile } from '../types';

interface DriveBrowserProps {
  onFileSelect: (text: string, fileName: string) => void;
  onCancel: () => void;
}

export const DriveBrowser: React.FC<DriveBrowserProps> = ({ onFileSelect, onCancel }) => {
  const [step, setStep] = useState<'config' | 'auth' | 'list' | 'loading'>('config');
  const [clientId, setClientId] = useState('');
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const DEFAULT_CLIENT_ID = "565574244998-cuab26dhrdjp5pr4plj1u5d2ksh799qh.apps.googleusercontent.com";

  // Check for stored client ID on mount
  useEffect(() => {
  const storedId = localStorage.getItem("drive_client_id")?.trim();
  if (storedId) {
    setClientId(storedId);
    initialize(storedId);
} else {
  setClientId(DEFAULT_CLIENT_ID);
}
  }, []);

  const initialize = async (id: string) => {
    try {
      setStep('loading');
      await initGoogleScripts(id);
      setStep('auth');
    } catch (err) {
      console.error(err);
      setError("Failed to initialize Google scripts. Please check your Client ID.");
      setStep('config');
    }
  };

  const handleConfigSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId.trim()) return;
    localStorage.setItem('drive_client_id', clientId);
    initialize(clientId);
  };

  const handleAuth = async () => {
    try {
      setStep('loading');
      await authenticate();
      const docs = await listGoogleDocs();
      setFiles(docs);
      setStep('list');
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Authentication failed. Pop-ups might be blocked.");
      setStep('auth');
    }
  };

  const handleFileClick = async (file: DriveFile) => {
    try {
      setStep('loading');
      const text = await getFileContent(file.id, file.mimeType);
      onFileSelect(text, file.name);
    } catch (err) {
      console.error(err);
      setError("Failed to download file content.");
      setStep('list');
    }
  };

  const resetConfig = () => {
    localStorage.removeItem('drive_client_id');
    setClientId('');
    setStep('config');
    setError(null);
  };

  if (step === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-12">
        <svg className="w-8 h-8 animate-spin text-brand-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-slate-400">Connecting to Drive...</p>
      </div>
    );
  }

  if (step === 'config') {
    return (
      <div className="space-y-4 text-left">
        <h3 className="text-xl font-bold text-white">Configure Google Drive</h3>
        <p className="text-sm text-slate-400">
            To access your files, this app needs a Google Cloud Client ID. 
            This runs entirely in your browser; no data is sent to our servers.
        </p>
        <form onSubmit={handleConfigSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Client ID</label>
            <input 
              type="text" 
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="12345...apps.googleusercontent.com"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-brand-500 text-sm"
              required
            />
          </div>
          <div className="flex gap-3">
             <button 
                type="button"
                onClick={onCancel}
                className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800"
             >
                Cancel
             </button>
             <button 
                type="submit"
                className="flex-1 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-500"
             >
                Continue
             </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </form>
      </div>
    );
  }

  if (step === 'auth') {
    return (
      <div className="space-y-6 text-center py-4">
        <div className="mx-auto w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                 <path d="M12.01 1.9c-1.22 0-2.34.62-2.96 1.69L3.4 13.06c-.63 1.08-.63 2.39 0 3.47l.02.04c.61 1.06 1.73 1.69 2.96 1.69h10.37c1.37 0 2.65-.77 3.32-2l-5.18-9-2.91-5.04c-.65-1.23-1.93-2.02-3.32-2.02h-.65zM5.9 14.88l3.15-5.45 2.58 4.46H5.9zm6.65-6.32l2.6 4.5h-5.18l2.58-4.5zm-5.18 7.17h9.4l-2.6 4.5H6.38l-2.6-4.5z"/>
            </svg>
        </div>
        <div>
            <h3 className="text-xl font-bold text-white mb-2">Authorization Required</h3>
            <p className="text-sm text-slate-400 max-w-xs mx-auto">
                Please authorize access to your Google Drive to view and select your documents.
            </p>
        </div>
        
        <div className="flex flex-col gap-3">
             <button 
                onClick={handleAuth}
                className="w-full py-3 rounded-xl bg-white text-slate-900 font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
             >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z"/></svg>
                Sign in with Google
             </button>
             <div className="flex justify-between text-xs">
                <button onClick={resetConfig} className="text-slate-500 hover:text-slate-300">Change Client ID</button>
                <button onClick={onCancel} className="text-slate-500 hover:text-slate-300">Cancel</button>
             </div>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  // List View
  return (
    <div className="flex flex-col h-[450px]">
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-800">
            <h3 className="font-bold text-white">Select a Document</h3>
            <button onClick={onCancel} className="text-xs text-slate-400 hover:text-white">Close</button>
        </div>
        
        <div className="flex-1 overflow-y-auto reader-scroll -mx-2 px-2 space-y-2">
            {files.length === 0 ? (
                <div className="text-center text-slate-500 py-12">
                    No documents found.
                </div>
            ) : (
                files.map(file => (
                    <button
                        key={file.id}
                        onClick={() => handleFileClick(file)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-all text-left group"
                    >
                        <div className="w-10 h-10 rounded bg-blue-900/30 flex items-center justify-center flex-shrink-0 text-blue-400">
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-slate-200 truncate group-hover:text-brand-300">{file.name}</h4>
                            <p className="text-xs text-slate-500">Modified {new Date(file.modifiedTime || '').toLocaleDateString()}</p>
                        </div>
                    </button>
                ))
            )}
        </div>
        
        <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
            <span>{files.length} documents found</span>
            <button onClick={resetConfig} className="hover:text-slate-300">Sign Out / Reset</button>
        </div>
    </div>
  );
};
