/*
 * AL-Go artifact builder
 *
 * Mirrors how AL-Go for GitHub (DetermineArtifactUrl in Actions/AL-Go-Helper.ps1)
 * and BcContainerHelper (Get-BCArtifactUrl, QueryArtifactsFromIndex) resolve the
 * `artifact` setting, using the index snapshot from /assets/data/bc-artifacts.json.
 */
(function () {
  'use strict';

  const HOSTS = {
    bcartifacts: 'bcartifacts-exdbf9fwegejdqak.b02.azurefd.net',
    bcinsider: 'bcinsider-fvh2ekdjecfjd6gk.b02.azurefd.net',
    bcpublicpreview: 'bcpublicpreview-f2ajahg0e2cudpgh.b02.azurefd.net'
  };

  // BcContainerHelper: bcContainerHelperConfig.mapCountryCode (sandbox only)
  const COUNTRY_MAP = {
    ae: 'w1', ar: 'w1', bd: 'w1', dz: 'w1', cl: 'w1', pr: 'w1', eg: 'w1', fo: 'dk', gl: 'dk', id: 'w1',
    ke: 'w1', lb: 'w1', lk: 'w1', lu: 'w1', ma: 'w1', mm: 'w1', mt: 'w1', my: 'w1', ng: 'w1', qa: 'w1',
    sa: 'w1', sg: 'w1', tn: 'w1', ua: 'w1', za: 'w1', ao: 'w1', bh: 'w1', ba: 'w1', bw: 'w1', cr: 'br',
    cy: 'w1', do: 'br', ec: 'br', sv: 'br', gt: 'br', hn: 'br', jm: 'w1', mv: 'w1', mu: 'w1', ni: 'br',
    pa: 'br', py: 'br', tt: 'br', uy: 'br', zw: 'w1', im: 'gb', gg: 'gb'
  };

  const COMMON_COUNTRIES = ['w1', 'de', 'us', 'dk'];
  const SETTINGS_FILE = '.AL-Go/settings.json';

  const ACCOUNTS = [
    { value: '', label: 'bcartifacts', hint: 'default', info: 'Released versions.' },
    { value: 'bcinsider', label: 'bcinsider', info: 'Preview builds of upcoming versions. AL-Go accepts the insider EULA for you.' },
    { value: 'bcpublicpreview', label: 'bcpublicpreview', info: 'Public previews. The storage account is currently empty.' }
  ];

  const TYPES = [
    { value: '', label: 'Sandbox', hint: 'default', info: 'Business Central online.' },
    { value: 'OnPrem', label: 'OnPrem', info: 'On-premises. Exactly one build per cumulative update.' }
  ];

  const SELECTS = [
    { value: 'latest', info: 'Newest build that matches.' },
    { value: 'first', info: 'Oldest build that matches.' },
    { value: 'all', info: 'All matches. AL-Go uses the first one, so this behaves like first.' },
    { value: 'closest', info: 'First build ≥ the given version within its major.minor, otherwise the newest of that major.minor. Needs a full version (x.x.x.x).' },
    { value: 'secondtolastmajor', info: 'Newest build of the previous major.' },
    { value: 'current', info: 'The currently released sandbox version. Same as latest.' },
    { value: 'nextminor', info: 'Newest insider build of the next minor. From minor .5 on, the next major.' },
    { value: 'nextmajor', info: 'Newest insider build of the next major. Empty until Microsoft publishes one.' },
    { value: 'daily', info: 'Newest build of the current major.minor created before today (UTC). Changes at most once a day.' },
    { value: 'weekly', info: 'Newest build of the current major.minor created before last Sunday (UTC). Changes at most once a week.' }
  ];

  class BcError extends Error {}

  let DATA = null;

  // ---------------------------------------------------------------- versions

  function vkey(v) {
    return v.split('.').map(Number);
  }

  function vcmp(a, b) {
    const x = vkey(a);
    const y = vkey(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      const d = (x[i] || 0) - (y[i] || 0);
      if (d) return d;
    }
    return 0;
  }

  function majorMinor(v) {
    return v.split('.').slice(0, 2).join('.');
  }

  function isFullVersion(v) {
    return /^\d+\.\d+\.\d+\.\d+$/.test(v);
  }

  // ---------------------------------------------------- BcContainerHelper port

  function mapCountry(type, country) {
    return type === 'sandbox' && COUNTRY_MAP[country] ? COUNTRY_MAP[country] : country;
  }

  // QueryArtifactsFromIndex: versions available for one storage account, type and country
  function query(acc, type, prefix, country, after, before) {
    if (acc === 'bcpublicpreview') throw new BcError('The bcpublicpreview storage account has no artifacts (index not found).');
    if (!HOSTS[acc]) throw new BcError(`Custom storage account "${acc}": can't be resolved here.`);
    const src = DATA.sources[`${acc}/${type}`];
    if (!src) throw new BcError(`No access to ${acc} ${type === 'onprem' ? 'OnPrem' : 'Sandbox'} artifacts.`);

    const mapped = mapCountry(type, country);
    const entry = src.countries[mapped];
    if (!entry) throw new BcError(`There is no ${type === 'onprem' ? 'OnPrem' : 'Sandbox'} artifact index for country "${mapped}".`);

    const missing = new Set(entry.missing);
    const versions = [];
    src.versions.forEach((v, i) => {
      if (missing.has(i) || !v.startsWith(prefix)) return;
      if (after || before) {
        const t = entry.times[i];
        if (t === undefined) return;
        if (after && !(t * 1000 > after)) return;
        if (before && !(t * 1000 < before)) return;
      }
      versions.push(v);
    });
    return versions.map((v) => ({ version: v, acc, type, country: mapped }));
  }

  function utcMidnight(date) {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  }

  // Get-BCArtifactUrl
  function getArtifacts(o, notes) {
    let type = (o.type || 'sandbox').toLowerCase();
    let country = o.country || '';
    let version = o.version || '';
    let select = (o.select || 'latest').toLowerCase();
    let acc = o.acc || '';
    const { after, before } = o;

    if (type === 'onprem') {
      const replaced = [['18.9', '18.10.35134.0'], ['17.14', '17.15.35135.0'], ['16.18', '16.19.35126.0']]
        .find(([prefix]) => version.startsWith(prefix));
      if (replaced) {
        notes.push(`The on-premises build for ${replaced[0]} was replaced by ${replaced[1]}, so this version is used instead.`);
        version = replaced[1];
      }
      if (select === 'weekly' || select === 'daily') {
        notes.push(`<code>${select}</code> is treated as <code>latest</code> for OnPrem.`);
        select = 'latest';
      }
    }

    if (select === 'weekly' || select === 'daily') {
      if (version || after || before) throw new BcError('You cannot specify version, before or after when selecting Daily or Weekly build');
      const today = utcMidnight(new Date());
      const cutoff = select === 'daily' ? today : today - new Date(today).getUTCDay() * 86400000;
      const current = getArtifacts({ country, select: 'latest' }, notes)[0];
      if (!current) return [];
      const mm = majorMinor(current.version);
      const periodic = getArtifacts({ country, version: mm, select: 'latest', before: cutoff }, notes)[0] ||
        getArtifacts({ country, version: mm, select: 'first', after: cutoff }, notes)[0];
      return [periodic || current];
    }

    if (select === 'current') {
      if (acc || type === 'onprem' || version) throw new BcError('You cannot specify storageAccount, type=OnPrem or version when selecting Current release');
      return getArtifacts({ country, select: 'latest' }, notes);
    }

    if (select === 'nextminor' || select === 'nextmajor') {
      const name = select === 'nextminor' ? 'NextMinor' : 'NextMajor';
      if (acc || type === 'onprem' || version) throw new BcError(`You cannot specify storageAccount, type=OnPrem or version when selecting ${name} release`);
      const current = getArtifacts({ country: 'base', select: 'latest' }, notes)[0];
      const [major, minor] = vkey(current.version);
      const nextMajor = `${major + 1}.0.`;
      const nextMinor = minor >= 5 ? nextMajor : `${major}.${minor + 1}.`;
      if (select === 'nextminor' && minor >= 5) notes.push(`The current release is ${major}.${minor}, so <code>nextminor</code> returns the next major.`);
      const insiders = query('bcinsider', 'sandbox', '', country || 'w1');
      const prefix = select === 'nextminor' ? nextMinor : nextMajor;
      const match = insiders.filter((a) => a.version.startsWith(prefix));
      return match.length ? [match[match.length - 1]] : [];
    }

    acc = acc || 'bcartifacts';
    let prefix = '';
    if (select === 'secondtolastmajor') {
      if (version) throw new BcError('You cannot specify a version when asking for the Second To Last Major version');
    } else if (select === 'closest') {
      if (!version) throw new BcError('You must specify a version number when you want to get the closest artifact Url');
      if (!isFullVersion(version)) throw new BcError('Version number must be in the format 1.2.3.4 when you want to get the closest artifact Url');
      prefix = `${majorMinor(version)}.`;
    } else if (version) {
      prefix = (version.match(/\./g) || []).length < 3 ? `${version.replace(/\.+$/, '')}.` : version;
    }

    const artifacts = query(acc, type, prefix, country, after, before);
    if (!artifacts.length) return [];

    switch (select) {
      case 'all':
        return artifacts;
      case 'first':
        return [artifacts[0]];
      case 'secondtolastmajor': {
        const latestMajor = vkey(artifacts[artifacts.length - 1].version)[0];
        const previous = artifacts.filter((a) => vkey(a.version)[0] !== latestMajor);
        return previous.length ? [previous[previous.length - 1]] : [];
      }
      case 'closest':
        return [artifacts.find((a) => vcmp(a.version, version) >= 0) || artifacts[artifacts.length - 1]];
      default:
        return [artifacts[artifacts.length - 1]];
    }
  }

  // ------------------------------------------------------------ AL-Go port

  // DetermineArtifactUrl
  function determine(state) {
    const notes = [];
    const warnings = [];
    const settings = state.settings;
    const artifact = state.mode === 'empty' ? '' : artifactValue(state);
    let result;

    if (artifact === '' && settings.updateDependencies) {
      const atLeast = (list) => list.find((a) => vcmp(a.version, settings.applicationDependency) >= 0);
      result = atLeast(getArtifacts({ country: settings.country, select: 'all' }, notes));
      if (!result) {
        result = atLeast(getArtifacts({ acc: 'bcinsider', country: settings.country, select: 'all' }, notes));
        if (result) notes.push('No released artifact satisfies the application dependency, so an insider build is used.');
      }
      if (!result) throw new BcError(`No artifacts found for application dependency ${settings.applicationDependency}.`);
      notes.push(`Empty <code>artifact</code> with <code>updateDependencies</code>: oldest build ≥ applicationDependency ${settings.applicationDependency}.`);
      return { artifact, result, notes, warnings };
    }

    const seg = `${artifact}/////`.split('/');
    const acc = seg[0];
    const type = seg[1] || 'Sandbox';
    const version = seg[2];
    const country = seg[3] || settings.country;
    const select = seg[4] || 'latest';

    if (artifact === '') notes.push(`<code>artifact</code> is empty: newest sandbox for the <code>country</code> setting (${settings.country}).`);
    if (!seg[3] && artifact !== '') notes.push(`No country given, so the <code>country</code> setting (${settings.country}) is used.`);

    if (version === '*') {
      const mm = majorMinor(settings.applicationDependency);
      const all = getArtifacts({ acc, type, version: mm, country, select: 'all' }, notes)
        .filter((a) => vcmp(a.version, settings.applicationDependency) >= 0);
      if (select === 'latest') result = all[all.length - 1];
      else if (select === 'first') result = all[0];
      else throw new BcError(`Invalid artifact setting (${artifact}) in ${SETTINGS_FILE}. Version can only be '*' if select is first or latest.`);
      notes.push(`<code>*</code> searches ${mm}.x (major.minor of applicationDependency ${settings.applicationDependency}), only builds ≥ ${settings.applicationDependency}.`);
      if (!result) throw new BcError(`No artifacts found for the artifact setting (${artifact}) in ${SETTINGS_FILE}, when application dependency is ${settings.applicationDependency}`);
    } else {
      result = getArtifacts({ acc, type, version, country, select }, notes)[0];
      if (!result) throw new BcError(`No artifacts found for the artifact setting (${artifact}) in ${SETTINGS_FILE}`);
    }

    let replaced = null;
    if (settings.additionalCountries || country !== settings.country) {
      if (country !== settings.country) {
        warnings.push(`artifact definition in ${SETTINGS_FILE} uses a different country (${country}) than the country definition (${settings.country})`);
      }
      const mm = majorMinor(result.version);
      const at = getArtifacts({ acc: result.acc, type, country: 'at', version: mm, select: 'latest' }, notes)[0];
      if (at && at.version !== result.version) {
        notes.push(`Because of ${country !== settings.country ? 'the different country' : 'additionalCountries'}, AL-Go switches to the newest AT build of ${mm} (${at.version}), so the version exists for all countries.`);
        replaced = { from: result.version, to: at.version, reason: country !== settings.country ? 'different country' : 'additionalCountries' };
        result = Object.assign({}, result, { version: at.version });
      }
    }

    if (vcmp(result.version, settings.applicationDependency) < 0) {
      warnings.push(`The build will fail: ${result.version} is lower than applicationDependency ${settings.applicationDependency}.`);
    }
    return { artifact, result, notes, warnings, replaced };
  }

  // ----------------------------------------------------------------- state

  const state = {
    mode: 'search',
    acc: '',
    type: '',
    version: '',
    country: '',
    select: 'latest',
    settings: { country: 'us', applicationDependency: '18.0.0.0', updateDependencies: false, additionalCountries: false }
  };

  function artifactValue(s) {
    return [s.acc, s.type, s.version, s.country, s.select].join('/');
  }

  function typeKey(s) {
    return (s.type || 'Sandbox').toLowerCase();
  }

  function effectiveAcc(s) {
    if (s.select === 'nextminor' || s.select === 'nextmajor') return 'bcinsider';
    return s.acc || 'bcartifacts';
  }

  function tryDetermine(s) {
    try {
      return determine(s);
    } catch (e) {
      if (e instanceof BcError) return { artifact: s.mode === 'empty' ? '' : artifactValue(s), error: e.message };
      throw e;
    }
  }

  function readUrl() {
    const p = new URLSearchParams(window.location.search);
    if (p.get('mode') === 'empty') state.mode = 'empty';
    const artifact = p.get('artifact');
    if (artifact && !artifact.startsWith('https://')) {
      const seg = `${artifact}/////`.split('/');
      state.acc = seg[0];
      state.type = seg[1];
      state.version = seg[2];
      state.country = seg[3].toLowerCase();
      state.select = (seg[4] || 'latest').toLowerCase();
    }
    if (p.get('country')) state.settings.country = p.get('country').toLowerCase();
    if (p.get('appdep')) state.settings.applicationDependency = p.get('appdep');
    state.settings.updateDependencies = p.get('upd') === '1';
    state.settings.additionalCountries = p.get('addc') === '1';
  }

  function writeUrl() {
    const p = new URLSearchParams();
    if (state.mode === 'empty') p.set('mode', 'empty');
    else p.set('artifact', artifactValue(state));
    if (state.settings.country !== 'us') p.set('country', state.settings.country);
    if (state.settings.applicationDependency !== '18.0.0.0') p.set('appdep', state.settings.applicationDependency);
    if (state.settings.updateDependencies) p.set('upd', '1');
    if (state.settings.additionalCountries) p.set('addc', '1');
    window.history.replaceState(null, '', `${window.location.pathname}?${p.toString()}`);
  }

  // -------------------------------------------------------------------- UI

  let root;
  let advancedOpen = false;
  let lastVersion = null;
  let detailsOpen = false;

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === false) return;
      if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (k === 'html') node.innerHTML = v;
      else node.setAttribute(k, v === true ? '' : v);
    });
    children.flat(Infinity).forEach((c) => {
      if (c !== null && c !== undefined && c !== false) node.append(c.nodeType ? c : document.createTextNode(c));
    });
    return node;
  }

  function chip(label, { active, invalid, title, hint, onclick, disabled }) {
    const cls = ['ab-chip', active && 'is-active', invalid && 'is-invalid'].filter(Boolean).join(' ');
    return el('button', { type: 'button', class: cls, title, disabled, 'aria-pressed': active ? 'true' : 'false', onclick },
      label, hint ? el('span', { class: 'ab-chip-hint' }, hint) : null);
  }

  function row(label, ...content) {
    return el('div', { class: 'ab-row' },
      el('div', { class: 'ab-label' }, label),
      el('div', { class: 'ab-options' }, ...content));
  }

  function update(change) {
    change();
    writeUrl();
    render();
  }

  // Simulates a change and reports the error it would cause, so chips can show it
  function errorFor(change) {
    const copy = JSON.parse(JSON.stringify(state));
    change(copy);
    return tryDetermine(copy).error;
  }

  function availableVersions() {
    const src = DATA.sources[`${effectiveAcc(state)}/${typeKey(state)}`];
    if (!src) return [];
    const country = mapCountry(typeKey(state), state.country || state.settings.country);
    const entry = src.countries[country];
    const missing = new Set(entry ? entry.missing : []);
    return src.versions.filter((v, i) => !missing.has(i));
  }

  function countryOptions(type) {
    const src = DATA.sources[`bcartifacts/${type}`];
    const own = src ? Object.keys(src.countries).sort() : [];
    const mapped = type === 'sandbox' ? Object.keys(COUNTRY_MAP).filter((c) => !own.includes(c)).sort() : [];
    return { own, mapped };
  }

  function renderAccounts() {
    const info = ACCOUNTS.find((a) => a.value === state.acc);
    return row('storageAccount',
      ACCOUNTS.map((a) => chip(a.label, {
        active: state.acc === a.value,
        hint: a.hint,
        title: errorFor((s) => { s.acc = a.value; }),
        invalid: !!errorFor((s) => { s.acc = a.value; }),
        onclick: () => update(() => { state.acc = a.value; })
      })),
      el('p', { class: 'ab-info' }, info ? info.info : `Custom storage account "${state.acc}".`));
  }

  function renderTypes() {
    const info = TYPES.find((t) => t.value.toLowerCase() === state.type.toLowerCase()) || TYPES[0];
    return row('type',
      TYPES.map((t) => chip(t.label, {
        active: state.type.toLowerCase() === t.value.toLowerCase(),
        hint: t.hint,
        title: errorFor((s) => { s.type = t.value; }),
        invalid: !!errorFor((s) => { s.type = t.value; }),
        onclick: () => update(() => { state.type = t.value; })
      })),
      el('p', { class: 'ab-info' }, info.info));
  }

  function renderVersions() {
    const versions = availableVersions();
    const majors = [...new Set(versions.map((v) => v.split('.')[0]))].sort((a, b) => b - a);
    const v = state.version;
    const major = v && v !== '*' ? v.split('.')[0] : '';
    const mm = v && v !== '*' && v.split('.').length >= 2 ? majorMinor(v) : '';
    const set = (value) => () => update(() => { state.version = value; });

    const parts = [
      chip('any', { active: v === '', onclick: set('') }),
      chip('*', { active: v === '*', hint: 'from app.json', onclick: set('*'), title: errorFor((s) => { s.version = '*'; }), invalid: !!errorFor((s) => { s.version = '*'; }) }),
      majors.map((m) => chip(m, { active: major === m, onclick: set(m) }))
    ];

    const sub = [];
    if (major) {
      const minors = [...new Set(versions.filter((x) => x.startsWith(`${major}.`)).map(majorMinor))].sort(vcmp);
      sub.push(el('div', { class: 'ab-sub' },
        chip(`all of ${major}`, { active: v === major, onclick: set(major) }),
        minors.map((x) => chip(x, { active: mm === x, onclick: set(x) }))));
    }
    if (mm) {
      const builds = versions.filter((x) => x.startsWith(`${mm}.`)).reverse();
      const select = el('select', { class: 'ab-select', 'aria-label': 'Exact build', onchange: (e) => update(() => { state.version = e.target.value; }) },
        el('option', { value: mm }, `any build of ${mm} (${builds.length})`),
        builds.map((b) => el('option', { value: b, selected: v === b }, b)));
      sub.push(el('div', { class: 'ab-sub' }, select));
    }

    const input = el('input', {
      class: 'ab-input', type: 'text', value: v, placeholder: 'or type: 28, 28.5, 28.5.54151.0, *', 'aria-label': 'Version',
      onchange: (e) => update(() => { state.version = e.target.value.trim(); })
    });

    let info = 'Any version.';
    if (v === '*') info = 'Taken from applicationDependency (major.minor), only builds ≥ applicationDependency. Works with first and latest only.';
    else if (isFullVersion(v)) info = 'A full version: exactly this build (or the closest one with select closest).';
    else if (v) info = `Prefix: matches every build of ${v.replace(/\.+$/, '')}.x. A prefix never matches a longer number, so 28.1 doesn't match 28.10.`;

    if (v === '*') {
      sub.push(el('div', { class: 'ab-sub' }, el('label', { class: 'ab-field' }, el('code', null, 'applicationDependency'),
        el('input', { class: 'ab-input ab-input-short', type: 'text', value: state.settings.applicationDependency, 'aria-label': 'applicationDependency',
          onchange: (e) => update(() => { state.settings.applicationDependency = isFullVersion(e.target.value.trim()) ? e.target.value.trim() : '18.0.0.0'; }) }))));
    }

    return row('version', parts, sub, el('div', { class: 'ab-sub' }, input), el('p', { class: 'ab-info' }, info));
  }

  function renderCountries() {
    const type = typeKey(state);
    const { own, mapped } = countryOptions(type);
    const c = state.country;
    // Usually the artifact country and the AL-Go country setting match, so keep them in sync
    const choose = (value) => { state.country = value; if (value) state.settings.country = value; };
    const set = (value) => () => update(() => choose(value));
    const others = own.filter((x) => !COMMON_COUNTRIES.includes(x));
    const select = el('select', { class: 'ab-select', 'aria-label': 'More countries', onchange: (e) => update(() => choose(e.target.value)) },
      el('option', { value: '', selected: COMMON_COUNTRIES.includes(c) || c === '' }, 'more…'),
      el('optgroup', { label: 'Localizations' }, others.map((x) => el('option', { value: x, selected: c === x }, x))),
      mapped.length ? el('optgroup', { label: 'Mapped automatically' }, mapped.map((x) => el('option', { value: x, selected: c === x }, `${x} → ${COUNTRY_MAP[x]}`))) : null);

    let info = 'The country only selects the localization, not the version. w1 is the worldwide base version without country-specific functionality.';
    if (c === '') info = `Empty: AL-Go uses the country setting (${state.settings.country}).`;
    else if (type === 'sandbox' && COUNTRY_MAP[c]) info = `${c} has no sandbox localization of its own and is mapped to ${COUNTRY_MAP[c]}.`;
    else if (['dech', 'frbe', 'frca', 'frch', 'itch', 'nlbe'].includes(c)) info = 'Language variant: on-premises only, and only up to version 14.';
    else if (c === 'na') info = 'North America: on-premises only, up to version 16.';
    else if (c === 'base' || c === 'core') info = 'Special index, not a localization.';

    return row('country',
      chip('setting', { active: c === '', hint: state.settings.country, onclick: set('') }),
      COMMON_COUNTRIES.map((x) => chip(x, { active: c === x, onclick: set(x), title: errorFor((s) => { s.country = x; }), invalid: !!errorFor((s) => { s.country = x; }) })),
      select,
      el('p', { class: 'ab-info' }, info));
  }

  function renderSelects() {
    const info = SELECTS.find((x) => x.value === state.select);
    return row('select',
      SELECTS.map((x) => {
        const error = errorFor((s) => { s.select = x.value; });
        return chip(x.value, {
          active: state.select === x.value,
          hint: x.value === 'latest' ? 'default' : null,
          invalid: !!error,
          title: error,
          onclick: () => update(() => { state.select = x.value; })
        });
      }),
      el('p', { class: 'ab-info' }, info ? info.info : ''));
  }

  function renderSettings() {
    const s = state.settings;
    const { own } = countryOptions('sandbox');
    const countries = [...new Set([...own.filter((c) => c !== 'base' && c !== 'core'), ...Object.keys(COUNTRY_MAP)])].sort();
    return row('AL-Go settings',
      el('label', { class: 'ab-field' }, el('code', null, 'country'),
        el('select', { class: 'ab-select', onchange: (e) => update(() => { s.country = e.target.value; }) },
          countries.map((c) => el('option', { value: c, selected: s.country === c }, c)))),
      el('label', { class: 'ab-field' }, el('code', null, 'applicationDependency'),
        el('input', { class: 'ab-input ab-input-short', type: 'text', value: s.applicationDependency,
          onchange: (e) => update(() => { s.applicationDependency = isFullVersion(e.target.value.trim()) ? e.target.value.trim() : '18.0.0.0'; }) })),
      el('div', { class: 'ab-sub ab-group' },
        el('label', { class: 'ab-field' },
          el('input', { type: 'checkbox', checked: state.mode === 'empty', onchange: (e) => update(() => { state.mode = e.target.checked ? 'empty' : 'search'; }) }),
          'Leave ', el('code', null, '"artifact"'), ' out of settings.json'),
        el('p', { class: 'ab-info' }, `AL-Go then picks the artifact itself: the newest sandbox for the country setting (${s.country}). The options above are ignored.`),
        el('div', { class: 'ab-nested' },
          el('label', { class: 'ab-field' },
            el('input', { type: 'checkbox', checked: s.updateDependencies, disabled: state.mode !== 'empty', onchange: (e) => update(() => { s.updateDependencies = e.target.checked; }) }),
            el('code', null, 'updateDependencies')),
          el('p', { class: 'ab-info' }, state.mode === 'empty'
            ? `Instead of the newest build, AL-Go takes the oldest build ≥ applicationDependency (${s.applicationDependency}).`
            : 'Only has an effect when "artifact" is left out.'))),
      el('label', { class: 'ab-field' },
        el('input', { type: 'checkbox', checked: s.additionalCountries, onchange: (e) => update(() => { s.additionalCountries = e.target.checked; }) }),
        el('code', null, 'additionalCountries'), ' is used'),
      s.additionalCountries ? el('p', { class: 'ab-info ab-effect' }, additionalCountriesEffect()) : null,
      el('p', { class: 'ab-info' }, 'applicationDependency is the highest application version in your app.json files, but at least the AL-Go setting (default 18.0.0.0).'));
  }

  // Explains what the additionalCountries checkbox changed for the current value
  function additionalCountriesEffect() {
    const without = JSON.parse(JSON.stringify(state));
    without.settings.additionalCountries = false;
    const before = tryDetermine(without);
    const after = tryDetermine(state);
    if (before.error || after.error) return 'AL-Go builds against the newest AT build of the same major.minor, so the version exists for every country.';
    if (before.result.version === after.result.version) {
      return `No change here: ${after.result.version} is already the newest AT build of ${majorMinor(after.result.version)}, which AL-Go uses so the version exists for every country.`;
    }
    return `Changes the build from ${before.result.version} to ${after.result.version}: with additional countries AL-Go uses the newest AT build of ${majorMinor(after.result.version)}, so the version exists for every country.`;
  }

  function renderOutput() {
    const r = tryDetermine(state);
    // The settings.json lines to copy: country and artifact belong together
    const lines = [`"country": "${state.settings.country}"`];
    if (state.mode === 'empty') {
      if (state.settings.updateDependencies) lines.push('"updateDependencies": true');
    } else {
      lines.push(`"artifact": "${r.artifact}"`);
    }
    const json = lines.join(',\n');
    const copy = el('button', { type: 'button', class: 'ab-copy', title: 'Copy', onclick: () => {
      navigator.clipboard.writeText(json).then(() => {
        copy.textContent = 'Copied';
        setTimeout(() => { copy.textContent = 'Copy'; }, 1500);
      });
    } }, 'Copy');

    const out = el('div', { class: 'ab-output' }, el('div', { class: 'ab-code' }, el('code', null, json), copy));

    if (r.error) {
      out.append(el('div', { class: 'ab-result is-error' }, el('strong', null, 'AL-Go fails: '), el('code', null, r.error)));
    } else {
      const a = r.result;
      const url = `https://${HOSTS[a.acc]}/${a.type}/${a.version}/${a.country}`;
      const changed = lastVersion !== null && lastVersion !== a.version;
      lastVersion = a.version;
      const version = r.replaced
        ? el('div', { class: 'ab-version' }, el('del', { title: `before ${r.replaced.reason}` }, r.replaced.from), ' → ', el('span', null, a.version))
        : el('div', { class: 'ab-version' }, a.version);
      if (changed) version.classList.add('is-changed');
      out.append(el('div', { class: 'ab-result' },
        version,
        el('details', { class: 'ab-details', open: detailsOpen, ontoggle: (e) => { detailsOpen = e.target.open; } },
          el('summary', null, 'Details: storage account, type, country, URL'),
          el('dl', null,
            el('dt', null, 'storage account'), el('dd', null, a.acc),
            el('dt', null, 'type'), el('dd', null, a.type === 'onprem' ? 'OnPrem' : 'Sandbox'),
            el('dt', null, 'country'), el('dd', null, a.country),
            el('dt', null, 'URL'), el('dd', null, el('code', { class: 'ab-url' }, url))))));
    }
    (r.warnings || []).forEach((w) => out.append(el('div', { class: 'ab-note is-warning', html: `⚠ ${w}` })));
    (r.notes || []).forEach((n) => out.append(el('div', { class: 'ab-note', html: n })));
    return out;
  }

  function render() {
    const disabled = state.mode === 'empty';
    const rows = [renderTypes(), renderVersions(), renderCountries(), renderSelects()];
    const accounts = renderAccounts();
    [...rows, accounts].forEach((r) => { if (disabled) r.classList.add('is-disabled'); });

    // Rarely needed options; opened automatically when one of them is in use
    if (state.acc || state.mode === 'empty' || state.settings.additionalCountries || (state.country && state.country !== state.settings.country)) advancedOpen = true;
    const advanced = el('details', { class: 'ab-advanced', open: advancedOpen, ontoggle: (e) => { advancedOpen = e.target.open; } },
      el('summary', null, 'Advanced: storage account, AL-Go settings'),
      accounts, renderSettings());

    const generated = new Date(DATA.generated);
    root.replaceChildren(
      renderOutput(),
      el('div', { class: 'ab-panel' }, ...rows, advanced),
      el('p', { class: 'ab-meta' },
        `Artifact data as of ${generated.toISOString().slice(0, 16).replace('T', ' ')} UTC, refreshed daily. `,
        'daily and weekly are computed for a GitHub-hosted runner (UTC) at the time you view this page. ',
        'The resolution logic mirrors AL-Go for GitHub and BcContainerHelper as of October 2026.'));
  }

  function init() {
    root = document.getElementById('artifact-builder');
    if (!root) return;
    fetch(root.dataset.src, { cache: 'no-cache' })
      .then((r) => r.json())
      .then((data) => {
        if (!data.generated) throw new Error('empty snapshot');
        DATA = data;
        readUrl();
        render();
      })
      .catch(() => {
        root.replaceChildren(el('p', { class: 'ab-result is-error' }, 'The artifact data could not be loaded. Please try again later.'));
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
