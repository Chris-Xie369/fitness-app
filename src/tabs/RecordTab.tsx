import { useState } from 'react'
import type { Exercise, SetEntry, Workout } from '../types'
import { todayStr } from '../lib/streak'
import { formatSets, lastSetsFor, recentExerciseNames } from '../lib/exercises'

// 表单里的"一组"用字符串（input 的 value 一律是字符串），保存时再转成数字
type DraftSet = { reps: string; weight: string }
type DraftExercise = { id: string; name: string; sets: DraftSet[] }

const uid = () => globalThis.crypto?.randomUUID?.() ?? `id_${Date.now()}_${Math.random().toString(36).slice(2)}`

function emptyExercise(): DraftExercise {
  return { id: uid(), name: '', sets: [{ reps: '', weight: '' }] }
}

// 把历史组数据转成表单草稿（重量可能为空）
function toDraftSets(sets: SetEntry[]): DraftSet[] {
  return sets.map((s) => ({ reps: String(s.reps), weight: s.weight != null ? String(s.weight) : '' }))
}

export function RecordTab({
  onSave,
  alreadyToday,
  workouts,
}: {
  onSave: (w: Workout) => void
  alreadyToday: boolean
  workouts: Workout[]
}) {
  const [exercises, setExercises] = useState<DraftExercise[]>([emptyExercise()])

  // 最近练过的动作：前 6 个做快捷胶囊，全部用于输入框自动补全
  const recent = recentExerciseNames(workouts, 6)
  const allNames = recentExerciseNames(workouts)

  function addExercise() {
    setExercises((p) => [...p, emptyExercise()])
  }
  function removeExercise(id: string) {
    setExercises((p) => p.filter((e) => e.id !== id))
  }
  function setName(id: string, name: string) {
    setExercises((p) => p.map((e) => (e.id === id ? { ...e, name } : e)))
  }
  function addSet(exId: string) {
    setExercises((p) => p.map((e) => (e.id === exId ? { ...e, sets: [...e.sets, { reps: '', weight: '' }] } : e)))
  }
  function removeSet(exId: string, idx: number) {
    setExercises((p) => p.map((e) => (e.id === exId ? { ...e, sets: e.sets.filter((_, i) => i !== idx) } : e)))
  }
  function updateSet(exId: string, idx: number, field: 'reps' | 'weight', value: string) {
    setExercises((p) =>
      p.map((e) => (e.id === exId ? { ...e, sets: e.sets.map((s, i) => (i === idx ? { ...s, [field]: value } : s)) } : e))
    )
  }
  // 选历史动作：填入名字，并把上次的重量/次数整组带进来
  function applyHistory(id: string, name: string) {
    const last = lastSetsFor(workouts, name)
    setExercises((p) =>
      p.map((e) => (e.id === id ? { ...e, name, sets: last.length > 0 ? toDraftSets(last) : e.sets } : e)),
    )
  }

  function handleSave() {
    const valid: Exercise[] = []
    for (const e of exercises) {
      const name = e.name.trim()
      if (!name) continue
      const sets: SetEntry[] = []
      for (const s of e.sets) {
        const reps = Number(s.reps)
        if (!s.reps || Number.isNaN(reps) || reps <= 0) continue
        const set: SetEntry = { reps }
        const w = Number(s.weight)
        if (s.weight && !Number.isNaN(w) && w > 0) set.weight = w
        sets.push(set)
      }
      if (sets.length > 0) valid.push({ name, sets })
    }
    if (valid.length === 0) return

    onSave({ id: uid(), date: todayStr(), exercises: valid, createdAt: Date.now() })
    setExercises([emptyExercise()]) // 重置表单
  }

  return (
    <div className="px-7 pt-16 pb-10">
      <h1 className="font-display text-[28px] text-ink text-center">记录训练</h1>
      <p className="text-[13px] text-muted mt-1">{alreadyToday ? '动作将追加到今天的训练' : '保存后即完成今天打卡'}</p>

      <datalist id="exercise-names">
        {allNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <div className="mt-6 space-y-5">
        {exercises.map((ex, exIdx) => {
          const last = ex.name.trim() ? lastSetsFor(workouts, ex.name) : []
          // 只有组数据全空时才给「带入」：避免误触覆盖用户已手填的内容
          const setsEmpty = ex.sets.every((s) => !s.reps.trim() && !s.weight.trim())
          return (
            <div key={ex.id} className="rounded-2xl bg-surface border border-line p-4">
              <div className="flex items-center gap-2">
                <input
                  value={ex.name}
                  onChange={(e) => setName(ex.id, e.target.value)}
                  list="exercise-names"
                  placeholder={`动作 ${exIdx + 1}（如：卧推）`}
                  className="flex-1 px-3 py-2 rounded-xl border border-line bg-paper text-ink placeholder:text-muted/70 focus:outline-none focus:border-clay focus:ring-2 focus:ring-clay/20"
                />
                {exercises.length > 1 && (
                  <button onClick={() => removeExercise(ex.id)} className="text-muted/50 hover:text-clay text-sm">删除</button>
                )}
              </div>

              {/* 历史动作快捷选择 */}
              {!ex.name.trim() && recent.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {recent.map((n) => (
                    <button
                      key={n}
                      onClick={() => applyHistory(ex.id, n)}
                      className="px-2.5 py-1 rounded-full bg-paper border border-line text-[12px] text-ink hover:border-clay/50 hover:text-clay transition"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}

              {/* 匹配到历史记录：提示上次数据，一键带入 */}
              {last.length > 0 && (
                <div className="mt-2 flex items-center justify-between text-[12px]">
                  <span className="text-muted">上次：{formatSets(last)}</span>
                  {setsEmpty && (
                    <button onClick={() => applyHistory(ex.id, ex.name.trim())} className="text-clay hover:underline">带入 ↑</button>
                  )}
                </div>
              )}

              <div className="mt-3 space-y-2">
                {ex.sets.map((s, sIdx) => (
                  <div key={sIdx} className="flex items-center gap-2">
                    <span className="text-[13px] text-muted w-10 shrink-0">第{sIdx + 1}组</span>
                    <input
                      value={s.reps}
                      onChange={(e) => updateSet(ex.id, sIdx, 'reps', e.target.value)}
                      inputMode="numeric"
                      placeholder="次数"
                      className="w-20 px-2 py-1.5 rounded-xl border border-line bg-paper text-ink placeholder:text-muted/70 focus:outline-none focus:border-clay focus:ring-2 focus:ring-clay/20"
                    />
                    <input
                      value={s.weight}
                      onChange={(e) => updateSet(ex.id, sIdx, 'weight', e.target.value)}
                      inputMode="decimal"
                      placeholder="kg(可选)"
                      className="w-24 px-2 py-1.5 rounded-xl border border-line bg-paper text-ink placeholder:text-muted/70 focus:outline-none focus:border-clay focus:ring-2 focus:ring-clay/20"
                    />
                    {ex.sets.length > 1 && (
                      <button onClick={() => removeSet(ex.id, sIdx)} className="text-muted/50 hover:text-clay text-sm">✕</button>
                    )}
                  </div>
                ))}
              </div>

              <button onClick={() => addSet(ex.id)} className="mt-2 text-[13px] text-clay hover:underline">+ 加一组</button>
            </div>
          )
        })}
      </div>

      <button onClick={addExercise} className="mt-4 text-[14px] text-clay hover:underline">+ 加一个动作</button>

      <button
        onClick={handleSave}
        className="mt-6 w-full py-3 rounded-xl bg-clay text-white font-medium hover:bg-clay/90 active:scale-[0.98] transition"
      >
        {alreadyToday ? '追加到今天的训练' : '保存并打卡'}
      </button>
    </div>
  )
}
