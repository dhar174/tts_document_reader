import { GoogleGenAI, Modality } from "@google/genai";
import { VoiceName } from "../types";

const API_KEY = process.env.API_KEY || '';

// Initialize Gemini client
// Note: In a real app, you might want to lazily init this or handle missing keys gracefully in UI
const ai = new GoogleGenAI({ apiKey: API_KEY });

export async function generateSpeechFromText(text: string, voice: VoiceName): Promise<string | undefined> {
  // Validate text is not empty or just whitespace to prevent API errors
  if (!text || !text.trim()) return undefined;
  
  if (!API_KEY) {
    console.error("API Key is missing");
    throw new Error("API Key is missing. Please configure your environment.");
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text.trim() }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio;
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    throw error;
  }
}

export function chunkText(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let currentChunk = '';

  // Regex to match sentence-like units: 
  // Match one or more non-terminator characters followed by zero or more terminators.
  // Terminators are . ! ? and \n
  const sentences = text.match(/[^.!?\n]+[.!?\n]*/g);

  // Fallback if no match (e.g. empty or only special chars)
  if (!sentences) {
     const trimmed = text.trim();
     return trimmed.length > 0 ? [trimmed] : [];
  }

  for (const sentence of sentences) {
    // If adding this sentence exceeds max length, push current chunk
    // We trim chunks to avoid sending whitespace-heavy prompts
    if ((currentChunk + sentence).length > maxLength && currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }
  
  // Push remaining text
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}