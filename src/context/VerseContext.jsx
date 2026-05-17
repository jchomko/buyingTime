import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { getMintSaleState } from '../lib/saleGate.js'
import { getVerseConfig } from '../lib/verse/config.js'
import { fetchProjectArtworkState } from '../lib/verse/graphql.js'
import { loadVerseElementsConstructor } from '../lib/verse/loadVerseElements.js'
import { formatWorkTime, normalizeMinuteIndex } from '../timeGrid.js'
import { VerseContext } from './VerseContextValue.js'

export function VerseProvider({ children }) {
  const config = useMemo(() => getVerseConfig(), [])
  const elementsRef = useRef(null)
  const projectRef = useRef(null)
  const soldMinutesRef = useRef(new Set())

  const [verseUser, setVerseUser] = useState(null)
  const [verseBusy, setVerseBusy] = useState(true)
  const [verseError, setVerseError] = useState(null)
  const [projectReady, setProjectReady] = useState(false)
  const [catalogMeta, setCatalogMeta] = useState(null)
  const [soldTick, setSoldTick] = useState(0)

  const applyProjectState = useCallback((state) => {
    projectRef.current = state
    soldMinutesRef.current = new Set(state.soldMinutes)
    setCatalogMeta({
      mintableMin: state.mintableMin,
      mintableMax: state.mintableMax,
      itemCount: state.itemCount
    })
    setProjectReady(true)
    setSoldTick((n) => n + 1)
  }, [])

  const loadProject = useCallback(async () => {
    if (!config.isConfigured) {
      throw new Error('Set VITE_VERSE_ARTWORK_ID in .env (Verse artist-curated artwork id).')
    }
    const state = await fetchProjectArtworkState(config.artworkId)
    if (!state.allowUserSelection) {
      console.warn(
        '[Verse] artwork allowUserSelection is false; purchases may not need $curated_project:item_id'
      )
    }
    applyProjectState(state)
    return state
  }, [config.isConfigured, config.artworkId, applyProjectState])

  const refreshSold = useCallback(async () => {
    setVerseError(null)
    setVerseBusy(true)
    try {
      await loadProject()
    } catch (e) {
      setVerseError(e?.message || String(e))
      throw e
    } finally {
      setVerseBusy(false)
    }
  }, [loadProject])

  const getSoldMinuteIndices = useCallback(() => {
    return soldMinutesRef.current
  }, [])

  const ensureElements = useCallback(async () => {
    if (elementsRef.current) return elementsRef.current
    const VerseElements = await loadVerseElementsConstructor()
    elementsRef.current = new VerseElements({ baseUrl: config.elementsBaseUrl })
    return elementsRef.current
  }, [config.elementsBaseUrl])

  const syncAuthFromElements = useCallback(async () => {
    const elements = await ensureElements()
    const signedIn = await elements.checkAuth()
    if (!signedIn) {
      setVerseUser(null)
      return false
    }
    setVerseUser((prev) => prev || { verseUsername: 'Signed in' })
    return true
  }, [ensureElements])

  const signIn = useCallback(async () => {
    setVerseError(null)
    setVerseBusy(true)
    try {
      const elements = await ensureElements()
      const result = await elements.authorise()
      if (!result) return null
      const user = {
        verseUserId: result.verseUserId,
        verseUsername: result.verseUsername || 'Signed in'
      }
      setVerseUser(user)
      return user
    } catch (e) {
      setVerseError(e?.message || String(e))
      return null
    } finally {
      setVerseBusy(false)
    }
  }, [ensureElements])

  const signOut = useCallback(async () => {
    setVerseError(null)
    try {
      const elements = await ensureElements()
      await elements.signOut()
    } catch (e) {
      setVerseError(e?.message || String(e))
    }
    setVerseUser(null)
  }, [ensureElements])

  const isMinuteInCatalog = useCallback((minuteIndex) => {
    const project = projectRef.current
    if (!project) return false
    return project.itemByMinute.has(normalizeMinuteIndex(minuteIndex))
  }, [])

  const purchaseMinute = useCallback(
    async (minuteIndex, { onSuccess, onUnavailable } = {}) => {
      setVerseError(null)
      const fail = (message) => {
        setVerseError(message)
        return { ok: false, error: message }
      }

      const sale = getMintSaleState()
      if (!sale.mintEnabled) {
        return fail(sale.closedMessage || 'Minting is not open yet.')
      }

      const idx = normalizeMinuteIndex(minuteIndex)
      const project = projectRef.current
      if (!project) {
        return fail('Verse project not loaded yet. Wait a moment and try again.')
      }

      const item = project.itemByMinute.get(idx)
      if (!item) {
        const range =
          project.mintableMin != null && project.mintableMax != null
            ? ` (Verse catalog: ${formatWorkTime(project.mintableMin)}–${formatWorkTime(project.mintableMax)}, ${project.itemCount} items)`
            : ''
        return fail(
          `No Verse listing for ${formatWorkTime(idx)}${range}. Use ← → to pick a listed minute.`
        )
      }
      if (item.isAvailable === false) {
        onUnavailable?.(idx)
        return { ok: false, error: 'This minute is already sold.' }
      }

      const price = project.price
      if (!price) {
        return fail('No primary market price on this Verse artwork.')
      }

      setVerseBusy(true)
      try {
        const elements = await ensureElements()

        // Session was established via authorise(); checkAuth() can lag behind — do not
        // block purchase on a false negative when we already have verseUser.
        if (!verseUser) {
          let signedIn = await elements.checkAuth()
          if (!signedIn) {
            const auth = await elements.authorise()
            if (!auth) {
              return fail('Sign in to Verse to purchase.')
            }
            setVerseUser({
              verseUserId: auth.verseUserId,
              verseUsername: auth.verseUsername || 'Signed in'
            })
          }
        }

        try {
          const reserves = await elements.checkReserves(project.artworkId)
          if (
            reserves?.reserveAccess?.reserveRequired &&
            !reserves?.reserveAccess?.hasAccess
          ) {
            return fail('This sale requires a reserve you do not have.')
          }
        } catch (reserveErr) {
          if (import.meta.env.DEV) {
            console.warn('[Verse] checkReserves skipped:', reserveErr)
          }
        }

        if (import.meta.env.DEV) {
          console.info('[Verse] openPurchaseDialog', {
            artworkId: project.artworkId,
            itemId: item.id,
            minuteIndex: idx,
            amount: price
          })
        }

        await elements.openPurchaseDialog(
          project.artworkId,
          {
            amount: { value: price.value, currency: price.currency },
            userInput: [{ key: '$curated_project:item_id', value: String(item.id) }]
          },
          {
            onSuccess(data) {
              refreshSold()
                .then(() => onSuccess?.(data, idx))
                .catch(() => onSuccess?.(data, idx))
            },
            onTerminalFailure({ title, message }) {
              setVerseError(`${title}: ${message}`)
            },
            onClose() {}
          }
        )
        return { ok: true }
      } catch (e) {
        const msg = e?.message || String(e)
        if (import.meta.env.DEV) console.error('[Verse] purchaseMinute failed:', e)
        return fail(msg)
      } finally {
        setVerseBusy(false)
      }
    },
    [ensureElements, refreshSold, verseUser]
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setVerseBusy(true)
      setVerseError(null)
      try {
        await ensureElements()
        if (cancelled) return
        if (config.isConfigured) {
          await loadProject()
        } else {
          setVerseError('Set VITE_VERSE_ARTWORK_ID in .env to enable Verse minting.')
        }
        if (cancelled) return
        await syncAuthFromElements()
      } catch (e) {
        if (!cancelled) setVerseError(e?.message || String(e))
      } finally {
        if (!cancelled) setVerseBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [config.isConfigured, ensureElements, loadProject, syncAuthFromElements])

  useEffect(() => {
    if (!projectReady || !config.isConfigured) return
    const intervalMs = 20000
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      loadProject().catch(() => {})
    }, intervalMs)
    const onFocus = () => {
      if (document.visibilityState === 'visible') loadProject().catch(() => {})
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [projectReady, config.isConfigured, loadProject])

  const accountLabel = verseUser?.verseUsername || null

  const value = useMemo(
    () => ({
      verseUser,
      accountLabel,
      verseBusy,
      verseError,
      projectReady,
      catalogMeta,
      isMinuteInCatalog,
      verseConfigured: config.isConfigured,
      signIn,
      signOut,
      refreshSold,
      getSoldMinuteIndices,
      purchaseMinute,
      isMinuteSold: (minuteIndex) =>
        soldMinutesRef.current.has(normalizeMinuteIndex(minuteIndex)),
      soldTick
    }),
    [
      verseUser,
      accountLabel,
      verseBusy,
      verseError,
      projectReady,
      catalogMeta,
      isMinuteInCatalog,
      soldTick,
      config.isConfigured,
      signIn,
      signOut,
      refreshSold,
      getSoldMinuteIndices,
      purchaseMinute
    ]
  )

  return <VerseContext.Provider value={value}>{children}</VerseContext.Provider>
}
