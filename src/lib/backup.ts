export type BackupHint =
  | { show: false }
  | { show: true; reason: 'never' | 'stale' }

const DAY = 86400000
const STALE_AFTER = 30 * DAY
// 从未导出过：全部类型（训练/饮食/身体/运动）累计 5 条以上记录时开始提醒（新手前几天不必催）
const NEVER_MIN_RECORDS = 5

// 决定数据管理区是否显示备份提醒。snooze 后 30 天内不再出现。
export function backupHintState(opts: {
  now: number
  lastExportAt: number | null
  dismissedAt: number | null
  recordCount: number
}): BackupHint {
  const { now, lastExportAt, dismissedAt, recordCount } = opts
  if (dismissedAt && now - dismissedAt < STALE_AFTER) return { show: false }
  if (lastExportAt) {
    return now - lastExportAt >= STALE_AFTER ? { show: true, reason: 'stale' } : { show: false }
  }
  return recordCount >= NEVER_MIN_RECORDS ? { show: true, reason: 'never' } : { show: false }
}
