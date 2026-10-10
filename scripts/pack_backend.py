import os
import zipfile

def pack_backend(output_zip: str = "backend_source.zip"):
    backend_dir = os.path.abspath("backend")
    exclude_patterns = ["__pycache__", ".pytest_cache", ".git", "venv", ".venv", ".db", "storage", ".DS_Store"]
    
    with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(backend_dir):
            # filter dirs in place
            dirs[:] = [d for d in dirs if not any(p in d for p in exclude_patterns)]
            for file in files:
                if any(p in file for p in exclude_patterns):
                    continue
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, backend_dir)
                zipf.write(file_path, rel_path)
    
    print(f"Packed {output_zip} successfully: {os.path.getsize(output_zip)} bytes")

if __name__ == "__main__":
    pack_backend()
