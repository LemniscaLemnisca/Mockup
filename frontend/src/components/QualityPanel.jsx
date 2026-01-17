import React from 'react'
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react'

export default function QualityPanel({ quality }) {
  const overallScore = quality?.overall?.score || 0
  const flags = quality?.overall?.flags || []
  const variables = quality?.variables || []

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-amber-600'
    return 'text-red-600'
  }

  const getScoreIcon = (score) => {
    if (score >= 80) return CheckCircle
    if (score >= 60) return AlertTriangle
    return XCircle
  }

  const ScoreIcon = getScoreIcon(overallScore)

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-full bg-gray-50 ${getScoreColor(overallScore)}`}>
          <ScoreIcon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm text-gray-500">Overall Quality Score</p>
          <p className={`text-3xl font-semibold ${getScoreColor(overallScore)}`}>
            {overallScore.toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Flags */}
      {flags.length > 0 && (
        <div className="bg-amber-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-amber-800 mb-2">Quality Flags</h4>
          <ul className="space-y-1">
            {flags.map((flag, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {flag.replace(/_/g, ' ').replace(/:/g, ': ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Completeness */}
        <div>
          <h4 className="text-sm font-medium mb-3">Data Completeness</h4>
          <div className="space-y-2">
            {variables.slice(0, 8).map((v) => {
              const completeness = 100 - (v.missing_pct || 0)
              return (
                <div key={v.variable} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-600 truncate">{v.variable}</p>
                  </div>
                  <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        completeness >= 95 ? 'bg-green-500' : 
                        completeness >= 80 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${completeness}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-12 text-right">
                    {completeness.toFixed(0)}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Signal Density */}
        <div>
          <h4 className="text-sm font-medium mb-3">Signal Classification</h4>
          <div className="space-y-2">
            {variables.slice(0, 8).map((v) => {
              const density = v.density?.type || 'unknown'
              const densityColors = {
                continuous: 'bg-green-100 text-green-700',
                intermittent: 'bg-amber-100 text-amber-700',
                sparse: 'bg-red-100 text-red-700',
                empty: 'bg-gray-100 text-gray-500',
                unknown: 'bg-gray-100 text-gray-500'
              }
              return (
                <div key={v.variable} className="flex items-center justify-between">
                  <span className="text-xs text-gray-600 truncate max-w-[150px]">{v.variable}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${densityColors[density]}`}>
                    {density}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Sampling Info */}
      {variables[0]?.sampling?.available && (
        <div>
          <h4 className="text-sm font-medium mb-3">Sampling Statistics</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Mean Interval</p>
              <p className="text-sm font-medium">
                {variables[0].sampling.mean_interval?.toFixed(3)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Std Interval</p>
              <p className="text-sm font-medium">
                {variables[0].sampling.std_interval?.toFixed(3)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Regularity</p>
              <p className={`text-sm font-medium ${
                variables[0].sampling.regularity_score > 0.7 ? 'text-green-600' : 'text-amber-600'
              }`}>
                {(variables[0].sampling.regularity_score * 100)?.toFixed(0)}%
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Status</p>
              <p className={`text-sm font-medium ${
                variables[0].sampling.is_regular ? 'text-green-600' : 'text-amber-600'
              }`}>
                {variables[0].sampling.is_regular ? 'Regular' : 'Irregular'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
