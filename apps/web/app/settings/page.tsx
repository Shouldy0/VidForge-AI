import { requireUser } from '../../lib/supabase'

export default async function SettingsPage() {
  const profile = await requireUser()

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <p>Settings for {profile.display_name}</p>
      <p>Role: {profile.role}</p>
      {/* Add settings form/content */}
    </div>
  )
}
