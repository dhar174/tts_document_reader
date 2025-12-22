// Utility to decode base64 string
export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Utility to decode raw PCM audio data to AudioBuffer
// Gemini TTS returns raw PCM 16-bit data, not a WAV/MP3 container.
// We must decode it manually.
export function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): AudioBuffer {
  // Ensure even byte length for 16-bit PCM
  if (data.length % 2 !== 0) {
     console.warn("Odd byte length for 16-bit PCM, trimming last byte");
     data = data.subarray(0, data.length - 1);
  }

  // Create Int16Array view
  // Note: We use the underlying buffer, offset, and length to create the view correctly
  // even if 'data' is a subarray.
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Convert Int16 [-32768, 32767] to Float32 [-1.0, 1.0]
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  
  return buffer;
}

export class AudioContextManager {
  private static instance: AudioContextManager;
  public context: AudioContext;

  private constructor() {
    this.context = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000, // Match Gemini output often
    });
  }

  public static getInstance(): AudioContextManager {
    if (!AudioContextManager.instance) {
      AudioContextManager.instance = new AudioContextManager();
    }
    return AudioContextManager.instance;
  }

  public resume() {
    if (this.context.state === 'suspended') {
      this.context.resume();
    }
  }
}