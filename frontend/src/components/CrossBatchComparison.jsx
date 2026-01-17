import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Trophy, AlertTriangle } from 'lucide-react'

export default function CrossBatchComparison({ batchComparison, variable }) {
  if (!batchComparison?.available) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-400">
        {batchComparison?.reason === 'single_batch' 
          ? 'Cross-batch comparison requires multiple batches'
          : 'No batch comparison data available'}
      </div>
    )
  }

  const varData = batchComparison.variables?.[variable]
  
  if (!varData) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-400">
        Select a variable to see batch comparison
      </div>
    )
  }

  const { batch_metrics, rankings, outlier_batches, variance_analysis } = varData

  // Prepare chart data
  const chartData = Object.entries(batch_metrics).map(([batchId, metrics]) => ({
    batch: batchId,
    integrated: metrics.integrated_value,
    max: metrics.max_value,
    mean: metrics.mean_value
  }))

  // Get top performers
  const topByIntegrated = rankings?.integrated_value?.slice(0, 3) || []

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-sm font-medium">{variable} — Batch Comparison</h4>
          <p className="text-xs text-gray-500">
            {Object.keys(batch_metrics).length} batches analyzed
          </p>
        </div>
        {variance_analysis && (
          <div className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
            variance_analysis.cv < 20 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
          }`}>
            CV: {variance_analysis.cv?.toFixed(1)}%
          </div>
        )}
      </div>

      {/* Integrated Value Chart */}
      <div>
        <p className="text-xs text-gray-500 mb-2">Integrated Value (Area Under Curve)</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis 
              dataKey="batch" 
              tick={{ fontSize: 10, fill: '#999' }}
              tickLine={{ stroke: '#e0e0e0' }}
              axisLine={{ stroke: '#e0e0e0' }}
            />
            <YAxis 
              tick={{ fontSize: 10, fill: '#999' }}
              tickLine={{ stroke: '#e0e0e0' }}
              axisLine={{ stroke: '#e0e0e0' }}
            />
            <Tooltip 
              contentStyle={{ 
                background: '#fff', 
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '12px'
              }}
            />
            <Bar dataKey="integrated" fill="#111" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Performers */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium">Top Performers</span>
          </div>
          <div className="space-y-2">
            {topByIntegrated.map((item, i) => (
              <div key={item.batch_id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                    i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {i + 1}
                  </span>
                  {item.batch_id}
                </span>
                <span className="font-mono text-gray-600">{item.value?.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Variance Analysis */}
        <div className="bg-gray-50 rounded-lg p-4">
          <span className="text-sm font-medium">Variance Analysis</span>
          <div className="mt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Mean</span>
              <span className="font-medium">{variance_analysis?.mean?.toFixed(3)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Std Dev</span>
              <span className="font-medium">{variance_analysis?.std?.toFixed(3)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">CV</span>
              <span className={`font-medium ${variance_analysis?.cv < 20 ? 'text-green-600' : 'text-amber-600'}`}>
                {variance_analysis?.cv?.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Outliers */}
      {outlier_batches?.length > 0 && (
        <div className="bg-amber-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">Outlier Batches</span>
          </div>
          <p className="text-sm text-amber-700">
            {outlier_batches.join(', ')}
          </p>
        </div>
      )}
    </div>
  )
}
