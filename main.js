(() => {
  const dictHint = document.getElementById('dictHint');
  if (dictHint) dictHint.textContent = 'Başlatılıyor…';

  const api = window.Kelimelik;
  if (!api) {
    const msg = 'Hata: solver_rules.js yüklenmedi (window.Kelimelik yok).';
    console.error(msg);
    if (dictHint) dictHint.textContent = msg;
    throw new Error(msg);
  }

  const boardSize = api.SIZE;
  const emptyBoard = api.emptyBoard;
  const displayLetter = api.displayLetter;

  const boardElement = document.getElementById('board');
  const rackInput = document.getElementById('rackInput');
  const rackTiles = document.getElementById('rackTiles');
  const btnClearRack = document.getElementById('btnClearRack');
  const letterBank = document.getElementById('letterBank');
  const selLabel = document.getElementById('selLabel');
  const cellInput = document.getElementById('cellInput');
  const btnClearCell = document.getElementById('btnClearCell');
  const btnSolve = document.getElementById('btnSolve');
  const btnClearBoard = document.getElementById('btnClearBoard');
  const btnUndo = document.getElementById('btnUndo');
  const btnRedo = document.getElementById('btnRedo');
  const btnExport = document.getElementById('btnExport');
  const btnImport = document.getElementById('btnImport');
  const movesList = document.getElementById('movesList');
  const messageEl = document.getElementById('message');
  const btnConfirmMove = document.getElementById('btnConfirmMove');
  const btnClearPreview = document.getElementById('btnClearPreview');
  const committed = emptyBoard();
  const preview = emptyBoard(); // only preview letters
  let rack = [];
  let selected = { r: null, c: null };
  let writeDir = 'H'; // H=right, V=down
  let selectedMove = null;

  let DICT_WORDS = null; // string[]
  let DICT_INDEX = null; // Map<char, number[]>
  let DICT_SET = null; // Set<string>

  const STORAGE_KEY = 'kelimelik-assistant-state-v1';
  const undoStack = [];
  const redoStack = [];

  if (dictHint) dictHint.textContent = 'Hazır.';

  function setMessage(text) {
    if (messageEl) messageEl.textContent = text || '';
  }

  function boardLetterAt(r, c) {
    const t = committed[r]?.[c];
    return t?.letter ? String(t.letter).toUpperCase() : '';
  }

  function previewLetterAt(r, c) {
    const t = preview[r]?.[c];
    return t?.letter ? String(t.letter).toUpperCase() : '';
  }

  function clearPreview() {
    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize; c++) preview[r][c] = null;
    }
    selectedMove = null;
    if (btnConfirmMove) btnConfirmMove.disabled = true;
    if (btnClearPreview) btnClearPreview.disabled = true;
  }

  function snapshotState() {
    const board = [];
    for (let r = 0; r < boardSize; r++) {
      const row = [];
      for (let c = 0; c < boardSize; c++) row.push(boardLetterAt(r, c) || '');
      board.push(row);
    }
    return {
      board,
      rackText: rackInput ? rackInput.value || '' : '',
      selected,
      writeDir,
    };
  }

  function applyState(state) {
    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize; c++) {
        const ch = state?.board?.[r]?.[c] || '';
        committed[r][c] = ch ? { letter: ch } : null;
      }
    }
    clearPreview();
    if (rackInput) rackInput.value = state?.rackText || '';
    setRackFromInput();
    selected = state?.selected && Number.isFinite(state.selected.r) && Number.isFinite(state.selected.c)
      ? { r: state.selected.r, c: state.selected.c }
      : { r: null, c: null };
    writeDir = state?.writeDir === 'V' ? 'V' : 'H';
    if (selLabel) {
      selLabel.textContent =
        selected.r != null && selected.c != null
          ? `Seçili: ${selected.r},${selected.c} (${writeDir === 'H' ? '→' : '↓'})`
          : 'Kare seçin';
    }
    renderBoard();
  }

  function updateUndoRedoUI() {
    if (btnUndo) btnUndo.disabled = undoStack.length === 0;
    if (btnRedo) btnRedo.disabled = redoStack.length === 0;
  }

  function pushUndo() {
    undoStack.push(snapshotState());
    if (undoStack.length > 50) undoStack.shift();
    redoStack.length = 0;
    updateUndoRedoUI();
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshotState()));
    } catch (_) {}
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      applyState(JSON.parse(raw));
      return true;
    } catch (_) {
      return false;
    }
  }

  function commitPreview() {
    let any = false;
    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize; c++) {
        const ch = previewLetterAt(r, c);
        if (!ch) continue;
        if (!boardLetterAt(r, c)) {
          committed[r][c] = { letter: ch };
          any = true;
        }
        preview[r][c] = null;
      }
    }
    selectedMove = null;
    if (btnConfirmMove) btnConfirmMove.disabled = true;
    if (btnClearPreview) btnClearPreview.disabled = true;
    renderBoard();
    saveToStorage();
    return any;
  }

  function hasAnyLetter() {
    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize; c++) {
        if (boardLetterAt(r, c)) return true;
      }
    }
    return false;
  }

  function buildDictIndex(words) {
    const idx = new Map();
    for (let wi = 0; wi < words.length; wi++) {
      const w = words[wi];
      // unique letters per word to reduce duplicates
      const seen = new Set();
      for (let i = 0; i < w.length; i++) {
        const ch = w[i];
        if (seen.has(ch)) continue;
        seen.add(ch);
        if (!idx.has(ch)) idx.set(ch, []);
        idx.get(ch).push(wi);
      }
    }
    return idx;
  }

  function buildDictSet(words) {
    // Fast membership test for "is this word in dictionary?"
    return new Set(words);
  }

  function ensureDictLoaderUI() {
    if (!dictHint) return;
    if (document.getElementById('dictFileInput')) return;

    const wrap = document.createElement('div');
    wrap.style.marginTop = '8px';
    wrap.style.display = 'flex';
    wrap.style.gap = '8px';
    wrap.style.justifyContent = 'center';
    wrap.style.flexWrap = 'wrap';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'dictPickBtn';
    btn.textContent = 'Sözlük dosyasını seç (kelimeler.json)';

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.id = 'dictFileInput';
    input.style.display = 'none';

    btn.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        if (dictHint) dictHint.textContent = 'Sözlük okunuyor…';
        const text = await f.text();
        const words = JSON.parse(text);
        if (!Array.isArray(words)) throw new Error('Sözlük JSON array değil.');
        DICT_WORDS = words;
        DICT_INDEX = buildDictIndex(words);
        DICT_SET = buildDictSet(words);
        if (dictHint) dictHint.textContent = `Sözlük hazır (${words.length.toLocaleString('tr-TR')} kelime).`;
      } catch (e) {
        console.error(e);
        if (dictHint) dictHint.textContent = `Sözlük yüklenemedi: ${e?.message || e}`;
      }
    });

    wrap.appendChild(btn);
    wrap.appendChild(input);
    dictHint.insertAdjacentElement('afterend', wrap);
  }

  async function loadDictionary() {
    if (DICT_WORDS) return true;
    if (dictHint) dictHint.textContent = 'Sözlük yükleniyor…';
    try {
      // file:// altında fetch engellenebilir; başarısızsa file picker'a düşeceğiz
      const res = await fetch('kelimeler.json', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const words = await res.json();
      if (!Array.isArray(words)) throw new Error('Sözlük JSON array değil.');
      DICT_WORDS = words;
      DICT_INDEX = buildDictIndex(words);
      DICT_SET = buildDictSet(words);
      if (dictHint) dictHint.textContent = `Sözlük hazır (${words.length.toLocaleString('tr-TR')} kelime).`;
      return true;
    } catch (e) {
      console.warn('Sözlük fetch ile yüklenemedi, dosya seçimi gerekecek.', e);
      if (dictHint) dictHint.textContent = 'Sözlük yüklenemedi. Aşağıdan kelimeler.json seç.';
      ensureDictLoaderUI();
      return false;
    }
  }

  function normalizeRackText(text) {
    return (text || '')
      .toUpperCase()
      .replace(/\s+/g, '')
      .slice(0, 7);
  }

  function setRackFromInput() {
    if (!rackInput) return;
    const t = normalizeRackText(rackInput.value);
    rackInput.value = t;
    rack = t.split('');
    renderRack();
  }

  function renderRack() {
    if (!rackTiles) return;
    rackTiles.innerHTML = '';
    if (rack.length === 0) {
      const empty = document.createElement('div');
      empty.style.opacity = '0.7';
      empty.style.fontSize = '13px';
      empty.textContent = 'Taşlar burada görünecek. Üstteki kutuya harfleri yazın (örn: KELİM??).';
      rackTiles.appendChild(empty);
      return;
    }
    rack.forEach((ch, idx) => {
      const el = document.createElement('div');
      el.className = `tile${ch === '?' ? ' blank' : ''}`;
      el.textContent = ch;
      el.draggable = true;
      el.dataset.index = String(idx);
      el.dataset.letter = ch;
      el.setAttribute('role', 'listitem');
      el.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({ idx, ch }));
      });
      rackTiles.appendChild(el);
    });
  }

  function renderLetterBank() {
    if (!letterBank) return;
    letterBank.innerHTML = '';
    const letters = ['A','B','C','Ç','D','E','F','G','Ğ','H','I','İ','J','K','L','M','N','O','Ö','P','R','S','Ş','T','U','Ü','V','Y','Z','?'];
    letters.forEach((ch) => {
      const el = document.createElement('div');
      el.className = `tile${ch === '?' ? ' blank' : ''}`;
      el.textContent = ch;
      el.draggable = true;
      el.dataset.letter = ch;
      el.setAttribute('role', 'listitem');
      el.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', JSON.stringify({ idx: -1, ch }));
      });
      letterBank.appendChild(el);
    });
  }

// Board'u render et
  function renderBoard() {
    if (!boardElement) return;
    boardElement.innerHTML = '';
    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize; c++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.row = r;
        cell.dataset.col = c;
        const tile = committed[r][c];
        const committedText = displayLetter(tile);
        if (committedText) {
          cell.textContent = committedText;
        } else {
          const pv = previewLetterAt(r, c);
          if (pv) {
            cell.textContent = pv;
            cell.classList.add('preview');
          } else {
            cell.textContent = '';
          }
        }

        // Drag & drop hedefi
        cell.addEventListener('dragover', (e) => {
          e.preventDefault();
          cell.classList.add('drag-over');
        });
        cell.addEventListener('dragleave', () => {
          cell.classList.remove('drag-over');
        });
        cell.addEventListener('drop', (e) => {
          e.preventDefault();
          cell.classList.remove('drag-over');
          try {
            const raw = e.dataTransfer.getData('text/plain');
            const data = JSON.parse(raw);
            const fromIdx = data?.idx;
            const ch = String(data?.ch || '');
            if (!Number.isInteger(fromIdx) || !ch) return;
            placeLetterDirect(r, c, ch);
            // idx >= 0 ise raftan geldi; idx -1 ise bankadan (kopya) geldi
            if (fromIdx >= 0) {
              rack.splice(fromIdx, 1);
              renderRack();
            }
          } catch (_) {
            // ignore malformed drags
          }
        });

        cell.addEventListener('click', () => {
          selectCell(r, c);
        });
        boardElement.appendChild(cell);
      }
    }
  }

  function selectCell(r, c) {
    selected = { r, c };
    if (selLabel) selLabel.textContent = `Seçili: ${r},${c} (${writeDir === 'H' ? '→' : '↓'})`;
    if (cellInput) {
      cellInput.value = '';
      cellInput.focus();
    }
  }

  function placeLetterDirect(r, c, ch) {
    const letter = String(ch).toUpperCase();
    if (!letter || letter.length !== 1) return;
    pushUndo();
    committed[r][c] = { letter };
    preview[r][c] = null;
    renderBoard();
    saveToStorage();
  }

  function clearCell(r, c) {
    pushUndo();
    committed[r][c] = null;
    preview[r][c] = null;
    renderBoard();
    saveToStorage();
  }

  function cleanTextForBoard(text) {
    return String(text || '')
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[^A-ZÇĞİÖŞÜ\?]/g, '');
  }

  function placeTextFromSelection(text) {
    const t = cleanTextForBoard(text);
    if (!t) return;
    if (selected.r == null || selected.c == null) return;

    let r = selected.r;
    let c = selected.c;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (r < 0 || r >= boardSize || c < 0 || c >= boardSize) break;
      placeLetterDirect(r, c, ch);
      if (writeDir === 'H') c += 1;
      else r += 1;
    }

    // imleci bir sonraki hücreye taşı
    selected = { r, c };
    if (selLabel) selLabel.textContent = `Seçili: ${Math.min(r, boardSize - 1)},${Math.min(c, boardSize - 1)} (${writeDir === 'H' ? '→' : '↓'})`;
  }

  // İlk render
  renderBoard();
  renderRack();
  setRackFromInput();
  renderLetterBank();
  loadDictionary();
  loadFromStorage();
  updateUndoRedoUI();

  // Klavye ile hızlı yazma: kare seç -> yaz -> Enter
  if (cellInput) {
    cellInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        placeTextFromSelection(cellInput.value);
        cellInput.value = '';
      } else if (e.key === 'Tab') {
        e.preventDefault();
        writeDir = writeDir === 'H' ? 'V' : 'H';
        if (selLabel && selected.r != null && selected.c != null) {
          selLabel.textContent = `Seçili: ${selected.r},${selected.c} (${writeDir === 'H' ? '→' : '↓'})`;
        }
      }
    });
  }

  if (btnClearCell) {
    btnClearCell.addEventListener('click', () => {
      if (selected.r == null || selected.c == null) return;
      clearCell(selected.r, selected.c);
    });
  }

  if (btnClearBoard) {
    btnClearBoard.addEventListener('click', () => {
      pushUndo();
      for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) committed[r][c] = null;
      }
      renderBoard();
      setMessage('');
      if (movesList) movesList.innerHTML = '';
      saveToStorage();
    });
  }

  if (rackInput) {
    rackInput.addEventListener('input', setRackFromInput);
    rackInput.addEventListener('change', setRackFromInput);
  }
  if (btnClearRack) {
    btnClearRack.addEventListener('click', () => {
      rack = [];
      if (rackInput) rackInput.value = '';
      renderRack();
    });
  }

  function rackCountsFromText(text) {
    const t = normalizeRackText(text);
    const counts = new Map();
    for (const ch of t) counts.set(ch, (counts.get(ch) || 0) + 1);
    return counts;
  }

  function canConsumeRackForWord(word, r0, c0, dir, rackCounts) {
    let usedNew = 0;
    const counts = new Map(rackCounts);
    for (let i = 0; i < word.length; i++) {
      const r = r0 + (dir === 'V' ? i : 0);
      const c = c0 + (dir === 'H' ? i : 0);
      const existing = boardLetterAt(r, c);
      const ch = word[i];
      if (existing) {
        if (existing !== ch) return null;
        continue;
      }
      // need from rack
      const have = counts.get(ch) || 0;
      if (have > 0) {
        counts.set(ch, have - 1);
        usedNew++;
        continue;
      }
      const jok = counts.get('?') || 0;
      if (jok > 0) {
        counts.set('?', jok - 1);
        usedNew++;
        continue;
      }
      return null;
    }
    return usedNew > 0 ? { usedNew } : null;
  }

  function dictHas(word) {
    if (!DICT_SET) return false;
    return DICT_SET.has(word);
  }

  function letterAtWithMove(r, c, move) {
    const existing = boardLetterAt(r, c);
    if (existing) return existing;
    // check if this cell is covered by move
    if (move.dir === 'H') {
      if (r !== move.r) return '';
      const i = c - move.c;
      if (i < 0 || i >= move.word.length) return '';
      return move.word[i];
    }
    // V
    if (c !== move.c) return '';
    const i = r - move.r;
    if (i < 0 || i >= move.word.length) return '';
    return move.word[i];
  }

  function buildWordAt(r, c, dir, move) {
    // Build full word through (r,c) in direction dir, using existing+move letters.
    const dr = dir === 'V' ? 1 : 0;
    const dc = dir === 'H' ? 1 : 0;

    let r0 = r;
    let c0 = c;
    while (true) {
      const rr = r0 - dr;
      const cc = c0 - dc;
      if (rr < 0 || rr >= boardSize || cc < 0 || cc >= boardSize) break;
      const ch = letterAtWithMove(rr, cc, move);
      if (!ch) break;
      r0 = rr;
      c0 = cc;
    }

    let out = '';
    let rr = r0;
    let cc = c0;
    while (rr >= 0 && rr < boardSize && cc >= 0 && cc < boardSize) {
      const ch = letterAtWithMove(rr, cc, move);
      if (!ch) break;
      out += ch;
      rr += dr;
      cc += dc;
    }
    return out;
  }

  function isMoveDictionaryValid(move) {
    // main word must be dictionary word (it is), but we also validate cross words created by new tiles
    if (!dictHas(move.word)) return false;

    for (let i = 0; i < move.word.length; i++) {
      const r = move.r + (move.dir === 'V' ? i : 0);
      const c = move.c + (move.dir === 'H' ? i : 0);
      const existing = boardLetterAt(r, c);
      if (existing) continue; // not a new tile => doesn't create a new cross word by itself

      const crossDir = move.dir === 'H' ? 'V' : 'H';
      const crossWord = buildWordAt(r, c, crossDir, move);
      if (crossWord.length >= 2 && !dictHas(crossWord)) return false;
    }

    return true;
  }

  function hasNeighborLetter(r, c) {
    return (
      (r > 0 && boardLetterAt(r - 1, c)) ||
      (r < boardSize - 1 && boardLetterAt(r + 1, c)) ||
      (c > 0 && boardLetterAt(r, c - 1)) ||
      (c < boardSize - 1 && boardLetterAt(r, c + 1))
    );
  }

  function wordHasConnection(word, r0, c0, dir) {
    // require overlap with existing or adjacency to existing
    for (let i = 0; i < word.length; i++) {
      const r = r0 + (dir === 'V' ? i : 0);
      const c = c0 + (dir === 'H' ? i : 0);
      const existing = boardLetterAt(r, c);
      if (existing) return true;
      if (hasNeighborLetter(r, c)) return true;
    }
    return false;
  }

  function blockedBySideLetters(word, r0, c0, dir) {
    // ensure no letter immediately before/after in same direction
    const beforeR = r0 - (dir === 'V' ? 1 : 0);
    const beforeC = c0 - (dir === 'H' ? 1 : 0);
    const afterR = r0 + (dir === 'V' ? word.length : 0);
    const afterC = c0 + (dir === 'H' ? word.length : 0);
    if (beforeR >= 0 && beforeC >= 0 && beforeR < boardSize && beforeC < boardSize) {
      if (boardLetterAt(beforeR, beforeC)) return true;
    }
    if (afterR >= 0 && afterC >= 0 && afterR < boardSize && afterC < boardSize) {
      if (boardLetterAt(afterR, afterC)) return true;
    }
    return false;
  }

  function listExistingCells() {
    const cells = [];
    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize; c++) {
        const ch = boardLetterAt(r, c);
        if (ch) cells.push({ r, c, ch });
      }
    }
    return cells;
  }

  function findMoves(words, index, rackText, limit = 50) {
    const rackCounts = rackCountsFromText(rackText);
    const existing = listExistingCells();
    const results = [];

    if (existing.length === 0) {
      // very simple: place any word that fits through center with rack
      const center = 7;
      for (let wi = 0; wi < words.length && results.length < limit; wi++) {
        const w = words[wi];
        if (w.length < 2 || w.length > boardSize) continue;
        const r0 = center;
        const c0 = center - Math.floor(w.length / 2);
        if (c0 < 0 || c0 + w.length > boardSize) continue;
        if (blockedBySideLetters(w, r0, c0, 'H')) continue;
        const ok = canConsumeRackForWord(w, r0, c0, 'H', rackCounts);
        if (!ok) continue;
        results.push({ word: w, r: r0, c: c0, dir: 'H', used: ok.usedNew });
      }
      return results;
    }

    // overlap-based search
    const seen = new Set();
    for (const cell of existing) {
      const list = index.get(cell.ch) || [];
      for (const wi of list) {
        const w = words[wi];
        if (w.length < 2 || w.length > boardSize) continue;
        // find occurrences of that letter
        for (let i = 0; i < w.length; i++) {
          if (w[i] !== cell.ch) continue;
          // horizontal placement
          {
            const r0 = cell.r;
            const c0 = cell.c - i;
            if (c0 >= 0 && c0 + w.length <= boardSize) {
              const key = `H:${r0}:${c0}:${w}`;
              if (!seen.has(key) && !blockedBySideLetters(w, r0, c0, 'H') && wordHasConnection(w, r0, c0, 'H')) {
                const ok = canConsumeRackForWord(w, r0, c0, 'H', rackCounts);
                if (ok && isMoveDictionaryValid({ word: w, r: r0, c: c0, dir: 'H' })) {
                  seen.add(key);
                  results.push({ word: w, r: r0, c: c0, dir: 'H', used: ok.usedNew });
                }
              }
            }
          }
          // vertical placement
          {
            const r0 = cell.r - i;
            const c0 = cell.c;
            if (r0 >= 0 && r0 + w.length <= boardSize) {
              const key = `V:${r0}:${c0}:${w}`;
              if (!seen.has(key) && !blockedBySideLetters(w, r0, c0, 'V') && wordHasConnection(w, r0, c0, 'V')) {
                const ok = canConsumeRackForWord(w, r0, c0, 'V', rackCounts);
                if (ok && isMoveDictionaryValid({ word: w, r: r0, c: c0, dir: 'V' })) {
                  seen.add(key);
                  results.push({ word: w, r: r0, c: c0, dir: 'V', used: ok.usedNew });
                }
              }
            }
          }
        }
      }
      if (results.length >= limit * 3) break; // cap work
    }

    // 1) En uzun kelime önce
    // 2) Aynı uzunlukta daha az yeni taş kullanan önce
    // 3) Sonra alfabetik
    results.sort((a, b) => b.word.length - a.word.length || a.used - b.used || a.word.localeCompare(b.word, 'tr'));
    return results.slice(0, limit);
  }

  function renderMoves(moves) {
    if (!movesList) return;
    movesList.innerHTML = '';
    if (!moves || moves.length === 0) {
      movesList.textContent = 'Hamle bulunamadı.';
      return;
    }
    let firstMove = null;
    for (const m of moves) {
      if (!firstMove) firstMove = m;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.style.display = 'block';
      btn.style.width = '100%';
      btn.style.textAlign = 'left';
      btn.style.padding = '8px 10px';
      btn.style.margin = '6px 0';
      btn.textContent = `${m.word}  —  ${m.dir === 'H' ? '→' : '↓'}  (${m.r},${m.c})`;
      btn.addEventListener('click', () => {
        // Önceki onaylanmamış önizleme temizlenir, yenisi basılır
        clearPreview();
        selectedMove = m;
        for (let i = 0; i < m.word.length; i++) {
          const r = m.r + (m.dir === 'V' ? i : 0);
          const c = m.c + (m.dir === 'H' ? i : 0);
          if (!boardLetterAt(r, c)) preview[r][c] = { letter: m.word[i] };
        }
        if (btnConfirmMove) btnConfirmMove.disabled = false;
        if (btnClearPreview) btnClearPreview.disabled = false;
        renderBoard();
      });
      movesList.appendChild(btn);
    }

    // Kullanım kolaylığı: ilk öneriyi otomatik seç/önizle
    if (firstMove) {
      clearPreview();
      selectedMove = firstMove;
      for (let i = 0; i < firstMove.word.length; i++) {
        const r = firstMove.r + (firstMove.dir === 'V' ? i : 0);
        const c = firstMove.c + (firstMove.dir === 'H' ? i : 0);
        if (!boardLetterAt(r, c)) preview[r][c] = { letter: firstMove.word[i] };
      }
      if (btnConfirmMove) btnConfirmMove.disabled = false;
      if (btnClearPreview) btnClearPreview.disabled = false;
      renderBoard();
      setMessage('İlk öneri önizlendi. Onayla veya başka öneri seç.');
    }
  }

  if (btnSolve) {
    btnSolve.addEventListener('click', async () => {
      setMessage('');
      clearPreview();
      if (!rackInput) {
        setMessage('Rack input bulunamadı.');
        return;
      }
      const ok = await loadDictionary();
      if (!ok) {
        setMessage('Sözlük yüklenmeden hamle bulunamaz. Yukarıdan kelimeler.json seç.');
        return;
      }
      const rackText = rackInput.value || '';
      const moves = findMoves(DICT_WORDS, DICT_INDEX, rackText, 60);
      renderMoves(moves);
      setMessage(moves.length ? `${moves.length} hamle bulundu.` : 'Hamle bulunamadı.');
    });
  }

  if (btnClearPreview) {
    btnClearPreview.addEventListener('click', () => {
      clearPreview();
      renderBoard();
    });
  }

  if (btnConfirmMove) {
    btnConfirmMove.addEventListener('click', () => {
      pushUndo();
      const any = commitPreview();
      if (!any) setMessage('Onaylanacak önizleme yok.');
      // Yeni tur için rack'i her durumda temizle (refresh gerektirmesin)
      rack = [];
      if (rackInput) rackInput.value = '';
      setRackFromInput(); // renderRack() dahil
      saveToStorage();
    });
  }

  if (btnUndo) {
    btnUndo.addEventListener('click', () => {
      const prev = undoStack.pop();
      if (!prev) return;
      redoStack.push(snapshotState());
      applyState(prev);
      updateUndoRedoUI();
      saveToStorage();
    });
  }

  if (btnRedo) {
    btnRedo.addEventListener('click', () => {
      const next = redoStack.pop();
      if (!next) return;
      undoStack.push(snapshotState());
      applyState(next);
      updateUndoRedoUI();
      saveToStorage();
    });
  }

  if (btnExport) {
    btnExport.addEventListener('click', async () => {
      const data = JSON.stringify(snapshotState());
      try {
        await navigator.clipboard.writeText(data);
        setMessage('Durum panoya kopyalandı.');
      } catch (_) {
        prompt('Kopyalamak için Ctrl+C:', data);
      }
    });
  }

  if (btnImport) {
    btnImport.addEventListener('click', () => {
      const raw = prompt('İçe aktarılacak JSON:', '');
      if (!raw) return;
      try {
        const state = JSON.parse(raw);
        pushUndo();
        applyState(state);
        updateUndoRedoUI();
        saveToStorage();
        setMessage('Durum içe aktarıldı.');
      } catch (e) {
        setMessage(`İçe aktarma hatası: ${e?.message || e}`);
      }
    });
  }

})();