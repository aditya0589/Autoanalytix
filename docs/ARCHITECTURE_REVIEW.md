# Architecture Review: Autoanalytix

> **Date:** October 20, 2026  
> **Status:** Architecture Assessment & Deepening Opportunities  
> **Interactive Visual Report:** [`docs/ARCHITECTURE_REVIEW.html`](./ARCHITECTURE_REVIEW.html)

---

## Schematic Legend

- **Module**: A unit of code providing functionality through an interface.
- **Seam**: A place where code connects to other code, and where tests or alternate adapters can plug in.
- **Leakage**: Responsibilities or implementation details escaping across a seam into callers.
- **Deep Module**: An abstraction with a small, clear interface that hides significant internal complexity.

---

## Top Recommendation: Highest Immediate Leverage

### Candidate 1: Collapse the Dataset Ingestion Pipeline into a Deep Module

Three API controllers redundantly orchestrate temporary disk CSV serialization, Parquet writes, S3 syncs, and DuckDB table cataloging over 150 duplicate lines.

---

## Candidate 1: Collapse the Dataset Ingestion Pipeline

- **Recommendation Strength:** `Strong`
- **Category:** `in-process`
- **Files Involved:**
  - `backend/app/ingestion/parser.py`
  - `backend/app/analytics/profiler.py`
  - `backend/app/api/datasets.py`
  - `backend/app/api/data_sources.py`
  - `backend/app/api/integrations_google.py`

### Visual Architectural Comparison

```mermaid
flowchart TD
  subgraph Before ["Before: Shallow Modules & Scattered Orchestration"]
    direction TB
    C1["Upload Route"]
    C2["DB Ingest Route"]
    C3["Sheet Ingest Route"]
    CSV["temp_*.csv on Disk"]
    DP["DataParser (Shallow)"]
    PQ["Parquet Writer"]
    S3["s3_storage.upload"]
    ENG["analytics_engine.register"]
    PROF["DatasetProfiler"]
    DDB["dynamodb_store.create"]

    C2 -.leak.-> CSV
    C3 -.leak.-> CSV
    CSV --> DP
    C1 --> DP
    C1 -.duplicate.-> PQ
    C2 -.duplicate.-> PQ
    C3 -.duplicate.-> PQ
    PQ -.duplicate.-> S3
    PQ -.duplicate.-> ENG
    DP -.duplicate.-> PROF
    PROF -.duplicate.-> DDB
  end

  subgraph After ["After: One Deep Ingestion Module"]
    direction TB
    R1["Upload Route"]
    R2["DB Ingest Route"]
    R3["Sheet Ingest Route"]
    
    subgraph DeepIngestion ["Deep Module: DatasetIngestion"]
      direction TB
      INT["Single Interface:\ningest_file() / ingest_records()"]
      subgraph Encapsulated ["Hidden Implementation"]
        direction LR
        P1["Parse / Stream"] --> P2["Parquet Storage"]
        P2 --> P3["S3 Durable Sync"]
        P2 --> P4["DuckDB Catalog"]
        P1 --> P5["Profiling & Schema"]
        P5 --> P6["DynamoDB Record"]
      end
      INT --> Encapsulated
    end

    R1 --> INT
    R2 --> INT
    R3 --> INT
  end
```

- **Problem:** Three API controllers manually coordinate six shallow modules and temporary CSV disk serialization to ingest data.
- **Solution:** Consolidate parsing, profiling, Parquet persistence, and engine registration behind one deep `DatasetIngestion` module.
- **Wins:**
  - **Locality:** Ingestion bugs stay concentrated in one place
  - **Interface shrinks:** Three controllers delete 150 lines
  - **Leverage:** One interface for all sources
  - **Performance:** Eliminates disk CSV intermediate serialization

---

## Candidate 2: Deepen DuckDB Analytics Engine with Self-Hydrating Execution

- **Recommendation Strength:** `Strong`
- **Category:** `ports & adapters`
- **Files Involved:**
  - `backend/app/analytics/engine.py`
  - `backend/app/core/s3_storage.py`
  - `backend/app/api/datasets.py`
  - `backend/app/ai/agents/analytics_graph.py`
  - `backend/app/ai/agents/dashboard_graph.py`

### Visual Architectural Comparison

```mermaid
sequenceDiagram
  autonumber
  Note over Caller,ENG: Before: Leaky Hydration Across Callers
  actor Caller as API / AI Agent
  participant S3 as s3_storage
  participant ENG as analytics_engine
  participant DUCK as DuckDB Process

  Caller->>S3: ensure_local_cache(path)
  Caller->>ENG: register_dataset(table, path)
  ENG->>DUCK: CREATE TABLE AS read_parquet()
  Caller->>ENG: execute_query(sql, table)
  ENG->>DUCK: SELECT * FROM (sql)
  DUCK-->>ENG: raw_rows
  ENG-->>Caller: clean_rows
  Note over Caller,ENG: AI Agent forgets steps 1-2 & crashes on serverless cold starts!
```

```mermaid
sequenceDiagram
  autonumber
  Note over Caller,DUCK: After: Self-Hydrating Engine Seam
  actor Caller as API / AI Agent
  participant ENG as Deep Analytics Engine
  participant Cache as Storage Cache
  participant DUCK as DuckDB Connection

  Caller->>ENG: query(dataset_id, sql)
  critical Self-Hydration behind Seam
    ENG->>Cache: resolve_and_ensure_cached(dataset_id)
    ENG->>DUCK: ensure_view_mounted(table, path)
  end
  ENG->>DUCK: execute_and_sanitize(sql)
  DUCK-->>ENG: result_rows
  ENG-->>Caller: QueryResult (rows, cols, stats)
```

- **Problem:** The analytics engine requires callers to manually orchestrate S3 cache hydration and table registration before querying.
- **Solution:** Deepen the engine module to resolve and hydrate datasets automatically behind a single query interface.
- **Wins:**
  - **Locality:** Cache synchronization stays internal to the engine
  - **Reliability:** Prevents AI agent cold-start crashes completely
  - **Leverage:** One interface for all callers
  - **Testability:** Tests hit one in-memory seam

---

## Candidate 3: Delete Ghost SQLAlchemy Layer & Clarify Persistence Seam

- **Recommendation Strength:** `Strong`
- **Category:** `in-process`
- **Files Involved:**
  - `backend/app/core/database.py`
  - `backend/app/models/base.py`
  - `backend/app/models/all_models.py`
  - `backend/app/main.py`
  - `backend/app/core/dynamodb.py`

### Visual Architectural Comparison

```mermaid
flowchart TD
  subgraph Before ["Before: Dead ORM Layer Booted at Startup"]
    direction TB
    Boot1["FastAPI main.py Lifespan"]
    Boot1 -.boots connection.-> DB["app.core.database.engine"]
    DB -.runs DDL.-> Ghost["SQLAlchemy all_models (500 lines)"]
    Ghost -.0 callers.-> X["Unused SQLite DB file"]

    API1["API Routes"] --> DDB1["dynamodb_store (Active Store)"]
    DDB1 --> DTable1["AWS DynamoDB Single-Table"]
  end

  subgraph After ["After: Single Persistence Seam"]
    direction TB
    Boot2["FastAPI main.py Lifespan"] --> DDB2["Deep Persistence Seam: DataStore"]
    API2["API Routes"] --> Schemas["Pydantic Schemas (all_schemas.py)"]
    Schemas --> DDB2
    DDB2 --> Prod["AWS DynamoDB Adapter"]
    DDB2 -.tests.-> Mock["In-Memory Store Adapter"]
  end
```

- **Problem:** Five hundred lines of unused SQLAlchemy models and connection pooling boot on every startup despite migration to DynamoDB.
- **Solution:** Delete the dead SQLAlchemy module tree and establish DynamoDB as the unambiguous persistence implementation.
- **Wins:**
  - **Deletion test:** 500 dead lines deleted
  - **Startup speed:** Cold starts drop initialization latency
  - **Seam clarity:** Pydantic schemas define entities
  - **Locality:** Eliminates dual-model schema confusion

---

## Candidate 4: Extract Explicit Backend Adapters in Frontend Client

- **Recommendation Strength:** `Worth exploring`
- **Category:** `local-substitutable`
- **Files Involved:**
  - `frontend/src/services/api.ts`
  - `frontend/src/services/browserStore.ts`
  - `frontend/src/services/duckdbWasm.ts`
  - `frontend/src/services/browserAi.ts`

### Visual Architectural Comparison

```mermaid
flowchart TD
  subgraph Before ["Before: 890-Line Monolith with Branching Fallbacks"]
    direction TB
    UI1["React UI Pages"] --> Client["ApiClient Monolith (890 lines)"]
    Client -.try.-> HTTP1["fetch('/api/...')"]
    Client -.catch fallback.-> WASM["duckdbWasm.query()"]
    Client -.catch fallback.-> BStore["browserStore.save()"]
    Client -.catch fallback.-> BAI["browserAi.chat()"]
    Client -.catch fallback.-> XLSX["xlsx.sheet_to_csv()"]
  end

  subgraph After ["After: Two Explicit Adapters Behind One Seam"]
    direction TB
    UI2["React UI Pages"] --> Seam["BackendClient Interface"]
    Seam -->|Network Mode| Remote["HttpBackendAdapter"]
    Seam -->|Demo / Offline Mode| Local["BrowserWasmBackendAdapter"]
    Remote --> HTTP2["FastAPI REST API"]
    Local --> InBrowser["DuckDB-Wasm + IndexedDB"]
  end
```

- **Problem:** An 890-line client monolith interweaves network calls and browser-WASM fallbacks inside dozens of nested `try/catch` blocks.
- **Solution:** Introduce an explicit backend seam with separate HTTP and browser-WASM adapter implementations.
- **Wins:**
  - **Seam justified:** Two real adapters justify the abstraction
  - **Interface shrinks:** Client sheds fallback branching
  - **Locality:** Network logic separated from WASM
  - **Testability:** Mock adapter swaps without network mocks
