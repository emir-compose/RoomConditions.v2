/* Room Conditioning Monitor frontend
   By default it expects the API on the same origin:
   GET /api/MjerenjaOkoline?limit=200
   Response fields may be camelCase (ASP.NET Core default).
*/
const API_BASE_URL = ''; // npr. 'https://localhost:7042' samo ako frontend i API nisu na istom originu
const READINGS_ENDPOINT = '/api/MjerenjaOkoline';
const REFRESH_INTERVAL_MS = 2000;
const DEVICE_FRESHNESS_MS = 120000;

const state = {
  readings: [],
  apiOk: false,
  loading: false,
  lastFetchAt: null,
  period: '24h',
  search: '',
  dismissedError: false,
  refreshTimer: null,
};

const el = (id) => document.getElementById(id);
const numberFormat = new Intl.NumberFormat('bs-BA', { maximumFractionDigits: 1 });
const integerFormat = new Intl.NumberFormat('bs-BA', { maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat('bs-BA', { day: '2-digit', month: 'short', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('bs-BA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const dateTimeFormat = new Intl.DateTimeFormat('bs-BA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

function field(obj, camel, pascal = camel[0].toUpperCase() + camel.slice(1)) {
  return obj?.[camel] ?? obj?.[pascal];
}
function normalizeReading(item) {
    const id = Number(field(item, 'id'));
    const temperature = Number(field(item, 'temperaturaC'));
    const humidity = Number(field(item, 'vlaznostZraka'));
    const hvacRaw = field(item, 'klimaUkljucena');
    const received = field(item, 'datumVrijemePrijemaUtc');

    let receivedAt = null;

    if (received) {
        const timestamp = String(received);

        const hasTimezone =
            /(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp);

        const parsedDate = new Date(
            hasTimezone ? timestamp : timestamp + 'Z'
        );

        if (!Number.isNaN(parsedDate.getTime())) {
            receivedAt = parsedDate;
        }
    }

    return {
        id: Number.isFinite(id) ? id : null,
        deviceId: String(field(item, 'deviceId') ?? 'nepoznat-uredaj'),
        temperature: Number.isFinite(temperature) ? temperature : null,
        humidity: Number.isFinite(humidity) ? humidity : null,
        airConditionerOn: typeof hvacRaw === 'boolean' ? hvacRaw : null,
        receivedAt: receivedAt
    };
}
function isValidDate(date) { return date instanceof Date && !Number.isNaN(date.getTime()); }
function safeNum(value, suffix = '') { return value == null || !Number.isFinite(value) ? '—' : `${numberFormat.format(value)}${suffix}`; }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function shortDeviceName(value) {
  return value.length > 21 ? `${value.slice(0, 18)}…` : value;
}
function setApiStatus(ok, label) {
  state.apiOk = ok;
  const box = el('api-status');
  box.innerHTML = `<span class="status-dot ${ok ? 'good' : 'bad'}"></span><span>${escapeHtml(label)}</span>`;
  el('info-api-state').textContent = ok ? 'Povezano' : 'Nije dostupno';
}
function setDeviceState(reading) {
  const dot = el('device-state-dot');
  const sideDot = el('side-status-dot');
  const sideStatus = el('side-status');
  if (!reading) {
    dot.className = 'large-status-dot';
    el('device-state-text').textContent = 'Čeka se uređaj';
    sideDot.className = 'status-dot';
    sideStatus.textContent = 'Nema podataka';
    el('device-last-seen').textContent = 'Nema primljenih mjerenja';
    return;
  }
  const fresh = isValidDate(reading.receivedAt) && (Date.now() - reading.receivedAt.getTime() <= DEVICE_FRESHNESS_MS);
  dot.className = `large-status-dot ${fresh ? 'good' : 'bad'}`;
  el('device-state-text').textContent = fresh ? 'Podaci stižu' : 'Nema svježih podataka';
  sideDot.className = `status-dot ${fresh ? 'good' : 'bad'}`;
  sideStatus.textContent = fresh ? 'Posljednje očitanje svježe' : 'Posljednje očitanje je starije';
  el('device-last-seen').textContent = fresh ? 'Uređaj se nedavno javio' : 'Potrebno novo očitanje';
}
function setHvacState(reading) {
  const card = el('hvac-card');
  const shell = el('hvac-icon-shell');
  const label = el('hvac-state-text');
  const detail = el('hvac-state-detail');
  const pill = el('hvac-status-pill');
  if (!reading || reading.airConditionerOn === null) {
    card?.classList.remove('hvac-on');
    shell?.classList.remove('on');
    label.textContent = 'Čeka se status';
    detail.textContent = 'Prvo mjerenje s novim firmware-om još nije stiglo.';
    pill.className = 'hvac-status-pill unknown';
    pill.textContent = 'STATUS NEPOZNAT';
    return;
  }
  const on = reading.airConditionerOn;
  card?.classList.toggle('hvac-on', on);
  shell?.classList.toggle('on', on);
  label.textContent = on ? 'KLIMA UKLJUČENA' : 'KLIMA ISKLJUČENA';
  detail.textContent = on
    ? 'Temperatura je dostigla prag uključenja.'
    : 'Relej je isključen; čeka se porast temperature.';
  pill.className = `hvac-status-pill ${on ? 'on' : 'off'}`;
  pill.textContent = on ? 'SIMULACIJA UKLJUČENA' : 'SIMULACIJA ISKLJUČENA';
}

function filteredReadings() {
  const now = Date.now();
  let rows = [...state.readings];
  if (state.period === '24h') rows = rows.filter(x => isValidDate(x.receivedAt) && now - x.receivedAt.getTime() <= 24 * 60 * 60 * 1000);
  if (state.period === '7d') rows = rows.filter(x => isValidDate(x.receivedAt) && now - x.receivedAt.getTime() <= 7 * 24 * 60 * 60 * 1000);
  if (state.search.trim()) {
    const q = state.search.trim().toLocaleLowerCase('bs-BA');
    rows = rows.filter(x => x.deviceId.toLocaleLowerCase('bs-BA').includes(q));
  }
  return rows;
}
function renderMain() {
  const sorted = [...state.readings].sort((a, b) => (b.receivedAt?.getTime() ?? 0) - (a.receivedAt?.getTime() ?? 0) || (b.id ?? 0) - (a.id ?? 0));
  const latest = sorted[0] ?? null;
  el('nav-count').textContent = integerFormat.format(state.readings.length);
  el('last-sync').textContent = state.lastFetchAt ? timeFormat.format(state.lastFetchAt) : 'Još nije učitano';
  el('sync-detail').innerHTML = `<span class="sync-pulse"></span> ${state.apiOk ? 'API uspješno odgovorio' : 'Provjeri API vezu'}`;
  el('side-device').textContent = latest ? shortDeviceName(latest.deviceId) : 'Čeka se očitanje';
  if (!latest) {
    el('temperature-value').textContent = '—';
    el('humidity-value').textContent = '—';
    el('humidity-meter-fill').style.width = '0%';
    el('humidity-meter-value').textContent = '—';
    el('temperature-caption').textContent = 'Čeka se prvo očitanje';
    el('humidity-caption').textContent = 'Relativna vlažnost zraka';
    el('device-id').textContent = 'Nije dostupan';
    el('info-time').textContent = '—';
    el('info-id').textContent = '—';
    setDeviceState(null);
    setHvacState(null);
  } else {
    el('temperature-value').textContent = latest.temperature == null ? '—' : numberFormat.format(latest.temperature);
    el('humidity-value').textContent = latest.humidity == null ? '—' : numberFormat.format(latest.humidity);
    el('humidity-meter-fill').style.width = `${Math.max(0, Math.min(100, latest.humidity ?? 0))}%`;
    el('humidity-meter-value').textContent = latest.humidity == null ? '—' : `${numberFormat.format(latest.humidity)}%`;
    el('temperature-caption').textContent = latest.temperature == null ? 'Temperatura nije validna' : 'Posljednja zaprimljena vrijednost';
    el('humidity-caption').textContent = 'Relativna vlažnost zraka';
    el('device-id').textContent = latest.deviceId;
    el('info-time').textContent = isValidDate(latest.receivedAt) ? `${dateFormat.format(latest.receivedAt)} · ${timeFormat.format(latest.receivedAt)}` : 'Nepoznato vrijeme';
    el('info-id').textContent = latest.id == null ? '—' : `#${latest.id}`;
    setDeviceState(latest);
    setHvacState(latest);
  }
  const rows = filteredReadings();
  renderChart(rows);
  renderTable(rows);
}
function formatStamp(date) {
  if (!isValidDate(date)) return { primary: 'Vrijeme nije dostupno', secondary: '' };
  return { primary: dateFormat.format(date), secondary: timeFormat.format(date) };
}
function renderTable(rows) {
  const tbody = el('history-body');
  el('table-summary').textContent = rows.length ? `Prikazano ${rows.length} od ${state.readings.length} učitanih očitanja` : 'Nema očitanja za odabrani filter';
  el('table-count').textContent = `${rows.length} ${rows.length === 1 ? 'zapis' : 'zapisa'}`;
  el('export-button').disabled = rows.length === 0;
  if (!rows.length) {
    const text = state.readings.length ? 'Nema rezultata za ovaj filter.' : 'Baza još nema mjerenja.';
    const hint = state.readings.length ? 'Probaj drugi naziv uređaja ili period.' : 'Kada ESP32 pošalje prvo očitanje, pojavit će se u ovoj tabeli.';
    tbody.innerHTML = `<tr><td colspan="6"><div class="table-empty"><strong>${escapeHtml(text)}</strong><span>${escapeHtml(hint)}</span></div></td></tr>`;
    return;
  }
  tbody.innerHTML = rows.slice(0, 100).map(r => {
    const stamp = formatStamp(r.receivedAt);
    return `<tr>
      <td><span class="time-primary">${escapeHtml(stamp.primary)}</span><span class="time-secondary">${escapeHtml(stamp.secondary)}</span></td>
      <td><div class="device-cell"><span class="device-avatar">ESP</span><span>${escapeHtml(r.deviceId)}</span></div></td>
      <td><span class="value-pill">${r.temperature == null ? '—' : `${numberFormat.format(r.temperature)} °C`}</span></td>
      <td><span class="value-pill humidity-pill">${r.humidity == null ? '—' : `${numberFormat.format(r.humidity)} %`}</span></td>
      <td><span class="hvac-history-pill ${r.airConditionerOn === true ? 'on' : r.airConditionerOn === false ? 'off' : 'unknown'}">${r.airConditionerOn === true ? 'ON' : r.airConditionerOn === false ? 'OFF' : '—'}</span></td>
      <td><span class="id-pill">${r.id == null ? '—' : `#${r.id}`}</span></td>
    </tr>`;
  }).join('');
}
function renderChart(rows) {
  const canvas = el('readings-chart');
  const empty = el('chart-empty');
  const shown = [...rows].filter(r => isValidDate(r.receivedAt)).sort((a,b) => a.receivedAt - b.receivedAt);
  const latest = shown[shown.length - 1];
  el('chart-temp-last').textContent = latest?.temperature == null ? '—' : `${numberFormat.format(latest.temperature)}°`;
  el('chart-humidity-last').textContent = latest?.humidity == null ? '—' : `${numberFormat.format(latest.humidity)}%`;
  el('chart-count').textContent = `${shown.length} ${shown.length === 1 ? 'očitanje' : 'očitanja'}`;
  if (!shown.length) {
    canvas.style.display = 'none';
    empty.classList.add('visible');
    return;
  }
  canvas.style.display = 'block';
  empty.classList.remove('visible');
  drawChart(canvas, shown);
}
function drawChart(canvas, rows) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const w = rect.width, h = rect.height;
  const pad = { left: 37, right: 36, top: 15, bottom: 28 };
  const cw = w - pad.left - pad.right, ch = h - pad.top - pad.bottom;
  if (cw <= 0 || ch <= 0) return;
  ctx.clearRect(0, 0, w, h);
  ctx.font = '10px DM Sans, sans-serif';
  const temps = rows.map(r => r.temperature).filter(Number.isFinite);
  let tMin = temps.length ? Math.floor(Math.min(...temps) - 2) : 0;
  let tMax = temps.length ? Math.ceil(Math.max(...temps) + 2) : 50;
  if (tMax - tMin < 6) { tMin -= 2; tMax += 2; }
  tMin = Math.max(-10, tMin); tMax = Math.min(60, tMax);
  if (tMax <= tMin) { tMin = 0; tMax = 50; }
  const x = i => pad.left + (rows.length < 2 ? cw / 2 : i / (rows.length - 1) * cw);
  const yTemp = v => pad.top + ch - ((v - tMin) / (tMax - tMin)) * ch;
  const yHumidity = v => pad.top + ch - (v / 100) * ch;
  const grid = '#edf2ee';
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (ch / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.strokeStyle = grid; ctx.lineWidth = 1; ctx.stroke();
    const tv = tMax - ((tMax - tMin) / 4) * i;
    ctx.fillStyle = '#a0b0a7'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(`${Math.round(tv)}°`, pad.left - 9, y);
    ctx.textAlign = 'left'; ctx.fillText(`${100 - i * 25}%`, w - pad.right + 8, y);
  }
  const xLabels = [0, Math.floor((rows.length - 1) / 2), rows.length - 1].filter((v,i,a) => a.indexOf(v) === i);
  ctx.fillStyle = '#9baaa2'; ctx.textBaseline = 'top'; ctx.font = '9px DM Sans, sans-serif';
  xLabels.forEach(i => {
    let label;
    const date = rows[i].receivedAt;
    if (state.period === '24h') label = new Intl.DateTimeFormat('bs-BA', { hour: '2-digit', minute: '2-digit' }).format(date);
    else label = new Intl.DateTimeFormat('bs-BA', { day: '2-digit', month: 'short' }).format(date);
    ctx.textAlign = i === 0 ? 'left' : i === rows.length - 1 ? 'right' : 'center';
    ctx.fillText(label, x(i), h - pad.bottom + 10);
  });
  // Humidity area + line
  const humPoints = rows.map((r,i) => ({x:x(i),y:yHumidity(Math.max(0,Math.min(100,r.humidity ?? 0))),v:r.humidity}));
  ctx.beginPath(); humPoints.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
  if (humPoints.length) { ctx.lineTo(humPoints[humPoints.length-1].x, pad.top+ch); ctx.lineTo(humPoints[0].x,pad.top+ch); ctx.closePath(); ctx.fillStyle='rgba(126,177,194,.09)'; ctx.fill(); }
  drawLine(ctx, rows.map((r,i) => ({x:x(i), y:r.humidity == null ? null : yHumidity(Math.max(0,Math.min(100,r.humidity)))})), '#82b4c2');
  drawLine(ctx, rows.map((r,i) => ({x:x(i), y:r.temperature == null ? null : yTemp(r.temperature)})), '#4c9972');
  const tempPoint = [...rows].reverse().find(r => Number.isFinite(r.temperature));
  const humPoint = [...rows].reverse().find(r => Number.isFinite(r.humidity));
  if (tempPoint) drawLastPoint(ctx, x(rows.indexOf(tempPoint)), yTemp(tempPoint.temperature), '#4c9972');
  if (humPoint) drawLastPoint(ctx, x(rows.indexOf(humPoint)), yHumidity(humPoint.humidity), '#82b4c2');
}
function drawLine(ctx, points, color) {
  ctx.beginPath(); let started = false;
  for (const p of points) {
    if (p.y == null || !Number.isFinite(p.y)) { started = false; continue; }
    if (!started) { ctx.moveTo(p.x,p.y); started = true; } else ctx.lineTo(p.x,p.y);
  }
  ctx.strokeStyle = color; ctx.lineWidth = 2.25; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
}
function drawLastPoint(ctx, x, y, color) {
  ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle=color; ctx.stroke();
}
function showError(message) {
  if (state.dismissedError) return;
  el('error-message').textContent = message;
  el('error-notice').classList.remove('hidden');
}
function clearError() { el('error-notice').classList.add('hidden'); state.dismissedError = false; }
async function loadReadings({manual = false} = {}) {
  if (state.loading) return;
  state.loading = true;
  if (manual) el('refresh-button').classList.add('is-loading');
  try {
    const base = API_BASE_URL.replace(/\/$/, '');
    const url = `${base}${READINGS_ENDPOINT}?limit=200`;
    const response = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' }, cache: 'no-store' });
    if (!response.ok) {
      let detail = '';
      try { const body = await response.text(); detail = body.slice(0, 180); } catch {}
      throw new Error(`API je vratio HTTP ${response.status}${detail ? ` — ${detail}` : ''}`);
    }
    const payload = await response.json();
    if (!Array.isArray(payload)) throw new Error('API odgovor nije lista mjerenja. Provjeri GET /api/MjerenjaOkoline.');
    state.readings = payload.map(normalizeReading).sort((a,b) => (b.receivedAt?.getTime() ?? 0) - (a.receivedAt?.getTime() ?? 0) || (b.id ?? 0) - (a.id ?? 0));
    state.lastFetchAt = new Date();
    setApiStatus(true, 'API dostupan');
    clearError();
    renderMain();
  } catch (error) {
    setApiStatus(false, 'API nedostupan');
    showError(`${error.message}. Ako frontend nije poslužen iz istog ASP.NET Core projekta, provjeri API adresu i CORS postavke.`);
    if (!state.readings.length) {
      el('history-body').innerHTML = '<tr><td colspan="6"><div class="table-empty"><strong>Podaci nisu učitani</strong><span>Provjeri da li API radi, pa klikni Osvježi.</span></div></td></tr>';
      el('table-summary').textContent = 'API trenutno nije dostupan';
      el('table-count').textContent = '—';
      el('chart-empty').classList.add('visible');
      el('chart-empty').querySelector('strong').textContent = 'Nema veze s API-jem';
      el('chart-empty').querySelector('span').textContent = 'Provjeri adresu i pokretanje ASP.NET Core projekta.';
    }
  } finally {
    state.loading = false;
    el('refresh-button').classList.remove('is-loading');
  }
}
function exportCsv() {
  const rows = filteredReadings();
  if (!rows.length) return;
  const header = ['Id', 'DeviceId', 'TemperaturaC', 'VlaznostZraka', 'KlimaUkljucena', 'DatumVrijemePrijemaUtc'];
  const lines = [header.join(';'), ...rows.map(r => [r.id, r.deviceId, r.temperature, r.humidity, r.airConditionerOn, isValidDate(r.receivedAt) ? r.receivedAt.toISOString() : ''].map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(';'))];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`room-conditioning-mjerenja-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function startAutoRefresh() {
  if (state.refreshTimer) clearInterval(state.refreshTimer);
  state.refreshTimer = setInterval(() => { if (!document.hidden) loadReadings(); }, REFRESH_INTERVAL_MS);
}
function setupEvents() {
  el('refresh-button').addEventListener('click', () => loadReadings({manual:true}));
  el('dismiss-error').addEventListener('click', () => { state.dismissedError = true; el('error-notice').classList.add('hidden'); });
  el('device-search').addEventListener('input', e => { state.search = e.target.value; renderMain(); });
  el('export-button').addEventListener('click', exportCsv);
  document.querySelectorAll('.period-button').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('.period-button').forEach(x => x.classList.toggle('active', x === button));
    state.period = button.dataset.period; renderMain();
  }));
  el('menu-toggle').addEventListener('click', () => el('sidebar').classList.toggle('open'));
  document.querySelectorAll('[data-nav]').forEach(link => link.addEventListener('click', () => {
    document.querySelectorAll('[data-nav]').forEach(x => x.classList.toggle('active', x === link));
    el('sidebar').classList.remove('open');
  }));
  window.addEventListener('resize', () => renderChart(filteredReadings()));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadReadings(); });
}
setupEvents();
loadReadings();
startAutoRefresh();
