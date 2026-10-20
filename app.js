/* Dashboard Chaostreff Flensburg – läuft komplett im Browser, kein Backend.
 * Quellen: Open-Meteo, Bright Sky (DWD), transitous.org, sensor.community,
 * PEGELONLINE, SpaceAPI. Alle liefern CORS-Header und brauchen keinen Key. */
(() => {
  "use strict";
  const C = window.DASHBOARD_CONFIG;
  const $ = (id) => document.getElementById(id);
  const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const WEEKDAYS_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

  // ---------- Hilfsfunktionen ----------
  const pad = (n) => String(n).padStart(2, "0");
  const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const icon = (name, cls = "ico") => `<svg class="${cls}"><use href="#i-${name}"/></svg>`;

  async function getJSON(url, timeoutMs = 15000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } finally {
      clearTimeout(t);
    }
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371, toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  // Zeilen ausblenden, die nicht mehr vollständig in ihre Liste passen
  function fitRows(list) {
    for (const el of list.children) el.hidden = false;
    const limit = list.getBoundingClientRect().bottom + 1;
    for (const el of list.children) if (el.getBoundingClientRect().bottom > limit) el.hidden = true;
  }
  const fitAll = () => ["departures", "weather-days", "tasks"].forEach((id) => fitRows($(id)));
  window.addEventListener("resize", fitAll);

  // ---------- Statuszeile / Scheduler ----------
  const sources = {};
  function renderStatus() {
    const parts = Object.entries(sources).map(([name, s]) =>
      `<span data-ok="${s.ok ? 1 : 0}" title="${esc(s.error || "")}"><i></i>${esc(name)}</span>`);
    const last = Object.values(sources).filter((s) => s.ok && s.at).map((s) => s.at).sort().pop();
    parts.push(`<span class="right">Stand ${last ? hhmm(last) : "–"}</span>`);
    $("status").innerHTML = parts.join("");
  }
  function schedule(name, fn, seconds) {
    sources[name] = { ok: false, at: null };
    const run = async () => {
      try {
        await fn();
        sources[name] = { ok: true, at: new Date() };
      } catch (e) {
        console.warn(name, e);
        sources[name] = { ...sources[name], ok: false, error: String(e) };
      }
      renderStatus();
    };
    run();
    setInterval(run, seconds * 1000);
  }

  // ---------- Uhr ----------
  function isoWeek(d) {
    const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = x.getUTCDay() || 7;
    x.setUTCDate(x.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
    return Math.ceil(((x - y0) / 86400000 + 1) / 7);
  }
  function tickClock() {
    const now = new Date();
    $("clock").textContent = `${hhmm(now)}:${pad(now.getSeconds())}`;
    const date = now.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    $("date").textContent = `${date} · KW ${isoWeek(now)}`;
  }
  tickClock();
  setInterval(tickClock, 1000);

  // ---------- Nächster regelmäßiger Termin ----------
  function tickNext() {
    const r = C.recurring;
    if (!r) return;
    const card = document.querySelector(".card-next");
    $("next-title").textContent = `Nächster ${r.label}`;
    const now = new Date();
    const start = new Date(now);
    start.setHours(r.hour, r.minute, 0, 0);
    const delta = (r.weekday - now.getDay() + 7) % 7;
    start.setDate(start.getDate() + delta);
    const runningUntil = new Date(start.getTime() + 5 * 3600e3); // läuft "ab 19 Uhr bis open end": 5 h als Anzeige
    if (delta === 0 && now >= start && now < runningUntil) {
      card.dataset.live = "1";
      $("next-when").textContent = "Läuft gerade";
      $("next-sub").textContent = `seit ${hhmm(start)} Uhr`;
      return;
    }
    if (start < now) start.setDate(start.getDate() + 7);
    card.dataset.live = "0";
    const diffMs = start - now;
    const days = Math.floor(diffMs / 86400000);
    const hours = Math.floor((diffMs % 86400000) / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    const sameDay = start.toDateString() === now.toDateString();
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    const label = sameDay ? "Heute" : start.toDateString() === tomorrow.toDateString() ? "Morgen" : WEEKDAYS[start.getDay()];
    $("next-when").textContent = `${label} ${hhmm(start)}`;
    $("next-sub").textContent = days > 0 ? `in ${days} Tag${days === 1 ? "" : "en"} ${hours} h` : hours > 0 ? `in ${hours} h ${mins} min` : `in ${mins} min`;
  }
  tickNext();
  setInterval(tickNext, 30000);

  // ---------- SpaceAPI ----------
  async function updateSpace() {
    const d = await getJSON(C.spaceApi);
    const open = d?.state?.open;
    const card = $("space");
    card.dataset.state = open === true ? "open" : open === false ? "closed" : "unknown";
    $("space-text").textContent = open === true ? "offen" : open === false ? "geschlossen" : "unbekannt";
    const lc = d?.state?.lastchange;
    if (lc) {
      const t = new Date(lc * 1000);
      const today = t.toDateString() === new Date().toDateString();
      $("space-since").textContent = `seit ${today ? "" : WEEKDAYS_SHORT[t.getDay()] + " "}${hhmm(t)} Uhr`;
    } else {
      $("space-since").textContent = d?.space || "";
    }
  }

  // ---------- Wetter ----------
  const WMO = {
    0: ["sun", "Klar"], 1: ["sun", "Überwiegend klar"], 2: ["partly", "Teils bewölkt"], 3: ["cloud", "Bedeckt"],
    45: ["fog", "Nebel"], 48: ["fog", "Reifnebel"],
    51: ["drizzle", "Leichter Niesel"], 53: ["drizzle", "Niesel"], 55: ["drizzle", "Starker Niesel"],
    56: ["drizzle", "Gefrierender Niesel"], 57: ["drizzle", "Gefrierender Niesel"],
    61: ["rain", "Leichter Regen"], 63: ["rain", "Regen"], 65: ["rain", "Starker Regen"],
    66: ["rain", "Gefrierender Regen"], 67: ["rain", "Gefrierender Regen"],
    71: ["snow", "Leichter Schnee"], 73: ["snow", "Schnee"], 75: ["snow", "Starker Schnee"], 77: ["snow", "Schneegriesel"],
    80: ["rain", "Regenschauer"], 81: ["rain", "Regenschauer"], 82: ["rain", "Heftige Schauer"],
    85: ["snow", "Schneeschauer"], 86: ["snow", "Schneeschauer"],
    95: ["thunder", "Gewitter"], 96: ["thunder", "Gewitter mit Hagel"], 99: ["thunder", "Gewitter mit Hagel"],
  };
  function wmo(code, isDay = 1) {
    let [ic, text] = WMO[code] || ["cloud", "–"];
    if (!isDay) { if (ic === "sun") ic = "moon"; else if (ic === "partly") ic = "partly-night"; }
    return { ic, text };
  }
  const COMPASS = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];
  const compass = (deg) => COMPASS[Math.round(deg / 45) % 8];
  const deg = (v) => `${Math.round(v)}°`;

  async function updateWeather() {
    const { lat, lon, name } = C.location;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
      + `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,is_day`
      + `&hourly=temperature_2m,precipitation_probability,weather_code,is_day`
      + `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset`
      + `&timezone=Europe%2FBerlin&forecast_days=4`;
    const d = await getJSON(url);
    $("weather-place").textContent = name;

    const cur = d.current;
    const w = wmo(cur.weather_code, cur.is_day);
    $("weather-icon").setAttribute("href", `#i-${w.ic}`);
    $("weather-temp").textContent = deg(cur.temperature_2m);
    $("weather-desc").textContent = w.text;
    $("weather-feels").textContent = `gefühlt ${deg(cur.apparent_temperature)}`;
    $("weather-wind").textContent = `Wind ${Math.round(cur.wind_speed_10m)} km/h ${compass(cur.wind_direction_10m)}`;

    // Stündlich: ab der nächsten vollen Stunde, alle 2 h, 6 Spalten
    const now = new Date();
    const h = d.hourly;
    const startIdx = h.time.findIndex((t) => new Date(t) > now);
    const slots = [];
    for (let i = startIdx, n = 0; i < h.time.length && n < 6; i += 2, n++) {
      const t = new Date(h.time[i]);
      const hw = wmo(h.weather_code[i], h.is_day[i]);
      const p = h.precipitation_probability[i] ?? 0;
      slots.push(`<div class="hour"><span class="t">${pad(t.getHours())}</span>${icon(hw.ic)}<span class="temp">${deg(h.temperature_2m[i])}</span><span class="rain" data-hi="${p >= 40 ? 1 : 0}">${icon("drop")}${p}%</span></div>`);
    }
    $("weather-hours").innerHTML = slots.join("");

    // Tage: morgen und die zwei folgenden
    const dy = d.daily;
    const days = [];
    for (let i = 1; i < Math.min(4, dy.time.length); i++) {
      const t = new Date(dy.time[i]);
      const dw = wmo(dy.weather_code[i], 1);
      days.push(`<div class="day"><span class="name">${i === 1 ? "Morgen" : WEEKDAYS_SHORT[t.getDay()]}</span>${icon(dw.ic)}<span class="desc">${esc(dw.text)}</span><span class="rng"><b>${deg(dy.temperature_2m_max[i])}</b> / ${deg(dy.temperature_2m_min[i])}</span><span class="rain">${dy.precipitation_probability_max[i] ?? 0}%</span></div>`);
    }
    $("weather-days").innerHTML = days.join("");
    $("weather-sun").innerHTML = `<span>${icon("sunrise")}${hhmm(new Date(dy.sunrise[0]))}</span><span>${icon("sunset")}${hhmm(new Date(dy.sunset[0]))}</span>`;
    fitAll();
  }

  // ---------- Wetterwarnungen (DWD über Bright Sky) ----------
  async function updateAlerts() {
    const { lat, lon } = C.location;
    const d = await getJSON(`https://api.brightsky.dev/alerts?lat=${lat}&lon=${lon}`);
    const box = $("alerts");
    const alerts = (d.alerts || []).slice(0, 2);
    box.hidden = alerts.length === 0;
    box.innerHTML = alerts.map((a) => {
      const level = ["Severe", "Extreme"].includes(a.severity) ? "critical" : "warning";
      const until = a.expires ? ` · bis ${hhmm(new Date(a.expires))}` : "";
      return `<div class="alert" data-level="${level}">${icon("warn")}<span><b>${esc(a.event_de || a.headline_de)}</b> <span class="muted">${esc(a.headline_de || "")}${until}</span></span></div>`;
    }).join("");
    fitAll();
  }

  // ---------- Abfahrten (transitous / MOTIS) ----------
  async function updateDepartures() {
    const t = C.transit;
    $("dep-stop").textContent = t.stopName;
    const d = await getJSON(`https://api.transitous.org/api/v1/stoptimes?stopId=${encodeURIComponent(t.stopId)}&n=${t.count + 8}&radius=150`);
    const now = Date.now();
    const rows = (d.stopTimes || [])
      .filter((s) => !t.lines.length || t.lines.includes(s.routeShortName))
      .map((s) => {
        const dep = new Date(s.place.departure || s.place.scheduledDeparture);
        const sched = new Date(s.place.scheduledDeparture || s.place.departure);
        return { s, dep, sched, delayMin: Math.round((dep - sched) / 60000), inMin: Math.round((dep - now) / 60000) };
      })
      .filter((r) => r.inMin >= -1)
      .sort((a, b) => a.dep - b.dep)
      .slice(0, t.count);

    $("dep-empty").hidden = rows.length > 0;
    $("departures").innerHTML = rows.map(({ s, dep, sched, delayMin, inMin }) => {
      const isNow = inMin <= 0;
      const inTxt = isNow ? "jetzt" : inMin < 60 ? `${inMin}<small>min</small>` : hhmm(dep);
      const delay = delayMin !== 0 ? `<span class="delay" data-early="${delayMin < 0 ? 1 : 0}">${delayMin > 0 ? "+" : ""}${delayMin}</span>` : "";
      const live = s.realTime ? `<span class="live" title="Echtzeit"></span>` : "";
      const to = String(s.headsign || s.tripTo?.name || "").replace(/^Flensburg[, ]+/, "");
      return `<li class="dep" data-now="${isNow ? 1 : 0}" data-cancelled="${s.place.cancelled ? 1 : 0}">`
        + `<span class="line">${esc(s.routeShortName || "?")}</span>`
        + `<span class="to">${esc(to)}</span>`
        + `<span class="time">${hhmm(sched)}${delay}${live}</span>`
        + `<span class="in">${inTxt}</span></li>`;
    }).join("");
    fitAll();
  }

  // ---------- Feinstaub (sensor.community) ----------
  const PM = {
    pm25: { max: 75, bands: [[20, "good", "gut"], [25, "warning", "mäßig"], [50, "serious", "schlecht"], [Infinity, "critical", "sehr schlecht"]] },
    pm10: { max: 150, bands: [[40, "good", "gut"], [50, "warning", "mäßig"], [100, "serious", "schlecht"], [Infinity, "critical", "sehr schlecht"]] },
  };
  function renderMeter(id, value) {
    const el = $(id), spec = PM[id];
    if (value == null) { el.dataset.level = ""; el.querySelector("b").textContent = "--"; el.querySelector(".meter-fill").style.width = "0"; el.querySelector(".meter-label").dataset.text = ""; return; }
    const band = spec.bands.find(([lim]) => value <= lim);
    el.dataset.level = band[1];
    el.querySelector(".meter-label").dataset.text = band[2];
    el.querySelector("b").textContent = value.toFixed(value < 10 ? 1 : 0);
    el.querySelector(".meter-fill").style.width = `${Math.min(100, (value / spec.max) * 100)}%`;
  }
  function latestOf(entries) {
    return entries.slice().sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1))[0];
  }
  function pmValues(entry) {
    const v = (type) => { const x = entry.sensordatavalues.find((s) => s.value_type === type); return x ? parseFloat(x.value) : null; };
    return { pm10: v("P1"), pm25: v("P2") };
  }
  async function updateAir() {
    const { sensorIds, fallbackRadiusKm } = C.air;
    const { lat, lon } = C.location;
    let entry = null, note = "";
    for (const id of sensorIds) {
      const list = await getJSON(`https://data.sensor.community/airrohr/v1/sensor/${id}/`);
      const withPm = list.filter((e) => e.sensordatavalues.some((s) => s.value_type === "P2"));
      if (withPm.length) { entry = latestOf(withPm); note = `#${id}`; break; }
    }
    if (!entry) {
      const list = await getJSON(`https://data.sensor.community/airrohr/v1/filter/area=${lat},${lon},${fallbackRadiusKm}`);
      const candidates = list.filter((e) => e.sensordatavalues.some((s) => s.value_type === "P2"))
        .map((e) => ({ e, km: haversineKm(lat, lon, +e.location.latitude, +e.location.longitude) }))
        .sort((a, b) => a.km - b.km);
      if (candidates.length) {
        entry = candidates[0].e;
        note = `#${entry.sensor.id} · ${candidates[0].km.toFixed(1)} km`;
      }
    }
    if (!entry) {
      renderMeter("pm25", null); renderMeter("pm10", null);
      $("air-sub").textContent = ""; $("air-foot").textContent = "Kein Sensor erreichbar";
      return;
    }
    const { pm25, pm10 } = pmValues(entry);
    renderMeter("pm25", pm25); renderMeter("pm10", pm10);
    const ts = new Date(entry.timestamp.replace(" ", "T") + "Z");
    const ageMin = Math.max(0, Math.round((Date.now() - ts) / 60000));
    $("air-sub").textContent = entry.sensor.id !== sensorIds[0] ? "Ersatz" : "";
    $("air-foot").textContent = `${note} · ${ageMin === 0 ? "gerade eben" : `vor ${ageMin} min`}`;
  }

  // ---------- Luft im Space (airquality.c3fl.de) ----------
  // Stufen wie auf airquality.c3fl.de: [Grenze, Stufe, Grenze inklusive?]
  const INDOOR = {
    co2:         { unit: "ppm",   bands: [[1000, "good", false], [2000, "moderate", true], [Infinity, "poor"]] },
    pm2p5:       { unit: "µg/m³", bands: [[15, "good", true], [50, "moderate", true], [Infinity, "poor"]] },
    pm10:        { unit: "µg/m³", bands: [[45, "good", true], [120, "moderate", true], [Infinity, "poor"]] },
    voc:         { unit: "",      bands: [[150, "good", true], [250, "moderate", true], [Infinity, "poor"]] },
    nox:         { unit: "",      bands: [[20, "good", true], [150, "moderate", true], [Infinity, "poor"]] },
    temperature: { unit: "°C",    bands: [[18, "poor", false], [20, "moderate", false], [26, "good", true], [30, "moderate", true], [Infinity, "poor"]] },
    humidity:    { unit: "%",     bands: [[20, "poor", false], [30, "moderate", false], [60, "good", true], [70, "moderate", true], [Infinity, "poor"]] },
  };
  const LEVEL_TEXT = { good: "gut", moderate: "mäßig", poor: "schlecht" };
  function indoorLevel(metric, v) {
    if (v == null) return "";
    for (const [max, level, incl] of INDOOR[metric].bands) if (incl ? v <= max : v < max) return level;
    return "";
  }
  async function updateIndoor() {
    const { api, client } = C.indoor;
    const q = (range, res) => getJSON(`${api}/query?time_range=${range}&resolution=${res}&client=${encodeURIComponent(client)}`);
    const [recent, day] = await Promise.all([q("1h", "1m"), q("24h", "15m")]);
    const latest = recent.filter((r) => r.co2 != null).pop();
    const card = $("indoor");
    $("indoor-sub").textContent = client;
    if (!latest) {
      card.dataset.level = ""; $("co2-value").textContent = "---"; $("co2-level-text").textContent = "keine Daten";
      $("indoor-stats").innerHTML = ""; $("co2-spark").innerHTML = ""; $("indoor-foot").textContent = "";
      return;
    }
    const co2Level = indoorLevel("co2", latest.co2);
    card.dataset.level = co2Level;
    $("co2-value").textContent = Math.round(latest.co2);
    $("co2-level-text").textContent = `CO₂ ${LEVEL_TEXT[co2Level] || ""}`;
    const stat = (metric, label, v, digits = 0) => {
      if (v == null) return "";
      const unit = INDOOR[metric].unit;
      return `<div class="stat" data-level="${indoorLevel(metric, v)}"><span class="l">${label}</span><span><b>${v.toFixed(digits)}</b>${unit ? " " + unit : ""}</span></div>`;
    };
    $("indoor-stats").innerHTML = stat("temperature", "Temp", latest.temperature, 1) + stat("humidity", "Feuchte", latest.humidity)
      + stat("pm2p5", "PM2.5", latest.pm2p5) + stat("voc", "VOC", latest.voc);
    sparkline($("co2-spark"), day.map((r) => r.co2), null, 200);
    const ageMin = Math.max(0, Math.round((Date.now() - new Date(latest.date)) / 60000));
    $("indoor-foot").textContent = `CO₂ 24 h · ${ageMin === 0 ? "gerade eben" : `vor ${ageMin} min`}`;
  }

  // ---------- Pegel (PEGELONLINE) ----------
  function sparkline(svg, values, ref, minSpan = 10) {
    const W = 300, H = 60, padY = 4;
    values = values.filter((v) => v != null && Number.isFinite(v));
    if (values.length < 2) { svg.innerHTML = ""; return; }
    let min = Math.min(...values), max = Math.max(...values);
    if (ref != null) { min = Math.min(min, ref); max = Math.max(max, ref); }
    if (max - min < minSpan) { const m = (max + min) / 2; min = m - minSpan / 2; max = m + minSpan / 2; }
    const x = (i) => (i / (values.length - 1)) * W;
    const y = (v) => H - padY - ((v - min) / (max - min)) * (H - 2 * padY);
    const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    const line = `M${pts.join("L")}`;
    const area = `${line}L${W},${H}L0,${H}Z`;
    const refLine = ref != null ? `<line class="ref" x1="0" x2="${W}" y1="${y(ref).toFixed(1)}" y2="${y(ref).toFixed(1)}"/>` : "";
    const last = values.length - 1;
    svg.innerHTML = `<path class="area" d="${area}"/>${refLine}<path class="line" d="${line}"/><circle class="end" cx="${x(last).toFixed(1)}" cy="${y(values[last]).toFixed(1)}" r="3"/>`;
  }
  async function updatePegel() {
    const base = `https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations/${encodeURIComponent(C.pegel.station)}/W`;
    $("pegel-title").textContent = C.pegel.label;
    const [cur, series, meta] = await Promise.all([
      getJSON(`${base}/currentmeasurement.json`),
      getJSON(`${base}/measurements.json?start=P1D`),
      getJSON(`${base}.json?includeCharacteristicValues=true`).catch(() => null),
    ]);
    const mw = meta?.characteristicValues?.find((c) => c.shortname === "MW")?.value ?? null;
    const card = document.querySelector(".card-pegel");
    const stateMap = { normal: ["normal", "normal"], low: ["low", "niedrig"], high: ["high", "hoch"] };
    const [stateKey, stateText] = stateMap[cur.stateMnwMhw] || ["unknown", ""];
    card.dataset.state = stateKey;
    $("pegel-value").textContent = Math.round(cur.value);

    const vals = series.map((m) => m.value);
    const ago = series.find((m) => Date.now() - new Date(m.timestamp) <= 3 * 3600e3)?.value;
    const diff = ago != null ? cur.value - ago : 0;
    $("pegel-trend").textContent = diff >= 5 ? "↗" : diff <= -5 ? "↘" : "→";
    const parts = [];
    if (mw != null) { const dv = Math.round(cur.value - mw); parts.push(`MW ${dv >= 0 ? "+" : "−"}${Math.abs(dv)} cm`); }
    if (stateText) parts.push(stateText);
    $("pegel-sub").textContent = parts.join(" · ");
    // auf ~5-Minuten-Raster ausdünnen, damit der Pfad klein bleibt
    const step = Math.max(1, Math.floor(vals.length / 288));
    sparkline($("pegel-spark"), vals.filter((_, i) => i % step === 0 || i === vals.length - 1), mw);
  }

  // ---------- Aufgaben ----------
  $("tasks").innerHTML = (C.tasks || []).map((t) => `<li>${icon("check")}<span>${esc(t)}</span></li>`).join("");
  fitAll();

  // ---------- Start ----------
  schedule("SpaceAPI", updateSpace, C.refresh.space);
  schedule("Open-Meteo", updateWeather, C.refresh.weather);
  schedule("DWD", updateAlerts, C.refresh.alerts);
  schedule("transitous", updateDepartures, C.refresh.transit);
  schedule("Luft Space", updateIndoor, C.refresh.indoor);
  schedule("sensor.community", updateAir, C.refresh.air);
  schedule("PEGELONLINE", updatePegel, C.refresh.pegel);

  if (C.reloadEveryHours > 0) setTimeout(() => location.reload(), C.reloadEveryHours * 3600e3);
})();
