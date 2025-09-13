import { z } from 'zod'

// User schemas
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().optional(),
  avatar_url: z.string().url().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

// Video schemas
export const VideoStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed'])

export const VideoSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string().min(1).max(255),
  status: VideoStatusSchema,
  url: z.string().url().optional(),
  thumbnail_url: z.string().url().optional(),
  duration: z.number().positive().optional(),
  size: z.number().positive().optional(),
  metadata: z.record(z.any()).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

// Job schemas
export const JobStateSchema = z.enum(['created', 'retry', 'active', 'completed', 'cancelled', 'failed'])

export const JobSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  data: z.record(z.any()),
  priority: z.number().int().min(0),
  retry_limit: z.number().int().min(0),
  retry_count: z.number().int().min(0),
  start_after: z.date().optional(),
  singleton_key: z.string().optional(),
  state: JobStateSchema,
  created_on: z.date(),
  started_on: z.date().optional(),
  completed_on: z.date().optional(),
})

// Job payload schemas for specific queues
export const GenerateEpisodePayloadSchema = z.object({
  episode_id: z.string().uuid(),
})

export const RenderEpisodePayloadSchema = z.object({
  render_id: z.string().uuid(),
})

export const PublishVideoPayloadSchema = z.object({
  episode_id: z.string().uuid(),
  platform: z.enum(['youtube', 'tiktok', 'instagram', 'twitter']),
})

// Stripe schemas
export const StripeCustomerStatusSchema = z.enum(['active', 'past_due', 'canceled', 'unpaid', 'incomplete'])

export const StripeCustomerSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  customer_id: z.string(),
  subscription_id: z.string().optional(),
  status: StripeCustomerStatusSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

// API request/response schemas
export const CreateVideoRequestSchema = z.object({
  title: z.string().min(1).max(255),
  prompt: z.string().optional(),
  settings: z.object({
    duration: z.number().min(1).max(300).optional(), // seconds
    resolution: z.enum(['480p', '720p', '1080p', '4k']).optional(),
    format: z.enum(['mp4', 'webm']).optional(),
  }).optional(),
})

// Generate series schemas
export const GenerateSeriesRequestSchema = z.object({
  brand_id: z.string().uuid(),
  title: z.string().min(1).max(255),
  topic: z.string().min(1).max(1000),
  cadence: z.string().optional(),
  language: z.string().optional(),
})

// Generate episode schemas
export const GenerateEpisodeRequestSchema = z.object({
  series_id: z.string().uuid(),
  title: z.string().min(1).max(255),
  topic: z.string().min(1).max(1000),
  duration: z.number().min(1).max(300).optional(), // seconds
})

// Generate cover image schemas
export const GenerateCoverRequestSchema = z.object({
  episode_id: z.string().uuid(),
  series_id: z.string().uuid(),
  title: z.string().min(1).max(255),
  topic: z.string().min(1).max(1000),
  style: z.string().optional(),
})

// Generate Veo video schemas
export const GenerateVeoRequestSchema = z.object({
  episode_id: z.string().uuid(),
  series_id: z.string().uuid(),
  prompt: z.string().min(1).max(1000),
  duration: z.number().min(1).max(300),
  resolution: z.enum(['480p', '720p', '1080p', '4k']),
  aspectRatio: z.enum(['16:9', '9:16', '1:1']),
  fps: z.number().min(1).max(60).optional(),
})

export const VideoGenerationResponseSchema = z.object({
  id: z.string().uuid(),
  status: VideoStatusSchema,
  estimated_completion: z.date().optional(),
})

// Export types from schemas
export type User = z.infer<typeof UserSchema>
export type Video = z.infer<typeof VideoSchema>
export type VideoStatus = z.infer<typeof VideoStatusSchema>
export type Job = z.infer<typeof JobSchema>
export type JobState = z.infer<typeof JobStateSchema>
export type StripeCustomer = z.infer<typeof StripeCustomerSchema>
export type StripeCustomerStatus = z.infer<typeof StripeCustomerStatusSchema>
export type CreateVideoRequest = z.infer<typeof CreateVideoRequestSchema>
export type VideoGenerationResponse = z.infer<typeof VideoGenerationResponseSchema>

// Job payload types
export type GenerateEpisodePayload = z.infer<typeof GenerateEpisodePayloadSchema>
export type RenderEpisodePayload = z.infer<typeof RenderEpisodePayloadSchema>
export type PublishVideoPayload = z.infer<typeof PublishVideoPayloadSchema>

// Generation request types
export type GenerateSeriesRequest = z.infer<typeof GenerateSeriesRequestSchema>
export type GenerateEpisodeRequest = z.infer<typeof GenerateEpisodeRequestSchema>
export type GenerateCoverRequest = z.infer<typeof GenerateCoverRequestSchema>
export type GenerateVeoRequest = z.infer<typeof GenerateVeoRequestSchema>
