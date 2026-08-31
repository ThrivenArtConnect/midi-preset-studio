const TAGS_KEY = 'mpd24-preset-tags'
const SNAPSHOT_MAX = 10

export function loadTags() {
  try {
    return JSON.parse(localStorage.getItem(TAGS_KEY) || '{}')
  } catch {
    return {}
  }
}

export function saveTags(tags) {
  localStorage.setItem(TAGS_KEY, JSON.stringify(tags))
}

export function snapshotKey(num) {
  return `mpd24-snapshots-${num}`
}

export function loadSnapshots(num) {
  try {
    const list = JSON.parse(localStorage.getItem(snapshotKey(num)) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function pushSnapshot(num, entry) {
  const list = loadSnapshots(num)
  list.push({ ...entry, ts: Date.now() })
  while (list.length > SNAPSHOT_MAX) list.shift()
  localStorage.setItem(snapshotKey(num), JSON.stringify(list))
  return list
}

export function popSnapshot(num) {
  const list = loadSnapshots(num)
  if (!list.length) return null
  const last = list.pop()
  localStorage.setItem(snapshotKey(num), JSON.stringify(list))
  return last
}

export function hasSnapshots(num) {
  return loadSnapshots(num).length > 0
}
