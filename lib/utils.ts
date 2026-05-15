import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function formatDateToYMD(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export const DAYS_OF_WEEK = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] as const
export const MEAL_TYPES = ['lunch','dinner'] as const
export const CUISINES = ['Italian','Asian','Mexican','Mediterranean','American','Indian','Other'] as const
export const MAIN_INGREDIENTS = ['Chicken','Beef','Steak','Salmon','Shrimp','Pasta','Vegetarian','Other'] as const
export const DIFFICULTIES = ['Easy','Medium','Hard'] as const
export const PANTRY_CATEGORIES = ['Produce','Dairy','Meat','Pantry','Frozen','Other'] as const
