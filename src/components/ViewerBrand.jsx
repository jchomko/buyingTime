import { NavLink } from 'react-router-dom'

export function ViewerBrand({
  chromeHidden,
  navTo = '/gallery',
  navLabel = 'Gallery',
  brandTo = '/info',
  onBrandClick
}) {
  return (
    <div
      className={`viewer-title-stack viewer-chrome-invert${
        chromeHidden ? ' viewer-title-stack--flush' : ''
      }`}
    >
      <NavLink
        to={brandTo}
        className="viewer-title viewer-title--link"
        onClick={onBrandClick}
      >
        Buying Time
      </NavLink>
  
      <NavLink to={navTo} className="viewer-title viewer-title--link viewer-title--connect">
        {navLabel}
      </NavLink>
    </div>
  )
}
