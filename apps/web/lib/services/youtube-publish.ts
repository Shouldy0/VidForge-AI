// YouTube Publishing Service
// Client-side functions for interacting with YouTube publishing API

export interface YouTubePublishParams {
  episode_id: string
  title: string
  description?: string
  tags?: string[]
  visibility?: 'private' | 'public' | 'unlisted'
}

export interface YouTubePublishResponse {
  success: boolean
  videoId?: string
  videoUrl?: string
  message?: string
  error?: string
}

export interface YouTubePublishStatus {
  published: boolean
  videoId?: string
  videoUrl?: string
  publishedAt?: string
  error?: string
}

/**
 * Publish an episode to YouTube
 */
export async function publishToYouTube(params: YouTubePublishParams): Promise<YouTubePublishResponse> {
  try {
    const response = await fetch('/api/publish/youtube', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        episode_id: params.episode_id,
        title: params.title,
        description: params.description || '',
        tags: params.tags || [],
        visibility: params.visibility || 'private',
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to publish to YouTube')
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('YouTube publish error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Check if an episode has already been published to YouTube
 */
export async function checkYouTubePublishStatus(episodeId: string): Promise<YouTubePublishStatus> {
  try {
    const response = await fetch(`/api/publish/youtube?episode_id=${episodeId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        published: false,
        error: errorData.error || 'Failed to check publish status'
      }
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Check YouTube publish status error:', error)
    return {
      published: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

// React hooks for easy integration
import { useState, useCallback } from 'react'

/**
 * React hook for managing YouTube publish state
 */
export function useYouTubePublish() {
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishStatus, setPublishStatus] = useState<YouTubePublishStatus | null>(null)

  const publish = useCallback(async (params: YouTubePublishParams) => {
    setIsPublishing(true)
    try {
      const result = await publishToYouTube(params)
      setPublishStatus({ published: result.success, ...result })
      return result
    } finally {
      setIsPublishing(false)
    }
  }, [])

  const checkStatus = useCallback(async (episodeId: string) => {
    const status = await checkYouTubePublishStatus(episodeId)
    setPublishStatus(status)
    return status
  }, [])

  return {
    publish,
    checkStatus,
    isPublishing,
    publishStatus,
    resetPublishStatus: () => setPublishStatus(null),
  }
}

// Example usage component (for documentation)
export const YouTubePublishExample = () => {
  return null
}

/*
Example usage:

import { useYouTubePublish } from '@/lib/services/youtube-publish'

function MyComponent({ episodeId }: { episodeId: string }) {
  const { publish, isPublishing, publishStatus } = useYouTubePublish()

  const handlePublish = async () => {
    const result = await publish({
      episode_id: episodeId,
      title: 'My Episode Title',
      description: 'Episode description',
      tags: ['tag1', 'tag2'],
      visibility: 'public',
    })

    if (result.success) {
      console.log('Published:', result.videoUrl)
    } else {
      console.error('Failed:', result.error)
    }
  }

  return (
    <div>
      {publishStatus?.published ? (
        <a href={publishStatus.videoUrl} target="_blank">
          View on YouTube
        </a>
      ) : (
        <button onClick={handlePublish} disabled={isPublishing}>
          {isPublishing ? 'Publishing...' : 'Publish to YouTube'}
        </button>
      )}
    </div>
  )
}
*/
