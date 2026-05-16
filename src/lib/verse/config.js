/** Verse Elements + GraphQL endpoints (demo vs production). */
export function getVerseConfig() {
  const elementsBaseUrl = (
    import.meta.env.VITE_VERSE_ELEMENTS_BASE_URL || 'https://iframe.demo.verse.works'
  ).trim()
  const graphqlUrl = (
    import.meta.env.VITE_VERSE_GRAPHQL_URL || 'https://staging.dev.verse.works/query'
  ).trim()
  const artworkId = (import.meta.env.VITE_VERSE_ARTWORK_ID || '').trim()
  const scriptUrl = (
    import.meta.env.VITE_VERSE_EMBEDDED_SCRIPT_URL ||
    'https://unpkg.com/verse-embedded@1.1.4/dist/verse-elements.js'
  ).trim()

  return {
    elementsBaseUrl,
    graphqlUrl,
    artworkId,
    scriptUrl,
    isConfigured: Boolean(artworkId)
  }
}
