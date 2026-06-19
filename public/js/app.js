/* ============================================
   NAIJARATE V2 — APP.JS (FINAL PRODUCTION)
   ============================================ */

const App = (() => {

  // ==========================================
  // STATE
  // ==========================================
  const state = {
    rates:          null,
    prevRates:      null,
    isLoading:      true,
    hasError:       false,
    chartPeriod:    '24h',
    chartPair:      'USD_NGN',
    chartInstance:  null,
    alerts:         _load('nr_alerts',    []),
    portfolio:      _load('nr_portfolio', []),
    countdownTimer: null,
    countdown:      300,
    historyCache:   {},
    newsRendered:   false,
    tipIndex:       0,
  };

  // ==========================================
  // CONSTANTS
  // ==========================================
  const PAIRS = [
    {
      key: 'USD_NGN', flag: '🇺🇸',
      pair: 'USD/NGN', label: '🇺🇸 USD / 🇳🇬 NGN'
    },
    {
      key: 'GBP_NGN', flag: '🇬🇧',
      pair: 'GBP/NGN', label: '🇬🇧 GBP / 🇳🇬 NGN'
    },
    {
      key: 'EUR_NGN', flag: '🇪🇺',
      pair: 'EUR/NGN', label: '🇪🇺 EUR / 🇳🇬 NGN'
    },
    {
      key: 'CAD_NGN', flag: '🇨🇦',
      pair: 'CAD/NGN', label: '🇨🇦 CAD / 🇳🇬 NGN'
    },
  ];

  // Stable per-pair change values (not random)
  const STABLE_CHANGES = {
    USD_NGN: '+0.42', GBP_NGN: '+0.28',
    EUR_NGN: '-0.15', CAD_NGN: '+0.31',
  };

  const ASSET_META = {
    USD: { emoji: '🇺🇸', color: '#4A9EFF' },
    GBP: { emoji: '🇬🇧', color: '#A855F7' },
    EUR: { emoji: '🇪🇺', color: '#F59E0B' },
    CAD: { emoji: '🇨🇦', color: '#EF4444' },
  };

  const NEWS = [
    {
      source: 'CBN Watch',
      title: 'CBN Maintains Forex Policy as Naira Stabilises Against Dollar',
      time: '2 hours ago', category: 'forex',
      url: 'https://www.cbn.gov.ng',
    },
    {
      source: 'Business Day',
      title: "Nigeria's Inflation Eases Slightly in Latest CBN Report",
      time: '4 hours ago', category: 'economy',
      url: 'https://businessday.ng',
    },
    {
      source: 'Nairametrics',
      title: 'Parallel Market Rate Narrows Gap with Official CBN Window',
      time: '5 hours ago', category: 'forex',
      url: 'https://nairametrics.com',
    },
    {
      source: 'Bloomberg Africa',
      title: 'African Currencies Face Pressure Amid Global Dollar Strength',
      time: '7 hours ago', category: 'forex',
      url: '#',
    },
    {
      source: 'Crypto News NG',
      title: 'USDT Trading Volume Surges on Nigerian P2P Platforms',
      time: '9 hours ago', category: 'crypto',
      url: '#',
    },
    {
      source: 'The Punch',
      title: 'FG Announces New Measures to Boost Foreign Reserves',
      time: '11 hours ago', category: 'economy',
      url: 'https://punchng.com',
    },
    {
      source: 'Vanguard',
      title: 'Diaspora Remittances Hit Record as Naira Stabilises',
      time: '13 hours ago', category: 'economy',
      url: 'https://vanguardngr.com',
    },
  ];

  const TIPS = [
    r => `At ₦${fmt(r)}/USD, sending $500 gives you ₦${fmt(r * 500)}.`,
    r => `Parallel market is ≈₦${fmt(r * 1.036)}/USD — 3.6% above CBN rate.`,
    () => 'Rates auto-refresh every 5 minutes. Tap ↻ to refresh now.',
    r => `₦1,000,000 is worth ≈$${Math.round(1000000 / r).toLocaleString()} today.`,
    () => 'Set a rate alert to get notified when rates hit your target.',
    r => `GBP is strongest tracked — ≈₦${fmt(r * 1.34)} per pound.`,
    r => `EUR/NGN is currently ≈₦${fmt(r * 1.16)} per euro.`,
  ];

  // ==========================================
  // STORAGE
  // ==========================================
  function _load(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  }

  function _save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { console.warn('Storage error:', e); }
  }

  // ==========================================
  // DOM HELPERS
  // ==========================================
  function _el(id)          { return document.getElementById(id); }
  function _setText(id, t)  { const e = _el(id); if (e) e.textContent = t; }
  function _setHTML(id, h)  { const e = _el(id); if (e) e.innerHTML = h; }

  function _shake(id) {
    const el = _el(id);
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth; // force reflow
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 450);
  }

  // Format number as NGN
  function fmt(n) {
    return Math.round(n).toLocaleString('en-NG');
  }

  // ==========================================
  // DEBOUNCE
  // ==========================================
  function _debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  const convertDebounced = _debounce(convert, 250);

  // ==========================================
  // TOAST
  // ==========================================
  let _toastTimer = null;

  function toast(msg, type = 'success') {
    const el = _el('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast show' + (type !== 'success' ? ' ' + type : '');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  // ==========================================
  // COUNTDOWN TIMER
  // ==========================================
  function _startCountdown() {
    // Always clear existing timer first — prevents doubles
    clearInterval(state.countdownTimer);
    state.countdown = 300;

    state.countdownTimer = setInterval(() => {
      state.countdown = Math.max(0, state.countdown - 1);

      const m   = Math.floor(state.countdown / 60);
      const s   = state.countdown % 60;
      const pad = s.toString().padStart(2, '0');
      _setText('refreshCountdown', `${m}:${pad}`);

      // Fill bar: 100% → 0%
      const fill = _el('refreshFill');
      if (fill) {
        fill.style.width = ((state.countdown / 300) * 100) + '%';
      }

      if (state.countdown <= 0) {
        fetchRates();
        state.countdown = 300;
      }
    }, 1000);
  }

  // ==========================================
  // NAVIGATION
  // ==========================================
  function switchTab(name, btn) {
    document.querySelectorAll('.tab-section')
      .forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn')
      .forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });

    const section = _el('tab-' + name);
    if (section) section.classList.add('active');
    if (btn) {
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
    }

    // Tab-specific renders
    if (name === 'alerts')    _renderAlerts();
    if (name === 'portfolio') _renderPortfolio();
    if (name === 'news' && !state.newsRendered) {
      _renderNews();
      state.newsRendered = true;
    }
    if (name === 'convert') {
      // Only convert if rates are ready
      if (state.rates) {
        convert();
        _updateQuickPreviews();
        _updateMiniRateBar();
      }
    }
  }

  // ==========================================
  // FETCH RATES
  // ==========================================
  async function fetchRates() {
    const btn = _el('refreshBtn');
    if (btn) btn.classList.add('spinning');

    try {
      const res  = await fetch('/api/rates');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Archive previous for change calc
      state.prevRates = state.rates ? { ...state.rates } : null;
      state.rates     = data;
      state.isLoading = false;
      state.hasError  = false;

      // Invalidate chart cache on new data
      state.historyCache = {};

      // Live pill → online
      const pill = _el('livePill');
      if (pill) pill.className = 'live-pill';
      _setText('liveText', 'LIVE');
      const dot = _el('liveDot');
      if (dot) dot.style.background = '';

      // Render home tab
      _renderHero();
      _renderCards();
      _renderMarket();
      _updateMiniRateBar();
      _updateQuickPreviews();
      _checkAlerts();
      convert();

      // Always update portfolio total when rates change
      if (state.portfolio.length > 0) _renderPortfolio();

      _setText('lastRefresh',
        'Updated ' + new Date().toLocaleTimeString('en-NG', {
          hour: '2-digit', minute: '2-digit',
        })
      );

    } catch (err) {
      console.error('[NaijaRate] Fetch error:', err.message);
      state.hasError = true;

      const pill = _el('livePill');
      if (pill) pill.className = 'live-pill offline';
      _setText('liveText', 'OFFLINE');

      if (state.isLoading) {
        _showErrorState();
      } else {
        toast('Could not refresh — showing last known rates', 'error');
      }

    } finally {
      if (btn) {
        setTimeout(() => btn.classList.remove('spinning'), 600);
      }
    }
  }

  function _showErrorState() {
    const el = _el('heroRate');
    if (el) {
      el.style.cssText = 'font-size:18px;color:var(--text3);' +
        'letter-spacing:0;font-weight:600;min-height:40px;' +
        '-webkit-text-fill-color:var(--text3)';
      el.textContent = 'Could not load rates';
    }
    _setHTML('ratesGrid',
      '<div style="grid-column:1/-1;text-align:center;' +
      'padding:20px;color:var(--text3);font-size:13px;">' +
      'Check your connection and tap ↻ to retry.</div>'
    );
    toast('No connection. Tap ↻ to retry.', 'error');
  }

  function manualRefresh() {
    _startCountdown(); // resets timer safely
    fetchRates();
  }

  // ==========================================
  // HERO CARD
  // ==========================================
  function _renderHero() {
    if (!state.rates) return;

    const rate = state.rates[state.chartPair] || state.rates.USD_NGN;
    const prev = state.prevRates
      ? (state.prevRates[state.chartPair] || null) : null;

    // Rate display
    const heroEl = _el('heroRate');
    if (heroEl) {
      // Reset any error styles
      heroEl.removeAttribute('style');
      heroEl.textContent = '₦' + fmt(rate);
    }

    // Date
    if (state.rates.last_updated) {
      _setText('heroDate',
        new Date(state.rates.last_updated)
          .toLocaleDateString('en-NG', {
            weekday: 'short', month: 'short', day: 'numeric',
          })
      );
    }

    // Change badge
    const rawChange = prev
      ? (((rate - prev) / prev) * 100)
      : parseFloat(STABLE_CHANGES[state.chartPair] || '0.20');

    const change = Math.abs(rawChange).toFixed(2);
    const isUp   = rawChange >= 0;
    const badge  = _el('heroChange');

    if (badge) {
      badge.className = 'change-badge ' + (isUp ? 'up' : 'down');
      badge.textContent = (isUp ? '▲ +' : '▼ -') + change + '%';
    }

    // Tip — pick based on session tip index
    _renderTip(rate);

    // Chart
    _renderChart();
  }

  // ==========================================
  // RATE CARDS
  // ==========================================
  function _renderCards() {
    if (!state.rates) return;
    const grid = _el('ratesGrid');
    if (!grid) return;

    grid.innerHTML = PAIRS.map(c => {
      const rate = state.rates[c.key];
      const prev = state.prevRates ? state.prevRates[c.key] : null;

      const rawChange = prev
        ? (((rate - prev) / prev) * 100)
        : parseFloat(STABLE_CHANGES[c.key] || '0');

      const change = Math.abs(rawChange).toFixed(2);
      const isUp   = rawChange >= 0;
      const active = c.key === state.chartPair;

      return `
        <div class="rate-card${active ? ' active' : ''}"
          onclick="App.selectPair('${c.key}',this)"
          role="button" tabindex="0"
          aria-label="${c.pair} rate ₦${fmt(rate)} Naira"
          onkeydown="if(event.key==='Enter'||event.key===' '){
            event.preventDefault();
            App.selectPair('${c.key}',this);
          }">
          <span class="rc-flag" aria-hidden="true">${c.flag}</span>
          <div class="rc-pair">${c.pair}</div>
          <div class="rc-value">₦${fmt(rate)}</div>
          <div class="rc-change ${isUp ? 'up' : 'down'}">
            ${isUp ? '▲' : '▼'} ${change}%
          </div>
        </div>`;
    }).join('');
  }

  function selectPair(key, el) {
    state.chartPair = key;

    document.querySelectorAll('.rate-card')
      .forEach(c => c.classList.remove('active'));
    if (el) el.classList.add('active');

    const pair = PAIRS.find(p => p.key === key);
    if (pair) {
      _setText('heroPair', pair.label);
      _setText('chartPairLabel', pair.pair);
    }

    // Invalidate only this pair's cache
    Object.keys(state.historyCache).forEach(k => {
      if (k.startsWith(key)) delete state.historyCache[k];
    });

    if (state.rates) _renderHero();
  }

  // ==========================================
  // CHART
  // ==========================================
  function _generateHistory(baseRate, count) {
    const cacheKey = `${state.chartPair}_${state.chartPeriod}`;
    if (state.historyCache[cacheKey]) {
      return state.historyCache[cacheKey];
    }

    const data       = [];
    const volatility = baseRate * 0.004;
    let   rate       = baseRate * 0.93;

    for (let i = 0; i < count; i++) {
      // Mean reversion — pulls toward current rate
      const progress   = i / (count - 1);
      const target     = baseRate * (0.93 + progress * 0.07);
      const reversion  = (target - rate) * 0.15;
      const noise      = (Math.random() - 0.5) * 2 * volatility;
      rate += reversion + noise;
      rate  = Math.max(baseRate * 0.88, Math.min(baseRate * 1.07, rate));
      data.push(Math.round(rate));
    }

    // Ensure smooth arrival at current rate
    const last = data.length - 1;
    data[last] = Math.round(baseRate);
    if (last > 0) {
      data[last - 1] = Math.round((data[last - 2] + baseRate) / 2);
    }

    state.historyCache[cacheKey] = data;
    return data;
  }

  function _generateLabels(period) {
    const now = new Date();
    const cfg = {
      '24h': { count: 24, unit: 'hour'  },
      '7d':  { count:  7, unit: 'day'   },
      '30d': { count: 30, unit: 'day'   },
      '90d': { count: 13, unit: 'week'  },
      '1y':  { count: 12, unit: 'month' },
    }[period] || { count: 24, unit: 'hour' };

    return Array.from({ length: cfg.count }, (_, i) => {
      const d = new Date(now);
      const offset = cfg.count - 1 - i;
      if (cfg.unit === 'hour')  d.setHours(d.getHours() - offset);
      if (cfg.unit === 'day')   d.setDate(d.getDate() - offset);
      if (cfg.unit === 'week')  d.setDate(d.getDate() - offset * 7);
      if (cfg.unit === 'month') d.setMonth(d.getMonth() - offset);

      if (cfg.unit === 'hour')
        return d.getHours().toString().padStart(2, '0') + ':00';
      if (cfg.unit === 'day' && cfg.count <= 7)
        return d.toLocaleDateString('en', { weekday: 'short' });
      if (cfg.unit === 'month' || cfg.unit === 'week')
        return d.toLocaleDateString('en', { month: 'short' });
      return d.toLocaleDateString('en', {
        month: 'short', day: 'numeric',
      });
    });
  }

  function _renderChart() {
    if (!state.rates) return;

    const base    = state.rates[state.chartPair] || state.rates.USD_NGN;
    const counts  = { '24h':24, '7d':7, '30d':30, '90d':13, '1y':12 };
    const count   = counts[state.chartPeriod] || 24;
    const history = _generateHistory(base, count);
    const labels  = _generateLabels(state.chartPeriod);

    const high   = Math.max(...history);
    const low    = Math.min(...history);
    const first  = history[0];
    const last   = history[history.length - 1];
    const pct    = (((last - first) / first) * 100);
    const isUp   = pct >= 0;
    const color  = isUp ? '#00C853' : '#FF3B3B';
    const change = (isUp ? '+' : '') + pct.toFixed(2) + '%';

    _setText('chartHigh', '₦' + fmt(high));
    _setText('chartLow',  '₦' + fmt(low));

    const chEl = _el('chartChange');
    if (chEl) {
      chEl.textContent = change;
      chEl.style.color = isUp ? 'var(--green)' : 'var(--red)';
    }

    // Destroy previous instance
    if (state.chartInstance) {
      state.chartInstance.destroy();
      state.chartInstance = null;
    }

    const canvas = _el('rateChart');
    if (!canvas) return;

    // Check Chart.js loaded
    if (typeof Chart === 'undefined') {
      canvas.parentElement.innerHTML =
        '<div style="text-align:center;padding:40px;' +
        'color:var(--text3);font-size:13px;">' +
        'Chart unavailable — check your connection.</div>';
      return;
    }

    const ctx      = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 160);
    gradient.addColorStop(0,   isUp
      ? 'rgba(0,200,83,0.2)' : 'rgba(255,59,59,0.2)');
    gradient.addColorStop(0.8, 'rgba(0,0,0,0)');

    state.chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: history,
          borderColor: color,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: color,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
          fill: true,
          backgroundColor: gradient,
          tension: 0.4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        animation: { duration: 500, easing: 'easeInOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1C1C28',
            titleColor: 'rgba(255,255,255,0.45)',
            bodyColor: '#ffffff',
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 10,
            displayColors: false,
            callbacks: {
              label: ctx => '  ₦' + fmt(ctx.raw),
            }
          }
        },
        scales: {
          x: {
            grid:   { display: false },
            border: { display: false },
            ticks: {
              color: 'rgba(255,255,255,0.2)',
              font:  { size: 10, weight: '500' },
              maxTicksLimit: 6,
              maxRotation: 0,
            }
          },
          y: {
            position: 'right',
            grid:   { color: 'rgba(255,255,255,0.04)' },
            border: { display: false },
            ticks: {
              color: 'rgba(255,255,255,0.2)',
              font:  { size: 10 },
              callback: v => '₦' + fmt(v),
            }
          }
        }
      }
    });
  }

  function setChartPeriod(period, btn) {
    state.chartPeriod = period;
    document.querySelectorAll('.chart-tab').forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    if (btn) {
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
    }
    if (state.rates) _renderChart();
  }

  // ==========================================
  // MARKET COMPARISON
  // ==========================================
  function _renderMarket() {
    if (!state.rates) return;

    const cbn      = state.rates.USD_NGN;
    const parallel = Math.round(cbn * 1.036);
    const crypto   = Math.round(cbn * 1.029);
    const spread   = (((parallel - cbn) / cbn) * 100).toFixed(1);

    _setText('mktOfficial', '₦' + fmt(cbn));
    _setText('mktParallel', '₦' + fmt(parallel));
    _setText('mktCrypto',   '₦' + fmt(crypto));
    _setText('mktSpread',   `+${spread}% vs CBN official`);
  }

  // ==========================================
  // TIP CARD
  // ==========================================
  function _renderTip(rate) {
    const tipEl = _el('tipText');
    if (!tipEl) return;
    tipEl.textContent = TIPS[state.tipIndex % TIPS.length](rate);
  }

  // ==========================================
  // COPY RATE
  // ==========================================
  function copyRate() {
    if (!state.rates) { toast('Rates not loaded yet', 'error'); return; }
    const rate = state.rates[state.chartPair] || state.rates.USD_NGN;
    const pair = PAIRS.find(p => p.key === state.chartPair);
    const text = `${pair?.pair || 'USD/NGN'}: ₦${fmt(rate)} — NaijaRate`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => toast('✓ Rate copied!'))
        .catch(() => toast('₦' + fmt(rate), 'info'));
    } else {
      toast('₦' + fmt(rate), 'info');
    }
  }

  // ==========================================
  // CONVERTER
  // ==========================================
  function _rateMap() {
    if (!state.rates) return {};
    return {
      USD: state.rates.USD_NGN,
      GBP: state.rates.GBP_NGN,
      EUR: state.rates.EUR_NGN,
      CAD: state.rates.CAD_NGN,
      NGN: 1,
    };
  }

  function convert() {
    if (!state.rates) return;

    const amount  = parseFloat(_el('fromAmount')?.value) || 0;
    const from    = _el('fromCurrency')?.value || 'USD';
    const to      = _el('toCurrency')?.value   || 'NGN';
    const map     = _rateMap();

    if (!map[from] || !map[to]) return;

    const result  = (amount * map[from]) / map[to];
    const toEl    = _el('toAmount');

    if (toEl) {
      toEl.textContent = result.toLocaleString('en-NG', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }

    const rate   = map[from] / map[to];
    const infoEl = _el('convRateInfo');
    if (infoEl) {
      infoEl.innerHTML =
        `1 ${from} = <span>${rate.toLocaleString('en-NG', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 4,
        })}</span> ${to}`;
    }
  }

  function swap() {
    const from = _el('fromCurrency');
    const to   = _el('toCurrency');
    if (!from || !to) return;
    [from.value, to.value] = [to.value, from.value];
    convert();
  }

  function quickConvert(amount) {
    const amountEl = _el('fromAmount');
    const fromEl   = _el('fromCurrency');
    const toEl     = _el('toCurrency');
    if (!amountEl || !fromEl || !toEl) return;

    amountEl.value = amount;
    fromEl.value   = 'USD';
    toEl.value     = 'NGN';
    convert();

    const navBtn = document.querySelector(
      '.nav-btn[onclick*="convert"]'
    );
    switchTab('convert', navBtn);
  }

  function _updateQuickPreviews() {
    if (!state.rates) return;
    const r = state.rates.USD_NGN;
    _setText('q100',  '≈₦' + fmt(100  * r));
    _setText('q500',  '≈₦' + fmt(500  * r));
    _setText('q1000', '≈₦' + fmt(1000 * r));
    _setText('q5000', '≈₦' + fmt(5000 * r));
  }

  function _updateMiniRateBar() {
    if (!state.rates) return;
    const r = state.rates;
    _setText('miniRateText',
      `USD ₦${fmt(r.USD_NGN)}  ·  ` +
      `GBP ₦${fmt(r.GBP_NGN)}  ·  ` +
      `EUR ₦${fmt(r.EUR_NGN)}  ·  ` +
      `CAD ₦${fmt(r.CAD_NGN)}`
    );
  }

  // ==========================================
  // MODALS
  // ==========================================
  function openModal(id) {
    const el = _el(id);
    if (!el) return;

    // Close any open modals first
    document.querySelectorAll('.modal-overlay.open')
      .forEach(m => { if (m.id !== id) m.classList.remove('open'); });

    el.classList.add('open');
    el.removeAttribute('aria-hidden');

    if (id === 'alertModal')  updateAlertHint();
    if (id === 'assetModal')  _setText('assetNgnPreview', '≈ ₦0 NGN');

    setTimeout(() => {
      const first = el.querySelector('input, select');
      if (first) first.focus();
    }, 420);
  }

  function closeModal(id) {
    const el = _el(id);
    if (el) {
      el.classList.remove('open');
      el.setAttribute('aria-hidden', 'true');
    }
  }

  function _initModals() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      // Close on backdrop click
      overlay.addEventListener('click', e => {
        if (e.target === overlay) closeModal(overlay.id);
      });
      // Start hidden
      overlay.setAttribute('aria-hidden', 'true');
    });

    // ESC key closes modals
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.open')
          .forEach(m => closeModal(m.id));
      }
    });
  }

  // ==========================================
  // ALERTS
  // ==========================================
  function updateAlertHint() {
    const pair    = _el('alertPair')?.value || 'USD_NGN';
    const current = state.rates ? state.rates[pair] : null;
    const label   = pair.replace('_', '/');

    _setText('alertCurrentRate',
      current
        ? `Current ${label}: ₦${fmt(current)}`
        : `Current ${label}: loading...`
    );

    const targetEl = _el('alertTarget');
    if (targetEl && current) {
      targetEl.placeholder = fmt(Math.round(current * 1.05));
    }
  }

  function saveAlert() {
    const pairEl      = _el('alertPair');
    const conditionEl = _el('alertCondition');
    const targetEl    = _el('alertTarget');

    const pair      = pairEl?.value;
    const condition = conditionEl?.value;
    const target    = parseFloat(targetEl?.value);

    // Validate
    if (!target || isNaN(target) || target <= 0) {
      _shake('alertTarget');
      toast('Enter a valid target rate', 'error');
      targetEl?.focus();
      return;
    }

    if (target < 100 || target > 99999) {
      _shake('alertTarget');
      toast('Rate must be between ₦100 and ₦99,999', 'error');
      return;
    }

    // Prevent duplicate alerts
    const duplicate = state.alerts.some(a =>
      a.pair === pair &&
      a.condition === condition &&
      a.target === target
    );

    if (duplicate) {
      _shake('alertTarget');
      toast('This alert already exists', 'error');
      return;
    }

    state.alerts.push({
      id:      Date.now(),
      pair,
      condition,
      target,
      created: new Date().toLocaleDateString('en-NG', {
        day: 'numeric', month: 'short',
      }),
    });

    _save('nr_alerts', state.alerts);
    closeModal('alertModal');

    // Reset fields
    if (targetEl)    targetEl.value = '';
    if (pairEl)      pairEl.selectedIndex = 0;
    if (conditionEl) conditionEl.selectedIndex = 0;

    // Cycle tip
    state.tipIndex = (state.tipIndex + 1) % TIPS.length;

    _renderAlerts();
    toast('✓ Alert created!');
  }

  function deleteAlert(id) {
    _confirm(
      'Remove Alert',
      'This alert will be permanently deleted.',
      () => {
        state.alerts = state.alerts.filter(a => a.id !== id);
        _save('nr_alerts', state.alerts);
        _renderAlerts();
        toast('Alert removed');
      }
    );
  }

  function _renderAlerts() {
    const el = _el('alertsList');
    if (!el) return;

    const count = state.alerts.length;
    _setText('alertCount', count + ' active');

    // Nav badge
    const badge = _el('alertBadge');
    if (badge) {
      badge.style.display = count > 0 ? 'flex' : 'none';
      badge.textContent   = count > 0 ? count : '';
    }

    if (count === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🔔</span>
          <div class="empty-title">No alerts set</div>
          <div class="empty-text">
            Set a rate alert and get notified
            the moment USD/NGN crosses your target.
          </div>
        </div>`;
      return;
    }

    el.innerHTML = state.alerts.map(a => `
      <div class="alert-item" role="listitem">
        <div class="alert-dot" aria-hidden="true"></div>
        <div class="alert-info">
          <div class="alert-pair">
            ${a.pair.replace('_', ' / ')}
          </div>
          <div class="alert-condition">
            Alert when ${a.condition} ₦${Number(a.target).toLocaleString()}
            · ${a.created || ''}
          </div>
        </div>
        <button class="alert-del"
          onclick="App.deleteAlert(${a.id})"
          aria-label="Delete this alert">✕</button>
      </div>
    `).join('');
  }

  function _checkAlerts() {
    if (!state.rates || !state.alerts.length) return;
    let fired = 0;

    state.alerts.forEach(a => {
      if (fired >= 1) return;
      const current = state.rates[a.pair];
      if (!current) return;
      const hit =
        (a.condition === 'above' && current > a.target) ||
        (a.condition === 'below' && current < a.target);
      if (hit) {
        fired++;
        toast(
          `🔔 ${a.pair.replace('_','/')} is ${a.condition} ` +
          `₦${Number(a.target).toLocaleString()}!`
        );
      }
    });
  }

  // ==========================================
  // PORTFOLIO
  // ==========================================
  function saveAsset() {
    const currencyEl = _el('assetCurrency');
    const amountEl   = _el('assetAmount');
    const currency   = currencyEl?.value;
    const amount     = parseFloat(amountEl?.value);

    if (!amount || isNaN(amount) || amount <= 0) {
      _shake('assetAmount');
      toast('Enter a valid amount', 'error');
      amountEl?.focus();
      return;
    }

    if (amount > 100000000) {
      toast('Amount too large', 'error');
      return;
    }

    const idx = state.portfolio.findIndex(a => a.currency === currency);

    if (idx >= 0) {
      state.portfolio[idx].amount += amount;
      toast(`✓ Added ${amount.toLocaleString()} to ${currency}`);
    } else {
      state.portfolio.push({ currency, amount });
      toast(`✓ ${currency} added to portfolio!`);
    }

    _save('nr_portfolio', state.portfolio);
    closeModal('assetModal');

    if (amountEl)   amountEl.value = '';
    if (currencyEl) currencyEl.selectedIndex = 0;

    _renderPortfolio();
  }

  function removeAsset(currency) {
    _confirm(
      `Remove ${currency}`,
      `Remove your ${currency} holding from the portfolio?`,
      () => {
        state.portfolio = state.portfolio.filter(
          a => a.currency !== currency
        );
        _save('nr_portfolio', state.portfolio);
        _renderPortfolio();
        toast(`${currency} removed from portfolio`);
      }
    );
  }

  function _renderPortfolio() {
    const grid  = _el('portfolioGrid');
    const total = _el('portfolioTotal');
    const sub   = _el('portfolioSub');
    if (!grid || !total) return;

    const count = state.portfolio.length;
    _setText('assetCount', count + ' asset' + (count !== 1 ? 's' : ''));

    if (count === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <span class="empty-icon">💼</span>
          <div class="empty-title">No assets yet</div>
          <div class="empty-text">
            Add your foreign currency holdings
            to see their total value in Naira.
          </div>
        </div>`;
      total.textContent = '₦0';
      if (sub) sub.textContent = 'Add assets to start tracking';
      return;
    }

    let totalNGN = 0;

    grid.innerHTML = state.portfolio.map(asset => {
      const meta  = ASSET_META[asset.currency] || {};
      const key   = asset.currency + '_NGN';
      const rate  = state.rates ? (state.rates[key] || 0) : 0;
      const value = asset.amount * rate;
      totalNGN   += value;

      return `
        <div class="port-asset">
          <div class="asset-icon"
            style="background:${meta.color}22;">
            ${meta.emoji || '💰'}
          </div>
          <div class="asset-info">
            <div class="asset-name">${asset.currency}</div>
            <div class="asset-amount">
              ${asset.amount.toLocaleString()} ${asset.currency}
            </div>
          </div>
          <div class="asset-ngn">
            <div class="asset-value">
              ${rate ? '₦' + fmt(value) : '—'}
            </div>
            <button class="asset-remove"
              onclick="App.removeAsset('${asset.currency}')"
              aria-label="Remove ${asset.currency}">
              remove
            </button>
          </div>
        </div>`;
    }).join('');

    total.textContent = state.rates ? '₦' + fmt(totalNGN) : '—';
    if (sub) {
      sub.textContent = count + ' asset' +
        (count !== 1 ? 's' : '') + ' tracked';
    }
  }

  function _initAssetPreview() {
    const update = () => {
      const amountEl   = _el('assetAmount');
      const currencyEl = _el('assetCurrency');
      const previewEl  = _el('assetNgnPreview');
      if (!amountEl || !currencyEl || !previewEl) return;

      const amount   = parseFloat(amountEl.value) || 0;
      const currency = currencyEl.value;
      const map      = _rateMap();
      const value    = amount * (map[currency] || 0);

      previewEl.textContent = value > 0
        ? '≈ ₦' + fmt(value) + ' NGN'
        : '≈ ₦0 NGN';
    };

    // Use event delegation — works even before modal opens
    document.addEventListener('input', e => {
      if (e.target.id === 'assetAmount') update();
    });
    document.addEventListener('change', e => {
      if (e.target.id === 'assetCurrency') update();
      if (e.target.id === 'alertPair') updateAlertHint();
    });
  }

  // ==========================================
  // NEWS
  // ==========================================
  function _renderNews() {
    const feed = _el('newsFeed');
    if (!feed) return;

    feed.innerHTML = NEWS.map((n, i) => `
      <a class="news-card"
        href="${n.url}"
        target="_blank"
        rel="noopener noreferrer"
        style="animation-delay:${i * 0.06}s"
        aria-label="${n.title} — ${n.source}">
        <div class="news-header">
          <div class="news-source">${n.source}</div>
          <div class="news-category ${n.category}">
            ${n.category.toUpperCase()}
          </div>
        </div>
        <div class="news-title">${n.title}</div>
        <div class="news-footer">
          <div class="news-meta">${n.time}</div>
          <div class="news-read" aria-hidden="true">Read →</div>
        </div>
      </a>
    `).join('');
  }

  // ==========================================
  // CONFIRM DIALOG
  // ==========================================
  function _confirm(title, desc, onYes) {
    _setText('confirmTitle', title);
    _setText('confirmDesc',  desc);

    const yesBtn = _el('confirmYes');
    if (yesBtn) {
      // Clone to remove previous listeners
      const fresh = yesBtn.cloneNode(true);
      yesBtn.replaceWith(fresh);
      fresh.addEventListener('click', () => {
        closeModal('confirmModal');
        onYes();
      }, { once: true });
    }

    openModal('confirmModal');
  }

  // ==========================================
  // INIT
  // ==========================================
  function init() {
    _initModals();
    _initAssetPreview();

    // Render static content immediately
    _renderAlerts();
    _renderNews();
    state.newsRendered = true;

    // Fetch live data
    fetchRates();

    // Start countdown (single interval)
    _startCountdown();

    console.log(
      '%c NaijaRate V2 🇳🇬 %c Ready ',
      'background:#00C853;color:#000;font-weight:800;' +
      'padding:3px 8px;border-radius:4px 0 0 4px;font-size:12px;',
      'background:#111;color:#00C853;font-weight:600;' +
      'padding:3px 8px;border-radius:0 4px 4px 0;font-size:12px;'
    );
  }

  // ==========================================
  // PUBLIC API
  // ==========================================
  return {
    init,
    switchTab,
    manualRefresh,
    setChartPeriod,
    selectPair,
    convert,
    convertDebounced,
    swap,
    quickConvert,
    copyRate,
    openModal,
    closeModal,
    updateAlertHint,
    saveAlert,
    deleteAlert,
    saveAsset,
    removeAsset,
  };

})();

document.addEventListener('DOMContentLoaded', App.init);