'use client'

import { useSyncExternalStore } from 'react'

const TICK_MS = 15_000

let currentTime = 0
let subscribers = 0
let ticker: ReturnType<typeof setInterval> | undefined
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  subscribers += 1
  if (subscribers === 1) {
    currentTime = Date.now()
    ticker = setInterval(() => {
      currentTime = Date.now()
      listeners.forEach((notify) => notify())
    }, TICK_MS)
  }

  return () => {
    listeners.delete(listener)
    subscribers -= 1
    if (subscribers === 0) clearInterval(ticker)
  }
}

function getSnapshot() {
  if (currentTime === 0) currentTime = Date.now()
  return currentTime
}

// Zero on the server: times depend on the viewer's locale and zone, so they render after hydration.
export function useNow() {
  return useSyncExternalStore(subscribe, getSnapshot, () => 0)
}
