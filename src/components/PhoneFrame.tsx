import type { ReactNode } from 'react'

// 手机外框：桌面(md+)显示 iPhone 外框+灵动岛；手机端全屏。
// 外层和屏幕都用 h-full（配合 index.css 里 html/body/#root 的 height:100%），
// 这样在任何预览面板里都能铺满整屏，不依赖 100vh（vh 在嵌入式预览里可能不准）。
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="h-full w-full bg-[#D6CFC1] flex items-center justify-center md:p-8">
      <div className="relative w-full h-full md:h-[844px] md:max-h-[92vh] md:w-[390px] bg-black md:rounded-[3.2rem] md:p-[10px] md:shadow-[0_40px_80px_-20px_rgba(40,30,20,0.45)]">
        <div className="hidden md:block absolute top-[19px] left-1/2 z-20 -translate-x-1/2 w-[112px] h-[32px] bg-black rounded-full" />
        <div className="relative h-full w-full overflow-hidden bg-paper md:rounded-[2.6rem]">
          {children}
        </div>
      </div>
    </div>
  )
}
