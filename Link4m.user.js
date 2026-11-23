// ==UserScript==
// @name         bypass l4m by duydepzai
// @namespace    local.duydepzai.l4m
// @version      2.1.0
// @description  Automated Link4m flow and widget resolver
// @author       duydepzai
// @match        *://link4m.app/*
// @match        *://*.link4m.app/*
// @match        *://link4m.com/*
// @match        *://*.link4m.com/*
// @match        *://link4m.net/*
// @match        *://*.link4m.net/*
// @match        *://link4m.org/*
// @match        *://*.link4m.org/*
// @run-at       document-idle
// @noframes
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// @grant        GM_info
// @grant        unsafeWindow
// @connect      *
// ==/UserScript==

(() => {
  'use strict';

  if (window.__bypassL4mLoaded) return;
  window.__bypassL4mLoaded = true;

  const CONFIG = Object.freeze({
    requestTimeoutMs: 30000,
    pageWaitMs: 60000,
    imageWaitMs: 8000,
    recaptchaWaitMs: 300000,
    maxWidgetAttempts: 5,
    maxWidgetSteps: 4,
    maxImageCandidates: 4,
    ocrSpaceApiKeys: ['helloworld', 'K88289434888957', 'K87569947288957'],
    ocrSpaceEndpoint: 'https://api.ocr.space/parse/image',
    tesseractCdn: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
    storeUrl: 'https://robuxvien.com/home',
    communityUrl: 'https://discord.gg/rcRBbzTfqB'
  });

  const KNOWN_SUFFIXES = new Set(
    'com.vn net.vn edu.vn org.vn gov.vn info.vn pro.vn ac.vn health.vn name.vn co.uk org.uk com.au com.sg com.my com.ph co.jp co.kr co.id co.th com.br vn com net org io info co me xyz app dev top site online store club pro tv cc gg asia biz us uk ca de jp kr sg id th my ph lat icu fun space tech website lol click link live news blog shop vip win work world zone ai to sh fm ly gl it es fr ru br in au nl se no pl cz ch at be dk fi gr hk tw nz za mx ar cl pe ve ua ro hu tr sa ae pk bd lk np mm kh la bn mobi name page life today cloud digital media network systems solutions services games game apk download cc cc33'.split(' ')
  );

  const REJECTED_HOSTS = /^(?:www\.)?(?:google\.[a-z.]+|link4m\.[a-z.]+|gstatic\.com|googleapis\.com|googleusercontent\.com|cloudflare\.com|youtube\.com|youtu\.be|facebook\.com|fb\.com|chrome\.google\.com|android\.com|apple\.com|microsoft\.com|w3\.org|schema\.org|example\.com)$/i;

  const state = {
    ui: {},
    busy: false,
    autoDetecting: false,
    panelOpen: true,
    currentUrl: location.href,
    isGoogleInstruction: false,
    status: 'Initializing...',
    statusTone: 'info',
    spinning: true,
    targetDeadline: 0,
    totalDuration: 0,
    stepLabel: '',
    finalUrl: '',
    autoRedirect: true,
    cachedTesseractLoader: null,
    dragOffset: { x: 0, y: 0 }
  };

  const STYLES = `
    :host, :host * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
    .root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; color: #e9f4fa; font-size: 13px; line-height: 1.4; }
    .panel { position: fixed; right: 16px; bottom: 16px; width: min(380px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); overflow-y: auto; border-radius: 18px; border: 1px solid #3d6a80; background: linear-gradient(165deg, #101c26 0%, #060a0f 100%); box-shadow: 0 16px 40px rgba(0,0,0,0.65), 0 0 24px rgba(79, 184, 232, 0.15); z-index: 2147483647; touch-action: none; }
    .head { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.08); cursor: move; }
    .title { flex: 1; font-size: 14px; font-weight: 800; letter-spacing: 0.3px; color: #f0f7fb; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .badge { font-family: monospace; font-size: 10px; font-weight: 700; color: #7de0ff; background: rgba(79,184,232,0.18); border: 1px solid rgba(79,184,232,0.4); padding: 3px 6px; border-radius: 6px; }
    button { font: inherit; cursor: pointer; outline: 0; }
    .btn-min { border: 0; border-radius: 8px; color: #a4c2d1; background: rgba(255,255,255,0.08); width: 28px; height: 28px; display: grid; place-items: center; font-size: 18px; }
    .btn-min:hover { background: rgba(255,255,255,0.14); color: #fff; }
    .status-bar { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 12.5px; font-weight: 600; min-height: 48px; }
    .status-bar.info { color: #bee3f5; }
    .status-bar.ok { color: #8ee2b5; }
    .status-bar.warn { color: #f5cf89; }
    .status-bar.err { color: #ff9890; }
    .spinner { width: 13px; height: 13px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.15); border-top-color: #6fe1ff; animation: spin 0.8s linear infinite; flex-shrink: 0; }
    .spinner.off { display: none; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .msg { flex: 1; word-break: break-word; }
    .clock { font-family: monospace; font-weight: 700; font-size: 12px; color: #7de0ff; }
    .progress-bar { height: 3px; background: rgba(255,255,255,0.08); position: relative; }
    .progress-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #4fb8e8, #88e8ff); transition: width 0.25s linear; }
    .banner { display: none; margin: 10px 14px 0; border-radius: 10px; padding: 10px 12px; font-size: 12px; font-weight: 700; background: rgba(235, 178, 64, 0.16); border: 1px solid rgba(235, 178, 64, 0.45); color: #ffe6aa; align-items: center; gap: 8px; }
    .banner.show { display: flex; }
    .form-wrap { display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; }
    .input-box { display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 0 12px; }
    .input-box:focus-within { border-color: #55caee; }
    .url-input { border: 0; background: transparent; padding: 11px 0; color: #fff; font-size: 13px; outline: 0; flex: 1; min-width: 0; user-select: text; }
    .url-input::placeholder { color: #6e8494; }
    .url-input:disabled { opacity: 0.6; }
    .btn-main { border: 0; border-radius: 11px; padding: 11px; background: linear-gradient(135deg, #75dcfa, #3aaad6); color: #05141e; font-size: 13.5px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 6px; }
    .btn-main:hover { filter: brightness(1.08); }
    .btn-main:disabled { opacity: 0.45; cursor: not-allowed; filter: none; }
    .row-btns { display: flex; gap: 8px; }
    .btn-sec { flex: 1; padding: 9px; border-radius: 10px; border: 1px solid rgba(115, 195, 230, 0.28); background: rgba(79, 184, 232, 0.12); color: #d4f2ff; font-size: 12.5px; font-weight: 700; }
    .btn-sec:hover { background: rgba(79, 184, 232, 0.2); }
    .btn-sec.alt { border-color: rgba(144, 164, 255, 0.35); background: rgba(114, 137, 218, 0.14); color: #dde3ff; }
    .btn-sec.alt:hover { background: rgba(114, 137, 218, 0.22); }
    .btn-switch { border-color: rgba(247, 185, 85, 0.4); background: rgba(247, 185, 85, 0.12); color: #ffe6aa; font-weight: 800; }
    .btn-switch:hover { background: rgba(247, 185, 85, 0.22); }
    .pref-row { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: #9bb7c7; cursor: pointer; margin-top: 2px; }
    .pref-row input { accent-color: #55caee; }
    .result-panel { display: none; margin: 0 14px 12px; padding: 10px; border-radius: 12px; background: rgba(46, 125, 85, 0.2); border: 1px solid rgba(88, 196, 138, 0.4); }
    .result-panel.show { display: block; }
    .result-header { font-size: 11px; font-weight: 800; letter-spacing: 0.8px; color: #8ae4af; }
    .result-content { font-family: monospace; font-size: 11.5px; background: rgba(0,0,0,0.35); border-radius: 8px; padding: 8px; margin: 6px 0; max-height: 75px; overflow-y: auto; word-break: break-all; color: #dcf7e7; user-select: text; }
    .result-actions { display: flex; gap: 8px; }
    .btn-act { flex: 1; padding: 9px; border: 0; border-radius: 8px; font-weight: 800; font-size: 12px; }
    .btn-act.copy { background: #5ec790; color: #071e12; }
    .btn-act.open { background: rgba(88, 196, 138, 0.25); color: #d4f7e2; border: 1px solid rgba(88, 196, 138, 0.5); }
    .fab-btn { display: none; position: fixed; right: 16px; bottom: 16px; width: 50px; height: 50px; border-radius: 16px; border: 1px solid rgba(115, 203, 235, 0.4); background: linear-gradient(145deg, #12222e, #091118); color: #8de3ff; font-size: 20px; font-weight: 900; box-shadow: 0 10px 28px rgba(0,0,0,0.6); z-index: 2147483647; cursor: pointer; place-items: center; }
    .fab-btn.show { display: grid; }
    @media (max-width: 480px) { .panel { width: calc(100vw - 20px); right: 10px; bottom: 10px; } }
  `;

  const MARKUP = `
    <div class="root">
      <div class="panel" id="panel">
        <div class="head" id="dragHead">
          <strong class="title">bypass l4m by duydepzai</strong>
          <span class="badge">v2.1</span>
          <button type="button" class="btn-min" id="btnMin" title="Minimize">−</button>
        </div>
        <div class="status-bar info" id="statusBar">
          <span class="spinner" id="spinner"></span>
          <span class="msg" id="statusMsg">Initializing...</span>
          <span class="clock" id="statusClock"></span>
        </div>
        <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
        <div class="banner" id="captchaBanner">
          <span>⚠️</span>
          <span>Please complete the reCAPTCHA checkbox below.</span>
        </div>
        <form class="form-wrap" id="mainForm" novalidate>
          <div class="input-box">
            <span>🔗</span>
            <input class="url-input" id="taskInput" type="text" inputmode="url" placeholder="Task URL (e.g. gavangtv33.cc)" />
          </div>
          <button type="submit" class="btn-main" id="btnStart">Execute</button>
          <button type="button" class="btn-sec btn-switch" id="btnSwitch">🔀 Switch Task / Campaign</button>
          <div class="row-btns">
            <button type="button" class="btn-sec" id="btnStore">Store</button>
            <button type="button" class="btn-sec alt" id="btnServer">Server</button>
          </div>
          <label class="pref-row">
            <input type="checkbox" id="chkRedirect" checked />
            Auto-open target link when finished
          </label>
        </form>
        <div class="result-panel" id="resultPanel">
          <div class="result-header">✓ TARGET RESOLVED</div>
          <div class="result-content" id="resultUrl"></div>
          <div class="result-actions">
            <button type="button" class="btn-act copy" id="btnCopy">Copy</button>
            <button type="button" class="btn-act open" id="btnOpen">Open Link</button>
          </div>
        </div>
      </div>
      <button type="button" class="fab-btn" id="fabBtn" title="Open Menu">⚡</button>
    </div>
  `;

  function initUI() {
    if (state.ui.host || !document.body) return;
    const host = document.createElement('div');
    host.id = 'bypass-l4m-host';
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const styleEl = document.createElement('style');
    styleEl.textContent = STYLES;
    shadowRoot.appendChild(styleEl);

    const appContainer = document.createElement('div');
    appContainer.innerHTML = MARKUP;
    shadowRoot.appendChild(appContainer);
    document.body.appendChild(host);

    const q = (id) => shadowRoot.getElementById(id);
    state.ui = {
      host, shadowRoot,
      panel: q('panel'), dragHead: q('dragHead'), btnMin: q('btnMin'),
      statusBar: q('statusBar'), statusMsg: q('statusMsg'), statusClock: q('statusClock'),
      spinner: q('spinner'), progressFill: q('progressFill'), captchaBanner: q('captchaBanner'),
      mainForm: q('mainForm'), taskInput: q('taskInput'), btnStart: q('btnStart'),
      btnSwitch: q('btnSwitch'), btnStore: q('btnStore'), btnServer: q('btnServer'), chkRedirect: q('chkRedirect'),
      resultPanel: q('resultPanel'), resultUrl: q('resultUrl'), btnCopy: q('btnCopy'),
      btnOpen: q('btnOpen'), fabBtn: q('fabBtn')
    };

    setupDragEvents();
    q('btnMin').addEventListener('click', () => setDisplayMode(false));
    q('fabBtn').addEventListener('click', () => setDisplayMode(true));
    q('btnSwitch').addEventListener('click', forceSwitchCampaign);
    q('btnStore').addEventListener('click', () => openUrl(CONFIG.storeUrl));
    q('btnServer').addEventListener('click', () => openUrl(CONFIG.communityUrl));
    q('btnCopy').addEventListener('click', copyTargetUrl);
    q('btnOpen').addEventListener('click', () => state.finalUrl && openUrl(state.finalUrl));
    q('chkRedirect').addEventListener('change', (e) => { state.autoRedirect = e.target.checked; });

    q('mainForm').addEventListener('submit', (e) => {
      e.preventDefault();
      void startBypassProcess(state.ui.taskInput.value);
    });

    setInterval(refreshClockDisplay, 200);
    refreshClockDisplay();
    refreshActionButtons();
  }

  function setDisplayMode(opened) {
    state.panelOpen = Boolean(opened);
    state.ui.panel.style.display = state.panelOpen ? 'block' : 'none';
    state.ui.fabBtn.classList.toggle('show', !state.panelOpen);
  }

  function setupDragEvents() {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    const onPointerDown = (e) => {
      if (e.target.closest('#btnMin')) return;
      isDragging = true;
      const rect = state.ui.panel.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      startX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      startY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
      state.ui.panel.style.right = 'auto';
      state.ui.panel.style.bottom = 'auto';
      state.ui.panel.style.left = `${initialLeft}px`;
      state.ui.panel.style.top = `${initialTop}px`;
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const currentX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      const currentY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
      const dx = currentX - startX;
      const dy = currentY - startY;
      const nextLeft = Math.max(8, Math.min(window.innerWidth - state.ui.panel.offsetWidth - 8, initialLeft + dx));
      const nextTop = Math.max(8, Math.min(window.innerHeight - state.ui.panel.offsetHeight - 8, initialTop + dy));
      state.ui.panel.style.left = `${nextLeft}px`;
      state.ui.panel.style.top = `${nextTop}px`;
    };

    const onPointerUp = () => {
      isDragging = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    state.ui.dragHead.addEventListener('pointerdown', onPointerDown);
  }

  function updateStatus(msg, { tone = 'info', spin = false } = {}) {
    state.status = String(msg);
    state.statusTone = tone;
    state.spinning = spin;
    if (!state.ui.statusMsg) return;
    state.ui.statusMsg.textContent = state.status;
    state.ui.statusBar.className = `status-bar ${tone}`;
    state.ui.spinner.classList.toggle('off', !spin);
  }

  function setCountdown(durationMs, label = '') {
    state.stepLabel = label;
    state.totalDuration = durationMs;
    state.targetDeadline = Date.now() + durationMs;
    refreshClockDisplay();
  }

  function refreshClockDisplay() {
    if (!state.ui.statusClock) return;
    const now = Date.now();
    if (state.targetDeadline <= now) {
      state.ui.statusClock.textContent = '';
      if (!state.busy) state.ui.progressFill.style.width = '0%';
      return;
    }
    const rem = Math.max(0, Math.ceil((state.targetDeadline - now) / 1000));
    const label = rem >= 60 ? `${Math.floor(rem / 60)}:${String(rem % 60).padStart(2, '0')}` : `${rem}s`;
    state.ui.statusClock.textContent = label;
    const pct = Math.max(0, Math.min(100, 100 * (1 - (state.targetDeadline - now) / state.totalDuration)));
    state.ui.progressFill.style.width = `${pct}%`;
  }

  function refreshActionButtons() {
    if (!state.ui.btnStart) return;
    const isLocked = state.busy || state.autoDetecting;
    state.ui.btnStart.disabled = isLocked;
    state.ui.taskInput.disabled = isLocked;
    if (state.ui.btnSwitch) state.ui.btnSwitch.disabled = isLocked;
    state.ui.btnStart.textContent = state.busy ? 'Working...' : state.autoDetecting ? 'OCR Scanning...' : 'Execute';
  }

  async function forceSwitchCampaign() {
    try {
      updateStatus('Flushing cookies & requesting new campaign...', { tone: 'warn', spin: true });
      if (state.ui.btnSwitch) {
        state.ui.btnSwitch.disabled = true;
        state.ui.btnSwitch.textContent = 'Switching...';
      }

      try {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
          const eqPos = cookie.indexOf('=');
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${location.hostname}`;
          const rootDomain = location.hostname.split('.').slice(-2).join('.');
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${rootDomain}`;
        }
      } catch {}

      try { localStorage.clear(); } catch {}
      try { sessionStorage.clear(); } catch {}

      try {
        if (typeof GM_setValue === 'function') {
          GM_setValue('_l4m_cid_default', typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
        }
      } catch {}

      const cleanUrl = new URL(location.href);
      cleanUrl.searchParams.delete('token');
      cleanUrl.searchParams.delete('uuid');
      cleanUrl.searchParams.set('_l4m_switch', String(Date.now()));

      await sleep(400);
      location.replace(cleanUrl.href);
    } catch (err) {
      console.error('[bypass-l4m] Switch error', err);
      location.reload();
    }
  }

  function presentResult(url) {
    state.finalUrl = url;
    state.ui.resultUrl.textContent = url;
    state.ui.resultPanel.classList.add('show');
    state.ui.progressFill.style.width = '100%';
    updateStatus('✓ Target URL successfully obtained', { tone: 'ok', spin: false });
    if (state.autoRedirect) {
      setTimeout(() => openUrl(url), 900);
    }
  }

  function openUrl(url) {
    try { window.open(url, '_blank', 'noopener,noreferrer'); }
    catch (err) { console.warn('[bypass-l4m] Open failed', err); }
  }

  async function copyTargetUrl() {
    if (!state.finalUrl) return;
    try {
      if (typeof GM_setClipboard === 'function') {
        GM_setClipboard(state.finalUrl);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(state.finalUrl);
      }
      state.ui.btnCopy.textContent = 'Copied!';
      setTimeout(() => { if (state.ui.btnCopy) state.ui.btnCopy.textContent = 'Copy'; }, 2000);
    } catch {
      updateStatus('Clipboard copy failed', { tone: 'warn' });
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
  }

  async function httpRequest(url, { method = 'GET', headers = {}, body, timeoutMs = CONFIG.requestTimeoutMs, responseType = 'text' } = {}) {
    const opts = {
      url: String(url),
      method: method.toUpperCase(),
      headers,
      timeout: timeoutMs,
      responseType: responseType === 'arraybuffer' ? 'arraybuffer' : 'text',
      data: body,
      anonymous: true
    };

    const gmRequest = typeof GM !== 'undefined' && typeof GM.xmlHttpRequest === 'function'
      ? GM.xmlHttpRequest.bind(GM)
      : typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : null;

    if (gmRequest) {
      return new Promise((resolve, reject) => {
        let isDone = false;
        const finalize = (fn, val) => {
          if (isDone) return;
          isDone = true;
          fn(val);
        };
        try {
          gmRequest({
            ...opts,
            onload: (res) => finalize(resolve, {
              status: Number(res.status) || 0,
              responseText: res.responseText || '',
              response: res.response,
              finalUrl: res.finalUrl || res.responseURL || url
            }),
            onerror: (err) => finalize(reject, new Error(err?.error || err?.statusText || 'Network fault')),
            ontimeout: () => finalize(reject, new Error('HTTP request timeout')),
            onabort: () => finalize(reject, new Error('Request aborted'))
          });
        } catch (e) { finalize(reject, e); }
      });
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const resp = await fetch(url, {
        method: opts.method,
        headers,
        body,
        credentials: 'omit',
        signal: ctrl.signal
      });
      return {
        status: resp.status,
        responseText: responseType === 'arraybuffer' ? '' : await resp.text(),
        response: responseType === 'arraybuffer' ? await resp.arrayBuffer() : undefined,
        finalUrl: resp.url
      };
    } finally { clearTimeout(timer); }
  }

  function getBaseHeaders(ref = state.currentUrl) {
    let origin = location.origin;
    try { origin = new URL(ref).origin; } catch {}
    return {
      'accept': '*/*',
      'accept-language': 'en-US,en;q=0.9,vi;q=0.8',
      'cache-control': 'no-cache',
      'pragma': 'no-cache',
      'referer': `${origin}/`
    };
  }

  function getFormHeaders(ref = state.currentUrl) {
    return { ...getBaseHeaders(ref), 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' };
  }

  function serializeParams(map) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(map)) {
      if (v == null) continue;
      q.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
    return q.toString();
  }

  function extractStringProp(source, name) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = String(source).match(new RegExp(`(?:var|let|const)\\s+${esc}\\s*=\\s*['"]([^'"]+)['"]`, 'i'));
    return m ? m[1].replace(/\\x([\da-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))) : null;
  }

  function extractNumberProp(source, name) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = String(source).match(new RegExp(`(?:var|let|const)\\s+${esc}\\s*=\\s*['"]?(-?[\\d.]+)`, 'i'));
    return m ? Number(m[1]) : null;
  }

  function locateWidgetScripts(html) {
    const scripts = [];
    const tracker = new Set();
    const regex = /<script[^>]+src=["'](?:https?:)?\/\/([^\/"']+)\/widget\/(service(?:-v\d+)?\.js)\?([^"']*)["']/gi;
    for (const match of html.matchAll(regex)) {
      const hostname = match[1];
      const key = new URLSearchParams(match[3].replace(/&amp;/g, '&')).get('key');
      const sig = `${hostname}/${key}`;
      if (!key || tracker.has(sig)) continue;
      tracker.add(sig);
      scripts.push({ hostname, key, url: `https://${hostname}/widget/${match[2]}?key=${encodeURIComponent(key)}` });
    }
    return scripts;
  }

  function parseWidgetPayload(html) {
    if (!/var\s+get_code\s*=\s*true/i.test(html)) return null;
    const allRefs = [...html.matchAll(/var\s+ref_domain_list\s*=\s*\[([^\]]*)\]/gi)]
      .flatMap((m) => [...m[1].matchAll(/["']([^"']+)["']/g)].map((p) => p[1]));
    const filtered = allRefs.filter((r) => /google/i.test(r) === state.isGoogleInstruction);
    if (state.isGoogleInstruction && filtered.length === 0) return null;
    if (!state.isGoogleInstruction && allRefs.length > 0) return null;

    const endpoints = [...new Set((html.match(/(?:get_code|get_quest_code)\.html/g) || []))];
    if (!endpoints.length) return null;

    let domain = extractStringProp(html, 'traffic_domain');
    if (!domain) {
      const varMatch = html.match(/["']https?:\/\/["']\s*\+\s*([A-Za-z_$][\w$]*)\s*\+\s*["']\/widget\//);
      if (varMatch) domain = extractStringProp(html, varMatch[1]);
    }
    let key = extractStringProp(html, 'traffic_key');
    let code = extractStringProp(html, 'traffic_id');
    let session = extractStringProp(html, 'traffic_session');
    const cVar = html.match(/[?&]code=["']\s*\+\s*([A-Za-z_$][\w$]*)/);
    const kVar = html.match(/[?&]key=["']\s*\+\s*([A-Za-z_$][\w$]*)/);
    const sVar = html.match(/traffic_session=["']\s*\+\s*([A-Za-z_$][\w$]*)/);
    if (!code && cVar) code = extractStringProp(html, cVar[1]);
    if (!key && kVar) key = extractStringProp(html, kVar[1]);
    if (!session && sVar) session = extractStringProp(html, sVar[1]);
    if (!session) {
      const fallback = html.match(/var\s+[A-Za-z_$][\w$]*\s*=\s*["']([a-f\d]{24})["']/i);
      session = fallback ? fallback[1] : null;
    }
    if (!key || !code || !session || !domain) return null;
    domain = domain.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    if (!/^[a-z\d.-]+$/i.test(domain) || !domain.includes('.')) return null;

    return {
      domain, key, code, session,
      uuidName: extractStringProp(html, 'uuid_name'),
      totalSteps: endpoints[0] === 'get_quest_code.html' ? 2 : 1,
      endpoint: endpoints[0],
      waitSeconds: extractNumberProp(html, 'traffic_wait_time') ?? 0,
      nextWaitSeconds: extractNumberProp(html, 'traffic_step_2_wait_time') ?? 0
    };
  }

  function getClientFingerprint(uuidName) {
    const key = `_l4m_cid_${uuidName || 'default'}`;
    let cid = '';
    try {
      if (typeof GM_getValue === 'function') cid = GM_getValue(key, '');
      if (!cid) {
        cid = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
        if (typeof GM_setValue === 'function') GM_setValue(key, cid);
      }
    } catch {
      cid = `${Date.now()}-${Math.random()}`;
    }

    let urlObj;
    try { urlObj = new URL(state.currentUrl); }
    catch { urlObj = new URL(location.href); }

    return {
      screen: `${window.screen?.width || 1920} x ${window.screen?.height || 1080}`,
      browser: 'Chrome',
      browserVersion: '124.0.0.0',
      browserMajorVersion: 124,
      mobile: false,
      os: 'Windows',
      osVersion: '10',
      cookies: true,
      flashVersion: 'no check',
      lang: 'en-US',
      client_id: cid,
      pathname: urlObj.pathname,
      href: urlObj.href,
      hostname: urlObj.hostname
    };
  }

  function sanitizeClientChallenge(scriptBody, initialDetails) {
    if (!scriptBody || !scriptBody.trim()) return initialDetails;
    try {
      const sandbox = { ...initialDetails };
      const exec = new Function('jscd', `${scriptBody}\nreturn typeof jscd === 'object' && jscd ? jscd : null;`);
      const res = exec(sandbox);
      return res || initialDetails;
    } catch {
      return initialDetails;
    }
  }

  async function fetchWidgetDoc(widget) {
    try {
      const res = await httpRequest(widget.url, { headers: getBaseHeaders() });
      if (res.status < 200 || res.status >= 400) return null;
      const parsed = parseWidgetPayload(res.responseText);
      return parsed ? { html: res.responseText, parsed, widget } : null;
    } catch {
      return null;
    }
  }

  async function resolveWidgetFlow(widgetState) {
    let page = widgetState;
    let prevId = null;
    let prevDetails = null;
    let totalSteps = widgetState.parsed.totalSteps;

    for (let step = 1; step <= Math.min(CONFIG.maxWidgetSteps, totalSteps); step++) {
      const parsed = page.parsed;
      const initialDetails = prevDetails || getClientFingerprint(parsed.uuidName);
      const postBody = serializeParams({ traffic_session: parsed.session, key: parsed.key, ...initialDetails });
      const clientUrl = `https://${parsed.domain}/widget/client.js`;

      let clientRes;
      let retries = 0;
      while (true) {
        try {
          updateStatus(`Processing widget step ${step}/${totalSteps}...`, { spin: true });
          clientRes = await httpRequest(clientUrl, {
            method: 'POST', body: postBody, headers: getFormHeaders(), timeoutMs: 30000
          });
          if (clientRes.status < 200 || clientRes.status >= 400) throw new Error(`HTTP ${clientRes.status}`);
          break;
        } catch (e) {
          retries++;
          if (retries > CONFIG.maxWidgetAttempts) throw e;
          await sleep(Math.min(1000 * Math.pow(2, retries - 1), 10000));
        }
      }

      const verifiedDetails = sanitizeClientChallenge(clientRes.responseText, initialDetails);
      const wait = step > 1 ? parsed.nextWaitSeconds : parsed.waitSeconds;
      if (wait > 0) {
        updateStatus(`Holding step countdown (${step}/${totalSteps})...`, { spin: true });
        setCountdown(wait * 1000, `Step ${step}/${totalSteps}`);
        await sleep(wait * 1000);
      }

      const qMap = {
        code: parsed.code,
        traffic_session: parsed.session,
        key: parsed.key
      };
      if (prevId) qMap.id = prevId;
      for (const [k, v] of Object.entries(verifiedDetails)) {
        if (k === 'id' || v == null) continue;
        qMap[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
      }

      const nextUrl = `https://${parsed.domain}/widget/${parsed.endpoint}?${serializeParams(qMap)}`;
      const stepRes = await httpRequest(nextUrl, { headers: getBaseHeaders(), timeoutMs: 30000 });
      if (stepRes.status < 200 || stepRes.status >= 400) throw new Error(`HTTP ${stepRes.status}`);

      let stepData;
      try {
        const j = JSON.parse(stepRes.responseText.trim());
        stepData = Array.isArray(j) ? j[0] : j;
      } catch {
        throw new Error('Malformed widget JSON reply');
      }

      if (!stepData?.id) {
        const htmlCode = String(stepData?.html || '').trim();
        return htmlCode.replace(/<[^>]*>/g, '').trim() || null;
      }

      prevId = stepData.id;
      prevDetails = verifiedDetails;
      totalSteps = Math.max(totalSteps, parsed.totalSteps);
      if (step < totalSteps) {
        const ref = await fetchWidgetDoc(widgetState.widget);
        if (ref) page = ref;
      }
    }
    return null;
  }

  function readInputVal(name) {
    const el = document.querySelector(`input[name="${name}"], textarea[name="${name}"]`);
    return String(el?.value || '').trim();
  }

  function inspectRecaptchaToken() {
    for (const el of document.querySelectorAll('[name="g-recaptcha-response"], textarea#g-recaptcha-response')) {
      const v = String(el.value || '').trim();
      if (v) return v;
    }
    try {
      const ctx = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
      if (typeof ctx.grecaptcha?.getResponse === 'function') {
        for (const idx of [undefined, 0, 1, 2, 3]) {
          try {
            const v = String(idx == null ? ctx.grecaptcha.getResponse() : ctx.grecaptcha.getResponse(idx) || '').trim();
            if (v) return v;
          } catch {}
        }
      }
    } catch {}
    return '';
  }

  function triggerRecaptchaAnchor() {
    try {
      const iframe = document.querySelector('iframe[src*="recaptcha/api2/anchor"], iframe[src*="recaptcha"]');
      if (iframe) {
        iframe.scrollIntoView({ behavior: 'smooth', block: 'center' });
        iframe.style.outline = '3px solid #ffba42';
        iframe.style.boxShadow = '0 0 16px #ffba42';
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          const box = doc?.querySelector('#recaptcha-anchor, .recaptcha-checkbox');
          if (box) {
            box.focus();
            box.click();
          }
        } catch {}
      }
    } catch {}
  }

  async function resolveRecaptchaInteraction() {
    state.ui.captchaBanner.classList.add('show');
    updateStatus('Action required: solve the on-page reCAPTCHA', { tone: 'warn', spin: true });
    triggerRecaptchaAnchor();

    const deadline = Date.now() + CONFIG.recaptchaWaitMs;
    try {
      while (Date.now() < deadline) {
        const t = inspectRecaptchaToken();
        if (t) return t;
        await sleep(500);
      }
      throw new Error('reCAPTCHA waiting window timed out');
    } finally {
      state.ui.captchaBanner.classList.remove('show');
      const iframe = document.querySelector('iframe[src*="recaptcha"]');
      if (iframe) {
        iframe.style.outline = '';
        iframe.style.boxShadow = '';
      }
    }
  }

  function detectBackendHost() {
    const hits = document.documentElement.innerHTML.match(/https:\/\/[a-z\d-]+\.link4m\.app/gi);
    return hits?.[0] || 'https://s1.link4m.app';
  }

  async function submitPasscodePayload(password) {
    const alias = readInputVal('alias');
    const campaignId = readInputVal('campaign_id');
    const displayId = readInputVal('display_id');
    const prefix = readInputVal('prefix') || password;

    if (!alias || !campaignId || !displayId) {
      throw new Error('Campaign parameters not found in DOM');
    }

    const hasCaptcha = Boolean(document.querySelector('[name="g-recaptcha-response"], .g-recaptcha, iframe[src*="recaptcha"]'));
    const token = hasCaptcha ? await resolveRecaptchaInteraction() : '';

    updateStatus('Requesting target link info...', { spin: true });
    const host = detectBackendHost();
    const payload = serializeParams({
      password, alias, campaign_id: campaignId, display_id: displayId,
      prefix, 'g-recaptcha-response': token
    });

    const res = await httpRequest(`${host}/links/get-link-info`, {
      method: 'POST',
      headers: { ...getBaseHeaders(location.href), 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: payload,
      timeoutMs: 30000
    });

    if (res.status < 200 || res.status >= 400) throw new Error(`HTTP ${res.status}`);
    let data;
    try { data = JSON.parse(res.responseText.trim()); }
    catch { throw new Error('Response is not valid JSON'); }

    if (!data?.success || !data?.url) throw new Error('API refused password or returned empty URL');
    presentResult(String(data.url));

    void httpRequest(`${host}/widget/click.html`, {
      method: 'POST',
      headers: getFormHeaders(location.href),
      body: serializeParams({ campaign_id: campaignId, display_id: displayId, code: prefix })
    }).catch(() => {});

    return data.url;
  }

  function cleanTaskDomain(raw) {
    let str = String(raw || '').trim();
    if (!str) throw new Error('Input URL is empty');
    if (!/^[a-z][a-z\d+.-]*:\/\//i.test(str)) str = `https://${str}`;
    let u;
    try { u = new URL(str); }
    catch { throw new Error('Invalid URL format'); }
    if (u.protocol === 'http:') u.protocol = 'https:';
    if (!u.hostname || /link4m\.(?:com|net|org|app)$/i.test(u.hostname)) {
      throw new Error('Must specify the destination task domain, not link4m itself');
    }
    return u.href;
  }

  async function startBypassProcess(rawInput) {
    if (state.busy) return;
    let url;
    try { url = cleanTaskDomain(rawInput); }
    catch (e) { updateStatus(e.message, { tone: 'err' }); return; }

    state.busy = true;
    state.finalUrl = '';
    state.ui.resultPanel.classList.remove('show');
    state.ui.captchaBanner.classList.remove('show');
    refreshActionButtons();

    try {
      state.currentUrl = url;
      updateStatus('Connecting to task domain...', { spin: true });
      const mainDoc = await httpRequest(url, { headers: getBaseHeaders(url), timeoutMs: 30000 });
      if (mainDoc.status < 200 || mainDoc.status >= 400) throw new Error('Unable to reach task domain');
      state.currentUrl = mainDoc.finalUrl || url;

      const widgetEntries = locateWidgetScripts(mainDoc.responseText);
      if (!widgetEntries.length) throw new Error('No widget script found in target page');

      const validWidgets = (await Promise.all(widgetEntries.map(fetchWidgetDoc))).filter(Boolean);
      if (!validWidgets.length) throw new Error('No compatible widget sessions discovered');

      updateStatus(`Dispatching ${validWidgets.length} widget session(s)...`, { spin: true });
      const outcomes = await Promise.allSettled(validWidgets.map(resolveWidgetFlow));
      const successful = outcomes.find((o) => o.status === 'fulfilled' && o.value);
      if (!successful) {
        const failure = outcomes.find((o) => o.status === 'rejected');
        throw failure?.reason || new Error('Widget code acquisition failed');
      }

      await submitPasscodePayload(successful.value);
    } catch (err) {
      console.error('[bypass-l4m]', err);
      updateStatus(`✗ ${err.message || 'Operation error'}`, { tone: 'err' });
    } finally {
      state.busy = false;
      refreshActionButtons();
    }
  }

  function matchDomainValidity(host) {
    const clean = String(host || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').replace(/^\.+|\.+$/g, '');
    const parts = clean.split('.');
    if (parts.length < 2 || parts.some((p) => !/^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(p))) return false;
    const sfx = parts.slice(-2).join('.');
    return KNOWN_SUFFIXES.has(sfx) ? parts.length >= 3 : KNOWN_SUFFIXES.has(parts.at(-1));
  }

  function extractInstructionMetadata(wrapper) {
    if (!wrapper) return { exactDomains: [], wildcardPatterns: [] };
    const text = String(wrapper.innerText || wrapper.textContent || '').replace(/\s+/g, ' ');
    const step3 = text.match(/Bước\s*3\s*[:.\-]?([\s\S]*?)(?:Bước\s*4|$)/i)?.[1] || text;

    const wildcardPatterns = [];
    const seenWildcards = new Set();
    const wildRegex = /(?:https?:\/\/)?([a-z\d.*-]*\*+[a-z\d.*-]*\.[a-z]{2,}(?:\.[a-z]{2,})?)/gi;
    for (const match of step3.matchAll(wildRegex)) {
      const raw = match[1].toLowerCase().replace(/^www\./, '');
      if (seenWildcards.has(raw)) continue;
      seenWildcards.add(raw);
      const pfx = raw.slice(0, raw.indexOf('*'));
      const sfx = raw.slice(raw.lastIndexOf('*') + 1);
      const reg = new RegExp(`^${raw.split(/\*+/).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[a-z0-9.-]+')}$`, 'i');
      wildcardPatterns.push({ raw, pfx, sfx, reg });
    }

    const exactDomains = [];
    const seenExact = new Set();
    if (!wildcardPatterns.length) {
      const reg = /(?:https?:\/\/)?((?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z]{2,}(?:\.[a-z]{2,})?)/gi;
      for (const match of step3.matchAll(reg)) {
        const d = match[1].toLowerCase().replace(/^www\./, '');
        if (!seenExact.has(d) && matchDomainValidity(d) && !REJECTED_HOSTS.test(d)) {
          seenExact.add(d);
          exactDomains.push(d);
        }
      }
    }
    return { exactDomains, wildcardPatterns };
  }

  function getInstructionImages(wrapper) {
    const images = [];
    const tracker = new Set();
    const pushItem = (u, prio, el) => {
      if (!u || typeof u !== 'string') return;
      const clean = u.trim().replace(/^\/\//, 'https:');
      if (!/^(https?:\/\/|data:image\/|blob:)/i.test(clean)) return;
      if (/google|gstatic|recaptcha|logo|icon|avatar|favicon|banner|spinner|\.svg(?:\?|$)/i.test(clean)) return;
      if (tracker.has(clean)) return;
      tracker.add(clean);
      images.push({ url: clean, prio, el });
    };

    for (const [i, img] of [...(wrapper?.querySelectorAll('img') || [])].entries()) {
      const src = img.currentSrc || img.src || img.getAttribute('data-src') || img.getAttribute('data-original') || '';
      const isTarget = /\/uploads\/advertiser\/|img\.link4m\./i.test(src);
      pushItem(src, isTarget ? i + 1 : i + 20, img);
    }
    return images.sort((a, b) => a.prio - b.prio);
  }

  async function convertToDataUri(cand) {
    if (cand.url.startsWith('data:image/')) return cand.url;
    try {
      const res = await httpRequest(cand.url, {
        responseType: 'arraybuffer', timeoutMs: 15000,
        headers: { accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8', referer: location.href }
      });
      if (res.response?.byteLength > 100) {
        const bytes = new Uint8Array(res.response);
        const parts = [];
        for (let i = 0; i < bytes.length; i += 8192) parts.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
        const mime = /\.png/i.test(cand.url) ? 'image/png' : /\.webp/i.test(cand.url) ? 'image/webp' : 'image/jpeg';
        return `data:${mime};base64,${btoa(parts.join(''))}`;
      }
    } catch {}
    const el = cand.el;
    if (el?.complete && el.naturalWidth) {
      try {
        const c = document.createElement('canvas');
        c.width = el.naturalWidth;
        c.height = el.naturalHeight;
        c.getContext('2d').drawImage(el, 0, 0);
        return c.toDataURL('image/png');
      } catch {}
    }
    return null;
  }

  async function prepareImageProcessing(dataUri) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onerror = () => resolve([dataUri]);
      img.onload = () => {
        try {
          const w = img.naturalWidth || 600;
          const h = img.naturalHeight || 150;
          const scale = w < 800 ? 2 : 1;
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(w * scale);
          canvas.height = Math.round(h * scale);
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.filter = 'contrast(1.35) brightness(1.05)';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve([canvas.toDataURL('image/jpeg', 0.94), dataUri]);
        } catch {
          resolve([dataUri]);
        }
      };
      img.src = dataUri;
    });
  }

  function resolveDomainFromText(text, meta) {
    const norm = String(text || '').replace(/https?\s*:\s*\/\s*\//gi, 'https://');
    const candidates = new Map();
    const addScore = (domain, base) => {
      const d = String(domain).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/›><"'(),;:\s].*$/, '').replace(/^\.+|\.+$/g, '');
      if (!matchDomainValidity(d) || REJECTED_HOSTS.test(d)) return;
      let score = base;
      for (const wild of meta.wildcardPatterns) {
        if (wild.reg.test(d)) score += 1000;
        else if (wild.sfx && d.endsWith(wild.sfx)) score += 60;
      }
      candidates.set(d, (candidates.get(d) || 0) + score);
    };

    for (const m of norm.matchAll(/https?:\/\/([a-z\d.-]+\.[a-z]{2,})/gi)) addScore(m[1], 50);
    for (const m of norm.matchAll(/\b((?:[a-z\d-]+\.)+[a-z]{2,}(?:\.[a-z]{2,})?)\b/gi)) addScore(m[1], 25);

    return [...candidates].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }

  async function queryOcrSpace(dataUri, engine = 2) {
    const form = new URLSearchParams({
      base64Image: dataUri, language: 'eng', isOverlayRequired: 'false',
      scale: 'true', OCREngine: String(engine), detectOrientation: 'false'
    });
    for (const key of CONFIG.ocrSpaceApiKeys) {
      try {
        const res = await httpRequest(CONFIG.ocrSpaceEndpoint, {
          method: 'POST', body: form.toString(), timeoutMs: 18000,
          headers: { apikey: key, 'content-type': 'application/x-www-form-urlencoded' }
        });
        if (res.status !== 200) continue;
        const json = JSON.parse(res.responseText);
        const text = Array.isArray(json?.ParsedResults) ? json.ParsedResults.map((p) => p.ParsedText || '').join('\n').trim() : '';
        if (text) return text;
      } catch {}
    }
    return '';
  }

  async function executeOcrPipeline(cand, meta) {
    const uri = await convertToDataUri(cand);
    if (!uri) return null;
    const variants = await prepareImageProcessing(uri);
    for (const variant of variants) {
      const text = await queryOcrSpace(variant, 2);
      if (text) {
        const matched = resolveDomainFromText(text, meta);
        if (matched) return matched;
      }
    }
    const alt = await queryOcrSpace(variants[0], 1);
    return alt ? resolveDomainFromText(alt, meta) : null;
  }

  async function autoScanTaskDirective() {
    if (state.busy || state.autoDetecting) return;
    state.autoDetecting = true;
    refreshActionButtons();

    try {
      const wrapper = document.getElementById('advertise-html-wrapper');
      const meta = extractInstructionMetadata(wrapper);
      let targetDomain = meta.exactDomains[0] || null;

      if (!targetDomain) {
        updateStatus('Analyzing instruction visual elements...', { spin: true });
        const deadline = Date.now() + CONFIG.imageWaitMs;
        let cands = [];
        while (Date.now() < deadline) {
          cands = getInstructionImages(wrapper);
          if (cands.length) break;
          await sleep(300);
        }

        for (const [idx, cand] of cands.slice(0, CONFIG.maxImageCandidates).entries()) {
          updateStatus(`OCR inspection (${idx + 1}/${Math.min(cands.length, CONFIG.maxImageCandidates)})...`, { spin: true });
          targetDomain = await executeOcrPipeline(cand, meta);
          if (targetDomain) break;
        }
      }

      if (!targetDomain) {
        updateStatus('Task domain not detected automatically. Manual entry required.', { tone: 'warn' });
        return;
      }

      const fullUrl = `https://${targetDomain}`;
      state.ui.taskInput.value = fullUrl;
      updateStatus(`✓ Target domain detected: ${targetDomain}`, { tone: 'ok' });
      state.autoDetecting = false;
      refreshActionButtons();
      await startBypassProcess(fullUrl);
    } catch (e) {
      updateStatus(`Auto-detection fault: ${e.message}`, { tone: 'warn' });
    } finally {
      state.autoDetecting = false;
      refreshActionButtons();
    }
  }

  async function awaitPageDirective() {
    const deadline = Date.now() + CONFIG.pageWaitMs;
    updateStatus('Waiting for instructions content...', { spin: true });
    while (Date.now() < deadline) {
      const wrapper = document.getElementById('advertise-html-wrapper');
      if (wrapper && wrapper.innerHTML.trim()) {
        state.isGoogleInstruction = [...wrapper.querySelectorAll('a[href]')].some((a) => /google\.com/i.test(a.href));
        return true;
      }
      await sleep(350);
    }
    updateStatus('Instruction container timed out. Enter task URL manually.', { tone: 'warn' });
    return false;
  }

  async function bootstrapApp() {
    if (!document.body || /^\/go\/not-found/.test(location.pathname)) return;
    initUI();
    try {
      if (document.readyState !== 'complete') {
        await Promise.race([
          new Promise((r) => window.addEventListener('load', r, { once: true })),
          sleep(4000)
        ]);
      }
      if (await awaitPageDirective()) {
        await autoScanTaskDirective();
      }
    } catch (err) {
      console.error('[bypass-l4m] Boot error', err);
      updateStatus('Initialization fault. Manual URL bypass ready.', { tone: 'warn' });
    }
  }

  if (document.body) void bootstrapApp();
  else document.addEventListener('DOMContentLoaded', () => void bootstrapApp(), { once: true });
})();
