import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import { AuraProvider } from './AuraContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import LiveMonitor from './pages/LiveMonitor'
import AutoCare from './pages/AutoCare'
import Copilot from './pages/Copilot'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuraProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/monitor" element={<LiveMonitor />} />
            <Route path="/autocare" element={<AutoCare />} />
            <Route path="/copilot" element={<Copilot />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuraProvider>
  </StrictMode>,
)
