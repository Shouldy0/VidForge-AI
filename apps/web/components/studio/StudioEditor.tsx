'use client'

import React, { useEffect } from 'react'
import { useStudioStore } from '../../lib/studio-store'
import { SceneTimeline } from './SceneTimeline'
import { ScenePreview } from './ScenePreview'
import { CaptionEditor } from './CaptionEditor'
import { ActionButtons } from './ActionButtons'
import { StatusPanel } from './StatusPanel'
import { StudioEpisode } from '@vidforge/shared'

interface StudioEditorProps {
  initialEpisode: StudioEpisode
}

export function StudioEditor({ initialEpisode }: StudioEditorProps) {
  const { setEpisode, setLoading } = useStudioStore()

  useEffect(() => {
    // Initialize the store with the server-loaded episode data
    setEpisode(initialEpisode)
    setLoading(false)
  }, [initialEpisode, setEpisode, setLoading])

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Studio Editor - {initialEpisode.title}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Series: {initialEpisode.series?.title || 'Unassigned'}
            </p>
          </div>
          <StatusPanel />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - Preview & Controls */}
        <div className="w-96 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
          <ScenePreview />
          <ActionButtons />
        </div>

        {/* Center - Timeline */}
        <div className="flex-1 flex flex-col">
          <SceneTimeline />
          <CaptionEditor />
        </div>

        {/* Right panel - Asset browser (placeholder) */}
        <div className="w-80 flex-shrink-0 bg-white border-l border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Assets</h3>
          <div className="space-y-2">
            {initialEpisode.assets.map(asset => (
              <div key={asset.id} className="p-2 border border-gray-200 rounded">
                <div className="text-sm font-medium">{asset.type}</div>
                <div className="text-xs text-gray-500 truncate">{asset.src}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
