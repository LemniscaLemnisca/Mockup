import { useState, useEffect } from 'react'
import { ArrowLeft, Loader2, ArrowRight, Sparkles } from 'lucide-react'
import Overview from '../components/Overview'
import Variables from '../components/Variables'
import BatchSelector from '../components/BatchSelector'
import TimeSeriesChart from '../components/TimeSeriesChart'
import CrossBatchComparison from '../components/CrossBatchComparison'
import QualityPanel from '../components/QualityPanel'
import IssuesPanel from '../components/IssuesPanel'
import TemporalInsights from '../components/TemporalInsights'
import RelationshipsPanel from '../components/RelationshipsPanel'

// Skeleton components
function SkeletonBox({ className }) {
  return <div className={`bg-gray-200 animate-pulse rounded-lg ${className}`} />
}

function LoadingSkeleton({ fileName }) {
  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <ArrowLeft className="w-4 h-4" />
              Back
            </div>
            <div className="h-6 w-px bg-gray-200"></div>
            <div className="flex items-center gap-2">
              <span className="text-sm tracking-[0.2em] font-medium">LEMNISCA</span>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            Insight Layer
          </div>
        </div>
      </header>

      {/* Loading Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Loading indicator */}
        <div className="mb-8 flex items-center justify-center">
          <div className="bg-white rounded-xl border border-gray-200 px-8 py-6 flex items-center gap-4">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            <div>
              <p className="font-medium text-gray-900">Analyzing dataset...</p>
              <p className="text-sm text-gray-500">{fileName || 'Processing your data'}</p>
            </div>
          </div>
        </div>

        {/* Skeleton Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
              <SkeletonBox className="h-4 w-20 mb-3" />
              <SkeletonBox className="h-8 w-16 mb-2" />
              <SkeletonBox className="h-3 w-24" />
            </div>
          ))}
        </div>


        {/* Skeleton Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <SkeletonBox className="h-5 w-20 mb-4" />
              {[...Array(6)].map((_, i) => (
                <div key={i} className="py-3 border-b border-gray-100 last:border-0">
                  <SkeletonBox className="h-4 w-32 mb-2" />
                  <SkeletonBox className="h-3 w-24" />
                </div>
              ))}
            </div>
          </div>

          {/* Main Panel */}
          <div className="lg:col-span-9">
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="border-b border-gray-200 px-6 py-3">
                <div className="flex gap-6">
                  {['Time Series', 'Temporal', 'Comparison', 'Relationships', 'Quality'].map((_, i) => (
                    <SkeletonBox key={i} className="h-4 w-20" />
                  ))}
                </div>
              </div>
              <div className="p-6">
                <SkeletonBox className="h-5 w-40 mb-2" />
                <SkeletonBox className="h-4 w-64 mb-6" />
                <SkeletonBox className="h-80 w-full" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function InsightsPage({ insights, onReset, loading, fileName, onGoToModel }) {
  const [selectedBatches, setSelectedBatches] = useState([])
  const [selectedVariable, setSelectedVariable] = useState(null)
  const [activeTab, setActiveTab] = useState('timeseries')

  // Update selections when insights load
  useEffect(() => {
    if (insights) {
      setSelectedBatches(insights.overview?.batches?.slice(0, 3) || [])
      setSelectedVariable(insights.overview?.numeric_variables?.[0] || null)
    }
  }, [insights])

  // Show skeleton while loading
  if (loading || !insights) {
    return <LoadingSkeleton fileName={fileName} />
  }

  const tabs = [
    { id: 'timeseries', label: 'Time Series' },
    { id: 'temporal', label: 'Temporal Analysis' },
    { id: 'comparison', label: 'Batch Comparison' },
    { id: 'relationships', label: 'Relationships' },
    { id: 'quality', label: 'Data Quality' },
  ]

  const qualityVariables = insights.quality?.variables || []
  
  const issues = (insights.quality?.overall?.flags || []).map(flag => ({
    type: flag.split(':')[0],
    severity: flag.includes('high') ? 'high' : 'warning',
    variable: 'Dataset',
    description: flag.replace(/_/g, ' ').replace(/:/g, ': ')
  }))

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onReset}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-black transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div className="h-6 w-px bg-gray-200"></div>
            <div className="flex items-center gap-2">
              <span className="text-sm tracking-[0.2em] font-medium">LEMNISCA</span>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {/* Animated border button */}
            <button
              onClick={onGoToModel}
              className="group relative rounded-full p-[2px] overflow-hidden"
            >
              {/* Rotating gradient border */}
              <div className="absolute inset-0 rounded-full animate-rotate-border" />
              {/* Inner content */}
              <div className="relative flex items-center gap-2 px-4 py-2 rounded-full bg-white">
                <Sparkles className="w-4 h-4 text-gray-700" />
                <span className="text-sm font-medium text-gray-900">Move to Model Training</span>
                <ArrowRight className="w-4 h-4 text-gray-500 transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-6">
          <Overview overview={insights.overview} quality={insights.quality?.overall} />
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-3 space-y-6">
              <Variables 
                variables={qualityVariables}
                selected={selectedVariable}
                onSelect={setSelectedVariable}
              />
              
              {insights.overview?.is_multi_batch && (
                <BatchSelector
                  batches={insights.overview.batches}
                  selected={selectedBatches}
                  onChange={setSelectedBatches}
                />
              )}
            </div>
            
            <div className="lg:col-span-9 space-y-6">
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="border-b border-gray-200 px-6 py-3 overflow-x-auto">
                  <div className="flex gap-6 min-w-max">
                    {tabs.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                          text-sm font-medium pb-3 -mb-3 border-b-2 transition-colors whitespace-nowrap
                          ${activeTab === tab.id 
                            ? 'border-black text-black' 
                            : 'border-transparent text-gray-500 hover:text-black'
                          }
                        `}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="p-6">
                  {activeTab === 'timeseries' && (
                    <TimeSeriesChart
                      rawData={insights.plot_ready}
                      variable={selectedVariable}
                      batches={selectedBatches}
                      isMultiBatch={insights.overview?.is_multi_batch}
                      timeColumn={insights.overview?.time_column}
                    />
                  )}
                  
                  {activeTab === 'temporal' && (
                    <TemporalInsights
                      temporal={insights.temporal}
                      variable={selectedVariable}
                      batches={selectedBatches}
                    />
                  )}
                  
                  {activeTab === 'comparison' && (
                    <CrossBatchComparison
                      batchComparison={insights.batch_comparison}
                      variable={selectedVariable}
                    />
                  )}
                  
                  {activeTab === 'relationships' && (
                    <RelationshipsPanel
                      relationships={insights.relationships}
                      selectedVariable={selectedVariable}
                    />
                  )}
                  
                  {activeTab === 'quality' && (
                    <QualityPanel quality={insights.quality} />
                  )}
                </div>
              </div>
              
              {issues.length > 0 && <IssuesPanel issues={issues} />}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
