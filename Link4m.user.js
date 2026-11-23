// ==UserScript==
// @name         bypass l4m by duydepzai
// @namespace    local.duydepzai.l4m
// @version      3.0.0
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
    status: 'Đang khởi tạo hệ thống...',
    statusTone: 'info',
    spinning: true,
    targetDeadline: 0,
    totalDuration: 0,
    stepLabel: '',
    finalUrl: '',
    autoRedirect: true,
    cachedTesseractLoader: null
  };

  const STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');

    :host, :host * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
    }

    .root {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #0f172a;
      font-size: 13px;
      line-height: 1.5;
    }

    /* Modern Glass Card */
    .panel {
      position: fixed;
      right: 24px;
      bottom: 24px;
      width: min(390px, calc(100vw - 32px));
      max-height: calc(100dvh - 40px);
      overflow-y: auto;
      border-radius: 20px;
      border: 1px solid rgba(226, 232, 240, 0.9);
      background: rgba(255, 255, 255, 0.97);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      box-shadow: 0 20px 45px -10px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(226, 232, 240, 0.6);
      z-index: 2147483647;
      touch-action: none;
      scrollbar-width: thin;
      scrollbar-color: #cbd5e1 transparent;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .panel::-webkit-scrollbar {
      width: 5px;
    }
    .panel::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 10px;
    }

    /* Mac Terminal Topbar - Clean Light Theme */
    .terminal-header {
      background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
      padding: 11px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: move;
      border-bottom: 1px solid #e2e8f0;
      border-top-left-radius: 20px;
      border-top-right-radius: 20px;
    }

    .terminal-dots {
      display: flex;
      gap: 6px;
      align-items: center;
    }

    .dot {
      width: 11px;
      height: 11px;
      border-radius: 50%;
      display: inline-block;
      transition: transform 0.15s ease;
    }
    .dot:hover { transform: scale(1.15); }
    .dot.red { background-color: #ff5f56; box-shadow: 0 0 6px rgba(255, 95, 86, 0.4); }
    .dot.yellow { background-color: #ffbd2e; box-shadow: 0 0 6px rgba(255, 189, 46, 0.4); }
    .dot.green { background-color: #27c93f; box-shadow: 0 0 6px rgba(39, 201, 63, 0.4); }

    .terminal-title {
      flex: 1;
      text-align: center;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      color: #475569;
      letter-spacing: 0.05em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-left: -14px;
    }

    .btn-min {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      color: #64748b;
      background: #ffffff;
      width: 26px;
      height: 26px;
      display: grid;
      place-items: center;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      transition: all 0.15s ease;
    }

    .btn-min:hover {
      background: #ff5f56;
      color: #ffffff;
      border-color: #ff5f56;
      box-shadow: 0 2px 8px rgba(255, 95, 86, 0.35);
    }

    /* Brand banner */
    .brand-section {
      padding: 13px 18px 11px;
      border-bottom: 1px solid #f1f5f9;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .badge-ver {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10.5px;
      font-weight: 700;
      color: #0284c7;
      background: linear-gradient(135deg, #e0f2fe 0%, #dbeafe 100%);
      border: 1px solid #bae6fd;
      padding: 3px 9px;
      border-radius: 20px;
      letter-spacing: 0.03em;
    }

    /* Terminal Console Box - Sleek Deep Navy */
    .terminal-logs {
      background: linear-gradient(145deg, #0f172a 0%, #1e293b 100%);
      margin: 12px 16px 6px;
      padding: 10px 14px;
      border-radius: 12px;
      border: 1px solid rgba(56, 189, 248, 0.25);
      color: #38bdf8;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11.5px;
      display: flex;
      align-items: center;
      gap: 9px;
      box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(14, 165, 233, 0.08);
    }

    .terminal-prompt {
      color: #38bdf8;
      font-weight: 800;
      flex-shrink: 0;
      font-size: 12px;
    }

    .status-msg {
      flex: 1;
      color: #f8fafc;
      word-break: break-word;
      font-size: 11.5px;
      font-weight: 500;
      line-height: 1.4;
    }

    .status-msg.ok { color: #34d399; }
    .status-msg.warn { color: #fbbf24; }
    .status-msg.err { color: #f87171; }
    .status-msg.info { color: #38bdf8; }

    .clock {
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.15);
      border: 1px solid rgba(56, 189, 248, 0.3);
      padding: 2px 7px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 11px;
    }

    .cursor-blink {
      display: inline-block;
      width: 6px;
      height: 14px;
      background: #38bdf8;
      vertical-align: middle;
      animation: blink 1s steps(1) infinite;
    }
    @keyframes blink { 0%, 50% { opacity: 1; } 50.1%, 100% { opacity: 0; } }

    .spinner {
      width: 12px;
      height: 12px;
      border: 2px solid rgba(56, 189, 248, 0.2);
      border-top-color: #38bdf8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      flex-shrink: 0;
    }
    .spinner.off { display: none; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .progress-bar {
      height: 3px;
      background: #e2e8f0;
      margin: 0 16px;
      border-radius: 3px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #0ea5e9, #10b981);
      transition: width 0.25s ease;
    }

    .banner {
      display: none;
      margin: 10px 16px 0;
      border-radius: 10px;
      padding: 9px 12px;
      font-size: 11.5px;
      font-weight: 600;
      background: #fffbeb;
      border: 1px solid #fde68a;
      color: #b45309;
      align-items: center;
      gap: 8px;
    }
    .banner.show { display: flex; }

    /* Form and inputs */
    .form-wrap {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px 16px 14px;
    }

    .input-box {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 12px;
      padding: 0 12px;
      transition: all 0.2s ease;
    }

    .input-box:focus-within {
      background: #ffffff;
      border-color: #0ea5e9;
      box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15);
    }

    .input-prompt {
      color: #0ea5e9;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      font-size: 12px;
    }

    .url-input {
      border: 0;
      background: transparent;
      padding: 10px 0;
      color: #0f172a;
      font-size: 12.5px;
      font-family: inherit;
      outline: 0;
      flex: 1;
      min-width: 0;
      user-select: text;
    }
    .url-input::placeholder { color: #94a3b8; }
    .url-input:disabled { opacity: 0.6; }

    button {
      font: inherit;
      cursor: pointer;
      outline: 0;
      border: 0;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .btn-main {
      padding: 11px;
      border-radius: 12px;
      background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%);
      color: #ffffff;
      font-size: 13px;
      font-weight: 700;
      box-shadow: 0 6px 18px -3px rgba(37, 99, 235, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .btn-main:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 24px -3px rgba(37, 99, 235, 0.55);
      filter: brightness(1.05);
    }

    .btn-main:active {
      transform: translateY(0);
      box-shadow: 0 4px 10px -2px rgba(37, 99, 235, 0.4);
    }

    .btn-main:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none !important;
      box-shadow: none !important;
    }

    .row-btns {
      display: flex;
      gap: 8px;
    }

    .btn-sec {
      flex: 1;
      padding: 9px 12px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .btn-switch {
      background: #f0f9ff;
      color: #0284c7;
      border: 1.5px solid #bae6fd;
    }

    .btn-switch:hover {
      background: #e0f2fe;
      border-color: #7dd3fc;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(14, 165, 233, 0.15);
    }

    .btn-discord {
      background: #5865F2;
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(88, 101, 242, 0.3);
    }

    .btn-discord:hover {
      background: #4752c4;
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgba(88, 101, 242, 0.4);
    }

    .discord-icon {
      width: 15px;
      height: 15px;
      fill: currentColor;
    }

    .pref-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11.5px;
      color: #64748b;
      cursor: pointer;
      margin-top: 2px;
      font-weight: 600;
    }

    .pref-row input {
      accent-color: #2563eb;
      width: 15px;
      height: 15px;
    }

    /* Result Box */
    .result-panel {
      display: none;
      margin: 0 16px 14px;
      padding: 11px 14px;
      border-radius: 12px;
      background: #f0fdf4;
      border: 1.5px solid #bbf7d0;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.1);
    }
    .result-panel.show { display: block; }

    .result-header {
      font-size: 11px;
      font-weight: 800;
      color: #15803d;
      letter-spacing: 0.05em;
    }

    .result-content {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      background: #ffffff;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 8px 10px;
      margin: 7px 0;
      max-height: 70px;
      overflow-y: auto;
      word-break: break-all;
      color: #166534;
      user-select: text;
    }

    .result-actions {
      display: flex;
      gap: 8px;
    }

    .btn-act {
      flex: 1;
      padding: 8px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 11.5px;
    }

    .btn-act.copy {
      background: #10b981;
      color: #ffffff;
      box-shadow: 0 4px 10px rgba(16, 185, 129, 0.25);
    }
    .btn-act.copy:hover { filter: brightness(1.08); }

    .btn-act.open {
      background: #ffffff;
      color: #15803d;
      border: 1.5px solid #86efac;
    }
    .btn-act.open:hover { background: #f0fdf4; }

    /* Bottom footer */
    .panel-footer {
      padding: 11px 16px 13px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: center;
      align-items: center;
      background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
      border-bottom-left-radius: 20px;
      border-bottom-right-radius: 20px;
    }

    .fab-btn {
      display: none;
      position: fixed;
      right: 24px;
      bottom: 24px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: 0;
      background: linear-gradient(135deg, #0ea5e9, #2563eb);
      color: #ffffff;
      font-size: 20px;
      font-weight: 900;
      box-shadow: 0 10px 25px -4px rgba(37, 99, 235, 0.5);
      z-index: 2147483647;
      cursor: pointer;
      place-items: center;
      transition: all 0.2s ease;
    }

    .fab-btn:hover {
      transform: scale(1.08);
      box-shadow: 0 14px 30px -4px rgba(37, 99, 235, 0.65);
    }

    .fab-btn.show { display: grid; }

    @media (max-width: 480px) {
      .panel {
        width: calc(100vw - 24px);
        right: 12px;
        bottom: 12px;
      }
    }
  `;

  const SVG_LOGO_DAU = `
    <svg viewBox="0 0 210 130" fill="none" xmlns="http://www.w3.org/2000/svg" style="height:26px;width:auto;">
      <defs>
        <linearGradient id="pGradL" x1="10" y1="10" x2="65" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#38BDF8" />
          <stop offset="55%" stop-color="#0EA5E9" />
          <stop offset="100%" stop-color="#2563EB" />
        </linearGradient>
        <linearGradient id="pGrad4" x1="35" y1="75" x2="115" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#0EA5E9" />
          <stop offset="45%" stop-color="#10B981" />
          <stop offset="100%" stop-color="#059669" />
        </linearGradient>
        <linearGradient id="pGradM" x1="100" y1="10" x2="195" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#34D399" />
          <stop offset="50%" stop-color="#10B981" />
          <stop offset="100%" stop-color="#047857" />
        </linearGradient>
        <linearGradient id="pGradMShade" x1="120" y1="10" x2="165" y2="95" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#059669" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#047857" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d="M12 12 H34 V98 H78 V120 H12 V12 Z" fill="url(#pGradL)" />
      <path d="M98 12 L42 74 L42 92 H122 V72 H72 L98 42 V12 Z" fill="url(#pGrad4)" />
      <rect x="94" y="64" width="22" height="56" fill="url(#pGrad4)" />
      <path d="M94 12 H118 L152 68 L186 12 H208 V120 H186 V50 L152 104 L118 50 V120 H94 V12 Z" fill="url(#pGradM)" />
      <path d="M118 12 L152 68 L152 104 L118 50 Z" fill="url(#pGradMShade)" />
    </svg>
    <div style="display:flex;flex-direction:column;margin-left:8px;line-height:1;">
      <span style="font-weight:800;font-size:13px;letter-spacing:-0.02em;color:#0f172a;">Link4M-BYPASS</span>
      <span style="font-size:9.5px;font-weight:700;color:#64748b;letter-spacing:0.04em;">by @duydepzai</span>
    </div>
  `;

  const SVG_LOGO_DUOI = `
    <div style="display:inline-flex;align-items:baseline;line-height:1;user-select:none;">
      <span style="color:#0f172a;font-weight:700;font-size:13.5px;letter-spacing:-0.04em;margin-right:2px;">Link</span>
      <svg viewBox="0 0 100 64" fill="none" xmlns="http://www.w3.org/2000/svg" style="height:11px;width:auto;vertical-align:baseline;">
        <defs>
          <linearGradient id="pFold4" x1="22" y1="43" x2="37" y2="43" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#0284c7" />
            <stop offset="100%" stop-color="#2563eb" />
          </linearGradient>
          <linearGradient id="pFoldMLeft" x1="47" y1="14" x2="66" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#0ea5e9" />
            <stop offset="48%" stop-color="#2563eb" />
            <stop offset="100%" stop-color="#1d4ed8" />
          </linearGradient>
          <linearGradient id="pFoldMRight" x1="87" y1="14" x2="68" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#0284c7" />
            <stop offset="52%" stop-color="#2563eb" />
            <stop offset="100%" stop-color="#1d4ed8" />
          </linearGradient>
        </defs>
        <path d="M32 4 L2 39 L11 49 H56 V38 H17.5 L32 21 V4 Z" fill="#0052ff" />
        <rect x="22" y="38" width="14" height="11" fill="url(#pFold4)" opacity="0.8" />
        <rect x="36" y="38" width="12" height="26" fill="#0052ff" />
        <rect x="36" y="0" width="12" height="34" fill="#0052ff" />
        <rect x="86" y="0" width="12" height="64" fill="#0052ff" />
        <path d="M47 0 L67 32 L67 49 L47 17 Z" fill="url(#pFoldMLeft)" />
        <path d="M87 0 L67 32 L67 49 L87 17 Z" fill="url(#pFoldMRight)" />
      </svg>
      <span style="color:#94a3b8;font-weight:700;margin:0 4px;font-size:12px;">-</span>
      <span style="font-weight:800;font-size:13px;letter-spacing:-0.03em;background:linear-gradient(96deg,#ff4b72 0%,#ff8833 22%,#f59e0b 43%,#10b981 64%,#06b6d4 82%,#8b5cf6 100%);-webkit-background-clip:text;background-clip:text;color:transparent;">bypass</span>
    </div>
  `;

  const DISCORD_ICON = `
    <svg class="discord-icon" viewBox="0 0 127.14 96.36">
      <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.86,53,48.81,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
    </svg>
  `;

  const MARKUP = `
    <div class="root">
      <div class="panel" id="panel">
        <div class="terminal-header" id="dragHead">
          <div class="terminal-dots">
            <span class="dot red"></span>
            <span class="dot yellow"></span>
            <span class="dot green"></span>
          </div>
          <span class="terminal-title">link4m_bypass.sh</span>
          <button type="button" class="btn-min" id="btnMin" title="Thu nhỏ">−</button>
        </div>

        <div class="brand-section">
          <div style="display:flex;align-items:center;">
            ${SVG_LOGO_DAU}
          </div>
          <span class="badge-ver">v3.0 PEAK</span>
        </div>

        <div class="terminal-logs info" id="statusBar">
          <span class="terminal-prompt">&gt;</span>
          <span class="spinner" id="spinner"></span>
          <span class="status-msg info" id="statusMsg">Đang khởi tạo hệ thống...</span>
          <span class="cursor-blink"></span>
          <span class="clock" id="statusClock"></span>
        </div>
        <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>

        <div class="banner" id="captchaBanner">
          <span>⚠️</span>
          <span>Vui lòng giải reCAPTCHA trên trang để tiếp tục.</span>
        </div>

        <form class="form-wrap" id="mainForm" novalidate>
          <div class="input-box">
            <span class="input-prompt">&gt; URL:</span>
            <input class="url-input" id="taskInput" type="text" inputmode="url" placeholder="URL nhiệm vụ (vd: example.com)" />
          </div>
          <button type="submit" class="btn-main" id="btnStart">⚡ Bắt đầu Bypass</button>
          <div class="row-btns">
            <button type="button" class="btn-sec btn-switch" id="btnVisit">🌐 Truy cập web</button>
            <button type="button" class="btn-sec btn-discord" id="btnDiscord">
              ${DISCORD_ICON} Discord
            </button>
          </div>
          <label class="pref-row">
            <input type="checkbox" id="chkRedirect" checked />
            Tự động mở link đích khi hoàn tất
          </label>
        </form>

        <div class="result-panel" id="resultPanel">
          <div class="result-header">✓ ĐÃ LẤY ĐƯỢC LINK ĐÍCH</div>
          <div class="result-content" id="resultUrl"></div>
          <div class="result-actions">
            <button type="button" class="btn-act copy" id="btnCopy">Sao chép</button>
            <button type="button" class="btn-act open" id="btnOpen">Mở Link</button>
          </div>
        </div>

        <div class="panel-footer">
          ${SVG_LOGO_DUOI}
        </div>
      </div>
      <button type="button" class="fab-btn" id="fabBtn" title="Mở menu">⚡</button>
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
      btnVisit: q('btnVisit'), btnDiscord: q('btnDiscord'), chkRedirect: q('chkRedirect'),
      resultPanel: q('resultPanel'), resultUrl: q('resultUrl'), btnCopy: q('btnCopy'),
      btnOpen: q('btnOpen'), fabBtn: q('fabBtn')
    };

    setupDragEvents();
    q('btnMin').addEventListener('click', () => setDisplayMode(false));
    q('fabBtn').addEventListener('click', () => setDisplayMode(true));
    q('btnVisit').addEventListener('click', visitTaskWebsite);
    q('btnDiscord').addEventListener('click', () => openUrl(CONFIG.communityUrl));
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
    state.ui.statusMsg.className = `status-msg ${tone}`;
    if (state.ui.statusBar) state.ui.statusBar.className = `terminal-logs ${tone}`;
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
    state.ui.btnStart.textContent = state.busy ? 'Đang xử lý...' : state.autoDetecting ? 'Đang quét OCR...' : '⚡ Bắt đầu Bypass';
  }

  function visitTaskWebsite(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const val = (state.ui.taskInput?.value || '').trim();
    if (val) {
      try {
        const target = cleanTaskDomain(val);
        openUrl(target);
        updateStatus(`✓ Đang mở trang: ${target}`, { tone: 'ok' });
        return;
      } catch {}
    }

    // Fallback: check DOM instructions directly for domain
    const wrapper = document.getElementById('advertise-html-wrapper');
    const meta = extractInstructionMetadata(wrapper);
    if (meta.exactDomains.length > 0) {
      const target = `https://${meta.exactDomains[0]}`;
      openUrl(target);
      updateStatus(`✓ Đang mở trang: ${target}`, { tone: 'ok' });
      return;
    }

    updateStatus('Chưa có URL nhiệm vụ để truy cập', { tone: 'warn' });
  }

  function presentResult(url) {
    state.finalUrl = url;
    state.ui.resultUrl.textContent = url;
    state.ui.resultPanel.classList.add('show');
    state.ui.progressFill.style.width = '100%';
    updateStatus('✓ Lấy URL thành công!', { tone: 'ok', spin: false });
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
      state.ui.btnCopy.textContent = 'Đã chép!';
      setTimeout(() => { if (state.ui.btnCopy) state.ui.btnCopy.textContent = 'Sao chép'; }, 2000);
    } catch {
      updateStatus('Không thể sao chép URL', { tone: 'warn' });
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
            onerror: (err) => finalize(reject, new Error(err?.error || err?.statusText || 'Lỗi kết nối mạng')),
            ontimeout: () => finalize(reject, new Error('Quá thời gian chờ HTTP')),
            onabort: () => finalize(reject, new Error('Yêu cầu bị hủy'))
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
      'accept-language': 'vi,en;q=0.9,en-US;q=0.8',
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
      lang: 'vi-VN',
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
          updateStatus(`Widget: đang xử lý bước ${step}/${totalSteps}...`, { spin: true });
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
        updateStatus(`Đang đếm ngược bước ${step}/${totalSteps}...`, { spin: true });
        setCountdown(wait * 1000, `Bước ${step}/${totalSteps}`);
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
        throw new Error('Dữ liệu widget không đúng định dạng JSON');
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
        iframe.style.outline = '3px solid #38bdf8';
        iframe.style.boxShadow = '0 0 20px rgba(56, 189, 248, 0.6)';
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
    updateStatus('Cần giải reCAPTCHA trên trang...', { tone: 'warn', spin: true });
    triggerRecaptchaAnchor();

    const deadline = Date.now() + CONFIG.recaptchaWaitMs;
    try {
      while (Date.now() < deadline) {
        const t = inspectRecaptchaToken();
        if (t) return t;
        await sleep(500);
      }
      throw new Error('Hết thời gian chờ giải reCAPTCHA');
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
      throw new Error('Không tìm thấy thông tin chiến dịch trên trang');
    }

    const hasCaptcha = Boolean(document.querySelector('[name="g-recaptcha-response"], .g-recaptcha, iframe[src*="recaptcha"]'));
    const token = hasCaptcha ? await resolveRecaptchaInteraction() : '';

    updateStatus('Đang gửi mã lấy link đích...', { spin: true });
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
    catch { throw new Error('Máy chủ trả về dữ liệu không hợp lệ'); }

    if (!data?.success || !data?.url) throw new Error('Mã không hợp lệ hoặc máy chủ từ chối');

    // Auto-fill input on page
    const codeInput = document.querySelector('input[name="code"], input#code');
    if (codeInput) {
      codeInput.value = password;
      codeInput.dispatchEvent(new Event('input', { bubbles: true }));
      codeInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

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
    if (!str) throw new Error('Chưa nhập URL nhiệm vụ');
    if (!/^[a-z][a-z\d+.-]*:\/\//i.test(str)) str = `https://${str}`;
    let u;
    try { u = new URL(str); }
    catch { throw new Error('Định dạng URL không hợp lệ'); }
    if (u.protocol === 'http:') u.protocol = 'https:';
    if (!u.hostname || /link4m\.(?:com|net|org|app)$/i.test(u.hostname)) {
      throw new Error('Hãy nhập URL trang web nhiệm vụ, không phải link4m');
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
      updateStatus('Đang kết nối tới trang web nhiệm vụ...', { spin: true });
      const mainDoc = await httpRequest(url, { headers: getBaseHeaders(url), timeoutMs: 30000 });
      if (mainDoc.status < 200 || mainDoc.status >= 400) throw new Error('Không thể truy cập trang nhiệm vụ');
      state.currentUrl = mainDoc.finalUrl || url;

      const widgetEntries = locateWidgetScripts(mainDoc.responseText);
      if (!widgetEntries.length) throw new Error('Không tìm thấy widget lấy mã trên trang');

      const validWidgets = (await Promise.all(widgetEntries.map(fetchWidgetDoc))).filter(Boolean);
      if (!validWidgets.length) throw new Error('Không có widget nào hợp lệ');

      updateStatus(`Đang xử lý ${validWidgets.length} phiên widget...`, { spin: true });
      const outcomes = await Promise.allSettled(validWidgets.map(resolveWidgetFlow));
      const successful = outcomes.find((o) => o.status === 'fulfilled' && o.value);
      if (!successful) {
        const failure = outcomes.find((o) => o.status === 'rejected');
        throw failure?.reason || new Error('Không lấy được mã từ widget');
      }

      await submitPasscodePayload(successful.value);
    } catch (err) {
      console.error('[bypass-l4m]', err);
      updateStatus(`✗ ${err.message || 'Lỗi xảy ra'}`, { tone: 'err' });
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
        updateStatus('Đang phân tích hình ảnh hướng dẫn...', { spin: true });
        const deadline = Date.now() + CONFIG.imageWaitMs;
        let cands = [];
        while (Date.now() < deadline) {
          cands = getInstructionImages(wrapper);
          if (cands.length) break;
          await sleep(300);
        }

        for (const [idx, cand] of cands.slice(0, CONFIG.maxImageCandidates).entries()) {
          updateStatus(`Đang đọc ảnh OCR (${idx + 1}/${Math.min(cands.length, CONFIG.maxImageCandidates)})...`, { spin: true });
          targetDomain = await executeOcrPipeline(cand, meta);
          if (targetDomain) break;
        }
      }

      if (!targetDomain) {
        updateStatus('Không tự nhận diện được tên miền. Vui lòng nhập thủ công.', { tone: 'warn' });
        return;
      }

      const fullUrl = `https://${targetDomain}`;
      state.ui.taskInput.value = fullUrl;
      updateStatus(`✓ Đã nhận diện trang mục tiêu: ${targetDomain}`, { tone: 'ok' });
      state.autoDetecting = false;
      refreshActionButtons();
      await startBypassProcess(fullUrl);
    } catch (e) {
      updateStatus(`Lỗi nhận diện tự động: ${e.message}`, { tone: 'warn' });
    } finally {
      state.autoDetecting = false;
      refreshActionButtons();
    }
  }

  async function awaitPageDirective() {
    const deadline = Date.now() + CONFIG.pageWaitMs;
    updateStatus('Đang đợi nội dung nhiệm vụ...', { spin: true });
    while (Date.now() < deadline) {
      const wrapper = document.getElementById('advertise-html-wrapper');
      if (wrapper && wrapper.innerHTML.trim()) {
        state.isGoogleInstruction = [...wrapper.querySelectorAll('a[href]')].some((a) => /google\.com/i.test(a.href));
        return true;
      }
      await sleep(350);
    }
    updateStatus('Hết thời gian chờ nội dung. Hãy nhập URL thủ công.', { tone: 'warn' });
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
      updateStatus('Lỗi khởi tạo. Sẵn sàng nhập URL thủ công.', { tone: 'warn' });
    }
  }

  if (document.body) void bootstrapApp();
  else document.addEventListener('DOMContentLoaded', () => void bootstrapApp(), { once: true });
})();
