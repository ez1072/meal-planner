'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import AddRecipeModal from '@/components/recipes/AddRecipeModal'
import { Clock, ChefHat, Plus, Search, UtensilsCrossed } from 'lucide-react'
import Link from 'next/link'
import { CUISINES, MAIN_INGREDIENTS, DIFFICULTIES, cn } from '@/lib/utils'

interface Recipe {
  id: string
  name: string
  image_url: string | null
  cuisine: string | null
  main_ingredient: string | null
  difficulty: string | null
  time_minutes: number | null
}

const TIME_OPTIONS = [
  { label: 'Under 30 min', value: 'under30' },
  { label: '30–60 min', value: '30to60' },
  { label: 'Over 60 min', value: 'over60' },
]

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [filterCuisines, setFilterCuisines] = useState<string[]>([])
  const [filterIngredients, setFilterIngredients] = useState<string[]>([])
  const [filterDifficulty, setFilterDifficulty] = useState<string[]>([])
  const [filterTime, setFilterTime] = useState('')

  const fetchRecipes = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('recipes')
      .select('id,name,image_url,cuisine,main_ingredient,difficulty,time_minutes')
      .order('created_at', { ascending: false })
    setRecipes(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchRecipes() }, [fetchRecipes])

  function toggleChip(arr: string[], val: string): string[] {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
  }

  const filtered = recipes.filter(r => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterCuisines.length && !filterCuisines.includes(r.cuisine ?? '')) return false
    if (filterIngredients.length && !filterIngredients.includes(r.main_ingredient ?? '')) return false
    if (filterDifficulty.length && !filterDifficulty.includes(r.difficulty ?? '')) return false
    if (filterTime) {
      const t = r.time_minutes ?? 0
      if (filterTime === 'under30' && t >= 30) return false
      if (filterTime === '30to60' && (t < 30 || t > 60)) return false
      if (filterTime === 'over60' && t <= 60) return false
    }
    return true
  })

  const chipBase = 'px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer select-none'
  const chipActive = 'bg-[#E07B39] border-[#E07B39] text-white'
  const chipInactive = 'bg-white border-gray-200 text-gray-600 hover:border-[#E07B39] hover:text-[#E07B39]'

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Recipes</h1>
        <Button onClick={() => setShowAdd(true)}>
          <Plus size={16} /> Add Recipe
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E07B39] bg-white"
          placeholder="Search recipes..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6 space-y-3">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cuisine</p>
          <div className="flex flex-wrap gap-2">
            {CUISINES.map(c => (
              <button key={c} className={cn(chipBase, filterCuisines.includes(c) ? chipActive : chipInactive)} onClick={() => setFilterCuisines(prev => toggleChip(prev, c))}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Main Ingredient</p>
          <div className="flex flex-wrap gap-2">
            {MAIN_INGREDIENTS.map(m => (
              <button key={m} className={cn(chipBase, filterIngredients.includes(m) ? chipActive : chipInactive)} onClick={() => setFilterIngredients(prev => toggleChip(prev, m))}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Difficulty</p>
            <div className="flex gap-2">
              {DIFFICULTIES.map(d => (
                <button key={d} className={cn(chipBase, filterDifficulty.includes(d) ? chipActive : chipInactive)} onClick={() => setFilterDifficulty(prev => toggleChip(prev, d))}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Time</p>
            <div className="flex gap-2">
              {TIME_OPTIONS.map(o => (
                <button key={o.value} className={cn(chipBase, filterTime === o.value ? chipActive : chipInactive)} onClick={() => setFilterTime(prev => prev === o.value ? '' : o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {(filterCuisines.length || filterIngredients.length || filterDifficulty.length || filterTime) ? (
          <button className="text-xs text-gray-400 hover:text-gray-600 underline" onClick={() => { setFilterCuisines([]); setFilterIngredients([]); setFilterDifficulty([]); setFilterTime('') }}>
            Clear all filters
          </button>
        ) : null}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl overflow-hidden border border-gray-100 animate-pulse">
              <div className="h-44 bg-gray-100" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-100 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <UtensilsCrossed size={40} className="text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No recipes found</p>
          <p className="text-gray-400 text-sm mt-1">Try adjusting your filters or add a new recipe</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(recipe => (
            <Link key={recipe.id} href={`/recipes/${recipe.id}`} className="group bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="h-44 bg-gray-100 relative overflow-hidden">
                {recipe.image_url ? (
                  <img src={recipe.image_url} alt={recipe.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-orange-50">
                    <ChefHat size={36} className="text-orange-200" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-2 line-clamp-2">{recipe.name}</h3>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {recipe.cuisine && <Badge label={recipe.cuisine} />}
                  {recipe.difficulty && <Badge label={recipe.difficulty} />}
                </div>
                {recipe.time_minutes && (
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock size={12} />
                    {recipe.time_minutes} min
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <AddRecipeModal open={showAdd} onClose={() => setShowAdd(false)} onSaved={fetchRecipes} />
    </div>
  )
}
