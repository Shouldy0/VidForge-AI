import { requireUser } from '../../lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { CalendarView } from '../../components/CalendarView'

export default async function DashboardPage() {
  const profile = await requireUser()

  // Create Supabase client for server-side data fetching
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  // Fetch dashboard data
  const [episodesResult, analyticsResult] = await Promise.all([
    supabase
      .from('episodes')
      .select('id, title, status, created_at, series(title)')
      .eq('series.user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10),

    supabase
      .from('analytics')
      .select('views, retention03, completion_pct, ctr_thumb, collected_at, episode_id')
      .eq('episodes.series.user_id', profile.id)
      .lte('collected_at', new Date().toISOString().split('T')[0])
      .gte('collected_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('collected_at', { ascending: true })
  ])

  const episodes = episodesResult.data || []
  const analytics = analyticsResult.data || []

  // Process analytics data for charts
  const viewsByDate = analytics.reduce((acc: any[], row) => {
    const date = new Date(row.collected_at).toLocaleDateString()
    const existing = acc.find(item => item.date === date)
    if (existing) {
      existing.views += row.views
      existing.retention += (row.retention03 * 100)
      existing.completion += (row.completion_pct * 100)
      existing.count++
    } else {
      acc.push({
        date,
        views: row.views,
        retention: (row.retention03 * 100),
        completion: (row.completion_pct * 100),
        count: 1
      })
    }
    return acc
  }, [])

  // Calculate averages
  const processedViews = viewsByDate.map(item => ({
    ...item,
    retention: item.retention / item.count,
    completion: item.completion / item.count
  }))

  // Status distribution
  const statusData = episodes.reduce((acc: any[], episode) => {
    const existing = acc.find(item => item.status === episode.status)
    if (existing) {
      existing.count++
    } else {
      acc.push({ status: episode.status, count: 1 })
    }
    return acc
  }, [])

  const statusColors = {
    'draft': '#8884d8',
    'rendering': '#82ca9d',
    'published': '#ffc658',
    'completed': '#ff7c7c'
  }

  const totalViews = analytics.reduce((sum, row) => sum + (row.views || 0), 0)
  const avgRetention = analytics.length > 0
    ? analytics.reduce((sum, row) => sum + (row.retention03 || 0), 0) / analytics.length
    : 0
  const avgCompletion = analytics.length > 0
    ? analytics.reduce((sum, row) => sum + (row.completion_pct || 0), 0) / analytics.length
    : 0

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="text-sm text-muted-foreground">
          Welcome, {profile.display_name} ({profile.role})
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-muted-foreground">Total Episodes</h3>
          <p className="text-3xl font-bold">{episodes.length}</p>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-muted-foreground">Total Views (30d)</h3>
          <p className="text-3xl font-bold">{totalViews.toLocaleString()}</p>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-muted-foreground">Avg Retention</h3>
          <p className="text-3xl font-bold">{(avgRetention * 100).toFixed(1)}%</p>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-muted-foreground">Avg Completion</h3>
          <p className="text-3xl font-bold">{(avgCompletion * 100).toFixed(1)}%</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Views Over Time */}
        <div className="bg-card p-4 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Views & Performance Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={processedViews}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="views"
                stroke="#8884d8"
                strokeWidth={2}
                name="Views"
              />
              <Line
                type="monotone"
                dataKey="retention"
                stroke="#82ca9d"
                strokeWidth={2}
                name="Retention %"
              />
              <Line
                type="monotone"
                dataKey="completion"
                stroke="#ffc658"
                strokeWidth={2}
                name="Completion %"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Episode Status Distribution */}
        <div className="bg-card p-4 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Episode Status Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ status, count }) => `${status}: ${count}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={statusColors[entry.status] || '#8884d8'} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Episodes */}
      <div className="bg-card p-4 rounded-lg border">
        <h3 className="text-lg font-semibold mb-4">Recent Episodes</h3>
        <div className="space-y-3">
          {episodes.slice(0, 5).map((episode) => (
            <div key={episode.id} className="flex justify-between items-center p-3 border rounded">
              <div>
                <p className="font-medium">{episode.title}</p>
                <p className="text-sm text-muted-foreground">
                  {episode.series.title} • {new Date(episode.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <span className={`px-2 py-1 text-xs rounded-full ${
                  episode.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                  episode.status === 'rendering' ? 'bg-blue-100 text-blue-800' :
                  episode.status === 'published' ? 'bg-green-100 text-green-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {episode.status}
                </span>
              </div>
            </div>
          ))}
          {episodes.length === 0 && (
            <p className="text-muted-foreground text-center py-8">No episodes found. Create your first episode to get started!</p>
          )}
        </div>
      </div>
    </div>
  )
}
