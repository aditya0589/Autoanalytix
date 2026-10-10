from typing import List, Tuple, Set
import sqlglot
from sqlglot import exp

FORBIDDEN_FUNCTIONS: Set[str] = {
    "read_csv", "read_csv_auto", "read_parquet", "read_json", "read_json_auto",
    "read_text", "read_blob", "scan_csv", "scan_parquet", "glob",
    "system", "shell", "copy", "export_database", "import_database",
    "attach", "detach", "load", "install", "pragma"
}

FORBIDDEN_EXPRESSIONS = (
    exp.Insert, exp.Update, exp.Delete, exp.Create, exp.Drop, exp.Alter,
    exp.Command, exp.Pragma, exp.Transaction, exp.Commit, exp.Rollback,
    exp.Copy
)

class SQLSecurityValidationError(Exception):
    pass

class SQLValidator:
    @staticmethod
    def validate_and_sanitize(sql: str, allowed_table_name: str) -> str:
        """
        Validates that:
        1. The query is valid SQL.
        2. Exactly one statement is present.
        3. The statement is strictly read-only (SELECT / Union / CTEs of SELECT).
        4. The query only accesses the allowed dataset table.
        5. No filesystem or system inspection functions are called.
        """
        clean_sql = sql.strip().rstrip(";")
        if not clean_sql:
            raise SQLSecurityValidationError("Empty SQL query provided.")

        try:
            parsed_statements = sqlglot.parse(clean_sql, read="duckdb")
        except Exception as e:
            raise SQLSecurityValidationError(f"Invalid SQL syntax: {str(e)}")

        if len(parsed_statements) != 1:
            raise SQLSecurityValidationError("Multiple SQL statements are not permitted.")

        stmt = parsed_statements[0]
        if stmt is None:
            raise SQLSecurityValidationError("Could not parse SQL statement.")

        # Check for forbidden statement types
        if isinstance(stmt, FORBIDDEN_EXPRESSIONS):
            raise SQLSecurityValidationError("Only read-only SELECT statements are allowed.")

        # Root must be a Select or Union
        if not (isinstance(stmt, exp.Select) or isinstance(stmt, exp.Union)):
            raise SQLSecurityValidationError("Only SELECT queries are allowed.")

        # Check for forbidden function calls
        for func in stmt.find_all(exp.Anonymous):
            name = func.name.lower()
            if name in FORBIDDEN_FUNCTIONS:
                raise SQLSecurityValidationError(f"Forbidden function call detected: {name}()")

        for func in stmt.find_all(exp.Func):
            name = func.sql_name().lower() if hasattr(func, "sql_name") else func.key.lower()
            if name in FORBIDDEN_FUNCTIONS:
                raise SQLSecurityValidationError(f"Forbidden function call detected: {name}()")

        # Validate referenced tables (CTEs defined in query are allowed; any external table must match allowed_table_name)
        cte_aliases: Set[str] = set()
        for cte in stmt.find_all(exp.CTE):
            alias = cte.alias_or_name
            if alias:
                cte_aliases.add(alias.lower())

        for table in stmt.find_all(exp.Table):
            t_name = table.name.lower()
            if t_name in cte_aliases:
                continue
            # Also check if schema or catalog are accessed
            if table.db or table.catalog:
                raise SQLSecurityValidationError("Cross-database or schema qualification is not permitted.")
            if t_name != allowed_table_name.lower():
                raise SQLSecurityValidationError(
                    f"Access to table '{t_name}' is forbidden. You can only query '{allowed_table_name}'."
                )

        # Transpile back to clean DuckDB dialect
        try:
            sanitized_sql = stmt.sql(dialect="duckdb")
            return sanitized_sql
        except Exception:
            return clean_sql
