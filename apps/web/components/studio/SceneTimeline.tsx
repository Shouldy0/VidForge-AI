'use client'

import React from 'react'
import { useStudioStore } from '../../lib/studio-store'

export function SceneTimeline() {
  const { episode, selectedSceneId, selectScene } = useStudioStore()

  if (!episode) return null

  return (
    <div className="flex-1 bg-white p-4">
      <h3 className="font-semibold text-gray-900 mb-4">Timeline</h3>

      <div className="space-y-2">
        {/* Timeline Header */}
        <div className="flex items-center border-b border-gray-200 pb-2">
          <div className="w-24 text-sm font-medium text-gray-500">Time</div>
          <div className="flex-1 text-sm font-medium text-gray-500">Scene</div>
          <div className="w-32 text-sm font-medium text-gray-500">Type</div>
        </div>

        {/* Scenes */}
        {episode.scenes.map((scene, index) => (
          <div
            key={scene.id}
            className={`flex items-center p-3 rounded cursor-pointer ${
              selectedSceneId === scene.id
                ? 'bg-blue-100 border border-blue-200'
                : 'hover:bg-gray-50'
            }`}
            onClick={() => selectScene(scene.id)}
          >
            <div className="w-24 text-sm text-gray-600">
              {scene.start.toFixed(1)}s - {scene.end.toFixed(1)}s
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">
                Scene {index + 1}
              </div>
              {scene.editableText && (
                <div className="text-xs text-gray-600 truncate">
                  {scene.editableText}
                </div>
              )}
            </div>
            <div className="w-32">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                scene.type === 'visual' ? 'bg-green-100 text-green-800' :
                scene.type === 'audio' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {scene.type}
              </span>
            </div>
          </div>
        ))}

        {episode.scenes.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            No scenes generated yet. Generate an episode to get started.
          </div>
        )}
      </div>
    </div>
  )
}
