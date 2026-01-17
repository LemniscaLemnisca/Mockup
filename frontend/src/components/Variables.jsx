import React from 'react'

export default function Variables({ variables, selected, onSelect }) {
  const getDensityBadge = (density) => {
    const type = density?.type || 'unknown'
    const styles = {
      continuous: 'bg-green-50 text-green-700',
      intermittent: 'bg-amber-50 text-amber-700',
      sparse: 'bg-red-50 text-red-700',
      empty: 'bg-gray-100 text-gray-500',
      unknown: 'bg-gray-100 text-gray-500'
    }
    return styles[type] || styles.unknown
  }

  if (!variables || variables.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-sm text-gray-500">No variables detected</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-medium">Variables</h3>
        <p className="text-xs text-gray-500">{variables.length} numeric</p>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {variables.map((v) => (
          <button
            key={v.variable}
            onClick={() => onSelect(v.variable)}
            className={`
              w-full px-4 py-3 text-left border-b border-gray-100 last:border-0
              transition-colors hover:bg-gray-50
              ${selected === v.variable ? 'bg-gray-50' : ''}
            `}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`text-sm font-medium truncate mr-2 ${selected === v.variable ? 'text-black' : 'text-gray-700'}`}>
                {v.variable}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${getDensityBadge(v.density)}`}>
                {v.density?.type || 'unknown'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              {v.stats?.mean != null && <span>mean = {v.stats.mean.toFixed(2)}</span>}
              {v.stats?.std != null && <span>std = {v.stats.std.toFixed(2)}</span>}
              {v.missing_pct > 0 && (
                <span className="text-amber-600">{v.missing_pct.toFixed(1)}% missing</span>
              )}
            </div>
            {v.flatline?.is_flatlined && (
              <span className="text-xs text-red-500">⚠ Flatlined</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
