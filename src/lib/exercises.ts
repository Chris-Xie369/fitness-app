import type { SetEntry, Workout } from '../types'

// 最近练过的动作名（按最近一次出现去重）。workouts 顺序不稳定也没关系，内部按时间倒序。
export function recentExerciseNames(workouts: Workout[], limit = Infinity): string[] {
  const ordered = [...workouts].sort((a, b) => b.createdAt - a.createdAt)
  const names: string[] = []
  for (const w of ordered) {
    // 同一天内动作按保存先后追加，倒序遍历才是"最近练过"
    for (const ex of [...w.exercises].reverse()) {
      const name = ex.name.trim()
      if (name && !names.includes(name)) names.push(name)
    }
  }
  return names.slice(0, limit)
}

// 某动作最近一次训练的组数数据（没有记录返回空数组）
export function lastSetsFor(workouts: Workout[], name: string): SetEntry[] {
  const key = name.trim()
  if (!key) return []
  const ordered = [...workouts].sort((a, b) => b.createdAt - a.createdAt)
  for (const w of ordered) {
    // 同一天里同名动作可能记了多次（同日追加），取最后一次才是真正的「上次」
    const ex = [...w.exercises].reverse().find((e) => e.name.trim() === key)
    if (ex) return ex.sets
  }
  return []
}


// 新手常见动作（无历史时的快捷选择，按训练大项排序）
export const COMMON_EXERCISES: string[] = [
  '卧推', '深蹲', '硬拉', '推举', '划船',
  '引体向上', '俯卧撑', '平板支撑', '箭步蹲', '臀桥',
  '哑铃卧推', '哑铃弯举', '绳索下压', '高位下拉', '坐姿划船',
  '腿举', '腿弯举', '腿屈伸', '罗马尼亚硬拉', '坐姿肩推',
  '侧平举', '面拉', '卷腹', '山羊挺身', '农夫行走',
  '二头弯举', '三头臂屈伸', '夹胸', '髋外展', '提踵',
]

// 把组数据格式化成简短文案，如「60kg × 10 · 60kg × 8 · 10 次」
export function formatSets(sets: SetEntry[]): string {
  return sets.map((s) => (s.weight ? `${s.weight}kg × ${s.reps}` : `${s.reps} 次`)).join(' · ')
}
