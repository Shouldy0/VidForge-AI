import { TextToSpeechClient } from '@google-cloud/text-to-speech'
import { config } from '../../shared/src/env'

export interface TTSOptions {
  languageCode?: string
  voiceName?: string
  gender?: 'MALE' | 'FEMALE' | 'NEUTRAL'
  speakingRate?: number
  pitch?: number
}

export class TTSClient {
  private client: TextToSpeechClient

  constructor() {
    this.client = new TextToSpeechClient({
      credentials: {
        private_key: config.GOOGLE_CLOUD_TTS_KEY,
        client_email: process.env.GOOGLE_CLIENT_EMAIL || '',
      },
      projectId: process.env.GOOGLE_PROJECT_ID || '',
    })
  }

  async synthesizeSpeech(text: string, options: TTSOptions = {}): Promise<Uint8Array> {
    const request = {
      input: { text: text },
      voice: {
        languageCode: options.languageCode || 'en-US',
        name: options.voiceName || 'en-US-Wavenet-D',
        ssmlGender: options.gender || 'NEUTRAL',
      },
      audioConfig: {
        audioEncoding: 'MP3' as const,
        speakingRate: options.speakingRate || 1.0,
        pitch: options.pitch || 0.0,
      },
    }

    const [response] = await this.client.synthesizeSpeech(request)
    if (!response.audioContent) {
      throw new Error('No audio content returned from TTS service')
    }

    // Ensure we return Uint8Array
    if (response.audioContent instanceof Uint8Array) {
      return response.audioContent
    } else {
      // Convert base64 string to Uint8Array if needed
      const binaryString = atob(response.audioContent as string)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      return bytes
    }
  }
}
