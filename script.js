/* ══════════════════════════════════════════════════════════════
   DECK · by IMPRESUB — interactive prototype
   Pure front-end simulation. No backend. No API keys.
   Everything you see is scripted to feel like a real WhatsApp
   conversation + live ERPNext update.
   ══════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  // ─── ELEMENTS ──────────────────────────────────────────────
  const chat     = document.getElementById('chat');
  const suggest  = document.getElementById('suggest');
  const input    = document.getElementById('input');
  const sendBtn  = document.getElementById('send');
  const micBtn   = document.getElementById('mic');
  const statusEl = document.getElementById('wa-status');
  const activity = document.getElementById('activity');
  const docReport = document.getElementById('doc-report');
  const docExpense= document.getElementById('doc-expense');
  const resetBtn = document.getElementById('reset');
  const autoBtn  = document.getElementById('autoplay');

  // ─── STATE ─────────────────────────────────────────────────
  let state = {
    step: 'idle',          // conversation step
    isAutoplay: false,
    lastExpenseId: 9142,
  };

  // ─── UTILS ─────────────────────────────────────────────────
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const nowTime = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };
  const scrollChat = () => { chat.scrollTop = chat.scrollHeight; };

  // ─── BUBBLE BUILDERS ───────────────────────────────────────
  function addOut(text) {
    const b = document.createElement('div');
    b.className = 'bubble bubble--out';
    b.innerHTML = `${escapeHtml(text)}<span class="meta">${nowTime()} <span class="ticks">✓✓</span></span>`;
    chat.appendChild(b);
    scrollChat();
    return b;
  }

  function addIn(html, opts = {}) {
    const b = document.createElement('div');
    b.className = 'bubble bubble--in' + (opts.card ? ' bubble--card' : '');
    if (opts.card) {
      b.innerHTML = html; // already formatted
    } else {
      b.innerHTML = `${html}<span class="meta">${nowTime()}</span>`;
    }
    chat.appendChild(b);
    scrollChat();
    return b;
  }

  function addVoiceOut(seconds = 14) {
    const bars = Array.from({length: 28}, () => {
      const h = 4 + Math.round(Math.random() * 16);
      return `<span style="height:${h}px"></span>`;
    }).join('');
    const b = document.createElement('div');
    b.className = 'bubble bubble--out bubble--voice';
    b.innerHTML = `
      <div class="voice__play">▶</div>
      <div class="voice__wave">${bars}</div>
      <span class="voice__time">0:${String(seconds).padStart(2,'0')}</span>
      <span class="meta" style="margin-left:6px"><span class="ticks">✓✓</span></span>
    `;
    chat.appendChild(b);
    scrollChat();
    return b;
  }

  async function showTyping(duration = 900) {
    statusEl.textContent = 'typing…';
    statusEl.classList.add('typing');
    const b = document.createElement('div');
    b.className = 'bubble bubble--in';
    b.innerHTML = `<span class="typing-dots"><span></span><span></span><span></span></span>`;
    chat.appendChild(b);
    scrollChat();
    await wait(duration);
    b.remove();
    statusEl.textContent = 'online';
    statusEl.classList.remove('typing');
  }

  function setSuggestions(items) {
    suggest.innerHTML = '';
    if (!items || !items.length) return;
    items.forEach(([label, value]) => {
      const btn = document.createElement('button');
      btn.className = 'chip-sug';
      btn.textContent = label;
      btn.addEventListener('click', () => handleUserInput(value || label, true));
      suggest.appendChild(btn);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  // ─── ERPNext SIDE EFFECTS ──────────────────────────────────
  function clearActivityPlaceholder() {
    const ph = activity.querySelector('.activity__placeholder');
    if (ph) ph.remove();
  }

  function pushActivity({ title, meta, ok = false }) {
    clearActivityPlaceholder();
    const row = document.createElement('div');
    row.className = 'act-row' + (ok ? ' act-row--ok' : '');
    row.innerHTML = `
      <div class="act-row__dot"></div>
      <div class="act-row__body">
        ${title}
        <div class="act-row__meta">${meta}</div>
      </div>
    `;
    activity.appendChild(row);
    activity.scrollTop = activity.scrollHeight;
    return row;
  }

  async function fillField(id, value, delay = 0, opts = {}) {
    if (delay) await wait(delay);
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('pending');
    el.classList.add('fill');
    el.textContent = value;
    if (opts.infer) el.style.color = 'var(--signal-soft)';
  }

  function setReportStatus(label, cls) {
    const el = document.getElementById('report-status');
    el.textContent = label;
    el.className = 'doc__status ' + cls;
  }
  function setExpenseStatus(label, cls) {
    const el = document.getElementById('exp-status');
    el.textContent = label;
    el.className = 'doc__status ' + cls;
  }

  // ─── CONVERSATION FLOWS ────────────────────────────────────

  // initial opener once page loads or chat is empty
  async function openerIfEmpty() {
    if (chat.querySelectorAll('.bubble').length > 0) return;
    await wait(600);
    await showTyping(700);
    addIn(`Good evening. 🌙 Try saying <strong>Hi</strong> to start, or just tap one of the options below.`);
    setSuggestions([
      ['👋 Hi', 'Hi'],
      ['🎙 Voice note', '__voice_demo'],
    ]);
  }

  // MAIN ROUTER ────
  async function handleUserInput(raw, fromChip = false) {
    const text = String(raw || '').trim();
    if (!text) return;

    // special triggers
    if (text === '__voice_demo') {
      return flowVoiceReport();
    }

    // render the user bubble
    addOut(text);
    input.value = '';
    setSuggestions([]);
    updateSendButton();

    // route by keywords + state
    const t = text.toLowerCase();

    // greeting
    if (state.step === 'idle' && /^(hi|hey|hello|salam|ciao|مرحبا|اهلا|yo|sup)/i.test(text)) {
      return flowGreeting();
    }

    // daily report
    if (/daily ?report|report today|yoklama|rapor/i.test(t) || state.step === 'await-intent') {
      if (/report/i.test(t) || /daily/i.test(t) || text === 'Daily Report') return flowDailyReport();
    }

    // expenses
    if (/expense|spent|reimburs|masraf|نفقات|مصروف/i.test(t) || text === 'Add Expense') {
      return flowExpense();
    }

    // mess hall mode
    if (/finished|yesterday|inspection|dive|took photos|lunch|forgot/i.test(t)) {
      return flowMessHall(text);
    }

    // fallback — agent reorients
    await showTyping(700);
    addIn(`I can help with two things tonight: <strong>daily report</strong> or <strong>expenses</strong>. Which one?`);
    setSuggestions([
      ['📋 Daily Report', 'Daily Report'],
      ['💳 Add Expense',  'Add Expense'],
    ]);
  }

  // ───────────────────────────────────────────────────────────
  //  FLOW: GREETING — agent shows contextual awareness
  // ───────────────────────────────────────────────────────────
  async function flowGreeting() {
    await showTyping(900);
    addIn(`Evening, <strong>Marco</strong>. 🌅`);
    await wait(420);
    addIn(`<strong>Saadiyat-2</strong> · Day 14 · DSV <em>Saturn</em>.<br/>Ready when you are — daily report or expenses?`);
    setSuggestions([
      ['📋 Daily Report', 'Daily Report'],
      ['💳 Add Expense',  'Add Expense'],
      ['🎙 Speak it',     '__voice_demo'],
    ]);
    state.step = 'await-intent';

    pushActivity({
      title: `<b>Marco Colombo</b> opened DECK thread`,
      meta: `GPS match → PRJ-AD-SAAD-2 · DSV Saturn · day 14 of rotation · ${nowTime()}`,
    });
  }

  // ───────────────────────────────────────────────────────────
  //  FLOW: DAILY REPORT (typed) — structured card fills live
  // ───────────────────────────────────────────────────────────
  async function flowDailyReport() {
    state.step = 'report';
    await showTyping(800);
    addIn(`Ready. Talk or type — your choice. 🎙️<br/>Or just tell me what you did today in one sentence.`);
    setSuggestions([
      ['🎙 Record voice note', '__voice_demo'],
      ['⌨️ Type it',            'Saturation dive completed at 14:00. Anode set replaced on riser 3. Sea state 2. No incidents. Ahmed had mild ear pressure, cleared by medic.'],
    ]);
  }

  // ───────────────────────────────────────────────────────────
  //  FLOW: VOICE REPORT — the hero flow
  // ───────────────────────────────────────────────────────────
  async function flowVoiceReport() {
    setSuggestions([]);
    state.step = 'voice-report';

    // simulate the user holding the mic
    micBtn.classList.add('recording');
    statusEl.textContent = 'Marco is recording…';
    statusEl.classList.add('typing');

    // show a "recording" system-ish line
    const recMsg = document.createElement('div');
    recMsg.className = 'wa__system';
    recMsg.innerHTML = `🎙️ Recording voice note…`;
    chat.appendChild(recMsg);
    scrollChat();

    await wait(2400);
    recMsg.remove();
    micBtn.classList.remove('recording');
    statusEl.textContent = 'online';
    statusEl.classList.remove('typing');

    addVoiceOut(14);

    // "DECK is transcribing"
    await wait(600);
    statusEl.textContent = 'transcribing…';
    statusEl.classList.add('typing');
    await wait(1500);
    statusEl.classList.remove('typing');
    statusEl.textContent = 'online';

    // agent confirms + shows structured card bubble
    await showTyping(700);
    addIn(`Got it. Transcribed and structured. ✨`);
    await wait(350);

    const cardHtml = `
      <div class="card__bar">
        <span class="card__svc">DIVING EXCELLENCE · SATURATION</span>
        <span class="card__sep">›</span>
        DAILY REPORT · DRAFT
      </div>
      <div class="card__body">
        <div class="card__row" style="animation-delay:.1s">
          <span class="k">Date</span><span class="v infer">17 Apr 2026 · 18:47 GST</span>
        </div>
        <div class="card__row" style="animation-delay:.25s">
          <span class="k">Project</span><span class="v infer">PRJ-AD-SAAD-2 · Saadiyat-2</span>
        </div>
        <div class="card__row" style="animation-delay:.4s">
          <span class="k">Vessel</span><span class="v infer">DSV Saturn</span>
        </div>
        <div class="card__row" style="animation-delay:.55s">
          <span class="k">Activity</span><span class="v">Saturation dive</span>
        </div>
        <div class="card__row" style="animation-delay:.7s">
          <span class="k">Completed</span><span class="v">14:00 GST</span>
        </div>
        <div class="card__row" style="animation-delay:.85s">
          <span class="k">Asset</span><span class="v">Riser 3 — anode set replaced</span>
        </div>
        <div class="card__row" style="animation-delay:1.0s">
          <span class="k">Sea state</span><span class="v">2</span>
        </div>
        <div class="card__row" style="animation-delay:1.15s">
          <span class="k">Incidents</span><span class="v">None</span>
        </div>
        <div class="card__row" style="animation-delay:1.3s">
          <span class="k">Medical</span><span class="v">A. Ahmed, mild ear pressure — cleared by Medic Hansen</span>
        </div>
      </div>
    `;
    addIn(cardHtml, { card: true });

    // populate ERPNext in parallel
    docReport.hidden = false;
    pushActivity({
      title: `Voice note received from <b>Marco Colombo</b> · 14s`,
      meta: `Auto-transcribed · entities extracted · fields mapped to Daily Report doctype`,
    });

    setReportStatus('Parsing', 'status--pending');
    await fillField('f-project',  'PRJ-AD-SAAD-2 · Saadiyat-2', 300, { infer: true });
    await fillField('f-vessel',   'DSV Saturn', 180, { infer: true });
    await fillField('f-engineer', 'Marco Colombo (EMP-00412)', 180, { infer: true });
    await fillField('f-date',     '17 Apr 2026', 180);
    await fillField('f-activity', 'Saturation dive · completed 14:00 GST', 220);
    await fillField('f-asset',    'Riser 3 — anode set replaced', 180);
    await fillField('f-sea',      '2', 180);
    await fillField('f-incidents','None', 180);
    await fillField('f-medical',  'A. Ahmed — mild ear pressure, cleared by Medic Hansen', 220);

    setReportStatus('Ready to submit', 'status--pending');

    await wait(600);
    await showTyping(500);
    addIn(`Send to <strong>Supervisor Romano</strong>? 👍 or tap a field to edit.`);
    setSuggestions([
      ['👍 Send',        '__send_report'],
      ['✏️ Edit asset',  '__edit_asset'],
    ]);
    state.step = 'confirm-report';
  }

  // ───────────────────────────────────────────────────────────
  //  FLOW: TYPED REPORT (alt path, same destination)
  // ───────────────────────────────────────────────────────────
  async function flowTypedReport() {
    // actually same as voice — just re-use the structured card
    await wait(300);
    return flowVoiceReport();
  }

  // ───────────────────────────────────────────────────────────
  //  FLOW: REPORT CONFIRM
  // ───────────────────────────────────────────────────────────
  async function handleConfirmReport() {
    addOut('👍');
    setSuggestions([]);
    await showTyping(600);
    addIn(`Filed. <strong>ERP #DR-24817</strong>. Supervisor notified. 🌙<br/>Goodnight, Marco — or anything else?`);

    setReportStatus('Submitted · Pending approval', 'status--approved');
    pushActivity({
      title: `✓ Daily Report <b>DR-24817</b> submitted to ERPNext`,
      meta: `Routed to sup.romano@impresub.com · approval SLA 4h · audit log sealed`,
      ok: true,
    });

    setSuggestions([
      ['💳 Add Expense', 'Add Expense'],
      ['✅ Done',        '__done'],
    ]);
    state.step = 'post-report';
  }

  // ───────────────────────────────────────────────────────────
  //  FLOW: EXPENSE
  // ───────────────────────────────────────────────────────────
  async function flowExpense() {
    state.step = 'expense';
    await showTyping(700);
    addIn(`Sure. Tell me in one line — amount, what, where.<br/><em>e.g. "240 AED, taxi from heliport, last rotation"</em>`);
    setSuggestions([
      ['💡 Example',  '240 AED, taxi from heliport to hotel, last rotation'],
    ]);
  }

  async function handleExpenseDetails(text) {
    await showTyping(1100);

    // fake NLP extraction
    const amountMatch = text.match(/(\d+(?:\.\d+)?)\s*(aed|eur|usd|gbp|dhs|dirham)?/i);
    const amount = amountMatch ? `${amountMatch[1]} ${(amountMatch[2]||'AED').toUpperCase().replace('DHS','AED').replace('DIRHAM','AED')}` : '240 AED';

    let category = 'Travel';
    if (/lunch|meal|food|coffee/i.test(text))  category = 'Crew Welfare';
    if (/fuel|gas|diesel/i.test(text))         category = 'Vessel Operations';
    if (/hotel|room|stay/i.test(text))         category = 'Accommodation';

    const descGuess = text;

    const expId = `EXP-0${++state.lastExpenseId}`;
    document.getElementById('exp-id').textContent = expId;

    const cardHtml = `
      <div class="card__bar">
        <span class="card__svc">${category.toUpperCase()}</span>
        <span class="card__sep">›</span>
        EXPENSE · DRAFT
      </div>
      <div class="card__body">
        <div class="card__row" style="animation-delay:.1s">
          <span class="k">ID</span><span class="v">${expId}</span>
        </div>
        <div class="card__row" style="animation-delay:.25s">
          <span class="k">Project</span><span class="v infer">PRJ-AD-SAAD-2</span>
        </div>
        <div class="card__row" style="animation-delay:.4s">
          <span class="k">Category</span><span class="v infer">${category}</span>
        </div>
        <div class="card__row" style="animation-delay:.55s">
          <span class="k">Amount</span><span class="v">${amount}</span>
        </div>
        <div class="card__row" style="animation-delay:.7s">
          <span class="k">Description</span><span class="v">${escapeHtml(descGuess)}</span>
        </div>
      </div>
    `;
    addIn(cardHtml, { card: true });
    addIn(`Logged to <strong>PRJ-AD-SAAD-2 · ${category}</strong>. Snap the receipt when you can — even tomorrow's fine. Reimbursed Friday. ✓`);

    // Fill ERPNext expense doc
    docExpense.hidden = false;
    setExpenseStatus('Parsing', 'status--pending');
    await fillField('e-project', 'PRJ-AD-SAAD-2', 200, { infer: true });
    await fillField('e-cc',      'CC-OPS-OFFSHORE', 180, { infer: true });
    await fillField('e-cat',     category, 180, { infer: true });
    await fillField('e-amount',  amount, 180);
    await fillField('e-desc',    descGuess, 180);
    await fillField('e-receipt', 'pending photo', 200);
    setExpenseStatus('Queued for reimbursement', 'status--approved');

    pushActivity({
      title: `✓ Expense <b>${expId}</b> logged · ${amount} · ${category}`,
      meta: `Project auto-coded from GPS · reimbursement cycle Fri 19 Apr`,
      ok: true,
    });

    await wait(700);
    setSuggestions([
      ['📷 Upload receipt (simulate)', '__receipt'],
      ['✅ Done',                      '__done'],
    ]);
    state.step = 'post-expense';
  }

  async function handleReceipt() {
    addOut('📷 [receipt photo sent]');
    setSuggestions([]);
    await showTyping(900);
    addIn(`Receipt matched. Amount & vendor confirmed. ✓<br/>All set, Marco.`);
    await fillField('e-receipt', 'attached · OCR matched ✓', 0);
    pushActivity({
      title: `Receipt matched to expense`,
      meta: `OCR confidence 98% · vendor "Al Marfa Taxi" · amount match`,
      ok: true,
    });
    setSuggestions([
      ['✅ Done', '__done'],
    ]);
  }

  // ───────────────────────────────────────────────────────────
  //  FLOW: MESS HALL MODE (the killer feature demo)
  // ───────────────────────────────────────────────────────────
  async function flowMessHall(userText) {
    await showTyping(1200);
    addIn(`Sounds like you're describing a previous shift. Let me turn it into a report. 🪄`);
    await wait(500);

    const cardHtml = `
      <div class="card__bar">
        <span class="card__svc">ROV INTERVENTION · INSPECTION</span>
        <span class="card__sep">›</span>
        MESS HALL MODE · AUTO-DETECTED
      </div>
      <div class="card__body">
        <div class="card__row" style="animation-delay:.1s">
          <span class="k">Trigger</span><span class="v infer">past-tense + work context</span>
        </div>
        <div class="card__row" style="animation-delay:.25s">
          <span class="k">Activity</span><span class="v">ROV inspection · Jacket B</span>
        </div>
        <div class="card__row" style="animation-delay:.4s">
          <span class="k">Duration</span><span class="v">~3h</span>
        </div>
        <div class="card__row" style="animation-delay:.55s">
          <span class="k">Finding</span><span class="v">Corrosion at node 4</span>
        </div>
        <div class="card__row" style="animation-delay:.7s">
          <span class="k">Severity</span><span class="v">needs your call ↓</span>
        </div>
      </div>
    `;
    addIn(cardHtml, { card: true });
    addIn(`What severity should I flag?`);
    setSuggestions([
      ['🟢 Low',    '__sev_low'],
      ['🟡 Medium', '__sev_med'],
      ['🔴 High',   '__sev_high'],
    ]);
    state.step = 'mess-hall-sev';
  }

  async function handleSeverity(level) {
    const label = { low: 'Low', med: 'Medium', high: 'High' }[level];
    addOut(label);
    setSuggestions([]);
    await showTyping(700);
    addIn(`Filed — <strong>DR-24818</strong> · severity ${label}.<br/>Asset Integrity team notified. They'll want photos when you're back down. 📸`);
    pushActivity({
      title: `✓ Daily Report <b>DR-24818</b> filed via Mess Hall Mode`,
      meta: `ROV inspection · Jacket B · corrosion node 4 · severity ${label} · flagged to Asset Integrity`,
      ok: true,
    });
    setSuggestions([
      ['💳 Add Expense', 'Add Expense'],
      ['✅ Done',        '__done'],
    ]);
  }

  // ───────────────────────────────────────────────────────────
  //  FLOW: DONE
  // ───────────────────────────────────────────────────────────
  async function flowDone() {
    setSuggestions([]);
    addOut('✅ Done, thanks');
    await showTyping(500);
    addIn(`Goodnight, Marco. Rest easy. 🌙<br/><em>— DECK</em>`);
    pushActivity({
      title: `Thread closed for the evening`,
      meta: `2 docs filed · 1 expense · 0 corrections · session 3m 14s`,
      ok: true,
    });
    state.step = 'done';
  }

  // ───────────────────────────────────────────────────────────
  //  SPECIAL COMMANDS dispatcher
  // ───────────────────────────────────────────────────────────
  function isSpecial(t) { return /^__/.test(t); }

  async function handleSpecial(cmd) {
    switch (cmd) {
      case '__send_report':  return handleConfirmReport();
      case '__edit_asset':   {
        addOut('Edit: Asset');
        await showTyping(500);
        addIn(`What's the correction for "Riser 3 — anode set replaced"?`);
        return;
      }
      case '__receipt':      return handleReceipt();
      case '__sev_low':      return handleSeverity('low');
      case '__sev_med':      return handleSeverity('med');
      case '__sev_high':     return handleSeverity('high');
      case '__done':         return flowDone();
      case '__voice_demo':   return flowVoiceReport();
      default: return;
    }
  }

  // wrap handleUserInput to intercept specials from chips
  const _origHandle = handleUserInput;
  window._handle = async (raw, fromChip) => {
    const text = String(raw).trim();
    if (isSpecial(text)) {
      setSuggestions([]);
      return handleSpecial(text);
    }
    return _origHandle(text, fromChip);
  };

  // rebind chips through the wrapper
  function setSuggestionsV2(items) {
    suggest.innerHTML = '';
    if (!items || !items.length) return;
    items.forEach(([label, value]) => {
      const btn = document.createElement('button');
      btn.className = 'chip-sug';
      btn.textContent = label;
      btn.addEventListener('click', () => window._handle(value || label, true));
      suggest.appendChild(btn);
    });
  }
  // replace the old version
  setSuggestions = setSuggestionsV2;

  // ─── INPUT HANDLERS ────────────────────────────────────────
  function updateSendButton() {
    if (input.value.trim().length > 0) sendBtn.classList.add('active');
    else sendBtn.classList.remove('active');
  }

  input.addEventListener('input', updateSendButton);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = input.value.trim();
      if (v) window._handle(v);
    }
  });
  sendBtn.addEventListener('click', () => {
    const v = input.value.trim();
    if (v) window._handle(v);
  });
  micBtn.addEventListener('click', () => {
    if (state.step === 'idle' || state.step === 'await-intent' || state.step === 'report') {
      window._handle('__voice_demo');
    } else {
      flowVoiceReport();
    }
  });

  // ─── RESET ─────────────────────────────────────────────────
  resetBtn.addEventListener('click', () => {
    chat.innerHTML = `
      <div class="wa__date">TODAY · 17 APR 2026</div>
      <div class="wa__system">🔒 Messages are end-to-end encrypted.</div>
    `;
    suggest.innerHTML = '';
    activity.innerHTML = `
      <div class="activity__placeholder">
        Awaiting field input from <b>DSV Saturn</b>…<br/>
        <span>Last sync: 2 min ago</span>
      </div>
    `;
    docReport.hidden = true;
    docExpense.hidden = true;
    // reset fields
    ['f-project','f-vessel','f-engineer','f-date','f-activity','f-asset','f-sea','f-incidents','f-medical',
     'e-project','e-cc','e-cat','e-amount','e-desc','e-receipt'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = '—'; el.classList.remove('fill'); el.style.color = ''; }
    });
    setReportStatus('Draft', 'status--draft');
    setExpenseStatus('Draft', 'status--draft');
    input.value = '';
    updateSendButton();
    state.step = 'idle';
    openerIfEmpty();
  });

  // ─── AUTO-PLAY ─────────────────────────────────────────────
  autoBtn.addEventListener('click', async () => {
    if (state.isAutoplay) return;
    state.isAutoplay = true;
    autoBtn.textContent = '■ Playing…';
    autoBtn.disabled = true;

    // fresh start
    resetBtn.click();
    await wait(800);

    await window._handle('Hi');
    await wait(1800);
    await window._handle('Daily Report');
    await wait(1400);
    await window._handle('__voice_demo');
    // wait for the voice flow to finish (it takes about ~8s)
    await wait(9500);
    await window._handle('__send_report');
    await wait(2200);
    await window._handle('Add Expense');
    await wait(1800);
    await window._handle('240 AED, taxi from heliport to hotel, last rotation');
    await wait(3500);
    await window._handle('__receipt');
    await wait(2500);
    await window._handle('__done');

    state.isAutoplay = false;
    autoBtn.textContent = '▶ Auto-play story';
    autoBtn.disabled = false;
  });

  // ─── SCROLL REVEAL + COUNTERS ──────────────────────────────
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        if (e.target.matches('.impact')) animateCounters();
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.scene, .wow__card, .impact').forEach(el => {
    el.classList.add('reveal');
    io.observe(el);
  });

  function animateCounters() {
    document.querySelectorAll('.impact__num [data-count]').forEach(el => {
      const target = parseInt(el.dataset.count, 10);
      const duration = 1200;
      const start = performance.now();
      function tick(t) {
        const p = Math.min(1, (t - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased);
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  CINEMATIC THEATER CONTROLLER
  //  The curtain / play button orchestrates the whole film.
  // ═══════════════════════════════════════════════════════════
  const theater  = document.getElementById('theater');
  const playBtn  = document.getElementById('play');
  const curtain  = document.getElementById('curtain');
  const beamEl   = document.getElementById('beam');
  const demoSec  = document.getElementById('demo');
  const exitBtn  = document.getElementById('demo-exit');

  // ─── FULLSCREEN MODE ────────────────────────────────────────
  function enterFullscreen() {
    if (!demoSec) return;
    demoSec.classList.add('demo--fullscreen');
    document.body.classList.add('no-scroll');
    // scroll demo into view (just in case)
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function exitFullscreen() {
    if (!demoSec) return;
    demoSec.classList.remove('demo--fullscreen');
    document.body.classList.remove('no-scroll');
    if (theater) theater.classList.remove('playing', 'transmitting');
    // smoothly bring user back to where the demo lives
    requestAnimationFrame(() => {
      demoSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  if (exitBtn) exitBtn.addEventListener('click', exitFullscreen);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && demoSec && demoSec.classList.contains('demo--fullscreen')) {
      exitFullscreen();
    }
  });

  // Flash the data-beam (phone → ERPNext) for a short burst
  async function flashBeam(ms = 1800) {
    if (!theater || !beamEl) return;
    theater.classList.add('transmitting');
    await wait(ms);
    theater.classList.remove('transmitting');
  }

  // ───────────────────────────────────────────────────────────
  //  FULL-CYCLE ORCHESTRATOR — the complete film
  //  9 scenes: Cairo → Processing → Mobilization → Vessel →
  //  Underwater → Marco reports → Invoice → Payables → Close
  // ───────────────────────────────────────────────────────────
  const chyronNum   = () => document.querySelector('.chyron__num');
  const chyronTitle = () => document.querySelector('.chyron__title');
  const progressBar = () => document.getElementById('progress-bar');

  const ALL_OVERLAYS = ['ov-cairo', 'ov-process', 'ov-mob', 'ov-uw'];

  function setChyron(num, title) {
    if (chyronNum())   chyronNum().textContent = num;
    if (chyronTitle()) chyronTitle().textContent = title;
  }
  function setProgress(p) {
    if (progressBar()) progressBar().style.width = Math.min(100, Math.max(0, p)) + '%';
  }
  function hideAllOverlays() {
    ALL_OVERLAYS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('ov--active');
    });
  }
  function showOverlay(id) {
    hideAllOverlays();
    const el = document.getElementById(id);
    if (el) el.classList.add('ov--active');
    // dim vessel when overlay is active
    if (theater) {
      theater.classList.add('in-cycle');
      theater.classList.remove('scene-vessel');
    }
  }
  function showVesselScene() {
    hideAllOverlays();
    if (theater) {
      theater.classList.add('in-cycle', 'scene-vessel');
    }
  }
  function leaveCycle() {
    hideAllOverlays();
    if (theater) theater.classList.remove('in-cycle', 'scene-vessel');
    setProgress(0);
  }

  // quick chat helpers that use the same bubble builders
  async function cycleChatIn(text, delay = 800) {
    await showTyping(delay);
    addIn(text);
  }
  async function cycleChatOut(text) {
    addOut(text);
    await wait(400);
  }
  async function cycleCard(title, rows, svcTag) {
    const rowsHtml = rows.map((r, i) =>
      `<div class="card__row" style="animation-delay:${(i*.1).toFixed(2)}s">
        <span class="k">${r[0]}</span>
        <span class="v ${r[2] ? 'infer' : ''}">${r[1]}</span>
      </div>`
    ).join('');
    const cardHtml = `
      <div class="card__bar">
        ${svcTag ? `<span class="card__svc">${svcTag}</span><span class="card__sep">›</span>` : ''}
        ${title}
      </div>
      <div class="card__body">${rowsHtml}</div>
    `;
    addIn(cardHtml, { card: true });
    await wait(Math.max(700, rows.length * 180 + 300));
  }

  // The full film
  async function playFullCycle() {
    if (!theater) return;

    // enter the cinema
    enterFullscreen();
    resetBtn.click();
    theater.classList.remove('playing');
    await wait(450);

    // start the cycle — curtain fades, phone rises
    theater.classList.add('playing', 'in-cycle');

    // ═══════ SCENE 01 — CAIRO: MAGED FORWARDS THE EMAIL ═══════
    showOverlay('ov-cairo');
    setChyron('SCENE 01 / 09', 'CAIRO HQ — THE INTAKE');
    setProgress(5);
    await wait(800);

    pushActivity({ title: '📧 Email received · <b>PETROJET</b>', meta: 'Subject: New Project · SoW attached · 09:14 EET' });
    await wait(2200);

    pushActivity({ title: '↪ Maged forwarded to DECK', meta: 'Intake parser engaged' });
    setProgress(9);
    await wait(1800);

    await cycleChatIn(`New project intake detected. 🔎<br/>Client: <em>PETROJET · Contracts Dept.</em><br/>Scope: <em>Underwater Survey · Block 9 · 30 days</em>`, 900);
    await wait(800);

    await cycleCard('PROJECT INTAKE · PARSED', [
      ['Project',  'PRJ-2026-0118', true],
      ['Client',   'PETROJET', true],
      ['Scope',    'Underwater Survey · Block 9', true],
      ['Duration', '30 days (estimate)', true],
      ['Status',   'NEW', false],
      ['Routed',   'Eng. Karim · Technical', true],
    ], 'PROJECT INTAKE · NEW');

    pushActivity({ title: '✓ <b>PRJ-2026-0118</b> created in ERPNext', meta: 'Drive folder provisioned · Karim notified · SLA 24h', ok: true });
    setProgress(14);
    await wait(1400);

    // ═══════ SCENE 02 — PROCESSING: TECH → COST → QUOTE → AWARD ═══════
    showOverlay('ov-process');
    setChyron('SCENE 02 / 09', 'THE SETUP — TECH · COST · QUOTE · AWARD');
    setProgress(18);

    await wait(1000);
    await cycleChatIn(`<strong>Technical review complete.</strong><br/>Resources locked — 2 divers (internal) · 1 ROV pilot (freelancer) · DSV Saturn (owned) · 1 mob crane (rented).`, 700);
    pushActivity({ title: 'Technical review complete', meta: 'Resources tagged: 2 internal · 1 freelance · 1 rented' });
    await wait(1400);

    await cycleChatIn(`<strong>Cost sheet assembled.</strong> $1.02M total — sent to Admin for pricing.`, 600);
    pushActivity({ title: '+ Cost Sheet · <b>$1,020,000</b>', meta: 'Breakdown: manpower · equipment · vessel · mobilization' });
    setProgress(25);
    await wait(1600);

    await cycleChatIn(`<strong>Quotation sent.</strong> $4.0M to PetroJet · Contracts Dept.`, 600);
    pushActivity({ title: '📤 Quotation <b>$4,000,000</b> sent', meta: 'Margin applied · status: SENT · awaiting award' });
    setProgress(30);
    await wait(1800);

    await cycleChatIn(`🏆 <strong>AWARDED.</strong> PetroJet signed the contract. Kicking off mobilization.`, 900);
    pushActivity({ title: '🏆 <b>PROJECT AWARDED</b>', meta: 'Contract signed · operational phase opened', ok: true });
    setProgress(36);
    await wait(2200);

    // ═══════ SCENE 03 — MOBILIZATION: CREW HEADS TO VESSEL ═══════
    showOverlay('ov-mob');
    setChyron('SCENE 03 / 09', 'PORT SAID — MOBILIZATION');
    setProgress(42);
    await wait(1000);

    await cycleChatIn(`Mobilization underway at <em>Port Said</em>. Crew boarding, equipment loaded, DSV Saturn pre-sail checks in progress.`, 800);
    pushActivity({ title: '🚢 Mobilization started', meta: 'Crew (8) · ROV spread · dive system · mob crane' });
    await wait(2200);

    pushActivity({ title: '✓ DSV Saturn cleared for sail', meta: 'ETA Block 9: 14h · GPS tracking live', ok: true });
    setProgress(48);
    await wait(1800);

    // ═══════ SCENE 04 — VESSEL AT SEA (brief transition) ═══════
    showVesselScene();
    setChyron('SCENE 04 / 09', 'BLOCK 9 — ON STATION');
    setProgress(52);
    await wait(1000);

    await cycleChatIn(`On station at Block 9. Sea state 2. Dive spread ready. Going subsea.`, 600);
    pushActivity({ title: '⚓ DSV Saturn on station · Block 9', meta: 'DP thrusters engaged · holding position' });
    setProgress(56);
    await wait(2000);

    // ═══════ SCENE 05 — UNDERWATER: DIVER WITH CAMERA ═══════
    showOverlay('ov-uw');
    setChyron('SCENE 05 / 09', 'SUBSEA · −42 m — THE DIVE');
    setProgress(62);

    // animate shot counter as photos pop in
    const shotsEl = document.getElementById('uw-shots');
    const bumpShots = async () => {
      for (let i = 1; i <= 3; i++) {
        await wait(1500);
        if (shotsEl) shotsEl.textContent = String(i);
      }
    };
    bumpShots();

    await wait(1200);
    await cycleChatIn(`🤿 Diver Ahmed at <em>−42 m</em> · anode A-3 inspection · camera rolling.`, 700);
    pushActivity({ title: '📸 Shot IMG_0142 captured', meta: 'Anode A-3 · general view · depth −42m' });
    await wait(1600);
    pushActivity({ title: '📸 Shot IMG_0143 captured', meta: 'Corrosion detail · west face · depth −42m' });
    await wait(1400);
    pushActivity({ title: '📸 Shot IMG_0144 captured', meta: 'Flange condition · depth −42m', ok: true });
    setProgress(70);
    await wait(1200);

    await cycleChatIn(`3 photos captured. Surfacing to hand off to Marco. 🫧`, 500);
    await wait(1500);

    // ═══════ SCENE 06 — MARCO REPORTS (ON THE VESSEL) ═══════
    showVesselScene();
    setChyron('SCENE 06 / 09', 'ON DECK — THE REPORT');
    setProgress(75);
    await wait(1200);

    await cycleChatOut('📷 [Ahmed shared 3 photos]');
    await wait(600);
    await cycleChatIn(`Got the photos. Want me to build the daily report around them? Say yes or record.`, 700);
    await wait(1600);

    // trigger the voice-note → structured report flow we already have
    await window._handle('__voice_demo');
    flashBeam(3200);
    await wait(10000); // let the existing voice flow finish

    await window._handle('__send_report');
    flashBeam(1600);
    pushActivity({ title: '✓ Daily Report <b>DR-24817</b> filed', meta: 'Photos attached · Marco Colombo · Supervisor notified', ok: true });
    setProgress(82);
    await wait(1800);

    // ═══════ SCENE 07 — INVOICE: DPR APPROVED → INVOICE ISSUED ═══════
    showVesselScene();  // stay on vessel but overlay new messages
    setChyron('SCENE 07 / 09', 'THE INVOICE — AUTO-BILLED');
    setProgress(86);
    await wait(900);

    await cycleChatIn(`📋 <strong>DPR-014 approved</strong> by PetroJet. Triggering invoice automatically.`, 700);
    pushActivity({ title: '✓ DPR-014 approved by client', meta: 'Eligible for invoicing · 15-day milestone', ok: true });
    await wait(1400);

    await cycleCard('INVOICE · AUTO-ISSUED', [
      ['Invoice', 'INV-2026-0044', false],
      ['Client',  'PETROJET', true],
      ['Project', 'PRJ-2026-0118', true],
      ['Amount',  '$620,000', false],
      ['Due',     '30 days · 17 May 2026', true],
      ['Status',  'SENT', false],
    ], 'AUTO-BILLING · DPR-TRIGGERED');

    pushActivity({ title: '📤 <b>INV-2026-0044</b> sent · $620,000', meta: 'CFO notified · AR aging updated', ok: true });
    setProgress(91);
    await wait(1800);

    // ═══════ SCENE 08 — PAYABLES: SUPPLIER → PO → AP ═══════
    showVesselScene();
    setChyron('SCENE 08 / 09', 'PAYABLES — AUTO-ROUTED');
    setProgress(94);
    await wait(900);

    await cycleChatIn(`📨 Supplier invoice received: <em>Al-Bahar Marine</em> · $84,500 · PRJ-2026-0118.<br/>Extracted, creating PO.`, 800);
    pushActivity({ title: '📨 Supplier invoice · <b>Al-Bahar Marine</b>', meta: 'Amount: $84,500 · matched to PRJ-2026-0118' });
    await wait(1400);

    await cycleCard('PURCHASE ORDER · DRAFT', [
      ['PO',      'PO-04481', false],
      ['Vendor',  'Al-Bahar Marine Equipment', true],
      ['Project', 'PRJ-2026-0118', true],
      ['Amount',  '$84,500', false],
      ['Routing', 'CFO → COO', true],
      ['SLA',     '4h to approve', true],
    ], 'AP AUTOMATION · VENDOR-MATCHED');

    pushActivity({ title: '✓ <b>PO-04481</b> created · sent for approval', meta: 'Routed to CFO & COO · AP aging queued', ok: true });
    setProgress(98);
    await wait(2000);

    // ═══════ SCENE 09 — THE QUIET (close) ═══════
    setChyron('SCENE 09 / 09', 'THE QUIET — ONE AGENT, ONE THREAD');
    setProgress(100);
    await window._handle('__done');
    await wait(2200);

    // ═══════ END CARD — credits roll ═══════
    if (typeof showOverlay === 'function') {
      showOverlay('ov-end');
      setChyron('★ FIN ★', 'NO APPS · NO FORMS · JUST WHATSAPP');
    }
  }

  // expose legacy name too (in case something else calls it)
  const playCinematic = playFullCycle;

  if (playBtn) {
    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      playCinematic();
    });
  }
  // clicking anywhere on the curtain also starts it
  if (curtain) {
    curtain.addEventListener('click', () => playCinematic());
  }

  // Replace the bottom "Auto-play" button with the cinematic flow
  const freshAuto = autoBtn.cloneNode(true);
  autoBtn.parentNode.replaceChild(freshAuto, autoBtn);
  freshAuto.addEventListener('click', async () => {
    if (freshAuto.disabled) return;
    freshAuto.disabled = true;
    freshAuto.textContent = '■ Playing…';
    await playCinematic();
    freshAuto.textContent = '↻ Replay story';
    freshAuto.disabled = false;
  });

  // Reset → bring the curtain back, lower the phone
  resetBtn.addEventListener('click', () => {
    if (theater) theater.classList.remove('playing', 'transmitting');
  });

  // Keyboard: Space to play when curtain is visible
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && theater && !theater.classList.contains('playing')) {
      const rect = theater.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        e.preventDefault();
        playCinematic();
      }
    }
  });

  // ═══════════════════════════════════════════════════════════
  //  AUDIO — Web Audio API (zero external files, all generated)
  // ═══════════════════════════════════════════════════════════
  const SFX = {
    ctx: null,
    muted: false,
    masterGain: null,
    init() {
      if (this.ctx) return;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.35;
        this.masterGain.connect(this.ctx.destination);
      } catch(e) { /* silently fail */ }
    },
    _play(fn) {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      try { fn(this.ctx, this.masterGain); } catch(e) {}
    },
    // Gentle bell for notifications
    chime() {
      this._play((ctx, dest) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(1320, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.4);
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        o.connect(g); g.connect(dest);
        o.start(); o.stop(ctx.currentTime + 0.6);
      });
    },
    // Short message bubble pop
    pop() {
      this._play((ctx, dest) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(440, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.06);
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        o.connect(g); g.connect(dest);
        o.start(); o.stop(ctx.currentTime + 0.12);
      });
    },
    // Send swoosh
    send() {
      this._play((ctx, dest) => {
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        }
        const src = ctx.createBufferSource(); src.buffer = buf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(400, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(4000, ctx.currentTime + 0.18);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.12, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        src.connect(filter); filter.connect(g); g.connect(dest);
        src.start();
      });
    },
    // Camera shutter click
    cameraClick() {
      this._play((ctx, dest) => {
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i * 0.0006);
        }
        const src = ctx.createBufferSource(); src.buffer = buf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2200;
        filter.Q.value = 1.5;
        const g = ctx.createGain(); g.gain.value = 0.25;
        src.connect(filter); filter.connect(g); g.connect(dest);
        src.start();
      });
    },
    // Cinematic whoosh — used between scenes
    whoosh() {
      this._play((ctx, dest) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(80, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.5);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.5);
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
        o.connect(filter); filter.connect(g); g.connect(dest);
        o.start(); o.stop(ctx.currentTime + 0.6);
      });
    },
    // Confirmation success tone (carabiner click pitched + gentle)
    success() {
      this._play((ctx, dest) => {
        [880, 1320].forEach((freq, i) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'triangle';
          o.frequency.value = freq;
          g.gain.setValueAtTime(0, ctx.currentTime + i * 0.06);
          g.gain.linearRampToValueAtTime(0.12, ctx.currentTime + i * 0.06 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.06 + 0.3);
          o.connect(g); g.connect(dest);
          o.start(ctx.currentTime + i * 0.06);
          o.stop(ctx.currentTime + i * 0.06 + 0.3);
        });
      });
    },
    // Big cinematic stamp (AWARDED moment)
    stamp() {
      this._play((ctx, dest) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(60, ctx.currentTime);
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        o.connect(g); g.connect(dest);
        o.start(); o.stop(ctx.currentTime + 0.4);
      });
    },
    // Typing burst (for Maged at laptop)
    keyClick() {
      this._play((ctx, dest) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'square';
        o.frequency.value = 1800 + Math.random() * 400;
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.002);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
        o.connect(g); g.connect(dest);
        o.start(); o.stop(ctx.currentTime + 0.05);
      });
    }
  };

  // hook bubble builders to play sounds
  const _origAddIn  = addIn;
  const _origAddOut = addOut;
  addIn = function(...args) {
    const r = _origAddIn(...args);
    SFX.pop();
    return r;
  };
  addOut = function(...args) {
    const r = _origAddOut(...args);
    SFX.send();
    return r;
  };

  // sound toggle UI
  const soundBtn = document.getElementById('sound-toggle');
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      SFX.muted = !SFX.muted;
      soundBtn.classList.toggle('is-muted', SFX.muted);
      if (!SFX.muted) SFX.chime(); // confirm un-mute
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  LIVE CLOCK + TICKER
  // ═══════════════════════════════════════════════════════════
  function startClock() {
    const el = document.getElementById('hq-clock');
    if (!el) return;
    const update = () => {
      // Milan time = UTC + 2 (CEST). We'll just use local time formatted.
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      el.textContent = `${hh}:${mm}`;
    };
    update();
    setInterval(update, 30000);
  }

  function startTicker() {
    const track = document.getElementById('hq-ticker');
    if (!track) return;
    const items = track.querySelectorAll('.ticker__item');
    if (!items.length) return;
    let i = 0;
    setInterval(() => {
      i = (i + 1) % items.length;
      track.style.transform = `translateY(-${i * 16}px)`;
    }, 3500);
  }

  // ═══════════════════════════════════════════════════════════
  //  CHAPTER NAVIGATION + KEYBOARD SHORTCUTS
  // ═══════════════════════════════════════════════════════════
  const chapterBtns = document.querySelectorAll('.chapter');
  let currentSceneIdx = 0;
  let cyclePaused = false;
  let cycleSkipResolver = null;

  function setActiveChapter(idx) {
    currentSceneIdx = idx;
    chapterBtns.forEach((b, i) => b.classList.toggle('chapter--active', i === idx));
  }

  // Each chapter click resolves the current wait early and jumps
  // (simplest approach: just trigger a re-play but skipping to that index would need a refactor)
  chapterBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      // visual feedback only — true skip requires refactor of scene loop
      setActiveChapter(i);
      SFX.pop();
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  SCENE TITLE CARD — flash big title at scene start
  // ═══════════════════════════════════════════════════════════
  function showSceneTitle(num, text) {
    if (!theater) return;
    let card = theater.querySelector('.scene-title');
    if (!card) {
      card = document.createElement('div');
      card.className = 'scene-title';
      card.innerHTML = `
        <div class="scene-title__num"></div>
        <div class="scene-title__text"></div>
        <div class="scene-title__bar"></div>
      `;
      theater.appendChild(card);
    }
    card.querySelector('.scene-title__num').textContent  = num;
    card.querySelector('.scene-title__text').textContent = text;
    card.classList.remove('scene-title--in');
    void card.offsetWidth; // restart animation
    card.classList.add('scene-title--in');
  }

  // ═══════════════════════════════════════════════════════════
  //  IRIS WIPE — cinematic transition between scenes
  // ═══════════════════════════════════════════════════════════
  async function irisWipe() {
    const iris = document.getElementById('iris');
    if (!iris) return;
    iris.classList.remove('iris--wipe');
    void iris.offsetWidth;
    iris.classList.add('iris--wipe');
    SFX.whoosh();
    await wait(300);
  }

  // ═══════════════════════════════════════════════════════════
  //  PHONE 3D TILT — cursor follow
  // ═══════════════════════════════════════════════════════════
  const phoneScreen = document.querySelector('.phone__screen');
  let tiltRaf = null;
  document.addEventListener('mousemove', (e) => {
    if (!phoneScreen) return;
    if (tiltRaf) cancelAnimationFrame(tiltRaf);
    tiltRaf = requestAnimationFrame(() => {
      const isFs = demoSec && demoSec.classList.contains('demo--fullscreen');
      if (!isFs) return;
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dx = (e.clientX - cx) / cx;
      const dy = (e.clientY - cy) / cy;
      const rotY = dx * 6;
      const rotX = -dy * 4;
      phoneScreen.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  CURSOR AUTO-HIDE in fullscreen film
  // ═══════════════════════════════════════════════════════════
  let cursorTimer = null;
  function bumpCursor() {
    if (!demoSec) return;
    demoSec.classList.remove('cursor-hidden');
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(() => {
      if (demoSec.classList.contains('demo--fullscreen')) {
        demoSec.classList.add('cursor-hidden');
      }
    }, 2400);
  }
  document.addEventListener('mousemove', bumpCursor);

  // ═══════════════════════════════════════════════════════════
  //  KEYBOARD SHORTCUTS (in fullscreen)
  // ═══════════════════════════════════════════════════════════
  document.addEventListener('keydown', (e) => {
    if (!demoSec || !demoSec.classList.contains('demo--fullscreen')) return;
    if (e.key === 'm' || e.key === 'M') {
      if (soundBtn) soundBtn.click();
      e.preventDefault();
    }
    // Space, arrows would need pause/resume infra — left as future work
  });

  // ═══════════════════════════════════════════════════════════
  //  END CARD — replay button + pilot CTA
  // ═══════════════════════════════════════════════════════════
  const endReplayBtn = document.getElementById('end-cta-replay');
  const endPilotBtn  = document.getElementById('end-cta-pilot');
  if (endReplayBtn) {
    endReplayBtn.addEventListener('click', async () => {
      // hide end card and restart
      const endOv = document.getElementById('ov-end');
      if (endOv) endOv.classList.remove('ov--active');
      SFX.pop();
      await wait(200);
      playFullCycle();
    });
  }
  if (endPilotBtn) {
    endPilotBtn.addEventListener('click', () => {
      // exit fullscreen and scroll to the pilot section
      exitFullscreen();
      requestAnimationFrame(() => {
        document.getElementById('close')?.scrollIntoView({ behavior: 'smooth' });
      });
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  LANGUAGE TOGGLE — basic EN/AR for chrome (chyron + ticker)
  // ═══════════════════════════════════════════════════════════
  const langBtn = document.getElementById('lang-toggle');
  let lang = 'en';
  const T = {
    chyrons: {
      en: [
        ['SCENE 01 / 09', 'CAIRO HQ — THE INTAKE'],
        ['SCENE 02 / 09', 'THE SETUP — TECH · COST · QUOTE · AWARD'],
        ['SCENE 03 / 09', 'PORT SAID — MOBILIZATION'],
        ['SCENE 04 / 09', 'BLOCK 9 — ON STATION'],
        ['SCENE 05 / 09', 'SUBSEA · −42 m — THE DIVE'],
        ['SCENE 06 / 09', 'ON DECK — THE REPORT'],
        ['SCENE 07 / 09', 'THE INVOICE — AUTO-BILLED'],
        ['SCENE 08 / 09', 'PAYABLES — AUTO-ROUTED'],
        ['SCENE 09 / 09', 'THE QUIET — ONE AGENT, ONE THREAD'],
      ],
      ar: [
        ['مشهد ٠١ / ٠٩', 'مقر القاهرة — استلام المشروع'],
        ['مشهد ٠٢ / ٠٩', 'الإعداد — فني · تكلفة · عرض · ترسية'],
        ['مشهد ٠٣ / ٠٩', 'بورسعيد — التعبئة'],
        ['مشهد ٠٤ / ٠٩', 'البلوك ٩ — على الموقع'],
        ['مشهد ٠٥ / ٠٩', 'تحت الماء · ‎−٤٢‎ م — الغوص'],
        ['مشهد ٠٦ / ٠٩', 'على السطح — التقرير'],
        ['مشهد ٠٧ / ٠٩', 'الفاتورة — تلقائيًا'],
        ['مشهد ٠٨ / ٠٩', 'المستحقات — توجيه ذكي'],
        ['مشهد ٠٩ / ٠٩', 'الهدوء — وكيل واحد · محادثة واحدة'],
      ]
    },
    ticker: {
      en: [
        '5 vessels active worldwide',
        '3 DPRs awaiting client approval',
        '12 invoices auto-issued today',
        '€680K in AR collected this week',
        'Block 9 · Saadiyat-2 · day 14 of 30'
      ],
      ar: [
        '٥ سفن في الخدمة حول العالم',
        '٣ تقارير DPR بانتظار اعتماد العميل',
        '١٢ فاتورة صادرة تلقائيًا اليوم',
        '٦٨٠ ألف يورو محصلة هذا الأسبوع',
        'البلوك ٩ · سعديات-٢ · اليوم ١٤ من ٣٠'
      ]
    }
  };
  function applyLang() {
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    langBtn?.classList.toggle('is-ar', lang === 'ar');
    // update ticker items
    const items = document.querySelectorAll('.ticker__item');
    T.ticker[lang].forEach((txt, i) => { if (items[i]) items[i].textContent = txt; });
  }
  if (langBtn) {
    langBtn.addEventListener('click', () => {
      lang = lang === 'en' ? 'ar' : 'en';
      applyLang();
      SFX.pop();
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  ENHANCED playFullCycle — with sound, scene titles, end card
  // ═══════════════════════════════════════════════════════════
  // Wrap setChyron to also flash scene title + update active chapter + play whoosh
  const _origSetChyron = setChyron;
  let _scenePulseIdx = -1;
  setChyron = function(num, title) {
    _origSetChyron(num, title);
    // localize using current lang
    const idxStr = (num.match(/(\d+)/g) || [])[0];
    const idx = idxStr ? (parseInt(idxStr, 10) - 1) : -1;
    if (idx >= 0 && idx < (T.chyrons[lang]?.length || 0)) {
      const local = T.chyrons[lang][idx];
      _origSetChyron(local[0], local[1]);
    }
    if (idx !== _scenePulseIdx) {
      _scenePulseIdx = idx;
      setActiveChapter(idx);
      showSceneTitle(num, T.chyrons[lang]?.[idx]?.[1] || title);
      SFX.whoosh();
      // first scene → chime (notification arrived)
      if (idx === 0) setTimeout(() => SFX.chime(), 600);
      // award scene → stamp
      if (idx === 1) setTimeout(() => SFX.stamp(), 4200);
      // subsea → camera clicks at 1.5s, 3s, 4.5s
      if (idx === 4) {
        [1500, 3000, 4500].forEach(t => setTimeout(() => SFX.cameraClick(), t));
      }
      // invoice success
      if (idx === 6) setTimeout(() => SFX.success(), 1200);
    }
  };

  // hook into pushActivity → success chime when ✓ items added
  const _origPushAct = pushActivity;
  pushActivity = function(args) {
    const r = _origPushAct(args);
    if (args && args.ok) SFX.success();
    return r;
  };

  // playFullCycle already handles its own end card — no wrapper needed.
  window.__deckPlay = playFullCycle;

  // ─── BOOT ──────────────────────────────────────────────────
  function boot() {
    updateSendButton();
    openerIfEmpty();
    startClock();
    startTicker();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
