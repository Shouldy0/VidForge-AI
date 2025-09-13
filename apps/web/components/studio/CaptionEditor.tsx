'use client'

import React from 'react'
import { useStudioStore } from '../../lib/studio-store'
import { Save, Plus, X } from 'lucide-react'

export function CaptionEditor() {
  const {
    episode,
    selectedCaptionIndex,
    selectCaption,
    updateCaption,
    addCaption,
    removeCaption,
    saveTimeline
  } = useStudioStore()

  if (!episode) return null

  const selectedCaption = selectedCaptionIndex !== null ? episode.timeline.captions[selectedCaptionIndex] : null

  const handleCaptionChange = (field: string, value: string | number) => {
    if (selectedCaptionIndex === null) return

    if (field === 'text') {
      updateCaption(selectedCaptionIndex, { text: value as string })
    } else if (field === 'start') {
      updateCaption(selectedCaptionIndex, { start: parseFloat(value as string) || 0 })
    } else if (field === 'end') {
      updateCaption(selectedCaptionIndex, { end: parseFloat(value as string) || 0 })
    }
  }

  const handleAddCaption = () => {
    const currentTime = useStudioStore.getState().currentTime
    addCaption({
      start: currentTime,
      end: currentTime + 3,
      text: 'New caption text',
      position: [50, 85], // Default position before save
      style: {
        fontSize: 16,
        color: '#ffffff'
      }
    })

    // Select the newly added caption
    const newIndex = episode.timeline.captions.length
    selectCaption(newIndex)
  }

  const handleSave = async () => {
    try {
      await saveTimeline()
      alert('Captions saved successfully!')
    } catch (error) {
      console.error('Failed to save captions:', error)
      alert('Failed to save captions')
    }
  }

  return (
    <div className="flex-shrink-0 bg-white border-t border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Caption Editor</h3>
        <div className="flex gap-2">
          <button
            onClick={handleAddCaption}
            className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <Plus className="w-4 h-4 inline mr-1" />
            Add
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Save className="w-4 h-4 inline mr-1" />
            Save
          </button>
        </div>
      </div>

      {/* Caption List */}
      <div className="mb-4">
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {episode.timeline.captions.map((caption, index) => (
            <div
              key={index}
              className={`p-2 rounded cursor-pointer ${
                selectedCaptionIndex === index
                  ? 'bg-blue-100 border-blue-200'
                  : 'bg-gray-50 hover:bg-gray-100'
              }`}
              onClick={() => selectCaption(index)}
            >
              <div className="text-xs text-gray-500">
                {caption.start.toFixed(1)}s - {caption.end.toFixed(1)}s
              </div>
              <div className="text-sm truncate">{caption.text}</div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeCaption(index)
                }}
                className="float-right text-red-500 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Caption Editor */}
      {selectedCaption && (
        <div className="space-y-3 border-t border-gray-200 pt-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time (seconds)
              </label>
              <input
                type="number"
                step="0.1"
                value={selectedCaption.start}
                onChange={(e) => handleCaptionChange('start', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Time (seconds)
              </label>
              <input
                type="number"
                step="0.1"
                value={selectedCaption.end}
                onChange={(e) => handleCaptionChange('end', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Caption Text
            </label>
            <textarea
              value={selectedCaption.text}
              onChange={(e) => handleCaptionChange('text', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              rows={3}
              placeholder="Enter caption text..."
            />
          </div>
        </div>
      )}
    </div>
  )
}
