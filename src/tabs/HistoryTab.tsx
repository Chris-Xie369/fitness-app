import { useEffect, useRef, useState } from 'react'
import type { MealEntry, MetricEntry, Routine, WaterEntry, Workout } from '../types'
import type { BackupData } from '../storage'
import { backupMetaWarning, dismissBackupHint, exportBackup, loadBackupHintTimes, markExported, parseBackup } from '../storage'
import { backupHintState } from '../lib/backup'
import { exportPhotosForBackup } from '../lib/photos'

const WEEKDAYS = '日一二三四五六'

function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Number(dateStr.slice(0, 4)), m - 1, d)
  return `${m} 月 ${d} 日 · 周${WEEKDAYS[dt.getDay()]}`
}

function todayStamp(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function HistoryTab({
  workouts,
  meals,
  metrics,
  routines,
  water,
  onDelete,
  onRemoveExercise,
  onUpdateSets,
  onBack,
  onImport,
  lastAdded,
  hasCelebration,
}: {
  workouts: Workout[]
  meals: MealEntry[]
  metrics: MetricEntry[]
  routines: Routine[]
  water: WaterEntry[]
  onDelete: (id: string) => void
  onRemoveExercise: (workoutId: string, exerciseId: string) => void
  onUpdateSets: (workoutId: string, exerciseId: string, sets: { reps: number; weight?: number }[]) => void
  onBack: () => void
  onImport: (data: BackupData) => Promise<{ restored: number; skipped: number } | undefined> | undefined
  lastAdded: { at: number; appended: boolean; count: number; date: string } | null
  hasCelebration: boolean
}) {
  const [pendingWarning, setPendingWarning] = useState<string | null>(null)
  // 二次确认：一天的卡片包含当天全部动作，误删整天损失大。第一次点只进入确认态，4 秒自动复位
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [pending, setPending] = useState<BackupData | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [flashDate, setFlashDate] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [monthCursor, setMonthCursor] = useState(() => new Date())
  const [pickedDate, setPickedDate] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftSets, setDraftSets] = useState<{ reps: string; weight: string }[]>([])
  const [editError, setEditError] = useState(false)
  const [hintTimes, setHintTimes] = useState(loadBackupHintTimes)
  const [exporting, setExporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const hint = backupHintState({ now: Date.now(), ...hintTimes, workoutCount: workouts.length })

  useEffect(() => {
    if (!confirmId) return
    const t = setTimeout(() => setConfirmId(null), 4000)
    return () => clearTimeout(t)
  }, [confirmId])

  // 补记保存后落到历史页：提示 + 定位到那天的卡片并短暂高亮；成就弹层开着时等它关闭
  useEffect(() => {
    if (!lastAdded || hasCelebration) return
    const [, m, d] = lastAdded.date.split('-').map(Number)
    setMsg(`已${lastAdded.appended ? '追加' : '补记'}到 ${m}月${d}日：${lastAdded.count} 个动作`)
    requestAnimationFrame(() => {
      const card = document.querySelector(`li[data-date="${lastAdded.date}"]`)
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    setFlashDate(lastAdded.date)
    const backfillMsg = `已${lastAdded.appended ? '追加' : '补记'}到 ${m}月${d}日：${lastAdded.count} 个动作`
    const t1 = setTimeout(() => setFlashDate(null), 2600)
    const t2 = setTimeout(() => setMsg((cur) => (cur === backfillMsg ? null : cur)), 3200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [lastAdded, hasCelebration])

  async function doExport() {
    if (exporting) return
    setExporting(true)
    try {
      const fileName = `fitness-backup-${todayStamp()}.json`
      const data = JSON.parse(exportBackup())
      data.photos = await exportPhotosForBackup()
      const file = new File([JSON.stringify(data, null, 2)], fileName, { type: 'application/json' })
      // iPhone 主屏幕 PWA 里 blob 下载会静默失败：优先系统分享（可存到「文件」/微信/网盘）
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: '健身打卡数据备份' })
          markExported()
          setHintTimes(loadBackupHintTimes())
          setMsg('备份已分享，请保存到安全的地方（文件/微信/网盘）')
        } catch (err) {
          // AbortError = 用户主动取消；文件过大/手势超时等真实失败必须提示
          if ((err as Error)?.name !== 'AbortError') {
            setMsg('分享失败，请重试，或照片较多时先减少照片')
          }
        }
        return
      }
      const url = URL.createObjectURL(new Blob([file], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      markExported()
      setHintTimes(loadBackupHintTimes())
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMsg('备份文件已导出，请保存到安全的地方（文件/微信/网盘）')
    } catch {
      // 照片库读取失败/序列化失败：不阻断，提示重试
      setMsg('导出失败，请重试')
    } finally {
      setExporting(false)
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // 允许再次选同一个文件
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const data = parseBackup(String(reader.result ?? ''))
      if (!data) {
        setPending(null)
        setMsg('文件无法识别，请选择本 App 导出的备份文件')
        return
      }
      setMsg(null)
      setPendingWarning(backupMetaWarning(String(reader.result ?? '')))
      setPending(data)
    }
    reader.readAsText(file)
  }

  async function confirmImport() {
    if (!pending) return
    const photoTotal = pending.photos?.length ?? 0
    const result = await onImport(pending)
    let text = `导入成功：${pending.workouts.length} 天训练 · ${(pending.metrics?.length ?? 0)} 条身体记录 · ${pending.meals.length} 条饮食 · ${pending.routines.length} 个模板`
    if (photoTotal > 0 && result) {
      text += ` · 照片恢复 ${result.restored}/${photoTotal} 张`
      if (result.skipped > 0) text += `（${result.skipped} 张无法恢复）`
    }
    setMsg(text)
    setPending(null)
    setEditingId(null)
    setEditError(false)
  }

  function snoozeHint() {
    setHintTimes(dismissBackupHint())
  }

  function startEdit(exId: string, sets: { reps: number; weight?: number }[]) {
    setEditingId(exId)
    setEditError(false)
    setDraftSets(sets.map((x) => ({ reps: String(x.reps), weight: x.weight != null ? String(x.weight) : '' })))
  }

  function setDraft(i: number, field: 'reps' | 'weight', v: string) {
    setEditError(false)
    setDraftSets((p) => p.map((d, j) => (j === i ? { ...d, [field]: v } : d)))
  }

  function saveEdit(workoutId: string, exerciseId: string) {
    const sets: { reps: number; weight?: number }[] = []
    for (const d of draftSets) {
      const reps = Number(d.reps)
      if (!d.reps || Number.isNaN(reps) || reps <= 0) {
        setEditError(true)
        return // 有非法组就不保存
      }
      const set: { reps: number; weight?: number } = { reps }
      const w = Number(d.weight)
      if (d.weight && !Number.isNaN(w) && w > 0) set.weight = w
      sets.push(set)
    }
    if (sets.length === 0) return
    onUpdateSets(workoutId, exerciseId, sets)
    setEditingId(null)
  }

  // 月历数据
  const trainedDates = new Set(workouts.map((w) => w.date))
  const calYear = monthCursor.getFullYear()
  const calMonth = monthCursor.getMonth()
  const firstWeekday = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const calCells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1
      return `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }),
  ]
  const todayDate = todayStamp()
  const pickedWorkout = pickedDate ? workouts.find((w) => w.date === pickedDate) : null

  return (
    <div className="relative px-7 pt-16 pb-10">
      <button onClick={onBack} className="absolute left-6 top-[54px] text-[15px] text-muted hover:text-clay transition">‹ 返回</button>
      <h1 className="font-display text-[28px] text-ink text-center">历史</h1>

      <div className="mt-2 flex justify-center gap-1.5">
        <button onClick={() => setView('list')} className={`px-3 py-1 rounded-full text-[12px] border transition ${view === 'list' ? 'bg-clay text-white border-clay' : 'border-line text-muted'}`}>列表</button>
        <button onClick={() => setView('calendar')} className={`px-3 py-1 rounded-full text-[12px] border transition ${view === 'calendar' ? 'bg-clay text-white border-clay' : 'border-line text-muted'}`}>月历</button>
      </div>

      {view === 'calendar' && (
        <div className="mt-4 rounded-2xl bg-surface border border-line p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setMonthCursor(new Date(calYear, calMonth - 1, 1))}
              className="h-7 w-7 -m-1.5 p-1.5 box-content rounded-full border border-line text-muted hover:text-clay"
            >‹</button>
            <p className="font-display text-[15px] text-ink">{calYear} 年 {calMonth + 1} 月</p>
            <button
              onClick={() => setMonthCursor(new Date(calYear, calMonth + 1, 1))}
              className="h-7 w-7 -m-1.5 p-1.5 box-content rounded-full border border-line text-muted hover:text-clay"
            >›</button>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] text-muted">
            {'日一二三四五六'.split('').map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {calCells.map((date, i) =>
              date ? (
                <button
                  key={i}
                  onClick={() => setPickedDate(date)}
                  className={`aspect-square rounded-lg text-[12px] flex flex-col items-center justify-center transition
                    ${pickedDate === date ? 'bg-clay text-white' : trainedDates.has(date) ? 'bg-clay/10 text-ink' : 'text-muted-weak hover:bg-paper'}
                    ${date === todayDate ? 'ring-1 ring-clay/50' : ''}`}
                >
                  {Number(date.slice(8, 10))}
                  {trainedDates.has(date) && <span className={`text-[7px] leading-none ${pickedDate === date ? 'text-white' : 'text-clay'}`}>●</span>}
                </button>
              ) : (
                <span key={i} />
              ),
            )}
          </div>
        </div>
      )}

      {view === 'calendar' && pickedDate && (
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <p className="font-display text-[14px] text-ink">{formatDate(pickedDate)}</p>
            <button onClick={() => setPickedDate(null)} className="text-[12px] text-muted-weak hover:text-clay">清除选择</button>
          </div>
          {pickedWorkout ? (
            <ul className="mt-2 space-y-1">
              {pickedWorkout.exercises.map((ex) => (
                <li key={ex.id ?? ex.name} className="text-[13px] text-ink">
                  {ex.name}
                  <span className="text-muted"> — {ex.sets.map((set) => (set.weight ? `${set.reps}×${set.weight}kg` : `${set.reps}次`)).join('、')}</span>
                </li>
              ))}
              {pickedWorkout.note && <p className="text-[12px] text-ink/70 italic mt-1">“{pickedWorkout.note}”</p>}
            </ul>
          ) : (
            <p className="mt-1 text-[12px] text-muted">这天没有训练记录。</p>
          )}
        </div>
      )}

      {view === 'list' && workouts.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-[14px] text-muted">还没有记录。</p>
          <button onClick={onBack} className="mt-3 px-4 py-2 rounded-full bg-clay text-white text-[13px]">去练第一次</button>
        </div>
      ) : view === 'list' ? (
        <ul className="mt-5 space-y-4">
          {workouts.map((w) => (
            <li
              key={w.id}
              data-date={w.date}
              className={`rounded-2xl border p-4 transition-colors duration-500 ${flashDate === w.date ? 'bg-clay/10 border-clay' : 'bg-surface border-line'}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-[15px] text-ink">{formatDate(w.date)}</p>
                  <p className="text-[12px] text-muted mt-0.5">
                    {w.exercises.length} 个动作 · {w.exercises.reduce((n, ex) => n + ex.sets.length, 0)} 组{w.durationSec ? ` · ${Math.round(w.durationSec / 60)} 分钟` : ''}
                  </p>
                  {w.note && <p className="text-[12px] text-ink/70 italic mt-1">“{w.note}”</p>}
                </div>
                {confirmId === w.id ? (
                  <span className="flex items-center gap-2 text-[12px] whitespace-nowrap">
                    <button onClick={() => onDelete(w.id)} className="text-clay">确认删除整天？</button>
                    <button onClick={() => setConfirmId(null)} className="text-muted-weak">取消</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmId(w.id)} className="-m-2 p-2 text-muted/50 hover:text-clay text-sm">删除整天</button>
                )}
              </div>
              <div className="mt-2 h-px bg-line" />
              <ul className="mt-2 space-y-1">
                {w.exercises.map((ex) =>
                  editingId === ex.id ? (
                    <li key={ex.id ?? ex.name} className="rounded-xl bg-paper border border-line p-2.5">
                      <p className="text-[13px] text-ink mb-1.5">{ex.name}</p>
                      <div className="space-y-1.5">
                        {draftSets.map((d, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <span className="text-[11px] text-muted w-8">第{i + 1}组</span>
                            <input
                              value={d.reps}
                              onChange={(e) => setDraft(i, 'reps', e.target.value)}
                              inputMode="numeric"
                              placeholder="次数"
                              className="w-16 px-2 py-1 rounded-lg border border-line bg-surface text-base focus:outline-none focus:border-clay"
                            />
                            <input
                              value={d.weight}
                              onChange={(e) => setDraft(i, 'weight', e.target.value)}
                              inputMode="decimal"
                              placeholder="kg"
                              className="w-16 px-2 py-1 rounded-lg border border-line bg-surface text-base focus:outline-none focus:border-clay"
                            />
                          </div>
                        ))}
                      </div>
                      {editError && <p className="mt-2 text-[12px] text-clay">每组次数都要大于 0；想删整组请用列表右侧的 ✕</p>}
                      <div className="mt-2 flex justify-end gap-3 text-[12px]">
                        <button onClick={() => { setEditingId(null); setEditError(false) }} className="text-muted-weak hover:text-ink">取消</button>
                        <button onClick={() => saveEdit(w.id, ex.id!)} className="text-clay font-medium">保存修改</button>
                      </div>
                    </li>
                  ) : (
                    <li key={ex.id ?? ex.name} className="group flex items-center justify-between gap-2 text-[14px] text-ink">
                      <button
                        onClick={() => ex.id && startEdit(ex.id, ex.sets)}
                        className="min-w-0 flex-1 text-left leading-snug"
                      >
                        {ex.name}
                        <span className="text-muted"> — {ex.sets.map((s) => (s.weight ? `${s.reps}×${s.weight}kg` : `${s.reps}次`)).join('、')}</span>
                      </button>
                      <button
                        onClick={() => ex.id && onRemoveExercise(w.id, ex.id)}
                        aria-label={`删除 ${ex.name}`}
                        className="-m-2.5 p-2.5 shrink-0 leading-none text-muted/50 hover:text-clay text-sm"
                      >
                        ✕
                      </button>
                    </li>
                  ),
                )}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}

      {/* 数据管理：localStorage 换机/清缓存即丢，定期导出留个安全网 */}
      <div className="mt-8 rounded-2xl bg-surface border border-line p-4">
        <p className="font-display text-[13px] italic text-muted mb-1">数据管理</p>
        <p className="text-[12px] text-muted leading-relaxed">数据只存在这台手机上，换手机或清缓存前请先导出备份。</p>
        {hint.show && (
          <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl bg-clay/10 border border-clay/30 px-3 py-2">
            <p className="text-[12px] text-ink">
              {hint.reason === 'never' ? '已有几天的训练记录，建议现在导出第一份备份' : '距上次导出已超过 30 天，建议更新备份'}
            </p>
            <button onClick={snoozeHint} className="shrink-0 text-[12px] text-clay hover:underline">知道了</button>
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <button onClick={() => void doExport()} disabled={exporting} className="flex-1 py-2.5 rounded-xl border border-line text-[13px] text-ink hover:border-clay/40 hover:text-clay transition disabled:opacity-40">
            {exporting ? '正在导出...' : '导出备份'}
          </button>
          <button onClick={() => fileRef.current?.click()} className="flex-1 py-2.5 rounded-xl border border-line text-[13px] text-ink hover:border-clay/40 hover:text-clay transition">
            导入恢复
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} className="hidden" />
        </div>

        {pending && (
          <div className="mt-3 rounded-xl bg-paper border border-clay/30 p-3 text-[12px]">
            <p className="text-ink">
              本机现有 {workouts.length} 天训练 · {meals.length} 条饮食 · {metrics.length} 条身体记录 · {routines.length} 个模板 · {water.length} 天饮水，将被替换为备份中的 {pending.workouts.length} 天训练 · {pending.meals.length} 条饮食 · {(pending.metrics?.length ?? 0)} 条身体记录 · {pending.routines.length} 个模板 · {pending.water.length} 天饮水{pending.photos?.length ? ` · ${pending.photos.length} 张照片` : ''}
            </p>
            <p className="mt-1 text-muted">导入前已自动保存一份当前数据快照，误操作可联系开发者从本地恢复。</p>
            {pendingWarning && <p className="mt-1 text-clay">{pendingWarning}</p>}
            <div className="mt-2 flex gap-2">
              <button onClick={() => void confirmImport()} className="px-3 py-1.5 rounded-lg bg-clay text-white">确认导入</button>
              <button onClick={() => setPending(null)} className="px-3 py-1.5 rounded-lg text-muted">取消</button>
            </div>
          </div>
        )}
        {msg && <p className="mt-2 text-[12px] text-muted">{msg}</p>}
      </div>
    </div>
  )
}
