import { useCallback, useEffect, useRef, useState } from 'react'

export type RestTimerApi = ReturnType<typeof useRestTimer>

type WakeLockSentinel = { release: () => Promise<void> }

// 组间休息计时器：基于结束时间戳倒数（切后台回来也准），结束时提示音+震动
export function useRestTimer(defaultSeconds = 90) {
  const [preset, setPreset] = useState(defaultSeconds)
  const [remaining, setRemaining] = useState<number | null>(null) // null=空闲
  const [finished, setFinished] = useState(false) // 归零后保留 3 秒「休息结束」
  const endAtRef = useRef<number>(0)
  const audioRef = useRef<AudioContext | null>(null)
  const wakeRef = useRef<WakeLockSentinel | null>(null)
  const finishTimerRef = useRef<number | null>(null)

  // Screen Wake Lock：计时期间防止锁屏（iOS 16.4+ / Android Chrome），回到前台时重新申请
  const acquireWake = useCallback(async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinel> } }
      if (!nav.wakeLock) return
      if (wakeRef.current) return
      wakeRef.current = await nav.wakeLock.request('screen')
    } catch {
      /* 用户未授权/不支持：静默，蜂鸣与时间戳倒数仍工作 */
    }
  }, [])

  const releaseWake = useCallback(() => {
    void wakeRef.current?.release().catch(() => undefined)
    wakeRef.current = null
  }, [])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && remaining !== null) void acquireWake()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [remaining, acquireWake])

  // 卸载时清理
  useEffect(() => () => {
    if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current)
    releaseWake()
  }, [releaseWake])

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

  const clearFinish = useCallback(() => {
    if (finishTimerRef.current) {
      window.clearTimeout(finishTimerRef.current)
      finishTimerRef.current = null
    }
  }, [])

  const start = useCallback((secs?: number) => {
    ensureAudio()
    const s = secs ?? preset
    setPreset(s)
    clearFinish()
    setFinished(false)
    endAtRef.current = Date.now() + s * 1000
    setRemaining(s)
    void acquireWake()
  }, [ensureAudio, preset, clearFinish, acquireWake])

  const skip = useCallback(() => {
    clearFinish()
    setFinished(false)
    setRemaining(null)
    releaseWake()
  }, [clearFinish, releaseWake])

  const addSecs = useCallback((delta: number) => {
    setFinished(false)
    clearFinish()
    setRemaining((r) => {
      if (r === null) {
        if (delta > 0) {
          endAtRef.current = Date.now() + delta * 1000
          void acquireWake()
          return delta
        }
        return null
      }
      const next = Math.max(0, r + delta)
      endAtRef.current = Date.now() + next * 1000
      return next
    })
  }, [acquireWake, clearFinish])

  const running = remaining !== null && remaining > 0
  useEffect(() => {
    if (!running) return
    const t = window.setInterval(() => {
      const left = Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0) {
        window.clearInterval(t)
        beep()
        if ('vibrate' in navigator) navigator.vibrate?.([200, 100, 200])
        // 保留「休息结束 ✓」3 秒再回空闲（锁屏回来也能看出刚结束）
        setFinished(true)
        releaseWake()
        finishTimerRef.current = window.setTimeout(() => {
          setFinished(false)
          setRemaining(null)
          finishTimerRef.current = null
        }, 3000)
      }
    }, 250)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, beep, releaseWake])

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return { preset, setPreset, remaining, finished, start, skip, addSecs, mmss }
}
