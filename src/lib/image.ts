// 图片压缩：限制最长边并转 JPEG，避免 IndexedDB 被照片撑爆（localStorage 只有约 5MB）
export async function compressImage(file: Blob, maxEdge = 1280, quality = 0.82): Promise<Blob | null> {
  try {
    // imageOrientation: 'from-image' 明确尊重 EXIF 方向（iPhone 竖拍照片靠它摆正）
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return fallback(file)
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality))
    if (blob) return blob
    return fallback(file)
  } catch {
    return fallback(file)
  }
}

// 无法解码（个别 HEIC/损坏文件）时：只允许 20MB 以内的原文件，超出直接拒绝
function fallback(file: Blob): Blob | null {
  return file.size > 20 * 1024 * 1024 ? null : file
}
