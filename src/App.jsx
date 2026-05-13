import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { WalletProvider } from './context/WalletContext.jsx'
import GalleryPage from './pages/GalleryPage.jsx'
import InfoPage from './pages/InfoPage.jsx'
import DayCyclePage from './pages/DayCyclePage.jsx'
import PiecePage from './pages/PiecePage.jsx'
import WrapPage from './pages/WrapPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <WalletProvider>
        <Routes>
          <Route path="/" element={<PiecePage />} />
          <Route path="/day" element={<DayCyclePage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/clock" element={<WrapPage />} />
          <Route path="/info" element={<InfoPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </WalletProvider>
    </BrowserRouter>
  )
}
