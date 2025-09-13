import { z } from 'zod'

const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GOOGLE_CLOUD_TTS_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  VEO_MODEL: z.string().default('veo-3'),
  YOUTUBE_OAUTH_CLIENT_ID: z.string().min(1),
  YOUTUBE_OAUTH_CLIENT_SECRET: z.string().min(1),
  TIKTOK_CLIENT_ID: z.string().min(1),
  TIKTOK_CLIENT_SECRET: z.string().min(1),
  META_CLIENT_ID: z.string().min(1),
  META_CLIENT_SECRET: z.string().min(1),
  FFMPEG_PATH: z.string().min(1),
  FFPROBE_PATH: z.string().min(1),
})

// Parse environment variables
const parsedEnv = envSchema.safeParse(process.env)

if (!parsedEnv.success) {
  console.error('Invalid environment variables:', parsedEnv.error.errors)
  throw new Error('Invalid environment variables')
}

export const config = parsedEnv.data

export default config
