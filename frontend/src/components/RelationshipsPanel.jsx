import React from 'react'
import { ArrowRight } from 'lucide-react'

export default function RelationshipsPanel({ relationships, selectedVariable }) {
  if (!relationships || relationships.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-400">
        No relationship data available (need at least 2 numeric variables)
      </div>
    )
  }

  // Filter to show relationships involving selected variable, or top relationships
  const filteredRelationships = selectedVariable
    ? relationships.filter(r => r.var_x === selectedVariable || r.var_y === selectedVariable)
    : relationships

  const displayRelationships = filteredRelationships.slice(0, 15)

  const getCorrelationColor = (r) => {
    const absR = Math.abs(r)
    if (absR > 0.7) return r > 0 ? 'text-green-600' : 'text-red-600'
    if (absR > 0.4) return r > 0 ? 'text-green-500' : 'text-red-500'
    return 'text-gray-500'
  }

  const getCorrelationBg = (r) => {
    const absR = Math.abs(r)
    if (absR > 0.7) return r > 0 ? 'bg-green-50' : 'bg-red-50'
    if (absR > 0.4) return r > 0 ? 'bg-green-50/50' : 'bg-red-50/50'
    return 'bg-gray-50'
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium">Variable Relationships</h4>
        <p className="text-xs text-gray-500">
          {selectedVariable 
            ? `Showing correlations with ${selectedVariable}`
            : `Top ${displayRelationships.length} correlations`}
        </p>
      </div>

      <div className="space-y-2">
        {displayRelationships.map((rel, i) => {
          const pearsonR = rel.correlation?.pearson?.r
          const spearmanR = rel.correlation?.spearman?.r
          const laggedR = rel.lagged_correlation?.best_correlation
          const bestLag = rel.lagged_correlation?.best_lag
          const stability = rel.cross_batch_stability

          return (
            <div 
              key={i} 
              className={`rounded-lg p-4 ${getCorrelationBg(pearsonR)}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium truncate max-w-[120px]">{rel.var_x}</span>
                  <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="font-medium truncate max-w-[120px]">{rel.var_y}</span>
                </div>
                <span className={`text-lg font-semibold ${getCorrelationColor(pearsonR)}`}>
                  {pearsonR?.toFixed(3)}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-gray-500">Pearson</span>
                  <p className={`font-medium ${getCorrelationColor(pearsonR)}`}>
                    {pearsonR?.toFixed(3)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Spearman</span>
                  <p className={`font-medium ${getCorrelationColor(spearmanR)}`}>
                    {spearmanR?.toFixed(3)}
                  </p>
                </div>
                {rel.lagged_correlation?.available && (
                  <div>
                    <span className="text-gray-500">Best Lag</span>
                    <p className="font-medium">
                      {laggedR?.toFixed(3)} @ lag {bestLag}
                    </p>
                  </div>
                )}
                {stability?.available && (
                  <div>
                    <span className="text-gray-500">Stability</span>
                    <p className={`font-medium ${stability.is_stable ? 'text-green-600' : 'text-amber-600'}`}>
                      {(stability.consistency_score * 100)?.toFixed(0)}%
                    </p>
                  </div>
                )}
              </div>

              {rel.correlation?.pearson?.p_value != null && (
                <div className="mt-2 text-xs text-gray-400">
                  p-value: {rel.correlation.pearson.p_value < 0.001 
                    ? '< 0.001' 
                    : rel.correlation.pearson.p_value.toFixed(4)}
                  {rel.correlation.pearson.p_value < 0.05 && ' (significant)'}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {relationships.length > displayRelationships.length && (
        <p className="text-xs text-gray-500 text-center">
          Showing {displayRelationships.length} of {relationships.length} relationships
        </p>
      )}
    </div>
  )
}
