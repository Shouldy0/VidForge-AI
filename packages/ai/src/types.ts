export interface GeminiOptions {
  model: 'gemini-pro' | 'gemini-pro-vision';
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
}

export interface VeoOptions {
  model: 'veo-2' | 'veo-1';
  duration: number; // seconds
  resolution: '480p' | '720p' | '1080p' | '4k';
  aspectRatio: '16:9' | '9:16' | '1:1';
  fps?: number;
}

export interface GeneratedVideo {
  id: string;
  url: string;
  thumbnailUrl?: string;
  duration: number;
  resolution: string;
  size: number;
  metadata: Record<string, any>;
}

export interface AIGenerationResponse {
  success: boolean
  data?: GeneratedVideo
  error?: string
  estimatedTime?: number; // seconds
}

// Input interfaces for AI functions
export interface GenerateSeriesPlanInput {
  title: string
  topic: string
  cadence?: string
  language?: string
  [key: string]: any
}

export interface GenerateEpisodeScriptInput {
  episodeId: string
  seriesId: string
  title: string
  topic?: string
  duration?: number
  [key: string]: any
}

export interface GenerateCoverImageInput {
  episodeId: string
  seriesId?: string
  title: string
  topic?: string
  style?: string
  [key: string]: any
}

export interface GenerateVeoHookInput {
  episodeId: string
  seriesId: string
  prompt: string
  duration: number
  resolution: '480p' | '720p' | '1080p' | '4k'
  aspectRatio: '16:9' | '9:16' | '1:1'
  fps?: number
  [key: string]: any
}

export interface ScorePublishReadinessInput {
  episodeId: string
  seriesId?: string
  title: string
  content?: string
  [key: string]: any
}

export interface TTSSynthesizeInput {
  text: string
  languageCode?: string
  voiceName?: string
  voiceGender?: 'MALE' | 'FEMALE' | 'NEUTRAL'
  speakingRate?: number
  pitch?: number
  episodeId?: string
  cache?: boolean
  [key: string]: any
}

// Base interface for function parameters
export interface AIFunctionParams {
  supabase: any // SupabaseClient
  userId: string
}

// Return types
export interface GenerateSeriesPlanResponse {
  success: boolean
  data?: any
  error?: string
}

export interface GenerateEpisodeScriptResponse {
  success: boolean
  data?: any
  error?: string
}

export interface GenerateCoverImageResponse {
  success: boolean
  base64Image?: string
  error?: string
}

export interface GenerateVeoHookResponse {
  success: boolean
  mp4Bytes?: Uint8Array
  error?: string
}

export interface ScorePublishReadinessResponse {
  success: boolean
  score?: number
  feedback?: string
  error?: string
}

export interface TTSSynthesizeResponse {
  success: boolean
  url?: string
  duration?: number
  hash?: string
  error?: string
}

// Brand configuration interface
export interface Brand {
  font?: string;
  palette?: {
    primary: string;
    secondary: string;
    accent: string;
  };
  tone?: string;
  cta?: string;
  voice_preset?: string;
}
