import { useState, useCallback } from 'react'
import { calculatePackageValue, evaluateTradeOffer } from '../engine/tradeEngine.js'

export function useTradeCalculator({ targetPick, targetTeam, direction }) {
  const [selectedOfferPicks, setSelectedOfferPicks] = useState([])
  const [selectedOfferFuture, setSelectedOfferFuture] = useState([])
  const [selectedReceivePicks, setSelectedReceivePicks] = useState([])
  const [selectedReceiveFuture, setSelectedReceiveFuture] = useState([])

  const evaluation = targetPick
    ? evaluateTradeOffer({
        targetPick,
        userGiving:
          direction === 'UP'
            ? { picks: selectedOfferPicks, futurePicks: selectedOfferFuture }
            : { picks: [targetPick], futurePicks: [] },
        userReceiving:
          direction === 'DOWN'
            ? { picks: selectedReceivePicks, futurePicks: selectedReceiveFuture }
            : { picks: [], futurePicks: [] },
        targetTeam,
      })
    : null

  const offerValue = calculatePackageValue(selectedOfferPicks, selectedOfferFuture)
  const receiveValue = calculatePackageValue(selectedReceivePicks, selectedReceiveFuture)

  const toggleOfferPick = useCallback((pick) => {
    setSelectedOfferPicks((prev) =>
      prev.find((p) => p.overall === pick.overall)
        ? prev.filter((p) => p.overall !== pick.overall)
        : [...prev, pick]
    )
  }, [])

  const toggleOfferFuture = useCallback((fp) => {
    setSelectedOfferFuture((prev) => {
      const key = `${fp.year}-${fp.round}`
      return prev.find((f) => `${f.year}-${f.round}` === key)
        ? prev.filter((f) => `${f.year}-${f.round}` !== key)
        : [...prev, fp]
    })
  }, [])

  const toggleReceivePick = useCallback((pick) => {
    setSelectedReceivePicks((prev) =>
      prev.find((p) => p.overall === pick.overall)
        ? prev.filter((p) => p.overall !== pick.overall)
        : [...prev, pick]
    )
  }, [])

  const toggleReceiveFuture = useCallback((fp) => {
    setSelectedReceiveFuture((prev) => {
      const key = `${fp.year}-${fp.round}`
      return prev.find((f) => `${f.year}-${f.round}` === key)
        ? prev.filter((f) => `${f.year}-${f.round}` !== key)
        : [...prev, fp]
    })
  }, [])

  const reset = useCallback(() => {
    setSelectedOfferPicks([])
    setSelectedOfferFuture([])
    setSelectedReceivePicks([])
    setSelectedReceiveFuture([])
  }, [])

  return {
    selectedOfferPicks,
    selectedOfferFuture,
    selectedReceivePicks,
    selectedReceiveFuture,
    evaluation,
    offerValue,
    receiveValue,
    toggleOfferPick,
    toggleOfferFuture,
    toggleReceivePick,
    toggleReceiveFuture,
    setSelectedOfferFuture,
    setSelectedReceiveFuture,
    reset,
  }
}
