// Token Radar's dashboard, model radar-2. It reads window.RADAR (written
// beside dashboard/ by main.ts) and renders the ranked board, a filterable
// table, a per-protocol detail drawer carrying the model's own inputs and
// the protocol's farm plan, and a model sandbox that re-ranks the board
// live with the same formula. No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATASET = window.RADAR;
  if (!DATASET) return;
  var mount = document.getElementById('board');
  var ui = {
    q: '',
    category: 'all',
    chain: 'all',
    watchlistOnly: false,
    tab: 'pre-token',
    sort: 'implied',
    dir: -1,
    selected: null,
    sandbox: null,
  };

  // The farm plan is the same derivation main.ts writes to board.json:
  // category, chains, TVL and age decide the action, the capital, the hold
  // and every cost and time. No name is special-cased.
  function leadChain(p) {
    return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain';
  }
  function stakeSize(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function firstAction(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
    if (c.indexOf('bridge') >= 0) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
    if (c.indexOf('prediction') >= 0) return `Fund $${capital} and place one market position on ${name}.`;
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
    if (c.indexOf('stable') >= 0) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
    if (c.indexOf('rwa') >= 0) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
    if (c.indexOf('insurance') >= 0) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
    return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
  }
  function secondAction(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    var small = Math.max(10, Math.round(capital / 5));
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return `Borrow $${small} against the deposit on ${name} and repay it within the week, so the position shows both sides.`;
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return `Swap $${small} through ${name}'s main pool on ${chain} so the wallet shows a trade as well as liquidity.`;
    if (c.indexOf('bridge') >= 0) return `Bridge $${small} back the other way through ${name} so the wallet shows a round trip, not a single hop.`;
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return `Delegate a second, smaller stake of $${small} through ${name} and keep both receipts.`;
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return `Close the hedge on ${name} and open a second one half its size, so the account shows two trades.`;
    if (c.indexOf('prediction') >= 0) return `Settle the first position on ${name} and place a second one of $${small}.`;
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return `Move $${small} into a second ${name} vault on ${chain} so the wallet holds two vault shares.`;
    if (c.indexOf('stable') >= 0) return `Swap $${small} of the stable asset through ${name} on ${chain} and hold the rest.`;
    if (c.indexOf('rwa') >= 0) return `Reinvest $${small} of the yield the first mint paid into the same asset on ${chain}.`;
    if (c.indexOf('insurance') >= 0) return `Renew the cover on ${name} for a second, shorter term once the first one runs.`;
    return `Make a second deposit of $${small} into ${name} on ${chain} a week after the first, so the wallet shows repeated use.`;
  }
  function stepLine(step) {
    var s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
    if (s.length > 600) s = `${s.slice(0, 596)}...`;
    if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
    return s;
  }
  function planSteps(p) {
    var chain = leadChain(p);
    var capital = stakeSize(p);
    var hold = holdFor(p.age_days);
    var small = Math.max(10, Math.round(capital / 5));
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: firstAction(p, capital, chain), cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`, time: '15 minutes to set up' },
      { text: secondAction(p, capital, chain), cost: `about $2 of gas and $${small} moved`, time: '10 minutes' },
      { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`, cost: `the $${capital} stays in the position`, time: `${hold} days` },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log, then plan the exit: unwind in two steps over two days so one failed transaction does not strand the funds.', cost: 'about $4 of gas to unwind', time: '5 minutes to log, 2 days to exit' },
    ].map(stepLine);
  }

  var usdFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function money(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (Math.abs(n) >= 1e3) return `$${Math.round(n / 1e3)}K`;
    return usdFmt.format(n);
  }
  function pct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
  }
  function ageLabel(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return `${(days / 365).toFixed(1)}y`;
    return `${Math.max(0, Math.round(days))}d`;
  }

  // radar-2 in one function: the page recomputes a row from the snapshot
  // figures and checks the number board.json carries, so the page's code
  // and the board's data are visibly the same arithmetic. The sandbox may
  // change the three constants the sliders name; everything else stays the
  // model's.
  function scoreRow(row, model) {
    var m = model || DATASET.model;
    var rawGrowth = row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d;
    var growth = Math.min(m.growth_cap, Math.max(m.growth_floor, rawGrowth));
    var growthMult = 1 + (growth / 100) * m.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? m.unknown_age_days : row.age_days;
    var maturity = m.maturity_floor + (Math.min(Math.max(age, 0), m.maturity_days) / m.maturity_days) * m.maturity_range;
    var chainCount = row.chains && row.chains.length ? row.chains.length : 0;
    var chainMult = 1 + m.chain_step * Math.min(Math.max(chainCount - 1, 0), m.chain_cap);
    var missing = row.change_7d === null || row.change_7d === undefined ? m.missing_growth_discount : 1;
    return Math.max(1, Math.round(row.tvl_usd * m.base_multiple * growthMult * maturity * chainMult * missing));
  }
  function sandboxConstants() {
    if (!ui.sandbox) return null;
    var m = {};
    Object.keys(DATASET.model).forEach(function (k) { m[k] = DATASET.model[k]; });
    m.base_multiple = ui.sandbox.base_multiple;
    m.growth_weight = ui.sandbox.growth_weight;
    m.maturity_floor = ui.sandbox.maturity_floor;
    return m;
  }
  function visibleImplied(row) {
    var sm = sandboxConstants();
    return sm ? scoreRow(row, sm) : row.implied_value_usd;
  }

  function h(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function loadHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) ui.q = params.get('q');
    if (params.get('p')) ui.selected = params.get('p');
    if (params.get('category')) ui.category = params.get('category');
    if (params.get('chain')) ui.chain = params.get('chain');
    if (params.get('watchlist') === '1') ui.watchlistOnly = true;
  }
  function saveHash() {
    var params = new URLSearchParams();
    if (ui.q) params.set('q', ui.q);
    if (ui.category !== 'all') params.set('category', ui.category);
    if (ui.chain !== 'all') params.set('chain', ui.chain);
    if (ui.watchlistOnly) params.set('watchlist', '1');
    if (ui.selected) params.set('p', ui.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', `#${next}`);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function visibleRows() {
    var q = ui.q.trim().toLowerCase();
    return DATASET.rows.filter(function (r) {
      if (ui.category !== 'all' && r.category !== ui.category) return false;
      if (ui.chain !== 'all' && !(r.chains || []).includes(ui.chain)) return false;
      if (ui.watchlistOnly && !r.watchlist) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function orderedRows(list) {
    var key = ui.sort;
    var sm = sandboxConstants();
    return list.slice().sort(function (a, b) {
      var av;
      var bv;
      if (key === 'name') {
        av = a.name.toLowerCase();
        bv = b.name.toLowerCase();
      } else if (key === 'tvl') {
        av = a.tvl_usd;
        bv = b.tvl_usd;
      } else if (key === 'growth') {
        av = a.change_7d === null ? -Infinity : a.change_7d;
        bv = b.change_7d === null ? -Infinity : b.change_7d;
      } else if (key === 'age') {
        av = a.age_days === null ? Infinity : a.age_days;
        bv = b.age_days === null ? Infinity : b.age_days;
      } else {
        av = sm ? scoreRow(a, sm) : a.implied_value_usd;
        bv = sm ? scoreRow(b, sm) : b.implied_value_usd;
      }
      if (av < bv) return -ui.dir;
      if (av > bv) return ui.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }
  // When the sandbox is on, a row's place in the full board, re-sorted with
  // the sandbox constants, is its sandbox rank; the table shows it beside
  // the published rank so a reader can see what moved.
  function sandboxPlaces() {
    var map = {};
    orderedRows(DATASET.rows).forEach(function (r, i) { map[r.slug] = i + 1; });
    return map;
  }

  function topBar() {
    return h('header', { class: 'top' },
      h('div', { class: 'brand' }, h('span', { class: 'mark' }), h('span', { class: 'brand-name', text: 'Token Radar' })),
      h('div', { class: 'top-meta' },
        h('span', { text: `Snapshot ${DATASET.as_of}` }),
        h('span', { text: 'DefiLlama protocol index' }),
        h('span', { text: `${DATASET.model_version} model` })
      )
    );
  }

  function intro() {
    return h('section', { class: 'lede' },
      h('div', null,
        h('h1', { text: `${DATASET.watchlist_size} watchlist protocols, ranked by implied value` }),
        h('p', { text: `The watchlist is the floor: every protocol with at least $${Math.round(DATASET.floor_usd / 1e6)}M of TVL and no token on record. The early radar adds ${DATASET.early_size} pre-token protocols below that floor. Implied value is a model, not a promise: a token may never come, and the number is the model\u2019s claim on the protocol as it stands.` })
      ),
      h('div', { class: 'facts' },
        h('div', { class: 'fact' }, h('span', { text: 'Watchlist covered' }), h('b', { text: `${DATASET.watchlist_size} / ${DATASET.watchlist_size}` })),
        h('div', { class: 'fact' }, h('span', { text: 'Watchlist TVL' }), h('b', { text: money(DATASET.watchlist_tvl_usd) })),
        h('div', { class: 'fact' }, h('span', { text: 'Pre-token rows scored' }), h('b', { text: String(DATASET.board_size) })),
        h('div', { class: 'fact' }, h('span', { text: 'Early rows below the floor' }), h('b', { text: String(DATASET.early_size) })),
        h('div', { class: 'fact' }, h('span', { text: 'Live-token protocols set aside' }), h('b', { text: String(DATASET.live_size) }))
      )
    );
  }

  function filterBar() {
    var categories = Array.from(new Set(DATASET.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATASET.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = h('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: ui.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { ui.q = search.value; saveHash(); draw(); });
    var select = h('select', { id: 'category', 'aria-label': 'Filter by category' },
      h('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return h('option', { value: c, text: c, selected: c === ui.category ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { ui.category = select.value; saveHash(); draw(); });
    var chainSelect = h('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      h('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return h('option', { value: c, text: c, selected: c === ui.chain ? 'selected' : null }); })
    );
    chainSelect.addEventListener('change', function () { ui.chain = chainSelect.value; saveHash(); draw(); });
    var wl = h('label', { class: 'check' },
      h('input', { type: 'checkbox', checked: ui.watchlistOnly ? 'checked' : null }),
      ' Watchlist only'
    );
    wl.querySelector('input').addEventListener('change', function (e) { ui.watchlistOnly = e.target.checked; saveHash(); draw(); });
    var pre = h('button', { type: 'button', 'aria-pressed': ui.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { ui.tab = 'pre-token'; draw(); } });
    var live = h('button', { type: 'button', 'aria-pressed': ui.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { ui.tab = 'live'; draw(); } });
    return h('div', { class: 'controls' },
      h('div', { class: 'field' }, h('label', { for: 'q', text: 'Search' }), search),
      h('div', { class: 'field' }, h('label', { for: 'category', text: 'Category' }), select),
      h('div', { class: 'field' }, h('label', { for: 'chain', text: 'Chain' }), chainSelect),
      h('div', { class: 'field' }, h('span', { class: 'sub', text: 'Scope' }), wl),
      h('div', { class: 'field' }, h('span', { class: 'sub', text: 'Token status' }), h('div', { class: 'tabs' }, pre, live)),
      h('span', { class: 'count', text: ui.tab === 'pre-token' ? `${visibleRows().length} rows shown` : `${DATASET.live.length} live-token protocols` })
    );
  }

  function sortCell(key, label) {
    return h('th', { scope: 'col' },
      h('button', { type: 'button', onclick: function () { if (ui.sort === key) ui.dir = -ui.dir; else { ui.sort = key; ui.dir = -1; } draw(); } },
        label,
        ui.sort === key ? h('span', { 'aria-hidden': 'true', text: ui.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function preTokenTable() {
    var list = orderedRows(visibleRows());
    var sbPlaces = ui.sandbox ? sandboxPlaces() : null;
    if (list.length === 0) {
      return h('div', { class: 'panel' }, h('div', { class: 'empty' },
        h('h2', { text: 'No protocol matches that filter' }),
        h('p', { text: 'Clear the search or pick another category to see the board again.' }),
        h('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { ui.q = ''; ui.category = 'all'; ui.chain = 'all'; ui.watchlistOnly = false; saveHash(); draw(); } })
      ));
    }
    var max = Math.max.apply(null, list.map(function (r) { return visibleImplied(r); })) || 1;
    var tbody = h('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : pct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var shown = visibleImplied(r);
      var rankText = sbPlaces ? `${sbPlaces[r.slug]} (was ${r.rank})` : String(r.rank);
      var chainText = r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain';
      var tr = h('tr', {
        'data-selected': ui.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { showDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showDetail(r.slug); } },
      },
        h('td', { class: 'num', text: rankText }),
        h('td', null, h('div', { class: 'name' },
          h('b', { text: r.name }),
          h('span', { class: 'sub', text: `${r.category || 'Other'} on ${chainText}${r.watchlist ? '  ★ watchlist' : ''}` })
        )),
        h('td', { class: 'num', text: money(r.tvl_usd) }),
        h('td', { class: `num ${growthClass}`, text: growth }),
        h('td', { class: 'num', text: ageLabel(r.age_days) }),
        h('td', null, h('div', { class: 'implied' },
          h('div', { class: 'bar', 'aria-hidden': 'true' }, h('i', { style: `width:${Math.max(3, Math.round((shown / max) * 100))}%` })),
          h('span', { class: 'num', text: money(shown) })
        )),
        h('td', null, h('span', { class: 'status', text: 'no token' }))
      );
      tbody.appendChild(tr);
    });
    return h('div', { class: 'panel' },
      h('div', { class: 'table-wrap' },
        h('table', null,
          h('caption', { class: 'sub', text: ui.sandbox ? 'Sandbox ranks: the sliders below re-ranked the board in this page only; board.json keeps the published ranks.' : 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          h('thead', null, h('tr', null,
            sortCell('implied', 'Rank'),
            sortCell('name', 'Protocol'),
            sortCell('tvl', 'TVL'),
            sortCell('growth', '7d'),
            sortCell('age', 'Age'),
            sortCell('implied', 'Implied value'),
            h('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTokenTable() {
    var tbody = h('tbody');
    DATASET.live.forEach(function (r) {
      var chainText = r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain';
      var growthClass = r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg';
      tbody.appendChild(h('tr', null,
        h('td', { class: 'num', text: 'live' }),
        h('td', null, h('div', { class: 'name' }, h('b', { text: r.name }), h('span', { class: 'sub', text: `${r.category || 'Other'} on ${chainText}` }))),
        h('td', { class: 'num', text: money(r.tvl_usd) }),
        h('td', { class: `num ${growthClass}`, text: pct(r.change_7d) }),
        h('td', { class: 'num', text: money(r.mcap_usd) }),
        h('td', null, h('span', { class: 'status', text: 'already trades' }))
      ));
    });
    return h('div', { class: 'panel' },
      h('div', { class: 'table-wrap' },
        h('table', null,
          h('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          h('thead', null, h('tr', null, h('th', { scope: 'col', text: 'Status' }), h('th', { scope: 'col', text: 'Protocol' }), h('th', { scope: 'col', text: 'TVL' }), h('th', { scope: 'col', text: '7d' }), h('th', { scope: 'col', text: 'Market cap' }), h('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function formulaPanel() {
    var m = DATASET.model;
    return h('section', { class: 'panel model' },
      h('h2', { text: 'How implied value is computed' }),
      h('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      h('div', { class: 'formula' },
        `implied = round( tvl_usd x ${m.base_multiple} x (1 + clamp(change_7d, ${m.growth_floor}, ${m.growth_cap}) / 100 x ${m.growth_weight}) x (${m.maturity_floor} + min(age_days, ${m.maturity_days}) / ${m.maturity_days} x ${m.maturity_range}) x (1 + ${m.chain_step} x min(chains - 1, ${m.chain_cap})) x ${m.missing_growth_discount} if 7d unreported )`
      ),
      h('p', { class: 'sub', text: `TVL and seven-day growth come from the snapshot. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ${m.unknown_age_days} days. Chain breadth adds up to ${m.chain_step * m.chain_cap * 100}% for a protocol on several chains. A missing seven-day figure is taken as 0% growth and discounted 5% for the missing evidence. The early radar is every pre-token protocol below the watchlist floor, by TVL, and the live-token protocols are set aside with their market caps shown.` })
    );
  }

  function sandboxBox() {
    var m = DATASET.model;
    var sb = ui.sandbox || { base_multiple: m.base_multiple, growth_weight: m.growth_weight, maturity_floor: m.maturity_floor };
    function slider(key, label, min, max, step, value, fmt) {
      var input = h('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(value), 'aria-label': label });
      var out = h('output', { text: fmt(value) });
      input.addEventListener('input', function () {
        if (!ui.sandbox) ui.sandbox = { base_multiple: m.base_multiple, growth_weight: m.growth_weight, maturity_floor: m.maturity_floor };
        ui.sandbox[key] = parseFloat(input.value);
        out.textContent = fmt(parseFloat(input.value));
        draw();
      });
      return h('div', { class: 'field' }, h('label', { text: label }), input, out);
    }
    var reset = h('button', { class: 'button', type: 'button', text: 'Reset to radar-2', onclick: function () { ui.sandbox = null; draw(); } });
    return h('section', { class: 'panel sandbox' },
      h('h2', { text: 'Model sandbox: change the model, watch the board move' }),
      h('p', { class: 'sub', text: ui.sandbox ? 'Sandbox on: the board above is re-ranked with your constants, in this page only. board.json keeps the published radar-2 ranks.' : 'Move a slider to re-rank the board with your own constants. The published board keeps radar-2.' }),
      h('div', { class: 'sliders' },
        slider('base_multiple', 'Base multiple (TVL x)', 0.1, 0.4, 0.01, sb.base_multiple, function (v) { return v.toFixed(2); }),
        slider('growth_weight', 'Growth weight', 0, 1, 0.05, sb.growth_weight, function (v) { return v.toFixed(2); }),
        slider('maturity_floor', 'Maturity floor', 0.3, 0.8, 0.05, sb.maturity_floor, function (v) { return v.toFixed(2); })
      ),
      reset
    );
  }

  var dialog = h('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { ui.selected = null; saveHash(); });

  function showDetail(slug) {
    var row = DATASET.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    ui.selected = slug;
    saveHash();
    dialog.textContent = '';
    var steps = planSteps(row);
    var chainText = row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain';
    var recomputed = scoreRow(row, DATASET.model);
    var badge = row.watchlist ? '  ★ watchlist' : '  · early radar';
    dialog.appendChild(h('div', { class: 'detail-head' },
      h('div', null,
        h('span', { class: 'brand-name', text: `Rank ${row.rank} of ${DATASET.board_size}${badge}` }),
        h('h2', { id: 'detail-title', text: row.name }),
        h('p', { class: 'sub', text: `${row.category || 'Other'} on ${chainText}` })
      ),
      h('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(h('section', { class: 'detail-section' },
      h('h3', { text: 'Why this rank' }),
      h('p', { class: 'sub', text: row.signal || '' })
    ));
    dialog.appendChild(h('section', { class: 'detail-section' },
      h('h3', { text: 'Implied value' }),
      h('div', { class: 'equation' },
        h('div', null, h('span', { text: 'TVL' }), h('b', { class: 'num', text: money(row.tvl_usd) })),
        h('div', null, h('span', { text: 'Seven-day growth' }), h('b', { class: 'num', text: pct(row.change_7d) })),
        h('div', null, h('span', { text: 'Age with no token' }), h('b', { class: 'num', text: ageLabel(row.age_days) })),
        h('div', null, h('span', { text: 'Chains' }), h('b', { class: 'num', text: String((row.chains || []).length) })),
        h('div', null, h('span', { text: 'Growth multiplier' }), h('b', { class: 'num', text: String(row.growth_multiplier) })),
        h('div', null, h('span', { text: 'Maturity multiplier' }), h('b', { class: 'num', text: String(row.maturity_multiplier) })),
        h('div', null, h('span', { text: 'Chain multiplier' }), h('b', { class: 'num', text: String(row.chain_multiplier) })),
        h('div', null, h('span', { text: 'Missing-data discount' }), h('b', { class: 'num', text: row.missing_growth_discount === 1 ? 'none' : String(row.missing_growth_discount) })),
        h('div', null, h('span', { text: 'Implied value' }), h('b', { class: 'num', text: money(row.implied_value_usd) }))
      ),
      h('p', { class: 'sub', text: `Model ${DATASET.model_version}: the same function scores every protocol. The page recomputes this row as ${money(recomputed)}${recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.'} This is an estimate, not a price, and it says the protocol records no token, never that it has none.` })
    ));
    dialog.appendChild(h('section', { class: 'detail-section' },
      h('h3', { text: 'Farm plan' }),
      h('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return h('li', null, h('b', { text: action }), h('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function draw() {
    mount.textContent = '';
    var shell = h('div', { class: 'shell' });
    shell.appendChild(topBar());
    shell.appendChild(intro());
    shell.appendChild(filterBar());
    shell.appendChild(ui.tab === 'pre-token' ? preTokenTable() : liveTokenTable());
    if (ui.tab === 'pre-token') {
      shell.appendChild(sandboxBox());
      shell.appendChild(formulaPanel());
    }
    mount.appendChild(shell);
    mount.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) mount.appendChild(dialog);
    if (ui.selected) showDetail(ui.selected);
  }

  loadHash();
  draw();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
