import os
import pathlib
from flask import Flask, jsonify, send_file, send_from_directory

BASE_DIR = pathlib.Path(__file__).resolve().parent.parent
EBOOKS_DIR = (BASE_DIR / "ebooks").resolve()
WEB_DIR = (BASE_DIR / "web").resolve()

app = Flask(__name__, static_folder=str(WEB_DIR), static_url_path="")


def safe_resolve_book(filename: str) -> pathlib.Path:
    # Disallow path traversal.
    filename = os.path.basename(filename)
    target = (EBOOKS_DIR / filename).resolve()
    if EBOOKS_DIR not in target.parents:
        raise FileNotFoundError("Invalid path")
    return target


def book_title(filename: str) -> str:
    stem = pathlib.Path(filename).stem
    return stem.replace("_", " ").strip()


@app.get("/api/books")
def api_books():
    EBOOKS_DIR.mkdir(parents=True, exist_ok=True)
    books = []
    for p in sorted(EBOOKS_DIR.iterdir()):
        if not p.is_file():
            continue
        ext = p.suffix.lower().lstrip(".")
        if ext not in {"pdf", "txt"}:
            continue
        books.append(
            {
                "filename": p.name,
                "title": book_title(p.name),
                "type": ext,
                "size": p.stat().st_size,
            }
        )
    return jsonify({"books": books})


@app.get("/api/books/<path:filename>")
def api_book_file(filename):
    try:
        target = safe_resolve_book(filename)
    except FileNotFoundError:
        return jsonify({"error": "not_found"}), 404

    if not target.exists() or not target.is_file():
        return jsonify({"error": "not_found"}), 404

    ext = target.suffix.lower()
    # send_file will infer mimetype for common types.
    return send_file(str(target), conditional=True)


@app.get("/api/books/<path:filename>/metadata")
def api_book_metadata(filename):
    try:
        target = safe_resolve_book(filename)
    except FileNotFoundError:
        return jsonify({"error": "not_found"}), 404

    if not target.exists() or not target.is_file():
        return jsonify({"error": "not_found"}), 404

    ext = target.suffix.lower().lstrip(".")
    meta = {
        "filename": target.name,
        "title": book_title(target.name),
        "type": ext,
        "size": target.stat().st_size,
    }

    # For TXT: also include a naive "pageSize" for front-end pagination.
    if ext == "txt":
        meta["txtConfig"] = {"charsPerPage": 1800}

    return jsonify(meta)


@app.get("/")
def index():
    return send_from_directory(str(WEB_DIR), "index.html")


@app.get("/health")
def health():
    return jsonify({"ok": True})


if __name__ == "__main__":
    # Development server
    app.run(host="127.0.0.1", port=5000, debug=True)

