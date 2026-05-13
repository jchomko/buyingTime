import { NavLink } from 'react-router-dom'

export function ViewerBrand({
  chromeHidden,
  navTo = '/gallery',
  navLabel = 'Gallery',
  brandTo = '/info',
  onBrandClick,
  /** When false (default), “Buying Time” is static; the info route uses its own title link. */
  brandAsLink = false
}) {
  const navOnClick = !brandAsLink ? onBrandClick : undefined

  return (
    <div
      className={`viewer-title-stack viewer-chrome-invert${
        chromeHidden ? ' viewer-title-stack--flush' : ''
      }`}
    >
      {brandAsLink ? (
        <NavLink
          to={brandTo}
          className="viewer-title viewer-title--link"
          onClick={onBrandClick}
        >
          Buying Time
        </NavLink>
      ) : (
        <span className="viewer-title">Buying Time</span>
      )}

      <NavLink
        to={navTo}
        className="viewer-title viewer-title--link viewer-title--connect"
        onClick={navOnClick}
      >
        {navLabel}
      </NavLink>
    </div>
  )
}
