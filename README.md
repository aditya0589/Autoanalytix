# Autoanalytix — AI-Powered Business Analytics Platform

> **Ask your data anything. Turn answers into dashboards and decisions.**

Autoanalytix is a production-quality, AI-native business intelligence platform that empowers non-technical business users to upload datasets, ask complex analytical questions in plain English, inspect statistically profiled metrics, and assemble interactive dashboards without writing a single line of SQL, Python, or data engineering scripts.

---

## Key Highlights & Architectural Guarantees

1. **Bring Your Own Key (BYOK) Architecture**:
   - Zero dependency on developer-owned inference keys.
   - Users bring their own Google Gemini, OpenAI, or Anthropic Claude API keys.
   - Keys are encrypted at rest using **authenticated AES-256-GCM** with a dedicated encryption key stored independently from application databases.
   - Decryption occurs strictly in-memory inside the backend; keys are never logged, never returned to the frontend, and never committed to version control.
   - Unconfigured users receive friendly onboarding guidance directing them to `/settings/ai-providers`.

2. **DuckDB In-Process Analytical Engine**:
   - High-throughput analytical queries executed directly in DuckDB over columnar Parquet and CSV files.
   - Memory limits and query timeouts enforced.
   - Datasets are completely isolated by unique table names.

3. **Strict SQL Parser & AST Security Validation**:
   - Every AI-generated query passes through `sqlglot` AST validation.
   - Strictly single-statement read-only `SELECT` queries permitted.
   - External filesystem functions (`read_csv`, `read_parquet`, `scan_parquet`, `glob`, `system`, etc.) and data mutation statements (`INSERT`, `UPDATE`, `DROP`, `ALTER`, `ATTACH`) are blocked.
   - Bounded retries (up to 2 iterations) if an AI model produces non-compliant SQL.

4. **LangGraph Stateful Analytical Agent**:
   - Orchestrated using typed `AnalyticsState` in LangGraph.
   - Workflow: Schema inspection &rarr; Intent understanding &rarr; Structured analysis plan (Pydantic) &rarr; SQL formulation &rarr; AST security check &rarr; DuckDB execution &rarr; Chart specification &rarr; Business insight grounding.
   - Contextual follow-up support with persisted multi-turn conversations.

5. **AI & Manual Dashboard Builder**:
   - Natural language generation: *"Create an executive sales dashboard showing revenue, profit, monthly growth, regional performance, and top 10 products."*
   - Interactive Recharts visualization with on-the-fly chart type switching (Bar, Horizontal Bar, Line, Area, Pie, Table, KPI).
   - Global dashboard filters (segment, category, dates).

6. **Unguessable Cryptographic Sharing**:
   - Public view links generated with 256-bit cryptographically secure tokens.
   - Public viewers do not need an account or an AI key.
   - Private credentials, raw datasets, and internal metadata are completely redacted.
   - Instant revocation and expiration support.

7. **One-Click Realistic Demo Dataset**:
   - Built-in B2B SaaS & Tech Sales dataset with 1,200 orders spanning 2025–2026 across Enterprise, Mid-Market, and SMB tiers.

---

## Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, React Router v6, Recharts, TanStack Query, Zustand, Lucide Icons |
| **Backend** | Python 3.11, FastAPI, Pydantic v2, SQLAlchemy v2, SQLite / PostgreSQL, Cryptography (AES-GCM), PyJWT, bcrypt |
| **AI Orchestration** | LangGraph, LangChain (`langchain-google-genai`, `langchain-openai`, `langchain-anthropic`) |
| **Analytics Engine** | DuckDB, Polars, openpyxl, sqlglot (AST parser & security validator) |
| **Infrastructure** | Docker, Docker Compose |

---

## Project Structure

```text
Autoanalytix/
│
├── frontend/                     # Standalone React + Vite + TypeScript frontend
│   ├── src/
│   │   ├── components/           # ChartRenderer, Layout, UI primitives
│   │   ├── pages/                # Login, Register, Dashboard, Datasets, Analytics, etc.
│   │   ├── services/             # API client with JWT handling
│   │   ├── stores/               # Zustand auth & workspace state
│   │   ├── App.tsx               # Route definitions
│   │   └── main.tsx              # Frontend entrypoint
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
│
├── backend/                      # FastAPI analytical backend
│   ├── app/
│   │   ├── ai/                   # BYOK adapters (Gemini, OpenAI, Claude), LangGraph agents
│   │   ├── analytics/            # DuckDB engine, sqlglot AST validator, statistical profiler
│   │   ├── api/                  # REST endpoints (auth, datasets, analytics, dashboards, etc.)
│   │   ├── core/                 # Config, database, security (AES-GCM, bcrypt)
│   │   ├── data_sources/         # Extensible external SQL connector interfaces
│   │   ├── ingestion/            # File parser (CSV, XLSX) & demo data generator
│   │   ├── models/               # SQLAlchemy ORM models
│   │   ├── schemas/              # Pydantic validation schemas
│   │   └── main.py               # FastAPI entrypoint
│   ├── tests/                    # Automated pytest suite
│   ├── Dockerfile
│   └── requirements.txt
│
├── docker-compose.yml            # Multi-container orchestration (PostgreSQL, Backend, Frontend)
├── .env.example                  # Environment configuration template
└── README.md
```

---

## Quickstart Guide

### Option 1: Standalone Local Development (No Docker Required)

#### 1. Backend Setup
```bash
# Clone the repository
git clone https://github.com/aditya0589/Autoanalytix.git
cd Autoanalytix

# Create and activate Python virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
pip install email-validator

# Run backend server
python -m uvicorn app.main:app --app-dir backend --reload --port 8000
```
The FastAPI backend will start at `http://localhost:8000`. Interactive OpenAPI documentation is available at `http://localhost:8000/api/docs`.

#### 2. Frontend Setup
In a new terminal window:
```bash
cd frontend

# Install npm dependencies
npm install

# Start Vite dev server
npm run dev
```
The application will open at `http://localhost:5173`.

---

### Option 2: Docker Compose

```bash
# Build and start all services (PostgreSQL, FastAPI Backend, React Frontend)
docker-compose up --build
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- API Documentation: `http://localhost:8000/api/docs`

---

## Running the Automated Test Suite

The test suite validates:
- User registration, password hashing with direct `bcrypt`, and JWT session tokens.
- Cryptographic credential encryption (AES-256-GCM) and key masking.
- Strict SQL AST security enforcement (blocking unauthorized tables, destructive commands, file access, and multi-statements).
- Dataset ingestion, statistical profiling, and DuckDB analytical query execution.
- AI provider configuration management and deletion.

```bash
# Run tests with pytest
.\venv\Scripts\pytest backend\tests -v
```

All 5 core test suites pass cleanly with 0 warnings.

---

## End-to-End User Journey

1. **Sign Up & Workspace Creation**:
   - Navigate to `/register`, enter your name, email, and password. Autoanalytix automatically initializes your personal workspace.
2. **Configure AI Provider (BYOK)**:
   - Go to `/settings/ai-providers`.
   - Select **Google Gemini**, **OpenAI**, or **Anthropic Claude**.
   - Paste your API key and choose a model (e.g., `gemini-2.5-flash` or `gpt-4o-mini`).
   - Click **Test Connection** to verify provider connectivity and latency, then click **Save Configuration**.
3. **Explore Data**:
   - Click **Try Demo Dataset** to load 1,200 orders of SaaS revenue data, or upload your own CSV/Excel file at `/datasets`.
   - Inspect columns, distributions, null percentages, and statistical summaries.
4. **Natural Language Analytics**:
   - Click **Ask Questions with AI** or select one of the suggested query chips:
     - *"Show monthly revenue trend over time."*
     - *"Which category generated the highest profit?"*
     - *"Compare revenue and profit by region."*
   - LangGraph formulates a structured plan, validates DuckDB SQL, runs the query, renders a chart, and synthesizes grounded business insights.
5. **Dashboard Assembly & Sharing**:
   - Click **Add to Dashboard** on any insight card.
   - Or click **Generate with AI** at `/dashboards` to automatically produce an executive dashboard.
   - Click **Share** to generate an unguessable public link for colleagues or stakeholders.

---

## Security & Privacy Statement

- **No Developer API Key Fallback**: If a user has not configured an AI key, the platform cleanly displays an onboarding banner rather than routing inference through a developer-managed key.
- **Strict Data Isolation**: Queries cannot traverse between datasets or access underlying host system files.
- **Zero Raw Secret Exposure**: Encrypted credentials are never rendered to clients. Only masked signatures (e.g. `AIzaSy••••••••7x9F`) are visible in settings.