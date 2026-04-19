import { createContext, useContext, useState, useCallback } from 'react'

// When a user joins a group via a /group/:id URL, we set this context so the
// predictive mock flow (SessionSetup, PredictiveMockPage) knows:
//  - we should skip team selection and lock to the group's team
//  - show a "Submit to group" button once picks are complete
//
// When it's null, the app behaves as the standard solo predictive mode.
//
// Shape: { groupId, groupName, memberName, teamId } | null

const GroupContext = createContext(null)

export function GroupProvider({ children }) {
  const [group, setGroup] = useState(null)

  const enterGroup = useCallback((payload) => {
    setGroup(payload)
  }, [])

  const clearGroup = useCallback(() => {
    setGroup(null)
  }, [])

  return (
    <GroupContext.Provider value={{ group, enterGroup, clearGroup }}>
      {children}
    </GroupContext.Provider>
  )
}

export function useGroup() {
  const ctx = useContext(GroupContext)
  if (!ctx) return { group: null, enterGroup: () => {}, clearGroup: () => {} }
  return ctx
}
