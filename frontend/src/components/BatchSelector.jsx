import React from 'react'
import { Check } from 'lucide-react'

export default function BatchSelector({ batches, selected, onChange }) {
  const toggleBatch = (batch) => {
    if (selected.includes(batch)) {
      onChange(selected.filter(b => b !== batch))
    } else {
      onChange([...selected, batch])
    }
  }

  const selectAll = () => onChange([...batches])
  const clearAll = () => onChange([])

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-medium">Batch Selection</h3>
        <div className="flex gap-2">
          <button 
            onClick={selectAll}
            className="text-xs text-gray-500 hover:text-black"
          >
            All
          </button>
          <span className="text-gray-300">|</span>
          <button 
            onClick={clearAll}
            className="text-xs text-gray-500 hover:text-black"
          >
            None
          </button>
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto p-2">
        {batches.map((batch) => (
          <button
            key={batch}
            onClick={() => toggleBatch(batch)}
            className={`
              w-full px-3 py-2 rounded-lg text-left text-sm flex items-center justify-between
              transition-colors
              ${selected.includes(batch) ? 'bg-gray-100' : 'hover:bg-gray-50'}
            `}
          >
            <span className={selected.includes(batch) ? 'font-medium' : 'text-gray-600'}>
              {batch}
            </span>
            {selected.includes(batch) && (
              <Check className="w-4 h-4 text-black" />
            )}
          </button>
        ))}
      </div>
      <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
        {selected.length} of {batches.length} selected
      </div>
    </div>
  )
}
