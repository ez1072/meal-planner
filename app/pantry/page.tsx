'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronRight, Loader2, ShoppingBasket, Lightbulb
} from 'lucide-react'
import { PANTRY_CATEGORIES } from '@/lib/utils'
import Link from 'next/link'

interface PantryItem {
  id: string
  item_name: string
  quantity: string | null
  unit: string | null
  category: string | null
}

interface RecipeMatch {
  id: string
  name: string
  image_url: string | null
  matchPct: number
  matched: string[]
  missing: string[]
}

const emptyForm = { item_name: '', quantity: '', unit: '', category: '' }

export default function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState<PantryItem | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [matches, setMatches] = useState<RecipeMatch[] | null>(null)
  const [matching, setMatching] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('pantry').select('*').order('category').order('item_name')
    setItems(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  const grouped = PANTRY_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = items.filter(i => (i.category ?? 'Other') === cat)
    return acc
  }, {} as Record<string, PantryItem[]>)

  async function handleAdd() {
    if (!form.item_name.trim()) { toast.error('Item name is required'); return }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('pantry').insert({
      item_name: form.item_name.trim(),
      quantity: form.quantity.trim() || null,
      unit: form.unit.trim() || null,
      category: form.category || 'Other',
    })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Item added!')
    setForm(emptyForm)
    fetchItems()
  }

  async function handleUpdate() {
    if (!editing || !editForm.item_name.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('pantry').update({
      item_name: editForm.item_name.trim(),
      quantity: editForm.quantity.trim() || null,
      unit: editForm.unit.trim() || null,
      category: editForm.category || 'Other',
    }).eq('id', editing.id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Item updated!')
    setEditing(null)
    fetchItems()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this item?')) return
    const supabase = createClient()
    const { error } = await supabase.from('pantry').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Item deleted')
    fetchItems()
  }

  async function findMatches() {
    setMatching(true)
    const supabase = createClient()
    const { data: recipes } = await supabase.from('recipes').select('id,name,image_url,ingredients')
    if (!recipes) { setMatching(false); return }

    const pantryNames = items.map(i => i.item_name.toLowerCase())

    const results: RecipeMatch[] = recipes.map(r => {
      const ingredients: { item: string }[] = r.ingredients ?? []
      const matched: string[] = []
      const missing: string[] = []
      for (const ing of ingredients) {
        const name = ing.item?.toLowerCase().trim()
        if (!name) continue
        const found = pantryNames.some(p => p.includes(name) || name.includes(p))
        if (found) matched.push(ing.item)
        else missing.push(ing.item)
      }
      const total = matched.length + missing.length
      return { id: r.id, name: r.name, image_url: r.image_url, matchPct: total ? Math.round((matched.length / total) * 100) : 0, matched, missing }
    }).filter(r => r.matchPct > 0).sort((a, b) => b.matchPct - a.matchPct)

    setMatches(results)
    setMatching(false)
  }

  const input = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E07B39] bg-white w-full'
  const label = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pantry</h1>
        <Button onClick={findMatches} variant="accent" disabled={matching}>
          {matching ? <><Loader2 size={15} className="animate-spin" /> Checking...</> : <><Lightbulb size={15} /> What can I make?</>}
        </Button>
      </div>

      {/* Add item form */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
        <h2 className="font-semibold text-gray-800 text-sm mb-4">Add Item</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div className="sm:col-span-2">
            <label className={label}>Item Name *</label>
            <input className={input} placeholder="e.g. Olive oil" value={form.item_name} onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          </div>
          <div>
            <label className={label}>Quantity</label>
            <input className={input} placeholder="e.g. 2" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
          </div>
          <div>
            <label className={label}>Unit</label>
            <input className={input} placeholder="e.g. cups" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className={label}>Category</label>
            <select className={input} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              <option value="">Other</option>
              {PANTRY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <Button onClick={handleAdd} disabled={saving} className="shrink-0">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <><Plus size={14} /> Add</>}
          </Button>
        </div>
      </div>

      {/* Grouped list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingBasket size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Your pantry is empty</p>
          <p className="text-gray-400 text-sm mt-1">Add items above to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {PANTRY_CATEGORIES.filter(cat => grouped[cat]?.length > 0).map(cat => (
            <div key={cat} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <button
                onClick={() => setCollapsed(c => ({ ...c, [cat]: !c[cat] }))}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <span className="font-semibold text-gray-800 text-sm">{cat} <span className="text-gray-400 font-normal">({grouped[cat].length})</span></span>
                {collapsed[cat] ? <ChevronRight size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>
              {!collapsed[cat] && (
                <div className="border-t border-gray-100 divide-y divide-gray-50">
                  {grouped[cat].map(item => (
                    <div key={item.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <span className="text-sm font-medium text-gray-800">{item.item_name}</span>
                        {(item.quantity || item.unit) && (
                          <span className="text-xs text-gray-500 ml-2">{[item.quantity, item.unit].filter(Boolean).join(' ')}</span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(item); setEditForm({ item_name: item.item_name, quantity: item.quantity ?? '', unit: item.unit ?? '', category: item.category ?? '' }) }}>
                          <Pencil size={13} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50">
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Item">
        <div className="space-y-3">
          <div>
            <label className={label}>Item Name</label>
            <input className={input} value={editForm.item_name} onChange={e => setEditForm(f => ({ ...f, item_name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Quantity</label>
              <input className={input} value={editForm.quantity} onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))} />
            </div>
            <div>
              <label className={label}>Unit</label>
              <input className={input} value={editForm.unit} onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className={label}>Category</label>
            <select className={input} value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>
              {PANTRY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <Button onClick={handleUpdate} disabled={saving} className="w-full">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : 'Save Changes'}
          </Button>
        </div>
      </Modal>

      {/* What can I make? results */}
      <Modal open={matches !== null} onClose={() => setMatches(null)} title="What can I make?" className="max-w-lg">
        {matches?.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No recipes found. Try adding more pantry items.</p>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {matches?.map(r => (
              <Link key={r.id} href={`/recipes/${r.id}`} onClick={() => setMatches(null)} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-[#E07B39] hover:bg-orange-50 transition-colors">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                  {r.image_url ? <img src={r.image_url} alt={r.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xl">🍴</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-800 truncate">{r.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{r.matched.length} of {r.matched.length + r.missing.length} ingredients</p>
                </div>
                <div className={`text-sm font-bold shrink-0 ${r.matchPct >= 80 ? 'text-green-600' : r.matchPct >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                  {r.matchPct}%
                </div>
              </Link>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
