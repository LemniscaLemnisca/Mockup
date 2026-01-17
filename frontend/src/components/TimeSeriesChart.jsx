import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, ComposedChart, Label } from 'recharts'

const COLORS = ['#111', '#0066FF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316']

export default function TimeSeriesChart({ rawData, variable, batches, isMultiBatch, timeColumn }) {
  // Extract axis labels from variable name and time column
  const yAxisLabel = variable || 'Value'
  const xAxisLabel = timeColumn || 'Time'
  const { chartData, lines, mode, stats } = useMemo(() => {
    if (!variable) {
      return { chartData: [], lines: [], mode: 'none', stats: null }
    }

    // For multi-batch datasets, always use batch_series for proper visualization
    if (isMultiBatch && rawData?.batch_series) {
      const allBatchIds = Object.keys(rawData.batch_series)
      const selectedBatches = batches?.length > 0 ? batches : allBatchIds
      const selectedCount = selectedBatches.length

      if (selectedCount <= 10 && batches?.length > 0) {
        // Overlay mode: show individual batch lines
        // Each batch is a separate line with its own complete data
        const linesData = []
        let totalPoints = 0
        
        selectedBatches.forEach((batch, i) => {
          const series = rawData?.batch_series?.[batch]?.[variable] || []
          const sortedSeries = [...series].sort((a, b) => a.time - b.time)
          totalPoints += sortedSeries.length
          
          linesData.push({
            batch,
            data: sortedSeries,
            color: COLORS[i % COLORS.length]
          })
        })
        
        // For Recharts, we need a single data array
        // Combine all batch data, each point tagged with its batch
        const combinedData = []
        
        // Get all unique times across selected batches
        const allTimes = new Set()
        linesData.forEach(({ data }) => {
          data.forEach(d => allTimes.add(d.time))
        })
        
        const sortedTimes = Array.from(allTimes).sort((a, b) => a - b)
        
        // For each time, include values from all batches that have data at that time
        sortedTimes.forEach(time => {
          const point = { time }
          linesData.forEach(({ batch, data }) => {
            const match = data.find(d => d.time === time)
            if (match) {
              point[batch] = match.value
            }
          })
          combinedData.push(point)
        })
        
        return {
          chartData: combinedData,
          lines: linesData.map(({ batch, color }) => ({
            key: batch,
            color
          })),
          mode: 'overlay',
          stats: { batchCount: selectedCount, pointCount: totalPoints }
        }
      } else {
        // Aggregate mode: show mean with min/max bands
        // Used when: no selection (all batches) OR more than 10 batches selected
        const timeMap = new Map()
        
        selectedBatches.forEach(batch => {
          const series = rawData?.batch_series?.[batch]?.[variable] || []
          series.forEach(d => {
            if (!timeMap.has(d.time)) {
              timeMap.set(d.time, [])
            }
            timeMap.get(d.time).push(d.value)
          })
        })
        
        const data = Array.from(timeMap.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([time, values]) => {
            const mean = values.reduce((a, b) => a + b, 0) / values.length
            const min = Math.min(...values)
            const max = Math.max(...values)
            const std = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length)
            
            return {
              time,
              mean,
              min,
              max,
              range: [min, max],
              std,
              upper: mean + std,
              lower: mean - std,
              batchCount: values.length
            }
          })
        
        return {
          chartData: data,
          lines: [],
          mode: 'aggregate',
          stats: { batchCount: selectedCount, pointCount: data.length }
        }
      }
    }

    // Single batch dataset - just show the time series
    const data = rawData?.time_series?.[variable] || []
    return {
      chartData: data,
      lines: [{ key: 'value', color: COLORS[0] }],
      mode: 'single',
      stats: null
    }
  }, [rawData, variable, batches, isMultiBatch])

  if (!variable) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-400">
        Select a variable to visualize
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-400">
        No data available for {variable}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4">
        <h4 className="text-sm font-medium">{variable}</h4>
        <p className="text-xs text-gray-500">
          {mode === 'aggregate' 
            ? `Mean trajectory across ${stats?.batchCount} batches (${chartData.length} time points)`
            : mode === 'overlay'
            ? `${stats?.pointCount} data points across ${stats?.batchCount} batches`
            : `${chartData.length} data points`
          }
        </p>
        {mode === 'aggregate' && (
          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-0.5 bg-black"></div>
              <span className="text-gray-600">Mean</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-3 bg-gray-200 rounded-sm"></div>
              <span className="text-gray-600">±1 Std Dev</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-0.5 bg-blue-400"></div>
              <span className="text-gray-600">Min</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-0.5 bg-red-400"></div>
              <span className="text-gray-600">Max</span>
            </div>
          </div>
        )}
      </div>
      
      <ResponsiveContainer width="100%" height={340}>
        {mode === 'aggregate' ? (
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 40, left: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="time" 
              tick={{ fontSize: 11, fill: '#999' }}
              tickLine={{ stroke: '#e0e0e0' }}
              axisLine={{ stroke: '#e0e0e0' }}
            >
              <Label value={xAxisLabel} position="bottom" offset={20} style={{ fontSize: 12, fill: '#666' }} />
            </XAxis>
            <YAxis 
              tick={{ fontSize: 11, fill: '#999' }}
              tickLine={{ stroke: '#e0e0e0' }}
              axisLine={{ stroke: '#e0e0e0' }}
            >
              <Label value={yAxisLabel} angle={-90} position="left" offset={40} style={{ fontSize: 12, fill: '#666', textAnchor: 'middle' }} />
            </YAxis>
            <Tooltip 
              contentStyle={{ 
                background: '#fff', 
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              formatter={(value, name) => {
                if (name === 'mean') return [value?.toFixed(3), 'Mean']
                if (name === 'min') return [value?.toFixed(3), 'Min']
                if (name === 'max') return [value?.toFixed(3), 'Max']
                return [value?.toFixed(3), name]
              }}
            />
            <Area
              type="monotone"
              dataKey="upper"
              stroke="none"
              fill="#e5e7eb"
              fillOpacity={0.5}
            />
            <Area
              type="monotone"
              dataKey="lower"
              stroke="none"
              fill="#fff"
              fillOpacity={1}
            />
            <Line
              type="monotone"
              dataKey="mean"
              stroke="#111"
              strokeWidth={2}
              dot={false}
              name="Mean"
            />
            <Line
              type="monotone"
              dataKey="min"
              stroke="#60a5fa"
              strokeWidth={1}
              strokeDasharray="4 2"
              dot={false}
              name="Min"
            />
            <Line
              type="monotone"
              dataKey="max"
              stroke="#f87171"
              strokeWidth={1}
              strokeDasharray="4 2"
              dot={false}
              name="Max"
            />
          </ComposedChart>
        ) : (
          <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 40, left: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="time" 
              tick={{ fontSize: 11, fill: '#999' }}
              tickLine={{ stroke: '#e0e0e0' }}
              axisLine={{ stroke: '#e0e0e0' }}
            >
              <Label value={xAxisLabel} position="bottom" offset={20} style={{ fontSize: 12, fill: '#666' }} />
            </XAxis>
            <YAxis 
              tick={{ fontSize: 11, fill: '#999' }}
              tickLine={{ stroke: '#e0e0e0' }}
              axisLine={{ stroke: '#e0e0e0' }}
            >
              <Label value={yAxisLabel} angle={-90} position="left" offset={40} style={{ fontSize: 12, fill: '#666', textAnchor: 'middle' }} />
            </YAxis>
            <Tooltip 
              contentStyle={{ 
                background: '#fff', 
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '12px'
              }}
            />
            {lines.length > 1 && <Legend />}
            {lines.map(line => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                stroke={line.color}
                strokeWidth={1.5}
                dot={false}
                name={line.key}
                connectNulls
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
