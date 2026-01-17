import { useState } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import IngestionPage from './pages/IngestionPage'
import InsightsPage from './pages/InsightsPage'
import ModelPage from './pages/ModelPage'

function AppContent() {
  const [insights, setInsights] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fileName, setFileName] = useState(null)
  const navigate = useNavigate()

  const handleUpload = async (file) => {
    setLoading(true)
    setError(null)
    setFileName(file.name)
    
    // Navigate to insights page immediately with loading state
    navigate('/insights')
    
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const response = await fetch('http://127.0.0.1:8000/analyze', {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.detail || 'Analysis failed')
      }
      
      const data = await response.json()
      setInsights(data)
    } catch (err) {
      setError(err.message)
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setInsights(null)
    setError(null)
    setFileName(null)
    navigate('/')
  }

  const handleGoToModel = () => {
    navigate('/model')
  }

  const handleBackToInsights = () => {
    navigate('/insights')
  }

  return (
    <Routes>
      <Route 
        path="/" 
        element={<IngestionPage onUpload={handleUpload} loading={loading} error={error} />} 
      />
      <Route 
        path="/insights" 
        element={
          <InsightsPage 
            insights={insights} 
            onReset={handleReset} 
            loading={loading}
            fileName={fileName}
            onGoToModel={handleGoToModel}
          />
        } 
      />
      <Route 
        path="/model" 
        element={<ModelPage onBack={handleBackToInsights} insights={insights} />} 
      />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}
