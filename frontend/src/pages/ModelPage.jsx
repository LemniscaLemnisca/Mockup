import { useState, useMemo } from 'react'
import { ArrowLeft, Play, Loader2, CheckCircle2, FlaskConical, Cpu, Brain, TreeDeciduous, Sparkles, TrendingUp } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, Legend, ReferenceLine } from 'recharts'
import Lottie from 'lottie-react'
import aiLoadingAnimation from '../assets/Ai_loading_model.json'

// Penicillin fermentation specific configuration
const PENICILLIN_FEATURES = [
  'time', 'aeration_rate', 'agitator_rpm', 'sugar_feed_rate', 
  'ph', 'temperature', 'paa_flow', 'do2_concentration'
]

const PENICILLIN_TARGETS = {
  biomass: { name: 'Biomass Concentration', unit: 'g/L', key: 'offline_biomass_concentration' },
  penicillin: { name: 'Penicillin Concentration', unit: 'g/L', key: 'penicillin_concentration' }
}

// Model definitions - 4 models for 2x2 grid
const MODELS = [
  { 
    id: 'linear-regression', 
    name: 'Linear Regression', 
    type: 'Statistical',
    icon: TrendingUp,
    description: 'Simple, interpretable baseline model for understanding feature relationships',
    bestFor: 'Linear relationships',
    note: 'Fast training • Highly interpretable • Good baseline',
    metrics: {
      biomass: { train: { mae: 1.77, rmse: 2.23, r2: 0.8995 }, val: { mae: 1.96, rmse: 2.53, r2: 0.866 }, test: { mae: 2.00, rmse: 2.67, r2: 0.858 } },
      penicillin: { train: { mae: 2.12, rmse: 2.89, r2: 0.8721 }, val: { mae: 2.45, rmse: 3.12, r2: 0.842 }, test: { mae: 2.51, rmse: 3.28, r2: 0.831 } }
    }
  },
  { 
    id: 'random-forest', 
    name: 'Random Forest', 
    type: 'Ensemble',
    icon: TreeDeciduous,
    description: 'Robust ensemble of decision trees that captures non-linear patterns',
    bestFor: 'Non-linear regression',
    note: 'Handles outliers • Feature importance • No scaling needed',
    metrics: {
      biomass: { train: { mae: 0.57, rmse: 0.80, r2: 0.987 }, val: { mae: 0.89, rmse: 1.27, r2: 0.966 }, test: { mae: 0.93, rmse: 1.44, r2: 0.959 } },
      penicillin: { train: { mae: 0.68, rmse: 0.95, r2: 0.982 }, val: { mae: 1.05, rmse: 1.48, r2: 0.958 }, test: { mae: 1.12, rmse: 1.62, r2: 0.951 } }
    }
  },
  { 
    id: 'xgboost', 
    name: 'XGBoost', 
    type: 'Gradient Boosting',
    icon: Cpu,
    description: 'State-of-the-art gradient boosting for tabular data',
    bestFor: 'Complex regression',
    note: 'High accuracy • Regularization built-in • Industry standard',
    metrics: {
      biomass: { train: { mae: 0.42, rmse: 0.61, r2: 0.993 }, val: { mae: 0.78, rmse: 1.15, r2: 0.972 }, test: { mae: 0.85, rmse: 1.31, r2: 0.966 } },
      penicillin: { train: { mae: 0.51, rmse: 0.74, r2: 0.991 }, val: { mae: 0.92, rmse: 1.35, r2: 0.965 }, test: { mae: 1.01, rmse: 1.52, r2: 0.958 } }
    }
  },
  { 
    id: 'hybrid-model', 
    name: 'Hybrid Kinetic-ML', 
    type: 'Physics-Informed',
    icon: FlaskConical,
    description: 'Combines Monod kinetics with ML for biologically constrained predictions',
    bestFor: 'Bioprocess modeling',
    note: 'Domain knowledge • Extrapolates better • Scientifically grounded',
    metrics: {
      biomass: { train: { mae: 0.31, rmse: 0.48, r2: 0.996 }, val: { mae: 0.65, rmse: 0.98, r2: 0.980 }, test: { mae: 0.72, rmse: 1.12, r2: 0.975 } },
      penicillin: { train: { mae: 0.38, rmse: 0.58, r2: 0.994 }, val: { mae: 0.82, rmse: 1.25, r2: 0.972 }, test: { mae: 0.91, rmse: 1.41, r2: 0.964 } }
    }
  }
]

// Simulation input ranges for penicillin fermentation
const SIMULATION_INPUTS = [
  { id: 'time', name: 'Process Time', unit: 'h', min: 0, max: 300, default: 150, step: 1 },
  { id: 'aeration_rate', name: 'Aeration Rate', unit: 'L/h', min: 20, max: 120, default: 65, step: 1 },
  { id: 'agitator_rpm', name: 'Agitator RPM', unit: 'RPM', min: 50, max: 150, default: 100, step: 1 },
  { id: 'sugar_feed_rate', name: 'Sugar Feed Rate', unit: 'L/h', min: 0, max: 150, default: 75, step: 1 },
  { id: 'ph', name: 'pH', unit: '', min: 4.5, max: 7.5, default: 6.5, step: 0.1 },
  { id: 'temperature', name: 'Temperature', unit: '°C', min: 20, max: 35, default: 25, step: 0.5 },
  { id: 'paa_flow', name: 'PAA Flow Rate', unit: 'L/h', min: 0, max: 15, default: 5, step: 0.1 },
  { id: 'do2_concentration', name: 'DO₂ Concentration', unit: '%', min: 0, max: 100, default: 50, step: 1 }
]

export default function ModelPage({ onBack, insights }) {
  const [selectedModel, setSelectedModel] = useState(null)
  const [training, setTraining] = useState(false)
  const [trained, setTrained] = useState(false)
  const [progress, setProgress] = useState(0)
  const [activeTab, setActiveTab] = useState('performance')
  
  // Fixed target - penicillin only
  const selectedTarget = 'penicillin'
  
  // Simulation state
  const [simInputs, setSimInputs] = useState(
    SIMULATION_INPUTS.reduce((acc, inp) => ({ ...acc, [inp.id]: inp.default }), {})
  )
  const [simRunning, setSimRunning] = useState(false)
  const [simResults, setSimResults] = useState(null)
  const [showOptimizeModal, setShowOptimizeModal] = useState(false)

  // Analyze dataset compatibility
  const datasetInfo = useMemo(() => {
    if (!insights?.overview) return null
    
    const { rows, numeric_variables, is_multi_batch, batch_count } = insights.overview
    const variables = numeric_variables || []
    
    // Check for penicillin-specific variables
    const hasBiomass = variables.some(v => 
      v.toLowerCase().includes('biomass') || v.toLowerCase().includes('cell')
    )
    const hasPenicillin = variables.some(v => 
      v.toLowerCase().includes('penicillin') || v.toLowerCase().includes('product')
    )
    
    // Find matching features
    const matchedFeatures = PENICILLIN_FEATURES.filter(f => 
      variables.some(v => v.toLowerCase().includes(f.replace('_', ' ')) || v.toLowerCase().includes(f))
    )
    
    return {
      rows,
      variableCount: variables.length,
      isMultiBatch: is_multi_batch,
      batchCount: batch_count || 1,
      hasBiomass,
      hasPenicillin,
      matchedFeatures,
      variables
    }
  }, [insights])

  // Generate mock prediction data for penicillin
  const generatePredictionData = useMemo(() => {
    if (!trained || !selectedModel || !insights?.plot_ready) return null
    
    const metrics = selectedModel.metrics.penicillin
    const testRmse = metrics.test.rmse
    
    // Generate sorted comparison data (actual vs predicted, sorted by actual value)
    const comparisonData = []
    for (let i = 0; i < 50; i++) {
      // Penicillin range: 0.2-4 g/L, sorted
      const actual = 0.2 + (i / 49) * 3.8
      const noise = (Math.random() - 0.5) * testRmse * 0.8
      comparisonData.push({
        index: i + 1,
        actual: parseFloat(actual.toFixed(2)),
        predicted: parseFloat(Math.max(0, actual + noise).toFixed(2))
      })
    }
    
    // Generate time series prediction for a representative batch
    const timeSeriesData = []
    const maxTime = 280
    for (let t = 0; t <= maxTime; t += 4) {
      // Penicillin: delayed production curve (typical fermentation profile)
      const penicillinActual = t > 50 ? 4 * (1 - Math.exp(-0.015 * (t - 50))) + (Math.random() - 0.5) * 0.15 : 0
      const penicillinNoise = (Math.random() - 0.5) * testRmse * 0.25
      
      timeSeriesData.push({
        time: t,
        actual: parseFloat(Math.max(0, penicillinActual).toFixed(2)),
        predicted: parseFloat(Math.max(0, penicillinActual + penicillinNoise).toFixed(2))
      })
    }
    
    // Generate residual data
    const residualData = comparisonData.map(d => ({
      predicted: d.predicted,
      residual: parseFloat((d.predicted - d.actual).toFixed(3))
    }))
    
    return { comparisonData, timeSeriesData, residualData }
  }, [trained, selectedModel, insights])

  const handleSelectModel = (model) => {
    setSelectedModel(model)
    setTrained(false)
    setSimResults(null)
  }

  const handleTrain = () => {
    setTraining(true)
    setProgress(0)
    
    const totalDuration = 6000 + Math.random() * 2000
    const startTime = Date.now()
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const newProgress = Math.min((elapsed / totalDuration) * 100, 99)
      setProgress(newProgress)
      
      if (elapsed >= totalDuration) {
        clearInterval(interval)
        setProgress(100)
        setTimeout(() => {
          setTraining(false)
          setTrained(true)
        }, 300)
      }
    }, 100)
  }

  const handleSimulate = () => {
    setSimRunning(true)
    setTimeout(() => {
      // Simulate based on inputs - using simplified kinetic relationships
      const { time, sugar_feed_rate, temperature, ph, do2_concentration, aeration_rate } = simInputs
      
      // Biomass prediction (logistic growth influenced by conditions)
      const tempFactor = 1 - Math.abs(temperature - 25) * 0.02
      const phFactor = 1 - Math.abs(ph - 6.5) * 0.1
      const doFactor = do2_concentration / 100
      const growthRate = 0.03 * tempFactor * phFactor * doFactor
      
      const predictedBiomass = 20 / (1 + Math.exp(-growthRate * (time - 100)))
      
      // Penicillin prediction (product formation linked to biomass)
      const productionStart = time > 50 ? time - 50 : 0
      const sugarEffect = sugar_feed_rate / 75
      const predictedPenicillin = productionStart > 0 
        ? 4 * sugarEffect * (1 - Math.exp(-0.015 * productionStart)) * predictedBiomass / 20
        : 0
      
      // Confidence based on how close inputs are to optimal
      const optimalScore = (tempFactor + phFactor + doFactor) / 3
      const confidence = 75 + optimalScore * 20
      
      setSimResults({
        biomass: parseFloat(predictedBiomass.toFixed(2)),
        penicillin: parseFloat(predictedPenicillin.toFixed(2)),
        productivity: parseFloat((predictedPenicillin / (time || 1) * 1000).toFixed(2)),
        yield: parseFloat((predictedPenicillin / (sugar_feed_rate * time / 100 || 1)).toFixed(3)),
        confidence: parseFloat(confidence.toFixed(1))
      })
      setSimRunning(false)
    }, 1500)
  }

  // Model selection view
  if (!selectedModel) {
    return (
      <div className="min-h-screen bg-[#fafafa]">
        <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-black transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to Insights
              </button>
              <div className="h-6 w-px bg-gray-200"></div>
              <span className="text-sm tracking-[0.2em] font-medium">LEMNISCA</span>
            </div>
            <div className="text-sm text-gray-500">Model Training</div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-12">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-semibold text-gray-900 mb-3">Select a Model</h1>
            <p className="text-gray-500 max-w-xl mx-auto">
              Models are automatically evaluated for compatibility with your dataset. 
              Incompatible models are locked based on data requirements.
            </p>
          </div>

          {/* Dataset summary */}
          {datasetInfo && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-8">
              <div className="flex items-center gap-6 text-sm">
                <div><span className="text-gray-500">Rows:</span> <span className="font-medium">{datasetInfo.rows?.toLocaleString()}</span></div>
                <div><span className="text-gray-500">Variables:</span> <span className="font-medium">{datasetInfo.variableCount}</span></div>
                <div><span className="text-gray-500">Batches:</span> <span className="font-medium">{datasetInfo.batchCount}</span></div>
                <div><span className="text-gray-500">Biomass:</span> <span className={`font-medium ${datasetInfo.hasBiomass ? 'text-green-600' : 'text-gray-400'}`}>{datasetInfo.hasBiomass ? '✓ Detected' : 'Not found'}</span></div>
                <div><span className="text-gray-500">Penicillin:</span> <span className={`font-medium ${datasetInfo.hasPenicillin ? 'text-green-600' : 'text-gray-400'}`}>{datasetInfo.hasPenicillin ? '✓ Detected' : 'Not found'}</span></div>
              </div>
            </div>
          )}

          {/* Target selection */}
          {/* <div className="flex items-center justify-center gap-4 mb-8">
            <span className="text-sm text-gray-500">Prediction Target:</span>
            <div className="flex bg-gray-100 rounded-lg p-1">
              {Object.entries(PENICILLIN_TARGETS).map(([key, target]) => (
                <button
                  key={key}
                  onClick={() => setSelectedTarget(key)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    selectedTarget === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {target.name}
                </button>
              ))}
            </div>
          </div> */}

          {/* Model grid - 2x2 layout */}
          <div className="grid md:grid-cols-2 gap-6">
            {MODELS.map(model => {
              return (
                <button
                  key={model.id}
                  onClick={() => handleSelectModel(model)}
                  className="bg-white rounded-2xl border border-gray-200 p-6 text-left transition-all hover:border-gray-400 hover:shadow-lg group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center group-hover:bg-gray-900 transition-colors">
                      <model.icon className="w-6 h-6 text-gray-600 group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{model.name}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{model.type}</span>
                      </div>
                      <p className="text-sm text-gray-500 mb-3">{model.description}</p>
                      
                      {/* Best for tag */}
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs mb-3">
                        <span className="font-medium">Best for:</span> {model.bestFor}
                      </div>
                      
                      {/* Note */}
                      <p className="text-xs text-gray-400">{model.note}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </main>
      </div>
    )
  }

  // Training / Results view
  const metrics = selectedModel.metrics[selectedTarget]
  
  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedModel(null)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-black transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Change Model
            </button>
            <div className="h-6 w-px bg-gray-200"></div>
            <span className="text-sm tracking-[0.2em] font-medium">LEMNISCA</span>
          </div>
          <div className="flex items-center gap-3">
            <selectedModel.icon className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-700 font-medium">{selectedModel.name}</span>
            <span className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-500">
              {PENICILLIN_TARGETS[selectedTarget].name}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {!trained ? (
          // Training view
          <div className="max-w-xl mx-auto text-center py-12">
            <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-6">
              <selectedModel.icon className="w-10 h-10 text-gray-600" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">{selectedModel.name}</h2>
            <p className="text-gray-500 mb-2">{selectedModel.description}</p>
            <p className="text-sm text-gray-400 mb-8">
              Target: {PENICILLIN_TARGETS[selectedTarget].name} ({PENICILLIN_TARGETS[selectedTarget].unit})
            </p>
            
            {training ? (
              <div className="space-y-6">
                <div className="w-56 h-56 mx-auto bg-white rounded-2xl shadow-sm flex items-center justify-center p-4">
                  <Lottie animationData={aiLoadingAnimation} loop={true} />
                </div>
                <div className="space-y-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gray-900 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-500 text-center">
                    {progress < 15 ? 'Loading training data...' : progress < 30 ? 'Feature engineering...' : progress < 50 ? 'Training model...' : progress < 70 ? 'Cross-validation...' : progress < 90 ? 'Evaluating performance...' : 'Finalizing...'}
                  </p>
                </div>
              </div>
            ) : (
              <button
                onClick={handleTrain}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors"
              >
                <Play className="w-5 h-5" />
                Start Training
              </button>
            )}
          </div>
        ) : (
          // Results view
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Main content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Success banner */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">Model Trained Successfully</p>
                  <p className="text-sm text-green-700">
                    {selectedModel.name} • Penicillin Concentration • {datasetInfo?.batchCount || 100} batches
                  </p>
                </div>
              </div>

              {/* Data Split Info */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h4 className="text-sm font-medium mb-3">Data Split</h4>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-3 rounded-full overflow-hidden flex">
                    <div className="bg-blue-500 h-full" style={{ width: '60%' }}></div>
                    <div className="bg-amber-500 h-full" style={{ width: '20%' }}></div>
                    <div className="bg-green-500 h-full" style={{ width: '20%' }}></div>
                  </div>
                </div>
                <div className="flex justify-between mt-2 text-xs">
                  <span className="text-blue-600">Train 60%</span>
                  <span className="text-amber-600">Validation 20%</span>
                  <span className="text-green-600">Test 20%</span>
                </div>
              </div>

              {/* Metrics cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Test R²" value={metrics.test.r2.toFixed(3)} highlight />
                <MetricCard label="Test RMSE" value={metrics.test.rmse.toFixed(2)} unit="g/L" />
                <MetricCard label="Test MAE" value={metrics.test.mae.toFixed(2)} unit="g/L" />
                <MetricCard label="Train R²" value={metrics.train.r2.toFixed(3)} />
              </div>

              {/* Train/Val/Test comparison */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h4 className="text-sm font-medium mb-3">Performance Across Splits</h4>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { key: 'train', label: 'Train' },
                    { key: 'val', label: 'Validation' },
                    { key: 'test', label: 'Test' }
                  ].map(split => (
                    <div key={split.key} className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                      <p className="text-xs text-gray-500 mb-1">{split.label}</p>
                      <p className="text-xl font-bold text-gray-900">{metrics[split.key].r2.toFixed(3)}</p>
                      <p className="text-xs text-gray-500">R² Score</p>
                      <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
                        <p className="text-xs"><span className="text-gray-500">RMSE:</span> <span className="font-medium">{metrics[split.key].rmse.toFixed(2)}</span></p>
                        <p className="text-xs"><span className="text-gray-500">MAE:</span> <span className="font-medium">{metrics[split.key].mae.toFixed(2)}</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabs */}
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="border-b border-gray-200 px-6 py-3">
                  <div className="flex gap-6">
                    {['performance', 'timeseries', 'residuals'].map(tab => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`text-sm font-medium pb-3 -mb-3 border-b-2 transition-colors capitalize ${
                          activeTab === tab ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-black'
                        }`}
                      >
                        {tab === 'timeseries' ? 'Time Series' : tab}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-6">
                  {activeTab === 'performance' && generatePredictionData && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">Actual vs Predicted</h4>
                      <p className="text-xs text-gray-500 mb-4">Test set predictions for Penicillin Concentration (sorted by actual value)</p>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={generatePredictionData.comparisonData} margin={{ top: 10, right: 20, bottom: 40, left: 60 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis 
                            dataKey="index" 
                            tick={{ fontSize: 11 }}
                            label={{ value: 'Sample (sorted by actual)', position: 'bottom', offset: 20, style: { fontSize: 12 } }}
                          />
                          <YAxis 
                            tick={{ fontSize: 11 }}
                            label={{ value: 'Concentration (g/L)', angle: -90, position: 'left', offset: 40, style: { fontSize: 12 } }}
                            domain={[0, 'auto']}
                          />
                          <Tooltip 
                            formatter={(value, name) => [`${value?.toFixed(2)} g/L`, name]}
                            labelFormatter={(value) => `Sample ${value}`}
                          />
                          <Legend />
                          <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2} dot={false} name="Actual" />
                          <Line type="monotone" dataKey="predicted" stroke="#6366f1" strokeWidth={2} dot={false} name="Predicted" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {activeTab === 'timeseries' && generatePredictionData && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">Trajectory Prediction</h4>
                      <p className="text-xs text-gray-500 mb-4">Model fit on representative batch</p>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={generatePredictionData.timeSeriesData} margin={{ top: 10, right: 20, bottom: 40, left: 60 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="time" tick={{ fontSize: 11 }} label={{ value: 'Time (h)', position: 'bottom', offset: 20, style: { fontSize: 12 } }} />
                          <YAxis tick={{ fontSize: 11 }} label={{ value: 'Penicillin (g/L)', angle: -90, position: 'left', offset: 40, style: { fontSize: 12 } }} domain={[0, 'auto']} />
                          <Tooltip formatter={(value) => [value?.toFixed(2) + ' g/L', '']} />
                          <Legend />
                          <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2} dot={false} name="Actual" />
                          <Line type="monotone" dataKey="predicted" stroke="#6366f1" strokeWidth={2} dot={false} name="Predicted" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  
                  {activeTab === 'residuals' && generatePredictionData && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">Residual Distribution</h4>
                      <p className="text-xs text-gray-500 mb-4">Prediction errors (should be centered around 0)</p>
                      <ResponsiveContainer width="100%" height={300}>
                        <ScatterChart margin={{ top: 10, right: 20, bottom: 40, left: 60 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="predicted" tick={{ fontSize: 11 }} label={{ value: 'Predicted Value (g/L)', position: 'bottom', offset: 20, style: { fontSize: 12 } }} />
                          <YAxis dataKey="residual" tick={{ fontSize: 11 }} label={{ value: 'Residual (g/L)', angle: -90, position: 'left', offset: 40, style: { fontSize: 12 } }} />
                          <Tooltip formatter={(value, name) => [value?.toFixed(3), name === 'residual' ? 'Error' : 'Predicted']} />
                          <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                          <Scatter data={generatePredictionData.residualData} fill="#6366f1" fillOpacity={0.6} />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Simulation sidebar */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-gray-400" />
                  <h3 className="font-medium">Process Simulation</h3>
                </div>
                <p className="text-xs text-gray-500 mb-4">Adjust parameters to predict fermentation outcomes</p>
                
                <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                  {SIMULATION_INPUTS.map(inp => (
                    <div key={inp.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{inp.name}</span>
                        <span className="font-mono text-gray-900">{simInputs[inp.id]} {inp.unit}</span>
                      </div>
                      <input
                        type="range"
                        min={inp.min}
                        max={inp.max}
                        step={inp.step}
                        value={simInputs[inp.id]}
                        onChange={(e) => setSimInputs(prev => ({ ...prev, [inp.id]: parseFloat(e.target.value) }))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleSimulate}
                  disabled={simRunning}
                  className="w-full mt-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {simRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Simulating...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Run Simulation
                    </>
                  )}
                </button>
              </div>

              {/* Simulation results */}
              {simResults && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h4 className="font-medium mb-4">Predicted Outcomes</h4>
                  <div className="space-y-3">
                    <ResultRow label="Biomass" value={simResults.biomass} unit="g/L" />
                    <ResultRow label="Penicillin" value={simResults.penicillin} unit="g/L" />
                    <ResultRow label="Productivity" value={simResults.productivity} unit="mg/L/h" />
                    <ResultRow label="Yield (P/S)" value={simResults.yield} unit="g/g" />
                    <div className="flex justify-between py-2 pt-3 border-t border-gray-100">
                      <span className="text-sm text-gray-600">Confidence</span>
                      <span className={`font-semibold ${simResults.confidence > 85 ? 'text-green-600' : simResults.confidence > 70 ? 'text-amber-600' : 'text-red-600'}`}>
                        {simResults.confidence}%
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowOptimizeModal(true)}
                    className="w-full mt-4 group relative rounded-full p-[2px] overflow-hidden"
                  >
                    <div className="absolute inset-0 rounded-full animate-rotate-border opacity-80" style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #d946ef, #f43f5e, #6366f1)', backgroundSize: '200% 100%' }} />
                    <div className="relative flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-white group-hover:bg-gray-50 transition-colors">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <span className="font-medium text-gray-900">Optimize Process</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Work in Progress Modal */}
      {showOptimizeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowOptimizeModal(false)}>
          <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-indigo-100 to-purple-100 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-indigo-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Optimization Engine</h3>
            <p className="text-gray-500 mb-6">
              The Design Engine uses model predictions and uncertainty estimates to recommend optimal experimental conditions for maximizing penicillin yield.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-full text-sm font-medium">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
              Work in Progress
            </div>
            <button
              onClick={() => setShowOptimizeModal(false)}
              className="block w-full mt-6 py-3 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper components
function MetricCard({ label, value, unit, highlight }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${highlight ? 'text-green-700' : ''}`}>
        {value}
        {unit && <span className="text-sm text-gray-400 ml-1">{unit}</span>}
      </p>
    </div>
  )
}

function ResultRow({ label, value, unit }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="font-semibold">{value} <span className="text-gray-400 font-normal">{unit}</span></span>
    </div>
  )
}
