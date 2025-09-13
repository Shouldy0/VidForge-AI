'use client'

import { useState } from 'react'
import { createClientComponentClient } from '../../lib/supabase'
import { MusicTrack } from '../../../../packages/shared/src/types'

interface MusicTracksManagerProps {
  tracks: MusicTrack[]
}

export default function MusicTracksManager({ tracks }: MusicTracksManagerProps) {
  const [localTracks, setLocalTracks] = useState<MusicTrack[]>(tracks)
  const [isAdding, setIsAdding] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    bpm: '',
    license_id: '',
    url: '',
    allowlist: false
  })

  const supabase = createClientComponentClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { data, error } = await supabase.from('music_tracks').insert({
        ...formData,
        bpm: formData.bpm ? parseInt(formData.bpm) : null,
        allowlist: formData.allowlist
      }).select()

      if (error) throw error

      setLocalTracks([data[0], ...localTracks])
      setFormData({ title: '', bpm: '', license_id: '', url: '', allowlist: false })
      setIsAdding(false)
    } catch (error) {
      alert('Error adding track: ' + (error as Error).message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this track?')) return

    try {
      const { error } = await supabase.from('music_tracks').delete().eq('id', id)
      if (error) throw error
      setLocalTracks(localTracks.filter(track => track.id !== id))
    } catch (error) {
      alert('Error deleting track: ' + (error as Error).message)
    }
  }

  const toggleAllowlist = async (track: MusicTrack) => {
    try {
      const { error } = await supabase
        .from('music_tracks')
        .update({ allowlist: !track.allowlist })
        .eq('id', track.id)

      if (error) throw error

      setLocalTracks(localTracks.map(t =>
        t.id === track.id ? { ...t, allowlist: !t.allowlist } : t
      ))
    } catch (error) {
      alert('Error updating allowlist: ' + (error as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Your Music Tracks</h2>
        <button
          onClick={() => setIsAdding(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Add Track
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-gray-100 p-4 rounded-lg">
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="w-full p-2 border rounded"
            />
            <input
              type="number"
              placeholder="BPM"
              value={formData.bpm}
              onChange={(e) => setFormData({ ...formData, bpm: e.target.value })}
              className="w-full p-2 border rounded"
            />
            <input
              type="text"
              placeholder="License ID"
              value={formData.license_id}
              onChange={(e) => setFormData({ ...formData, license_id: e.target.value })}
              className="w-full p-2 border rounded"
            />
            <input
              type="url"
              placeholder="URL"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              required
              className="w-full p-2 border rounded"
            />
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.allowlist}
                onChange={(e) => setFormData({ ...formData, allowlist: e.target.checked })}
                className="mr-2"
              />
              Allowlist
            </label>
          </div>
          <div className="flex gap-2 mt-2">
            <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded">
              Add Track
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="bg-gray-500 text-white px-4 py-2 rounded"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {localTracks.length === 0 ? (
          <p className="text-gray-500">No music tracks yet. Add one above.</p>
        ) : (
          localTracks.map((track) => (
            <div key={track.id} className="bg-white border rounded-lg p-4 flex justify-between items-center">
              <div>
                <h3 className="font-semibold">{track.title}</h3>
                <p className="text-sm text-gray-600">BPM: {track.bpm || 'N/A'} | License: {track.license_id || 'N/A'}</p>
                <p className="text-sm text-gray-600">{track.url} {track.allowlist && '✓ Allowlisted'}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleAllowlist(track)}
                  className={`${track.allowlist ? 'bg-green-500' : 'bg-gray-500'} text-white px-3 py-1 rounded`}
                >
                  {track.allowlist ? 'Allowlisted' : 'Block'}
                </button>
                <button
                  onClick={() => handleDelete(track.id)}
                  className="bg-red-500 text-white px-3 py-1 rounded"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
