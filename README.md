# Autoanalytix

<p align="center">
  <img src="frontend/public/favicon.svg" alt="Autoanalytix Logo" width="72" height="72" />
</p>

<h3 align="center">AI-Native Autonomous Business Intelligence & Analytical Engine</h3>

<p align="center">
  Transform raw operational datasets into verified SQL, real-time interactive dashboards, and actionable executive insights using conversational intelligence.
</p>

<p align="center">
  <a href="#core-capabilities"><img src="https://img.shields.io/badge/Architecture-Hybrid%20Cloud%20%2B%20WASM-6366f1?style=flat-square" alt="Architecture" /></a>
  <a href="#analytical-engine"><img src="https://img.shields.io/badge/Engine-DuckDB%20Columnar-yellow?style=flat-square" alt="DuckDB" /></a>
  <a href="#ai-agent-orchestration"><img src="https://img.shields.io/badge/Orchestrator-LangGraph%20Stateful-blue?style=flat-square" alt="LangGraph" /></a>
  <a href="#security--sandboxing"><img src="https://img.shields.io/badge/Security-AES--256--GCM%20%7C%20sqlglot%20AST-emerald?style=flat-square" alt="Security" /></a>
  <a href="#technology-stack"><img src="https://img.shields.io/badge/Stack-FastAPI%20%7C%20React%20%7C%20TypeScript-0ea5e9?style=flat-square" alt="Tech Stack" /></a>
  <img src="https://img.shields.io/badge/License-MIT-gray?style=flat-square" alt="License" />
</p>

---

## Overview

**Autoanalytix** is an open-source, AI-native business intelligence platform engineered to eliminate the bottleneck between raw operational data and business decision-making. 

Traditional BI tools demand deep SQL expertise, cumbersome ETL pipelines, and ongoing semantic modeling. Autoanalytix introduces a **declarative, conversation-driven analytics workflow**: users upload raw files (CSV, Parquet, Excel) or connect cloud spreadsheets, and ask complex multi-dimensional questions in plain English. 

Under the hood, Autoanalytix combines a **sandboxed columnar OLAP engine (DuckDB)**, a **stateful multi-step agent graph (LangGraph)**, **abstract syntax tree (AST) query validation**, and a **hybrid dual-execution model** (AWS Serverless Cloud or 100% Client-Side Browser DuckDB-Wasm).

---

## System Architecture

Autoanalytix is built on an asynchronous, decoupled micro-architecture designed for sub-second query latency, strict tenant data isolation, and cryptographic zero-trust credential storage.

```mermaid
flowchart TB
    subgraph Client ["Client Layer (React 18 + TypeScript)"]
        UI["Modern Responsive UI / Tailwind CSS"]
        Store["State Management (Zustand & TanStack Query)"]
        Recharts["Dynamic Data Visualizations (Recharts)"]
        WASM["Browser Engine: DuckDB-Wasm + Web Workers"]
    end

    subgraph Gateway ["API & Edge Gateway"]
        CORS["FastAPI ASGI Gateway / Mangum Adapter"]
        AuthMiddleware["JWT Authentication & RBAC Middleware"]
    end

    subgraph CoreBackend ["Analytical Backend (Python 3.11 / FastAPI)"]
        Ingest["Data Parser (Polars / DuckDB Ingestion)"]
        Profiler["Statistical Profiler & Schema Extractor"]
        Engine["DuckDB In-Memory Columnar OLAP Engine"]
        Security["AES-256-GCM Vault & sqlglot AST Validator"]
    end

    subgraph AgentOrchestration ["AI Agent Mesh (LangGraph)"]
        PlanNode["Intent Classifier & Plan Formulator"]
        SqlNode["Schema-Grounded SQL Synthesizer"]
        VerifyNode["AST Syntax & Safety Guardrails"]
        InsightNode["Executive Insight & Narrative Synthesizer"]
    end

    subgraph Persistence ["Storage & Data Fabric"]
        S3["AWS S3 / Columnar Parquet Store"]
        Dynamo["AWS DynamoDB Single-Table Store"]
        BYOK["Encrypted BYOK Vault (OpenAI, Anthropic, Gemini, Groq)"]
        GoogleWS["Google Workspace (Docs, Sheets, Drive MCP)"]
    end

    UI --> Gateway
    Gateway --> AuthMiddleware
    AuthMiddleware --> CoreBackend
    CoreBackend --> AgentOrchestration
    AgentOrchestration --> BYOK
    CoreBackend --> Engine
    CoreBackend --> Persistence
    UI -.-> |"Client-Side Offline Mode"| WASM
```

---

## Core Product Capabilities

### 1. Conversational Natural Language Analytics
Ask multi-turn analytical questions without writing code. The underlying agent understands business intents, detects dimensional groupings, computes window aggregates, and automatically handles temporal trends, filtering, and cross-column comparisons.

### 2. Automated Deep Statistical Profiling
Upon ingestion, datasets are parsed into columnar Parquet format and profiled automatically:
- **Distribution Metrics**: Cardinality, unique count, null ratios, and data types.
- **Statistical Aggregates**: Quantiles, standard deviation, min/max bounds, and skewness for numerical features.
- **Smart Query Recommendations**: Generates schema-tailored business hypotheses and suggested starter questions.

### 3. Interactive Multi-Modal Dashboard Builder
- **Instant Chart Switcher**: Dynamically flip between Bar, Horizontal Bar, Line, Area, Pie, KPI, and Tabular views without re-running underlying analytical queries.
- **Autonomous AI Generation**: Generate complete executive dashboards covering growth, segmentation, margins, and operational performance from a single prompt.
- **Global Analytical Filtering**: Apply cross-card slicing by dimension, customer cohort, product line, or date interval.

### 4. Zero-Trust Bring-Your-Own-Key (BYOK) Inference
- Platform users supply their own API keys for **Google Gemini, OpenAI, Anthropic Claude, Groq, or OpenRouter**.
- Encrypted using **authenticated AES-256-GCM** with isolated salt and nonce generation.
- Decryption occurs strictly in-memory during inference execution; keys are never logged, never returned to client bundles, and never exposed to other workspace members.

### 5. Google Workspace Integration (MCP & REST)
- **Direct Sheet Ingestion**: Ingest live Google Sheets directly into columnar DuckDB without requiring third-party ETL connectors.
- **Executive Report Generation**: Export grounded analytical briefs, verification queries, data tables, and AI insights directly to formatted Google Docs.
- **Model Context Protocol (MCP)**: AI agents leverage native tools to search Google Drive documents to ground numerical trends in operational context.

### 6. Cryptographically Unguessable Public Sharing
- Share interactive dashboards with external stakeholders via 256-bit entropy tokens.
- Public views operate in read-only sandbox mode: internal database structures, workspace settings, and AI provider configurations remain strictly redacted.

---

## Agentic AI Architecture: LangGraph State Machine

Autoanalytix models analytical question answering not as a single LLM prompt, but as a deterministic, stateful directed acyclic graph (DAG) executed with **LangGraph**:

```mermaid
stateDiagram-v2
    [*] --> InspectSchema
    InspectSchema --> FormulatePlan: Inject Column Types & Statistical Summaries
    FormulatePlan --> SynthesizeSQL: Structured Analysis Plan (Pydantic)
    SynthesizeSQL --> ASTValidation: Generate DuckDB SQL Dialect
    
    state ASTValidation {
        [*] --> SyntaxCheck
        SyntaxCheck --> TableAllowlistCheck
        TableAllowlistCheck --> MutatingStatementFilter
        MutatingStatementFilter --> FileSystemFunctionBlock
    }

    ASTValidation --> ExecuteDuckDB: Query Passes Security Guardrails
    ASTValidation --> SynthesizeSQL: Query Rejected (Self-Correction Loop, max 2 retries)
    
    ExecuteDuckDB --> FormulateChartSpec: Extract Columnar Result Set
    FormulateChartSpec --> GenerateInsights: Bind Coordinates & Axis Dimensions
    GenerateInsights --> [*]: Persist to Multi-Turn Conversation
```

### Self-Correction & Reflection Loop
If an LLM synthesizes SQL that violates schema boundaries, uses non-existent column identifiers, or fails AST policy checks, the execution error is captured and reflected back to the agent with schema hints. The agent self-corrects without surfacing raw database errors to the end user.

---

## Security & Query Sandboxing

Because Autoanalytix executes dynamically generated SQL against analytical storage engines, defense-in-depth query sandboxing is enforced at multiple architectural layers:

```mermaid
flowchart LR
    subgraph Input ["Untrusted User Input"]
        Raw["Natural Language Prompt"]
    end

    subgraph LLM ["BYOK Model Provider"]
        GenSQL["Synthesized SQL Query"]
    end

    subgraph ASTGate ["sqlglot AST Security Gate"]
        Parse["Grammar Parser"]
        Validate{"Single SELECT Only?"}
        BlockTable{"Unauthorized Table Names?"}
        BlockSys{"FS Functions Blocked? (read_csv, attach, system)"}
        BlockMutation{"Mutation Blocked? (DROP, INSERT, ALTER)"}
    end

    subgraph Execution ["Sandboxed Analytical Runtime"]
        DuckDB["DuckDB Read-Only Execution Context (Memory & Time Capped)"]
    end

    Raw --> LLM
    LLM --> GenSQL
    GenSQL --> Parse
    Parse --> Validate
    Validate -- Yes --> BlockTable
    Validate -- No --> Reject["HTTP 400: Statement Rejected"]
    BlockTable -- Clean --> BlockSys
    BlockTable -- Violation --> Reject
    BlockSys -- Clean --> BlockMutation
    BlockSys -- Violation --> Reject
    BlockMutation -- Pass --> DuckDB
    BlockMutation -- Fail --> Reject
```

### Key Security Guardrails:
1. **Single-Statement Isolation**: Only single-statement queries are evaluated; stacked queries (`;`) are strictly rejected.
2. **Read-Only Invariant**: The query AST is checked to ensure it contains only `SELECT` expressions. All Data Manipulation (DML) and Data Definition (DDL) operations (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE`, `REPLACE`) throw terminal security exceptions.
3. **Storage Boundary Enforcement**: External DuckDB filesystem routines (such as `read_parquet`, `scan_parquet`, `read_csv`, `glob`, `system`, or `ATTACH`) are barred from user space. Queries can only reference pre-registered, session-isolated virtual table identifiers.
4. **Hardware Resource Limits**: Every DuckDB query executes with rigid resource bounds (2GB memory ceiling, 30-second query timeout, and a 1,000-row preview limit) to prevent denial-of-service via Cartesian joins.

---

## Hybrid Dual-Execution Architecture

Autoanalytix features a dual-topology execution engine designed for maximum deployment flexibility:

| Mode | Compute Engine | State & Storage | Best For |
| :--- | :--- | :--- | :--- |
| **Cloud-Native Serverless** | Python DuckDB in AWS Lambda | AWS DynamoDB (Single-Table Design) + AWS S3 | Teams, multi-user collaboration, unified workspace analytics, and heavy columnar datasets. |
| **Zero-Backend WASM Mode** | In-Browser DuckDB-Wasm via Web Workers | Browser IndexedDB + LocalStorage | Instant exploration, offline environments, local analytical prototyping, and complete data privacy. |

---

## Technology Stack

### Frontend Application
- **Core**: React 18, TypeScript, Vite
- **Styling & UI**: Tailwind CSS, PostCSS, Lucide Icons
- **State Management & Caching**: Zustand (Global Auth & Preferences), TanStack Query (Server Synchronization)
- **Data Visualization**: Recharts (High-performance SVG/Canvas charting engine)
- **Local Analytics**: `@duckdb/duckdb-wasm`, Apache Arrow, SheetJS (`xlsx`)

### Backend & Analytical Services
- **Framework**: FastAPI (ASGI), Pydantic v2, Python 3.11
- **Analytical Engine**: DuckDB (Columnar OLAP), Polars
- **SQL Parsing & Validation**: `sqlglot` (Semantic AST tree verification)
- **AI Agent Framework**: LangGraph, LangChain Core (`langchain-openai`, `langchain-anthropic`, `langchain-google-genai`, `langchain-groq`)
- **Security & Crypto**: `cryptography` (AES-256-GCM), PyJWT, bcrypt

### Cloud Infrastructure & Deployment
- **Compute**: Containerized AWS Lambda with Mangum ASGI Adapter, AWS CodeBuild
- **Database & Storage**: Amazon DynamoDB, Amazon S3, Amazon ECR
- **External Connectors**: Google Drive API v3, Google Docs API v1, Google Sheets API v4

---

## Analytical Feature Matrix

| Feature | Autoanalytix | Legacy BI Tools | Generic Chatbots |
| :--- | :---: | :---: | :---: |
| **Query Engine** | In-Process Columnar DuckDB | Heavy SQL Warehouse (Snowflake/BigQuery) | None (Hallucinates numbers) |
| **Query Security** | Strict `sqlglot` AST Validation | Manual Role Grants | None |
| **Inference Cost** | $0 Base (Zero Markup BYOK) | High Seat Licensing | Monthly Subscription |
| **Stateful Workflow** | LangGraph Directed Graph | Static Dashboards | Single-Turn Context Loss |
| **Cloud + Local Modes** | Hybrid (Serverless or WASM) | Cloud-Only / On-Prem | Cloud-Only |
| **Export Formats** | Formatted Google Docs, CSV, JSON | PDF, CSV | Raw Markdown |

---

## Repository Map

```text
Autoanalytix/
├── backend/                       # Python FastAPI Backend & Agent Core
│   ├── app/
│   │   ├── ai/                    # LangGraph agents, state definitions, LLM adapters
│   │   ├── analytics/             # DuckDB query executor, sqlglot AST validator, profiler
│   │   ├── api/                   # REST routing (auth, datasets, analytics, Google Workspace)
│   │   ├── core/                  # AES-GCM credential vault, DynamoDB & S3 clients, config
│   │   ├── ingestion/             # Multi-format tabular data parsers
│   │   ├── integrations/          # Google Docs/Sheets/Drive REST & MCP integration services
│   │   └── main.py                # ASGI application root & Lambda handler
│   ├── Dockerfile                 # Standard production container
│   ├── Dockerfile.lambda          # AWS Lambda container image specification
│   └── requirements.txt           # Python dependency tree
│
├── frontend/                      # React 18 + TypeScript Client Application
│   ├── src/
│   │   ├── components/            # ChartRenderer, Layout, Ingestion Modals
│   │   ├── pages/                 # AnalyticsWorkspace, DashboardEditor, AIProvidersSettings
│   │   ├── services/              # API Client, DuckDB-Wasm engine, Browser AI runners
│   │   └── stores/                # Zustand application stores
│   ├── package.json               # Node dependency manifest
│   └── vite.config.ts             # Vite build orchestration
│
├── scripts/                       # Cloud deployment automation & data migration utilities
└── INTEGRATIONS_ARCHITECTURE.md   # Architectural blueprint for MCP & data warehouse connectors
```

---

## License

This project is licensed under the [MIT License](LICENSE).