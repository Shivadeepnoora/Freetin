/* Hyderabad Live Traffic — static client app.
 * Live data: TomTom Traffic APIs (flow tiles, flow segment data, incident details v5).
 * Without a key the app runs in clearly-labelled demo mode with sample data. */
(() => {
  'use strict';

  const CENTER = [17.405, 78.46];
  // minLon, minLat, maxLon, maxLat — roughly the area inside the Outer Ring Road (~1,700 km², under TomTom's 10,000 km² limit)
  const BBOX = [78.25, 17.25, 78.65, 17.6];
  const API = 'https://api.tomtom.com';
  const KEY_STORE = 'hydTraffic.tomtomKey';
  const INTERVAL_STORE = 'hydTraffic.intervalMin';

  // Key corridors / junctions to track. Points are snapped by TomTom to the nearest road segment.
  const ROADS = [
    { name: 'HITEC City (Cyber Towers)', area: 'Madhapur', lat: 17.4504, lon: 78.3810 },
    { name: 'Gachibowli Flyover', area: 'Gachibowli', lat: 17.4401, lon: 78.3489 },
    { name: 'Biodiversity Junction', area: 'Gachibowli', lat: 17.4206, lon: 78.3790 },
    { name: 'Mindspace / Raidurg', area: 'Raidurg', lat: 17.4423, lon: 78.3770 },
    { name: 'JNTU – KPHB (NH65)', area: 'Kukatpally', lat: 17.4933, lon: 78.3915 },
    { name: 'Miyapur X Roads', area: 'Miyapur', lat: 17.4960, lon: 78.3570 },
    { name: 'Ameerpet', area: 'Ameerpet', lat: 17.4375, lon: 78.4483 },
    { name: 'Panjagutta', area: 'Panjagutta', lat: 17.4262, lon: 78.4510 },
    { name: 'Begumpet (Airport Rd)', area: 'Begumpet', lat: 17.4440, lon: 78.4680 },
    { name: 'Paradise, Secunderabad', area: 'Secunderabad', lat: 17.4436, lon: 78.4870 },
    { name: 'Tank Bund Road', area: 'Hussain Sagar', lat: 17.4239, lon: 78.4738 },
    { name: 'Lakdikapul – Khairatabad', area: 'Khairatabad', lat: 17.4050, lon: 78.4630 },
    { name: 'Mehdipatnam', area: 'Mehdipatnam', lat: 17.3916, lon: 78.4380 },
    { name: 'PVNR Expressway (Attapur)', area: 'Airport route', lat: 17.3755, lon: 78.4380 },
    { name: 'Afzalgunj', area: 'Old City', lat: 17.3730, lon: 78.4770 },
    { name: 'Dilsukhnagar', area: 'Dilsukhnagar', lat: 17.3688, lon: 78.5247 },
    { name: 'LB Nagar', area: 'LB Nagar', lat: 17.3457, lon: 78.5522 },
    { name: 'Uppal X Roads', area: 'Uppal', lat: 17.4018, lon: 78.5602 },
  ];

  const LEVELS = {
    free: { label: 'Free flow', color: 'var(--free)', hex: '#2fa66a' },
    slow: { label: 'Slow', color: 'var(--slow)', hex: '#e8b21e' },
    heavy: { label: 'Heavy', color: 'var(--heavy)', hex: '#ea7a1c' },
    jam: { label: 'Jammed', color: 'var(--jam)', hex: '#d33a2c' },
    closed: { label: 'Closed', color: 'var(--closed)', hex: '#7a1f1a' },
  };

  // TomTom iconCategory → label, emoji, filter group
  const INCIDENT_TYPES = {
    0: ['Incident', '⚠️', 'other'], 1: ['Accident', '💥', 'accident'], 2: ['Fog', '🌫️', 'weather'],
    3: ['Dangerous conditions', '⚠️', 'other'], 4: ['Rain', '🌧️', 'weather'], 5: ['Ice', '🧊', 'weather'],
    6: ['Traffic jam', '🚗', 'jam'], 7: ['Lane closed', '🚧', 'works'], 8: ['Road closed', '⛔', 'works'],
    9: ['Road works', '🚧', 'works'], 10: ['Wind', '💨', 'weather'], 11: ['Flooding', '🌊', 'weather'],
    14: ['Broken-down vehicle', '🚙', 'accident'],
  };
  const MAGNITUDE = { 0: ['Unknown delay', '#8a8a85'], 1: ['Minor', '#e8b21e'], 2: ['Moderate', '#ea7a1c'], 3: ['Major', '#d33a2c'], 4: ['Closure', '#7a1f1a'] };

  // ---------- state ----------
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
  };
  const urlKey = new URLSearchParams(location.search).get('key');
  let apiKey = urlKey || store.get(KEY_STORE) || '';
  let intervalMin = Number(store.get(INTERVAL_STORE) ?? 5);
  let roads = [];
  let incidents = [];
  let timer = null;
  let loading = false;
  let lastRefresh = 0;

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- map ----------
  const map = L.map('map', { zoomControl: true }).setView(CENTER, 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  let flowTiles = null;
  const roadLayer = L.layerGroup().addTo(map);
  const incidentLayer = L.layerGroup().addTo(map);
  L.control.layers(null, { 'Key roads': roadLayer, 'Incidents': incidentLayer }, { position: 'topright' }).addTo(map);

  function setFlowTiles() {
    if (flowTiles) { map.removeLayer(flowTiles); flowTiles = null; }
    if (!apiKey) return;
    flowTiles = L.tileLayer(`${API}/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${encodeURIComponent(apiKey)}&tileSize=256`, {
      opacity: 0.85, maxZoom: 22, attribution: 'Traffic &copy; TomTom', zIndex: 5,
    }).addTo(map);
  }

  // ---------- helpers ----------
  function levelFor(ratio, closed) {
    if (closed) return 'closed';
    if (ratio >= 0.85) return 'free';
    if (ratio >= 0.6) return 'slow';
    if (ratio >= 0.35) return 'heavy';
    return 'jam';
  }
  const fmtMin = (sec) => (sec >= 90 ? `${Math.round(sec / 60)} min` : `${Math.round(sec)} s`);
  const fmtTime = (d) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

  async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  // ---------- live data ----------
  async function fetchRoadLive(r) {
    const url = `${API}/traffic/services/4/flowSegmentData/absolute/10/json?point=${r.lat},${r.lon}&unit=KMPH&key=${encodeURIComponent(apiKey)}`;
    const { flowSegmentData: f } = await getJSON(url);
    const ratio = f.freeFlowSpeed ? Math.min(1, f.currentSpeed / f.freeFlowSpeed) : 1;
    return {
      ...r,
      speed: f.currentSpeed,
      freeFlow: f.freeFlowSpeed,
      delaySec: Math.max(0, (f.currentTravelTime || 0) - (f.freeFlowTravelTime || 0)),
      ratio,
      closed: !!f.roadClosure,
      confidence: f.confidence,
      path: (f.coordinates?.coordinate || []).map((c) => [c.latitude, c.longitude]),
      level: levelFor(ratio, f.roadClosure),
    };
  }

  async function fetchIncidentsLive() {
    const fields = '{incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description,code},startTime,endTime,from,to,length,delay,roadNumbers}}}';
    const url = `${API}/traffic/services/5/incidentDetails?bbox=${BBOX.join(',')}&fields=${encodeURIComponent(fields)}&language=en-GB&timeValidityFilter=present&key=${encodeURIComponent(apiKey)}`;
    const data = await getJSON(url);
    return (data.incidents || []).map(normalizeIncident).filter(Boolean);
  }

  function normalizeIncident(inc) {
    const p = inc.properties || {};
    const g = inc.geometry || {};
    let coords = [];
    if (g.type === 'Point') coords = [[g.coordinates[1], g.coordinates[0]]];
    else if (g.type === 'LineString') coords = g.coordinates.map(([lon, lat]) => [lat, lon]);
    if (!coords.length) return null;
    const [label, emoji, group] = INCIDENT_TYPES[p.iconCategory] || INCIDENT_TYPES[0];
    const desc = (p.events || []).map((e) => e.description).filter(Boolean).join(' · ');
    return {
      label, emoji, group,
      description: desc || label,
      from: p.from || '', to: p.to || '',
      road: (p.roadNumbers || []).join(', '),
      delaySec: p.delay || 0,
      lengthM: p.length || 0,
      magnitude: p.magnitudeOfDelay ?? 0,
      start: p.startTime ? new Date(p.startTime) : null,
      coords,
    };
  }

  async function loadLive() {
    const results = await Promise.allSettled(ROADS.map(fetchRoadLive));
    const authFail = results.find((r) => r.status === 'rejected' && (r.reason.status === 401 || r.reason.status === 403));
    if (authFail) throw Object.assign(new Error('API key rejected'), { auth: true });
    roads = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    try { incidents = await fetchIncidentsLive(); } catch (e) {
      if (e.status === 401 || e.status === 403) throw Object.assign(new Error('API key rejected'), { auth: true });
      incidents = [];
    }
    if (!roads.length) throw new Error('No road data returned');
  }

  // ---------- demo data (clearly labelled in UI) ----------
  function loadDemo() {
    const istHour = (new Date().getUTCHours() + 5.5 + new Date().getUTCMinutes() / 60) % 24;
    const peak = Math.max(Math.exp(-((istHour - 9.5) ** 2) / 3), Math.exp(-((istHour - 18.5) ** 2) / 4));
    const hotspots = ['HITEC', 'Gachibowli', 'Biodiversity', 'Mehdipatnam', 'Panjagutta', 'Ameerpet', 'KPHB', 'LB Nagar'];
    roads = ROADS.map((r) => {
      const hot = hotspots.some((h) => r.name.includes(h)) ? 0.25 : 0;
      const free = 40 + Math.round(Math.random() * 20);
      const ratio = Math.max(0.12, Math.min(1, 1 - peak * (0.35 + hot) - Math.random() * 0.2 + 0.05));
      const speed = Math.round(free * ratio);
      return { ...r, speed, freeFlow: free, ratio, closed: false, delaySec: Math.round(600 * (1 - ratio) * (0.5 + Math.random())), path: [], level: levelFor(ratio, false) };
    });
    const sample = [
      [6, 'Stationary traffic', 'Biodiversity Junction', 'Raidurg Metro', 17.4206, 78.379, 3, 540],
      [9, 'Roadworks — metro construction', 'Lakdikapul', 'Khairatabad', 17.405, 78.463, 2, 300],
      [1, 'Accident, right lane blocked', 'Mehdipatnam', 'Tolichowki', 17.3955, 78.428, 3, 720],
      [11, 'Waterlogging under the bridge', 'Paradise', 'Begumpet', 17.4438, 78.48, 2, 420],
      [14, 'Broken-down bus', 'Ameerpet', 'SR Nagar', 17.4405, 78.443, 1, 180],
      [6, 'Slow traffic', 'JNTU', 'KPHB Colony', 17.4933, 78.3915, 2, 360],
    ];
    incidents = sample.slice(0, 3 + Math.round(peak * 3)).map(([cat, d, from, to, lat, lon, mag, delay]) => {
      const [label, emoji, group] = INCIDENT_TYPES[cat];
      return { label, emoji, group, description: d, from, to, road: '', delaySec: delay, lengthM: 800, magnitude: mag, start: null, coords: [[lat, lon]] };
    });
  }

  // ---------- render ----------
  function render() {
    roadLayer.clearLayers();
    incidentLayer.clearLayers();

    roads.forEach((r) => {
      const lv = LEVELS[r.level];
      if (r.path.length > 1) {
        r.line = L.polyline(r.path, { color: lv.hex, weight: 7, opacity: 0.9 }).addTo(roadLayer);
      }
      r.marker = L.circleMarker([r.lat, r.lon], { radius: 8, color: '#fff', weight: 2, fillColor: lv.hex, fillOpacity: 1 })
        .bindPopup(roadPopup(r)).addTo(roadLayer);
    });

    incidents.forEach((i) => {
      const color = MAGNITUDE[i.magnitude]?.[1] || '#8a8a85';
      if (i.coords.length > 1) L.polyline(i.coords, { color, weight: 5, dashArray: '6 6', opacity: 0.85 }).addTo(incidentLayer);
      i.marker = L.marker(i.coords[0], {
        icon: L.divIcon({ className: '', html: `<div style="font-size:20px;line-height:1;filter:drop-shadow(0 1px 1px rgba(0,0,0,.5))">${i.emoji}</div>`, iconSize: [22, 22], iconAnchor: [11, 11] }),
      }).bindPopup(incidentPopup(i)).addTo(incidentLayer);
    });

    renderSummary();
    renderRoadList();
    renderIncidentList();
  }

  function roadPopup(r) {
    const lv = LEVELS[r.level];
    return `<div class="popup-title">${esc(r.name)}</div>
      <div><b style="color:${lv.hex}">${lv.label}</b> · ${r.closed ? 'road closed' : `${Math.round(r.speed)} km/h (usual ${Math.round(r.freeFlow)})`}</div>
      ${r.delaySec ? `<div>Extra delay on this stretch: ${fmtMin(r.delaySec)}</div>` : ''}`;
  }
  function incidentPopup(i) {
    return `<div class="popup-title">${i.emoji} ${esc(i.label)}</div>
      <div>${esc(i.description)}</div>
      ${i.from || i.to ? `<div>${esc(i.from)} → ${esc(i.to)}</div>` : ''}
      <div>${MAGNITUDE[i.magnitude]?.[0] || ''}${i.delaySec ? ` · +${fmtMin(i.delaySec)}` : ''}${i.lengthM ? ` · ${(i.lengthM / 1000).toFixed(1)} km` : ''}</div>`;
  }

  function renderSummary() {
    const avg = roads.length ? roads.reduce((s, r) => s + (1 - r.ratio), 0) / roads.length : 0;
    const pct = Math.round(avg * 100);
    const lv = LEVELS[levelFor(1 - avg, false)];
    $('congestion').textContent = roads.length ? `${pct}%` : '–';
    $('congestion').style.color = lv.hex;
    $('incidentCount').textContent = incidents.length;
    $('incidentBadge').textContent = incidents.length;
    const worst = [...roads].sort((a, b) => a.ratio - b.ratio)[0];
    $('worstRoad').textContent = worst ? worst.name : '–';
    $('worstRoad').title = worst ? `${worst.name}: ${Math.round(worst.speed)} km/h` : '';
  }

  function renderRoadList() {
    const sort = $('sortRoads').value;
    const list = [...roads].sort(sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => a.ratio - b.ratio);
    const ul = $('roadList');
    ul.innerHTML = list.length ? '' : '<li class="empty">No road data yet.</li>';
    list.forEach((r) => {
      const lv = LEVELS[r.level];
      const li = document.createElement('li');
      li.className = 'item';
      li.innerHTML = `<span class="dot" style="background:${lv.hex}"></span>
        <span class="item-title">${esc(r.name)}</span>
        <span class="item-right" style="color:${lv.hex}">${r.closed ? 'Closed' : `${Math.round(r.speed)} km/h`}</span>
        <span class="bar"><span style="width:${Math.round(r.ratio * 100)}%;background:${lv.hex}"></span></span>
        <span class="item-meta">${esc(r.area)} · ${lv.label}${r.delaySec >= 30 ? ` · +${fmtMin(r.delaySec)} delay` : ''}</span>`;
      li.addEventListener('click', () => focus(r.line ? r.line.getBounds() : [r.lat, r.lon], r.marker));
      ul.appendChild(li);
    });
  }

  function renderIncidentList() {
    const filter = $('filterIncidents').value;
    const list = incidents
      .filter((i) => filter === 'all' || i.group === filter)
      .sort((a, b) => b.magnitude - a.magnitude || b.delaySec - a.delaySec);
    const ul = $('incidentList');
    ul.innerHTML = list.length ? '' : '<li class="empty">No incidents reported right now. 🎉</li>';
    list.forEach((i) => {
      const [mag, color] = MAGNITUDE[i.magnitude] || MAGNITUDE[0];
      const li = document.createElement('li');
      li.className = 'item';
      li.innerHTML = `<span class="icon">${i.emoji}</span>
        <span class="item-title">${esc(i.description)}</span>
        <span class="item-right" style="color:${color}">${i.delaySec ? `+${fmtMin(i.delaySec)}` : esc(mag)}</span>
        <span class="item-meta">${i.from || i.to ? `${esc(i.from)} → ${esc(i.to)}` : esc(i.label)}${i.road ? ` · ${esc(i.road)}` : ''}${i.start ? ` · since ${fmtTime(i.start)}` : ''}</span>`;
      li.addEventListener('click', () => focus(i.coords.length > 1 ? L.latLngBounds(i.coords) : i.coords[0], i.marker));
      ul.appendChild(li);
    });
  }

  function focus(target, marker) {
    if (target instanceof L.LatLngBounds) map.fitBounds(target, { maxZoom: 16, padding: [40, 40] });
    else map.setView(target, 15);
    marker?.openPopup();
    if (window.matchMedia('(max-width: 820px)').matches) $('map').scrollIntoView({ behavior: 'smooth' });
  }

  function setStatus(kind, text) {
    const el = $('status');
    el.className = `pill pill-${kind}`;
    el.textContent = text;
  }

  // ---------- refresh loop ----------
  async function refresh() {
    if (loading) return;
    loading = true;
    lastRefresh = Date.now();
    $('refreshBtn').disabled = true;
    const live = !!apiKey;
    $('demoBanner').hidden = live;
    $('source').textContent = live ? 'Data: TomTom Traffic · Map © OpenStreetMap' : 'Sample data (demo) · Map © OpenStreetMap';
    try {
      if (live) await loadLive(); else loadDemo();
      render();
      const now = new Date();
      $('updated').textContent = `Updated ${fmtTime(now)} IST`;
      setStatus(live ? 'live' : 'demo', live ? `Live · ${fmtTime(now)}` : 'Demo data');
    } catch (e) {
      console.error(e);
      setStatus('error', e.auth ? 'Key rejected' : 'Update failed');
      $('updated').textContent = e.auth ? 'TomTom rejected the API key: check it in settings' : `Update failed (${e.message}); retrying on next refresh`;
      if (e.auth) openSettings();
    } finally {
      loading = false;
      $('refreshBtn').disabled = false;
    }
  }

  function schedule() {
    clearInterval(timer);
    timer = null;
    $('interval').textContent = intervalMin || 'off';
    if (intervalMin > 0) timer = setInterval(() => { if (!document.hidden) refresh(); }, intervalMin * 60_000);
  }

  // ---------- settings ----------
  const dialog = $('settings');
  function openSettings() {
    $('keyInput').value = apiKey;
    $('intervalInput').value = String(intervalMin);
    if (!dialog.open) dialog.showModal();
  }
  dialog.addEventListener('close', () => {
    intervalMin = Number($('intervalInput').value);
    store.set(INTERVAL_STORE, String(intervalMin));
    if (dialog.returnValue === 'save') apiKey = $('keyInput').value.trim();
    else if (dialog.returnValue === 'clear') apiKey = '';
    else { schedule(); return; }
    store.set(KEY_STORE, apiKey || null);
    setFlowTiles();
    schedule();
    refresh();
  });

  // ---------- wire up ----------
  $('refreshBtn').addEventListener('click', refresh);
  $('settingsBtn').addEventListener('click', openSettings);
  $('bannerKeyBtn').addEventListener('click', openSettings);
  $('sortRoads').addEventListener('change', renderRoadList);
  $('filterIncidents').addEventListener('change', renderIncidentList);
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => { x.classList.toggle('active', x === t); x.setAttribute('aria-selected', x === t); });
    $('tab-roads').hidden = t.dataset.tab !== 'roads';
    $('tab-incidents').hidden = t.dataset.tab !== 'incidents';
  }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && intervalMin > 0 && Date.now() - lastRefresh > intervalMin * 60_000) refresh(); });

  if (urlKey) { store.set(KEY_STORE, urlKey); history.replaceState(null, '', location.pathname); }
  setFlowTiles();
  schedule();
  refresh();
})();
