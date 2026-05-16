import { getVerseConfig } from './config.js'
import { buildProjectItemIndex } from './mapMinuteToItem.js'

const PROJECT_ARTWORK_QUERY = `
  query ProjectArtwork($artworkId: ID!) {
    artworksPage(request: { filter: { ids: [$artworkId] }, first: 1 }) {
      nodes {
        id
        title
        artworkKind {
          ... on ProjectArtworkKind {
            allowUserSelection
            items {
              id
              isAvailable
              featuresJson
            }
          }
        }
        primaryMarketListing {
          startsAt
          endsAt
          strategy {
            ... on PMBuyNowLimitedEditionStrategy {
              price { value currency }
              maxEditions
              stats { issuedEditions }
            }
            ... on PMBuyNowOpenEditionStrategy {
              price { value currency }
            }
          }
        }
      }
    }
  }
`

async function verseGraphql(query, variables) {
  const { graphqlUrl } = getVerseConfig()
  const res = await fetch(graphqlUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  })
  if (!res.ok) {
    throw new Error(`Verse API HTTP ${res.status}`)
  }
  const json = await res.json()
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join('; '))
  }
  return json.data
}

function pickListingPrice(listing) {
  const strategy = listing?.strategy
  if (!strategy?.price) return null
  return {
    value: String(strategy.price.value),
    currency: String(strategy.price.currency)
  }
}

/** Load artist-curated project artwork, items, and minute index maps. */
export async function fetchProjectArtworkState(artworkId) {
  const data = await verseGraphql(PROJECT_ARTWORK_QUERY, { artworkId })
  const artwork = data?.artworksPage?.nodes?.[0]
  if (!artwork) {
    throw new Error(`Verse artwork not found: ${artworkId}`)
  }

  const kind = artwork.artworkKind
  const items = kind?.items ?? []
  const index = buildProjectItemIndex(items)

  return {
    artworkId: artwork.id,
    title: artwork.title,
    allowUserSelection: Boolean(kind?.allowUserSelection),
    items,
    ...index,
    price: pickListingPrice(artwork.primaryMarketListing),
    listing: artwork.primaryMarketListing
  }
}
