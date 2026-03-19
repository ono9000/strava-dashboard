import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('users')
    .select('name')
    .eq('id', user?.id ?? '')
    .single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Good morning{profile?.name ? `, ${profile.name}` : ''}.
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Your wardrobe is ready. Start by adding your first item.
        </p>
      </div>
      <div className="rounded-xl border border-dashed border-gray-300 p-16 text-center">
        <p className="text-sm text-gray-400">
          Clothing inventory coming in Plan 2.
        </p>
      </div>
    </div>
  )
}
