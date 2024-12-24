import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import MqttControl from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MqttControl />
  </StrictMode>,
)
