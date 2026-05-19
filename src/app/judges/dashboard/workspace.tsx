'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Team, ResultA, MatchB, FightC, MatchD, StandingA, StandingB, StandingC, StandingD } from '@/types/database'

// ─── helpers ─────────────────────────────────────────────────────────────────

const CAT_META: Record<string, { label: string; icon: string }> = {
  a: { label: 'Line Follower', icon: '🏎️' },
  b: { label: 'Mini Sumo',     icon: '🤼' },
  c: { label: 'MiniRoboWar',  icon: '⚔️' },
  d: { label: 'Robo Football', icon: '⚽' },
}

function post(url: string, body: unknown) {
  return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

function del(url: string, body: unknown) {
  return fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

// ─── Standings column ─────────────────────────────────────────────────────────

function StandingRow({ rank, name, score, status }: { rank: number; name: string; score: string; status?: string }) {
  const medal = rank === 1 ? 'bg-amber-400' : rank === 2 ? 'bg-gray-300' : rank === 3 ? 'bg-amber-700' : 'bg-gray-100 text-gray-400'
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${rank <= 3 ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0 ${medal}`}>{rank}</span>
      <span className="flex-1 text-sm font-medium truncate">{name}</span>
      <span className="text-xs font-mono text-gray-500 shrink-0">{score}</span>
      {status === 'dnf' && <span className="text-[9px] font-bold text-orange-500">DNF</span>}
      {status === 'disq' && <span className="text-[9px] font-bold text-red-500">DQ</span>}
    </div>
  )
}

function StandingsPanel({ category }: { category: string }) {
  const [rows, setRows] = useState<(StandingA | StandingB | StandingC | StandingD)[]>([])

  const load = useCallback(async () => {
    const res = await fetch(`/api/standings/${category}`)
    if (res.ok) setRows(await res.json())
  }, [category])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const id = setInterval(load, 15_000)
    return () => clearInterval(id)
  }, [load])

  function score(s: typeof rows[0]) {
    if ('total' in s) {
      const sa = s as StandingA
      if (sa.status === 'dnf' || sa.status === 'disq') return sa.status
      return sa.total !== null ? sa.total.toFixed(2) + 's' : '—'
    }
    if ('goals_for' in s) {
      const sd = s as StandingD
      return `${sd.wins}W ${sd.draws}D ${sd.losses}L`
    }
    if ('knockouts' in s) {
      const sc = s as StandingC
      return `${sc.wins}W ${sc.losses}L ${sc.knockouts}KO`
    }
    const sb = s as StandingB
    return `${sb.wins}W ${sb.draws}D · ${sb.points}pts`
  }

  function status(s: typeof rows[0]) {
    if ('status' in s) {
      const sa = s as StandingA
      return sa.status === 'dnf' ? 'dnf' : sa.status === 'disq' ? 'disq' : undefined
    }
    return undefined
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Standings</h3>
        <button onClick={load} className="text-[10px] text-gray-300 hover:text-gray-500">↻</button>
      </div>
      {rows.length === 0
        ? <p className="text-xs text-gray-300 py-4 text-center">No results yet</p>
        : <div className="space-y-0.5 max-h-80 overflow-y-auto">
          {rows.map(s => <StandingRow key={s.team.id} rank={s.rank} name={s.team.name} score={score(s)} status={status(s)} />)}
        </div>}
    </div>
  )
}

// ─── Teams panel ──────────────────────────────────────────────────────────────

function TeamsPanel({ category, teams, onReload }: { category: string; teams: Team[]; onReload: () => void }) {
  const [name, setName] = useState('')
  const [school, setSchool] = useState('')
  const [adding, setAdding] = useState(false)

  const add = async () => {
    if (!name.trim()) return
    setAdding(true)
    await post(`/api/judges/${category}/teams`, { name, school, category })
    setName(''); setSchool('')
    onReload()
    setAdding(false)
  }

  const remove = async (id: string) => {
    if (!confirm('Delete team?')) return
    await del(`/api/judges/${category}/teams`, { id })
    onReload()
  }

  return (
    <div>
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Teams ({teams.length})</h3>
      <div className="flex gap-1 mb-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Team name"
          onKeyDown={e => e.key === 'Enter' && add()}
          className="flex-1 border border-gray-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300" />
        <input value={school} onChange={e => setSchool(e.target.value)} placeholder="School"
          onKeyDown={e => e.key === 'Enter' && add()}
          className="w-24 border border-gray-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300" />
        <button onClick={add} disabled={adding || !name.trim()}
          className="bg-gray-900 text-white px-2.5 py-1.5 rounded-md text-xs font-bold disabled:opacity-40">
          {adding ? '…' : '+'}
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto space-y-0.5">
        {teams.length === 0
          ? <p className="text-xs text-gray-300 text-center py-3">No teams yet</p>
          : teams.map((t, i) => (
            <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 group">
              <span className="text-[10px] text-gray-300 w-4">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{t.name}</div>
                <div className="text-[10px] text-gray-400 truncate">{t.school}</div>
              </div>
              <button onClick={() => remove(t.id)}
                className="text-[10px] text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
            </div>
          ))}
      </div>
    </div>
  )
}

// ─── Record forms ─────────────────────────────────────────────────────────────

function RecordA({ teams, results, onSaved }: { teams: Team[]; results: ResultA[]; onSaved: () => void }) {
  const [team, setTeam] = useState('')
  const [run1, setRun1] = useState('')
  const [run2, setRun2] = useState('')
  const [penalty, setPenalty] = useState<ResultA['penalty']>('0')
  const [phase, setPhase] = useState<ResultA['run_phase']>('qualification')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!team) return
    const r = results.find(r => r.team_id === team)
    if (r) {
      setRun1(r.run1 !== null ? String(r.run1) : '')
      setRun2(r.run2 !== null ? String(r.run2) : '')
      setPenalty(r.penalty); setPhase(r.run_phase ?? 'qualification'); setNotes(r.notes ?? '')
    } else { setRun1(''); setRun2(''); setPenalty('0'); setPhase('qualification'); setNotes('') }
  }, [team]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!team) { setMsg('Select team'); return }
    setSaving(true); setMsg('')
    const res = await post('/api/judges/a/results', {
      team_id: team, run1: run1 ? parseFloat(run1) : null, run2: run2 ? parseFloat(run2) : null,
      penalty, run_phase: phase, notes: notes || null,
    })
    if (res.ok) { setMsg('Saved!'); onSaved() } else { const e = await res.json(); setMsg(e.error ?? 'Error') }
    setSaving(false); setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="field-label">Team</label>
        <select value={team} onChange={e => setTeam(e.target.value)} className="field-select">
          <option value="">— select —</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">Phase</label>
          <div className="flex gap-1">
            {(['qualification', 'final'] as const).map(p => (
              <button key={p} onClick={() => setPhase(p)} className={`flex-1 py-1.5 rounded text-xs font-bold border transition-colors ${phase === p ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                {p === 'qualification' ? 'Qual' : 'Final'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="field-label">Penalty</label>
          <div className="flex gap-1">
            {(['0', '20', '40', 'dnf', 'disq'] as const).map(p => (
              <button key={p} onClick={() => setPenalty(p)} className={`flex-1 py-1.5 rounded text-[10px] font-bold border transition-colors ${penalty === p ? p === 'disq' ? 'bg-red-600 text-white border-red-600' : p === 'dnf' ? 'bg-orange-500 text-white border-orange-500' : 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                {p === '0' ? '+0' : p === '20' ? '+20' : p === '40' ? '+40' : p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="field-label">Run 1 (sec)</label>
          <input type="number" step="0.01" value={run1} onChange={e => setRun1(e.target.value)} placeholder="12.34" className="field-input font-mono" />
        </div>
        <div>
          <label className="field-label">Run 2 (sec)</label>
          <input type="number" step="0.01" value={run2} onChange={e => setRun2(e.target.value)} placeholder="11.80" className="field-input font-mono" />
        </div>
      </div>
      <div>
        <label className="field-label">Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Restart, sensor miss…" className="field-input resize-none" />
      </div>
      <SaveBar saving={saving} msg={msg} disabled={!team} onSave={save} />
    </div>
  )
}

function RecordB({ teams, matches, onSaved }: { teams: Team[]; matches: MatchB[]; onSaved: () => void }) {
  const [matchNum, setMatchNum] = useState(''); const [pos, setPos] = useState<MatchB['starting_position']>('face')
  const [t1, setT1] = useState(''); const [t2, setT2] = useState('')
  const [winner, setWinner] = useState<'0' | '1' | '2'>('1')
  const [r1, setR1] = useState('0'); const [r2, setR2] = useState('0')
  const [notes, setNotes] = useState(''); const [saving, setSaving] = useState(false); const [msg, setMsg] = useState('')

  const save = async () => {
    if (!t1 || !t2) { setMsg('Select both teams'); return }
    if (t1 === t2) { setMsg('Teams must differ'); return }
    setSaving(true); setMsg('')
    const res = await post('/api/judges/b/matches', { team1_id: t1, team2_id: t2, winner: parseInt(winner), rounds1: parseInt(r1) || 0, rounds2: parseInt(r2) || 0, match_number: matchNum ? parseInt(matchNum) : null, starting_position: pos, notes: notes || null })
    if (res.ok) { setMsg('Recorded!'); setT1(''); setT2(''); setWinner('1'); setR1('0'); setR2('0'); setMatchNum(''); setNotes(''); onSaved() }
    else { const e = await res.json(); setMsg(e.error ?? 'Error') }
    setSaving(false); setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">Match # (opt.)</label>
          <input type="number" value={matchNum} onChange={e => setMatchNum(e.target.value)} placeholder="e.g. 12" className="field-input font-mono" />
        </div>
        <div>
          <label className="field-label">Starting Position</label>
          <div className="flex gap-1">
            {(['face', 'side', 'back'] as const).map(p => (
              <button key={p} onClick={() => setPos(p)} className={`flex-1 py-1.5 rounded text-[10px] font-bold border transition-colors ${pos === p ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>{p.charAt(0).toUpperCase() + p.slice(1)}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="field-label">Team 1</label>
          <select value={t1} onChange={e => setT1(e.target.value)} className="field-select">
            <option value="">— select —</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Team 2</label>
          <select value={t2} onChange={e => setT2(e.target.value)} className="field-select">
            <option value="">— select —</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="field-label">Winner</label>
        <div className="flex gap-2">
          {[{ v: '1', l: 'Team 1' }, { v: '2', l: 'Team 2' }, { v: '0', l: 'Draw' }].map(o => (
            <button key={o.v} onClick={() => setWinner(o.v as '0' | '1' | '2')} className={`flex-1 py-1.5 rounded text-xs font-bold border transition-colors ${winner === o.v ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>{o.l}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="field-label">Rounds — T1</label><input type="number" min="0" max="3" value={r1} onChange={e => setR1(e.target.value)} className="field-input font-mono" /></div>
        <div><label className="field-label">Rounds — T2</label><input type="number" min="0" max="3" value={r2} onChange={e => setR2(e.target.value)} className="field-input font-mono" /></div>
      </div>
      <div><label className="field-label">Notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Rematch, rule violation…" className="field-input resize-none" /></div>
      <SaveBar saving={saving} msg={msg} disabled={!t1 || !t2} onSave={save} />
    </div>
  )
}

function RecordC({ teams, fights, onSaved }: { teams: Team[]; fights: FightC[]; onSaved: () => void }) {
  const [fightNum, setFightNum] = useState(''); const [method, setMethod] = useState<FightC['method']>('KO')
  const [t1, setT1] = useState(''); const [t2, setT2] = useState('')
  const [winner, setWinner] = useState<'1' | '2'>('1')
  const [s1, setS1] = useState('0'); const [s2, setS2] = useState('0')
  const [notes, setNotes] = useState(''); const [saving, setSaving] = useState(false); const [msg, setMsg] = useState('')

  const save = async () => {
    if (!t1 || !t2) { setMsg('Select both teams'); return }
    if (t1 === t2) { setMsg('Teams must differ'); return }
    setSaving(true); setMsg('')
    const res = await post('/api/judges/c/fights', { team1_id: t1, team2_id: t2, winner: parseInt(winner), method, judge_score1: parseInt(s1) || 0, judge_score2: parseInt(s2) || 0, fight_number: fightNum ? parseInt(fightNum) : null, notes: notes || null })
    if (res.ok) { setMsg('Recorded!'); setT1(''); setT2(''); setWinner('1'); setMethod('KO'); setS1('0'); setS2('0'); setFightNum(''); setNotes(''); onSaved() }
    else { const e = await res.json(); setMsg(e.error ?? 'Error') }
    setSaving(false); setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="field-label">Fight # (opt.)</label><input type="number" value={fightNum} onChange={e => setFightNum(e.target.value)} placeholder="e.g. 7" className="field-input font-mono" /></div>
        <div>
          <label className="field-label">Method</label>
          <div className="flex gap-1">
            {(['KO', 'IMM', 'JD'] as const).map(m => (
              <button key={m} onClick={() => setMethod(m)} className={`flex-1 py-1.5 rounded text-xs font-bold border transition-colors ${method === m ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>{m}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="field-label">Team 1</label>
          <select value={t1} onChange={e => setT1(e.target.value)} className="field-select">
            <option value="">— select —</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Team 2</label>
          <select value={t2} onChange={e => setT2(e.target.value)} className="field-select">
            <option value="">— select —</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="field-label">Winner</label>
        <div className="flex gap-2">
          {[{ v: '1', l: 'Team 1' }, { v: '2', l: 'Team 2' }].map(o => (
            <button key={o.v} onClick={() => setWinner(o.v as '1' | '2')} className={`flex-1 py-1.5 rounded text-xs font-bold border transition-colors ${winner === o.v ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>{o.l}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="field-label">Score T1 {method === 'JD' && <span className="text-red-400">*</span>}</label><input type="number" min="0" max="50" value={s1} onChange={e => setS1(e.target.value)} className="field-input font-mono" /></div>
        <div><label className="field-label">Score T2 {method === 'JD' && <span className="text-red-400">*</span>}</label><input type="number" min="0" max="50" value={s2} onChange={e => setS2(e.target.value)} className="field-input font-mono" /></div>
      </div>
      <div><label className="field-label">Notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Weapon malfunction, rule note…" className="field-input resize-none" /></div>
      <SaveBar saving={saving} msg={msg} disabled={!t1 || !t2} onSave={save} />
    </div>
  )
}

function RecordD({ teams, matches, onSaved }: { teams: Team[]; matches: MatchD[]; onSaved: () => void }) {
  const [matchNum, setMatchNum] = useState(''); const [phase, setPhase] = useState<MatchD['match_phase']>('group')
  const [t1, setT1] = useState(''); const [t2, setT2] = useState('')
  const [g1, setG1] = useState('0'); const [g2, setG2] = useState('0')
  const [notes, setNotes] = useState(''); const [saving, setSaving] = useState(false); const [msg, setMsg] = useState('')

  const save = async () => {
    if (!t1 || !t2) { setMsg('Select both teams'); return }
    if (t1 === t2) { setMsg('Teams must differ'); return }
    setSaving(true); setMsg('')
    const res = await post('/api/judges/d/matches', { team1_id: t1, team2_id: t2, goals1: parseInt(g1) || 0, goals2: parseInt(g2) || 0, match_number: matchNum ? parseInt(matchNum) : null, match_phase: phase, notes: notes || null })
    if (res.ok) { setMsg('Recorded!'); setT1(''); setT2(''); setG1('0'); setG2('0'); setMatchNum(''); setNotes(''); onSaved() }
    else { const e = await res.json(); setMsg(e.error ?? 'Error') }
    setSaving(false); setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="field-label">Match # (opt.)</label><input type="number" value={matchNum} onChange={e => setMatchNum(e.target.value)} placeholder="e.g. 5" className="field-input font-mono" /></div>
        <div>
          <label className="field-label">Phase</label>
          <div className="flex gap-1">
            {(['group', 'extra', 'penalties'] as const).map(p => (
              <button key={p} onClick={() => setPhase(p)} className={`flex-1 py-1.5 rounded text-[10px] font-bold border transition-colors ${phase === p ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>{p.charAt(0).toUpperCase() + p.slice(1)}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="field-label">Team 1</label>
          <select value={t1} onChange={e => setT1(e.target.value)} className="field-select">
            <option value="">— select —</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Team 2</label>
          <select value={t2} onChange={e => setT2(e.target.value)} className="field-select">
            <option value="">— select —</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="field-label">Score</label>
        <div className="flex items-center gap-3">
          <input type="number" min="0" value={g1} onChange={e => setG1(e.target.value)} className="w-20 border border-gray-200 rounded-lg px-2 py-2 text-3xl font-black text-center font-mono focus:outline-none focus:ring-2 focus:ring-amber-300" />
          <span className="text-2xl font-black text-gray-200">:</span>
          <input type="number" min="0" value={g2} onChange={e => setG2(e.target.value)} className="w-20 border border-gray-200 rounded-lg px-2 py-2 text-3xl font-black text-center font-mono focus:outline-none focus:ring-2 focus:ring-amber-300" />
        </div>
      </div>
      <div><label className="field-label">Notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Own goal, foul…" className="field-input resize-none" /></div>
      <SaveBar saving={saving} msg={msg} disabled={!t1 || !t2} onSave={save} />
    </div>
  )
}

function SaveBar({ saving, msg, disabled, onSave }: { saving: boolean; msg: string; disabled: boolean; onSave: () => void }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <button onClick={onSave} disabled={saving || disabled}
        className="bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-gray-700 transition-colors">
        {saving ? 'Saving…' : 'Save'}
      </button>
      {msg && <span className={`text-sm font-medium ${msg.includes('!') ? 'text-green-600' : 'text-red-500'}`}>{msg}</span>}
    </div>
  )
}

// ─── History panels ───────────────────────────────────────────────────────────

function HistoryA({ teams, results }: { teams: Team[]; results: ResultA[] }) {
  if (results.length === 0) return null
  const name = (id: string) => teams.find(t => t.id === id)?.name ?? id
  return (
    <div className="border-t border-gray-100 pt-4 mt-2">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Results log</h3>
      <div className="space-y-0.5 max-h-52 overflow-y-auto">
        {results.map(r => (
          <div key={r.team_id} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded hover:bg-gray-50">
            <span className="font-medium flex-1 truncate">{name(r.team_id)}</span>
            <span className="text-gray-400">{r.run_phase === 'final' ? 'F' : 'Q'}</span>
            <span className="font-mono text-gray-500">{r.run1 ?? '—'} / {r.run2 ?? '—'}</span>
            {r.penalty !== '0' && <span className="text-orange-500 font-bold">{r.penalty.toUpperCase()}</span>}
            <span className="font-mono font-bold text-gray-800 w-14 text-right">{r.total !== null ? r.total.toFixed(2) + 's' : '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function HistoryBCD({ label, rows }: { label: string; rows: string[] }) {
  if (rows.length === 0) return null
  return (
    <div className="border-t border-gray-100 pt-4 mt-2">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{label} ({rows.length})</h3>
      <div className="space-y-0.5 max-h-52 overflow-y-auto">
        {[...rows].reverse().map((row, i) => (
          <div key={i} className="text-xs py-1.5 px-2 rounded hover:bg-gray-50 text-gray-600">{row}</div>
        ))}
      </div>
    </div>
  )
}

// ─── Category workspace ───────────────────────────────────────────────────────

function CategoryWorkspace({ category }: { category: string }) {
  const [teams, setTeams] = useState<Team[]>([])
  const [resultsA, setResultsA] = useState<ResultA[]>([])
  const [matchesB, setMatchesB] = useState<MatchB[]>([])
  const [fightsC, setFightsC] = useState<FightC[]>([])
  const [matchesD, setMatchesD] = useState<MatchD[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [tr, dr] = await Promise.all([
      fetch(`/api/judges/${category}/teams`).then(r => r.json()),
      category === 'a' ? fetch('/api/judges/a/results').then(r => r.json()) :
      category === 'b' ? fetch('/api/judges/b/matches').then(r => r.json()) :
      category === 'c' ? fetch('/api/judges/c/fights').then(r => r.json()) :
                         fetch('/api/judges/d/matches').then(r => r.json()),
    ])
    setTeams(Array.isArray(tr) ? tr : [])
    if (category === 'a') setResultsA(Array.isArray(dr) ? dr : [])
    if (category === 'b') setMatchesB(Array.isArray(dr) ? dr : [])
    if (category === 'c') setFightsC(Array.isArray(dr) ? dr : [])
    if (category === 'd') setMatchesD(Array.isArray(dr) ? dr : [])
    setLoading(false)
  }, [category])

  useEffect(() => { load() }, [load])

  const tName = (id: string) => teams.find(t => t.id === id)?.name ?? id

  const matchRowsB = matchesB.map(m =>
    `#${m.match_number ?? '?'} · ${tName(m.team1_id)} vs ${tName(m.team2_id)} · ${m.rounds1}–${m.rounds2} · ${m.winner === 1 ? tName(m.team1_id) : m.winner === 2 ? tName(m.team2_id) : 'Draw'}`
  )
  const fightRowsC = fightsC.map(f =>
    `#${f.fight_number ?? '?'} · ${tName(f.team1_id)} vs ${tName(f.team2_id)} · ${f.method} · ${f.winner === 1 ? tName(f.team1_id) : tName(f.team2_id)} wins`
  )
  const matchRowsD = matchesD.map(m =>
    `#${m.match_number ?? '?'} · ${tName(m.team1_id)} ${m.goals1}:${m.goals2} ${tName(m.team2_id)} · ${m.match_phase}`
  )

  if (loading) return <div className="text-sm text-gray-400 py-12 text-center">Loading…</div>

  return (
    <div className="flex gap-5 min-h-0 flex-1">
      {/* ── Left: Record + History ── */}
      <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-100 shadow-sm p-5 overflow-y-auto">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">
          {category === 'a' ? 'Record Run' : category === 'b' ? 'Record Match' : category === 'c' ? 'Record Fight' : 'Record Match'}
        </h2>
        {category === 'a' && <RecordA teams={teams} results={resultsA} onSaved={load} />}
        {category === 'b' && <RecordB teams={teams} matches={matchesB} onSaved={load} />}
        {category === 'c' && <RecordC teams={teams} fights={fightsC} onSaved={load} />}
        {category === 'd' && <RecordD teams={teams} matches={matchesD} onSaved={load} />}

        {category === 'a' && <HistoryA teams={teams} results={resultsA} />}
        {category === 'b' && <HistoryBCD label="Match history" rows={matchRowsB} />}
        {category === 'c' && <HistoryBCD label="Fight history" rows={fightRowsC} />}
        {category === 'd' && <HistoryBCD label="Match history" rows={matchRowsD} />}
      </div>

      {/* ── Right: Standings + Teams ── */}
      <div className="w-72 shrink-0 space-y-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <StandingsPanel category={category} />
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <TeamsPanel category={category} teams={teams} onReload={load} />
        </div>
      </div>
    </div>
  )
}

// ─── Main workspace ───────────────────────────────────────────────────────────

interface Props {
  username: string
  role: string
  categories: string[]
}

export default function JudgeWorkspace({ username, role, categories }: Props) {
  const [activeTab, setActiveTab] = useState(categories[0] ?? 'a')

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 h-14 flex items-center px-6 gap-3 shrink-0 sticky top-0 z-10">
        <div className="w-8 h-8 border-2 border-gray-900 rounded flex items-center justify-center font-black text-[9px] shrink-0">SFRC</div>
        <span className="font-black text-sm tracking-wide text-gray-900">STARTUP FEST</span>
        <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full">JUDGES PANEL</span>

        {/* Category tabs (always visible, switches workspace) */}
        <div className="flex gap-1 ml-4">
          {categories.map(cat => {
            const m = CAT_META[cat]
            return (
              <button key={cat} onClick={() => setActiveTab(cat)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === cat ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}>
                <span>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400">@{username}</span>
          {role === 'admin' && (
            <>
              <a href="/judges/admin/event-settings" className="text-xs text-gray-500 hover:text-gray-900 px-2.5 py-1.5 rounded border border-gray-200 hover:bg-gray-50">⚙ Event</a>
              <a href="/judges/admin/users" className="text-xs text-gray-500 hover:text-gray-900 px-2.5 py-1.5 rounded border border-gray-200 hover:bg-gray-50">Admin</a>
            </>
          )}
          <a href="/display" target="_blank" className="text-xs text-gray-500 hover:text-gray-900 px-2.5 py-1.5 rounded border border-gray-200 hover:bg-gray-50">Display ↗</a>
          <a href="/a" target="_blank" className="text-xs text-gray-500 hover:text-gray-900 px-2.5 py-1.5 rounded border border-gray-200 hover:bg-gray-50">Public ↗</a>
          <form action="/api/auth/logout" method="post" className="inline">
            <button type="submit" className="text-xs text-red-600 hover:text-red-700 px-2.5 py-1.5 rounded border border-red-200 hover:bg-red-50">Log Out</button>
          </form>
        </div>
      </header>

      {/* Workspace */}
      <div className="flex-1 p-5 flex flex-col min-h-0">
        <CategoryWorkspace key={activeTab} category={activeTab} />
      </div>
    </div>
  )
}
