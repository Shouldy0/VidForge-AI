import { GoogleGenerativeAI } from '@google/generative-ai'
import { GeminiOptions } from './types'

export class GeminiClient {
  private client: GoogleGenerativeAI
  private model: any

  constructor(apiKey: string, options: GeminiOptions) {
    this.client = new GoogleGenerativeAI(apiKey)
    this.model = this.client.getGenerativeModel({
      model: options.model,
      generationConfig: {
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens,
        topP: options.topP,
        topK: options.topK,
      },
    })
  }

  async generateText(prompt: string): Promise<string> {
    try {
      const result = await this.model.generateContent(prompt)
      return result.response.text()
    } catch (error) {
      throw new Error(`Gemini text generation failed: ${error}`)
    }
  }

  // Note: Rate limiting is now handled by Next.js middleware before calling this method
  // Ensure API routes calling Gemini are under '/api/gemini' path to trigger middleware

  async generateScript(videoPrompt: string): Promise<string> {
    const prompt = `Create a detailed video script based on this prompt: ${videoPrompt}
    Include scene descriptions, transitions, and timing suggestions.`

    return this.generateText(prompt)
  }
}
