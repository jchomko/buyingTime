import { useContext } from 'react'
import { VerseContext } from './VerseContextValue.js'

export function useVerse() {
  const ctx = useContext(VerseContext)
  if (!ctx) throw new Error('useVerse must be used within VerseProvider')
  return ctx
}
