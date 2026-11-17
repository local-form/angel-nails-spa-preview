(() => {
  'use strict';
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';

  // Angel Nails & Spa menu. Prices as printed on their brochure (customer photo, Google, May 2026).
  // null = not readable on the brochure: the page says "call". Minutes are a rough planning guide.
  const C = { feet: '#A3101A', hands: '#E52521', sets: '#EF6B5B', wax: '#E7B2A8', art: '#6E0F1E' };
  const GROUPS = [
    { key: 'feet', name: 'Feet', note: 'pick one', slot: 'feet', items: [
      ['ped', 'Spa pedicure', 45, 35],
      ['pedgel', 'Pedicure + gel', 55, null] ] },
    { key: 'hands', name: 'Hands', note: 'pick one', slot: 'hands', items: [
      ['mani', 'Spa manicure', 30, null],
      ['manigel', 'Gel manicure', 40, null] ] },
    { key: 'sets', name: 'Nail sets', note: 'instead of a manicure', slot: 'hands', items: [
      ['acr', 'Acrylic full set', 75, 55],
      ['acrgel', 'Acrylic full set + gel', 80, 60],
      ['acrtip', 'Full set + tip colour', 80, 65],
      ['fill', 'Acrylic fill-in + gel', 50, 50],
      ['gelfs', 'Gel full set', 75, 70],
      ['gelfill', 'Gel fill-in', 50, 55],
      ['dip', 'Dip, natural nail', 45, 55, true],
      ['dipfs', 'Dip full set, 1 colour', 60, 60, true],
      ['ombre', 'Ombre dip full set', 75, 70, true] ] },
    { key: 'wax', name: 'Waxing', note: '', slot: 'wax', items: [['wax', 'Waxing', 15, null]] },
    { key: 'art', name: 'Extras', note: '', slot: 'art', items: [['art', 'Nail art or French', 15, null]] }
  ];
  const S = {};
  GROUPS.forEach(g => g.items.forEach(([id, name, min, price, up]) => { S[id] = { id, name, min, price, up: !!up, slot: g.slot, c: C[g.key], group: g.key }; }));

  const state = { win: 90, sel: { feet: 'ped', hands: 'mani', wax: null, art: null } };
  // a plan can be shared as #plan=120:wax,ped,gelfs
  const m = /plan=(\d+):([a-z,]*)/.exec(location.hash);
  if (m && [45, 60, 90, 120].includes(+m[1])) {
    state.win = +m[1]; state.sel = { feet: null, hands: null, wax: null, art: null };
    m[2].split(',').forEach(id => { if (S[id]) state.sel[S[id].slot] = id; });
    const r = document.querySelector(`input[name="win"][value="${state.win}"]`); if (r) r.checked = true;
  }

  // ---------- chips ----------
  const chipsEl = $('#chips');
  if (!chipsEl) return;
  const priceTxt = s => s.price == null ? 'call' : '$' + s.price + (s.up ? '\u00a0&\u00a0up' : '');   // no-break spaces: "up" never drops to a line of its own
  chipsEl.innerHTML = GROUPS.map(g => `<div class="group" style="--c:${C[g.key]}"><p class="group-name">${g.name}${g.note ? ` <em>· ${g.note}</em>` : ''}</p><div class="chips">${
    g.items.map(([id]) => { const s = S[id]; return `<button type="button" class="chip" data-id="${id}" aria-pressed="false"><span class="dot"></span><span>${s.name}<small>${s.min} min · ${priceTxt(s)}</small></span></button>`; }).join('')
  }</div></div>`).join('');
  chipsEl.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    const s = S[b.dataset.id];
    state.sel[s.slot] = state.sel[s.slot] === s.id ? null : s.id;
    render();
  });
  document.querySelectorAll('input[name="win"]').forEach(r => r.addEventListener('change', () => { state.win = +r.value; render(); }));

  // ---------- plan ----------
  function plan() {
    const g = k => state.sel[k] ? S[state.sel[k]] : null;
    const wax = g('wax'), feet = g('feet'), hands = g('hands'), art = g('art');
    const seq = [];
    let t = 0;
    const push = (s, lane, why, start) => { const st = start ?? t; seq.push({ s, lane, why, start: st }); if (start == null) t += s.min; };
    const handsWhy = feet ? (hands && hands.group === 'sets' ? 'Your nail set goes on after the pedicure, so nothing gets knocked while you change shoes.' : 'Hands next, while your toes dry.') : (hands && hands.group === 'sets' ? 'Shaped, built and finished in one sitting.' : 'Soak, shape and polish.');
    const seqTotal = [wax, feet, hands, art].reduce((a, s) => a + (s ? s.min : 0), 0);
    const canPar = !!(feet && hands);
    const parTotal = canPar ? (wax ? wax.min : 0) + Math.max(feet.min, hands.min) + (art ? art.min : 0) : seqTotal;
    const usePar = canPar && seqTotal > state.win;
    if (wax) push(wax, 'a', 'Waxing first, so nothing touches fresh polish.');
    if (usePar) {
      const s0 = t;
      push(feet, 'a', 'Feet in the pedicure chair.');
      seq.push({ s: hands, lane: 'b', why: 'A second technician does your hands at the same time. Ask for this when you book.', start: s0 });
      t = s0 + Math.max(feet.min, hands.min);
    } else {
      if (feet) push(feet, 'a', hands ? 'Pedicure first, while your hands are free.' : 'Into the pedicure chair.');
      if (hands) push(hands, 'a', handsWhy);
    }
    if (art) push(art, 'a', 'Art and French tips go on last.');
    const total = usePar ? parTotal : seqTotal;
    let sum = 0, up = false, calls = 0;
    seq.forEach(({ s }) => { if (s.price == null) calls++; else { sum += s.price; up = up || s.up; } });
    return { seq, total, usePar, canPar, parTotal, seqTotal, sum, up, calls };
  }
  const priceLine = p => {
    if (!p.seq.length) return '$0';
    const parts = [];
    if (p.sum) parts.push('$' + p.sum + (p.up ? ' & up' : ''));
    if (p.calls) parts.push(p.sum ? '+ call' : 'call for price');
    return parts.join(' ');
  };
  const clock = m => Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');

  // ---------- ring ----------
  const ring = $('#ring'), segsA = $('#segs'), segsB = $('#segs-b'), ticks = $('#ticks'), mark = $('#win-mark');
  const dial = $('.dial-wrap');
  const LANES = { a: { r: 128, w: 30, el: segsA }, b: { r: 92, w: 20, el: segsB } };
  const nodes = new Map();
  const mk = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  function segNode(key, lane, color, hatch) {
    let n = nodes.get(key);
    if (n && n.lane === lane) return n;
    if (n) { n.g.remove(); nodes.delete(key); }
    const L = LANES[lane], g = mk('g', { transform: 'rotate(-90 160 160)' });
    const base = mk('circle', { class: 'seg', cx: 160, cy: 160, r: L.r, 'stroke-width': L.w, stroke: hatch ? 'url(#hatch)' : color });
    const lo = mk('circle', { class: 'seg seg-lo', cx: 160, cy: 160, r: L.r - L.w * .3, 'stroke-width': L.w * .22, stroke: '#3a0710' });
    const hi = mk('circle', { class: 'seg seg-hi', cx: 160, cy: 160, r: L.r + L.w * .22, 'stroke-width': L.w * .14 });
    g.append(base, lo, hi);
    [base, lo, hi].forEach(c => { c.style.strokeDasharray = '0 2000'; c.style.strokeDashoffset = '0'; });
    L.el.append(g);
    n = { g, base, lo, hi, lane };
    nodes.set(key, n);
    void g.getBoundingClientRect();
    return n;
  }
  function setArc(n, startU, lenU, lane) {
    const L = LANES[lane], circ = 2 * Math.PI * L.r, k = circ / 1000, cap = L.w / 2, gap = 4;
    // dash values are arc lengths: the shade (smaller circle) and the gloss (larger circle) are scaled to their own radius so they stay inside their segment
    const set = (c, st, l, q = 1) => { c.style.strokeDasharray = Math.max(0, l * q).toFixed(2) + ' 2000'; c.style.strokeDashoffset = (-st * q).toFixed(2); };
    const qLo = (L.r - L.w * .3) / L.r, qHi = (L.r + L.w * .22) / L.r;
    const s0 = startU * k, l0 = lenU * k, s = s0 + cap + gap / 2, l = l0 - 2 * cap - gap;
    if (l <= 0) { const m = s0 + l0 / 2; set(n.base, m, 0.01); set(n.lo, m, 0); set(n.hi, m, 0); return; }
    set(n.base, s, l);
    set(n.lo, s + l * .06, l * .88, qLo);
    set(n.hi, s + l * .05, l * .5, qHi);
  }
  function drawTicks(T) {
    ticks.innerHTML = '';
    for (let m = 0; m <= T; m += 15) {
      if (m === T && m !== 0) break;
      const a = (m / T) * 2 * Math.PI - Math.PI / 2, major = m % 60 === 0;
      const r1 = 149, r2 = major ? 158 : 154;
      ticks.append(mk('line', { class: 'tick' + (major ? ' major' : ''), x1: (160 + r1 * Math.cos(a)).toFixed(1), y1: (160 + r1 * Math.sin(a)).toFixed(1), x2: (160 + r2 * Math.cos(a)).toFixed(1), y2: (160 + r2 * Math.sin(a)).toFixed(1) }));
    }
  }

  // ---------- render ----------
  const legendEl = $('#legend'), usedEl = $('#d-used'), ofEl = $('#d-of'), priceEl = $('#d-price'), statusEl = $('#status'), stepsEl = $('#steps'), totalEl = $('#plan-total');
  let first = true;
  function render() {
    const p = plan(), W = state.win, T = Math.max(W, p.total);
    document.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', String(state.sel[S[b.dataset.id].slot] === b.dataset.id)));
    dial.classList.toggle('has-b', p.usePar);
    dial.classList.toggle('over', p.total > W);
    drawTicks(T);

    const live = new Set();
    const apply = () => {
      p.seq.forEach(({ s, lane, start }) => {
        const n = segNode(s.id, lane, s.c);
        setArc(n, start / T * 1000, s.min / T * 1000, lane);
        live.add(s.id);
      });
      if (p.total > W) {
        const endOf = l => Math.max(0, ...p.seq.filter(x => x.lane === l).map(x => x.start + x.s.min));
        const ol = endOf('b') > endOf('a') ? 'b' : 'a';
        const n = segNode('__over', ol, null, true);
        n.g.parentNode.append(n.g);
        setArc(n, W / T * 1000, (p.total - W) / T * 1000, ol);
        live.add('__over');
      }
      nodes.forEach((n, k) => {
        if (live.has(k)) return;
        [n.base, n.lo, n.hi].forEach(c => { c.style.strokeDasharray = '0 2000'; });
        nodes.delete(k);
        setTimeout(() => n.g.remove(), RM ? 0 : 750);
      });
      const a = W / T * 2 * Math.PI - Math.PI / 2;
      mark.setAttribute('d', `M${(160 + 108 * Math.cos(a)).toFixed(1)} ${(160 + 108 * Math.sin(a)).toFixed(1)}L${(160 + 150 * Math.cos(a)).toFixed(1)} ${(160 + 150 * Math.sin(a)).toFixed(1)}`);
    };
    if (first && !RM) { first = false; requestAnimationFrame(() => requestAnimationFrame(apply)); } else { first = false; apply(); }

    usedEl.textContent = p.total;
    ofEl.textContent = 'of your ' + (W === 60 ? 'hour' : W === 120 ? '2 hours' : W + ' min');
    priceEl.textContent = priceLine(p);

    statusEl.className = 'status';
    if (!p.seq.length) statusEl.textContent = 'Tap a service to start your visit.';
    else if (p.total > W) {
      statusEl.classList.add('bad');
      const nextWin = [45, 60, 90, 120].find(w => w >= p.total);
      statusEl.textContent = `Over by ${p.total - W}\u00a0min. ` + (nextWin ? `Try ${nextWin === 60 ? '1\u00a0hr' : nextWin === 120 ? '2\u00a0hr' : nextWin + '\u00a0min'}, or drop something.` : 'Drop something, or call and plan a longer visit.');
    } else if (p.usePar) {
      statusEl.classList.add('two');
      statusEl.innerHTML = '<span class="badge">Two at once</span><span>Fits if two technicians work together. Ask when you book.</span>';
    } else statusEl.textContent = W - p.total ? `${W - p.total} min to spare.` : 'Fits exactly.';

    stepsEl.innerHTML = p.seq.length ? p.seq.map(({ s, lane, why, start }) =>
      `<li class="${lane === 'b' ? 'lane-b' : ''}" style="--c:${s.c}"><span class="t">${clock(start)}</span><span class="n">${s.name}</span><span class="p">${priceTxt(s)}</span><span class="why">${why} About ${s.min} min.</span></li>`).join('')
      : '<li><span class="empty">Nothing yet. Tap a service above.</span></li>';
    totalEl.innerHTML = p.seq.length ? `<span>${p.total} min · done by ${clock(p.total)}</span><span>${priceLine(p)}</span>` : '';
    window.__angelPlan = p;
    legendEl.innerHTML = p.seq.map(({ s, lane }) => `<li class="${lane === 'b' ? 'b' : ''}" style="--c:${s.c}">${s.name}</li>`).join('');
    // mirror into the sticky hour bar
    const segs = p.seq.map(({ s, lane, start }) => `<b class="${lane === 'b' ? 'lane-b' : ''}" style="--c:${s.c};left:${(start / T * 100).toFixed(2)}%;width:${(s.min / T * 100).toFixed(2)}%"></b>`).join('')
      + (p.total > W ? `<b class="ov" style="left:${(W / T * 100).toFixed(2)}%;width:${((p.total - W) / T * 100).toFixed(2)}%"></b>` : '');
    mbTrack.innerHTML = segs + `<i class="mb-win" style="left:${(W / T * 100).toFixed(2)}%"></i>`;
    mbT.textContent = `${p.total} of ${W} min`;
    mbP.textContent = priceLine(p);
    mini.classList.toggle('over', p.total > W);
  }
  const mini = $('#minibar'), mbTrack = $('#mb-track'), mbT = $('#mb-t'), mbP = $('#mb-p');
  if ('IntersectionObserver' in window && mini) {
    let dialIn = true, heroIn = true;
    const upd = () => mini.classList.toggle('on', !dialIn && heroIn);
    new IntersectionObserver(es => { dialIn = es[0].isIntersecting; upd(); }, { rootMargin: '-150px 0px 0px 0px' }).observe($('.dial'));
    new IntersectionObserver(es => { heroIn = es[0].isIntersecting; upd(); }, { rootMargin: '-120px 0px -30% 0px' }).observe($('#build'));
  }
  render();

  // hand the plan to the request form (when the form is on the page)
  document.querySelectorAll('[data-use-plan]').forEach(a => a.addEventListener('click', () => {
    const p = window.__angelPlan, f = $('#book-form');
    if (!f || !p) return;
    const list = f.querySelector('[name="services"]');
    if (list) list.value = p.seq.map(x => x.s.name).join(', ');
    const notes = f.querySelector('[name="notes"]');
    if (notes && p.usePar && !/two technicians/.test(notes.value)) notes.value = (notes.value ? notes.value + '\n' : '') + 'Two technicians at once if possible.';
    const lenSel = f.querySelector('[name="window"]');
    if (lenSel) lenSel.value = String(state.win);
  }));

  // ---------- request form (front end only) ----------
  const form = $('#book-form');
  if (form) {
    const day = form.querySelector('[name="day"]');
    const d = new Date(), iso = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    day.min = iso(d);
    const max = new Date(d); max.setDate(max.getDate() + 90); day.max = iso(max);
    form.addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(form), name = String(f.get('name') || '').trim(), phone = String(f.get('phone') || '').trim(), err = $('#form-err');
      form.querySelectorAll('[aria-invalid]').forEach(i => i.removeAttribute('aria-invalid'));
      const badDay = !!day.value && !day.checkValidity();   // typed by hand outside today..+90 days
      if (!name || phone.replace(/\D/g, '').length < 10 || badDay) {
        err.textContent = !name ? 'Add your name so the salon knows who to expect.' : !badDay ? 'Add a phone number with area code so the salon can confirm.' : 'Pick a day from today to three months out.';
        const bad = !name ? form.querySelector('[name="name"]') : !badDay ? form.querySelector('[name="phone"]') : day;
        bad.setAttribute('aria-invalid', 'true'); bad.focus();
        return;
      }
      err.textContent = '';
      const esc = s => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
      const svc = String(f.get('services') || '').trim() || 'A visit';
      let when = '';
      if (f.get('day')) { const [y, m, dd] = String(f.get('day')).split('-').map(Number); when = new Date(y, m - 1, dd).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }); }
      const tod = String(f.get('tod') || '');
      const w = String(f.get('window') || '');
      const win = w ? ` (${w === '60' ? '1 hr' : w === '120' ? '2 hr' : w + ' min'})` : '';
      const c = $('#confirm');
      c.innerHTML = `<h3>Request ready</h3><p>${esc(svc)}${win}${when || tod ? ', ' + esc([when, tod].filter(Boolean).join(' ')) : ''}, for ${esc(name)}.</p><p class="pv">Preview only: nothing was sent. On the real site, Angel Nails confirms by text or call.</p>`;
      c.hidden = false; c.focus();
    });
  }

  // ---------- reveal on scroll ----------
  const els = [...document.querySelectorAll('[data-reveal]')];
  if (RM || !('IntersectionObserver' in window)) els.forEach(e => e.classList.add('is-visible'));
  else {
    const n = new Map();
    els.forEach(e => { const p = e.parentElement, i = n.get(p) || 0; e.style.setProperty('--d', Math.min(i, 5) * .08 + 's'); n.set(p, i + 1); });
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); } }), { threshold: .01, rootMargin: '0px 0px -8% 0px' });
    els.forEach(e => io.observe(e));
    setTimeout(() => els.forEach(e => { if (e.getBoundingClientRect().top < innerHeight) e.classList.add('is-visible'); }), 1500);
  }
})();
