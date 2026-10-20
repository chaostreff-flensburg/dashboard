// Konfiguration des Dashboards. Alles, was man anpassen möchte, steht hier.
// Die Datei wird als normales Script geladen, damit das Dashboard auch
// direkt von file:// ohne Webserver funktioniert.
window.DASHBOARD_CONFIG = {
  // Standort des Space (für Wetter, Luft, Sensor-Fallback)
  location: { lat: 54.8046, lon: 9.4225, name: "Flensburg" },

  // SpaceAPI-Endpunkt (liefert offen/geschlossen)
  spaceApi: "https://api.chaostreff-flensburg.de/",

  // Regelmäßiger Termin, der im Kopfbereich angezeigt wird
  recurring: { label: "OpenSpace", weekday: 2, hour: 19, minute: 0 }, // 0 = Sonntag, 2 = Dienstag

  // Abfahrten (transitous.org, deckt NAH.SH über DELFI-GTFS ab)
  transit: {
    stopId: "de-DELFI_de:01001:27424::1", // Flensburg Terrassenstraße
    stopName: "Terrassenstraße",
    count: 9,
    // Optional: nur bestimmte Linien zeigen, z.B. ["1", "7"]; leer = alle
    lines: [],
  },

  // Luft im Space (eigene API, Sensor in der Werkstatt)
  indoor: { api: "https://airquality.c3fl.de/api", client: "Werkstatt" },

  // Feinstaub draußen (sensor.community). Es wird der erste Sensor mit Daten genommen,
  // ansonsten der nächstgelegene aktive Sensor im Umkreis (km).
  air: { sensorIds: [87534], fallbackRadiusKm: 8 },

  // Pegel (PEGELONLINE-Stationsname)
  pegel: { station: "FLENSBURG", label: "Pegel Flensburger Förde" },

  // Aufgaben: offene Checkboxen ("- [ ] …") aus dem Pad, abgehakte ("- [x]") werden nicht gezeigt
  tasks: { url: "https://md.c3fl.de/space-todos/download" },

  // Aktualisierungsintervalle in Sekunden
  refresh: { transit: 30, space: 60, weather: 600, indoor: 60, air: 300, pegel: 600, alerts: 600, tasks: 120 },

  // Kompletter Seiten-Reload (Minuten); holt auch neue Dashboard-Versionen nach einem git pull
  reloadEveryMinutes: 10,
};
