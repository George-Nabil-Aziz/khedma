import { useSyncExternalStore } from 'react'

// Hash routes (#/sync, #/child/<id>) work on any static host and inside the installed PWA.
export type Route =
  | { name: 'list' }
  | { name: 'new' }
  | { name: 'child'; id: string } // #/child/<id>: read only
  | { name: 'edit'; id: string } // #/child/<id>/edit
  | { name: 'sync' }
  | { name: 'fields' }
  | { name: 'attendance' }
  | { name: 'audit' }
  | { name: 'share' }
  | { name: 'users' }
  | { name: 'classes' }
  | { name: 'profile' }
  | { name: 'settings' }
  | { name: 'trips' }
  | { name: 'install' }
  | { name: 'trip'; id: string }

const STATIC = ['new', 'sync', 'fields', 'attendance', 'audit', 'share', 'users', 'classes', 'profile', 'settings', 'trips', 'install'] as const

export type Path = '/' | `/${(typeof STATIC)[number]}` | `/child/${string}` | `/trip/${string}`

function parse(hash: string): Route {
  const path = hash.replace(/^#\/?/, '')
  const fixed = STATIC.find(s => s === path)
  if (fixed) return { name: fixed }
  const m = path.match(/^child\/([\w-]+)(\/edit)?$/)
  if (m) return { name: m[2] ? 'edit' : 'child', id: m[1] }
  const trip = path.match(/^trip\/([\w-]+)$/)
  if (trip) return { name: 'trip', id: trip[1] }
  return { name: 'list' }
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(
    l => {
      window.addEventListener('hashchange', l)
      return () => window.removeEventListener('hashchange', l)
    },
    () => location.hash,
  )
  return parse(hash)
}

export function go(path: Path) {
  location.hash = path
}
