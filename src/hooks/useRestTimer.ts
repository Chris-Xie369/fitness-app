import { useCallback, useEffect, useRef, useState } from 'react'

export type RestTimerApi = ReturnType<typeof useRestTimer>

// 组间休息计时器：基于结束时间戳倒数（切后台回来也准），结束时提示音+震动
export function useRestTimer(defaultSeconds = 90) {
  const [preset, setPreset] = useState(defaultSeconds)
  const [remaining, setRemaining] = useState<number | null>(null) // null=空闲
  const endAtRef = useRef<number>(0)
  const audioRef = useRef<AudioContext | null>(null)

  // 勾选/点预设都发生在用户手势里：此时创建 AudioContext 才允许发声
  const ensureAudio = useCallback(() => {
    try {
      if (!audioRef.current) {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (Ctx) audioRef.current = new Ctx()
      }
      void audioRef.current?.resume()
    } catch {
      /* 不支持音频就静默 */
    }
  }, [])

  const beep = useCallback(() => {
    try {
      const ctx = audioRef.current
      if (!ctx) return
      const now = ctx.currentTime
      ;[0, 0.25, 0.5].forEach((delay, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.value = i === 2 ? 880 : 660
        gain.gain.setValueAtTime(0.001, now + delay)
        gain.gain.exponentialRampToValueAtTime(0.25, now + delay + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.18)
        osc.start(now + delay)
        osc.stop(now + delay + 0.2)
      })
    } catch {
      /* ignore */
    }
  }, [])

  const start = useCallback((secs?: number) => {
    ensureAudio()
    const s = secs ?? preset
    setPreset(s)
    endAtRef.current = Date.now() + s * 1000
    setRemaining(s)
  }, [ensureAudio, preset])

  const skip = useCallback(() => setRemaining(null), [])

  const addSecs = useCallback((delta: number) => {
    setRemaining((r) => {
      if (r === null) {
        if (delta > 0) {
          endAtRef.current = Date.now() + delta * 1000
          return delta
        }
        return null
      }
      const next = Math.max(0, r + delta)
      endAtRef.current = Date.now() + next * 1000
      return next
    })
  }, [])

  const running = remaining !== null
  useEffect(() => {
    if (!running) return
    const t = window.setInterval(() => {
      const left = Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0) {
        window.clearInterval(t)
        setRemaining(null)
        beep()
        if ('vibrate' in navigator) navigator.vibrate?.([200, 100, 200])
      }
    }, 250)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, beep])

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return { preset, setPreset, remaining, start, skip, addSecs, mmss }
}
