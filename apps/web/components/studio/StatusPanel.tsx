'use client'

import React from 'react'
import { useStudioStore } from '../../lib/studio-store'
import { CheckCircle, Clock, AlertTriangle, Loader } from 'lucide-react'

export function StatusPanel() {
  const { episode, isLoading, error } = useStudioStore()

  if (!episode) return null

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'processing':
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />
      case 'failed':
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      default:
        return <Loader className="w-4 h-4 text-blue-500 animate-spin" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed'
      case 'processing':
        return 'Processing'
      case 'pending':
        return 'Pending'
      case 'failed':
        return 'Failed'
      default:
        return 'Unknown'
    }
  }

  return (
    <div className="flex items-center gap-4">
      {/* Episode Status */}
      <div className="flex items-center gap-2 text-sm">
        {getStatusIcon(episode.status)}
        <span className="text-gray-600">Episode:</span>
        <span className="font-medium capitalize">{episode.status}</span>
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-blue-600">
          <Loader className="w-4 h-4 animate-spin" />
          <span>Loading...</span>
        </div>
      )}

      {/* Error Indicator */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertTriangle className="w-4 h-4" />
          <span>Error</span>
        </div>
      )}

      {/* Scene Count */}
      <div className="text-sm text-gray-600">
        Scenes: {episode.scenes.length}
      </div>

      {/* Duration */}
      <div className="text-sm text-gray-600">
        Duration: {episode.duration.toFixed(1)}s
      </div>
    </div>
  )
}
