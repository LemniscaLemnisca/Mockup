# Insight Layer Backend - Technical Documentation

## Overview

A deterministic fermentation analytics engine built with FastAPI. Processes raw CSV time-series data and returns structured, plottable insights without any LLM reasoning, semantic guessing, or biology-specific assumptions.

**Version:** 2.0.0  
**Framework:** FastAPI  
**Core Dependencies:** pandas, numpy, scipy

---

## API Endpoints

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "version": "2.0.0"
}
```

---

### `POST /analyze`

Main analysis endpoint. Accepts a CSV file and returns comprehensive analytics.

**Request:**
- Content-Type: `multipart/form-data`
- Body: `file` (CSV file)

**Response:** JSON object with 7 top-level keys (see [Response Schema](#response-schema))

**Error Codes:**
| Code | Condition |
|------|-----------|
| 400 | Non-CSV file, decode failure, empty dataset, < 2 columns |
| 500 | Analysis failure (logged to console) |

---

## Data Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CSV UPLOAD                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. FILE DECODING                                                            │
│     • Try encodings: utf-8 → latin-1 → cp1252                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. DATA START DETECTION (detect_data_start_row)                            │
│     • Scan first 30 rows                                                    │
│     • Calculate numeric density per row (% of cells that are numbers)       │
│     • Find first row with ≥50% numeric values → data_start_row              │
│     • Row before data_start with <30% numeric → header_row                  │
│     • Skip metadata/noise rows automatically                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. CSV PARSING                                                              │
│     • Use detected header_row as column names                               │
│     • Skip rows before data_start_row                                       │
│     • Convert string columns to numeric if >50% values are parseable        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. COLUMN INFERENCE (DatasetAnalyzer._infer_columns)                       │
│     • Detect BATCH column first (by keywords or repetition pattern)         │
│     • Detect TIME column (keywords + monotonic check)                       │
│     • Classify remaining as NUMERIC or CATEGORICAL                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. DATA STANDARDIZATION                                                     │
│     Canonical form: { batch, time, variable, value }                        │
│     Every row × every numeric variable = one record                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  4. PARALLEL ANALYSIS MODULES                                                │
│     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│     │   Quality    │ │   Temporal   │ │ Relationship │ │    Batch     │     │
│     │   Analyzer   │ │   Analyzer   │ │   Analyzer   │ │  Comparison  │     │
│     └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘     │
│                              │                                               │
│                              ▼                                               │
│                    ┌──────────────────┐                                      │
│                    │  Global Metrics  │                                      │
│                    │    Analyzer      │                                      │
│                    └──────────────────┘                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  5. PLOT DATA PREPARATION                                                    │
│     • Time series (all data points, no sampling)                            │
│     • Batch-separated series (all batches, all points)                      │
│     • Distributions (20-bin histograms)                                     │
│     • Correlation matrix                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  6. JSON SERIALIZATION (clean_for_json)                                     │
│     • Convert numpy types → Python native                                   │
│     • Replace NaN/Inf → null                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Auto Data Start Detection

Many CSV files have metadata, titles, or noise rows before the actual data. The backend automatically detects where real data begins.

**Algorithm (`detect_data_start_row`):**

1. Scan first 30 rows of the file
2. For each row, calculate **numeric density** = (cells that parse as numbers) / (total cells)
3. Find the first row where numeric density ≥ 50% → this is `data_start_row`
4. Look backwards for a row with numeric density < 30% → this is `header_row`

**Example:**
```
Row 0: "Report Generated: 2024-01-15"     → density: 0%   (metadata)
Row 1: "Experiment: Fermentation Run 42"  → density: 0%   (metadata)  
Row 2: "Time,pH,Temperature,DO,Biomass"   → density: 0%   (HEADER ✓)
Row 3: "0.0,7.0,37.0,95.0,0.1"            → density: 100% (DATA START ✓)
```

**Result:** `header_row=2`, `data_start_row=3`

**Edge Cases:**
| Scenario | Behavior |
|----------|----------|
| No header found | Uses generic names: `Column_1`, `Column_2`, ... |
| First row is data | No header, generic names |
| Standard CSV (header + data) | Works normally |
| Multiple metadata rows | All skipped automatically |

---

### Time Column Detection

1. **Keyword match** (case-insensitive): `time`, `timestamp`, `date`, `hour`, `minute`, `t`, `elapsed`, `duration`
2. **Validation**: Must be numeric or convertible to numeric
3. **Monotonicity check**: ≥95% of consecutive differences must be ≥ 0

### Batch Column Detection

1. **Keyword match**: `batch`, `run`, `experiment`, `lot`, `id`, `sample`, `replicate`
2. **Fallback pattern detection** (`_is_batch_like`):
   - Unique values < 10% of total rows
   - More than 1 unique value
   - Each value appears > 5 times

**Important:** Batch column is detected BEFORE numeric conversion to preserve categorical identifiers.

### Numeric vs Categorical

- Columns with numeric dtype → `numeric_cols`
- String columns where >50% values parse as numbers → converted, added to `numeric_cols`
- Everything else → `categorical_cols`

---

## Analysis Modules

### 1. DataQualityAnalyzer

Computes per-variable quality metrics.

| Metric | Method | Output |
|--------|--------|--------|
| **Missing %** | `isna().sum() / len * 100` | `float` |
| **Signal Density** | Classification based on missing % | `{type, density, reason?}` |
| **Flatline Detection** | Coefficient of variation (CV) check | `{is_flatlined, cv, relative_range}` |
| **Sampling Stats** | Time interval analysis within batches | `{mean_interval, std_interval, regularity_score}` |

**Signal Density Classification:**
```
missing > 70%  → "sparse"
missing > 30%  → "intermittent"
zeros > 50%    → "offline"
else           → "continuous"
```

**Flatline Detection:**
```python
CV = std / |mean|
relative_range = (max - min) / |mean|
is_flatlined = CV < 0.001 AND relative_range < 0.01
```

---

### 2. TemporalAnalyzer

Computes time-series kinetics per variable per batch.

| Metric | Method | Description |
|--------|--------|-------------|
| **Derivative** | `diff(values) / diff(time)` | Rate of change |
| **Smoothed Signal** | `scipy.ndimage.uniform_filter1d` | Moving average (window=5) |
| **Change Points** | Derivative > 2σ from mean | Significant rate changes |
| **Phase Segmentation** | Derivative sign clustering | Increasing/decreasing/stationary phases |
| **Growth Metrics** | Monotonicity + slope analysis | For growth-like signals (>70% positive diffs) |
| **Trend** | `scipy.stats.linregress` | Direction + R² + p-value |

**Phase Segmentation Logic:**
```python
derivative > 0.5σ  → "increasing"
derivative < -0.5σ → "decreasing"
else               → "stationary"
```

Phases must have minimum length of 5 data points.

---

### 3. RelationshipAnalyzer

Analyzes pairwise variable relationships.

| Metric | Method | Output |
|--------|--------|--------|
| **Pearson Correlation** | `scipy.stats.pearsonr` | `{r, p_value}` |
| **Spearman Correlation** | `scipy.stats.spearmanr` | `{r, p_value}` |
| **Lagged Correlation** | Shift x by ±10 steps, compute Pearson | `{best_lag, best_correlation, lag_profile}` |
| **Cross-Batch Stability** | Std of correlations across batches | `{consistency_score, is_stable}` |

**Limits:**
- Analyzes first 15 numeric columns (to avoid O(n²) explosion)
- Returns top 30 relationships sorted by |Pearson r|
- Requires minimum 5 valid data points per pair

---

### 4. BatchComparisonAnalyzer

Compares performance across batches.

**Per-Batch Metrics:**
| Metric | Calculation |
|--------|-------------|
| `max_value` | `np.max(values)` |
| `min_value` | `np.min(values)` |
| `mean_value` | `np.mean(values)` |
| `final_value` | Last value in time-sorted series |
| `integrated_value` | `np.trapz(values, time)` (area under curve) |
| `max_rate` | `np.max(derivative)` |
| `mean_rate` | `np.mean(derivative)` |
| `rate_stability` | `1 - min(1, std(deriv) / |mean(deriv)|)` |

**Rankings:** Each metric ranked across batches with normalized score (0-1).

**Outlier Detection:** IQR method
```python
Q1, Q3 = percentile([25, 75])
IQR = Q3 - Q1
outlier if value < Q1 - 1.5*IQR or value > Q3 + 1.5*IQR
```

**Variance Analysis:**
```python
{
  "mean": mean of integrated_value across batches,
  "std": std of integrated_value,
  "cv": coefficient of variation (%)
}
```

---

### 5. GlobalMetricsAnalyzer

Dataset-level insights across all batches.

**Best Batch Per Metric:**
For each variable, identifies which batch has the highest:
- `max_value`
- `integrated_value`
- `mean_rate`
- `rate_stability`

**Batch Trend Analysis:**
Determines if process is improving/degrading over sequential batches:
```python
slope, r_value = linregress(batch_index, metric_value)
if |r_value| < 0.3 → "stable"
elif slope > 0     → "improving"
else               → "degrading"
```

**Overall Assessment:**
Counts how many variables are improving vs degrading to determine overall process trend.

---

## Response Schema

```json
{
  "overview": {
    "rows": 150000,
    "columns": 12,
    "time_column": "Time [h]",
    "batch_column": "Batch_ID",
    "batches": ["1", "2", "3", ...],
    "batch_count": 100,
    "is_multi_batch": true,
    "numeric_variables": ["pH", "Temperature", "DO", ...],
    "categorical_variables": [],
    "duration": {
      "min": 0.0,
      "max": 72.0,
      "span": 72.0
    }
  },

  "quality": {
    "variables": [
      {
        "variable": "pH",
        "missing_pct": 0.5,
        "density": {"type": "continuous", "density": 0.995},
        "flatline": {"is_flatlined": false, "cv": 0.02, "relative_range": 0.15},
        "sampling": {
          "available": true,
          "mean_interval": 0.1,
          "std_interval": 0.01,
          "regularity_score": 0.9,
          "is_regular": true
        },
        "stats": {"mean": 7.2, "std": 0.3, "min": 6.5, "max": 7.8}
      }
    ],
    "overall": {
      "score": 92.0,
      "flags": ["offline_signals:2"]
    }
  },

  "temporal": {
    "available": true,
    "variables": {
      "pH": {
        "batches": {
          "1": {
            "derivative": {"mean": 0.01, "max": 0.05, "min": -0.02, "std": 0.01},
            "change_points": [{"index": 45, "magnitude": 0.08, "direction": "increase"}],
            "phases": [
              {
                "phase_type": "increasing",
                "start_index": 0,
                "end_index": 50,
                "start_time": 0.0,
                "end_time": 5.0,
                "duration": 5.0,
                "mean_rate": 0.02
              }
            ],
            "growth_metrics": {
              "is_growth_like": false,
              "monotonicity_ratio": 0.45
            },
            "trend": {
              "available": true,
              "direction": "stable",
              "slope": 0.001,
              "r_squared": 0.12,
              "p_value": 0.08
            }
          }
        }
      }
    }
  },

  "relationships": [
    {
      "var_x": "DO",
      "var_y": "OUR",
      "correlation": {
        "available": true,
        "pearson": {"r": -0.85, "p_value": 0.0001},
        "spearman": {"r": -0.82, "p_value": 0.0002},
        "n_samples": 14500
      },
      "lagged_correlation": {
        "available": true,
        "best_lag": -2,
        "best_correlation": -0.88,
        "lag_profile": [{"lag": -5, "correlation": -0.75}, ...]
      },
      "cross_batch_stability": {
        "available": true,
        "mean_correlation": -0.84,
        "std_correlation": 0.05,
        "consistency_score": 0.94,
        "is_stable": true
      }
    }
  ],

  "batch_comparison": {
    "available": true,
    "batch_count": 100,
    "batch_order": ["1", "2", "3", ...],
    "variables": {
      "Biomass": {
        "batch_metrics": {
          "1": {
            "max_value": 45.2,
            "min_value": 0.1,
            "mean_value": 22.5,
            "final_value": 44.8,
            "integrated_value": 1620.5,
            "max_rate": 1.2,
            "mean_rate": 0.62,
            "rate_stability": 0.78
          }
        },
        "rankings": {
          "max_value": [
            {"batch_id": "17", "value": 52.1, "rank": 1, "normalized_score": 1.0},
            {"batch_id": "45", "value": 51.8, "rank": 2, "normalized_score": 0.99}
          ],
          "integrated_value": [...],
          "mean_rate": [...],
          "rate_stability": [...]
        },
        "outlier_batches": ["3", "67"],
        "variance_analysis": {
          "mean": 1580.2,
          "std": 120.5,
          "cv": 7.6
        }
      }
    }
  },

  "global_scores": {
    "available": true,
    "best_batches": [
      {
        "variable": "Biomass",
        "metric": "integrated_value",
        "best_batch": "17",
        "value": 1850.2,
        "score": 1.0
      }
    ],
    "batch_trends": {
      "Biomass": {
        "available": true,
        "trend": "improving",
        "slope": 2.5,
        "r_squared": 0.65,
        "p_value": 0.001,
        "mean_value": 1580.2,
        "std_value": 120.5
      }
    },
    "overall_assessment": {
      "trend": "improving",
      "improving_variables": 6,
      "degrading_variables": 1,
      "stable_variables": 3
    }
  },

  "plot_ready": {
    "time_series": {
      "pH": [
        {"time": 0.0, "value": 7.0},
        {"time": 0.1, "value": 7.02},
        ...
      ]
    },
    "batch_series": {
      "1": {
        "pH": [{"time": 0.0, "value": 7.0}, ...],
        "Temperature": [{"time": 0.0, "value": 37.0}, ...]
      },
      "2": {...}
    },
    "distributions": {
      "pH": {
        "bins": [6.5, 6.55, 6.6, ...],
        "counts": [12, 45, 89, ...],
        "stats": {"mean": 7.2, "median": 7.18, "std": 0.3, "min": 6.5, "max": 7.8}
      }
    },
    "correlations": [
      {"var_x": "DO", "var_y": "OUR", "r": -0.85}
    ]
  }
}
```

---

## Frontend Data Mapping

| Frontend Component | Backend Data Source |
|--------------------|---------------------|
| Overview Cards | `overview.*`, `quality.overall.score` |
| Variables List | `quality.variables[]` |
| Batch Selector | `overview.batches` |
| Time Series Chart | `plot_ready.batch_series` |
| Temporal Analysis | `temporal.variables[var].batches[batch]` |
| Batch Comparison | `batch_comparison.variables[var].rankings` |
| Relationships Panel | `relationships[]` |
| Quality Panel | `quality.variables[]`, `quality.overall` |
| Issues Panel | `quality.overall.flags` |

---

## Quality Score Calculation

Starting from 100, deductions:

| Condition | Deduction |
|-----------|-----------|
| Average missing > 20% | -20 |
| Average missing > 5% | -5 |
| Regularity score < 0.3 | -10 |
| Each flatlined signal (max 5) | -3 |

**Flags generated:**
- `high_missing_data` / `moderate_missing_data`
- `irregular_sampling`
- `flatlined_signals:N`
- `offline_signals:N` (informational, no penalty)

---

## Performance Considerations

- **Large datasets (100k+ rows):** Supported, no sampling applied
- **Many batches (100+):** All batches processed and returned
- **Many variables:** Relationships limited to first 15 columns
- **Memory:** Entire dataset loaded into pandas DataFrame

---

## JSON Serialization

The `clean_for_json()` function handles:

| NumPy Type | Converted To |
|------------|--------------|
| `np.bool_` | `bool` |
| `np.int64`, `np.int32` | `int` |
| `np.float64`, `np.float32` | `float` |
| `np.ndarray` | `list` |
| `NaN`, `Inf` | `null` |

---

## CORS Configuration

```python
allow_origins=["*"]
allow_credentials=False
allow_methods=["*"]
allow_headers=["*"]
```

**Note:** `allow_credentials=False` is required when using `allow_origins=["*"]`.

---

## Running the Server

```bash
cd backend
python -m uvicorn app.main:app --reload
```

Server runs at `http://127.0.0.1:8000`

**Important:** Use `127.0.0.1` instead of `localhost` for API calls (localhost may not resolve correctly on some systems).
