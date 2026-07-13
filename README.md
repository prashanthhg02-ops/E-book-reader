# E-book Reader (Python + HTML/CSS/JS)

A simple local e-book reader:
- **PDF**: rendered in-browser using **pdf.js**
- **TXT**: paginated client-side

## Project structure
- `server/app.py` – Flask backend (lists books from `ebooks/` and serves files)
- `web/` – Frontend (UI + reader)
- `ebooks/` – Put your `*.pdf` and/or `*.txt` here

## Run
1. Create a virtual environment (recommended):
   ```bat
   python -m venv .venv
   .venv\Scripts\activate
   ```

2. Install dependencies:
   ```bat
   pip install -r server/requirements.txt
   ```

3. Start server:
   ```bat
   python server\app.py
   ```

4. Open:
   - http://127.0.0.1:5000

## Add books
- Copy files into:
  - `ebooks/yourbook.pdf`
  - `ebooks/yourbook.txt`

Then click **Refresh** in the UI.

