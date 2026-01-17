import { useState } from 'react'
import { Database, Clock, Layers, Activity, CheckCircle, AlertTriangle, Info } from 'lucide-react'

function StatCard({ icon: Icon, label, value, sub, tooltip }) {
  const [showTooltip, setShowTooltip] = useState(false)
  
  return (
    <div 
      className="bg-white rounded-xl border border-gray-200 p-5 relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{label}</p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          <p className="text-xs text-gray-400 mt-1">{sub}</p>
        </div>
        <Icon className="w-5 h-5 text-gray-400" />
      </div>
      
      {tooltip && showTooltip && (
        <div className="absolute z-10 top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg max-w-xs">
          {tooltip}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900"></div>
        </div>
      )}
    </div>
  )
}

export default function Overview({ overview, quality }) {
  const qualityScore = quality?.score || 0
  const QualityIcon = qualityScore >= 80 ? CheckCircle : AlertTriangle
  const qualityColor = qualityScore >= 80 ? 'text-green-600' : qualityScore >= 60 ? 'text-amber-600' : 'text-red-600'
  const qualityBg = qualityScore >= 80 ? 'bg-green-50' : qualityScore >= 60 ? 'bg-amber-50' : 'bg-red-50'

  const stats = [
    {
      icon: Database,
      label: 'Data Points',
      value: overview?.rows?.toLocaleString() || '—',
      sub: `${overview?.columns || 0} columns`,
      tooltip: 'Total number of rows in the dataset and the number of columns detected.'
    },
    {
      icon: Layers,
      label: 'Batches',
      value: overview?.batch_count || 1,
      sub: overview?.is_multi_batch ? 'Multi-batch dataset' : 'Single batch',
      tooltip: overview?.batch_column 
        ? `Batch column: "${overview.batch_column}". Each batch represents a separate experimental run.`
        : 'No batch column detected. Dataset treated as single batch.'
    },
    {
      icon: Clock,
      label: 'Duration',
      value: overview?.duration ? `${overview.duration.span.toFixed(1)}` : '—',
      sub: overview?.duration ? `${overview.duration.min.toFixed(1)} → ${overview.duration.max.toFixed(1)}` : 'No time data',
      tooltip: overview?.time_column
        ? `Time column: "${overview.time_column}". Range from ${overview?.duration?.min?.toFixed(2) || 0} to ${overview?.duration?.max?.toFixed(2) || 0}.`
        : 'No time column detected in the dataset.'
    },
    {
      icon: Activity,
      label: 'Variables',
      value: overview?.numeric_variables?.length || 0,
      sub: `${overview?.categorical_variables?.length || 0} categorical`,
      tooltip: `${overview?.numeric_variables?.length || 0} numeric variables available for analysis. ${overview?.categorical_variables?.length || 0} categorical variables detected.`
    }
  ]

  const qualityTooltip = quality?.flags?.length > 0
    ? `Quality flags: ${quality.flags.map(f => f.replace(/_/g, ' ')).join(', ')}`
    : 'No quality issues detected. Data is complete and well-structured.'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat, i) => (
          <StatCard key={i} {...stat} />
        ))}
        
        {/* Quality Score Card */}
        <StatCard
          icon={QualityIcon}
          label="Quality Score"
          value={`${qualityScore.toFixed(0)}%`}
          sub={`${quality?.flags?.length || 0} flags`}
          tooltip={qualityTooltip}
        />
      </div>
    </div>
  )
}
