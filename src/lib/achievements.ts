import type { MealEntry, Workout } from '../types'

export type Achievement = {
  id: string
  emoji: string
  title: string
  desc: string
  cur: number
  target: number
  unit: string
  earned: boolean
}

// 历史最长连续打卡天数。用日期分量比较相邻，不做毫秒减法（DST 切换夜相邻午夜差 23/25h）
export function longestStreak(workouts: Workout[]): number {
  const days = [...new Set(workouts.map((w) => w.date))].sort()
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const s of days) {
    if (prev !== null) {
      const [y, m, d] = prev.split('-').map(Number)
      const next = new Date(y, m - 1, d + 1)
      const key = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
      run = s === key ? run + 1 : 1
    } else {
      run = 1
    }
    best = Math.max(best, run)
    prev = s
  }
  return best
}


// 当前连续记录饮食的天数（今天还没记时从昨天起算，避免白天显示断档）
export function mealStreak(meals: MealEntry[], now = new Date()): number {
  const days = new Set(meals.map((m) => m.date))
  let d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (!days.has(fmtDate(d))) d.setDate(d.getDate() - 1)
  let run = 0
  while (days.has(fmtDate(d))) {
    run++
    d.setDate(d.getDate() - 1)
  }
  return run
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 从训练记录推导全部成就（含未达成的进度）
export function achievements(workouts: Workout[], meals: MealEntry[] = []): Achievement[] {
  const days = new Set(workouts.map((w) => w.date)).size
  const streak = longestStreak(workouts)
  const sets = workouts.reduce(
    (n, w) => n + w.exercises.reduce((a, ex) => a + ex.sets.length, 0),
    0,
  )
  const kinds = new Set(workouts.flatMap((w) => w.exercises.map((e) => e.name.trim()))).size

  const mk = (
    id: string,
    emoji: string,
    title: string,
    desc: string,
    cur: number,
    target: number,
    unit: string,
  ): Achievement => ({ id, emoji, title, desc, cur: Math.min(cur, target), target, unit, earned: cur >= target })

  return [
    mk('first', '🌱', '初次打卡', '完成第一次训练', days, 1, '天'),
    mk('streak3', '🔥', '三连击', '连续打卡 3 天', streak, 3, '天'),
    mk('streak7', '⭐', '连练一周', '连续打卡 7 天', streak, 7, '天'),
    mk('days30', '📅', '累计30天', '累计打卡 30 天', days, 30, '天'),
    mk('streak30', '👑', '连练30天', '连续打卡 30 天', streak, 30, '天'),
    mk('sets100', '💪', '百组勋章', '累计完成 100 组', sets, 100, '组'),
    mk('sets500', '🏋️', '钢铁之躯', '累计完成 500 组', sets, 500, '组'),
    mk('kinds5', '🧭', '动作探索', '尝试 5 种不同动作', kinds, 5, '种'),
    mk('diet7', '🥗', '饮食一周', '连续记录饮食 7 天', mealStreak(meals), 7, '天'),
  ]
}

// 一次保存前后对比：返回新解锁的成就（之前未达成、之后达成）
export function newlyEarned(before: Workout[], after: Workout[], meals: MealEntry[] = []): Achievement[] {
  const beforeIds = new Set(achievements(before, meals).filter((a) => a.earned).map((a) => a.id))
  return achievements(after, meals).filter((a) => a.earned && !beforeIds.has(a.id))
}

// 保存饮食后检查新成就（训练成就不受影响，只可能新解锁饮食类）
export function newlyEarnedMeals(before: MealEntry[], after: MealEntry[], workouts: Workout[]): Achievement[] {
  const beforeIds = new Set(achievements(workouts, before).filter((a) => a.earned).map((a) => a.id))
  return achievements(workouts, after).filter((a) => a.earned && !beforeIds.has(a.id))
}
