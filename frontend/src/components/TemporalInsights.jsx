import React from 'react'
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react'

export default function TemporalInsights({ temporal, variable, batches }) {
  if (!temporal?.available) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-400">
        No temporal analysis available (missing time column)
      </div>
    )
  }

  const varData = temporal.variables?.[variable]
  
  if (!varData) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-400">
        Select a variable to see temporal insights
      </div>
    )
  }

  const batchIds = Object.keys(varData.batches || {})
  const displayBatches = batches?.length > 0 
    ? batchIds.filter(b => batches.includes(b))
    : batchIds.slice(0, 5)

  const getTrendIcon = (direction) => {
    if (direction === 'increasing') return <TrendingUp className="w-4 h-4 text-green-600" />
    if (direction === 'decreasing') return <TrendingDown className="w-4 h-4 text-red-600" />
    return <Minus className="w-4 h-4 text-gray-400" />
  }

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium mb-1">{variable}</h4>
        <p className="text-xs text-gray-500">Temporal analysis across {displayBatches.length} batch(es)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayBatches.map(batchId => {
          const batch = varData.batches[batchId]
          if (!batch) return null

          return (
            <div key={batchId} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">{batchId}</span>
                <div className="flex items-center gap-1">
                  {getTrendIcon(batch.trend?.direction)}
                  <span className="text-xs text-gray-500">{batch.trend?.direction || 'unknown'}</span>
                </div>
              </div>

              {/* Derivative Stats */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <p className="text-xs text-gray-500">Mean Rate</p>
                  <p className="text-sm font-medium">{batch.derivative?.mean?.toFixed(4) || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Max Rate</p>
                  <p className="text-sm font-medium">{batch.derivative?.max?.toFixed(4) || '—'}</p>
                </div>
              </div>

              {/* Growth Metrics */}
              {batch.growth_metrics?.is_growth_like && (
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <p className="text-xs text-gray-500 mb-1">Growth-like Signal</p>
                  <div className="flex gap-4 text-xs">
                    <span>Max slope: {batch.growth_metrics.max_slope?.toFixed(4)}</span>
                    <span>Stability: {(batch.growth_metrics.stability_score * 100)?.toFixed(0)}%</span>
                  </div>
                </div>
              )}

              {/* Phases */}
              {batch.phases?.length > 0 && (
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <p className="text-xs text-gray-500 mb-1">Detected Phases</p>
                  <div className="flex flex-wrap gap-1">
                    {batch.phases.slice(0, 5).map((phase, i) => (
                      <span 
                        key={i}
                        className={`text-xs px-2 py-0.5 rounded ${
                          phase.phase_type === 'increasing' ? 'bg-green-100 text-green-700' :
                          phase.phase_type === 'decreasing' ? 'bg-red-100 text-red-700' :
                          'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {phase.phase_type}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Change Points */}
              {batch.change_points?.length > 0 && (
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <p className="text-xs text-gray-500">
                    {batch.change_points.length} change point(s) detected
                  </p>
                </div>
              )}

              {/* Trend Stats */}
              {batch.trend?.available && (
                <div className="border-t border-gray-200 pt-2 mt-2 text-xs text-gray-500">
                  R² = {batch.trend.r_squared?.toFixed(3)} | 
                  slope = {batch.trend.slope?.toFixed(4)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
