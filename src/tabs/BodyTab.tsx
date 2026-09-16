import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { AppSettings, MetricEntry, MetricType } from '../types'
import { ageFromBirthYear, bmi, bmiCategory, bmrMifflin, fatMass, leanMass, movingAverage, weightVelocity } from '../lib/body'
import { todayStr } from '../lib/streak'
import { ProgressPhotos } from '../components/ProgressPhotos'

const METRICS: { type: MetricType; label: string; unit: string; placeholder: string; hint: string }[] = [
  { type: 'weight', label: '体重', unit: 'kg', placeholder: '70.5', hint: '晨起空腹、同一台秤；单日波动多为水分，看趋势' },
  { type: 'bodyFat', label: '体脂率', unit: '%', placeholder: '18', hint: '家用秤误差约 ±3-5%，只在同一台秤、相同条件下看趋势' },
  { type: 'waist', label: '腰围', unit: 'cm', placeholder: '80', hint: '肚脐上方自然最细处水平一圈，正常呼气末读数' },
  { type: 'chest', label: '胸围', unit: 'cm', placeholder: '98', hint: '男性沿乳头水平一圈，软尺背后不扭转' },
  { type: 'hips', label: '臀围', unit: 'cm', placeholder: '92', hint: '臀部最丰满处水平一圈，双脚并拢' },
  { type: 'upperArm', label: '上臂围', unit: 'cm', placeholder: '33', hint: '屈臂收紧时二头肌最粗处，固定同一侧' },
  { type: 'thigh', label: '大腿围', unit: 'cm', placeholder: '55', hint: '臀褶下方大腿最粗处水平一圈，重心均分双腿' },
]

function token(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

export function BodyTab({
  metrics,
  settings,
  onSaveMetric,
  onDeleteMetric,
  onUpdateSettings,
}: {
  metrics: MetricEntry[]
  settings: AppSettings
  onSaveMetric: (type: MetricType, date: string, value: number) => void
  onDeleteMetric: (id: string) => void
  onUpdateSettings: (patch: Partial<AppSettings>) => void
}) {
  const today = todayStr()
  const [type, setType] = useState<MetricType>('weight')
  const [value, setValue] = useState('')
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileDraft, setProfileDraft] = useState({
    heightCm: String(settings.heightCm ?? ''),
    birthYear: String(settings.birthYear ?? ''),
    sex: settings.sex ?? ('male' as 'male' | 'female'),
  })

  const meta = METRICS.find((m) => m.type === type)!
  const clay = token('--color-clay', '#B8553A')
  const muted = token('--color-muted', '#8C8275')
  const line = token('--color-line', '#E2DBCD')

  const series = useMemo(
    () =>
      metrics
        .filter((m) => m.type === type)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((m) => ({ ...m, x: `${Number(m.date.slice(5, 7))}/${Number(m.date.slice(8, 10))}` })),
    [metrics, type],
  )
  const chartData = useMemo(() => {
    if (type === 'weight') {
      return movingAverage(series.map((s) => ({ date: s.date, value: s.value }))).map((p) => ({
        x: `${Number(p.date.slice(5, 7))}/${Number(p.date.slice(8, 10))}`,
        value: p.value,
        avg: p.avg,
      }))
    }
    return series.map((s) => ({ x: s.x, value: s.value }))
  }, [series, type])

  const todayEntry = series.find((e) => e.date === today)
  const latest = series[series.length - 1]
  const prev = series[series.length - 2]

  function handleSave() {
    const kg = Number(value)
    if (!value || !Number.isFinite(kg) || kg <= 0 || kg >= 1000) return
    onSaveMetric(type, today, kg)
    setValue('')
  }

  // 派生指标
  const latestOf = (t: MetricType) => metrics.filter((m) => m.type === t).sort((a, b) => b.date.localeCompare(a.date))[0]
  const weight = latestOf('weight')
  const fat = latestOf('bodyFat')
  const heightCm = settings.heightCm
  const age = ageFromBirthYear(settings.birthYear)
  // 近 4 周体重速度（减脂/增肌目标下对照设定速度）
  const velocity = type === 'weight' ? weightVelocity(metrics) : null
  const velocityText = velocity && settings.dietGoal && settings.dietGoal !== 'maintain'
    ? `近 ${velocity.weeks} 周 ${velocity.delta > 0 ? '+' : ''}${velocity.delta}kg（≈${Math.abs(velocity.kgPerWeek)}kg/周${velocity.kgPerWeek > 0 ? '增重' : '减重'} · 目标 ${settings.dietPace ?? 0.5}kg/周）`
    : null

  const derived = weight && heightCm
    ? {
        bmi: bmi(weight.value, heightCm),
        fat: fat ? fatMass(weight.value, fat.value) : null,
        lean: fat ? leanMass(weight.value, fat.value) : null,
        bmr: settings.sex && age > 0 ? bmrMifflin(weight.value, heightCm, age, settings.sex) : null,
      }
    : null

  function saveProfile() {
    const h = Number(profileDraft.heightCm)
    const y = Number(profileDraft.birthYear)
    onUpdateSettings({
      heightCm: h > 0 ? h : undefined,
      birthYear: y >= 1900 ? y : undefined,
      sex: profileDraft.sex,
    })
    setEditingProfile(false)
  }

  return (
    <div className="px-7 pt-16 pb-10">
      <h1 className="font-display text-[28px] text-ink text-center">身体</h1>

      {/* 指标切换 */}
      <div className="mt-4 flex flex-wrap justify-center gap-1.5">
        {METRICS.map((m) => (
          <button
            key={m.type}
            onClick={() => { setType(m.type); setValue('') }}
            className={`px-4 py-1.5 rounded-full text-[13px] border transition ${type === m.type ? 'bg-clay text-white border-clay' : 'border-line text-muted hover:text-clay'}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] text-muted">{meta.hint}</p>

      {/* 录入 */}
      <div className="mt-5 flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          inputMode="decimal"
          placeholder={`今天的${meta.label}（${meta.placeholder}）`}
          className="flex-1 px-4 py-3 rounded-xl border border-line bg-paper text-ink placeholder:text-muted-weak focus:outline-none focus:border-clay focus:ring-2 focus:ring-clay/20"
        />
        <button
          onClick={handleSave}
          disabled={!value}
          className="px-5 py-3 rounded-xl bg-clay text-white disabled:opacity-30 hover:bg-clay/90 active:scale-95 transition"
        >
          {todayEntry ? '更新' : '记录'}
        </button>
      </div>

      {/* 当前值 */}
      {!latest && (
        <div className="mt-5 rounded-2xl bg-surface border border-dashed border-line p-5 text-center">
          <p className="text-[13px] text-muted leading-relaxed">记录第一笔体重后，这里会出现趋势曲线和 BMI / 基础代谢等派生数据</p>
          <p className="mt-1 text-[11px] text-muted-weak">先在下方「身体资料」填身高和出生年，热量目标准备好了</p>
        </div>
      )}
      {latest && (
        <div className="mt-5 rounded-2xl bg-surface border border-line p-5 text-center">
          <p className="font-display text-[14px] text-muted">最近记录 · {latest.date}</p>
          <p className="font-display text-[40px] leading-none mt-1 text-clay tabular-nums">
            {latest.value}<span className="text-[18px] text-muted"> {meta.unit}</span>
          </p>
          {prev && (
            <p className={`mt-2 text-[13px] ${latest.value - prev.value > 0 ? 'text-muted' : 'text-clay'}`}>
              较上次 {latest.value - prev.value > 0 ? '+' : ''}{Math.round((latest.value - prev.value) * 10) / 10} {meta.unit}
            </p>
          )}
        </div>
      )}

      {/* 派生指标 */}
      {derived && (
        <div className="mt-4 rounded-2xl bg-surface border border-line p-4">
          <p className="font-display text-[13px] italic text-muted mb-3">自动派生</p>
          <div className="grid grid-cols-2 gap-y-3 text-[13px]">
            <div>
              <p className="font-display text-[20px] text-clay leading-none">{derived.bmi}</p>
              <p className="text-[11px] text-muted mt-1">BMI · {bmiCategory(derived.bmi)}</p>
            </div>
            {derived.bmr != null && (
              <div>
                <p className="font-display text-[20px] text-ink leading-none">{derived.bmr}<span className="text-[11px] text-muted"> kcal</span></p>
                <p className="text-[11px] text-muted mt-1">基础代谢（Mifflin）</p>
              </div>
            )}
            {derived.fat != null && (
              <div>
                <p className="font-display text-[20px] text-ink leading-none">{derived.fat}<span className="text-[11px] text-muted"> kg</span></p>
                <p className="text-[11px] text-muted mt-1">脂肪量</p>
              </div>
            )}
            {derived.lean != null && (
              <div>
                <p className="font-display text-[20px] text-ink leading-none">{derived.lean}<span className="text-[11px] text-muted"> kg</span></p>
                <p className="text-[11px] text-muted mt-1">瘦体重</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 个人资料（派生指标需要） */}
      <div className="mt-3 rounded-2xl bg-surface border border-line p-4">
        <button onClick={() => { setEditingProfile(!editingProfile); setProfileDraft({ heightCm: String(settings.heightCm ?? ''), birthYear: String(settings.birthYear ?? ''), sex: settings.sex ?? 'male' }) }} className="w-full flex items-center justify-between text-[13px]">
          <span className="font-display italic text-muted">身体资料 · 用于计算 BMI/代谢</span>
          <span className="text-clay">{editingProfile ? '收起' : (heightCm ? `${heightCm}cm · ${settings.sex === 'female' ? '女' : '男'}${age ? ' · ' + age + '岁' : ''}` : '去填写 ›')}</span>
        </button>
        {editingProfile && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <input
                value={profileDraft.heightCm}
                onChange={(e) => setProfileDraft({ ...profileDraft, heightCm: e.target.value })}
                inputMode="numeric"
                placeholder="身高 cm"
                className="w-24 px-3 py-2 rounded-lg border border-line bg-paper text-base text-ink placeholder:text-muted-weak focus:outline-none focus:border-clay"
              />
              <input
                value={profileDraft.birthYear}
                onChange={(e) => setProfileDraft({ ...profileDraft, birthYear: e.target.value })}
                inputMode="numeric"
                placeholder="出生年"
                className="w-24 px-3 py-2 rounded-lg border border-line bg-paper text-base text-ink placeholder:text-muted-weak focus:outline-none focus:border-clay"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                {(['male', 'female'] as const).map((sx) => (
                  <button
                    key={sx}
                    onClick={() => setProfileDraft({ ...profileDraft, sex: sx })}
                    className={`px-3 py-1 rounded-full text-[12px] border ${profileDraft.sex === sx ? 'bg-clay text-white border-clay' : 'border-line text-muted'}`}
                  >
                    {sx === 'male' ? '男' : '女'}
                  </button>
                ))}
              </div>
              <button onClick={saveProfile} className="px-3 py-1 rounded-lg bg-clay text-white text-[12px]">保存资料</button>
            </div>
          </div>
        )}
      </div>

      {/* 进度照片（入口前置，避免被长列表埋住） */}
      <ProgressPhotos />

      {/* 趋势 */}
      {chartData.length >= 2 && (
        <div className="mt-4 rounded-2xl bg-surface border border-line p-4">
          <p className="font-display text-[13px] italic text-muted mb-2">
            {meta.label}趋势{type === 'weight' ? ' · 细线为 7 日平均' : ''}
          </p>
          {velocityText && <p className="text-[11px] text-clay mb-2">{velocityText}</p>}
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
              <CartesianGrid stroke={line} vertical={false} />
              <XAxis dataKey="x" tick={{ fontSize: 11, fill: muted }} axisLine={{ stroke: line }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: muted }} axisLine={false} tickLine={false} domain={type === 'weight' ? ['dataMin - 2', 'dataMax + 2'] : ['auto', 'auto']} width={44} />
              <Tooltip content={<MetricTooltip unit={meta.unit} />} />
              {type === 'weight' && <Line type="monotone" dataKey="avg" stroke={muted} strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />}
              <Line type="monotone" dataKey="value" stroke={clay} strokeWidth={2} dot={{ r: 3, fill: clay }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 历史 */}
      {series.length > 0 && (
        <div className="mt-4">
          <p className="font-display text-[13px] italic text-muted mb-2">记录列表</p>
          <ul className="space-y-2">
            {[...series].reverse().map((e) => (
              <li key={e.id} className="flex items-center justify-between rounded-xl bg-surface border border-line px-4 py-3">
                <span className="text-[14px] text-ink">{e.date}</span>
                <span className="flex items-center gap-3">
                  <span className="text-[14px] text-muted">{e.value} {meta.unit}</span>
                  <button onClick={() => onDeleteMetric(e.id)} className="text-muted/50 hover:text-clay text-sm">✕</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function MetricTooltip({ active, payload, unit }: { active?: boolean; payload?: Array<{ payload: { x: string; value: number } }>; unit: string }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] text-ink shadow">
      {p.x} · {p.value} {unit}
    </div>
  )
}
