import { VoiceName } from './types';

export const ALL_VOICES = [
  { name: VoiceName.Puck, description: 'Soft & Mellow', gender: 'Male' },
  { name: VoiceName.Charon, description: 'Deep & Authoritative', gender: 'Male' },
  { name: VoiceName.Kore, description: 'Calm & Soothing', gender: 'Female' },
  { name: VoiceName.Fenrir, description: 'Resonant & Bold', gender: 'Male' },
  { name: VoiceName.Zephyr, description: 'Bright & Energetic', gender: 'Female' },
];

export const MAX_CHUNK_LENGTH = 500; // Characters per TTS chunk for optimal latency/flow
