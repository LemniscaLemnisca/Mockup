from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
from io import StringIO
from analyzer import DatasetAnalyzer

app = FastAPI(title="Insight Layer API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def clean_for_json(obj):
    """Recursively clean NaN/Inf values for JSON serialization"""
    if isinstance(obj, dict):
        return {k: clean_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_for_json(v) for v in obj]
    elif isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    elif isinstance(obj, float):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return obj
    elif isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64, np.float32)):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return clean_for_json(obj.tolist())
    elif isinstance(obj, (str, int, type(None))):
        return obj
    else:
        return str(obj)


@app.get("/health")
async def health():
    return {"status": "healthy", "version": "2.0.0"}


def detect_data_start_row(contents: str, max_scan_rows: int = 30) -> tuple[int, int]:
    """
    Detect where actual data starts in a CSV by finding the first row with high numeric density.
    
    Returns:
        (header_row, data_start_row) - 0-indexed row numbers
        header_row is the row to use as column names
        data_start_row is where numeric data begins
    """
    lines = contents.strip().split('\n')
    if len(lines) < 2:
        return (0, 1)  # Standard: first row header, second row data
    
    scan_limit = min(max_scan_rows, len(lines))
    
    # For each row, calculate numeric density (% of columns that are numeric)
    numeric_densities = []
    
    for i in range(scan_limit):
        line = lines[i]
        # Simple CSV split (handles basic cases)
        cells = line.split(',')
        if not cells:
            numeric_densities.append(0)
            continue
        
        numeric_count = 0
        for cell in cells:
            cell = cell.strip().strip('"').strip("'")
            if not cell:
                continue
            # Try to parse as number
            try:
                float(cell.replace(',', ''))  # Handle comma in numbers
                numeric_count += 1
            except ValueError:
                pass
        
        density = numeric_count / len(cells) if cells else 0
        numeric_densities.append(density)
    
    # Find the first row where numeric density is high (>50%)
    # This indicates actual data has started
    data_start = None
    for i, density in enumerate(numeric_densities):
        if density >= 0.5:
            data_start = i
            break
    
    if data_start is None:
        # No clear data start found, assume standard format
        return (0, 1)
    
    if data_start == 0:
        # First row is already data - no header row in file
        # Use generic column names
        return (None, 0)
    
    # The row immediately before data start is likely the header
    # But we should verify it looks like a header (mostly non-numeric)
    header_row = data_start - 1
    
    # Check if header_row has low numeric density (looks like column names)
    if numeric_densities[header_row] < 0.3:
        return (header_row, data_start)
    
    # If the row before data is also numeric, keep going back
    for i in range(header_row, -1, -1):
        if numeric_densities[i] < 0.3:
            return (i, data_start)
    
    # No good header found, use generic names
    return (None, data_start)


@app.post("/analyze")
async def analyze_dataset(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    try:
        contents = await file.read()
        
        # Try different encodings
        decoded_contents = None
        for encoding in ['utf-8', 'latin-1', 'cp1252']:
            try:
                decoded_contents = contents.decode(encoding)
                break
            except:
                continue
        
        if decoded_contents is None:
            raise HTTPException(status_code=400, detail="Failed to decode CSV file")
        
        # Detect where actual data starts
        header_row, data_start_row = detect_data_start_row(decoded_contents)
        
        # Parse CSV with detected structure
        df = None
        if header_row is None:
            # No header row - use generic column names
            df = pd.read_csv(
                StringIO(decoded_contents), 
                skiprows=data_start_row,
                header=None
            )
            df.columns = [f"Column_{i+1}" for i in range(len(df.columns))]
        elif header_row == data_start_row - 1:
            # Standard case: header is right before data
            df = pd.read_csv(
                StringIO(decoded_contents),
                skiprows=header_row,
                header=0
            )
        else:
            # Header and data are not adjacent - read header separately
            lines = decoded_contents.strip().split('\n')
            header_line = lines[header_row]
            headers = [h.strip().strip('"').strip("'") for h in header_line.split(',')]
            
            df = pd.read_csv(
                StringIO(decoded_contents),
                skiprows=data_start_row,
                header=None,
                names=headers
            )
        
        if df is None:
            raise HTTPException(status_code=400, detail="Failed to parse CSV file")
        
        # Clean column names (remove any leading/trailing whitespace)
        df.columns = [str(col).strip() for col in df.columns]
        
        # Convert columns that look numeric but are stored as strings
        for col in df.columns:
            if not pd.api.types.is_numeric_dtype(df[col]):
                converted = pd.to_numeric(df[col], errors='coerce')
                if converted.notna().sum() > len(df) * 0.5:
                    df[col] = converted
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")
    
    if df.empty:
        raise HTTPException(status_code=400, detail="Dataset is empty")
    
    if len(df.columns) < 2:
        raise HTTPException(status_code=400, detail="Dataset must have at least 2 columns")
    
    try:
        analyzer = DatasetAnalyzer(df)
        insights = analyzer.analyze()
        
        # Clean for JSON serialization
        insights = clean_for_json(insights)
        
        return insights
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
