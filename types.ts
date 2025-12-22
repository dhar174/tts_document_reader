export enum VoiceName {
  Puck = 'Puck',
  Charon = 'Charon',
  Kore = 'Kore',
  Fenrir = 'Fenrir',
  Zephyr = 'Zephyr',
}

export interface Chunk {
  id: string;
  text: string;
  status: 'pending' | 'loading' | 'ready' | 'playing' | 'completed';
  audioBuffer?: AudioBuffer;
}

export interface DocumentState {
  fileName: string;
  chunks: Chunk[];
  currentIndex: number;
}

export interface PlayerState {
  isPlaying: boolean;
  playbackRate: number;
  voice: VoiceName;
  volume: number;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  iconLink?: string;
  thumbnailLink?: string;
}
