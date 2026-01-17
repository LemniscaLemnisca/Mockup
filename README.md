# Lemnisca - Bioprocess Data Intelligence Platform

## How to Run

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm

### 1. Start the Backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

Backend runs at `http://127.0.0.1:8000`

### 2. Start the Frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5174`

### 3. Use the App

1. Open `http://localhost:5174` in your browser
2. Upload a CSV file with fermentation data
3. View insights on the dashboard
4. Click "Move to Model Training" to access the modeling layer
5. Select a model, train it, and run simulations (MOCK)
# Mockup
