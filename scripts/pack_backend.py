import os
import zipfile

def pack_backend(output_zip: str = "backend_source.zip"):
    backend_dir = os.path.abspath("backend")
    exclude_dirs = {"__pycache__", ".pytest_cache", ".git", "venv", ".venv", "storage"}
    
    with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(backend_dir):
            # filter dirs in place
            dirs[:] = [d for d in dirs if d not in exclude_dirs and not d.startswith(".")]
            for file in files:
                lower = file.lower()
                if (
                    lower.endswith((".pyc", ".db", ".sqlite", ".sqlite3", ".parquet", ".zip", ".tar.gz", ".key", ".pem"))
                    or lower.startswith(".env")
                    or lower == ".ds_store"
                ):
                    continue
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, backend_dir)
                zipf.write(file_path, rel_path)
    
    print(f"Packed {output_zip} successfully: {os.path.getsize(output_zip)} bytes")

if __name__ == "__main__":
    pack_backend()
