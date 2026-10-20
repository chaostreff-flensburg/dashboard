# Dashboard Chaostreff Flensburg

Info-Bildschirm für den Space (4:3-Monitor am Raspberry Pi). Läuft komplett im
Browser, kein Backend, keine API-Keys. Alle Daten werden direkt per `fetch`
geladen und einzeln aktualisiert; ein kompletter Reload passiert nur alle paar
Stunden (siehe `config.js`).

## Datenquellen

| Karte         | Quelle                                   | Intervall |
|---------------|------------------------------------------|-----------|
| Space-Status  | SpaceAPI `api.chaostreff-flensburg.de`   | 1 min     |
| Wetter        | Open-Meteo (aktuell, stündlich, 3 Tage)  | 10 min    |
| Warnungen     | Bright Sky (DWD-Warnungen)               | 10 min    |
| Abfahrten     | transitous.org (MOTIS, DELFI-GTFS, Echtzeit) | 30 s  |
| Luft drinnen  | airquality.c3fl.de (CO₂, PM, VOC, Temperatur, Feuchte) | 1 min |
| Luft draußen  | sensor.community (PM2.5 / PM10)          | 5 min     |
| Pegel         | PEGELONLINE (WSV), Station Flensburg     | 10 min    |
| Aufgaben      | `config.js`                              | –         |

Fällt eine Quelle aus, bleibt der letzte Stand stehen und der Punkt in der
Statuszeile unten wird rot.

## Anpassen

Alles Einstellbare steht in `config.js`: Koordinaten, Haltestelle, Sensor-IDs,
Pegelstation, Aufgaben, Intervalle. Ist der konfigurierte Feinstaubsensor
offline, wird automatisch der nächstgelegene aktive Sensor im Umkreis genutzt
und das in der Karte angezeigt.

Haltestellen-IDs lassen sich so finden:

```
https://api.transitous.org/api/v1/geocode?text=Flensburg%20Terrassenstra%C3%9Fe&type=STOP
```

## Betrieb auf dem Pi

Die Seite kann direkt als Datei geöffnet werden, ein Webserver ist nicht nötig:

```
chromium --kiosk --noerrdialogs --disable-session-crashed-bubble file:///home/pi/dashboard/index.html
```

Die Schriftgröße skaliert mit der Bildschirmhöhe, das Layout passt sich damit
jeder 4:3-Auflösung an (getestet mit 1024×768 und 1600×1200).
