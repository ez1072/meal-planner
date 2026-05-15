'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { DAYS_OF_WEEK, formatDateToYMD, getMonday, addDays } from '@/lib/utils'

interface Props {
  recipeId: string
  open: boolean
  onClose: () => void
}

function weeksFromNow(n: number) {
  const monday = getMonday(addDays(new Date(), n * 7))
  return { label: n === 0 ? 'This week' : n === 1 ? 'Next week' : `In ${n} weeks`, value: formatDateToYMD(monday) }
}

export default function AddToPlanModal({ recipeId, open, onClose }: Props) {
  const [saving, setSaving] = useState(false)
  const [weekStart, setWeekStart] = useState(weeksFromNow(0).value)
  const [day, setDay] = useState<string>('Monday')
  const [mealType, setMealType] = useState<'lunch' | 'dinner'>('dinner')

  async function handleAdd() {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('meal_plan').upsert({
      week_start: weekStart,
      day_of_week: day,
      meal_type: mealType,
      recipe_id: recipeId,
      custom_label: null,
    }, { onConflict: 'week_start,day_of_week,meal_type' })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Added to meal plan!')
    onClose()
  }

  const sel = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#E07B39]'
  const label = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <Modal open={open} onClose={onClose} title="Add to Meal Plan">
      <div className="space-y-4">
        <div>
          <label className={label}>Week</label>
          <select className={sel} value={weekStart} onChange={e => setWeekStart(e.target.value)}>
            {[0, 1, 2, 3].map(n => {
              const w = weeksFromNow(n)
              return <option key={w.value} value={w.value}>{w.label} ({w.value})</option>
            })}
          </select>
        </div>
        <div>
          <label className={label}>Day</label>
          <select className={sel} value={day} onChange={e => setDay(e.target.value)}>
            {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Meal</label>
          <div className="flex gap-2">
            {(['lunch', 'dinner'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMealType(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border capitalize transition-colors ${mealType === m ? 'bg-[#E07B39] text-white border-[#E07B39]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#E07B39]'}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={handleAdd} disabled={saving} className="w-full">
          {saving ? <><Loader2 size={16} className="animate-spin" /> Adding...</> : 'Add to Plan'}
        </Button>
      </div>
    </Modal>
  )
}
