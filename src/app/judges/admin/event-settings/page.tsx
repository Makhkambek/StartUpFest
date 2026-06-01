'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { UZ_CITIES } from '@/lib/cities'
import type { EventSettings } from '@/types/database'
import { ThemeToggle } from '@/components/judges/ThemeToggle'

type Cat = 'a' | 'b' | 'c' | 'd'
const CAT_LABELS: Record<Cat, string> = {
  a: 'A · Line Follower',
  b: 'B · Mini Sumo',
  c: 'C · MiniRoboWar',
  d: 'D · Robo Football',
}

export default function EventSettingsPage() {
  const [settings, setSettings] = useState<EventSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState<Cat | null>(null)

  // editable form state
  const [cityCode, setCityCode] = useState('TSH')
  const [year, setYear] = useState(new Date().getFullYear())
  const [eventName, setEventName] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/event/settings', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json() as EventSettings
        setSettings(data)
        setCityCode(data.city_code)
        setYear(data.year)
        setEventName(data.event_name ?? '')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/event/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city_code: cityCode,
          year,
          event_name: eventName.trim() || null,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(json?.error ?? `HTTP ${res.status}`)
        return
      }
      setSettings(json)
      toast.success('Event settings saved · all displays will pick up within 30s')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function clearResults(cat: Cat) {
    if (!confirm(`Clear ALL match results for Category ${cat.toUpperCase()}? This cannot be undone.`)) return
    setClearing(cat)
    try {
      const res = await fetch('/api/admin/reset-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: cat }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) { toast.error(json?.error ?? `HTTP ${res.status}`); return }
      toast.success(`Category ${cat.toUpperCase()} results cleared`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setClearing(null)
    }
  }

  const dirty =
    settings != null &&
    (settings.city_code !== cityCode ||
      settings.year !== year ||
      (settings.event_name ?? '') !== eventName.trim())

  const selectedCity = UZ_CITIES.find((c) => c.code === cityCode) ?? UZ_CITIES[0]

  return (
    <div className="max-w-3xl mx-auto p-6 sm:p-10">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <a href="/judges/admin" className="text-sm text-emerald-600 hover:underline">← Admin</a>
          <ThemeToggle />
        </div>
        <h1 className="text-3xl font-black mt-2">Event Settings</h1>
        <p className="text-gray-600 dark:text-zinc-400 text-sm mt-1">
          One setting per region. Changing the city updates every field display, scoreboard, and PDF watermark.
        </p>
      </header>

      {loading ? (
        <div className="text-gray-500 dark:text-zinc-400">Loading…</div>
      ) : (
        <div className="space-y-8">
        <div className="space-y-6 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-6 shadow-sm">

          {/* CITY SELECT */}
          <div>
            <label className="block text-sm font-bold text-gray-800 dark:text-zinc-200 mb-2">
              City <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <select
              value={cityCode}
              onChange={(e) => setCityCode(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg font-bold text-lg focus:border-emerald-500 focus:outline-none dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
            >
              {UZ_CITIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.en}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
              Each region maps to the correct locale name automatically on public displays.
            </p>
          </div>

          {/* YEAR */}
          <div>
            <label className="block text-sm font-bold text-gray-800 dark:text-zinc-200 mb-2">Year</label>
            <input
              type="number"
              min={2024}
              max={2099}
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value || '0', 10))}
              className="w-32 px-4 py-3 border-2 border-gray-300 rounded-lg font-bold text-lg tabular-nums focus:border-emerald-500 focus:outline-none dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
            />
          </div>

          {/* EVENT NAME (optional) */}
          <div>
            <label className="block text-sm font-bold text-gray-800 dark:text-zinc-200 mb-2">
              Event name <span className="text-gray-400 dark:text-zinc-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g. SFRC · Bukhara Stage"
              maxLength={80}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-emerald-500 focus:outline-none dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
          </div>

          {/* PREVIEW */}
          <div className="border-t border-gray-200 dark:border-zinc-700 pt-6">
            <div className="text-xs font-bold tracking-widest uppercase text-gray-500 dark:text-zinc-400 mb-3">
              Preview (how displays will render)
            </div>
            <div className="bg-black text-white rounded-lg p-6 font-mono text-sm space-y-2">
              <div className="text-emerald-400 tracking-[0.3em]">EN: {selectedCity.en.toUpperCase()} · {year}</div>
              <div className="text-emerald-400 tracking-[0.3em]">RU: {selectedCity.ru.toUpperCase()} · {year}</div>
              <div className="text-emerald-400 tracking-[0.3em]">UZ: {selectedCity.uz.toUpperCase()} · {year}</div>
              {eventName.trim() && (
                <div className="text-amber-300 mt-3">{eventName.trim()}</div>
              )}
            </div>
          </div>

          {/* SAVE */}
          <div className="flex items-center gap-3 pt-2">
            <button
              disabled={saving || !dirty}
              onClick={save}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-lg transition"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            {dirty && <span className="text-xs text-amber-700 dark:text-amber-400">Unsaved changes</span>}
            {!dirty && settings && (
              <span className="text-xs text-gray-500 dark:text-zinc-400">
                Last updated: {new Date(settings.updated_at).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* DANGER ZONE */}
        <div className="bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900 rounded-lg p-6 shadow-sm">
          <h2 className="text-sm font-bold text-red-700 dark:text-red-400 uppercase tracking-widest mb-1">Danger Zone</h2>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mb-5">
            Clear all match results for a category. Scores, standings, and match history will be wiped. The live state and schedule will also reset. <strong className="text-red-600 dark:text-red-400">Cannot be undone.</strong>
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(['a', 'b', 'c', 'd'] as Cat[]).map((cat) => (
              <button
                key={cat}
                disabled={clearing !== null}
                onClick={() => clearResults(cat)}
                className="flex items-center justify-between px-4 py-3 border border-red-200 dark:border-red-900 rounded-lg text-sm font-semibold text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <span>{CAT_LABELS[cat]}</span>
                <span className="text-xs font-bold">
                  {clearing === cat ? 'Clearing…' : 'Clear Results'}
                </span>
              </button>
            ))}
          </div>
        </div>

        </div>
      )}
    </div>
  )
}
