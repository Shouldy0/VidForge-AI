'use client'

import React from 'react'
import { useStudioStore } from '../../lib/studio-store'
import { Play, Pause, RotateCcw, PlaySquare, BarChart3, Send, Youtube } from 'lucide-react'

export function ActionButtons() {
  const { isPlaying, regenerateScene, renderEpisode, getScore, episode, publishToTikTok, publishToInstagram } = useStudioStore()

  return (
    <div className="border-t border-gray-200 p-4 space-y-3">
      <h3 className="font-semibold text-gray-900 text-sm">Actions</h3>

      {/* Playback Controls */}
      <div className="flex gap-2">
        <button
          className="flex-1 bg-blue-500 text-white px-3 py-2 rounded text-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onClick={() => {
            // Toggle play/pause
            const store = useStudioStore.getState()
            if (store.isPlaying) {
              store.pause()
            } else {
              store.play()
            }
          }}
        >
          {isPlaying ? <Pause className="w-4 h-4 inline mr-1" /> : <Play className="w-4 h-4 inline mr-1" />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button
          className="px-3 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
          onClick={() => {
            const store = useStudioStore.getState()
            store.seekTo(0)
          }}
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Scene Regeneration */}
      <button
        className="w-full bg-green-500 text-white px-3 py-2 rounded text-sm hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500"
        onClick={async () => {
          const store = useStudioStore.getState()
          const selectedSceneId = store.selectedSceneId

          if (!selectedSceneId) {
            alert('Please select a scene to regenerate')
            return
          }

          try {
            await store.regenerateScene(selectedSceneId)
            console.log('Scene regenerated successfully')
          } catch (error) {
            console.error('Failed to regenerate scene:', error)
            alert('Failed to regenerate scene')
          }
        }}
      >
        <RotateCcw className="w-4 h-4 inline mr-2" />
        Regenerate Scene
      </button>

      {/* Render Episode */}
      <button
        className="w-full bg-purple-500 text-white px-3 py-2 rounded text-sm hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
        onClick={async () => {
          if (!episode) {
            alert('No episode loaded')
            return
          }

          try {
            await renderEpisode(episode.id)
            alert('Render job has been queued')
          } catch (error) {
            console.error('Failed to start render:', error)
            alert('Failed to start render job')
          }
        }}
      >
        <PlaySquare className="w-4 h-4 inline mr-2" />
        Render Episode
      </button>

      {/* Score & Feedback */}
      <button
        className="w-full bg-orange-500 text-white px-3 py-2 rounded text-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
        onClick={async () => {
          try {
            const score = await getScore()
            alert(`Score: ${score.overall}/100\n\nRecommendations:\n${score.recommendations.join('\n')}`)
          } catch (error) {
            console.error('Failed to get score:', error)
            alert('Failed to get score')
          }
        }}
      >
        <BarChart3 className="w-4 h-4 inline mr-2" />
        Get Score & Tips
      </button>

      {/* Publishing Section */}
      <div className="space-y-2">
        <h4 className="font-medium text-gray-900 text-sm">Publish to Social Media</h4>

        {/* Publish to TikTok */}
        <button
          className="w-full bg-black text-white px-3 py-2 rounded text-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black"
          onClick={async () => {
            if (!episode) {
              alert('No episode loaded')
              return
            }

            try {
              await publishToTikTok(episode.id, episode.title, episode.title)
            } catch (error) {
              console.error('Failed to publish to TikTok:', error)
              alert(`Failed to publish to TikTok: ${error.message}`)
            }
          }}
        >
          <Send className="w-4 h-4 inline mr-2" />
          Publish to TikTok
        </button>

        {/* Publish to Instagram */}
        <button
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-2 rounded text-sm hover:from-purple-600 hover:to-pink-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
          onClick={async () => {
            if (!episode) {
              alert('No episode loaded')
              return
            }

            try {
              await publishToInstagram(episode.id, episode.title, episode.title)
            } catch (error) {
              console.error('Failed to publish to Instagram:', error)
              alert(`Failed to publish to Instagram: ${error.message}`)
            }
          }}
        >
          <Send className="w-4 h-4 inline mr-2" />
          Publish to Instagram
        </button>
      </div>
    </div>
  )
}
