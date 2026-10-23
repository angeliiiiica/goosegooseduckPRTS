/* PRTS — detective board for Goose Goose Duck meetings. */
(() => {
  'use strict';

  // ======================================================================
  // utils & constants
  // ======================================================================
  const $ = (s, el = document) => el.querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';
  const FONT = 'Segoe UI, Microsoft YaHei, PingFang SC, Noto Sans SC, system-ui, sans-serif';
  const { t, tn } = GGDI18n;
  const uid = () => Math.random().toString(36).slice(2, 10);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const abs = (p) => new URL(p, location.href).href;

  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function svgText(parent, text, x, y, size, fill, weight) {
    const t = svgEl('text', {
      x, y, 'text-anchor': 'middle', 'font-family': FONT, 'font-size': size, 'font-weight': weight || 600,
      fill, stroke: '#05080c', 'stroke-width': size * 0.3, 'stroke-linejoin': 'round', 'paint-order': 'stroke',
    }, parent);
    t.textContent = text;
    return t;
  }

  const MAPS = [
    // ids are stored in saved games; keep them stable when renaming
    // poi: key into GGDPoi.sets (poi.js); the map gets the points overlay and its panel
    { id: 'basement-wiki', name: 'Basement', src: 'maps/basement-wiki.jpg', poi: 'basement' },
    { id: 'basement', name: 'Basement (Darkout)', src: 'maps/basement-darkout.jpg' },
    { id: 'ancient-sands', name: 'Ancient Sands', src: 'maps/ancient-sands.jpg' },
    { id: 'goosechapel', name: 'Goosechapel (Prison Key)', src: 'maps/goosechapel-prison-key.jpg' },
    { id: 'goosechapel-sewer', name: 'Goosechapel (Sewer)', src: 'maps/goosechapel-sewer.png' },
    { id: 'goosechapel-cn', name: 'Goose Chapel (Chinese)', src: 'maps/goosechapel-cn.jpg' },
    { id: 'blank', name: 'Blank board', src: null, w: 1600, h: 1000 },
  ];
  // display labels come from i18n.js (tag.*, link.*, pin.*, status.*)
  const TAGS = [
    { id: 'unknown', color: '#8a94a6', key: '1' },
    { id: 'goose', color: '#4cd890', key: '2' },
    { id: 'cleared', color: '#4aa8ff', key: '3' },
    { id: 'sus', color: '#ffb340', key: '4' },
    { id: 'duck', color: '#ff4d5e', key: '5' },
    { id: 'neutral', color: '#b07cff', key: '6' },
  ];
  const tagOf = (id) => TAGS.find((x) => x.id === id) || TAGS[0];
  const LINKS = {
    with: { color: '#4cd890', arrow: false, dash: null },
    vouch: { color: '#4aa8ff', arrow: true, dash: null },
    accuse: { color: '#ff4d5e', arrow: true, dash: null },
    saw: { color: '#ffb340', arrow: true, dash: '10 6' },
    follow: { color: '#c7cbd4', arrow: true, dash: '3 6' },
    // killer → victim; thicker, with a ✕ mark at the middle so it never reads as "accuses"
    kill: { color: '#e5102f', arrow: true, dash: null, w: 1.7, mark: true },
  };
  const PIN_KINDS = {
    body: { color: '#ff4d5e' },
    event: { color: '#ffb340' },
  };
  const STATUSES = [{ id: 'alive' }, { id: 'dead' }, { id: 'ejected' }];
  // small inline icons for the roster's quick status buttons (currentColor)
  const STATUS_ICON = {
    alive: '<svg viewBox="0 0 12 12" width="10" height="10"><circle cx="6" cy="6" r="3.6" fill="currentColor"/></svg>',
    dead: '<svg viewBox="0 0 12 12" width="10" height="10"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"/></svg>',
    ejected: '<svg viewBox="0 0 12 12" width="10" height="10"><path d="M6 1.5L10.5 7h-9z" fill="currentColor"/><rect x="1.5" y="8.6" width="9" height="2" fill="currentColor"/></svg>',
  };
  // Event time: a rough phase, or a 30-second span of the round ('s0' = 0:00–0:30 … 's10' = 5:00+)
  const PHASES = ['early', 'mid', 'late'];
  const SPAN_SEC = 30, SPAN_N = 10;
  const SPANS = Array.from({ length: SPAN_N + 1 }, (_, i) => 's' + i);
  const clock = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  const isTimeKey = (k) => PHASES.includes(k) || SPANS.includes(k);
  function timeLabel(k) {
    if (PHASES.includes(k)) return t('time.' + k);
    if (!SPANS.includes(k)) return '';
    const i = +k.slice(1);
    return i >= SPAN_N ? clock(i * SPAN_SEC) + '+' : `${clock(i * SPAN_SEC)}–${clock((i + 1) * SPAN_SEC)}`;
  }
  /** Sort key on a rough 0–5 min scale; phases sit at the middle of their third. Unknown sorts last. */
  function timeSortKey(k) {
    if (PHASES.includes(k)) return { early: 50, mid: 150, late: 250 }[k];
    if (SPANS.includes(k)) return +k.slice(1) * SPAN_SEC + SPAN_SEC / 2;
    return Infinity;
  }
  // tools that work in the relationship-network view; the rest switch back to the map
  const NET_TOOLS = ['select', 'link', 'eraser'];
  const tagLabel = (id) => t('tag.' + tagOf(id).id);
  const linkLabel = (type) => t('link.' + (LINKS[type] ? type : 'with'));
  const pinLabel = (kind) => t('pin.' + (PIN_KINDS[kind] ? kind : 'body'));
  const statusLabel = (id) => t('status.' + id);
  // built-in map names are translated; custom map names are user data
  const mapName = (m) => (m.custom ? (m.sessionOnly ? t('map.sessionOnly', { name: m.name }) : m.name) : t('map.' + m.id));
  const COLORS = ['#ffffff', '#ff4d5e', '#ffb340', '#4cd890', '#4aa8ff', '#b07cff'];
  const VOTE_COLOR = '#d38cff';
  // one colour per player for movement paths (distinct from the tag colours)
  const PATH_COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#f15bb5', '#ff9f1c', '#2ec4b6', '#c77dff',
    '#00bbf9', '#a3e635', '#f97316', '#e879f9', '#22d3ee', '#facc15', '#fb7185', '#94a3b8'];
  const PLAY_MS = 6000; // one full playback at 1x

  // Retired built-in maps: saved games on them are moved onto the replacement in sanitize().
  // `to` maps old image pixels onto the new image (fitted on wall edges, error ≈ a few px).
  const RETIRED_MAPS = {
    'basement-map': { id: 'basement-wiki', to: (x, y) => [x * 1.26 - 35, y * 1.255 - 26] },
  };

  // ======================================================================
  // storage
  // ======================================================================
  const K = { state: 'ggd.state.v1', prefs: 'ggd.prefs.v1', known: 'ggd.known.v1', cal: 'ggd.cal.v1' };
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { console.warn('save failed', e); return false; } },
  };

  // Blobs live in IndexedDB (too big for localStorage):
  //   maps  - custom map images
  //   shots - the conference screenshot behind each round, keyed by round id
  const idb = (() => {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      const r = indexedDB.open('ggd-thinking-space', 2);
      r.onupgradeneeded = () => {
        const db = r.result;
        for (const name of ['maps', 'shots']) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
    const run = async (store, mode, fn) => {
      const db = await open();
      return new Promise((res, rej) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        t.oncomplete = () => res(req && req.result);
        t.onerror = () => rej(t.error);
      });
    };
    const api = (store) => ({
      all: () => run(store, 'readonly', (s) => s.getAll()),
      keys: () => run(store, 'readonly', (s) => s.getAllKeys()),
      get: (id) => run(store, 'readonly', (s) => s.get(id)),
      put: (m) => run(store, 'readwrite', (s) => s.put(m)),
      del: (id) => run(store, 'readwrite', (s) => s.delete(id)),
    });
    return { maps: api('maps'), shots: api('shots') };
  })();

  // ======================================================================
  // state
  // ======================================================================
  /** Fills in every pin field, for both kinds, so switching kind or old saves never meet a missing one. */
  function ensurePinFields(pin) {
    if (!PIN_KINDS[pin.kind]) pin.kind = 'body';
    pin.text = pin.text || '';
    if (pin.victim === undefined) pin.victim = null;               // body: who died
    pin.players = Array.isArray(pin.players) ? pin.players : [];  // event: players involved
    pin.time = isTimeKey(pin.time) ? pin.time : '';                // event: phase or 30 s span
    pin.note = pin.note || '';                                     // event: details
    return pin;
  }
  const newPin = (x, y, kind) => ensurePinFields({ id: uid(), x, y, kind, text: '', victim: null });

  // tally: votes each player received at this meeting ({pid: n, skip: n}); the game only shows counts
  // net:   hand-arranged node positions in the relationship-network view (others sit on the ring)
  function newRound(n, positions) {
    return { id: uid(), label: 'C' + n, positions: positions || {}, paths: {}, links: [], strokes: [], pins: [], texts: [], tally: {}, net: {}, notes: '' };
  }
  function newGame(mapId) {
    return { version: 1, mapId: mapId || 'basement-wiki', players: [], rounds: [newRound(1)], roundIdx: 0 };
  }
  /** Moves every map-space mark of a game from a retired map's image onto its replacement. */
  function migrateRetiredMap(s) {
    const ret = RETIRED_MAPS[s.mapId];
    if (!ret) return;
    const pt = (o) => { if (o && isFinite(o.x) && isFinite(o.y)) { const [x, y] = ret.to(+o.x, +o.y); o.x = +x.toFixed(1); o.y = +y.toFixed(1); } };
    const arr = (a) => (Array.isArray(a) ? a.map((q) => { const [x, y] = ret.to(+q[0], +q[1]); return [+x.toFixed(1), +y.toFixed(1)]; }) : a);
    for (const r of s.rounds) {
      Object.values(r.positions || {}).forEach(pt);
      for (const k of Object.keys(r.paths || {})) r.paths[k] = arr(r.paths[k]);
      for (const st of r.strokes || []) st.points = arr(st.points);
      (r.pins || []).forEach(pt);
      (r.texts || []).forEach(pt);
      // r.net is network-view space, not map space: untouched
    }
    s.mapId = ret.id;
  }
  function sanitize(s) {
    if (!s || typeof s !== 'object' || !Array.isArray(s.players) || !Array.isArray(s.rounds) || !s.rounds.length) return null;
    s.version = 1;
    s.mapId = s.mapId || 'basement';
    migrateRetiredMap(s);
    for (const p of s.players) {
      p.id = p.id || uid(); p.name = p.name || '?'; p.tag = p.tag || 'unknown';
      p.status = p.status || 'alive'; p.claim = p.claim || ''; p.notes = p.notes || '';
      if (p.diedRound === undefined) p.diedRound = null;
    }
    s.rounds.forEach((r, i) => {
      r.id = r.id || uid();
      r.label = (r.label || 'C' + (i + 1)).replace(/^R(\d+)$/, 'C$1');
      r.hasShot = !!r.hasShot;
      r.positions = r.positions || {}; r.links = r.links || []; r.strokes = r.strokes || [];
      r.pins = r.pins || []; r.texts = r.texts || []; r.notes = r.notes || '';
      r.paths = r.paths || {};
      r.net = r.net && typeof r.net === 'object' ? r.net : {};
      // up to 1.1 votes were stored per voter ({voter: target|'skip'}); keep only the counts
      if (!r.tally || typeof r.tally !== 'object') {
        r.tally = {};
        for (const tid of Object.values(r.votes || {})) if (tid) r.tally[tid] = (r.tally[tid] || 0) + 1;
      }
      delete r.votes;
      for (const k of Object.keys(r.tally)) {
        const n = Math.max(0, Math.round(+r.tally[k] || 0));
        if (n) r.tally[k] = n; else delete r.tally[k];
      }
      for (const pin of r.pins) {
        ensurePinFields(pin);
        // 1.1 events shared the body form, so an event could name a "victim": keep them as involved
        if (pin.kind === 'event' && pin.victim && !pin.players.length) pin.players = [pin.victim];
      }
    });
    s.roundIdx = clamp(s.roundIdx | 0, 0, s.rounds.length - 1);
    return s;
  }

  let S = sanitize(LS.get(K.state, null)) || newGame();
  const prefs = Object.assign({
    tool: 'select', linkType: 'with', pinKind: 'body', penColor: '#ffffff', textColor: '#ffffff',
    showPaths: true, playSpeed: 1, playMode: 'sync', showVotes: true, showClaims: true, showDead: true, tokenR: 24,
    view: 'map', // 'map' | 'net' (relationship network)
    poi: { task: true, sab: true }, poiLabels: false, poiOpen: true, // map points overlay: groups shown
  }, LS.get(K.prefs, {}));
  if (!prefs.poi || typeof prefs.poi !== 'object') prefs.poi = { task: true, sab: true };
  if (!GGDI18n.LANGS.includes(prefs.lang)) prefs.lang = GGDI18n.detect();
  if (prefs.view !== 'net') prefs.view = 'map';
  if (!LINKS[prefs.linkType]) prefs.linkType = 'with';
  if (prefs.view === 'net' && !NET_TOOLS.includes(prefs.tool)) prefs.tool = 'select';
  const ui = { sel: null, view: { x: 0, y: 0, k: 1 }, mapSize: { w: 1600, h: 1000 }, tab: 'inspect' };

  const R = () => S.rounds[S.roundIdx];
  const P = (id) => S.players.find((p) => p.id === id);
  const isDeadAt = (p, ri = S.roundIdx) => p.status !== 'alive' && (p.diedRound == null || p.diedRound <= ri);
  const isSel = (kind, id) => !!ui.sel && ui.sel.kind === kind && ui.sel.id === id;
  const isNet = () => prefs.view === 'net';
  const onBoard = (pid) => {
    const p = P(pid);
    return !!(p && R().positions[pid] && (prefs.showDead || !isDeadAt(p)));
  };

  // ---- relationship network: every (shown) player on a ring around 0,0 ----
  const netPlayers = () => S.players.filter((p) => prefs.showDead || !isDeadAt(p));
  function netLayout() {
    const r = R(), TR = prefs.tokenR;
    const list = netPlayers();
    const n = list.length;
    // chord i→i+2 passes rad·(1 − cos 2π/n) from the token between them; keep that ≥ 1.6 token radii
    const chord = n > 3 ? (TR * 1.6) / (1 - Math.cos((Math.PI * 2) / n)) : 0;
    const rad = Math.max(TR * 6, (n * TR * 3.6) / (Math.PI * 2), chord);
    const pos = {};
    list.forEach((p, i) => {
      const a = -Math.PI / 2 + (i / Math.max(1, n)) * Math.PI * 2;
      pos[p.id] = r.net[p.id] || { x: +(Math.cos(a) * rad).toFixed(1), y: +(Math.sin(a) * rad).toFixed(1) };
    });
    return { pos, rad };
  }
  /** Node position in the network view: the stored object when hand-placed, else a fresh ring slot. */
  const netPos = (pid) => netLayout().pos[pid] || null;
  /** Whether a player's token is drawn in the current view. */
  const shown = (pid) => {
    if (!isNet()) return onBoard(pid);
    const p = P(pid);
    return !!(p && (prefs.showDead || !isDeadAt(p)));
  };
  /** Where a player's token is drawn in the current view. */
  const tokenPos = (pid) => (isNet() ? netPos(pid) : dispPos(pid));
  /** World-space rectangle that "fit" frames: the map image, or the network's nodes. */
  function boardBounds() {
    if (!isNet()) return { x: 0, y: 0, w: ui.mapSize.w, h: ui.mapSize.h };
    const { pos, rad } = netLayout();
    const m = prefs.tokenR * 3;
    let x0 = -rad, y0 = -rad, x1 = rad, y1 = rad;
    for (const q of Object.values(pos)) {
      x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y);
    }
    return { x: x0 - m, y: y0 - m, w: x1 - x0 + m * 2, h: y1 - y0 + m * 2 };
  }

  // ---- undo / persistence ----
  const undoStack = [], redoStack = [];
  function checkpoint() {
    undoStack.push(JSON.stringify(S));
    if (undoStack.length > 60) undoStack.shift();
    redoStack.length = 0;
  }
  function undo() {
    if (!undoStack.length) return toast(t('toast.nothingUndo'));
    redoStack.push(JSON.stringify(S));
    S = JSON.parse(undoStack.pop());
    afterStateSwap();
  }
  function redo() {
    if (!redoStack.length) return toast(t('toast.nothingRedo'));
    undoStack.push(JSON.stringify(S));
    S = JSON.parse(redoStack.pop());
    afterStateSwap();
  }
  function afterStateSwap() {
    play.active = false; play.playing = false; play.t = 0; cancelAnimationFrame(play.raf);
    if (ui.sel && !selectionExists()) ui.sel = null;
    save(); render();
  }
  let saveTimer = 0;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 250);
  }
  function flushSave() {
    clearTimeout(saveTimer);
    if (!LS.set(K.state, S)) toast(t('toast.storageFull'));
  }
  const savePrefs = () => LS.set(K.prefs, prefs);
  function mutate(fn, opts) { checkpoint(); fn(); save(); render(opts); }

  function knownNames() {
    const set = new Set(LS.get(K.known, []));
    for (const p of S.players) set.add(p.name);
    return [...set].filter(Boolean);
  }
  function rememberNames(names) {
    const list = LS.get(K.known, []).filter((n) => !names.includes(n));
    LS.set(K.known, [...names, ...list].slice(0, 400));
  }

  // ======================================================================
  // DOM refs
  // ======================================================================
  const svg = $('#board');
  const vp = $('#vp');
  const L = {
    map: $('#lMap'), poi: $('#lPoi'), net: $('#lNet'), strokes: $('#lStrokes'), links: $('#lLinks'), paths: $('#lPaths'),
    pins: $('#lPins'), texts: $('#lTexts'), tokens: $('#lTokens'), temp: $('#lTemp'),
  };

  let toastTimer = 0;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 2400);
  }

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const stamp = () => {
    const d = new Date(), z = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`;
  };

  // title/msg are i18n keys so an open dialog follows a language switch
  let promptKeys = { title: 'prompt.title', msg: null };
  function renderPromptText() {
    $('#promptTitle').textContent = t(promptKeys.title);
    $('#promptMsg').textContent = promptKeys.msg ? t(promptKeys.msg) : '';
  }
  function promptText(titleKey, msgKey, value) {
    const dlg = $('#promptDlg');
    promptKeys = { title: titleKey, msg: msgKey };
    renderPromptText();
    const inp = $('#promptInput');
    inp.value = value || '';
    return new Promise((resolve) => {
      dlg.onclose = () => resolve(dlg.returnValue === 'ok' ? inp.value.trim() : null);
      dlg.returnValue = '';
      dlg.showModal();
      inp.select();
    });
  }

  // ======================================================================
  // maps
  // ======================================================================
  let customMaps = [];
  async function loadCustomMaps() {
    try {
      const rows = await idb.maps.all();
      customMaps.forEach((m) => URL.revokeObjectURL(m.url));
      customMaps = (rows || []).map((r) => ({ id: r.id, name: r.name, url: URL.createObjectURL(r.blob), custom: true }));
    } catch (e) { console.warn('IndexedDB unavailable', e); }
  }
  const allMaps = () => [...MAPS, ...customMaps];
  const currentMap = () => allMaps().find((m) => m.id === S.mapId) || MAPS[0];

  let mapKey = null;
  function ensureMap() {
    const m = currentMap();
    const src = m.src || m.url || null;
    const key = m.id + '|' + src;
    if (mapKey === key) return;
    mapKey = key;
    L.map.innerHTML = '';
    if (!src) {
      ui.mapSize = { w: m.w, h: m.h };
      svgEl('rect', { x: 0, y: 0, width: m.w, height: m.h, fill: '#10161f' }, L.map);
      svgEl('rect', { x: 0, y: 0, width: m.w, height: m.h, fill: 'url(#gridPat)' }, L.map);
      if (!isNet()) fit();
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (mapKey !== key) return;
      ui.mapSize = { w: img.naturalWidth, h: img.naturalHeight };
      L.map.innerHTML = '';
      svgEl('image', { 'data-map': '1', href: src, x: 0, y: 0, width: ui.mapSize.w, height: ui.mapSize.h, preserveAspectRatio: 'none' }, L.map);
      if (!isNet()) fit();
      renderBoard();
    };
    img.onerror = () => toast(t('toast.mapFailed', { name: mapName(m) }));
    img.src = src;
  }

  async function uploadMap(file) {
    const name = await promptText('map.nameTitle', 'map.nameMsg', file.name.replace(/\.[^.]+$/, ''));
    if (name === null) return;
    const id = 'custom-' + uid();
    try {
      await idb.maps.put({ id, name: name || t('map.customDefault'), blob: file });
      await loadCustomMaps();
    } catch {
      customMaps.push({ id, name: name || t('map.customDefault'), sessionOnly: true, url: URL.createObjectURL(file), custom: true });
      toast(t('toast.mapSession'));
    }
    S.mapId = id; save(); render();
  }

  // ======================================================================
  // view (pan / zoom)
  // ======================================================================
  function applyView() {
    const v = ui.view;
    vp.setAttribute('transform', `translate(${v.x},${v.y}) scale(${v.k})`);
  }
  function fit() {
    const r = svg.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    const b = boardBounds(), pad = 24;
    let k = Math.min((r.width - pad * 2) / b.w, (r.height - pad * 2) / b.h);
    if (isNet()) k = Math.min(k, 2); // a small table shouldn't blow up to giant tokens
    ui.view = { k, x: (r.width - b.w * k) / 2 - b.x * k, y: (r.height - b.h * k) / 2 - b.y * k };
    applyView();
  }
  function zoomAt(mx, my, factor) {
    const v = ui.view;
    const k = clamp(v.k * factor, 0.08, 10);
    v.x = mx - (mx - v.x) * (k / v.k);
    v.y = my - (my - v.y) * (k / v.k);
    v.k = k;
    applyView();
  }
  function zoomCenter(factor) {
    const r = svg.getBoundingClientRect();
    zoomAt(r.width / 2, r.height / 2, factor);
  }
  function toWorld(e) {
    const r = svg.getBoundingClientRect();
    return { x: (e.clientX - r.left - ui.view.x) / ui.view.k, y: (e.clientY - r.top - ui.view.y) / ui.view.k };
  }
  function viewCenterWorld() {
    const r = svg.getBoundingClientRect();
    return { x: (r.width / 2 - ui.view.x) / ui.view.k, y: (r.height / 2 - ui.view.y) / ui.view.k };
  }
  function centerOn(pos) {
    const r = svg.getBoundingClientRect();
    ui.view.x = r.width / 2 - pos.x * ui.view.k;
    ui.view.y = r.height / 2 - pos.y * ui.view.k;
    applyView();
  }

  // ======================================================================
  // board rendering
  // ======================================================================
  function buildDefs() {
    const d = $('#defs');
    d.innerHTML = '';
    const clip = svgEl('clipPath', { id: 'tokClip', clipPathUnits: 'objectBoundingBox' }, d);
    svgEl('circle', { cx: 0.5, cy: 0.5, r: 0.5 }, clip);
    const f = svgEl('filter', { id: 'gray' }, d);
    svgEl('feColorMatrix', { type: 'saturate', values: '0' }, f);
    const marker = (id, color) => {
      const m = svgEl('marker', { id, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' }, d);
      svgEl('path', { d: 'M0,0 L10,5 L0,10 z', fill: color }, m);
    };
    for (const [t, def] of Object.entries(LINKS)) if (def.arrow) marker('arr-' + t, def.color);
    PATH_COLORS.forEach((c, i) => marker('arr-path-' + i, c));
    const pat = svgEl('pattern', { id: 'gridPat', width: 50, height: 50, patternUnits: 'userSpaceOnUse' }, d);
    svgEl('path', { d: 'M50 0 L0 0 0 50', fill: 'none', stroke: '#1d2735', 'stroke-width': 1.5 }, pat);
  }

  let boardRaf = 0;
  function scheduleBoard() {
    if (boardRaf) return;
    boardRaf = requestAnimationFrame(() => { boardRaf = 0; renderBoard(); });
  }

  function renderBoard() {
    const net = isNet();
    ensureMap();
    // the map stays loaded underneath; the network view just hides it and the map-only layers
    L.map.setAttribute('display', net ? 'none' : 'inline');
    renderPoi();
    svg.setAttribute('class', 'tool-' + prefs.tool + (net ? ' view-net' : ''));
    if (net) {
      for (const k of ['strokes', 'paths', 'pins', 'texts']) L[k].innerHTML = '';
      renderNetBackdrop();
    } else {
      L.net.innerHTML = '';
      renderStrokes();
      renderPaths();
      renderPins();
      renderTexts();
    }
    renderLinks();
    renderTokens();
    renderPlaybar();
    renderViewSwitch();
  }

  function renderNetBackdrop() {
    L.net.innerHTML = '';
    const { rad } = netLayout();
    const TR = prefs.tokenR;
    svgEl('circle', { cx: 0, cy: 0, r: rad, fill: 'none', stroke: '#ffffff', 'stroke-opacity': 0.1, 'stroke-width': 1.5, 'stroke-dasharray': '2 8' }, L.net);
    svgEl('circle', { cx: 0, cy: 0, r: rad + TR * 2.4, fill: 'none', stroke: '#ffffff', 'stroke-opacity': 0.05, 'stroke-width': 1 }, L.net);
    const c = TR * 0.6;
    svgEl('path', { d: `M${-c},0H${c}M0,${-c}V${c}`, stroke: '#ffffff', 'stroke-opacity': 0.25, 'stroke-width': 1.5 }, L.net);
  }

  // ---- map points (poi.js): tasks, sabotages and mechanisms drawn over the map image ----
  const POI_COLOR = {
    goose: '#4cd890', special: '#ffd93d', destroy: '#ff4d5e', torch: '#ff9f1c', spawn: '#22d3ee',
    food: '#facc15', shelter: '#4aa8ff', peek: '#c77dff', furnace: '#c2410c', portal: '#f15bb5', tribute: '#ffd93d',
  };
  const POI_R = 9; // marker radius in map pixels
  const poiSet = () => {
    const m = currentMap();
    return (m.poi && self.GGDPoi && GGDPoi.sets[m.poi]) || null;
  };
  const poiName = (q) => (GGDI18n.getLang() === 'zh' ? q.zh : q.en);
  function poiTitle(q) {
    const room = q.room ? (GGDI18n.getLang() === 'zh' ? q.room.zh : q.room.en) : '';
    const speed = q.speed ? t('poi.speed.' + q.speed) : '';
    return [poiName(q), [room, speed].filter(Boolean).join(' · ')].filter(Boolean).join('\n');
  }
  /** One marker shape centred on 0,0 (also used for the panel's legend icons). */
  function poiShape(g, type, s) {
    const c = POI_COLOR[type] || '#fff', ink = '#05080c';
    const path = (d, w = 2) => svgEl('path', { d, fill: c, stroke: ink, 'stroke-width': w, 'stroke-linejoin': 'round' }, g);
    const ring = (r, w) => {
      svgEl('circle', { r, fill: 'none', stroke: ink, 'stroke-width': w + 3 }, g);
      svgEl('circle', { r, fill: 'none', stroke: c, 'stroke-width': w }, g);
    };
    switch (type) {
      case 'destroy': { const k = s * 1.3; path(`M0,${-k}L${k},0L0,${k}L${-k},0Z`); break; }
      case 'torch': path(`M0,${-s * 1.4}C${s},${-s * 0.3} ${s * 0.9},${s} 0,${s}C${-s * 0.9},${s} ${-s},${-s * 0.3} 0,${-s * 1.4}Z`); break;
      case 'shelter': svgEl('rect', { x: -s * 0.9, y: -s * 0.9, width: s * 1.8, height: s * 1.8, fill: c, stroke: ink, 'stroke-width': 2 }, g); break;
      case 'peek':
        path(`M${-s * 1.35},0Q0,${-s * 1.3} ${s * 1.35},0Q0,${s * 1.3} ${-s * 1.35},0Z`, 1.6);
        svgEl('circle', { r: s * 0.4, fill: ink }, g);
        break;
      case 'spawn': ring(s * 0.85, 2.5); svgEl('circle', { r: s * 0.3, fill: c }, g); break;
      case 'portal': ring(s, 2.5); ring(s * 0.5, 2); break;
      case 'food': svgEl('circle', { r: s * 0.6, fill: c, stroke: ink, 'stroke-width': 1.5 }, g); break;
      case 'furnace': {
        const k = s * 0.95, e = k * 0.45;
        path(`M${-k + e},${-k}H${k - e}L${k},${-k + e}V${k - e}L${k - e},${k}H${-k + e}L${-k},${k - e}V${-k + e}Z`);
        break;
      }
      case 'tribute': {
        const pts = [];
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? s * 0.55 : s * 1.3;
          pts.push(`${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`);
        }
        path('M' + pts.join('L') + 'Z', 1.6);
        break;
      }
      default: // goose / special tasks
        svgEl('circle', { r: s, fill: c, stroke: ink, 'stroke-width': 2 }, g);
        svgEl('circle', { r: s * 0.32, fill: ink, opacity: 0.55 }, g);
    }
  }
  // sabotages and mechanisms sit on top of the task dots they share a spot with
  const POI_ORDER = ['task', 'food', 'spawn', 'torch', 'hide', 'peek', 'misc', 'sab'];
  function renderPoi() {
    const set = isNet() ? null : poiSet();
    const { w, h } = ui.mapSize;
    const sig = set ? [currentMap().id, w, h, JSON.stringify(prefs.poi), prefs.poiLabels, GGDI18n.getLang()].join('|') : '';
    if (L.poi.__sig === sig) return;
    L.poi.__sig = sig;
    L.poi.innerHTML = '';
    if (!set) return;
    const fs = 11;
    const list = set.filter((q) => prefs.poi[q.group]).sort((a, b) => POI_ORDER.indexOf(a.group) - POI_ORDER.indexOf(b.group));
    for (const q of list) {
      const x = +(q.x / 1000 * w).toFixed(1), y = +(q.y / 1000 * h).toFixed(1);
      const g = svgEl('g', { transform: `translate(${x},${y})` }, L.poi);
      svgEl('title', null, g).textContent = poiTitle(q);
      poiShape(g, q.type, POI_R);
      if (prefs.poiLabels) svgText(g, poiName(q), 0, q.up ? -POI_R * 1.5 - 3 : POI_R * 1.5 + fs, fs, POI_COLOR[q.type], 600);
    }
  }
  function renderPoiPanel() {
    const set = poiSet();
    const panel = $('#poiPanel');
    panel.classList.toggle('hidden', !set || isNet());
    if (!set) return;
    panel.classList.toggle('folded', !prefs.poiOpen);
    $('#poiFold').setAttribute('aria-expanded', prefs.poiOpen ? 'true' : 'false');
    $('#poiLabels').checked = prefs.poiLabels;
    const list = $('#poiList');
    list.innerHTML = '';
    for (const grp of GGDPoi.GROUPS) {
      const items = set.filter((q) => q.group === grp);
      if (!items.length) continue;
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.g = grp;
      b.className = 'poi-row' + (prefs.poi[grp] ? ' on' : '');
      b.setAttribute('aria-pressed', prefs.poi[grp] ? 'true' : 'false');
      const icon = svgEl('svg', { viewBox: '-14 -14 28 28', width: 18, height: 18, 'aria-hidden': 'true' }, b);
      poiShape(icon, items[0].type, 9);
      const label = document.createElement('span');
      label.textContent = t('poi.g.' + grp);
      const n = document.createElement('em');
      n.textContent = items.length;
      b.append(label, n);
      list.appendChild(b);
    }
  }

  /** Curved connector between two token centres, trimmed to the token rims. */
  function connPath(A, B, off, trimA, trimB) {
    const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy);
    if (len < trimA + trimB + 4) return null;
    const nx = -dy / len, ny = dx / len;
    const cx = (A.x + B.x) / 2 + nx * off * 2, cy = (A.y + B.y) / 2 + ny * off * 2;
    const trim = (p, t) => {
      const ux = cx - p.x, uy = cy - p.y, l = Math.hypot(ux, uy) || 1;
      return { x: p.x + (ux / l) * t, y: p.y + (uy / l) * t };
    };
    const a = trim(A, trimA), b = trim(B, trimB);
    return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
  }

  function renderStrokes() {
    L.strokes.innerHTML = '';
    for (const s of R().strokes) {
      if (!s.points || s.points.length < 2) continue;
      const d = 'M' + s.points.map((p) => p[0] + ',' + p[1]).join('L');
      const g = svgEl('g', { 'data-kind': 'stroke', 'data-id': s.id }, L.strokes);
      svgEl('path', { d, fill: 'none', stroke: 'transparent', 'stroke-width': s.width + 14, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      if (isSel('stroke', s.id)) svgEl('path', { d, fill: 'none', stroke: '#ffffff88', 'stroke-width': s.width + 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      svgEl('path', { d, fill: 'none', stroke: s.color, 'stroke-width': s.width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    }
  }

  function renderLinks() {
    L.links.innerHTML = '';
    const r = R(), TR = prefs.tokenR;
    const groups = new Map();
    for (const l of r.links) {
      if (!shown(l.a) || !shown(l.b)) continue;
      const k = [l.a, l.b].sort().join('|');
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(l);
    }
    for (const list of groups.values()) {
      list.forEach((l, i) => {
        // canonical direction so parallel links fan out consistently
        const flip = l.a > l.b;
        const off = (i - (list.length - 1) / 2) * TR * 0.8 * (flip ? -1 : 1);
        const def = LINKS[l.type] || LINKS.with;
        const A = tokenPos(l.a), B = tokenPos(l.b);
        const d = connPath(A, B, off, TR + 6, TR + 8);
        if (!d) return;
        const w = Math.max(2.5, TR / 7) * (def.w || 1);
        const g = svgEl('g', { 'data-kind': 'link', 'data-id': l.id }, L.links);
        svgEl('path', { d, fill: 'none', stroke: 'transparent', 'stroke-width': w + 14 }, g);
        if (isSel('link', l.id)) svgEl('path', { d, fill: 'none', stroke: '#ffffff', 'stroke-width': w + 5, opacity: 0.5 }, g);
        svgEl('path', {
          d, fill: 'none', stroke: def.color, 'stroke-width': w, 'stroke-linecap': 'round',
          'stroke-dasharray': def.dash, 'marker-end': def.arrow ? `url(#arr-${LINKS[l.type] ? l.type : 'with'})` : null,
        }, g);
        // point on the quadratic curve at t = 0.5 (the control point sits at 2× the offset)
        const len = Math.hypot(B.x - A.x, B.y - A.y) || 1;
        const mx = (A.x + B.x) / 2 + (-(B.y - A.y) / len) * off, my = (A.y + B.y) / 2 + ((B.x - A.x) / len) * off;
        if (def.mark) {
          const s = Math.max(6, TR * 0.32), k = s * 0.45;
          svgEl('rect', { x: mx - s, y: my - s, width: s * 2, height: s * 2, fill: def.color, stroke: '#05080c', 'stroke-width': 1.5, transform: `rotate(45 ${mx} ${my})` }, g);
          svgEl('path', { d: `M${mx - k},${my - k}L${mx + k},${my + k}M${mx + k},${my - k}L${mx - k},${my + k}`, stroke: '#fff', 'stroke-width': Math.max(1.6, s * 0.28), 'stroke-linecap': 'round' }, g);
        }
        if (l.note) svgText(g, l.note, mx, my - (def.mark ? TR * 0.55 : 6), Math.max(10, TR * 0.45), def.color, 600);
      });
    }
  }

  // ---- movement paths (per conference) & playback ----
  const play = { active: false, playing: false, t: 0, last: 0, raf: 0 };

  function pathColor(pid) {
    const i = Math.max(0, S.players.findIndex((p) => p.id === pid)) % PATH_COLORS.length;
    return { color: PATH_COLORS[i], marker: `url(#arr-path-${i})` };
  }
  const metaCache = new WeakMap();
  function pathMeta(pts) {
    let m = metaCache.get(pts);
    if (m) return m;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    m = { cum, len: cum[cum.length - 1] };
    metaCache.set(pts, m);
    return m;
  }
  /** Points of `pts` up to arc-length `dist`, ending on the interpolated point. */
  function pathPrefix(pts, dist) {
    const { cum, len } = pathMeta(pts);
    if (dist >= len) return pts.slice();
    if (dist <= 0) return [pts[0]];
    let lo = 1, hi = cum.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < dist) lo = mid + 1; else hi = mid; }
    const f = (dist - cum[lo - 1]) / ((cum[lo] - cum[lo - 1]) || 1);
    const a = pts[lo - 1], b = pts[lo];
    return [...pts.slice(0, lo), [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]];
  }
  const livePaths = () => Object.entries(R().paths).filter(([pid, pts]) => P(pid) && pts.length >= 2);
  /** How far along its own path a player is at playback time play.t. */
  function playDist(pts) {
    const { len } = pathMeta(pts);
    if (prefs.playMode === 'speed') {
      const longest = Math.max(1, ...livePaths().map(([, q]) => pathMeta(q).len));
      return Math.min(len, play.t * longest);
    }
    return play.t * len;
  }
  /** Position used for drawing: animated along the path during playback. */
  function dispPos(pid) {
    const r = R();
    const pts = play.active && r.paths[pid];
    if (pts && pts.length >= 2) {
      const q = pathPrefix(pts, playDist(pts));
      const last = q[q.length - 1];
      return { x: last[0], y: last[1] };
    }
    return r.positions[pid];
  }

  function renderPaths() {
    L.paths.innerHTML = '';
    if (!prefs.showPaths && !play.active) return;
    const TR = prefs.tokenR, w = Math.max(2.5, TR / 7), fs = Math.max(9, TR * 0.42);
    for (const [pid, pts] of livePaths()) {
      const p = P(pid);
      if (isDeadAt(p) && !prefs.showDead) continue;
      const { color, marker } = pathColor(pid);
      const d = 'M' + pts.map((q) => q[0] + ',' + q[1]).join('L');
      const g = svgEl('g', { 'data-kind': 'path', 'data-id': pid }, L.paths);
      svgEl('path', { d, fill: 'none', stroke: 'transparent', 'stroke-width': w + 14, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      if (isSel('player', pid)) svgEl('path', { d, fill: 'none', stroke: '#ffffff', opacity: 0.45, 'stroke-width': w + 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      const line = { fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
      if (play.active) {
        // whole route faint, walked part solid
        svgEl('path', { ...line, d, opacity: 0.3, 'stroke-dasharray': '2 7' }, g);
        const done = pathPrefix(pts, playDist(pts));
        if (done.length >= 2) svgEl('path', { ...line, d: 'M' + done.map((q) => q[0] + ',' + q[1]).join('L') }, g);
      } else {
        svgEl('path', { ...line, d, opacity: 0.9, 'marker-end': marker }, g);
      }
      // start marker
      svgEl('circle', { cx: pts[0][0], cy: pts[0][1], r: Math.max(4, TR * 0.28), fill: color, stroke: '#05080c', 'stroke-width': 2 }, g);
      svgText(g, p.name, pts[0][0], pts[0][1] - TR * 0.28 - 5, fs, color, 700);
    }
  }

  function renderPlaybar() {
    const bar = $('#playbar');
    const n = isNet() ? 0 : livePaths().length;
    bar.classList.toggle('hidden', n === 0);
    if (!n) return;
    $('#playBtn').textContent = play.playing ? '⏸' : '▶';
    $('#playBtn').title = t(play.playing ? 'play.pause' : 'play.play');
    $('#playScrub').value = Math.round(play.t * 1000);
    $('#playPct').textContent = play.active ? Math.round(play.t * 100) + '%' : tn('play.paths', n);
    $('#playStop').disabled = !play.active;
    $('#playSpeed').value = String(prefs.playSpeed);
    $('#playMode').value = prefs.playMode;
  }
  function playTick(now) {
    if (!play.playing) return;
    const dt = now - play.last;
    play.last = now;
    play.t = Math.min(1, play.t + (dt * prefs.playSpeed) / PLAY_MS);
    if (play.t >= 1) play.playing = false;
    renderBoard();
    if (play.playing) play.raf = requestAnimationFrame(playTick);
  }
  function togglePlay() {
    if (!livePaths().length) return toast(t('toast.noPaths'));
    if (play.playing) { play.playing = false; cancelAnimationFrame(play.raf); renderBoard(); return; }
    if (!play.active || play.t >= 1) play.t = 0;
    play.active = true;
    play.playing = true;
    play.last = performance.now();
    play.raf = requestAnimationFrame(playTick);
    renderBoard();
  }
  function stopPlay() {
    if (!play.active) return;
    play.active = false; play.playing = false; play.t = 0;
    cancelAnimationFrame(play.raf);
    renderBoard();
  }
  function scrubPlay(t) {
    play.active = true; play.playing = false; play.t = clamp(t, 0, 1);
    cancelAnimationFrame(play.raf);
    renderBoard();
  }

  function pinPath(s) {
    return `M0,0 L${-0.72 * s},${-1.1 * s} A${s},${s} 0 1 1 ${0.72 * s},${-1.1 * s} Z`;
  }
  function renderPins() {
    L.pins.innerHTML = '';
    const TR = prefs.tokenR;
    for (const pin of R().pins) {
      const s = TR * 0.55;
      const def = PIN_KINDS[pin.kind] || PIN_KINDS.body;
      const g = svgEl('g', { 'data-kind': 'pin', 'data-id': pin.id, transform: `translate(${pin.x},${pin.y})` }, L.pins);
      if (isSel('pin', pin.id)) svgEl('circle', { cx: 0, cy: -1.5 * s, r: s * 1.7, fill: 'none', stroke: '#fff', 'stroke-width': 2, 'stroke-dasharray': '4 3' }, g);
      svgEl('path', { d: pinPath(s), fill: def.color, stroke: '#05080c', 'stroke-width': 2 }, g);
      const cy = -1.8 * s, k = s * 0.38;
      const fs = Math.max(10, TR * 0.5);
      let y = s * 0.9 + 6; // baseline of the next line under the pin
      if (pin.kind === 'body') {
        svgEl('path', { d: `M${-k},${cy - k}L${k},${cy + k}M${k},${cy - k}L${-k},${cy + k}`, stroke: '#fff', 'stroke-width': s * 0.22, 'stroke-linecap': 'round' }, g);
        const victim = pin.victim && P(pin.victim);
        const label = [victim ? victim.name : '', pin.text || ''].filter(Boolean).join(' — ');
        if (label) svgText(g, label, 0, y, fs, def.color, 700);
        continue;
      }
      svgText(g, '!', 0, cy + s * 0.38, s * 1.1, '#fff', 900).setAttribute('stroke-width', 0);
      // event: [time] title, then the players involved as a row of mini avatars
      const label = [timeLabel(pin.time), pin.text || ''].filter(Boolean).join('  ');
      if (label) { svgText(g, label, 0, y, fs, def.color, 700); y += fs * 0.35; }
      const who = pin.players.map(P).filter(Boolean);
      if (who.length) {
        const ar = Math.max(7, TR * 0.36), gap = ar * 2 + 3;
        who.forEach((p, i) => {
          const cx = (i - (who.length - 1) / 2) * gap, ccy = y + ar + 2;
          const ag = svgEl('g', null, g);
          svgEl('title', null, ag).textContent = p.name;
          svgEl('circle', { cx, cy: ccy, r: ar + 1.5, fill: tagOf(p.tag).color, stroke: '#05080c', 'stroke-width': 1 }, ag);
          if (p.icon) {
            svgEl('image', { href: p.icon, x: cx - ar, y: ccy - ar, width: ar * 2, height: ar * 2, preserveAspectRatio: 'xMidYMid slice', 'clip-path': 'url(#tokClip)', filter: isDeadAt(p) ? 'url(#gray)' : null }, ag);
          } else {
            svgEl('circle', { cx, cy: ccy, r: ar, fill: '#1f2023' }, ag);
          }
        });
      }
    }
  }

  function renderTexts() {
    L.texts.innerHTML = '';
    for (const tx of R().texts) {
      const g = svgEl('g', { 'data-kind': 'text', 'data-id': tx.id, transform: `translate(${tx.x},${tx.y})` }, L.texts);
      const size = tx.size || 22;
      const lines = String(tx.text || t('text.default')).split('\n');
      const el = svgEl('text', {
        x: 0, y: 0, 'font-family': FONT, 'font-size': size, 'font-weight': 700, fill: tx.color || '#fff',
        stroke: '#05080c', 'stroke-width': size * 0.22, 'stroke-linejoin': 'round', 'paint-order': 'stroke',
      }, g);
      lines.forEach((ln, i) => {
        const ts = svgEl('tspan', { x: 0, dy: i === 0 ? 0 : size * 1.15 }, el);
        ts.textContent = ln || ' ';
      });
      if (isSel('text', tx.id)) {
        try {
          const b = el.getBBox();
          svgEl('rect', { x: b.x - 5, y: b.y - 4, width: b.width + 10, height: b.height + 8, fill: 'none', stroke: '#fff', 'stroke-dasharray': '4 3', rx: 4 }, g);
        } catch { /* not rendered yet */ }
      }
    }
  }

  const tokenNodes = new Map();
  function renderTokens() {
    const r = R(), TR = prefs.tokenR;
    const seen = new Set();
    const order = [];
    const net = isNet();
    const layout = net ? netLayout().pos : null;
    for (const p of S.players) {
      const pos = net ? layout[p.id] : dispPos(p.id);
      const dead = isDeadAt(p);
      if (!pos || (dead && !prefs.showDead)) continue;
      seen.add(p.id);
      let g = tokenNodes.get(p.id);
      if (!g) {
        g = svgEl('g', { 'data-kind': 'token', 'data-id': p.id });
        tokenNodes.set(p.id, g);
      }
      const votes = prefs.showVotes ? (r.tally[p.id] || 0) : 0;
      const sig = [p.icon, p.name, p.tag, dead, p.claim, prefs.showClaims, TR, isSel('player', p.id), votes, GGDI18n.getLang()].join('|');
      if (g.__sig !== sig) { g.__sig = sig; buildToken(g, p, dead, TR, votes); }
      g.setAttribute('transform', `translate(${pos.x},${pos.y})`);
      order.push([dead ? 0 : isSel('player', p.id) ? 2 : 1, g]);
    }
    for (const [id, g] of tokenNodes) if (!seen.has(id)) { g.remove(); tokenNodes.delete(id); }
    order.sort((a, b) => a[0] - b[0]).forEach(([, g]) => L.tokens.appendChild(g));
  }

  function buildToken(g, p, dead, TR, votes) {
    g.innerHTML = '';
    const color = tagOf(p.tag).color;
    const body = svgEl('g', { opacity: dead ? 0.55 : 1 }, g);
    if (isSel('player', p.id)) svgEl('circle', { r: TR + 10, fill: 'none', stroke: '#fff', 'stroke-width': 2, 'stroke-dasharray': '5 4' }, body);
    svgEl('circle', { r: TR + 4, fill: color }, body);
    svgEl('circle', { r: TR, fill: '#1f2023' }, body);
    if (p.icon) {
      svgEl('image', {
        href: p.icon, x: -TR, y: -TR, width: TR * 2, height: TR * 2, preserveAspectRatio: 'xMidYMid slice',
        'clip-path': 'url(#tokClip)', filter: dead ? 'url(#gray)' : null,
      }, body);
    }
    if (dead) {
      const s = TR * 0.7;
      svgEl('path', { d: `M${-s},${-s}L${s},${s}M${s},${-s}L${-s},${s}`, stroke: '#ff4d5e', 'stroke-width': Math.max(3, TR / 5), 'stroke-linecap': 'round', opacity: 0.9 }, g);
    }
    const fs = Math.max(10, TR * 0.55);
    svgText(g, p.name || '?', 0, TR + 6 + fs, fs, dead ? '#9aa3b2' : '#fff', 700);
    if (prefs.showClaims && p.claim) svgText(g, p.claim, 0, -TR - 10, fs * 0.85, color, 700);
    if (votes) {
      // votes received this conference: a small tag on the token's upper right
      const bs = Math.max(9, TR * 0.42), bx = TR * 0.78, by = -TR * 0.78;
      const bw = bs * (votes > 9 ? 2.4 : 1.8), bh = bs * 1.5;
      const vg = svgEl('g', null, g);
      svgEl('title', null, vg).textContent = tn('hist.gotVotes', votes);
      svgEl('rect', { x: bx - bw / 2, y: by - bh / 2, width: bw, height: bh, fill: VOTE_COLOR, stroke: '#05080c', 'stroke-width': 1.5 }, vg);
      const tx = svgEl('text', {
        x: bx, y: by + bs * 0.38, 'text-anchor': 'middle', 'font-family': FONT, 'font-size': bs * 1.1, 'font-weight': 800, fill: '#140a1c',
      }, vg);
      tx.textContent = votes;
    }
  }

  // ======================================================================
  // board interaction
  // ======================================================================
  let drag = null;
  let spaceHeld = false;

  function itemPos(kind, id) {
    if (kind === 'player') return isNet() ? netPos(id) : R().positions[id];
    if (kind === 'pin') return R().pins.find((p) => p.id === id);
    if (kind === 'text') return R().texts.find((t) => t.id === id);
    return null;
  }

  function startPan(e, deselect) {
    drag = { type: 'pan', sx: e.clientX, sy: e.clientY, vx: ui.view.x, vy: ui.view.y, moved: false, deselect };
    svg.classList.add('panning');
    svg.setPointerCapture(e.pointerId);
  }

  function onDown(e) {
    svg.focus({ preventScroll: true });
    const hit = e.target.closest ? e.target.closest('[data-kind]') : null;
    const kind = hit && hit.dataset.kind;
    const id = hit && hit.dataset.id;
    if (e.button === 1 || (e.button === 0 && spaceHeld)) { e.preventDefault(); startPan(e, false); return; }
    if (e.button !== 0) return;
    const tool = prefs.tool;
    // edits happen on the real (final) positions; panning/selecting can keep the playback frame
    const viewOnly = tool === 'select' && !(kind === 'token' || kind === 'pin' || kind === 'text');
    if (!viewOnly) stopPlay();
    const w = toWorld(e);

    if (tool === 'select') {
      if (kind === 'token' || kind === 'pin' || kind === 'text') {
        const k = kind === 'token' ? 'player' : kind;
        select(k, id);
        const pos = itemPos(k, id);
        drag = { type: 'move', kind: k, id, sx: w.x, sy: w.y, ox: pos.x, oy: pos.y, moved: false };
        svg.setPointerCapture(e.pointerId);
      } else if (kind === 'link' || kind === 'stroke') {
        select(kind, id);
      } else if (kind === 'path') {
        select('player', id);
      } else {
        startPan(e, true);
      }
      return;
    }
    if (tool === 'path') {
      // whose route: the token/path under the pointer, else the selected player
      const pid = (kind === 'token' || kind === 'path') ? id : (ui.sel && ui.sel.kind === 'player' ? ui.sel.id : null);
      if (!pid) { toast(t('toast.pathStart')); return; }
      const r = R();
      const old = r.paths[pid];
      const extend = e.shiftKey && old && old.length >= 2;
      let start;
      if (extend) start = null;
      else if (kind === 'token' || kind === 'path') start = r.positions[pid] ? [r.positions[pid].x, r.positions[pid].y] : [w.x, w.y];
      else start = [w.x, w.y]; // selected player, started on empty map: route begins here
      drag = { type: 'path', pid, pts: extend ? old.slice() : [[+start[0].toFixed(1), +start[1].toFixed(1)]] };
      if (!isSel('player', pid)) select('player', pid);
      svg.setPointerCapture(e.pointerId);
      drawTemp();
      return;
    }
    if (tool === 'pen') {
      drag = { type: 'pen', pts: [[+w.x.toFixed(1), +w.y.toFixed(1)]] };
      svg.setPointerCapture(e.pointerId);
      drawTemp();
      return;
    }
    if (tool === 'link') {
      if (kind === 'token') {
        drag = { type: 'link', from: id, x: w.x, y: w.y };
        svg.setPointerCapture(e.pointerId);
        drawTemp();
      } else startPan(e, false);
      return;
    }
    if (tool === 'pin') {
      if (kind === 'pin') { select('pin', id); return; }
      const pin = newPin(+w.x.toFixed(1), +w.y.toFixed(1), PIN_KINDS[prefs.pinKind] ? prefs.pinKind : 'body');
      mutate(() => R().pins.push(pin));
      select('pin', pin.id);
      focusInspector();
      return;
    }
    if (tool === 'text') {
      if (kind === 'text') { select('text', id); focusInspector(); return; }
      const note = { id: uid(), x: +w.x.toFixed(1), y: +w.y.toFixed(1), text: '', color: prefs.textColor, size: Math.round(prefs.tokenR * 0.9) };
      mutate(() => R().texts.push(note));
      select('text', note.id);
      focusInspector(true);
      return;
    }
    if (tool === 'eraser') {
      drag = { type: 'erase', erased: false };
      svg.setPointerCapture(e.pointerId);
      eraseAt(e);
    }
  }

  function onMove(e) {
    if (!drag) return;
    if (drag.type === 'pan') {
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      ui.view.x = drag.vx + dx; ui.view.y = drag.vy + dy;
      applyView();
      return;
    }
    const w = toWorld(e);
    if (drag.type === 'move') {
      const dx = w.x - drag.sx, dy = w.y - drag.sy;
      if (!drag.moved) {
        if (Math.hypot(dx, dy) * ui.view.k < 3) return;
        drag.moved = true;
        checkpoint();
        // a ring slot is computed, not stored: pin it down in this conference's layout before moving it
        if (drag.kind === 'player' && isNet() && !R().net[drag.id]) R().net[drag.id] = { x: drag.ox, y: drag.oy };
      }
      const pos = itemPos(drag.kind, drag.id);
      if (!pos) return;
      pos.x = +(drag.ox + dx).toFixed(1);
      pos.y = +(drag.oy + dy).toFixed(1);
      scheduleBoard();
    } else if (drag.type === 'pen' || drag.type === 'path') {
      const last = drag.pts[drag.pts.length - 1];
      if (Math.hypot(w.x - last[0], w.y - last[1]) * ui.view.k < (drag.type === 'path' ? 4 : 2)) return;
      drag.pts.push([+w.x.toFixed(1), +w.y.toFixed(1)]);
      drawTemp();
    } else if (drag.type === 'link') {
      drag.x = w.x; drag.y = w.y;
      drawTemp();
    } else if (drag.type === 'erase') {
      eraseAt(e);
    }
  }

  function onUp(e) {
    if (!drag) return;
    const d = drag;
    drag = null;
    svg.classList.remove('panning');
    try { svg.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    L.temp.innerHTML = '';
    if (d.type === 'pan') {
      if (!d.moved && d.deselect) select(null);
    } else if (d.type === 'move') {
      if (d.moved) { save(); renderBoard(); }
    } else if (d.type === 'pen') {
      if (d.pts.length >= 2) {
        mutate(() => R().strokes.push({ id: uid(), color: prefs.penColor, width: Math.max(2, prefs.tokenR / 6), points: d.pts }));
      }
    } else if (d.type === 'path') {
      const pts = d.pts;
      if (pts.length >= 2 && pathMeta(pts).len * ui.view.k > 8) {
        const end = pts[pts.length - 1];
        mutate(() => {
          R().paths[d.pid] = pts;
          R().positions[d.pid] = { x: end[0], y: end[1] }; // they end up where the route ends
        });
      }
    } else if (d.type === 'link') {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const tgt = el && el.closest && el.closest('[data-kind=token]');
      if (tgt && tgt.dataset.id !== d.from) toggleLink(d.from, tgt.dataset.id, prefs.linkType);
    } else if (d.type === 'erase') {
      if (d.erased) { save(); render(); }
    }
  }

  function drawTemp() {
    L.temp.innerHTML = '';
    if (!drag) return;
    if (drag.type === 'pen') {
      svgEl('path', {
        d: 'M' + drag.pts.map((p) => p.join(',')).join('L'), fill: 'none', stroke: prefs.penColor,
        'stroke-width': Math.max(2, prefs.tokenR / 6), 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      }, L.temp);
    } else if (drag.type === 'path') {
      const { color } = pathColor(drag.pid);
      const TR = prefs.tokenR;
      svgEl('path', {
        d: 'M' + drag.pts.map((p) => p.join(',')).join('L'), fill: 'none', stroke: color,
        'stroke-width': Math.max(2.5, TR / 7), 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      }, L.temp);
      const end = drag.pts[drag.pts.length - 1];
      const p = P(drag.pid);
      svgEl('circle', { cx: end[0], cy: end[1], r: TR * 0.6, fill: 'none', stroke: color, 'stroke-width': 3 }, L.temp);
      if (p) svgText(L.temp, p.name, end[0], end[1] - TR * 0.6 - 6, Math.max(10, TR * 0.5), color, 700);
    } else if (drag.type === 'link') {
      const A = tokenPos(drag.from);
      if (!A) return;
      const def = LINKS[prefs.linkType];
      svgEl('line', {
        x1: A.x, y1: A.y, x2: drag.x, y2: drag.y, stroke: def.color, 'stroke-width': Math.max(2.5, prefs.tokenR / 7),
        'stroke-dasharray': '6 4', 'marker-end': def.arrow ? `url(#arr-${prefs.linkType})` : null,
      }, L.temp);
    }
  }

  function toggleLink(a, b, type) {
    const r = R();
    const existing = r.links.find((l) => l.type === type && ((l.a === a && l.b === b) || (!LINKS[type].arrow && l.a === b && l.b === a)));
    mutate(() => {
      if (existing) r.links = r.links.filter((l) => l !== existing);
      else r.links.push({ id: uid(), a, b, type, note: '' });
    });
    toast(existing ? t('toast.linkRemoved', { type: linkLabel(type) }) : t('toast.linkAdded', { a: P(a).name, type: linkLabel(type), b: P(b).name }));
  }

  function eraseAt(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const hit = el && el.closest && el.closest('[data-kind]');
    if (!hit) return;
    const kind = hit.dataset.kind, id = hit.dataset.id;
    const r = R();
    if (kind === 'path') {
      if (!drag.erased) { checkpoint(); drag.erased = true; }
      delete r.paths[id];
      renderBoard();
      return;
    }
    const lists = { stroke: 'strokes', link: 'links', pin: 'pins', text: 'texts' };
    if (!lists[kind]) return;
    if (!drag.erased) { checkpoint(); drag.erased = true; }
    r[lists[kind]] = r[lists[kind]].filter((x) => x.id !== id);
    if (isSel(kind, id)) ui.sel = null;
    renderBoard();
  }

  function onWheel(e) {
    e.preventDefault();
    const r = svg.getBoundingClientRect();
    const delta = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
    zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-delta * 0.0015));
  }

  function placePlayer(pid, pos) {
    mutate(() => { R().positions[pid] = { x: +pos.x.toFixed(1), y: +pos.y.toFixed(1) }; });
  }

  function placeUnplaced() {
    if (isNet()) setView('map'); // new positions are map positions: place them where the user can see them
    const r = R(), TR = prefs.tokenR;
    const todo = S.players.filter((p) => !r.positions[p.id] && (prefs.showDead || !isDeadAt(p)));
    if (!todo.length) return toast(t('toast.allPlaced'));
    // grid around the middle of the current view: always visible, never under the floating toolbars
    const gx = TR * 3.2, gy = TR * 3.6;
    const cols = Math.min(todo.length, Math.max(1, Math.ceil(Math.sqrt(todo.length * 1.6))));
    const rows = Math.ceil(todo.length / cols);
    const c = viewCenterWorld();
    mutate(() => {
      todo.forEach((p, i) => {
        r.positions[p.id] = {
          x: +(c.x + ((i % cols) - (cols - 1) / 2) * gx).toFixed(1),
          y: +(c.y + (Math.floor(i / cols) - (rows - 1) / 2) * gy).toFixed(1),
        };
      });
    });
    toast(t('toast.placed', { n: todo.length }));
  }

  // ======================================================================
  // selection
  // ======================================================================
  function selectionExists() {
    const s = ui.sel;
    if (!s) return false;
    if (s.kind === 'player') return !!P(s.id);
    const r = R();
    const lists = { pin: r.pins, text: r.texts, link: r.links, stroke: r.strokes };
    return !!(lists[s.kind] && lists[s.kind].some((x) => x.id === s.id));
  }
  function select(kind, id) {
    ui.sel = kind ? { kind, id } : null;
    if (kind) setTab('inspect');
    renderBoard(); renderRoster(); renderInspector();
  }
  function focusInspector(selectAll) {
    requestAnimationFrame(() => {
      const el = $('#tabInspect [data-f]');
      if (el) { el.focus(); if (selectAll && el.select) el.select(); }
    });
  }
  function deleteSelected() {
    const s = ui.sel;
    if (!s) return;
    const r = R();
    if (s.kind === 'player') {
      if (isNet()) return; // everyone is always in the network; Del only unplaces from the map
      if (!r.positions[s.id]) return;
      mutate(() => { delete r.positions[s.id]; });
      toast(t('toast.unplaced', { label: R().label }));
      return;
    }
    const lists = { pin: 'pins', text: 'texts', link: 'links', stroke: 'strokes' };
    mutate(() => { r[lists[s.kind]] = r[lists[s.kind]].filter((x) => x.id !== s.id); ui.sel = null; });
  }
  function deletePlayer(pid) {
    stopPlay();
    const p = P(pid);
    if (!p || !confirm(t('confirm.deletePlayer', { name: p.name }))) return;
    mutate(() => {
      S.players = S.players.filter((x) => x.id !== pid);
      for (const r of S.rounds) {
        delete r.positions[pid];
        if (r.paths) delete r.paths[pid];
        delete r.tally[pid];
        delete r.net[pid];
        r.links = r.links.filter((l) => l.a !== pid && l.b !== pid);
        r.pins.forEach((pin) => {
          if (pin.victim === pid) pin.victim = null;
          pin.players = pin.players.filter((x) => x !== pid);
        });
      }
      ui.sel = null;
    });
  }
  function setTag(pid, tag) {
    const p = P(pid);
    if (!p || p.tag === tag) return;
    mutate(() => { p.tag = tag; });
  }
  function setStatus(pid, status) {
    const p = P(pid);
    if (!p || p.status === status) return;
    mutate(() => {
      p.status = status;
      p.diedRound = status === 'alive' ? null : (p.diedRound ?? S.roundIdx);
    });
  }
  /**
   * Roster quick status, relative to the conference on screen: marking someone dead/ejected while
   * they are still alive here means they went out in this conference; "alive" brings them back.
   */
  function quickStatus(pid, status) {
    const p = P(pid);
    if (!p || !STATUSES.some((x) => x.id === status)) return;
    const outNow = isDeadAt(p);
    if (status === 'alive') {
      if (!outNow) return;
      mutate(() => { p.status = 'alive'; p.diedRound = null; });
      toast(t('toast.statusAlive', { name: p.name }));
      return;
    }
    if (outNow && p.status === status) return;
    mutate(() => {
      p.status = status;
      if (!outNow) p.diedRound = S.roundIdx;
    });
    toast(t('toast.statusOut', { name: p.name, status: statusLabel(status), label: S.rounds[p.diedRound]?.label || R().label }));
  }

  // ======================================================================
  // view: map or relationship network
  // ======================================================================
  function setView(v) {
    if (v !== 'net') v = 'map';
    if (prefs.view === v) return;
    stopPlay();
    prefs.view = v;
    if (v === 'net' && !NET_TOOLS.includes(prefs.tool)) prefs.tool = 'select';
    savePrefs();
    L.temp.innerHTML = '';
    renderHeader();
    renderBoard();
    fit();
  }
  let viewSwitchSig = '';
  function renderViewSwitch() {
    const reset = isNet() && Object.keys(R().net).length > 0;
    const sig = [prefs.view, reset, GGDI18n.getLang()].join('|');
    if (sig === viewSwitchSig) return; // renderBoard runs every drag frame; only touch layout on change
    viewSwitchSig = sig;
    $$('#viewSwitch [data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === prefs.view));
    $('#netReset').classList.toggle('hidden', !reset);
    $('#toolbar').style.maxWidth = `calc(100% - ${$('#viewSwitch').offsetWidth + 42}px)`;
  }
  function resetNetLayout() {
    if (!Object.keys(R().net).length) return;
    mutate(() => { R().net = {}; });
    fit();
  }

  // ======================================================================
  // header, roster, inspector, round panel
  // ======================================================================
  function render(opts = {}) {
    renderHeader();
    renderBoard();
    renderRoster();
    if (opts.keep !== 'inspector') renderInspector();
    if (opts.keep !== 'round') renderRoundPanel();
  }

  function renderHeader() {
    const sel = $('#mapSelect');
    sel.innerHTML = allMaps().map((m) => `<option value="${esc(m.id)}">${esc(mapName(m))}</option>`).join('') +
      `<option value="__upload">${esc(t('map.upload'))}</option>`;
    sel.value = currentMap().id;
    $('#delMapBtn').classList.toggle('hidden', !currentMap().custom);

    $('#roundTabs').innerHTML = S.rounds.map((r, i) =>
      `<button data-ri="${i}" class="${i === S.roundIdx ? 'active' : ''}" title="${esc(t('top.round.title'))}">${esc(r.label)}</button>`).join('');

    $$('#toolbar [data-tool]').forEach((b) => {
      b.classList.toggle('active', b.dataset.tool === prefs.tool);
      // map-only tools stay clickable in the network view (they switch back to the map), just dimmed
      b.classList.toggle('map-only', isNet() && !NET_TOOLS.includes(b.dataset.tool));
    });
    renderToolOpts();
    $('#optPaths').checked = prefs.showPaths;
    $('#optVotes').checked = prefs.showVotes;
    $('#optClaims').checked = prefs.showClaims;
    $('#optDead').checked = prefs.showDead;
    $('#optSize').value = prefs.tokenR;
    renderPoiPanel();
  }
  function $$(s, el = document) { return Array.from(el.querySelectorAll(s)); }

  function renderToolOpts() {
    const el = $('#toolOpts');
    const swatches = (key) => COLORS.map((c) =>
      `<button class="swatch ${prefs[key] === c ? 'active' : ''}" data-color="${c}" data-key="${key}" style="background:${c}" title="${c}"></button>`).join('');
    switch (prefs.tool) {
      case 'pen': el.innerHTML = swatches('penColor'); break;
      case 'text': el.innerHTML = swatches('textColor'); break;
      case 'link':
        el.innerHTML = Object.entries(LINKS).map(([k, d]) =>
          `<button class="ltype ${prefs.linkType === k ? 'active' : ''}" data-ltype="${k}"><i style="background:${d.color}"></i>${esc(linkLabel(k))}</button>`).join('') +
          `<span class="hint">${esc(t('hint.link'))}</span>`;
        break;
      case 'pin':
        el.innerHTML = Object.entries(PIN_KINDS).map(([k, d]) =>
          `<button class="ltype ${prefs.pinKind === k ? 'active' : ''}" data-pkind="${k}"><i style="background:${d.color}"></i>${esc(pinLabel(k))}</button>`).join('');
        break;
      case 'eraser': el.innerHTML = `<span class="hint">${esc(t(isNet() ? 'hint.eraserNet' : 'hint.eraser'))}</span>`; break;
      case 'path': el.innerHTML = `<span class="hint">${esc(t('hint.path'))}</span>`; break;
      default: el.innerHTML = `<span class="hint">${esc(t(isNet() ? 'hint.selectNet' : 'hint.select'))}</span>`;
    }
  }

  function renderRoster() {
    const list = $('#rosterList');
    const r = R();
    const alive = S.players.filter((p) => !isDeadAt(p));
    const dead = S.players.filter((p) => isDeadAt(p));

    const counts = {};
    alive.forEach((p) => { counts[p.tag] = (counts[p.tag] || 0) + 1; });
    $('#summary').innerHTML = S.players.length
      ? `<span class="chip">${t('roster.alive.html', { alive: alive.length, total: S.players.length })}</span>` +
        TAGS.filter((x) => x.id !== 'unknown' && counts[x.id]).map((x) =>
          `<span class="chip"><i style="background:${x.color}"></i>${esc(tagLabel(x.id))} ${counts[x.id]}</span>`).join('')
      : `<span class="muted">${esc(t('roster.noGame'))}</span>`;

    if (!S.players.length) {
      list.innerHTML = `<div class="roster-empty">${t('roster.empty.html')}</div>`;
      return;
    }
    const item = (p) => {
      const tg = tagOf(p.tag);
      const d = isDeadAt(p);
      const st = d ? p.status : 'alive'; // as of the conference on screen
      const placed = !!r.positions[p.id];
      const gone = d ? t(p.status === 'ejected' ? 'roster.subEjected' : 'roster.subDead') + (p.diedRound != null ? ' ' + (S.rounds[p.diedRound]?.label || '') : '') : '';
      const sub = [p.claim, gone].filter(Boolean).join(' · ') || tagLabel(tg.id);
      const quick = STATUSES.map((x) =>
        `<button type="button" class="q-${x.id} ${st === x.id ? 'active' : ''}" data-qstatus="${x.id}" title="${esc(x.id === 'alive' ? t('roster.setAlive') : t('roster.setStatus', { status: statusLabel(x.id) }))}" aria-pressed="${st === x.id}">${STATUS_ICON[x.id]}</button>`).join('');
      return `<div class="r-item ${isSel('player', p.id) ? 'sel' : ''} ${d ? 'dead' : ''}" draggable="true" data-pid="${p.id}" style="border-left-color:${tg.color}" title="${esc(t('roster.item.title'))}">
        <img src="${esc(p.icon || '')}" alt="" draggable="false">
        <div style="min-width:0"><div class="r-name">${esc(p.name)}</div><div class="r-sub">${esc(sub)}</div></div>
        <div class="r-meta">
          <div class="r-top"><span class="r-placed">${placed ? esc(t('roster.onMap')) : ''}</span><span class="r-tag" data-cycle="1" style="background:${tg.color}" title="${esc(t('roster.cycle', { tag: tagLabel(tg.id) }))}"></span></div>
          <div class="r-status" role="group" aria-label="${esc(t('ins.status'))}">${quick}</div>
        </div>
      </div>`;
    };
    list.innerHTML =
      `<div class="roster-group">${esc(t('roster.groupAlive', { n: alive.length }))}</div>` + alive.map(item).join('') +
      (dead.length ? `<div class="roster-group">${esc(t('roster.groupDead', { n: dead.length }))}</div>` + dead.map(item).join('') : '');
  }

  function playerHistory(p) {
    return S.rounds.map((r, i) => {
      const bits = [];
      if (r.positions[p.id]) bits.push(t('hist.onMap'));
      if (r.paths && r.paths[p.id]) bits.push(t('hist.path'));
      if (r.tally[p.id]) bits.push(tn('hist.gotVotes', r.tally[p.id]));
      for (const pin of r.pins) {
        if (pin.kind === 'event' && pin.players.includes(p.id)) {
          bits.push(t('hist.event', { title: [timeLabel(pin.time), pin.text || t('conf.eventUntitled')].filter(Boolean).join(' ') }));
        }
      }
      for (const l of r.links) {
        if (l.a !== p.id && l.b !== p.id) continue;
        const other = P(l.a === p.id ? l.b : l.a)?.name || '?';
        const type = LINKS[l.type] ? l.type : 'with';
        if (type === 'with') bits.push(t('hist.with', { name: other }));
        else bits.push(t(l.a === p.id ? `hist.${type}` : `hist.${type}By`, { name: other }));
      }
      if (p.diedRound === i && p.status !== 'alive') bits.push(`<b style="color:var(--danger)">${esc(t(p.status === 'ejected' ? 'hist.ejected' : 'hist.dead'))}</b>`);
      return bits.length ? `<div><b>${esc(r.label)}</b>${bits.map((b) => (b.startsWith('<b') ? b : esc(b))).join(' · ')}</div>` : '';
    }).join('') || `<div class="muted">${esc(t('hist.none'))}</div>`;
  }

  function swatchRow(current, attr) {
    return `<div class="row">${COLORS.map((c) =>
      `<button class="swatch-btn ${current === c ? 'active' : ''}" ${attr}="${c}" style="background:${c}" title="${c}"></button>`).join('')}</div>`;
  }

  function renderInspector() {
    const el = $('#tabInspect');
    const s = ui.sel;
    if (!s || !selectionExists()) { el.innerHTML = helpHTML(); return; }
    const r = R();

    if (s.kind === 'player') {
      const p = P(s.id);
      const tg = tagOf(p.tag);
      const dead = isDeadAt(p);
      el.innerHTML = `
        <div class="ins-head ${dead ? 'dead' : ''}">
          <img src="${esc(p.icon || '')}" style="border-color:${tg.color}" alt="">
          <div class="stack" style="flex:1;min-width:0">
            <input class="name-input" data-f="name" value="${esc(p.name)}" spellcheck="false">
            <div class="muted">${esc(t(r.positions[p.id] ? 'ins.onMap' : 'ins.notPlaced', { label: r.label }))}</div>
          </div>
        </div>
        <h3>${esc(t('ins.read'))}</h3>
        <div class="tag-row">${TAGS.map((x) => `<button class="tag-btn ${p.tag === x.id ? 'active' : ''}" data-tag="${x.id}" style="color:${x.color}"><i style="background:${x.color}"></i><span style="color:var(--text)">${esc(tagLabel(x.id))}</span><kbd>${x.key}</kbd></button>`).join('')}</div>
        <h3>${esc(t('ins.status'))} <small class="muted" style="text-transform:none;letter-spacing:0">${esc(t('ins.statusHint'))}</small></h3>
        <div class="seg">${STATUSES.map((x) => `<button data-status="${x.id}" class="${p.status === x.id ? 'active' : ''}">${esc(statusLabel(x.id))}</button>`).join('')}</div>
        ${p.status !== 'alive' ? `<div class="row"><span class="muted" style="font-size:12px;white-space:nowrap">${esc(t('ins.since'))}</span><select data-died>${S.rounds.map((rr, i) => `<option value="${i}" ${p.diedRound === i ? 'selected' : ''}>${esc(rr.label)}</option>`).join('')}</select></div>` : ''}
        <h3>${esc(t('ins.claim'))}</h3>
        <input data-f="claim" list="roleList" value="${esc(p.claim)}" placeholder="${esc(t('ins.claim.ph'))}">
        <h3>${esc(t('ins.notes'))}</h3>
        <textarea data-f="notes" rows="5" placeholder="${esc(t('ins.notes.ph'))}">${esc(p.notes)}</textarea>
        <h3>${esc(t('ins.history'))}</h3>
        <div class="history">${playerHistory(p)}</div>
        <div class="row" style="flex-wrap:wrap">
          ${r.positions[p.id] ? `<button class="btn small" data-act="unplace">${esc(t('ins.unplace'))}</button>` : `<button class="btn small" data-act="place">${esc(t('ins.place'))}</button>`}
          ${r.paths[p.id] ? `<button class="btn small" data-act="clearPath">${esc(t('ins.clearPath'))}</button>` : ''}
          <button class="btn small" data-act="icon">${esc(t('ins.icon'))}</button>
          <button class="btn small danger" data-act="delete">${esc(t('ins.deletePlayer'))}</button>
        </div>`;
      return;
    }

    if (s.kind === 'pin') {
      const pin = r.pins.find((x) => x.id === s.id);
      const kindSeg = `
        <h3>${esc(t('ins.pinTitle', { kind: pinLabel(pin.kind) }))}</h3>
        <div class="seg">${Object.keys(PIN_KINDS).map((k) => `<button data-pkind="${k}" class="${pin.kind === k ? 'active' : ''}">${esc(pinLabel(k))}</button>`).join('')}</div>`;
      const del = `<div class="row"><button class="btn small danger" data-act="delete">${esc(t('ins.deletePin'))}</button></div>`;
      if (pin.kind === 'body') {
        el.innerHTML = `${kindSeg}
          <h3>${esc(t('ins.victim'))}</h3>
          <select data-victim><option value="">${esc(t('ins.victimNone'))}</option>${S.players.map((p) => `<option value="${p.id}" ${pin.victim === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
          <h3>${esc(t('ins.label'))}</h3>
          <input data-f="text" value="${esc(pin.text)}" placeholder="${esc(t('ins.pinLabel.ph'))}">
          ${del}`;
        return;
      }
      // event: what happened, when, who was involved, details
      const spanSel = `<select data-ptimesel title="${esc(t('time.clock'))}">
          <option value="">${esc(t('time.clockNone'))}</option>
          ${SPANS.map((k) => `<option value="${k}" ${pin.time === k ? 'selected' : ''}>${esc(timeLabel(k))}</option>`).join('')}
        </select>`;
      el.innerHTML = `${kindSeg}
        <h3>${esc(t('ins.evWhat'))}</h3>
        <input data-f="text" value="${esc(pin.text)}" placeholder="${esc(t('ins.evWhat.ph'))}">
        <h3>${esc(t('ins.evWhen'))}</h3>
        <div class="row ev-when">
          <div class="seg">${PHASES.map((k) => `<button data-ptime="${k}" class="${pin.time === k ? 'active' : ''}" ${pin.time === k ? `title="${esc(t('time.toggle'))}"` : ''}>${esc(timeLabel(k))}</button>`).join('')}</div>
          ${spanSel}
        </div>
        <h3>${esc(t('ins.evWho'))} <small class="muted">${esc(t('ins.evWhoHint'))}</small></h3>
        ${S.players.length ? `<div class="pchips">${S.players.map((p) => {
          const on = pin.players.includes(p.id);
          return `<button type="button" class="pchip ${on ? 'active' : ''} ${isDeadAt(p) ? 'dead' : ''}" data-pplayer="${p.id}" aria-pressed="${on}" style="--tag:${tagOf(p.tag).color}"><img src="${esc(p.icon || '')}" alt=""><span>${esc(p.name)}</span></button>`;
        }).join('')}</div>` : `<div class="muted">${esc(t('conf.importFirst'))}</div>`}
        <h3>${esc(t('ins.evDetails'))}</h3>
        <textarea data-f="note" rows="4" placeholder="${esc(t('ins.evDetails.ph'))}">${esc(pin.note)}</textarea>
        ${del}`;
      return;
    }

    if (s.kind === 'text') {
      const tx = r.texts.find((x) => x.id === s.id);
      el.innerHTML = `
        <h3>${esc(t('ins.textNote'))}</h3>
        <textarea data-f="text" rows="3" placeholder="${esc(t('text.default'))}">${esc(tx.text)}</textarea>
        <h3>${esc(t('ins.size'))}</h3>
        <input type="range" data-size min="10" max="72" value="${tx.size || 22}">
        <h3>${esc(t('ins.color'))}</h3>
        ${swatchRow(tx.color, 'data-tcolor')}
        <div class="row"><button class="btn small danger" data-act="delete">${esc(t('ins.deleteText'))}</button></div>`;
      return;
    }

    if (s.kind === 'link') {
      const l = r.links.find((x) => x.id === s.id);
      el.innerHTML = `
        <h3>${esc(t('ins.link'))}</h3>
        <div><b>${esc(P(l.a)?.name)}</b> <span class="muted">→</span> <b>${esc(P(l.b)?.name)}</b></div>
        <div class="seg ltype-seg">${Object.keys(LINKS).map((k) => `<button data-ltype="${k}" class="${l.type === k ? 'active' : ''}"><i style="background:${LINKS[k].color}"></i>${esc(linkLabel(k))}</button>`).join('')}</div>
        <h3>${esc(t('ins.note'))}</h3>
        <input data-f="note" value="${esc(l.note || '')}" placeholder="${esc(t('ins.linkNote.ph'))}">
        <div class="row"><button class="btn small" data-act="swap">${esc(t('ins.swap'))}</button><button class="btn small danger" data-act="delete">${esc(t('ins.deleteLink'))}</button></div>`;
      return;
    }

    if (s.kind === 'stroke') {
      const st = r.strokes.find((x) => x.id === s.id);
      el.innerHTML = `
        <h3>${esc(t('ins.drawing'))}</h3>
        ${swatchRow(st.color, 'data-scolor')}
        <div class="row"><button class="btn small danger" data-act="delete">${esc(t('ins.deleteDrawing'))}</button></div>`;
    }
  }

  function legendLine(color, dash, arrow, w = 1, mark = false) {
    return `<svg width="46" height="14"><line x1="2" y1="7" x2="${arrow ? 36 : 44}" y2="7" stroke="${color}" stroke-width="${3 * w}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>${arrow ? `<path d="M36,2 L45,7 L36,12z" fill="${color}"/>` : ''}${mark ? `<rect x="15" y="3" width="8" height="8" fill="${color}" stroke="#05080c" transform="rotate(45 19 7)"/><path d="M17,5L21,9M21,5L17,9" stroke="#fff" stroke-width="1.6"/>` : ''}</svg>`;
  }
  function legendBadge() {
    return `<svg width="46" height="14"><rect x="2" y="1" width="16" height="12" fill="${VOTE_COLOR}" stroke="#05080c"/><text x="10" y="11" text-anchor="middle" font-size="11" font-weight="800" fill="#140a1c" font-family="${FONT}">3</text></svg>`;
  }
  function helpHTML() {
    return `
      <h3>${esc(t('help.quick'))}</h3>
      <div class="help">${t('help.quick.html')}</div>
      <h3>${esc(t('help.keys'))}</h3>
      <div class="help">${t('help.keys.html')}</div>
      <h3>${esc(t('help.legend'))}</h3>
      <div class="legend">
        ${Object.entries(LINKS).map(([k, d]) => `${legendLine(d.color, d.dash, d.arrow, d.w, d.mark)}<span>${esc(linkLabel(k))}</span>`).join('')}
        ${legendBadge()}<span>${esc(t('help.vote'))}</span>
      </div>
      <div class="legend">
        ${TAGS.map((x) => `<svg width="46" height="14"><circle cx="8" cy="7" r="6" fill="${x.color}"/></svg><span>${esc(tagLabel(x.id))}</span>`).join('')}
      </div>`;
  }

  function renderRoundPanel() {
    const el = $('#tabRound');
    const r = R();
    // In the meeting: everyone not already out before it. Killed before it: no vote. Ejected at it:
    // still in the meeting when the votes were counted. Anyone with recorded votes stays listed.
    const inMeeting = (p) => !isDeadAt(p) || (p.status === 'ejected' && p.diedRound === S.roundIdx);
    const voters = S.players.filter(inMeeting);
    const listed = S.players.filter((p) => inMeeting(p) || r.tally[p.id]);
    const total = Object.values(r.tally).reduce((a, n) => a + n, 0);
    const max = Math.max(1, ...Object.values(r.tally));
    const top = Math.max(0, ...S.players.map((p) => r.tally[p.id] || 0));
    // rows keep roster order so they don't jump around while counting
    const voteRow = (id, label, icon) => {
      const n = r.tally[id] || 0;
      return `<div class="vote-row ${n && n === top && id !== 'skip' ? 'lead' : ''} ${id === 'skip' ? 'skip' : ''}" data-vpid="${id}">
        ${icon != null ? `<img src="${esc(icon)}" alt="">` : '<span class="skip-ico"></span>'}
        <span class="v-name">${label}</span>
        <div class="v-bar"><i style="width:${(n / max) * 100}%"></i></div>
        <div class="stepper">
          <button type="button" data-vstep="-1" ${n ? '' : 'disabled'} title="${esc(t('conf.voteDec'))}" aria-label="${esc(t('conf.voteDec'))}">−</button>
          <b>${n}</b>
          <button type="button" data-vstep="1" title="${esc(t('conf.voteInc'))}" aria-label="${esc(t('conf.voteInc'))}">+</button>
        </div>
      </div>`;
    };
    const voteBlock = S.players.length
      ? `<div class="muted vote-hint">${esc(t('conf.voteHint'))}</div>
         <div class="votes">${listed.map((p) => voteRow(p.id, esc(p.name), p.icon || '')).join('')}${voteRow('skip', `<i>${esc(t('conf.skip'))}</i>`, null)}</div>
         <div class="vote-total ${total > voters.length ? 'over' : ''}">${esc(t('conf.voteTotal', { total, voters: voters.length }))}</div>`
      : `<div class="muted">${esc(t('conf.importFirst'))}</div>`;
    const deaths = S.players.filter((p) => p.status !== 'alive' && p.diedRound === S.roundIdx);
    const bodies = r.pins.filter((p) => p.kind === 'body');
    const events = r.pins.filter((p) => p.kind === 'event')
      .map((p, i) => ({ p, i })).sort((a, b) => timeSortKey(a.p.time) - timeSortKey(b.p.time) || a.i - b.i).map((x) => x.p);
    const timeline = events.length
      ? `<div class="timeline">${events.map((ev) => {
          const who = ev.players.map(P).filter(Boolean);
          return `<button type="button" class="tl-row ${isSel('pin', ev.id) ? 'sel' : ''} ${ev.time ? '' : 'no-time'}" data-pin="${ev.id}">
            <span class="tl-time">${esc(timeLabel(ev.time) || t('time.unknown'))}</span>
            <span class="tl-body"><span class="tl-title">${esc(ev.text || t('conf.eventUntitled'))}</span>
              ${who.length ? `<span class="tl-who">${who.map((p) => `<img src="${esc(p.icon || '')}" alt="" title="${esc(p.name)}">`).join('')}<span>${esc(who.map((p) => p.name).join(t('list.sep')))}</span></span>` : ''}
            </span>
          </button>`;
        }).join('')}</div>`
      : `<div class="muted">${esc(t('conf.noEvents'))}</div>`;

    el.innerHTML = `
      <div class="row"><input data-r="label" value="${esc(r.label)}" style="font-weight:700"><span class="muted" style="white-space:nowrap">${S.roundIdx + 1} / ${S.rounds.length}</span></div>
      <div class="row conf-nav">
        <button class="btn small" data-act="prevConf" ${S.roundIdx === 0 ? 'disabled' : ''}>${esc(t('conf.prev'))}</button>
        <button class="btn small" data-act="nextConf" ${S.roundIdx >= S.rounds.length - 1 ? 'disabled' : ''}>${esc(t('conf.next'))}</button>
      </div>
      ${r.hasShot
        ? `<img id="shotThumb" class="shot-thumb" alt="${esc(t('conf.shotAlt'))}" title="${esc(t('conf.shotEnlarge'))}">`
        : `<div class="shot-none">${t('conf.noShot.html')}</div>`}
      <h3>${esc(t('conf.votes'))}</h3>
      ${voteBlock}
      <h3>${esc(t('conf.timeline'))}</h3>
      ${timeline}
      <h3>${esc(t('conf.deaths'))}</h3>
      <div class="history">${deaths.length || bodies.length
        ? deaths.map((p) => `<div><b>${esc(t(p.status === 'ejected' ? 'conf.ejected' : 'conf.dead'))}</b>${esc(p.name)}</div>`).join('') +
          bodies.map((b) => `<div><b>${esc(t('conf.bodyPin'))}</b>${esc(P(b.victim)?.name || t('conf.unknownVictim'))}${b.text ? ' — ' + esc(b.text) : ''}</div>`).join('')
        : `<div class="muted">${esc(t('conf.noneRecorded'))}</div>`}</div>
      <h3>${esc(t('conf.notes'))}</h3>
      <textarea data-r="notes" rows="6" placeholder="${esc(t('conf.notes.ph'))}">${esc(r.notes)}</textarea>
      <div class="row" style="flex-wrap:wrap">
        <button class="btn small" data-act="clearVotes">${esc(t('conf.clearVotes'))}</button>
        <button class="btn small danger" data-act="delRound" ${S.rounds.length < 2 ? 'disabled' : ''}>${esc(t('conf.delete'))}</button>
      </div>`;
    if (r.hasShot) {
      const rid = r.id;
      shotURL(rid).then((u) => {
        const im = $('#shotThumb');
        if (!im || R().id !== rid) return;
        if (u) { im.src = u; im.onclick = () => viewShot(rid); }
        else im.replaceWith(Object.assign(document.createElement('div'), { className: 'shot-none', textContent: t('conf.shotMissing') }));
      });
    }
  }

  function setTab(tab) {
    ui.tab = tab;
    $$('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $('#tabInspect').classList.toggle('hidden', tab !== 'inspect');
    $('#tabRound').classList.toggle('hidden', tab !== 'round');
  }

  // ======================================================================
  // rounds
  // ======================================================================
  function switchRound(i) {
    if (i < 0 || i >= S.rounds.length || i === S.roundIdx) return;
    stopPlay();
    S.roundIdx = i;
    if (ui.sel && ui.sel.kind !== 'player') ui.sel = null;
    save(); render();
  }
  function deleteRound() {
    if (S.rounds.length < 2) return;
    if (!confirm(t('conf.confirmDelete', { label: R().label }))) return;
    mutate(() => {
      const gone = S.roundIdx;
      S.rounds.splice(gone, 1);
      for (const p of S.players) {
        if (p.diedRound == null) continue;
        if (p.diedRound > gone) p.diedRound--;
        else if (p.diedRound === gone) p.diedRound = Math.max(0, gone - 1);
      }
      S.roundIdx = clamp(gone, 0, S.rounds.length - 1);
      ui.sel = null;
    });
  }

  // ======================================================================
  // conference screenshots
  // ======================================================================
  const shotCache = new Map(); // round id -> object URL
  async function shotURL(rid) {
    if (shotCache.has(rid)) return shotCache.get(rid);
    try {
      const row = await idb.shots.get(rid);
      if (!row) return null;
      const u = URL.createObjectURL(row.blob);
      shotCache.set(rid, u);
      return u;
    } catch { return null; }
  }
  async function saveShot(rid, canvas) {
    const scale = Math.min(1, 1600 / canvas.width);
    const c = document.createElement('canvas');
    c.width = Math.round(canvas.width * scale); c.height = Math.round(canvas.height * scale);
    c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
    await idb.shots.put({ id: rid, blob });
    if (shotCache.has(rid)) { URL.revokeObjectURL(shotCache.get(rid)); shotCache.delete(rid); }
  }
  async function pruneShots() {
    try {
      const live = new Set(S.rounds.map((r) => r.id));
      for (const k of await idb.shots.keys()) if (!live.has(k)) await idb.shots.del(k);
    } catch { /* IndexedDB unavailable */ }
  }
  let shotRid = null; // round whose screenshot the viewer shows, for re-translating its title
  function renderShotTitle() {
    const r = S.rounds.find((x) => x.id === shotRid);
    $('#shotTitle').textContent = r ? t('shot.titleFor', { label: r.label }) : t('shot.title');
  }
  async function viewShot(rid) {
    const u = await shotURL(rid);
    if (!u) return toast(t('shot.notFound'));
    shotRid = rid;
    renderShotTitle();
    $('#shotImg').src = u;
    $('#shotDlg').showModal();
  }

  // ======================================================================
  // icons
  // ======================================================================
  function imageDataToCanvas(img) {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
    return c;
  }
  function canvasToIcon(c) {
    const u = c.toDataURL('image/webp', 0.9);
    return u.startsWith('data:image/webp') ? u : c.toDataURL('image/png');
  }
  function generatedIcon(name) {
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const x = c.getContext('2d');
    x.fillStyle = `hsl(${h % 360} 45% 38%)`;
    x.fillRect(0, 0, 96, 96);
    x.fillStyle = '#fff';
    x.font = `700 40px ${FONT}`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(name.slice(0, 2).toUpperCase(), 48, 52);
    return canvasToIcon(c);
  }
  async function fileToSquareIcon(file) {
    const bmp = await createImageBitmap(file);
    const s = Math.min(bmp.width, bmp.height);
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    c.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, 96, 96);
    return canvasToIcon(c);
  }
  function pickFile(accept) {
    return new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = accept;
      inp.onchange = () => resolve(inp.files[0] || null);
      inp.click();
    });
  }

  // ======================================================================
  // screenshot import
  // ======================================================================
  const imp = { img: null, slots: [], rows: [], runId: 0, worker: null, status: null, cal: Object.assign({}, GGDParse.DEFAULT_CAL, LS.get(K.cal, {})) };

  function resetImport() {
    imp.runId++;
    imp.img = null; imp.src = null; imp.slots = []; imp.rows = [];
    const c = $('#importCanvas');
    c.width = 0; c.height = 0;
    $('#importEmpty').classList.remove('hidden');
    $('#importRows').innerHTML = '';
    setImportStatus('import.none');
  }

  function openImport(blob) {
    const dlg = $('#importDlg');
    if (!dlg.open) { resetImport(); dlg.showModal(); }
    syncCalUI();
    updateImportButtons();
    if (blob) loadImportImage(blob);
  }

  async function loadImportImage(blob) {
    try {
      const bmp = await createImageBitmap(blob);
      const c = document.createElement('canvas');
      c.width = bmp.width; c.height = bmp.height;
      const cx = c.getContext('2d', { willReadFrequently: true });
      cx.drawImage(bmp, 0, 0);
      imp.src = c;
      imp.img = cx.getImageData(0, 0, c.width, c.height);
      $('#importEmpty').classList.add('hidden');
      analyzeImport();
    } catch (e) {
      console.error(e);
      setImportStatus('import.badImage');
    }
  }

  /** Status is kept as key + vars so it can be re-rendered in another language. */
  function setImportStatus(key, vars, plural) {
    imp.status = { key, vars, plural };
    renderImportStatus();
  }
  function renderImportStatus() {
    const st = imp.status || { key: 'import.none' };
    $('#importStatus').textContent = st.plural != null ? tn(st.key, st.plural, st.vars) : t(st.key, st.vars);
  }

  function analyzeImport() {
    if (!imp.img) return;
    imp.slots = GGDParse.analyze(imp.img, imp.cal);
    drawImportPreview();
    imp.rows = imp.slots.filter((s) => s.occupied).map((s) => ({
      slot: s.index, include: true, dead: s.dead, name: '', ocr: '', conf: null, snapped: null, touched: false,
      icon: canvasToIcon(imageDataToCanvas(GGDParse.crop(imp.img, s.rects.icon, 96, 96))),
    }));
    renderImportRows();
    updateImportButtons();
    if (!imp.rows.length) {
      setImportStatus('import.noCards');
      return;
    }
    runOcr();
  }

  function drawImportPreview() {
    const c = $('#importCanvas');
    const W = imp.img.width, H = imp.img.height;
    const scale = Math.min(1, 1400 / W);
    c.width = Math.round(W * scale); c.height = Math.round(H * scale);
    const x = c.getContext('2d');
    x.drawImage(imp.src, 0, 0, c.width, c.height);
    x.lineWidth = 3;
    for (const s of imp.slots) {
      const r = s.rects.card;
      x.setLineDash(s.occupied ? [] : [6, 6]);
      x.strokeStyle = !s.occupied ? '#8a94a688' : s.dead ? '#ff4d5e' : '#4cd890';
      x.strokeRect(r.x * scale, r.y * scale, r.w * scale, r.h * scale);
      if (s.occupied) {
        const n = s.rects.name, ic = s.rects.icon;
        x.setLineDash([]);
        x.lineWidth = 1.5;
        x.strokeStyle = '#4aa8ff';
        x.strokeRect(n.x * scale, n.y * scale, n.w * scale, n.h * scale);
        x.strokeStyle = '#ffb340';
        x.strokeRect(ic.x * scale, ic.y * scale, ic.w * scale, ic.h * scale);
        x.lineWidth = 3;
      }
    }
    x.setLineDash([]);
  }

  function findExisting(name) {
    const n = name.trim().toUpperCase();
    if (!n) return null;
    const exact = S.players.find((p) => p.name.toUpperCase() === n);
    if (exact) return exact;
    const snap = GGDParse.snapName(n, S.players.map((p) => p.name.toUpperCase()));
    return snap ? S.players.find((p) => p.name.toUpperCase() === snap) : null;
  }

  function renderImportRows() {
    const box = $('#importRows');
    box.innerHTML = '';
    imp.rows.forEach((row, i) => {
      const div = document.createElement('div');
      div.className = 'i-row' + (row.include ? '' : ' off');
      div.dataset.i = i;
      div.innerHTML = `
        <input type="checkbox" data-inc ${row.include ? 'checked' : ''} data-i18n-title="import.row.include" title="${esc(t('import.row.include'))}">
        <img src="${row.icon}" alt="">
        <div style="min-width:0">
          <input type="text" data-name value="${esc(row.name)}" placeholder="${esc(row.conf == null ? t('import.row.reading') : t('import.row.typeNameBlank', { n: row.slot + 1 }))}" spellcheck="false">
          <div class="i-meta"></div>
        </div>
        <label data-i18n-title="import.row.deadTitle" title="${esc(t('import.row.deadTitle'))}"><input type="checkbox" data-dead ${row.dead ? 'checked' : ''}> <span data-i18n="import.row.dead">${esc(t('import.row.dead'))}</span></label>`;
      box.appendChild(div);
      updateImportRowMeta(i);
    });
  }

  function updateImportRowMeta(i) {
    const row = imp.rows[i];
    const div = $(`#importRows .i-row[data-i="${i}"]`);
    if (!div) return;
    const inp = div.querySelector('[data-name]');
    if (document.activeElement !== inp) inp.value = row.name;
    inp.placeholder = row.conf == null ? t('import.row.reading') : t('import.row.typeNameBlank', { n: row.slot + 1 });
    const ex = findExisting(row.name);
    const bits = [];
    if (row.conf != null) bits.push(`<span class="conf ${row.conf < 60 ? 'low' : ''}">${Math.round(row.conf)}%</span>`);
    if (row.snapped) bits.push(`<span title="${esc(t('import.row.snapped'))}">${esc(t('import.row.ocr', { text: row.ocr }))}</span>`);
    if (S.players.length && row.name) bits.push(ex ? `<span class="match">${esc(t('import.row.match', { name: ex.name }))}</span>` : `<span>${esc(t('import.row.new'))}</span>`);
    div.querySelector('.i-meta').innerHTML = bits.join('');
  }

  async function getWorker() {
    if (!imp.worker) {
      imp.worker = (async () => {
        const w = await Tesseract.createWorker('eng', 1, {
          workerPath: abs('vendor/tesseract/worker.min.js'),
          corePath: abs('vendor/core'),
          langPath: abs('vendor/lang'),
        });
        await w.setParameters({
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_',
          tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
        });
        return w;
      })();
      imp.worker.catch(() => { imp.worker = null; });
    }
    return imp.worker;
  }

  async function runOcr() {
    const id = ++imp.runId;
    setImportStatus('import.loading');
    let w;
    try {
      if (location.protocol === 'file:') throw new Error('file:// page');
      w = await Promise.race([getWorker(), new Promise((_, rej) => setTimeout(() => rej(new Error('OCR load timeout')), 30000))]);
    } catch (e) {
      console.error(e);
      imp.worker = null;
      if (id !== imp.runId) return;
      setImportStatus(location.protocol === 'file:' ? 'import.needServer' : 'import.ocrFailed');
      imp.rows.forEach((r, i) => { r.conf = 0; updateImportRowMeta(i); });
      updateImportButtons();
      return;
    }
    const known = knownNames().map((n) => n.toUpperCase());
    for (let i = 0; i < imp.rows.length; i++) {
      if (id !== imp.runId) return;
      const row = imp.rows[i];
      const slot = imp.slots[row.slot];
      setImportStatus('import.reading', { i: i + 1, n: imp.rows.length });
      const results = [];
      for (const up of [2, 3, 4]) {
        const { bitmap } = GGDParse.nameBitmap(imp.img, slot.rects.name, up);
        const { data } = await w.recognize(imageDataToCanvas(bitmap));
        if (id !== imp.runId) return;
        results.push({ text: data.text, confidence: data.confidence });
      }
      const v = GGDParse.voteName(results);
      row.ocr = v.name;
      row.conf = v.confidence;
      const snapped = v.name ? GGDParse.snapName(v.name, known) : null;
      row.snapped = snapped && snapped !== v.name ? snapped : null;
      if (!row.touched) row.name = snapped || v.name;
      updateImportRowMeta(i);
    }
    const dead = imp.rows.filter((r) => r.dead).length;
    setImportStatus('import.found', { dead }, imp.rows.length);
    updateImportButtons();
  }

  function updateImportButtons() {
    const any = imp.rows.some((r) => r.include);
    const hasGame = S.players.length > 0;
    $('#importNew').disabled = !any;
    $('#importUpdate').disabled = !any || !hasGame;
    $('#importNext').disabled = !any || !hasGame;
    $('#importUpdate').textContent = t('import.update', { label: R().label });
    $('#importNext').textContent = t('import.next', { label: 'C' + (S.rounds.length + 1) });
    $('#importNew').classList.toggle('primary', !hasGame);
    $('#importNext').classList.toggle('primary', hasGame);
  }

  /** mode: 'new' game | 'next' conference | 'update' the current conference */
  async function applyImport(mode) {
    const rows = imp.rows.filter((r) => r.include);
    if (!rows.length) return;
    if (mode === 'new' && S.players.length && !confirm(t('import.confirmNew'))) return;
    imp.runId++; // stop any OCR still running
    checkpoint();
    if (mode === 'new') { S = newGame(S.mapId); ui.sel = null; }
    if (mode === 'next') {
      S.rounds.push(newRound(S.rounds.length + 1));
      S.roundIdx = S.rounds.length - 1;
      if (ui.sel && ui.sel.kind !== 'player') ui.sel = null;
    }
    let added = 0, died = 0;
    for (const row of rows) {
      const name = (row.name.trim() || row.ocr || `P${row.slot + 1}`).slice(0, 20);
      let p = mode === 'new' ? null : findExisting(name);
      if (!p) {
        p = { id: uid(), name, icon: row.icon, status: row.dead ? 'dead' : 'alive', diedRound: row.dead ? S.roundIdx : null, tag: 'unknown', claim: '', notes: '' };
        S.players.push(p);
        added++;
      } else {
        if (row.dead && p.status === 'alive') { p.status = 'dead'; p.diedRound = S.roundIdx; died++; }
        if (!p.icon || p.iconGenerated) { p.icon = row.icon; p.iconGenerated = false; }
      }
    }
    rememberNames(rows.map((r) => r.name.trim().toUpperCase()).filter(Boolean));
    const r = R();
    save(); render();
    $('#importDlg').close();
    // store the screenshot in the background; the board doesn't wait on JPEG encoding
    const rid = r.id;
    saveShot(rid, imp.src).then(() => {
      const target = S.rounds.find((x) => x.id === rid); // S may have been swapped by undo meanwhile
      if (!target) return;
      target.hasShot = true;
      save();
      if (R().id === rid) renderRoundPanel();
    }).catch((e) => console.warn('screenshot not stored', e));
    toast(mode === 'new' ? tn('toast.newGame', added)
      : mode === 'next' ? t('toast.nextConf', { label: r.label, died, extra: added ? t('toast.nextConfNew', { n: added }) : '' })
      : t('toast.updated', { label: r.label, added, died }));
  }

  function syncCalUI() {
    const c = imp.cal;
    $('#calX').value = c.offX; $('#calXv').textContent = c.offX;
    $('#calY').value = c.offY; $('#calYv').textContent = c.offY;
    $('#calS').value = c.scale; $('#calSv').textContent = (+c.scale).toFixed(3);
  }
  let calTimer = 0;
  function onCalChange() {
    imp.cal = { offX: +$('#calX').value, offY: +$('#calY').value, scale: +$('#calS').value };
    LS.set(K.cal, imp.cal);
    syncCalUI();
    if (!imp.img) return;
    imp.slots = GGDParse.analyze(imp.img, imp.cal);
    drawImportPreview();
    clearTimeout(calTimer);
    calTimer = setTimeout(analyzeImport, 450);
  }

  // ======================================================================
  // export / save / load
  // ======================================================================
  async function blobToDataURL(blob) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(blob);
    });
  }
  async function exportPng() {
    // map view: the whole map image; network view: the frame around the ring
    const b = boardBounds();
    const w = Math.round(b.w), h = Math.round(b.h);
    // render without selection outlines for the snapshot
    const prevSel = ui.sel;
    ui.sel = null;
    tokenNodes.forEach((g) => { g.__sig = null; });
    renderBoard();
    const clone = svg.cloneNode(true);
    ui.sel = prevSel;
    tokenNodes.forEach((g) => { g.__sig = null; });
    renderBoard();
    clone.setAttribute('width', w);
    clone.setAttribute('height', h);
    clone.setAttribute('viewBox', `${b.x} ${b.y} ${w} ${h}`);
    clone.removeAttribute('class');
    clone.querySelector('#vp').removeAttribute('transform');
    clone.querySelector('#lTemp').innerHTML = '';
    if (isNet()) clone.querySelector('#lMap').innerHTML = '';
    const mi = clone.querySelector('[data-map]');
    if (mi) {
      const blob = await (await fetch(mi.getAttribute('href'))).blob();
      mi.setAttribute('href', await blobToDataURL(blob));
    }
    const xml = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
    await img.decode();
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cx = c.getContext('2d');
    cx.fillStyle = '#111214';
    cx.fillRect(0, 0, w, h);
    cx.drawImage(img, 0, 0, w, h);
    const kind = isNet() ? 'network' : 'board';
    c.toBlob((blob) => download(blob, `prts-${kind}-${R().label}-${stamp()}.png`), 'image/png');
  }
  async function saveJson() {
    flushSave();
    const shots = {};
    for (const r of S.rounds) {
      if (!r.hasShot) continue;
      try { const row = await idb.shots.get(r.id); if (row) shots[r.id] = await blobToDataURL(row.blob); } catch { /* skip */ }
    }
    download(new Blob([JSON.stringify({ ...S, shots })], { type: 'application/json' }), `prts-game-${stamp()}.json`);
  }
  async function loadJson(file) {
    try {
      const raw = JSON.parse(await file.text());
      const shots = raw && raw.shots;
      if (raw) delete raw.shots;
      const s = sanitize(raw);
      if (!s) throw new Error(t('toast.notGame'));
      for (const [rid, url] of Object.entries(shots || {})) {
        try {
          await idb.shots.put({ id: rid, blob: await (await fetch(url)).blob() });
          if (shotCache.has(rid)) { URL.revokeObjectURL(shotCache.get(rid)); shotCache.delete(rid); }
        } catch { /* skip broken shot */ }
      }
      checkpoint();
      S = s; ui.sel = null;
      save(); render();
      toast(t('toast.loaded'));
    } catch (e) {
      toast(t('toast.loadFailed', { msg: e instanceof SyntaxError ? t('toast.badJson') : e.message }));
    }
  }

  // ======================================================================
  // events
  // ======================================================================
  function isTyping(e) {
    const t = e.target;
    if (!t) return false;
    if (t.tagName === 'INPUT') return !['checkbox', 'radio', 'range', 'button', 'submit', 'file', 'color'].includes(t.type);
    return t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable;
  }
  function setTool(t) {
    if (isNet() && !NET_TOOLS.includes(t)) { prefs.tool = t; setView('map'); return; } // drawing tools live on the map
    prefs.tool = t; savePrefs();
    renderHeader(); renderBoard();
  }

  function bind() {
    // board
    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onUp);
    svg.addEventListener('wheel', onWheel, { passive: false });
    svg.addEventListener('contextmenu', (e) => e.preventDefault());
    svg.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); }); // no autoscroll
    svg.addEventListener('dblclick', (e) => {
      const hit = e.target.closest && e.target.closest('[data-kind]');
      if (hit && hit.dataset.kind !== 'token') focusInspector(true);
      else if (hit) { select('player', hit.dataset.id); focusInspector(); }
    });
    svg.addEventListener('dragover', (e) => {
      if (!isNet() && e.dataTransfer.types.includes('text/prts-player')) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
    });
    svg.addEventListener('drop', (e) => {
      const pid = e.dataTransfer.getData('text/prts-player');
      if (!pid || isNet()) return;
      e.preventDefault(); e.stopPropagation();
      placePlayer(pid, toWorld(e));
      select('player', pid);
    });
    new ResizeObserver(() => { if (!ui.fitted) { ui.fitted = true; fit(); } }).observe(svg);

    // toolbar
    $('#toolbar').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.tool) return setTool(b.dataset.tool);
      if (b.dataset.color) { prefs[b.dataset.key] = b.dataset.color; savePrefs(); renderToolOpts(); }
      if (b.dataset.ltype) { prefs.linkType = b.dataset.ltype; savePrefs(); renderToolOpts(); }
      if (b.dataset.pkind) { prefs.pinKind = b.dataset.pkind; savePrefs(); renderToolOpts(); }
    });
    $('#viewSwitch').addEventListener('click', (e) => {
      const b = e.target.closest('[data-view]');
      if (b) setView(b.dataset.view);
    });
    $('#netReset').onclick = resetNetLayout;
    $('#zoomIn').onclick = () => zoomCenter(1.25);
    $('#zoomOut').onclick = () => zoomCenter(0.8);
    $('#zoomFit').onclick = fit;
    $('#playBtn').onclick = togglePlay;
    $('#playStop').onclick = stopPlay;
    $('#playScrub').addEventListener('input', (e) => scrubPlay(+e.target.value / 1000));
    $('#playSpeed').addEventListener('change', (e) => { prefs.playSpeed = +e.target.value; savePrefs(); });
    $('#playMode').addEventListener('change', (e) => { prefs.playMode = e.target.value; savePrefs(); renderBoard(); });
    const opt = (id, key) => $(id).addEventListener('change', (e) => { prefs[key] = e.target.checked; savePrefs(); render(); });
    opt('#optPaths', 'showPaths'); opt('#optVotes', 'showVotes'); opt('#optClaims', 'showClaims'); opt('#optDead', 'showDead');
    $('#optSize').addEventListener('input', (e) => { prefs.tokenR = +e.target.value; savePrefs(); renderBoard(); });
    $('#poiList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-g]');
      if (!b) return;
      prefs.poi[b.dataset.g] = !prefs.poi[b.dataset.g];
      savePrefs(); renderPoiPanel(); renderBoard();
    });
    $('#poiLabels').addEventListener('change', (e) => { prefs.poiLabels = e.target.checked; savePrefs(); renderBoard(); });
    $('#poiFold').onclick = () => { prefs.poiOpen = !prefs.poiOpen; savePrefs(); renderPoiPanel(); };

    // header
    $('#mapSelect').addEventListener('change', (e) => {
      if (e.target.value === '__upload') { e.target.value = currentMap().id; $('#mapFile').click(); return; }
      S.mapId = e.target.value; save(); render();
    });
    $('#mapFile').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) uploadMap(f); });
    $('#delMapBtn').onclick = async () => {
      const m = currentMap();
      if (!m.custom || !confirm(t('map.confirmDelete', { name: m.name }))) return;
      try { await idb.maps.del(m.id); } catch { /* session-only map */ }
      customMaps = customMaps.filter((x) => x.id !== m.id);
      S.mapId = 'basement'; save(); render();
    };
    $('#roundTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-ri]'); if (b) switchRound(+b.dataset.ri); });
    $('#roundTabs').addEventListener('dblclick', async (e) => {
      const b = e.target.closest('[data-ri]');
      if (!b) return;
      const r = S.rounds[+b.dataset.ri];
      const name = await promptText('conf.rename', null, r.label);
      if (name) mutate(() => { r.label = name.slice(0, 24); });
    });
    $('#importBtn').onclick = () => openImport();
    // every language switch (top bar + inside the import dialog)
    document.addEventListener('click', (e) => {
      const b = e.target.closest('.lang-seg [data-lang]');
      if (b && b.dataset.lang !== GGDI18n.getLang()) GGDI18n.setLang(b.dataset.lang);
    });
    GGDI18n.onChange(onLangChange);
    $('#menuBtn').onclick = (e) => { e.stopPropagation(); $('#menuList').classList.toggle('hidden'); };
    document.addEventListener('click', () => $('#menuList').classList.add('hidden'));
    $('#menuList').addEventListener('click', async (e) => {
      const act = e.target.dataset.act;
      if (!act) return;
      $('#menuList').classList.add('hidden');
      if (act === 'new') {
        if (confirm(t('confirm.newGame'))) mutate(() => { S = newGame(S.mapId); ui.sel = null; });
      } else if (act === 'addPlayer') {
        const name = await promptText('prompt.addPlayer', 'prompt.addPlayerMsg');
        if (name) mutate(() => S.players.push({ id: uid(), name: name.slice(0, 20), icon: generatedIcon(name), iconGenerated: true, status: 'alive', diedRound: null, tag: 'unknown', claim: '', notes: '' }));
      } else if (act === 'exportPng') {
        exportPng().catch((err) => { console.error(err); toast(t('toast.pngFailed')); });
      } else if (act === 'saveJson') saveJson().catch((err) => { console.error(err); toast(t('toast.saveFailed')); });
      else if (act === 'loadJson') $('#jsonFile').click();
      else if (act === 'clearRound') {
        if (confirm(t('confirm.clearRound', { label: R().label }))) { stopPlay(); mutate(() => { const r = R(); r.strokes = []; r.paths = {}; r.links = []; r.pins = []; r.texts = []; r.net = {}; ui.sel = null; }); }
      } else if (act === 'unplaceAll') mutate(() => { R().positions = {}; });
    });
    $('#jsonFile').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) loadJson(f); });

    // roster
    const rl = $('#rosterList');
    rl.addEventListener('click', (e) => {
      const it = e.target.closest('[data-pid]');
      if (!it) return;
      const pid = it.dataset.pid;
      if (e.target.dataset.cycle) {
        const p = P(pid);
        const i = TAGS.findIndex((t) => t.id === p.tag);
        setTag(pid, TAGS[(i + 1) % TAGS.length].id);
        return;
      }
      const qs = e.target.closest('[data-qstatus]');
      if (qs) return quickStatus(pid, qs.dataset.qstatus);
      select('player', pid);
      const pos = isNet() ? netPos(pid) : R().positions[pid];
      if (pos) centerOn(pos);
    });
    rl.addEventListener('dblclick', (e) => {
      const it = e.target.closest('[data-pid]');
      if (!it || isNet() || e.target.closest('[data-qstatus], [data-cycle]') || R().positions[it.dataset.pid]) return;
      placePlayer(it.dataset.pid, viewCenterWorld());
    });
    rl.addEventListener('dragstart', (e) => {
      const it = e.target.closest('[data-pid]');
      if (!it) return;
      e.dataTransfer.setData('text/prts-player', it.dataset.pid);
      e.dataTransfer.effectAllowed = 'move';
    });
    $('#placeAllBtn').onclick = placeUnplaced;

    // side tabs
    $('.tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });

    // inspector
    const ins = $('#tabInspect');
    // one undo step per field edit: checkpoint on the first keystroke after focus
    let insNeedCp = false;
    ins.addEventListener('focusin', () => { insNeedCp = true; });
    ins.addEventListener('input', (e) => {
      const s = ui.sel;
      if (!s) return;
      if (insNeedCp) { checkpoint(); insNeedCp = false; }
      const r = R();
      const f = e.target.dataset.f;
      if (f !== undefined) {
        const obj = s.kind === 'player' ? P(s.id) : s.kind === 'pin' ? r.pins.find((x) => x.id === s.id)
          : s.kind === 'text' ? r.texts.find((x) => x.id === s.id) : s.kind === 'link' ? r.links.find((x) => x.id === s.id) : null;
        if (!obj) return;
        obj[f] = f === 'name' ? e.target.value.slice(0, 20) : e.target.value;
        save(); renderBoard(); renderRoster();
        if (s.kind === 'pin') renderRoundPanel();
      } else if (e.target.dataset.size !== undefined) {
        const t = r.texts.find((x) => x.id === s.id);
        if (t) { t.size = +e.target.value; save(); renderBoard(); }
      }
    });
    ins.addEventListener('change', (e) => {
      const s = ui.sel;
      if (!s) return;
      const r = R();
      if (e.target.dataset.victim !== undefined) {
        const pin = r.pins.find((x) => x.id === s.id);
        const vid = e.target.value || null;
        mutate(() => {
          pin.victim = vid;
          const v = vid && P(vid);
          if (v && v.status === 'alive' && pin.kind === 'body') { v.status = 'dead'; v.diedRound = S.roundIdx; toast(t('toast.markedDead', { name: v.name })); }
        });
      } else if (e.target.dataset.died !== undefined) {
        const p = P(s.id);
        mutate(() => { p.diedRound = +e.target.value; });
      } else if (e.target.dataset.ptimesel !== undefined) {
        const pin = r.pins.find((x) => x.id === s.id);
        if (pin) mutate(() => { pin.time = isTimeKey(e.target.value) ? e.target.value : ''; });
      }
    });
    ins.addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      const s = ui.sel;
      if (!b || !s) return;
      const r = R();
      if (b.dataset.tag) return setTag(s.id, b.dataset.tag);
      if (b.dataset.status) return setStatus(s.id, b.dataset.status);
      if (b.dataset.pkind) { const pin = r.pins.find((x) => x.id === s.id); return mutate(() => { pin.kind = b.dataset.pkind; ensurePinFields(pin); }); }
      if (b.dataset.ptime) {
        // clicking the active phase again clears the time
        const pin = r.pins.find((x) => x.id === s.id);
        return mutate(() => { pin.time = pin.time === b.dataset.ptime ? '' : b.dataset.ptime; });
      }
      if (b.dataset.pplayer) {
        const pin = r.pins.find((x) => x.id === s.id), pid = b.dataset.pplayer;
        const scroll = $('#tabInspect').scrollTop;
        mutate(() => { pin.players = pin.players.includes(pid) ? pin.players.filter((x) => x !== pid) : [...pin.players, pid]; });
        $('#tabInspect').scrollTop = scroll;
        $(`#tabInspect [data-pplayer="${pid}"]`)?.focus({ preventScroll: true });
        return;
      }
      if (b.dataset.ltype) { const l = r.links.find((x) => x.id === s.id); return mutate(() => { l.type = b.dataset.ltype; }); }
      if (b.dataset.tcolor) { const t = r.texts.find((x) => x.id === s.id); return mutate(() => { t.color = b.dataset.tcolor; }); }
      if (b.dataset.scolor) { const st = r.strokes.find((x) => x.id === s.id); return mutate(() => { st.color = b.dataset.scolor; }); }
      const act = b.dataset.act;
      if (act === 'delete') return s.kind === 'player' ? deletePlayer(s.id) : deleteSelected();
      if (act === 'unplace') {
        // direct, not via deleteSelected(): that one ignores players in the network view (Del key)
        if (!r.positions[s.id]) return;
        mutate(() => { delete r.positions[s.id]; });
        return toast(t('toast.unplaced', { label: r.label }));
      }
      if (act === 'clearPath') { stopPlay(); return mutate(() => { delete r.paths[s.id]; }); }
      if (act === 'place') {
        if (isNet()) setView('map');
        return placePlayer(s.id, viewCenterWorld());
      }
      if (act === 'swap') { const l = r.links.find((x) => x.id === s.id); return mutate(() => { [l.a, l.b] = [l.b, l.a]; }); }
      if (act === 'icon') {
        const f = await pickFile('image/*');
        if (!f) return;
        const icon = await fileToSquareIcon(f);
        const p = P(s.id);
        mutate(() => { p.icon = icon; p.iconGenerated = false; });
      }
    });

    // round panel
    const rp = $('#tabRound');
    let rpNeedCp = false;
    rp.addEventListener('focusin', () => { rpNeedCp = true; });
    rp.addEventListener('input', (e) => {
      const k = e.target.dataset.r;
      if (k === undefined) return;
      if (rpNeedCp) { checkpoint(); rpNeedCp = false; }
      R()[k] = k === 'label' ? e.target.value.slice(0, 24) : e.target.value;
      save();
      if (k === 'label') renderHeader();
    });
    rp.addEventListener('click', (e) => {
      const step = e.target.closest('[data-vstep]');
      if (step) {
        const id = step.closest('[data-vpid]').dataset.vpid, d = +step.dataset.vstep;
        const tally = R().tally, n = Math.max(0, (tally[id] || 0) + d);
        if (n === (tally[id] || 0)) return;
        const scroll = rp.scrollTop;
        mutate(() => { if (n) tally[id] = n; else delete tally[id]; });
        rp.scrollTop = scroll;
        // keep keyboard focus on the same button after the panel re-renders
        const again = $(`#tabRound [data-vpid="${id}"] [data-vstep="${d}"]`);
        if (again && !again.disabled) again.focus({ preventScroll: true });
        else $(`#tabRound [data-vpid="${id}"] [data-vstep="1"]`)?.focus({ preventScroll: true });
        return;
      }
      const tl = e.target.closest('[data-pin]');
      if (tl) {
        const pin = R().pins.find((x) => x.id === tl.dataset.pin);
        if (!pin) return;
        if (isNet()) setView('map');
        select('pin', pin.id);
        centerOn(pin);
        return;
      }
      const act = e.target.dataset.act;
      if (act === 'prevConf') switchRound(S.roundIdx - 1);
      else if (act === 'nextConf') switchRound(S.roundIdx + 1);
      else if (act === 'delRound') deleteRound();
      else if (act === 'clearVotes') { if (Object.keys(R().tally).length) mutate(() => { R().tally = {}; }); }
    });

    // import dialog
    $('#importFile').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) loadImportImage(f); });
    const drop = $('#importDrop');
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault(); e.stopPropagation(); drop.classList.remove('over');
      const f = [...e.dataTransfer.files].find((x) => x.type.startsWith('image/'));
      if (f) loadImportImage(f);
    });
    const rows = $('#importRows');
    rows.addEventListener('input', (e) => {
      const div = e.target.closest('.i-row');
      if (!div) return;
      const row = imp.rows[+div.dataset.i];
      if (e.target.dataset.name !== undefined) { row.name = e.target.value; row.touched = true; updateImportRowMeta(+div.dataset.i); }
      updateImportButtons();
    });
    rows.addEventListener('change', (e) => {
      const div = e.target.closest('.i-row');
      if (!div) return;
      const row = imp.rows[+div.dataset.i];
      if (e.target.dataset.inc !== undefined) { row.include = e.target.checked; div.classList.toggle('off', !row.include); }
      if (e.target.dataset.dead !== undefined) row.dead = e.target.checked;
      updateImportButtons();
    });
    ['#calX', '#calY', '#calS'].forEach((id) => $(id).addEventListener('input', onCalChange));
    $('#calReset').onclick = () => {
      imp.cal = Object.assign({}, GGDParse.DEFAULT_CAL);
      syncCalUI(); onCalChange();
    };
    $('#importNew').onclick = () => applyImport('new');
    $('#importUpdate').onclick = () => applyImport('update');
    $('#importNext').onclick = () => applyImport('next');
    $('#shotDlg').addEventListener('click', () => $('#shotDlg').close());
    $('#importDlg').addEventListener('close', () => { imp.runId++; });

    // paste & drop screenshots anywhere
    document.addEventListener('paste', (e) => {
      const items = e.clipboardData ? [...e.clipboardData.items] : [];
      const it = items.find((x) => x.kind === 'file' && x.type.startsWith('image/'));
      if (!it) return;
      e.preventDefault();
      openImport(it.getAsFile());
    });
    let dragDepth = 0;
    // Only files dragged in from outside the page count. A drag that starts inside the
    // page (a roster item, or any <img> such as an icon or the shot thumbnail) reports
    // 'Files' in Chrome, because an image drag carries the image as a file. dragstart
    // fires only for drags that originate in this document, so it marks those.
    let internalDrag = false;
    document.addEventListener('dragstart', () => { internalDrag = true; }, true);
    const hasFiles = (e) => !internalDrag && !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    const hideDropHint = () => { dragDepth = 0; $('#dropHint').classList.add('hidden'); };
    window.addEventListener('dragenter', (e) => { if (hasFiles(e)) { dragDepth++; $('#dropHint').classList.remove('hidden'); } });
    window.addEventListener('dragleave', (e) => { if (hasFiles(e) && --dragDepth <= 0) hideDropHint(); });
    window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
    // capture phase: the board's drop handler stops propagation, so a bubbling listener
    // would never see it and the hint would stay up
    window.addEventListener('drop', hideDropHint, true);
    // dragend fires on the source after any drop, so the internal flag is cleared last
    window.addEventListener('dragend', () => { hideDropHint(); internalDrag = false; }, true);
    window.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      const f = [...e.dataTransfer.files];
      const img = f.find((x) => x.type.startsWith('image/'));
      const json = f.find((x) => x.name.endsWith('.json'));
      if (img) openImport(img);
      else if (json) loadJson(json);
    });

    // keyboard
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && !isTyping(e)) {
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); return undo(); }
        if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); return redo(); }
        return;
      }
      if (isTyping(e) || document.querySelector('dialog[open]') || e.altKey) return;
      if (e.code === 'Space') { e.preventDefault(); spaceHeld = true; svg.classList.add('panning'); return; }
      const k = e.key.toLowerCase();
      const tools = { v: 'select', r: 'path', p: 'pen', l: 'link', b: 'pin', t: 'text', e: 'eraser' };
      if (k === 'g') return isNet() ? undefined : togglePlay();
      if (k === 'n') return setView(isNet() ? 'map' : 'net');
      if (tools[k]) return setTool(tools[k]);
      if (k === 'f') return fit();
      if (k === '[') return switchRound(S.roundIdx - 1);
      if (k === ']') return switchRound(S.roundIdx + 1);
      if (k === 'escape') return select(null);
      if (k === 'delete' || k === 'backspace') { e.preventDefault(); return deleteSelected(); }
      if (ui.sel && ui.sel.kind === 'player') {
        const tag = TAGS.find((t) => t.key === e.key);
        if (tag) return setTag(ui.sel.id, tag.id);
        if (k === 'd') {
          const p = P(ui.sel.id);
          const i = STATUSES.findIndex((x) => x.id === p.status);
          return setStatus(p.id, STATUSES[(i + 1) % STATUSES.length].id);
        }
      }
    });
    document.addEventListener('keyup', (e) => {
      if (e.code === 'Space') { spaceHeld = false; if (!drag) svg.classList.remove('panning'); }
    });
    window.addEventListener('blur', () => { spaceHeld = false; svg.classList.remove('panning'); });
    window.addEventListener('beforeunload', flushSave);
  }

  // ======================================================================
  // language
  // ======================================================================
  function renderLangSwitch() {
    const lang = GGDI18n.getLang();
    $$('.lang-seg [data-lang]').forEach((b) => b.classList.toggle('active', b.dataset.lang === lang));
  }
  function renderRoleList() {
    $('#roleList').innerHTML = GGDI18n.roleList().map((name) => `<option value="${esc(name)}">`).join('');
  }
  /** Static markup is already re-applied by i18n.js; redo everything app.js renders. */
  function onLangChange(lang) {
    prefs.lang = lang; savePrefs();
    $('#toast').classList.add('hidden'); // a toast already showing is in the old language
    renderLangSwitch();
    renderRoleList();
    render();
    renderImportStatus();
    imp.rows.forEach((_, i) => updateImportRowMeta(i));
    updateImportButtons();
    renderPromptText();
    renderShotTitle();
  }

  // ======================================================================
  // boot
  // ======================================================================
  async function boot() {
    GGDI18n.setLang(prefs.lang); // before bind(): applies static text only, nothing to re-render yet
    renderLangSwitch();
    renderRoleList();
    buildDefs();
    bind();
    setTab('inspect');
    if (location.protocol === 'file:') $('#fileWarn').classList.remove('hidden');
    await loadCustomMaps();
    render();
    pruneShots();
  }
  boot();
})();
