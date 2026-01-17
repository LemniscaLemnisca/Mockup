"""
Deterministic Fermentation Analytics Engine
No LLM reasoning. No semantic guessing. No biology assumptions.
"""

import pandas as pd
import numpy as np
from scipy import stats
from scipy.ndimage import uniform_filter1d
from typing import Dict, List, Any, Optional, Tuple
import warnings

warnings.filterwarnings('ignore')


class DataQualityAnalyzer:
    """Analyzes data quality metrics for each variable"""
    
    @staticmethod
    def compute_missing_percentage(series: pd.Series) -> float:
        return float(series.isna().sum() / len(series) * 100)
    
    @staticmethod
    def classify_signal_density(series: pd.Series, missing_pct: float) -> Dict[str, Any]:
        """Classify signal based on data density and missing values"""
        valid_count = (~series.isna()).sum()
        total_count = len(series)
        
        if total_count == 0:
            return {"type": "empty", "density": 0.0}
        
        density = valid_count / total_count
        
        # Classification based on actual data presence
        if missing_pct > 70:
            return {"type": "sparse", "density": float(density), "reason": "high_missing"}
        elif missing_pct > 30:
            return {"type": "intermittent", "density": float(density), "reason": "moderate_missing"}
        else:
            # Check if values are mostly zeros or constant (offline sensor pattern)
            non_null = series.dropna()
            if len(non_null) > 0:
                zero_pct = (non_null == 0).sum() / len(non_null) * 100
                if zero_pct > 50:
                    return {"type": "offline", "density": float(density), "zero_pct": float(zero_pct)}
            
            return {"type": "continuous", "density": float(density)}
    
    @staticmethod
    def detect_flatline(series: pd.Series, threshold_pct: float = 0.001) -> Dict[str, Any]:
        """Detect if signal is truly flatlined (constant or near-constant)"""
        data = series.dropna()
        if len(data) < 2:
            return {"is_flatlined": False, "flatline_pct": 0.0}
        
        data_range = data.max() - data.min()
        data_std = data.std()
        data_mean = abs(data.mean())
        
        # Truly flatlined: zero range
        if data_range == 0:
            return {"is_flatlined": True, "flatline_pct": 100.0, "constant_value": float(data.iloc[0])}
        
        # Check coefficient of variation - if CV is extremely low, might be flatlined
        cv = data_std / data_mean if data_mean > 0 else 0
        
        # Only consider flatlined if:
        # 1. CV is extremely low (< 0.1%) AND
        # 2. The actual range is tiny relative to the mean
        relative_range = data_range / data_mean if data_mean > 0 else data_range
        
        is_flatlined = cv < 0.001 and relative_range < 0.01
        
        return {
            "is_flatlined": is_flatlined,
            "cv": float(cv),
            "relative_range": float(relative_range)
        }
    
    @staticmethod
    def compute_sampling_stats(time_series: pd.Series, batch_col: pd.Series = None) -> Dict[str, Any]:
        """Compute sampling interval statistics, accounting for batch structure"""
        time_data = pd.to_numeric(time_series, errors='coerce')
        
        if time_data.isna().all() or len(time_data) < 2:
            return {"available": False}
        
        # If we have batches, compute intervals within each batch
        if batch_col is not None:
            all_intervals = []
            for batch in batch_col.unique():
                batch_mask = batch_col == batch
                batch_time = time_data[batch_mask].dropna().sort_values()
                if len(batch_time) > 1:
                    intervals = batch_time.diff().dropna()
                    intervals = intervals[intervals > 0]
                    all_intervals.extend(intervals.tolist())
            
            if not all_intervals:
                return {"available": False}
            
            intervals = pd.Series(all_intervals)
        else:
            time_sorted = time_data.dropna().sort_values()
            intervals = time_sorted.diff().dropna()
            intervals = intervals[intervals > 0]
        
        if len(intervals) == 0:
            return {"available": False}
        
        mean_interval = float(intervals.mean())
        std_interval = float(intervals.std()) if len(intervals) > 1 else 0
        cv = std_interval / mean_interval if mean_interval > 0 else 0
        regularity = max(0, 1 - min(1, cv))
        
        return {
            "available": True,
            "mean_interval": mean_interval,
            "std_interval": std_interval,
            "min_interval": float(intervals.min()),
            "max_interval": float(intervals.max()),
            "regularity_score": float(regularity),
            "is_regular": regularity > 0.5
        }


class TemporalAnalyzer:
    """Computes temporal and kinetic metrics for time-series data"""
    
    @staticmethod
    def compute_derivative(time: np.ndarray, values: np.ndarray) -> np.ndarray:
        if len(time) < 2:
            return np.array([])
        dt = np.diff(time)
        dv = np.diff(values)
        dt = np.where(dt == 0, np.nan, dt)
        return dv / dt
    
    @staticmethod
    def smooth_signal(values: np.ndarray, window: int = 5) -> np.ndarray:
        if len(values) < window:
            return values
        return uniform_filter1d(values.astype(float), size=window, mode='nearest')
    
    @staticmethod
    def detect_change_points(values: np.ndarray, threshold_sigma: float = 2.0) -> List[Dict]:
        if len(values) < 10:
            return []
        
        window = max(5, len(values) // 20)
        smoothed = uniform_filter1d(values.astype(float), size=window, mode='nearest')
        derivative = np.diff(smoothed)
        
        if len(derivative) == 0:
            return []
        
        mean_deriv = np.nanmean(derivative)
        std_deriv = np.nanstd(derivative)
        if std_deriv == 0:
            return []
        
        threshold = threshold_sigma * std_deriv
        change_points = []
        
        for i, d in enumerate(derivative):
            if abs(d - mean_deriv) > threshold:
                change_points.append({
                    "index": int(i),
                    "magnitude": float(d),
                    "direction": "increase" if d > mean_deriv else "decrease"
                })
        return change_points
    
    @staticmethod
    def segment_phases(time: np.ndarray, values: np.ndarray, min_phase_length: int = 5) -> List[Dict]:
        if len(values) < min_phase_length * 2:
            return []
        
        window = max(3, len(values) // 20)
        smoothed = uniform_filter1d(values.astype(float), size=window, mode='nearest')
        derivative = np.gradient(smoothed)
        threshold = np.std(derivative) * 0.5
        
        phases = []
        current_phase = None
        phase_start = 0
        
        for i, d in enumerate(derivative):
            if d > threshold:
                phase_type = "increasing"
            elif d < -threshold:
                phase_type = "decreasing"
            else:
                phase_type = "stationary"
            
            if phase_type != current_phase:
                if current_phase is not None and i - phase_start >= min_phase_length:
                    phases.append({
                        "phase_type": current_phase,
                        "start_index": int(phase_start),
                        "end_index": int(i - 1),
                        "start_time": float(time[phase_start]) if phase_start < len(time) else None,
                        "end_time": float(time[i - 1]) if i - 1 < len(time) else None,
                        "duration": float(time[i - 1] - time[phase_start]) if i - 1 < len(time) else None,
                        "mean_rate": float(np.nanmean(derivative[phase_start:i]))
                    })
                current_phase = phase_type
                phase_start = i
        
        if current_phase is not None and len(derivative) - phase_start >= min_phase_length:
            phases.append({
                "phase_type": current_phase,
                "start_index": int(phase_start),
                "end_index": int(len(derivative) - 1),
                "start_time": float(time[phase_start]) if phase_start < len(time) else None,
                "end_time": float(time[-1]),
                "duration": float(time[-1] - time[phase_start]) if phase_start < len(time) else None,
                "mean_rate": float(np.nanmean(derivative[phase_start:]))
            })
        return phases
    
    @staticmethod
    def compute_growth_metrics(time: np.ndarray, values: np.ndarray) -> Dict[str, Any]:
        if len(values) < 5:
            return {"is_growth_like": False}
        
        diffs = np.diff(values)
        positive_ratio = np.sum(diffs > 0) / len(diffs)
        is_growth_like = positive_ratio > 0.7
        
        if not is_growth_like:
            return {"is_growth_like": False, "monotonicity_ratio": float(positive_ratio)}
        
        derivative = TemporalAnalyzer.compute_derivative(time, values)
        valid_deriv = derivative[~np.isnan(derivative)]
        
        if len(valid_deriv) == 0:
            return {"is_growth_like": True, "monotonicity_ratio": float(positive_ratio)}
        
        max_slope = float(np.nanmax(valid_deriv))
        mean_slope = float(np.nanmean(valid_deriv))
        slope_std = float(np.nanstd(valid_deriv))
        stability = 1 - min(1, slope_std / abs(mean_slope)) if mean_slope != 0 else 0
        
        return {
            "is_growth_like": True,
            "monotonicity_ratio": float(positive_ratio),
            "max_slope": max_slope,
            "mean_slope": mean_slope,
            "slope_std": slope_std,
            "stability_score": float(stability)
        }


class RelationshipAnalyzer:
    """Analyzes relationships between variables"""
    
    @staticmethod
    def compute_correlations(x: np.ndarray, y: np.ndarray) -> Dict[str, Any]:
        mask = ~(np.isnan(x) | np.isnan(y))
        x_clean, y_clean = x[mask], y[mask]
        
        if len(x_clean) < 5:
            return {"available": False}
        
        pearson_r, pearson_p = stats.pearsonr(x_clean, y_clean)
        spearman_r, spearman_p = stats.spearmanr(x_clean, y_clean)
        
        return {
            "available": True,
            "pearson": {"r": float(pearson_r), "p_value": float(pearson_p)},
            "spearman": {"r": float(spearman_r), "p_value": float(spearman_p)},
            "n_samples": int(len(x_clean))
        }
    
    @staticmethod
    def compute_lagged_correlation(x: np.ndarray, y: np.ndarray, max_lag: int = 10) -> Dict[str, Any]:
        mask = ~(np.isnan(x) | np.isnan(y))
        x_clean, y_clean = x[mask], y[mask]
        
        if len(x_clean) < max_lag + 5:
            return {"available": False}
        
        best_lag = 0
        best_corr = 0
        lag_results = []
        
        for lag in range(-max_lag, max_lag + 1):
            if lag < 0:
                x_shifted = x_clean[:lag]
                y_shifted = y_clean[-lag:]
            elif lag > 0:
                x_shifted = x_clean[lag:]
                y_shifted = y_clean[:-lag]
            else:
                x_shifted, y_shifted = x_clean, y_clean
            
            if len(x_shifted) < 5:
                continue
            
            r, _ = stats.pearsonr(x_shifted, y_shifted)
            lag_results.append({"lag": lag, "correlation": float(r)})
            
            if abs(r) > abs(best_corr):
                best_corr = r
                best_lag = lag
        
        return {
            "available": True,
            "best_lag": int(best_lag),
            "best_correlation": float(best_corr),
            "lag_profile": lag_results
        }
    
    @staticmethod
    def compute_relationship_stability(correlations_by_batch: List[float]) -> Dict[str, Any]:
        if len(correlations_by_batch) < 2:
            return {"available": False}
        
        corrs = np.array(correlations_by_batch)
        mean_corr = float(np.nanmean(corrs))
        std_corr = float(np.nanstd(corrs))
        consistency = 1 - min(1, std_corr / (abs(mean_corr) + 0.01))
        
        return {
            "available": True,
            "mean_correlation": mean_corr,
            "std_correlation": std_corr,
            "consistency_score": float(consistency),
            "is_stable": consistency > 0.7
        }


class BatchComparisonAnalyzer:
    """Analyzes batch-to-batch variations and identifies best/worst performers"""
    
    @staticmethod
    def compute_batch_metrics(time: np.ndarray, values: np.ndarray) -> Dict[str, Any]:
        if len(values) < 2:
            return {}
        
        valid_mask = ~np.isnan(values)
        valid_values = values[valid_mask]
        valid_time = time[valid_mask] if len(time) == len(values) else time[:len(valid_values)]
        
        if len(valid_values) < 2:
            return {}
        
        # Integrated value (area under curve using trapezoidal rule)
        if len(valid_time) == len(valid_values):
            integrated = float(np.trapezoid(valid_values, valid_time))
        else:
            integrated = float(np.sum(valid_values))
        
        # Rate metrics
        derivative = TemporalAnalyzer.compute_derivative(valid_time, valid_values)
        valid_deriv = derivative[~np.isnan(derivative)] if len(derivative) > 0 else np.array([0])
        
        return {
            "max_value": float(np.nanmax(valid_values)),
            "min_value": float(np.nanmin(valid_values)),
            "mean_value": float(np.nanmean(valid_values)),
            "final_value": float(valid_values[-1]),
            "integrated_value": integrated,
            "max_rate": float(np.nanmax(valid_deriv)) if len(valid_deriv) > 0 else 0,
            "mean_rate": float(np.nanmean(valid_deriv)) if len(valid_deriv) > 0 else 0,
            "rate_stability": float(1 - min(1, np.nanstd(valid_deriv) / (abs(np.nanmean(valid_deriv)) + 0.001))) if len(valid_deriv) > 0 else 0
        }
    
    @staticmethod
    def rank_batches(batch_metrics: Dict[str, Dict], metric_key: str, higher_is_better: bool = True) -> List[Dict]:
        rankings = []
        for batch_id, metrics in batch_metrics.items():
            if metric_key in metrics:
                rankings.append({
                    "batch_id": batch_id,
                    "value": metrics[metric_key]
                })
        
        rankings.sort(key=lambda x: x["value"], reverse=higher_is_better)
        
        for i, r in enumerate(rankings):
            r["rank"] = i + 1
            r["normalized_score"] = 1 - (i / len(rankings)) if len(rankings) > 1 else 1.0
        
        return rankings
    
    @staticmethod
    def detect_outlier_batches(batch_metrics: Dict[str, Dict], metric_key: str) -> List[str]:
        values = []
        batch_ids = []
        
        for batch_id, metrics in batch_metrics.items():
            if metric_key in metrics:
                values.append(metrics[metric_key])
                batch_ids.append(batch_id)
        
        if len(values) < 4:
            return []
        
        values = np.array(values)
        q1, q3 = np.percentile(values, [25, 75])
        iqr = q3 - q1
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        
        outliers = []
        for i, v in enumerate(values):
            if v < lower_bound or v > upper_bound:
                outliers.append(batch_ids[i])
        
        return outliers


class GlobalMetricsAnalyzer:
    """Computes dataset-level global metrics and trends"""
    
    @staticmethod
    def compute_best_batch_per_metric(batch_metrics: Dict[str, Dict], variable: str) -> List[Dict]:
        metric_keys = ["max_value", "integrated_value", "mean_rate", "rate_stability"]
        results = []
        
        for metric in metric_keys:
            best_batch = None
            best_value = None
            
            for batch_id, metrics in batch_metrics.items():
                if metric in metrics:
                    val = metrics[metric]
                    if best_value is None or val > best_value:
                        best_value = val
                        best_batch = batch_id
            
            if best_batch is not None:
                results.append({
                    "variable": variable,
                    "metric": metric,
                    "best_batch": best_batch,
                    "value": float(best_value),
                    "score": 1.0
                })
        
        return results
    
    @staticmethod
    def compute_batch_trend(batch_metrics: Dict[str, Dict], metric_key: str, batch_order: List[str]) -> Dict[str, Any]:
        """Determine if process is improving or degrading across sequential batches"""
        values = []
        for batch_id in batch_order:
            if batch_id in batch_metrics and metric_key in batch_metrics[batch_id]:
                values.append(batch_metrics[batch_id][metric_key])
        
        if len(values) < 3:
            return {"available": False}
        
        x = np.arange(len(values))
        slope, intercept, r_value, p_value, std_err = stats.linregress(x, values)
        
        if abs(r_value) < 0.3:
            trend = "stable"
        elif slope > 0:
            trend = "improving"
        else:
            trend = "degrading"
        
        return {
            "available": True,
            "trend": trend,
            "slope": float(slope),
            "r_squared": float(r_value ** 2),
            "p_value": float(p_value),
            "mean_value": float(np.mean(values)),
            "std_value": float(np.std(values))
        }
    
    @staticmethod
    def compute_mean_trajectory(batch_trajectories: Dict[str, List[Dict]], time_col: str, value_col: str) -> Dict[str, Any]:
        """Compute mean trajectory with variance bands across batches"""
        if not batch_trajectories:
            return {"available": False}
        
        # Collect all time points
        all_times = set()
        for batch_data in batch_trajectories.values():
            for point in batch_data:
                if time_col in point:
                    all_times.add(point[time_col])
        
        if not all_times:
            return {"available": False}
        
        sorted_times = sorted(all_times)
        
        # For each time point, collect values across batches
        trajectory = []
        for t in sorted_times:
            values_at_t = []
            for batch_data in batch_trajectories.values():
                for point in batch_data:
                    if point.get(time_col) == t and value_col in point:
                        values_at_t.append(point[value_col])
            
            if values_at_t:
                trajectory.append({
                    "time": t,
                    "mean": float(np.mean(values_at_t)),
                    "std": float(np.std(values_at_t)),
                    "min": float(np.min(values_at_t)),
                    "max": float(np.max(values_at_t)),
                    "n_batches": len(values_at_t)
                })
        
        return {
            "available": True,
            "trajectory": trajectory,
            "n_time_points": len(trajectory)
        }


class DatasetAnalyzer:
    """Main analyzer class that orchestrates all analysis modules"""
    
    def __init__(self, df: pd.DataFrame):
        self.df = df
        self.time_col = None
        self.batch_col = None
        self.numeric_cols = []
        self.categorical_cols = []
        self.standardized_data = None
        
    def analyze(self) -> Dict[str, Any]:
        self._infer_columns()
        self._standardize_data()
        
        return {
            "overview": self._get_overview(),
            "quality": self._analyze_quality(),
            "temporal": self._analyze_temporal(),
            "relationships": self._analyze_relationships(),
            "batch_comparison": self._analyze_batch_comparison(),
            "global_scores": self._compute_global_scores(),
            "plot_ready": self._prepare_plot_data()
        }
    
    def _infer_columns(self):
        """Deterministically infer column types"""
        time_keywords = ['time', 'timestamp', 'date', 'hour', 'minute', 't', 'elapsed', 'duration']
        batch_keywords = ['batch', 'run', 'experiment', 'lot', 'id', 'sample', 'replicate']
        
        # First identify batch column before any conversions
        for col in self.df.columns:
            col_lower = col.lower().strip()
            if self.batch_col is None:
                if any(kw in col_lower for kw in batch_keywords):
                    self.batch_col = col
                    break
        
        # If no batch column found by name, try to detect by pattern
        if self.batch_col is None:
            for col in self.df.columns:
                if self._is_batch_like(col):
                    self.batch_col = col
                    break
        
        # Now convert string columns to numeric (except batch column)
        for col in self.df.columns:
            if col == self.batch_col:
                continue
            if not pd.api.types.is_numeric_dtype(self.df[col]):
                converted = pd.to_numeric(self.df[col], errors='coerce')
                if converted.notna().sum() > len(self.df) * 0.5:
                    self.df[col] = converted
        
        # Identify time column
        for col in self.df.columns:
            if col == self.batch_col:
                continue
            col_lower = col.lower().strip()
            if self.time_col is None:
                if any(kw == col_lower or kw in col_lower for kw in time_keywords):
                    if pd.api.types.is_numeric_dtype(self.df[col]) or self._is_monotonic_numeric(col):
                        self.time_col = col
                        break
        
        # Classify remaining columns
        for col in self.df.columns:
            if col in [self.time_col, self.batch_col]:
                continue
            if pd.api.types.is_numeric_dtype(self.df[col]):
                self.numeric_cols.append(col)
            else:
                self.categorical_cols.append(col)
    
    def _is_monotonic_numeric(self, col: str) -> bool:
        """Check if column is monotonically increasing (time-like)"""
        try:
            data = pd.to_numeric(self.df[col], errors='coerce').dropna()
            if len(data) < 2:
                return False
            diffs = data.diff().dropna()
            return (diffs >= 0).mean() > 0.95
        except:
            return False
    
    def _is_batch_like(self, col: str) -> bool:
        """Detect batch column by categorical repetition pattern"""
        try:
            # Batch columns should be strings or integers, not floats
            if pd.api.types.is_float_dtype(self.df[col]):
                return False
            
            unique_count = self.df[col].nunique()
            total_count = len(self.df)
            # Batch columns typically have few unique values relative to total rows
            # and each value appears multiple times
            if unique_count < total_count * 0.1 and unique_count > 1:
                value_counts = self.df[col].value_counts()
                min_count = value_counts.min()
                return min_count > 5  # Each batch should have multiple rows
            return False
        except:
            return False
    
    def _standardize_data(self):
        """Convert to canonical form: Batch -> Time -> Variable -> Value"""
        records = []
        
        batches = [None] if self.batch_col is None else self.df[self.batch_col].unique()
        
        for batch in batches:
            if batch is None:
                batch_df = self.df
                batch_id = "all"
            else:
                batch_df = self.df[self.df[self.batch_col] == batch]
                batch_id = str(batch)
            
            for idx, row in batch_df.iterrows():
                time_val = row[self.time_col] if self.time_col else idx
                for var in self.numeric_cols:
                    records.append({
                        "batch": batch_id,
                        "time": time_val,
                        "variable": var,
                        "value": row[var]
                    })
        
        self.standardized_data = pd.DataFrame(records)
    
    def _get_overview(self) -> Dict[str, Any]:
        batches = list(self.df[self.batch_col].unique()) if self.batch_col else []
        
        duration = None
        if self.time_col:
            time_data = pd.to_numeric(self.df[self.time_col], errors='coerce')
            if not time_data.isna().all():
                duration = {
                    "min": float(time_data.min()),
                    "max": float(time_data.max()),
                    "span": float(time_data.max() - time_data.min())
                }
        
        return {
            "rows": len(self.df),
            "columns": len(self.df.columns),
            "time_column": self.time_col,
            "batch_column": self.batch_col,
            "batches": [str(b) for b in batches],
            "batch_count": len(batches) if batches else 1,
            "is_multi_batch": len(batches) > 1,
            "numeric_variables": self.numeric_cols,
            "categorical_variables": self.categorical_cols,
            "duration": duration
        }

    def _analyze_quality(self) -> Dict[str, Any]:
        """Analyze data quality for all variables"""
        time_series = pd.to_numeric(self.df[self.time_col], errors='coerce') if self.time_col else pd.Series(range(len(self.df)))
        batch_series = self.df[self.batch_col] if self.batch_col else None
        
        variable_quality = []
        for col in self.numeric_cols:
            series = self.df[col]
            missing_pct = DataQualityAnalyzer.compute_missing_percentage(series)
            
            quality = {
                "variable": col,
                "missing_pct": missing_pct,
                "density": DataQualityAnalyzer.classify_signal_density(series, missing_pct),
                "flatline": DataQualityAnalyzer.detect_flatline(series),
                "sampling": DataQualityAnalyzer.compute_sampling_stats(time_series, batch_series),
                "stats": {
                    "mean": float(series.mean()) if not series.isna().all() else None,
                    "std": float(series.std()) if not series.isna().all() else None,
                    "min": float(series.min()) if not series.isna().all() else None,
                    "max": float(series.max()) if not series.isna().all() else None
                }
            }
            variable_quality.append(quality)
        
        overall = self._compute_overall_quality(variable_quality)
        
        return {
            "variables": variable_quality,
            "overall": overall
        }
    
    def _compute_overall_quality(self, variable_qualities: List[Dict]) -> Dict[str, Any]:
        if not variable_qualities:
            return {"score": 0, "flags": ["no_data"]}
        
        score = 100.0
        flags = []
        
        # Check for missing data
        avg_missing = np.mean([v.get("missing_pct", 0) for v in variable_qualities])
        if avg_missing > 20:
            score -= 20
            flags.append("high_missing_data")
        elif avg_missing > 5:
            score -= 5
            flags.append("moderate_missing_data")
        
        # Check for irregular sampling (only penalize if truly irregular)
        sampling_info = variable_qualities[0].get("sampling", {}) if variable_qualities else {}
        if sampling_info.get("available") and sampling_info.get("regularity_score", 1) < 0.3:
            score -= 10
            flags.append("irregular_sampling")
        
        # Check for flatlined signals
        flatline_count = sum(1 for v in variable_qualities 
                           if v.get("flatline", {}).get("is_flatlined"))
        if flatline_count > 0:
            score -= 3 * min(flatline_count, 5)
            flags.append(f"flatlined_signals:{flatline_count}")
        
        # Check for offline signals (many zeros)
        offline_count = sum(1 for v in variable_qualities 
                          if v.get("density", {}).get("type") == "offline")
        if offline_count > 0:
            flags.append(f"offline_signals:{offline_count}")
            # Don't penalize for offline signals - they're valid
        
        return {"score": max(0, min(100, float(score))), "flags": flags}
    
    def _analyze_temporal(self) -> Dict[str, Any]:
        """Analyze temporal patterns for each variable per batch"""
        if not self.time_col:
            return {"available": False}
        
        results = {"available": True, "variables": {}}
        
        batches = [None] if not self.batch_col else self.df[self.batch_col].unique()
        
        for col in self.numeric_cols:
            col_results = {"batches": {}}
            
            for batch in batches:
                batch_id = "all" if batch is None else str(batch)
                
                if batch is None:
                    batch_df = self.df
                else:
                    batch_df = self.df[self.df[self.batch_col] == batch]
                
                time_data = pd.to_numeric(batch_df[self.time_col], errors='coerce').values
                values = batch_df[col].values.astype(float)
                
                # Remove NaN pairs
                mask = ~(np.isnan(time_data) | np.isnan(values))
                time_clean = time_data[mask]
                values_clean = values[mask]
                
                if len(values_clean) < 5:
                    continue
                
                # Sort by time
                sort_idx = np.argsort(time_clean)
                time_clean = time_clean[sort_idx]
                values_clean = values_clean[sort_idx]
                
                # Compute temporal metrics
                derivative = TemporalAnalyzer.compute_derivative(time_clean, values_clean)
                smoothed = TemporalAnalyzer.smooth_signal(values_clean)
                change_points = TemporalAnalyzer.detect_change_points(values_clean)
                phases = TemporalAnalyzer.segment_phases(time_clean, values_clean)
                growth_metrics = TemporalAnalyzer.compute_growth_metrics(time_clean, values_clean)
                
                col_results["batches"][batch_id] = {
                    "derivative": {
                        "mean": float(np.nanmean(derivative)) if len(derivative) > 0 else 0,
                        "max": float(np.nanmax(derivative)) if len(derivative) > 0 else 0,
                        "min": float(np.nanmin(derivative)) if len(derivative) > 0 else 0,
                        "std": float(np.nanstd(derivative)) if len(derivative) > 0 else 0
                    },
                    "change_points": change_points[:10],  # Limit to top 10
                    "phases": phases,
                    "growth_metrics": growth_metrics,
                    "trend": self._compute_trend(time_clean, values_clean)
                }
            
            results["variables"][col] = col_results
        
        return results
    
    def _compute_trend(self, time: np.ndarray, values: np.ndarray) -> Dict[str, Any]:
        if len(values) < 5:
            return {"available": False}
        
        slope, intercept, r_value, p_value, std_err = stats.linregress(time, values)
        
        if abs(r_value) < 0.3:
            direction = "stable"
        elif slope > 0:
            direction = "increasing"
        else:
            direction = "decreasing"
        
        return {
            "available": True,
            "direction": direction,
            "slope": float(slope),
            "r_squared": float(r_value ** 2),
            "p_value": float(p_value)
        }

    def _analyze_relationships(self) -> List[Dict[str, Any]]:
        """Analyze relationships between numeric variable pairs"""
        relationships = []
        
        if len(self.numeric_cols) < 2:
            return relationships
        
        # Limit to avoid combinatorial explosion
        cols_to_analyze = self.numeric_cols[:15]
        
        for i, col_x in enumerate(cols_to_analyze):
            for col_y in cols_to_analyze[i+1:]:
                x = self.df[col_x].values.astype(float)
                y = self.df[col_y].values.astype(float)
                
                # Basic correlations
                corr = RelationshipAnalyzer.compute_correlations(x, y)
                if not corr.get("available"):
                    continue
                
                # Lagged correlation
                lagged = RelationshipAnalyzer.compute_lagged_correlation(x, y, max_lag=5)
                
                # Cross-batch stability
                stability = {"available": False}
                if self.batch_col:
                    batch_corrs = []
                    for batch in self.df[self.batch_col].unique():
                        batch_df = self.df[self.df[self.batch_col] == batch]
                        bx = batch_df[col_x].values.astype(float)
                        by = batch_df[col_y].values.astype(float)
                        bc = RelationshipAnalyzer.compute_correlations(bx, by)
                        if bc.get("available"):
                            batch_corrs.append(bc["pearson"]["r"])
                    
                    if len(batch_corrs) >= 2:
                        stability = RelationshipAnalyzer.compute_relationship_stability(batch_corrs)
                
                relationships.append({
                    "var_x": col_x,
                    "var_y": col_y,
                    "correlation": corr,
                    "lagged_correlation": lagged,
                    "cross_batch_stability": stability
                })
        
        # Sort by absolute correlation strength
        relationships.sort(
            key=lambda r: abs(r["correlation"]["pearson"]["r"]) if r["correlation"].get("available") else 0,
            reverse=True
        )
        
        return relationships[:30]  # Return top 30 relationships
    
    def _analyze_batch_comparison(self) -> Dict[str, Any]:
        """Compare metrics across batches"""
        if not self.batch_col:
            return {"available": False}
        
        batches = list(self.df[self.batch_col].unique())
        if len(batches) < 2:
            return {"available": False, "reason": "single_batch"}
        
        batch_order = [str(b) for b in batches]
        
        results = {
            "available": True,
            "batch_count": len(batches),
            "batch_order": batch_order,
            "variables": {}
        }
        
        for col in self.numeric_cols:
            batch_metrics = {}
            
            for batch in batches:
                batch_df = self.df[self.df[self.batch_col] == batch]
                
                if self.time_col:
                    time_data = pd.to_numeric(batch_df[self.time_col], errors='coerce').values
                else:
                    time_data = np.arange(len(batch_df))
                
                values = batch_df[col].values.astype(float)
                
                # Sort by time
                mask = ~np.isnan(time_data)
                time_clean = time_data[mask]
                values_clean = values[mask]
                
                if len(values_clean) > 0:
                    sort_idx = np.argsort(time_clean)
                    time_clean = time_clean[sort_idx]
                    values_clean = values_clean[sort_idx]
                    
                    batch_metrics[str(batch)] = BatchComparisonAnalyzer.compute_batch_metrics(
                        time_clean, values_clean
                    )
            
            # Rankings
            rankings = {}
            for metric in ["max_value", "integrated_value", "mean_rate", "rate_stability"]:
                rankings[metric] = BatchComparisonAnalyzer.rank_batches(
                    batch_metrics, metric, higher_is_better=True
                )
            
            # Outliers
            outliers = BatchComparisonAnalyzer.detect_outlier_batches(batch_metrics, "integrated_value")
            
            # Variance analysis
            values_list = [m.get("integrated_value", 0) for m in batch_metrics.values()]
            variance_analysis = {
                "mean": float(np.mean(values_list)) if values_list else 0,
                "std": float(np.std(values_list)) if values_list else 0,
                "cv": float(np.std(values_list) / np.mean(values_list) * 100) if values_list and np.mean(values_list) != 0 else 0
            }
            
            results["variables"][col] = {
                "batch_metrics": batch_metrics,
                "rankings": rankings,
                "outlier_batches": outliers,
                "variance_analysis": variance_analysis
            }
        
        return results

    def _compute_global_scores(self) -> Dict[str, Any]:
        """Compute dataset-level global metrics"""
        if not self.batch_col or len(self.df[self.batch_col].unique()) < 2:
            return {"available": False}
        
        batches = list(self.df[self.batch_col].unique())
        batch_order = [str(b) for b in batches]
        
        results = {
            "available": True,
            "best_batches": [],
            "batch_trends": {},
            "overall_assessment": {}
        }
        
        # Compute best batch per variable per metric
        for col in self.numeric_cols[:10]:  # Limit for performance
            batch_metrics = {}
            
            for batch in batches:
                batch_df = self.df[self.df[self.batch_col] == batch]
                
                if self.time_col:
                    time_data = pd.to_numeric(batch_df[self.time_col], errors='coerce').values
                else:
                    time_data = np.arange(len(batch_df))
                
                values = batch_df[col].values.astype(float)
                mask = ~(np.isnan(time_data) | np.isnan(values))
                
                if mask.sum() > 2:
                    time_clean = time_data[mask]
                    values_clean = values[mask]
                    sort_idx = np.argsort(time_clean)
                    batch_metrics[str(batch)] = BatchComparisonAnalyzer.compute_batch_metrics(
                        time_clean[sort_idx], values_clean[sort_idx]
                    )
            
            # Best batches
            best_batches = GlobalMetricsAnalyzer.compute_best_batch_per_metric(batch_metrics, col)
            results["best_batches"].extend(best_batches)
            
            # Batch trend
            trend = GlobalMetricsAnalyzer.compute_batch_trend(batch_metrics, "integrated_value", batch_order)
            results["batch_trends"][col] = trend
        
        # Overall assessment
        improving_count = sum(1 for t in results["batch_trends"].values() 
                            if t.get("trend") == "improving")
        degrading_count = sum(1 for t in results["batch_trends"].values() 
                            if t.get("trend") == "degrading")
        total = len(results["batch_trends"])
        
        if total > 0:
            if improving_count > degrading_count:
                overall_trend = "improving"
            elif degrading_count > improving_count:
                overall_trend = "degrading"
            else:
                overall_trend = "stable"
            
            results["overall_assessment"] = {
                "trend": overall_trend,
                "improving_variables": improving_count,
                "degrading_variables": degrading_count,
                "stable_variables": total - improving_count - degrading_count
            }
        
        return results
    
    def _prepare_plot_data(self) -> Dict[str, Any]:
        """Prepare data in directly plottable format for frontend"""
        plot_data = {
            "time_series": {},
            "batch_series": {},
            "distributions": {},
            "correlations": []
        }
        
        # Use all numeric columns
        cols_to_plot = self.numeric_cols
        
        # Time series data (all data, no sampling)
        if self.time_col:
            time_data = pd.to_numeric(self.df[self.time_col], errors='coerce')
            
            for col in cols_to_plot:
                series_data = []
                for t, v in zip(time_data, self.df[col]):
                    if not pd.isna(t) and not pd.isna(v):
                        series_data.append({"time": float(t), "value": float(v)})
                
                if series_data:
                    series_data.sort(key=lambda x: x["time"])
                    plot_data["time_series"][col] = series_data
        
        # Batch-separated series - ALL batches, ALL data
        if self.batch_col:
            all_batches = list(self.df[self.batch_col].unique())
            
            for batch in all_batches:
                batch_df = self.df[self.df[self.batch_col] == batch]
                batch_id = str(batch)
                plot_data["batch_series"][batch_id] = {}
                
                if self.time_col:
                    time_data = pd.to_numeric(batch_df[self.time_col], errors='coerce')
                    
                    for col in cols_to_plot:
                        series_data = []
                        for t, v in zip(time_data, batch_df[col]):
                            if not pd.isna(t) and not pd.isna(v):
                                series_data.append({"time": float(t), "value": float(v)})
                        
                        if series_data:
                            series_data.sort(key=lambda x: x["time"])
                            plot_data["batch_series"][batch_id][col] = series_data
        
        # Distribution data for each variable
        for col in cols_to_plot:
            data = self.df[col].dropna()
            if len(data) > 0:
                hist, bin_edges = np.histogram(data, bins=20)
                plot_data["distributions"][col] = {
                    "bins": [float(b) for b in bin_edges[:-1]],
                    "counts": [int(c) for c in hist],
                    "stats": {
                        "mean": float(data.mean()),
                        "median": float(data.median()),
                        "std": float(data.std()),
                        "min": float(data.min()),
                        "max": float(data.max())
                    }
                }
        
        # Correlation matrix data
        if len(self.numeric_cols) >= 2:
            cols = self.numeric_cols
            corr_matrix = self.df[cols].corr()
            
            for i, col_x in enumerate(cols):
                for j, col_y in enumerate(cols):
                    if i < j:
                        r = corr_matrix.loc[col_x, col_y]
                        if not pd.isna(r):
                            plot_data["correlations"].append({
                                "var_x": col_x,
                                "var_y": col_y,
                                "r": float(r)
                            })
        
        return plot_data
