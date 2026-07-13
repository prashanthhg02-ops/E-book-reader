(() => {
  const elBooks = document.getElementById('books');
  const elTitle = document.getElementById('bookTitle');
  const elMeta = document.getElementById('bookMeta');
  const elStatus = document.getElementById('status');
  const elEmpty = document.getElementById('emptyState');

  const elPrev = document.getElementById('prevBtn');
  const elNext = document.getElementById('nextBtn');
  const elPageInput = document.getElementById('pageInput');
  const elPageTotal = document.getElementById('pageTotal');

  const elPdfWrap = document.getElementById('pdfWrap');
  const elTxtWrap = document.getElementById('txtWrap');

  const elPdfCanvas = document.getElementById('pdfCanvas');
  const elTxtContent = document.getElementById('txtContent');

  const refreshBtn = document.getElementById('refreshBtn');

  const state = {
    books: [],
    active: null,
    kind: null, // pdf | txt

    // pdf
    pdfDoc: null,
    pdfPageNum: 1,
    pdfPageCount: 0,

    // txt
    txt: '',
    txtConfig: { charsPerPage: 1800 },
    txtPageNum: 1,
    txtPageCount: 0,
  };

  function setStatus(msg){ elStatus.textContent = msg; }

  function formatBytes(bytes){
    if (!Number.isFinite(bytes)) return '';
    const units = ['B','KB','MB','GB'];
    let i=0, val=bytes;
    while (val>=1024 && i<units.length-1){ val/=1024; i++; }
    return `${val.toFixed(val>=10||i===0?0:1)} ${units[i]}`;
  }

  function clearActiveUI(){
    elPdfWrap.hidden = true;
    elTxtWrap.hidden = true;
    elEmpty.hidden = false;
  }

  function showPdfUI(){
    elEmpty.hidden = true;
    elTxtWrap.hidden = true;
    elPdfWrap.hidden = false;
  }

  function showTxtUI(){
    elEmpty.hidden = true;
    elPdfWrap.hidden = true;
    elTxtWrap.hidden = false;
  }

  async function fetchJSON(url){
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function loadBooks(){
    setStatus('Loading library...');
    const data = await fetchJSON('/api/books');
    state.books = data.books || [];

    elBooks.innerHTML = '';
    if (state.books.length === 0){
      clearActiveUI();
      elTitle.textContent = 'Select a book';
      elMeta.textContent = '';
      state.active = null;
      return;
    }

    for (const b of state.books){
      const div = document.createElement('div');
      div.className = 'book';
      div.dataset.filename = b.filename;
      div.innerHTML = `
        <div class='bookTitle'>${escapeHtml(b.title)}</div>
        <div class='bookSub'><span>${b.type.toUpperCase()}</span><span>${formatBytes(b.size)}</span></div>
      `;
      div.addEventListener('click', () => selectBook(b.filename));
      elBooks.appendChild(div);
    }

    setStatus('Library ready.');
  }

  function escapeHtml(str){
    return String(str).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'<','>':'>','"':'"'}[c]));
  }

  async function selectBook(filename){
    const meta = await fetchJSON(`/api/books/${encodeURIComponent(filename)}/metadata`);
    state.active = filename;
    state.kind = meta.type;

    // reset
    state.pdfDoc = null;
    state.pdfPageNum = 1;
    state.pdfPageCount = 0;

    state.txt = '';
    state.txtConfig = meta.txtConfig || state.txtConfig;
    state.txtPageNum = 1;
    state.txtPageCount = 0;

    // UI selection highlight
    for (const node of elBooks.querySelectorAll('.book')){
      node.classList.toggle('book--active', node.dataset.filename === filename);
    }

    elTitle.textContent = meta.title;
    elMeta.textContent = `${meta.type.toUpperCase()} • ${formatBytes(meta.size)}`;

    // toolbar
    elPageInput.value = '1';
    elPageTotal.textContent = '—';

    if (state.kind === 'pdf'){
      await loadPdf(filename);
    } else if (state.kind === 'txt'){
      await loadTxt(filename);
    } else {
      clearActiveUI();
      setStatus('Unsupported file type.');
    }
  }

  function setNavEnabled(enabled){
    elPrev.disabled = !enabled;
    elNext.disabled = !enabled;
    elPageInput.disabled = !enabled;
  }

  function clampPage(n, min, max){
    return Math.max(min, Math.min(max, n));
  }

  function updatePageUI(current, total){
    elPageInput.value = String(current);
    elPageTotal.textContent = `/ ${total}`;
  }

  async function loadPdf(filename){
    showPdfUI();
    setNavEnabled(true);
    setStatus('Loading PDF...');

    // pdf.js global
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.js';

    const url = `/api/books/${encodeURIComponent(filename)}`;
    const loadingTask = pdfjsLib.getDocument({ url });
    state.pdfDoc = await loadingTask.promise;
    state.pdfPageCount = state.pdfDoc.numPages;
    state.pdfPageNum = 1;

    updatePageUI(1, state.pdfPageCount);
    await renderPdfPage(1);
    setStatus('PDF ready.');
  }

  async function renderPdfPage(pageNum){
    setStatus(`Rendering page ${pageNum}...`);
    const page = await state.pdfDoc.getPage(pageNum);

    // Render at device scale for crispness
    const viewport = page.getViewport({ scale: 1.6 });
    const canvas = elPdfCanvas;
    const ctx = canvas.getContext('2d');

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    await page.render({ canvasContext: ctx, viewport }).promise;
    setStatus(`Page ${pageNum} / ${state.pdfPageCount}`);
  }

  async function loadTxt(filename){
    showTxtUI();
    setNavEnabled(true);
    setStatus('Loading TXT...');

    const res = await fetch(`/api/books/${encodeURIComponent(filename)}`);
    if (!res.ok) throw new Error(`Failed to fetch TXT (${res.status})`);
    const text = await res.text();

    state.txt = text;
    state.txtConfig = state.txtConfig || { charsPerPage: 1800 };

    state.txtPageCount = Math.max(1, Math.ceil(state.txt.length / state.txtConfig.charsPerPage));
    state.txtPageNum = 1;
    updatePageUI(1, state.txtPageCount);

    renderTxtPage(1);
    setStatus('TXT ready.');
  }

  function renderTxtPage(pageNum){
    const { charsPerPage } = state.txtConfig;
    const start = (pageNum - 1) * charsPerPage;
    const end = start + charsPerPage;
    const chunk = state.txt.slice(start, end);

    // show title-like punctuation nicely
    elTxtContent.textContent = chunk;

    setStatus(`Page ${pageNum} / ${state.txtPageCount}`);
  }

  async function gotoPage(n){
    if (!state.kind) return;
    if (state.kind === 'pdf'){
      const target = clampPage(n, 1, state.pdfPageCount);
      if (target === state.pdfPageNum) return;
      state.pdfPageNum = target;
      updatePageUI(target, state.pdfPageCount);
      await renderPdfPage(target);
    } else if (state.kind === 'txt'){
      const target = clampPage(n, 1, state.txtPageCount);
      if (target === state.txtPageNum) return;
      state.txtPageNum = target;
      updatePageUI(target, state.txtPageCount);
      renderTxtPage(target);
    }
  }

  elPrev.addEventListener('click', () => {
    const n = Number(elPageInput.value || '1');
    gotoPage(n - 1).catch(err => setStatus(err.message));
  });

  elNext.addEventListener('click', () => {
    const n = Number(elPageInput.value || '1');
    gotoPage(n + 1).catch(err => setStatus(err.message));
  });

  elPageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter'){
      const n = Number(elPageInput.value || '1');
      gotoPage(n).catch(err => setStatus(err.message));
    }
  });

  refreshBtn.addEventListener('click', async () => {
    await loadBooks();
    setStatus('Refreshed.');
  });

  // initial
  clearActiveUI();
  setNavEnabled(false);
  loadBooks().catch(err => setStatus(err.message));
})();

