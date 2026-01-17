import React, { useState } from 'react'
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronRight } from 'lucide-react'

export default function IssuesPanel({ issues }) {
  const [expanded, setExpanded] = useState({})

  if (!issues || issues.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 text-green-600">
          <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <p className="font-medium">No Issues Detected</p>
            <p className="text-sm text-gray-500">Data quality checks passed</p>
          </div>
        </div>
      </div>
    )
  }

  const getSeverityStyle = (severity) => {
    switch (severity) {
      case 'high':
        return { bg: 'bg-red-50', text: 'text-red-700', icon: AlertCircle, iconColor: 'text-red-500' }
      case 'warning':
        return { bg: 'bg-amber-50', text: 'text-amber-700', icon: AlertTriangle, iconColor: 'text-amber-500' }
      default:
        return { bg: 'bg-blue-50', text: 'text-blue-700', icon: Info, iconColor: 'text-blue-500' }
    }
  }

  const toggleExpand = (index) => {
    setExpanded(prev => ({ ...prev, [index]: !prev[index] }))
  }

  const groupedIssues = issues.reduce((acc, issue) => {
    const type = issue.type
    if (!acc[type]) acc[type] = []
    acc[type].push(issue)
    return acc
  }, {})

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-sm font-medium">Detected Issues</h3>
        <p className="text-xs text-gray-500 mt-1">{issues.length} issues found across the dataset</p>
      </div>
      
      <div className="divide-y divide-gray-100">
        {issues.map((issue, index) => {
          const style = getSeverityStyle(issue.severity)
          const Icon = style.icon
          const isExpanded = expanded[index]
          
          return (
            <div key={index} className="px-6 py-4">
              <button
                onClick={() => toggleExpand(index)}
                className="w-full flex items-start gap-3 text-left"
              >
                <div className={`p-1.5 rounded-lg ${style.bg}`}>
                  <Icon className={`w-4 h-4 ${style.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{issue.variable}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                      {issue.type}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">{issue.description}</p>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>
              
              {isExpanded && issue.details && (
                <div className="mt-3 ml-10 p-3 bg-gray-50 rounded-lg text-xs font-mono">
                  <pre className="whitespace-pre-wrap text-gray-600">
                    {JSON.stringify(issue.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
