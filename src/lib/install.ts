import { useSyncExternalStore } from 'react'

/*
 * Installing the app (PWA). Chrome / Edge / Android fire `beforeinstallprompt` once, early, when
 * the app can be installed: it is kept here (this module is imported by main.tsx) so a button
 * can show the browser's own install box later. iPhone Safari has no such event — the app is
 * added from the share menu instead.
 */

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferred: InstallEvent | null = null
let installed = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault() // no browser mini-bar; our button in الإعدادات shows the box instead
  deferred = e as InstallEvent
  emit()
})
window.addEventListener('appinstalled', () => {
  deferred = null
  installed = true
  emit()
})

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export function useInstall() {
  const snapshot = useSyncExternalStore(
    l => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => `${installed}|${!!deferred}`,
  )
  const [isInstalled, canPrompt] = snapshot.split('|').map(v => v === 'true')
  return {
    /** Already running as the installed app. */
    installed: isInstalled,
    /** The browser's own install box can be shown (Chrome / Edge / Android). */
    canPrompt,
    isIOS,
    async install() {
      if (!deferred) return
      await deferred.prompt()
      const { outcome } = await deferred.userChoice
      deferred = null // usable only once
      if (outcome === 'accepted') installed = true
      emit()
    },
  }
}
