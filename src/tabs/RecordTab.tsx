import { useEffect, useState } from 'react'
import type { Exercise, Routine, SetEntry, Workout } from '../types'
import { todayStr } from '../lib/streak'
import { dayLabel, shiftDate } from '../lib/date'
import { COMMON_EXERCISES, formatSets, lastSetsFor, recentExerciseNames } from '../lib/exercises'
import { nextSuggestion } from '../lib/progression'
import { estimate1RM } from '../lib/pr'
import type { RestTimerApi } from '../hooks/useRestTimer'
import { validExercises } from '../lib/routines'

// 表单里的"一组"用字符串（input 的 value 一律是字符串），保存时再转成数字
type DraftSet = { reps: string; weight: string; done: boolean }
type DraftExercise = { id: string; name: string; sets: DraftSet[] }

const uid = () => globalThis.crypto?.randomUUID?.() ?? `id_${Date.now()}_${Math.random().toString(36).slice(2)}`

function emptyExercise(): DraftExercise {
  return { id: uid(), name: '', sets: [{ reps: '', weight: '', done: false }] }
}

// 把历史组数据转成表单草稿（重量可能为空）
function toDraftSets(sets: SetEntry[]): DraftSet[] {
  return sets.map((s) => ({ reps: String(s.reps), weight: s.weight != null ? String(s.weight) : '' , done: false }))
}

export function RecordTab({
  onSave,
  onBeginWorkout,
  workouts,
  routines,
  onUpsertRoutine,
  onDeleteRoutine,
  restTimer,
}: {
  onSave: (w: Workout) => void
  onBeginWorkout: () => void
  workouts: Workout[]
  routines: Routine[]
  onUpsertRoutine: (name: string, exercises: { name: string; sets: SetEntry[] }[]) => void
  onDeleteRoutine: (id: string) => void
  restTimer: RestTimerApi
}) {
  const today = todayStr()
  const [date, setDate] = useState(today)
  const isToday = date === today
  const alreadyOnDate = workouts.some((w) => w.date === date)
  const existingNote = workouts.find((w) => w.date === date)?.note
  const [exercises, setExercises] = useState<DraftExercise[]>([emptyExercise()])
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [confirmLoad, setConfirmLoad] = useState<string | null>(null)
  const [savedHint, setSavedHint] = useState<string | null>(null)
  const [note, setNote] = useState('')

  // 最近练过的动作：前 6 个做快捷胶囊
  const recent = recentExerciseNames(workouts, 6)
  // 输入框下拉候选 = 历史动作（优先）+ 常见动作（补齐），保证新用户也有可选项
  const allNames = [...new Set([...recentExerciseNames(workouts), ...COMMON_EXERCISES])]

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
    setNote('')
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
    setNote('')
  }

  function addExercise() {
    setExercises((p) => [...p, emptyExercise()])
  }
  function removeExercise(id: string) {
    setExercises((p) => p.filter((e) => e.id !== id))
  }
  function setName(id: string, name: string) {
    if (isToday) onBeginWorkout()
    setExercises((p) => p.map((e) => (e.id === id ? { ...e, name } : e)))
  }
  function addSet(exId: string) {
    setExercises((p) => p.map((e) => (e.id === exId ? { ...e, sets: [...e.sets, { reps: '', weight: '', done: false }] } : e)))
  }
  function removeSet(exId: string, idx: number) {
    setExercises((p) => p.map((e) => (e.id === exId ? { ...e, sets: e.sets.filter((_, i) => i !== idx) } : e)))
  }
  function updateSet(exId: string, idx: number, field: 'reps' | 'weight', value: string) {
    if (isToday) onBeginWorkout()
    setExercises((p) =>
      p.map((e) => (e.id === exId ? { ...e, sets: e.sets.map((s, i) => (i === idx ? { ...s, [field]: value } : s)) } : e)),
    )
  }
  // 勾选完成一组：标记本组并启动休息计时
  function toggleSetDone(exId: string, idx: number) {
    setExercises((p) =>
      p.map((e) =>
        e.id === exId
          ? { ...e, sets: e.sets.map((s, i) => (i === idx ? { ...s, done: !s.done } : s)) }
          : e,
      ),
    )
    const ex = exercises.find((e) => e.id === exId)
    const set = ex?.sets[idx]
    if (set && !set.done && isToday) {
      onBeginWorkout()
      restTimer.start()
    }
  }

  // 选历史动作：填入名字，并把上次的重量/次数整组带进来
  function applyHistory(id: string, name: string) {
    if (isToday) onBeginWorkout()
    const last = lastSetsFor(workouts, name)
    setExercises((p) =>
      p.map((e) => (e.id === id ? { ...e, name, sets: last.length > 0 ? toDraftSets(last) : e.sets } : e)),
    )
  }

  // 应用渐进超负荷建议：把建议的次数/重量填进当前所有组（组数保持不变）
  function applySuggestion(id: string, suggested: { reps: number; weight?: number }[]) {
    if (isToday) onBeginWorkout()
    setExercises((p) =>
      p.map((e) => {
        if (e.id !== id) return e
        return {
          ...e,
          sets: e.sets.map((s, i) => {
            const sug = suggested[Math.min(i, suggested.length - 1)]
            return { ...s, reps: String(sug.reps), weight: sug.weight ? String(sug.weight) : '' }
          }),
        }
      }),
    )
  }

  // 表单是否填了内容（载入模板前判断要不要二次确认覆盖）
  function formDirty(): boolean {
    return exercises.some((e) => e.name.trim() || e.sets.some((s) => s.reps || s.weight))
  }

  // 点模板：表单为空直接载入；有内容时点第二次确认覆盖
  function tapRoutine(r: Routine) {
    if (isToday) onBeginWorkout()
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
    onSave({ id: uid(), date, exercises: valid, createdAt: Date.now(), note: note.trim() || undefined })
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

      {/* 组间休息计时 */}
      {restTimer.remaining !== null ? (
        <div className="mt-3 flex items-center justify-center gap-2">
          {restTimer.finished ? (
            <span className="font-display text-[20px] text-clay min-w-[120px] text-center">休息结束 ✓</span>
          ) : (
            <>
              <button onClick={() => restTimer.addSecs(-15)} aria-label="减少 15 秒" className="h-8 w-8 -m-1 p-1 box-content rounded-full border border-line text-muted text-sm hover:text-clay">-15s</button>
              <span className="font-display text-[22px] text-clay min-w-[64px] text-center tabular-nums">
                {restTimer.mmss(restTimer.remaining)}
              </span>
              <button onClick={() => restTimer.addSecs(15)} aria-label="增加 15 秒" className="h-8 w-8 -m-1 p-1 box-content rounded-full border border-line text-muted text-sm hover:text-clay">+15s</button>
              <button onClick={restTimer.skip} className="ml-1 text-[12px] text-muted-weak hover:text-clay">跳过</button>
            </>
          )}
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          <span className="text-[11px] text-muted-weak mr-0.5">⏱ 休息</span>
          {[60, 90, 120, 180].map((sec) => (
            <button key={sec} onClick={() => restTimer.start(sec)} className="px-2 py-0.5 rounded-full border border-line text-[11px] text-muted hover:border-clay/50 hover:text-clay">
              {sec}s
            </button>
          ))}
        </div>
      )}

      {/* 训练模板 */}
      {routines.length > 0 && (
        <div className="mt-4">
          <p className="font-display text-[12px] italic text-muted mb-1.5">我的模板 · 点按填入</p>
          <div className="flex flex-wrap gap-1.5">
            {routines.map((r) => (
              <span key={r.id} className={`inline-flex items-center rounded-full border text-[12px] ${confirmLoad === r.id ? 'border-clay bg-clay/10' : 'border-line bg-paper'}`}>
                <button onClick={() => tapRoutine(r)} className="py-1 pl-2.5 pr-1.5 text-ink hover:text-clay transition">
                  {confirmLoad === r.id ? '再点一次覆盖' : `📂 ${r.name}`}
                </button>
                <button
                  onClick={() => onDeleteRoutine(r.id)}
                  aria-label={`删除模板 ${r.name}`}
                  className="-my-1.5 -mr-1.5 py-1.5 px-2 text-muted/50 hover:text-clay"
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
                  className="flex-1 px-3 py-2 rounded-xl border border-line bg-paper text-ink placeholder:text-muted-weak focus:outline-none focus:border-clay focus:ring-2 focus:ring-clay/20"
                />
                {exercises.length > 1 && (
                  <button onClick={() => removeExercise(ex.id)} className="text-muted/50 hover:text-clay text-sm">删除</button>
                )}
              </div>

              {/* 历史动作快捷选择；无历史时显示常见动作 */}
              {!ex.name.trim() && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {recent.length > 0 ? recent.map((n) => (
                    <button
                      key={n}
                      onClick={() => applyHistory(ex.id, n)}
                      className="px-2.5 py-1 rounded-full bg-paper border border-line text-[12px] text-ink hover:border-clay/50 hover:text-clay transition"
                    >
                      {n}
                    </button>
                  )) : (
                    <>
                      {COMMON_EXERCISES.slice(0, 8).map((n) => (
                        <button
                          key={n}
                          onClick={() => applyHistory(ex.id, n)}
                          className="px-2.5 py-1 rounded-full bg-paper border border-dashed border-line text-[12px] text-muted hover:border-clay/50 hover:text-clay transition"
                        >
                          {n}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
              {!ex.name.trim() && recent.length === 0 && (
                <p className="mt-1 text-[10px] text-muted-weak">新手常练这 8 个动作，点名字直接用</p>
              )}

              {/* 匹配到历史记录：提示上次数据，一键带入；旁边给渐进超负荷建议 */}
              {last.length > 0 && (
                <div className="mt-2 flex items-center justify-between text-[12px]">
                  <span className="text-muted">上次：{formatSets(last)}</span>
                  <span className="flex items-center gap-3">
                    {(() => {
                      const suggestion = nextSuggestion(last)
                      return suggestion && ex.sets.every((s) => !s.reps.trim() && !s.weight.trim()) ? (
                        <button
                          onClick={() => applySuggestion(ex.id, suggestion.sets)}
                          className="rounded-full border border-clay/40 px-2 py-0.5 text-clay"
                        >
                          {suggestion.label} ↑
                        </button>
                      ) : null
                    })()}
                    {ex.sets.every((s) => !s.reps.trim() && !s.weight.trim()) && (
                      <button onClick={() => applyHistory(ex.id, ex.name.trim())} className="text-clay hover:underline">填入 ↑</button>
                    )}
                  </span>
                </div>
              )}

              <div className="mt-3 space-y-2">
                {ex.sets.map((s, sIdx) => {
                  const repsN = Number(s.reps)
                  const weightN = Number(s.weight)
                  const has1RM = s.reps && s.weight && repsN > 0 && weightN > 0
                  return (
                  <div key={sIdx} className={`flex items-center gap-2 ${s.done ? 'opacity-55' : ''}`}>
                    <button
                      onClick={() => toggleSetDone(ex.id, sIdx)}
                      aria-label={`完成第 ${sIdx + 1} 组`}
                      className={`h-7 w-7 shrink-0 -m-1.5 p-1.5 box-content rounded-full border text-[12px] transition ${s.done ? 'bg-clay border-clay text-white' : 'border-line text-transparent hover:border-clay'}`}
                    >
                      ✓
                    </button>
                    <span className={`text-[13px] w-8 shrink-0 ${s.done ? 'text-clay line-through' : 'text-muted'}`}>{sIdx + 1}</span>
                    <input
                      value={s.reps}
                      onChange={(e) => updateSet(ex.id, sIdx, 'reps', e.target.value)}
                      inputMode="numeric"
                      placeholder="次数"
                      className="w-16 px-2 py-1.5 rounded-xl border border-line bg-paper text-ink placeholder:text-muted-weak focus:outline-none focus:border-clay focus:ring-2 focus:ring-clay/20"
                    />
                    <input
                      value={s.weight}
                      onChange={(e) => updateSet(ex.id, sIdx, 'weight', e.target.value)}
                      inputMode="decimal"
                      placeholder="kg"
                      className="w-16 px-2 py-1.5 rounded-xl border border-line bg-paper text-ink placeholder:text-muted-weak focus:outline-none focus:border-clay focus:ring-2 focus:ring-clay/20"
                    />
                    {has1RM && <span className="text-[10px] text-muted w-12 shrink-0">1RM {estimate1RM({ reps: repsN, weight: weightN })}</span>}
                    {ex.sets.length > 1 && (
                      <button onClick={() => removeSet(ex.id, sIdx)} className="text-muted/50 hover:text-clay text-sm">✕</button>
                    )}
                  </div>
                  )
                })}
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
              className="w-32 px-2 py-1.5 rounded-lg border border-line bg-paper text-base text-ink placeholder:text-muted-weak focus:outline-none focus:border-clay"
            />
            <button onClick={saveAsTemplate} className="text-[13px] text-clay hover:underline">保存模板</button>
            <button onClick={() => setSavingTemplate(false)} className="text-[13px] text-muted-weak hover:underline">取消</button>
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

      {existingNote ? (
        <p className="mt-5 text-[12px] text-muted italic px-1">当天备注：{existingNote}（一天一条备注，追加训练不覆盖）</p>
      ) : (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={50}
          placeholder="备注（可选，如：状态差 / PR 了）"
          className="mt-5 w-full px-3 py-2.5 rounded-xl border border-line bg-surface text-base text-ink placeholder:text-muted-weak focus:outline-none focus:border-clay focus:ring-2 focus:ring-clay/20"
        />
      )}

      <button
        onClick={handleSave}
        className="mt-3 w-full py-3 rounded-xl bg-clay text-white font-medium hover:bg-clay/90 active:scale-[0.98] transition"
      >
        {saveLabel}
      </button>
    </div>
  )
}
