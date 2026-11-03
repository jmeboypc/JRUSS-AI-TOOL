import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PupilWhiteboardView from './components/PupilWhiteboardView.jsx'

const isPupil = window.location.hash.includes('whiteboard-pupil') || window.location.search.includes('view=pupil');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isPupil ? <PupilWhiteboardView /> : <App />}
  </StrictMode>,
)


