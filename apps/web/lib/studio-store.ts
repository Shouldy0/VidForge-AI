import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import {
  StudioEpisode,
  SceneClip,
  StudioScore,
  EpisodeTimeline,
  SceneAsset,
  CaptionItem
} from '@vidforge/shared'

interface StudioStore {
  // Episode data
  episode: StudioEpisode | null
  isLoading: boolean
  error: string | null

  // UI state
  selectedSceneId: string | null
  currentTime: number
  isPlaying: boolean

  // Timeline editing
  selectedCaptionIndex: number | null

  // Actions
  setEpisode: (episode: StudioEpisode) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // Scene management
  selectScene: (sceneId: string | null) => void
  updateScene: (sceneId: string, updates: Partial<SceneClip>) => void
  regenerateScene: (sceneId: string) => Promise<void>
  addScene: (scene: Omit<SceneClip, 'id'>) => void
  removeScene: (sceneId: string) => void

  // Caption management
  updateCaption: (index: number, updates: Partial<CaptionItem>) => void
  addCaption: (caption: Omit<CaptionItem, 'position'> & { position?: [number, number] }) => void
  removeCaption: (index: number) => void
  selectCaption: (index: number | null) => void

  // Timeline management
  updateTimeline: (updates: Partial<EpisodeTimeline>) => void
  saveTimeline: () => Promise<void>

  // Playback controls
  setCurrentTime: (time: number) => void
  setPlaying: (playing: boolean) => void
  play: () => void
  pause: () => void
  seekTo: (time: number) => void

  // Render jobs
  renderEpisode: (renderId: string) => Promise<void>
  cancelRender: (renderId: string) => Promise<void>

  // Scoring
  getScore: () => Promise<StudioScore>

  // Publishing
  publishToYouTube: (episodeId: string, title: string, description: string, tags: string[], visibility: 'private' | 'public' | 'unlisted') => Promise<void>
  publishToTikTok: (episodeId: string, title: string, description: string) => Promise<void>
  publishToInstagram: (episodeId: string, title: string, description: string) => Promise<void>
}

export const useStudioStore = create<StudioStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      episode: null,
      isLoading: false,
      error: null,
      selectedSceneId: null,
      currentTime: 0,
      isPlaying: false,
      selectedCaptionIndex: null,

      // Basic setters
      setEpisode: (episode) => set({ episode }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),

      // Scene management
      selectScene: (sceneId) => set({ selectedSceneId: sceneId }),
      updateScene: (sceneId, updates) => {
        const episode = get().episode
        if (!episode) return

        const updatedScenes = episode.scenes.map(scene =>
          scene.id === sceneId ? { ...scene, ...updates } : scene
        )

        set({
          episode: { ...episode, scenes: updatedScenes },
          currentTime: updates.start || get().currentTime
        })
      },

      regenerateScene: async (sceneId) => {
        const episode = get().episode
        if (!episode) return

        set({ isLoading: true, error: null })

        try {
          const response = await fetch(`/api/generate/scene`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              episode_id: episode.id,
              scene_id: sceneId,
            }),
          })

          if (!response.ok) {
            throw new Error('Failed to regenerate scene')
          }

          const result = await response.json()

          // Update the scene with new data
          const updatedScenes = episode.scenes.map(scene =>
            scene.id === sceneId ? { ...scene, ...result.scene } : scene
          )

          set({ episode: { ...episode, scenes: updatedScenes } })
        } catch (error: any) {
          set({ error: error.message })
        } finally {
          set({ isLoading: false })
        }
      },

      addScene: (scene) => {
        const episode = get().episode
        if (!episode) return

        const newScene: SceneClip = {
          ...scene,
          id: crypto.randomUUID(),
        }

        set({
          episode: {
            ...episode,
            scenes: [...episode.scenes, newScene]
          }
        })
      },

      removeScene: (sceneId) => {
        const episode = get().episode
        if (!episode) return

        set({
          episode: {
            ...episode,
            scenes: episode.scenes.filter(scene => scene.id !== sceneId)
          }
        })
      },

      // Caption management
      updateCaption: (index, updates) => {
        const episode = get().episode
        if (!episode) return

        const updatedCaptions = episode.timeline.captions.map((caption, i) =>
          i === index ? { ...caption, ...updates } : caption
        )

        set({
          episode: {
            ...episode,
            timeline: { ...episode.timeline, captions: updatedCaptions }
          }
        })
      },

      addCaption: (caption) => {
        const episode = get().episode
        if (!episode) return

        const newCaption: CaptionItem = {
          ...caption,
          position: caption.position || [50, 80], // Default position near bottom
        }

        set({
          episode: {
            ...episode,
            timeline: {
              ...episode.timeline,
              captions: [...episode.timeline.captions, newCaption]
            }
          }
        })
      },

      removeCaption: (index) => {
        const episode = get().episode
        if (!episode) return

        set({
          episode: {
            ...episode,
            timeline: {
              ...episode.timeline,
              captions: episode.timeline.captions.filter((_, i) => i !== index)
            }
          }
        })
      },

      selectCaption: (index) => set({ selectedCaptionIndex: index }),

      // Timeline management
      updateTimeline: (updates) => {
        const episode = get().episode
        if (!episode) return

        set({
          episode: {
            ...episode,
            timeline: { ...episode.timeline, ...updates }
          }
        })
      },

      saveTimeline: async () => {
        const episode = get().episode
        if (!episode) return

        set({ isLoading: true, error: null })

        try {
          const response = await fetch(`/api/episodes/${episode.id}/timeline`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timeline: episode.timeline }),
          })

          if (!response.ok) {
            throw new Error('Failed to save timeline')
          }
        } catch (error: any) {
          set({ error: error.message })
        } finally {
          set({ isLoading: false })
        }
      },

      // Playback controls
      setCurrentTime: (time) => set({ currentTime: time }),
      setPlaying: (playing) => set({ isPlaying: playing }),
      play: () => set({ isPlaying: true }),
      pause: () => set({ isPlaying: false }),
      seekTo: (time) => set({ currentTime: time }),

      // Render jobs
      renderEpisode: async (renderId) => {
        set({ isLoading: true, error: null })

        try {
          const response = await fetch('/api/render/episode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ render_id: renderId }),
          })

          if (!response.ok) {
            throw new Error('Failed to start render')
          }

          const result = await response.json()
          console.log('Render job created:', result.jobId)
        } catch (error: any) {
          set({ error: error.message })
        } finally {
          set({ isLoading: false })
        }
      },

      cancelRender: async (renderId) => {
        set({ isLoading: true, error: null })

        try {
          const response = await fetch(`/api/render/${renderId}/cancel`, {
            method: 'POST',
          })

          if (!response.ok) {
            throw new Error('Failed to cancel render')
          }
        } catch (error: any) {
          set({ error: error.message })
        } finally {
          set({ isLoading: false })
        }
      },

      // Scoring
      getScore: async (): Promise<StudioScore> => {
        const episode = get().episode
        if (!episode) throw new Error('No episode loaded')

        set({ isLoading: true, error: null })

        try {
          const response = await fetch(`/api/score/episode/${episode.id}`)

          if (!response.ok) {
            throw new Error('Failed to get score')
          }

          const score = await response.json()
          return score
        } catch (error: any) {
          set({ error: error.message })
          throw error
        } finally {
          set({ isLoading: false })
        }
      },

      // Publishing
      publishToYouTube: async (episodeId, title, description, tags, visibility) => {
        set({ isLoading: true, error: null })

        try {
          const response = await fetch('/api/publish/youtube', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              episode_id: episodeId,
              title,
              description,
              tags,
              visibility,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to publish to YouTube')
          }

          const result = await response.json()
          console.log('Published to YouTube:', result.videoUrl)
          alert('Successfully published to YouTube!')
        } catch (error: any) {
          set({ error: error.message })
          throw error
        } finally {
          set({ isLoading: false })
        }
      },

      publishToTikTok: async (episodeId, title, description) => {
        set({ isLoading: true, error: null })

        try {
          const response = await fetch('/api/publish/tiktok', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              episode_id: episodeId,
              title,
              description,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to publish to TikTok')
          }

          const result = await response.json()
          console.log('Published to TikTok:', result.url)
          alert('Successfully published to TikTok!')
        } catch (error: any) {
          set({ error: error.message })
          throw error
        } finally {
          set({ isLoading: false })
        }
      },

      publishToInstagram: async (episodeId, title, description) => {
        set({ isLoading: true, error: null })

        try {
          const response = await fetch('/api/publish/instagram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              episode_id: episodeId,
              title,
              description,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to publish to Instagram')
          }

          const result = await response.json()
          console.log('Published to Instagram:', result.url)
          alert('Successfully published to Instagram!')
        } catch (error: any) {
          set({ error: error.message })
          throw error
        } finally {
          set({ isLoading: false })
        }
      },
    }),
    { name: 'studio-store' }
  )
)
