import { useState, useEffect, useRef } from 'react'

/**
 * 30-second countdown timer for AI picks.
 * Returns timeLeft (0-30) and a reset function.
 */
export function usePickTimer({ isActive, duration = 30, onExpire }) {
  const [timeLeft, setTimeLeft] = useState(duration)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!isActive) {
      setTimeLeft(duration)
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(intervalRef.current)
          onExpire?.()
          return 0
        }
        return t - 1
      })
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isActive, duration])

  function reset() {
    setTimeLeft(duration)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }

  return { timeLeft, reset }
}
