import { useState } from 'react'
import type { Achievement } from '../lib/achievements'

// 成就解锁庆祝层：多个成就排队依次展示。挂在 PhoneFrame 屏幕内，今天页/历史页保存都能弹。
// 由父级条件渲染（queue 为空时卸载），所以每次新队列都从第一个开始。
export function Celebration({ queue, onClose }: { queue: Achievement[]; onClose: () => void }) {
  const [idx, setIdx] = useState(0)
  const a = queue[idx]
  if (!a) return null
  const last = idx === queue.length - 1

  function next() {
    if (last) onClose()
    else setIdx((i) => i + 1)
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-ink/40 px-10">
      {/* key={a.id}：翻页时整卡重挂载，pop-in 动画每枚都重播 */}
      <div key={a.id} className="w-full max-w-[300px] rounded-3xl bg-surface border border-line p-7 text-center shadow-xl">
        <p className="font-display text-[13px] italic text-clay">成就解锁</p>
        <p className="mt-4 text-[64px] leading-none animate-pop">{a.emoji}</p>
        <p className="font-display text-[24px] mt-3 text-ink">{a.title}</p>
        <p className="mt-1.5 text-[13px] text-muted">{a.desc}</p>
        {queue.length > 1 && <p className="mt-3 text-[11px] text-muted">{idx + 1} / {queue.length}</p>}
        <button
          autoFocus
          onClick={next}
          className="mt-4 w-full py-3 rounded-xl bg-clay text-white font-medium hover:bg-clay/90 active:scale-[0.98] transition outline-none focus:ring-2 focus:ring-clay/40"
        >
          {last ? '收下啦 🎉' : '下一个'}
        </button>
      </div>
    </div>
  )
}
