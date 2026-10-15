/*
 * Business Central release map
 *
 * Release dates come from the on-premises artifacts (one build per cumulative update,
 * original creation dates). Cloud versions .0 to .5 are released on the same days.
 * Future releases are projected from Microsoft's cadence: a major every April and
 * October, a minor every month, cumulative updates for on-premises for 18 months.
 */
(function () {
  'use strict';

  const MONTHS_BACK = 24;
  const MONTHS_AHEAD = 8;
  const SUPPORT_MONTHS = 18;
  const CLOUD_MINORS = 5;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  let root;
  let tooltip;

  // ----------------------------------------------------------------- dates

  function monthStart(year, month) {
    return new Date(Date.UTC(year, month, 1));
  }

  function addMonths(date, n) {
    return monthStart(date.getUTCFullYear(), date.getUTCMonth() + n);
  }

  function formatDay(date) {
    return `${date.getUTCDate()} ${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  }

  function formatMonth(date) {
    return `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  }

  // Microsoft's cadence: 24 = April 2024, 25 = October 2024, 26 = April 2025, …
  function majorReleaseMonth(major) {
    const k = major - 24;
    return monthStart(2024 + Math.floor(k / 2), k % 2 === 0 ? 3 : 9);
  }

  // ------------------------------------------------------------------ model

  function buildModel(data, today) {
    const start = addMonths(monthStart(today.getUTCFullYear(), today.getUTCMonth()), -MONTHS_BACK);
    const end = addMonths(monthStart(today.getUTCFullYear(), today.getUTCMonth()), MONTHS_AHEAD);

    const released = new Map();
    data.onprem.forEach(([mm, t, version]) => released.set(mm, { date: new Date(t * 1000), version }));
    const insider = new Map();
    data.insider.forEach(([mm, t, version]) => insider.set(mm, { date: new Date(t * 1000), version }));

    const knownMajors = [...released.keys(), ...insider.keys()].map((mm) => Number(mm.split('.')[0]));
    const lastMajor = Math.max(...knownMajors);

    // A version is released, in preparation (insider builds exist) or expected
    function status(major, minor, plannedMonth) {
      const mm = `${major}.${minor}`;
      if (released.has(mm)) return Object.assign({ mm, state: 'released' }, released.get(mm));
      if (insider.has(mm)) return { mm, state: 'preparation', date: plannedMonth, insiderSince: insider.get(mm).date, version: insider.get(mm).version };
      return { mm, state: 'expected', date: plannedMonth };
    }

    const cloud = [];
    const onprem = [];
    for (let major = 9; major <= lastMajor + 1; major++) {
      const first = released.get(`${major}.0`);
      const plannedStart = major >= 24 ? majorReleaseMonth(major) : null;
      const releaseDate = first ? first.date : plannedStart;
      if (!releaseDate) continue;

      // Cloud: minors .0 to .5
      for (let minor = 0; minor <= CLOUD_MINORS; minor++) {
        const item = status(major, minor, plannedStart ? addMonths(plannedStart, minor) : null);
        if (!item.date || item.date < start || item.date >= end) continue;
        cloud.push(Object.assign(item, { major, minor }));
      }

      // On-premises: one cumulative update per month for 18 months
      const updates = [];
      for (let minor = 0; minor <= SUPPORT_MONTHS; minor++) {
        const planned = plannedStart ? addMonths(plannedStart, minor) : null;
        const item = status(major, minor, planned);
        if (!item.date) continue;
        updates.push(Object.assign(item, { major, minor }));
      }
      if (!updates.length) continue;
      const last = updates[updates.length - 1];
      const supportEnd = addMonths(monthStart(last.date.getUTCFullYear(), last.date.getUTCMonth()), 1);
      if (supportEnd < start || releaseDate >= end) continue;
      onprem.push({ major, updates, releaseDate, supportEnd, ended: released.has(`${major}.${SUPPORT_MONTHS}`) && supportEnd <= today });
    }
    return { start, end, today, cloud, onprem };
  }

  // -------------------------------------------------------------------- svg

  function svg(tag, attrs, ...children) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v);
    });
    children.flat().forEach((c) => { if (c) node.append(c.nodeType ? c : document.createTextNode(c)); });
    return node;
  }

  function describe(item, lane) {
    const where = lane === 'cloud' ? 'Cloud' : 'On-premises';
    const lines = [];
    if (item.state === 'released') {
      lines.push([`${where} ${item.mm}`, `released ${formatDay(item.date)}`]);
      lines.push(['First build', item.version]);
    } else if (item.state === 'preparation') {
      lines.push([`${where} ${item.mm}`, `expected ${formatMonth(item.date)}`]);
      lines.push(['In preparation', `insider builds since ${formatDay(item.insiderSince)}`]);
    } else {
      lines.push([`${where} ${item.mm}`, `expected ${formatMonth(item.date)}`]);
    }
    return lines;
  }

  function showTooltip(target, lines) {
    tooltip.replaceChildren(...lines.map(([label, value]) => {
      const row = document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = value;
      const span = document.createElement('span');
      span.textContent = label;
      row.append(strong, span);
      return row;
    }));
    tooltip.hidden = false;
    const box = root.querySelector('.rm-frame').getBoundingClientRect();
    const mark = target.getBoundingClientRect();
    const left = Math.min(Math.max(mark.left - box.left + mark.width / 2 - tooltip.offsetWidth / 2, 4), box.width - tooltip.offsetWidth - 4);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${mark.top - box.top - tooltip.offsetHeight - 8}px`;
  }

  function interactive(node, lines) {
    node.setAttribute('tabindex', '0');
    node.setAttribute('role', 'img');
    node.setAttribute('aria-label', lines.map((l) => l.join(': ')).join(', '));
    const show = () => showTooltip(node, lines);
    const hide = () => { tooltip.hidden = true; };
    node.addEventListener('pointerenter', show);
    node.addEventListener('focus', show);
    node.addEventListener('pointerleave', hide);
    node.addEventListener('blur', hide);
    return node;
  }

  function renderChart(model, width) {
    const left = 10;
    const labelWidth = 92;
    const right = 24;
    const cloudTop = 34;
    const cloudHeight = 58;
    const rowHeight = 30;
    const onpremTop = cloudTop + cloudHeight + 26;
    const plotBottom = onpremTop + model.onprem.length * rowHeight;
    const height = plotBottom + 34;
    const span = model.end - model.start;
    const x = (date) => left + ((date - model.start) / span) * (width - left - right);
    // Hit areas reach at most halfway to the neighbouring month, so they never overlap
    const monthWidth = (width - left - right) / (MONTHS_BACK + MONTHS_AHEAD);
    const hitRadius = Math.max(6, Math.min(12, monthWidth / 2 - 1));

    // Lane and row labels live in their own SVG, so they stay put while the plot scrolls
    const labels = svg('svg', { class: 'rm-labels', width: labelWidth, height, viewBox: `0 0 ${labelWidth} ${height}`, 'aria-hidden': 'true' });
    const chart = svg('svg', { class: 'rm-chart', width, height, viewBox: `0 0 ${width} ${height}`, role: 'group', 'aria-label': 'Business Central release map', 'data-today-x': Math.round(x(model.today)) });

    // Month grid and axis: a hairline per month, labels per quarter
    for (let m = model.start; m < model.end; m = addMonths(m, 1)) {
      const mx = x(m);
      const january = m.getUTCMonth() === 0;
      chart.append(svg('line', { class: january ? 'rm-grid rm-grid-year' : 'rm-grid', x1: mx, x2: mx, y1: cloudTop - 8, y2: plotBottom }));
      if (m.getUTCMonth() % 3 === 0) {
        chart.append(svg('text', { class: january ? 'rm-axis rm-axis-year' : 'rm-axis', x: mx + 3, y: plotBottom + 18 }, january ? String(m.getUTCFullYear()) : MONTH_NAMES[m.getUTCMonth()]));
      }
    }

    // Lane labels
    labels.append(svg('text', { class: 'rm-lane', x: 0, y: cloudTop + cloudHeight / 2 + 4 }, 'Cloud'));
    labels.append(svg('text', { class: 'rm-lane', x: 0, y: onpremTop - 10 }, 'On-premises'));

    // Cloud: one dot per version, majors larger and labeled
    model.cloud.forEach((item) => {
      const cx = x(item.date);
      const cy = cloudTop + cloudHeight / 2;
      const r = item.minor === 0 ? 7 : 4;
      const group = svg('g', { class: `rm-mark rm-${item.state}` },
        svg('circle', { class: 'rm-hit', cx, cy, r: hitRadius }),
        svg('circle', { class: 'rm-dot', cx, cy, r }));
      if (item.minor === 0) group.append(svg('text', { class: 'rm-label', x: cx, y: cy - 14, 'text-anchor': 'middle' }, `${item.major}.0`));
      chart.append(interactive(group, describe(item, 'cloud')));
    });

    // On-premises: one bar per major, a segment per cumulative update
    model.onprem.forEach((lane, i) => {
      const y = onpremTop + i * rowHeight + 8;
      labels.append(svg('text', { class: 'rm-row', x: 0, y: y + 9 }, `BC ${lane.major}`));
      lane.updates.forEach((item, j) => {
        const next = lane.updates[j + 1] ? lane.updates[j + 1].date : lane.supportEnd;
        const x1 = Math.max(x(item.date), left);
        const x2 = Math.min(x(next), width - right);
        if (x2 <= left || x1 >= width - right) return;
        const segment = svg('g', { class: `rm-mark rm-${item.state}` },
          svg('rect', { class: 'rm-hit', x: x1, y: y - 6, width: Math.max(x2 - x1, 2), height: 22 }),
          svg('rect', { class: 'rm-bar', x: x1, y, width: Math.max(x2 - x1 - 2, 1), height: 10, rx: 2 }));
        chart.append(interactive(segment, describe(item, 'onprem')));
      });
      if (lane.supportEnd <= model.end && lane.supportEnd > model.start) {
        const ex = x(lane.supportEnd);
        const lastUpdate = lane.updates[lane.updates.length - 1];
        const label = lastUpdate.state === 'released' ? `last update ${formatMonth(lastUpdate.date)}` : `last update expected ${formatMonth(lastUpdate.date)}`;
        if (ex + 8 < width - 140) chart.append(svg('text', { class: 'rm-note', x: ex + 6, y: y + 9 }, label));
      }
    });

    // Today
    const tx = x(model.today);
    chart.append(svg('line', { class: 'rm-today', x1: tx, x2: tx, y1: cloudTop - 14, y2: plotBottom }));
    chart.append(svg('text', { class: 'rm-today-label', x: tx, y: cloudTop - 18, 'text-anchor': 'middle' }, 'today'));
    return { chart, labels };
  }

  // ------------------------------------------------------------------ table

  function renderTable(model) {
    const rows = new Map();
    const cell = (item) => {
      if (item.state === 'released') return `released ${formatDay(item.date)}`;
      if (item.state === 'preparation') return `expected ${formatMonth(item.date)} (in preparation)`;
      return `expected ${formatMonth(item.date)}`;
    };
    model.cloud.forEach((item) => rows.set(item.mm, { item, cloud: cell(item), onprem: '' }));
    model.onprem.forEach((lane) => lane.updates.forEach((item) => {
      if (item.date < model.start || item.date >= model.end) return;
      const row = rows.get(item.mm) || { item, cloud: '', onprem: '' };
      row.onprem = cell(item);
      rows.set(item.mm, row);
    }));
    const sorted = [...rows.values()].sort((a, b) => b.item.date - a.item.date || b.item.major - a.item.major || b.item.minor - a.item.minor);

    const table = document.createElement('table');
    const head = table.createTHead().insertRow();
    ['Version', 'Cloud', 'On-premises'].forEach((h) => { const th = document.createElement('th'); th.textContent = h; head.append(th); });
    const body = table.createTBody();
    sorted.forEach((r) => {
      const tr = body.insertRow();
      [r.item.mm, r.cloud || '–', r.onprem || '–'].forEach((v) => { tr.insertCell().textContent = v; });
    });
    const details = document.createElement('details');
    details.className = 'rm-table';
    const summary = document.createElement('summary');
    summary.textContent = 'Table view';
    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';
    wrapper.append(table);
    details.append(summary, wrapper);
    return details;
  }

  // ----------------------------------------------------------------- render

  function legend() {
    const item = (cls, text) => {
      const span = document.createElement('span');
      const key = document.createElement('i');
      key.className = cls;
      span.append(key, text);
      return span;
    };
    const div = document.createElement('div');
    div.className = 'rm-legend';
    div.append(
      item('rm-key rm-key-released', 'released'),
      item('rm-key rm-key-preparation', 'in preparation (insider builds)'),
      item('rm-key rm-key-expected', 'expected'),
      item('rm-key rm-key-bar', 'on-premises cumulative updates'));
    return div;
  }

  function render(data) {
    const today = new Date();
    const model = buildModel(data, today);
    const frame = document.createElement('div');
    frame.className = 'rm-frame';
    const scroll = document.createElement('div');
    scroll.className = 'rm-scroll';
    tooltip = document.createElement('div');
    tooltip.className = 'rm-tooltip';
    tooltip.hidden = true;
    root.replaceChildren(legend(), frame, renderTable(model));
    const draw = () => {
      // Plot width: whatever the frame leaves next to the label column, at least 560px
      const width = Math.max(frame.clientWidth - 92, 560);
      const { chart, labels } = renderChart(model, width);
      scroll.replaceChildren(chart);
      frame.replaceChildren(labels, scroll, tooltip);
      // On narrow screens the chart scrolls sideways: start with today in view
      if (scroll.scrollWidth > scroll.clientWidth) scroll.scrollLeft = Number(chart.dataset.todayX) - scroll.clientWidth * 0.6;
    };
    draw();
    let resizeTimer;
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(draw, 150); });

    const meta = document.createElement('p');
    meta.className = 'rm-meta';
    meta.textContent = `Artifact data as of ${new Date(data.generated).toISOString().slice(0, 16).replace('T', ' ')} UTC, refreshed daily.`;
    root.append(meta);
  }

  function init() {
    root = document.getElementById('release-map');
    if (!root) return;
    fetch(root.dataset.src, { cache: 'no-cache' })
      .then((r) => r.json())
      .then((data) => {
        if (!data.generated || !data.onprem) throw new Error('empty snapshot');
        render(data);
      })
      .catch(() => {
        root.textContent = 'The release data could not be loaded. Please try again later.';
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
