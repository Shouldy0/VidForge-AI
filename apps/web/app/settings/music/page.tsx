import { requireUser } from '../../../lib/supabase'
import { createServerComponentClient } from '../../../lib/supabase'
import MusicTracksManager from '../../../components/settings/MusicTracksManager'

export default async function MusicPage() {
  const profile = await requireUser()
  const supabase = createServerComponentClient()

  // Fetch tracks from database
  const { data: tracks } = await supabase
    .from('music_tracks')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Music Tracks</h1>
      <MusicTracksManager tracks={tracks || []} />
    </div>
  )
}
