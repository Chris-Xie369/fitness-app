import type { MealType } from '../types'
import type { DietGoal } from '../lib/nutrition'
import { TRAINING_DAY_BONUS } from '../lib/nutrition'
import { menuLoggedCount, MEAL_TYPES } from '../lib/diet'
import type { MealEntry } from '../types'
import { BASE_KCAL, macroTargets, menusFor, scaleMenu, type ScaledItem } from '../lib/mealplan'

export function MealPlanView({
  isToday,
  isTrainingDay,
  dayTarget,
  goal,
  weightKg,
  waterGoal,
  mealChoice,
  meals,
  date,
  eaten,
  onChoose,
  onLogMenu,
}: {
  isToday: boolean
  isTrainingDay: boolean
  dayTarget: number | null
  goal: DietGoal
  weightKg?: number
  waterGoal: number
  mealChoice: Partial<Record<MealType, number>> | undefined
  meals: MealEntry[]
  date: string
  eaten: number
  onChoose: (meal: MealType, index: number) => void
  onLogMenu: (meal: MealType, menuId: string, items: ScaledItem[]) => void
}) {
  // 无身体资料时没有热量目标：菜单按 2000 kcal 基准展示，补全资料后自动按目标缩放
  const usingBase = dayTarget == null
  const target = dayTarget ?? BASE_KCAL
  const macros = weightKg ? macroTargets(weightKg, goal, target) : null
  const remain = Math.max(0, target - eaten)

  return (
    <div>
      {/* 🎯 每日营养目标 + 当天进度（记完餐不用切回记录页看余量） */}
      <div className="mt-4 rounded-2xl bg-surface border border-line p-4">
        <p className="font-display italic text-muted text-[13px]">🎯 每日营养目标{!usingBase && isTrainingDay ? ` · 训练日 +${TRAINING_DAY_BONUS}` : ''}</p>
        {usingBase ? (
          <p className="mt-2 text-[12px] text-muted leading-relaxed">
            在「身体」页填写体重、身高、性别和出生年后，这里会生成你的专属目标；当前菜单按 {BASE_KCAL} kcal 基准展示
          </p>
        ) : (
          <>
            <p className="mt-2 font-display text-[24px] text-clay">{target}<span className="text-[13px] text-muted"> kcal/天</span></p>
            <p className="mt-1 text-[12px] text-muted tabular-nums">
              {isToday ? '今天' : '当天'}已吃 {eaten} kcal · 还能吃 {remain} kcal{eaten > target ? '（已超目标）' : ''}
            </p>
          </>
        )}
        {macros && !usingBase && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-paper border border-line py-2">
              <p className="text-[11px] text-muted">蛋白质</p>
              <p className="text-[14px] text-ink">{macros.protein.low}-{macros.protein.high}g</p>
            </div>
            <div className="rounded-xl bg-paper border border-line py-2">
              <p className="text-[11px] text-muted">碳水</p>
              <p className="text-[14px] text-ink">{macros.carbs.low}-{macros.carbs.high}g</p>
            </div>
            <div className="rounded-xl bg-paper border border-line py-2">
              <p className="text-[11px] text-muted">脂肪</p>
              <p className="text-[14px] text-ink">{macros.fat.low}-{macros.fat.high}g</p>
            </div>
          </div>
        )}
        <p className="mt-2 text-[11px] text-muted">💧 饮水目标 {waterGoal} 杯（切换到「记录」打卡）</p>
        <p className="mt-1 text-[10px] text-muted-weak">P 蛋白 · C 碳水 · F 脂肪（g/天目标）</p>
      </div>

      {/* 四餐菜单 */}
      <div className="mt-4 space-y-3">
        {MEAL_TYPES.map(({ type, label, emoji }) => {
          const menus = menusFor(type, isTrainingDay)
          const idx = (mealChoice?.[type] ?? 0) % menus.length
          const menu = menus[idx]
          const scaled = scaleMenu(menu, target)
          const loggedCount = menuLoggedCount(meals, date, scaled.items)
          const logged = loggedCount > 0
          return (
            <div key={type} className="rounded-2xl bg-surface border border-line p-4">
              <div className="flex items-center justify-between">
                <p className="text-[15px] text-ink">{emoji} {label}<span className="ml-1.5 text-[12px] text-muted">{menu.theme}</span></p>
                <p className="text-[12px] text-clay">~{scaled.totalKcal} 大卡</p>
              </div>
              <ul className="mt-2 space-y-1.5">
                {scaled.items.map((it) => (
                  <li key={it.name} className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="text-ink min-w-0">
                      {it.name}
                      {it.hint && <span className="ml-1.5 text-[11px] text-muted">{it.hint}</span>}
                    </span>
                    <span className="shrink-0 text-muted tabular-nums">{it.grams}g</span>
                  </li>
                ))}
              </ul>
              {logged && <p className="mt-2 text-[11px] text-clay">✓ 今天已记录 {loggedCount} 次（重复记会累加，可在「记录」里删除）</p>}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => onChoose(type, (idx + 1) % menus.length)}
                  className="flex-1 py-1.5 rounded-full border border-line text-[12px] text-muted hover:text-clay hover:border-clay/40 transition"
                >
                  ⇄ 换一套
                </button>
                <button
                  onClick={() => onLogMenu(type, menu.id, scaled.items)}
                  className="flex-1 py-1.5 rounded-full text-[12px] bg-clay text-white hover:bg-clay/90 active:scale-95 transition"
                >
                  {logged ? `再记一次（${loggedCount}）` : '按菜单记录'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {usingBase ? (
        <p className="mt-3 px-1 text-[11px] text-muted-weak leading-relaxed">
          菜单按 {BASE_KCAL} kcal 基准展示，在「身体」页补全资料后自动按你的目标缩放；热量为食材近似值，未计烹调用油，以少油为准
        </p>
      ) : (
        <p className="mt-3 px-1 text-[11px] text-muted-weak leading-relaxed">
          菜单克数按{isToday ? '今天' : '当天'}目标 {target} kcal 自动缩放；热量为食材近似值，未计烹调用油，以少油为准
        </p>
      )}
    </div>
  )
}
