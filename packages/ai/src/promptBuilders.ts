import { Brand } from './types';

/**
 * Applies brand kit guidelines to any prompt to ensure consistent brand voice and style
 *
 * @param prompt - The original prompt string
 * @param brand - Brand configuration with font, palette, tone, CTA, and voice preset
 * @returns Enhanced prompt with brand guidelines prepended
 */
export function applyBrandKit(prompt: string, brand: Brand): string {
  const brandGuidelines: string[] = [];

  if (brand.font) {
    brandGuidelines.push(`FONT: Use ${brand.font} font family for all text elements and branding`);
  }

  if (brand.palette) {
    brandGuidelines.push(`COLOR PALETTE:`);
    brandGuidelines.push(`- Primary: ${brand.palette.primary}`);
    brandGuidelines.push(`- Secondary: ${brand.palette.secondary}`);
    brandGuidelines.push(`- Accent: ${brand.palette.accent}`);
  }

  if (brand.tone) {
    brandGuidelines.push(`TONE: Maintain ${brand.tone} throughout all content and communications`);
  }

  if (brand.cta) {
    brandGuidelines.push(`CALL TO ACTION: Use "${brand.cta}" as the primary CTA copy`);
  }

  if (brand.voice_preset) {
    brandGuidelines.push(`VOICE PRESET: Use "${brand.voice_preset}" voice for all audio content`);
  }

  if (brandGuidelines.length === 0) {
    return prompt;
  }

  return `BRAND GUIDELINES:\n${brandGuidelines.join('\n')}\n\nORIGINAL PROMPT:\n${prompt}`;
}

/**
 * String Builders for AI Prompts with Strict JSON Outputs
 * Each builder generates a textual prompt that instructs the AI to return valid JSON.
 */

// Input types for prompt builders
interface SeriesPromptInput {
  title: string;
  topic: string;
  cadence?: string;
  language?: string;
  brand?: Brand;
}

interface ScriptPromptInput {
  title: string;
  topic?: string;
  duration?: number;
  episodeId: string;
  seriesId: string;
  brand?: Brand;
}

interface CoverPromptInput {
  title: string;
  topic?: string;
  episodeId: string;
  seriesId?: string;
  style?: string;
}

interface VeoPromptInput {
  prompt: string;
}

interface SrtPromptInput {
  content: string;
  language?: string;
}

interface ScorePromptInput {
  title: string;
  episodeId: string;
  content?: string;
}

/**
 * Builds prompt for series plan generation
 */
export function buildSeriesPrompt(input: SeriesPromptInput): string {
  const basePrompt = `Create a comprehensive series plan for a video series with the following details:
Title: ${input.title}
Topic: ${input.topic}
Cadence: ${input.cadence || 'weekly'}
Language: ${input.language || 'English'}

Please generate a JSON response with:
- series_overview: brief description
- episode_structure: how many episodes, typical length
- content_pillars: main themes
- target_audience: who this is for
- hook_strategy: how to engage viewers
- series_goals: what you want to achieve

Format as valid JSON.`;

  return input.brand ? applyBrandKit(basePrompt, input.brand) : basePrompt;
}

/**
 * Builds prompt for episode script generation
 */
export function buildScriptPrompt(input: ScriptPromptInput): string {
  const duration = input.duration || 60; // default 60 seconds

  const basePrompt = `Create a detailed video script for an episode with these details:
Episode Title: ${input.title}
Topic: ${input.topic || 'General content'}
Target Duration: ${duration} seconds
Episode ID: ${input.episodeId}
Series ID: ${input.seriesId}

Please generate a JSON response with:
- script_sections: array of sections with timing, content, visual descriptions
- key_points: main takeaways
- call_to_action: suggested CTAs
- estimated_duration: calculated total duration
- speaking_notes: key phrases to emphasize

Structure the script as a JSON array of scenes with this format:
[
  {
    "start_time": "0:00",
    "duration": 15,
    "content": "Introduction text",
    "visual": "Visual description",
    "voice_over": "Script text"
  }
]

Format as valid JSON.`;

  return input.brand ? applyBrandKit(basePrompt, input.brand) : basePrompt;
}

/**
 * Builds prompt for cover image generation
 */
export function buildCoverPrompt(input: CoverPromptInput): string {
  return `Generate a text description for a compelling thumbnail/cover image for a video with:
Title: ${input.title}
Topic: ${input.topic || ''}
Episode ID: ${input.episodeId}
${input.seriesId ? `Series ID: ${input.seriesId}` : ''}
Style: ${input.style || 'modern, professional, engaging'}

Provide a detailed visual description suitable for AI image generation, including:
- Main subject and composition
- Color scheme
- Text elements to overlay
- Style and mood

Format as JSON with keys: description, colors, text_overlay, style_tips`;
}

/**
 * Builds prompt for Veo video hook generation
 */
export function buildVeoPrompt(input: VeoPromptInput): string {
  return `Generate a video hook based on the following prompt: ${input.prompt}

Please output the video generation specifications in JSON format with:
- prompt_details: detailed video narrative
- visual_style: description of visual approach
- audio_cues: suggested audio elements
- dynamic_elements: movement and transitions

Format as valid JSON.`;
}

/**
 * Builds prompt for SRT subtitle file generation
 */
export function buildSrtPrompt(input: SrtPromptInput): string {
  return `Generate SRT subtitles for the following content:
Content: ${input.content}
Language: ${input.language || 'English'}

Please create a JSON response containing:
- srt_entries: array of subtitle objects with timing, text, and formatting
- metadata: language, total duration, character count

Structure each entry as:
[
  {
    "start_time": "00:00:00,000",
    "end_time": "00:00:05,000",
    "text": "Subtitle text",
    "speaker": "optional speaker tag"
  }
]

Format as valid JSON.`;
}

/**
 * Builds prompt for scoring publish readiness
 */
export function buildScorePrompt(input: ScorePromptInput): string {
  return `Score the publish readiness of a video episode on a scale of 1-10 and provide feedback:

Episode Title: ${input.title}
Episode ID: ${input.episodeId}
${input.content ? `Content: ${input.content}` : ''}

Please evaluate based on these criteria:
- Content Quality: Is the content original, valuable, and engaging?
- Length and Pacing: Is the timing appropriate?
- Hook and Introduction: Does it grab attention immediately?
- Call to Action: Is there a clear CTA?
- Overall Polish: Production quality, audio, visuals

Provide a JSON response with:
- score: number from 1-10
- feedback: detailed feedback with specific recommendations
- criteria_scores: breakdown by category
- ready_to_publish: boolean recommendation

Format as valid JSON.`;
}

// Input types for insights prompt
interface InsightPromptInput {
  metrics: {
    views: number;
    retention03: number;
    completion_pct: number;
    ctr_thumb: number;
  };
  script: string;
}

/**
 * Builds prompt for generating actionable insights from analytics and script
 */
export function buildInsightPrompt(input: InsightPromptInput): string {
  return `Analyze the following video performance metrics and script content to generate actionable insights for improvement:

PERFORMANCE METRICS:
- Views: ${input.metrics.views}
- 3-second retention: ${(input.metrics.retention03 * 100).toFixed(1)}%
- Completion percentage: ${(input.metrics.completion_pct * 100).toFixed(1)}%
- Thumbnail CTR: ${(input.metrics.ctr_thumb * 100).toFixed(1)}%

SCRIPT CONTENT:
${input.script}

Please provide actionable recommendations in JSON format with:
- performance_summary: brief overview of current performance
- identified_issues: array of specific problems based on metrics
- actionable_fixes: array of concrete, implementable suggestions
- next_hook_variants: array of alternative hook/Opening strategies to test
- priority_score: number 1-10 for how urgent action is needed

Focus on:
1. Improving retention and completion rates
2. Optimizing hooks and engagement
3. Content structure improvements
4. Visual/audio recommendations where relevant

Format as valid JSON.`;
}
