import { getVerseConfig } from './config.js'

let loadPromise = null

/** Load verse-embedded once; resolves to the global `VerseElements` constructor. */
export function loadVerseElementsConstructor() {
  if (typeof window !== 'undefined' && window.VerseElements) {
    return Promise.resolve(window.VerseElements)
  }
  if (loadPromise) return loadPromise

  const { scriptUrl } = getVerseConfig()
  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-verse-elements="1"]`)
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.VerseElements) resolve(window.VerseElements)
        else reject(new Error('Verse Elements script loaded but VerseElements is missing'))
      })
      existing.addEventListener('error', () => reject(new Error('Failed to load Verse Elements')))
      return
    }
    const script = document.createElement('script')
    script.src = scriptUrl
    script.async = true
    script.dataset.verseElements = '1'
    script.onload = () => {
      if (window.VerseElements) resolve(window.VerseElements)
      else reject(new Error('Verse Elements script loaded but VerseElements is missing'))
    }
    script.onerror = () => reject(new Error(`Failed to load Verse Elements from ${scriptUrl}`))
    document.head.appendChild(script)
  })

  return loadPromise
}
