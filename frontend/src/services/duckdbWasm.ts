import * as duckdb from "@duckdb/duckdb-wasm";

class DuckDBWasmService {
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;
  private isInitializing: boolean = false;
  private initPromise: Promise<duckdb.AsyncDuckDB> | null = null;
  private registeredTables: Set<string> = new Set();

  public async getDb(): Promise<duckdb.AsyncDuckDB> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
        const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
        const worker = await duckdb.createWorker(bundle.mainWorker!);
        const logger = new duckdb.ConsoleLogger();
        const db = new duckdb.AsyncDuckDB(logger, worker);
        await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
        this.db = db;
        this.conn = await db.connect();
        return db;
      } catch (err) {
        console.error("Failed to initialize DuckDB-Wasm:", err);
        throw err;
      }
    })();

    return this.initPromise;
  }

  public async getConnection(): Promise<duckdb.AsyncDuckDBConnection> {
    await this.getDb();
    if (!this.conn && this.db) {
      this.conn = await this.db.connect();
    }
    return this.conn!;
  }

  public async registerFile(tableName: string, file: File | Blob | ArrayBuffer | string, extension: "csv" | "parquet" | "json" = "csv") {
    const db = await this.getDb();
    const conn = await this.getConnection();

    const fileName = `${tableName}.${extension}`;
    if (typeof file === "string") {
      await db.registerFileText(fileName, file);
    } else if (file instanceof ArrayBuffer) {
      await db.registerFileBuffer(fileName, new Uint8Array(file));
    } else {
      const arrayBuffer = await (file as Blob).arrayBuffer();
      await db.registerFileBuffer(fileName, new Uint8Array(arrayBuffer));
    }

    // Create table from file in DuckDB
    if (extension === "csv") {
      await conn.query(`CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${fileName}');`);
    } else if (extension === "parquet") {
      await conn.query(`CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_parquet('${fileName}');`);
    } else if (extension === "json") {
      await conn.query(`CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_json_auto('${fileName}');`);
    }

    this.registeredTables.add(tableName);
  }

  public isTableRegistered(tableName: string): boolean {
    return this.registeredTables.has(tableName);
  }

  public async query(sql: string): Promise<{ rows: any[]; columns: string[]; executionTimeMs: number }> {
    const conn = await this.getConnection();
    const startTime = performance.now();
    const result = await conn.query(sql);
    const executionTimeMs = Math.round(performance.now() - startTime);

    const rows = result.toArray().map((row) => row.toJSON());
    const columns = result.schema.fields.map((f) => f.name);

    return {
      rows,
      columns,
      executionTimeMs,
    };
  }

  public async profileTable(tableName: string) {
    const conn = await this.getConnection();

    // 1. Column info
    const colsResult = await conn.query(`DESCRIBE "${tableName}";`);
    const cols = colsResult.toArray().map((r) => r.toJSON());

    // 2. Count
    const countResult = await conn.query(`SELECT COUNT(*) as cnt FROM "${tableName}";`);
    const totalRows = Number(countResult.toArray()[0]?.cnt || 0);

    // 3. Profiles per column
    const columnsProfile = [];
    let totalNulls = 0;
    for (const c of cols) {
      const colName = c.column_name;
      const colType = c.column_type;
      let isNumeric = ["BIGINT", "INTEGER", "DOUBLE", "FLOAT", "DECIMAL", "HUGEINT"].some((t) =>
        colType.toUpperCase().includes(t)
      );

      let stats: any = {};
      let nullCount = 0;
      let uniqueCount = 0;
      try {
        if (isNumeric) {
          const statsRes = await conn.query(`
            SELECT 
              MIN("${colName}") as min_val,
              MAX("${colName}") as max_val,
              AVG("${colName}") as avg_val,
              COUNT("${colName}") as non_null_cnt,
              COUNT(DISTINCT "${colName}") as distinct_cnt
            FROM "${tableName}";
          `);
          const s = statsRes.toArray()[0]?.toJSON() || {};
          nullCount = totalRows - Number(s.non_null_cnt || 0);
          uniqueCount = Number(s.distinct_cnt || 0);
          stats = {
            min: s.min_val,
            max: s.max_val,
            mean: s.avg_val ? Number(s.avg_val.toFixed(2)) : 0,
            null_count: nullCount,
            unique_count: uniqueCount,
          };
        } else {
          const statsRes = await conn.query(`
            SELECT 
              COUNT("${colName}") as non_null_cnt,
              COUNT(DISTINCT "${colName}") as distinct_cnt
            FROM "${tableName}";
          `);
          const s = statsRes.toArray()[0]?.toJSON() || {};
          nullCount = totalRows - Number(s.non_null_cnt || 0);
          uniqueCount = Number(s.distinct_cnt || 0);
          stats = {
            null_count: nullCount,
            unique_count: uniqueCount,
          };
        }
      } catch (e) {
        console.warn(`Could not compute stats for ${colName}:`, e);
      }

      totalNulls += nullCount;
      const nullPercentage = totalRows > 0 ? Number(((nullCount / totalRows) * 100).toFixed(2)) : 0;

      columnsProfile.push({
        name: colName,
        original_name: colName,
        data_type: isNumeric ? "numeric" : "categorical",
        duckdb_type: colType,
        null_count: nullCount,
        null_percentage: nullPercentage,
        unique_count: uniqueCount,
        stats,
      });
    }

    const totalCells = totalRows * columnsProfile.length;
    const missingCellsPercentage = totalCells > 0 ? Number(((totalNulls / totalCells) * 100).toFixed(2)) : 0;

    return {
      table_name: tableName,
      row_count: totalRows,
      column_count: columnsProfile.length,
      columns: columnsProfile,
      duplicate_rows_count: 0,
      missing_cells_count: totalNulls,
      missing_cells_percentage: missingCellsPercentage,
      total_cells: totalCells,
      summary_insights: [
        `Parsed ${totalRows.toLocaleString()} rows and ${columnsProfile.length} columns into DuckDB-Wasm engine.`,
        `Column missing percentage averages ${missingCellsPercentage}%.`
      ],
    };
  }
}

export const duckdbWasm = new DuckDBWasmService();
