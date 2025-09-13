// Database types

export interface Profile {
  id: string
  referrer_id?: string
  display_name?: string
  role: string
  created_at: string
  updated_at: string
}

export interface ReferralCode {
  id: string
  user_id: string
  code: string
  created_at: string
}

export interface ReferralAward {
  id: string
  referrer_id: string
  referred_id: string
  awarded_at: string
}

export interface Schedule {
  id: string
  series_id: string
  cron_expr: string
  timezone: string
  created_at: string
  updated_at: string
}

export interface MusicTrack {
  id: string
  title: string
  bpm?: number
  license_id?: string
  url: string
  user_id: string
  allowlist: boolean
  created_at: string
  updated_at: string
}
