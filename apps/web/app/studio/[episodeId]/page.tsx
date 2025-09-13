import { loadEpisode } from './loader'
import { StudioEditor } from '../../../components/studio/StudioEditor'

export default async function StudioPage({
  params
}: {
  params: { episodeId: string }
}) {
  // Load episode data securely with RLS using server components
  const episode = await loadEpisode(params.episodeId)

  return <StudioEditor initialEpisode={episode} />
}
