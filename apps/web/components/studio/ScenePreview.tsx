'use client'

import React from 'react'
import { useStudioStore } from '../../lib/studio-store'

export function ScenePreview() {
  const { episode, selectedSceneId, currentTime } = useStudioStore()

  if (!episode) return null

  const selectedScene = selectedSceneId
    ? episode.scenes.find(scene => scene.id === selectedSceneId)
    : null

  return (
    <div className="p-4">
      <h3 className="font-semibold text-gray-900 mb-4">Preview</h3>

      {/* Video Preview Area */}
      <div className="aspect-video bg-black rounded-lg mb-4 flex items-center justify-center">
        {selectedScene?.signedUrl ? (
          <video
            key={selectedScene.id} // Force re-render when scene changes
            src={selectedScene.signedUrl}
            poster={selectedScene.type === 'image' ? selectedScene.signedUrl : undefined}
            controls
            className="w-full h-full rounded-lg"
          />
        ) : (
          <div className="text-white text-center">
            <div className="text-lg mb-2">
              {selectedScene ? `Scene ${episode.scenes.indexOf(selectedScene) + 1}` : 'No scene selected'}
            </div>
            <div className="text-sm opacity-75">
              {selectedScene ? `Type: ${selectedScene.type}` : 'Select a scene to preview'}
            </div>
          </div>
        )}
      </div>

      {/* Scene Info */}
      {selectedScene && (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Duration:</span>
            <span className="text-gray-900">{selectedScene.duration.toFixed(2)}s</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Type:</span>
            <span className="text-gray-900 capitalize">{selectedScene.type}</span>
          </div>
          {selectedScene.prompt && (
            <div>
              <span className="text-gray-600">Prompt:</span>
              <div className="text-gray-900 mt-1 text-xs break-words">
                {selectedScene.prompt}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Timeline Position */}
      <div className="mt-4">
        <div className="text-xs text-gray-500 mb-2">
          Current Time: {currentTime.toFixed(1)}s / {episode.duration.toFixed(1)}s
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-200"
            style={{ width: `${(currentTime / episode.duration) * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}
