import { useEffect, useState } from 'react'
import type { Exercise, Routine, SetEntry, Workout } from '../types'
import { todayStr } from '../lib/streak'
import { dayLabel, shiftDate } from '../lib/date'
import { formatSets, lastSetsFor, recentExerciseNames } from '../lib/exercises'
import { validExercises } from '../lib/routines'

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
  workouts,
  routines,
  onUpsertRoutine,
  onDeleteRoutine,
}: {
  onSave: (w: Workout) => void
  workouts: Workout[]
  routines: Routine[]
  onUpsertRoutine: (name: string, exercises: { name: string; sets: SetEntry[] }[]) => void
  onDeleteRoutine: (id: string) => void
}) {
  const today = todayStr()
  const [date, setDate] = useState(today)
  const isToday = date === today
  const alreadyOnDate = workouts.some((w) => w.date === date)
  const [exercises, setExercises] = useState<DraftExercise[]>([emptyExercise()])
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [confirmLoad, setConfirmLoad] = useState<string | null>(null)
  const [savedHint, setSavedHint] = useState<string | null>(null)

  // 最近练过的动作：前 6 个做快捷胶囊，全部用于输入框自动补全
  const recent = recentExerciseNames(workouts, 6)
  const allNames = recentExerciseNames(workouts)

  useEffect(() => {
    if (!confirmLoad) return
    const t = setTimeout(() => setConfirmLoad(null), 4000)
    return () => clearTimeout(t)
  }, [confirmLoad])

  useEffect(() => {
    if (!savedHint) return
    const t = setTimeout(() => setSavedHint(null), 2000)
    return () => clearTimeout(t)
  }, [savedHint])

  // 切换日期同时清空表单：防止填了一半的动作保存到错误日期
  function goTo(next: string) {
    setDate(next)
    setExercises([emptyExercise()])
    setConfirmLoad(null)
    setSavingTemplate(false)
    setTemplateName('')
  }
  // 函数式更新：快速连点 ‹ › 不会因闭包陈旧而丢步
  function stepDate(delta: number) {
    setDate((prev) => {
      const next = shiftDate(prev, delta)
      return delta > 0 && next > today ? prev : next
    })
    setExercises([emptyExercise()])
    setConfirmLoad(null)
    setSavingTemplate(false)
    setTemplateName('')
  }

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
      p.map((e) => (e.id === exId ? { ...e, sets: e.sets.map((s, i) => (i === idx ? { ...s, [field]: value } : s)) } : e)),
    )
  }
  // 选历史动作：填入名字，并把上次的重量/次数整组带进来
  function applyHistory(id: string, name: string) {
    const last = lastSetsFor(workouts, name)
    setExercises((p) =>
      p.map((e) => (e.id === id ? { ...e, name, sets: last.length > 0 ? toDraftSets(last) : e.sets } : e)),
    )
  }

  // 表单是否填了内容（载入模板前判断要不要二次确认覆盖）
  function formDirty(): boolean {
    return exercises.some((e) => e.name.trim() || e.sets.some((s) => s.reps || s.weight))
  }

  // 点模板：表单为空直接载入；有内容时点第二次确认覆盖
  function tapRoutine(r: Routine) {
    if (formDirty() && confirmLoad !== r.id) {
      setConfirmLoad(r.id)
      return
    }
    setConfirmLoad(null)
    setExercises(r.exercises.map((ex) => ({ id: uid(), name: ex.name, sets: toDraftSets(ex.sets) })))
  }

  function buildValid(): Exercise[] {
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
      if (sets.length > 0) valid.push({ id: uid(), name, sets })
    }
    return valid
  }

  function handleSave() {
    const valid = buildValid()
    if (valid.length === 0) return
    onSave({ id: uid(), date, exercises: valid, createdAt: Date.now() })
    setExercises([emptyExercise()]) // 重置表单
  }

  function saveAsTemplate() {
    const valid = validExercises(buildValid())
    const name = templateName.trim()
    if (!name || valid.length === 0) return
    onUpsertRoutine(name, valid.map((e) => ({ name: e.name, sets: e.sets })))
    setTemplateName('')
    setSavingTemplate(false)
    setSavedHint(`模板「${name}」已保存`)
  }

  const shortLabel = dayLabel(date).replace(/^(今天|昨天) · /, '')
  const subtitle = isToday
    ? alreadyOnDate
      ? '动作将追加到今天的训练'
      : '保存后即完成今天打卡'
    : alreadyOnDate
      ? `动作将追加到 ${shortLabel} 的训练`
      : `补记到 ${shortLabel}`

  const saveLabel = isToday
    ? alreadyOnDate
      ? '追加到今天的训练'
      : '保存并打卡'
    : alreadyOnDate
      ? '追加到这天的训练'
      : '保存补记'

  return (
    <div className="px-7 pt-16 pb-10">
      <h1 className="font-display text-[28px] text-ink text-center">记录训练</h1>

      {/* 日期切换：补记过去任意一天（未来日不可选） */}
      <div className="mt-3 flex items-center justify-center gap-3">
        <button
          onClick={() => stepDate(-1)}
          className="h-8 w-8 rounded-full border border-line text-muted hover:text-clay hover:border-clay/40 transition"
          aria-label="前一天"
        >
          ‹
        </button>
        <p className="min-w-[150px] text-center text-[14px] text-ink">{dayLabel(date)}</p>
        <button
          onClick={() => stepDate(1)}
          disabled={isToday}
          className="h-8 w-8 rounded-full border border-line text-muted transition enabled:hover:text-clay enabled:hover:border-clay/40 disabled:opacity-30"
          aria-label="后一天"
        >
          ›
        </button>
      </div>
      {!isToday && (
        <div className="mt-2 text-center">
          <button onClick={() => goTo(today)} className="-my-2 py-2 px-3 text-[12px] text-clay hover:underline">回到今天</button>
        </div>
      )}
      <p className="text-[13px] text-muted mt-2 text-center">{subtitle}</p>

      {/* 训练模板 */}
      {routines.length > 0 && (
        <div className="mt-4">
          <p className="font-display text-[12px] italic text-muted mb-1.5">我的模板 · 点按载入</p>
          <div className="flex flex-wrap gap-1.5">
            {routines.map((r) => (
              <span key={r.id} className={`inline-flex items-center rounded-full border text-[12px] ${confirmLoad === r.id ? 'border-clay bg-clay/10' : 'border-line bg-paper'}`}>
                <button onClick={() => tapRoutine(r)} className="py-1 pl-2.5 pr-1.5 text-ink hover:text-clay transition">
                  {confirmLoad === r.id ? '再点一次覆盖' : `📂 ${r.name}`}
                </button>
                <button
                  onClick={() => onDeleteRoutine(r.id)}
                  aria-label={`删除模板 ${r.name}`}
                  className="-my-1.5 -mr-1.5 py-1.5 px-2 text-muted/40 hover:text-clay"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <datalist id="exercise-names">
        {allNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <div className="mt-5 space-y-5">
        {exercises.map((ex, exIdx) => {
          const last = ex.name.trim() ? lastSetsFor(workouts, ex.name) : []
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
                  {ex.sets.every((s) => !s.reps.trim() && !s.weight.trim()) && (
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

      <div className="mt-4 flex items-center justify-between">
        <button onClick={addExercise} className="text-[14px] text-clay hover:underline">+ 加一个动作</button>
        {savingTemplate ? (
          <span className="flex items-center gap-1.5">
            <input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveAsTemplate()}
              placeholder="模板名，如：推日"
              autoFocus
              className="w-32 px-2 py-1.5 rounded-lg border border-line bg-paper text-[13px] text-ink placeholder:text-muted/70 focus:outline-none focus:border-clay"
            />
            <button onClick={saveAsTemplate} className="text-[13px] text-clay hover:underline">保存</button>
            <button onClick={() => setSavingTemplate(false)} className="text-[13px] text-muted/60 hover:underline">取消</button>
          </span>
        ) : (
          <button
            onClick={() => setSavingTemplate(true)}
            disabled={buildValid().length === 0}
            className="text-[13px] text-muted hover:text-clay enabled:hover:underline disabled:opacity-30 transition"
          >
            💾 存为模板
          </button>
        )}
      </div>
      {savedHint && <p className="mt-2 text-right text-[12px] text-clay">{savedHint}</p>}

      <button
        onClick={handleSave}
        className="mt-6 w-full py-3 rounded-xl bg-clay text-white font-medium hover:bg-clay/90 active:scale-[0.98] transition"
      >
        {saveLabel}
      </button>
    </div>
  )
}
