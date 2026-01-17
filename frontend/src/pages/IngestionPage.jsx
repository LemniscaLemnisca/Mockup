import { useCallback, useState } from 'react'
import { Upload, FileSpreadsheet, ArrowRight, Zap, BarChart3, GitBranch, Brain, Sparkles } from 'lucide-react'

export default function IngestionPage({ onUpload, loading, error }) {
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)

  const handleDrag = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const file = e.dataTransfer.files?.[0]
    if (file && file.name.endsWith('.csv')) {
      setSelectedFile(file)
    }
  }, [])

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleSubmit = () => {
    if (selectedFile) {
      onUpload(selectedFile)
    }
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <header className="px-8 py-6 border-b border-gray-100">
        <div className="max-w-6xl mx-auto flex items-center gap-2">
          <span className="text-sm tracking-[0.3em] font-medium text-gray-900">LEMNISCA</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-8 py-16">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Brand Message */}
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-gray-400 text-sm tracking-wide uppercase">Data Intelligence Platform</p>
              <h1 className="text-4xl lg:text-5xl font-semibold leading-tight text-gray-900">
                Fermentation
                <br />
                <span className="text-gray-400">Analytics &</span>
                <br />
                <span className="italic text-[#4F7CFF]">Simulation</span>
                <span className="text-gray-400"> Engine</span>
              </h1>
              <p className="text-gray-500 text-lg max-w-md leading-relaxed mt-4">
                Deterministic insights from your bioprocess data. No black boxes. No guessing.
              </p>
            </div>

            {/* Features */}
            <div className="space-y-4 pt-4">
              <Feature 
                icon={Zap} 
                title="Automatic Detection" 
                description="Time, batch, and variable inference"
              />
              <Feature 
                icon={BarChart3} 
                title="Temporal Analysis" 
                description="Phase segmentation and kinetic metrics"
              />
              <Feature 
                icon={GitBranch} 
                title="Batch Comparison" 
                description="Cross-batch variability and trends"
              />
              <Feature 
                icon={Brain} 
                title="Model Training" 
                description="Hybrid modeling with scenario simulation"
              />
              <Feature 
                icon={Sparkles} 
                title="Process Optimization" 
                description="Design engine for next experiments"
              />
            </div>
          </div>

          {/* Right: Upload Area */}
          <div className="space-y-6">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`
                relative border-2 border-dashed rounded-2xl p-12 text-center transition-all bg-white
                ${dragActive 
                  ? 'border-gray-900 bg-gray-50' 
                  : selectedFile 
                  ? 'border-green-500 bg-green-50/30' 
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              
              {selectedFile ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center">
                    <FileSpreadsheet className="w-8 h-8 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null) }}
                    className="text-xs text-gray-400 hover:text-gray-900 transition-colors"
                  >
                    Choose different file
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <Upload className="w-8 h-8 text-gray-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Drop your CSV file here</p>
                    <p className="text-sm text-gray-500 mt-1">or click to browse</p>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!selectedFile || loading}
              className={`
                w-full py-4 px-6 rounded-xl font-medium transition-all flex items-center justify-center gap-3
                ${selectedFile && !loading
                  ? 'bg-gray-900 text-white hover:bg-gray-800'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyzing Dataset...
                </>
              ) : (
                <>
                  Begin Analysis
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <p className="text-center text-xs text-gray-400">
              Supports CSV files with time-series fermentation data
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-8 py-6 text-center">
        <p className="text-xs text-gray-400">
          Local by design. Scientific at the core.
        </p>
      </footer>
    </div>
  )
}

function Feature({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-gray-600" />
      </div>
      <div>
        <p className="font-medium text-gray-900">{title}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </div>
  )
}
