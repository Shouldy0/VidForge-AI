# VidForge AI

AI-powered video generation platform built with Next.js, Supabase, and TypeScript.

## Monorepo Structure

```
vidforge-monorepo/
├── apps/
│   ├── web/          # Next.js App Router application
│   └── worker/       # Node.js worker for video processing
├── packages/
│   ├── shared/       # Shared types and schemas (Zod)
│   └── ai/           # Gemini/Veo AI wrappers
├── supabase/         # Supabase configuration and migrations
└── package.json      # Root workspace configuration
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Supabase CLI
- FFmpeg (for video processing)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd vidforge-monorepo
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your actual values
```

4. Set up Supabase:
```bash
# Initialize Supabase (if not already done)
supabase init

# Link to your project
supabase link --project-ref your-project-id

# Start Supabase locally
supabase start

# Push database schema
supabase db push

# Generate TypeScript types
supabase gen types typescript --local > packages/shared/src/database.ts
```

### Development

Start all applications:
```bash
pnpm run dev
```

Or start individual applications:
```bash
# Web app
pnpm --filter @vidforge/web dev

# Worker
pnpm --filter @vidforge/worker dev
```

### Build and Deploy

```bash
# Build all packages
pnpm run build

# Build web app
pnpm --filter @vidforge/web build

# Build worker
pnpm --filter @vidforge/worker build
```

## Supabase Integration

### Authentication
- Next.js server components and client components integration
- SSR-safe Supabase client configuration
- Row Level Security (RLS) enabled

### Database
- Postgres with custom "jobs" schema for pg-boss
- Migration files in `supabase/migrations/`
- TypeScript types generated automatically

### Storage
- File uploads for videos and assets
- Configured for resumable uploads

### Edge Functions
- Serverless functions for specific tasks
- Configured in `supabase/functions/`

## Stripe Integration

### Webhooks
Handle Stripe webhooks for:
- Subscription updates
- Payment confirmations
- Billing portal events

### Billing Portal
- Customer billing portal integration
- Subscription management

## Job Queue (pg-boss)

Jobs are processed in the "jobs" schema:
- Video generation tasks
- AI processing workflows
- Background processing

## Architecture

### Apps
- **web**: Next.js 14 with App Router, TypeScript, Tailwind, shadcn/ui
- **worker**: Node.js service orchestrating video processing and AI tasks

### Packages
- **shared**: Common types, Zod schemas, database types
- **ai**: Gemini and Veo AI model wrappers and utilities

### Services
- **Supabase**: Auth, Database, Storage, Edge Functions
- **Stripe**: Payments and billing
- **Google AI**: Video generation and processing
- **pg-boss**: Job queue management

## Development Workflow

1. Make changes to shared packages first
2. Update dependent packages
3. Test in development environment
4. Deploy changes following proper migration paths

## Contributing

1. Create feature branch
2. Make changes with proper TypeScript types
3. Test locally with Supabase development environment
4. Create pull request with detailed description

## Deployment

### Supabase
```bash
# Push database changes
supabase db push

# Deploy edge functions
supabase functions deploy

# Generate types after schema changes
supabase gen types typescript --local > packages/shared/src/database.ts
```

### Applications
- Web app deploys to Vercel/Netlify
- Worker deploys to Railway/Render
- Database migrations run automatically
