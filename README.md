# PeerTube Static Files & Admin Stats Plugin

Ein umfassendes Plugin für PeerTube, das sowohl die Verwaltung statischer Dateien als auch detaillierte Administratorstatistiken in einer einheitlichen Lösung bietet.

## 🚀 Hauptfunktionen

### 📁 Datei-Management
- **Upload von Bildern und Dokumenten** mit Drag & Drop-Interface
- **Flexible Benutzerrechte** mit granularer Kontrolle
- **Admin-Interface** für zentrale Dateiverwaltung
- **Automatische Kategorisierung** nach Dateitypen
- **Link-Sharing** mit einem Klick

### 📊 Administrator-Statistiken
- **Instance-Metriken**: Benutzer, Videos, Speicherplatz, Engagement
- **Video-Analytics**: Detaillierte Zuschauerzahlen, Wiedergabezeit (Watch Time)
- **Top-Content**: Meistgesehene Videos und beliebteste Kanäle
- **Zeitbasierte Auswertungen** mit flexibler Gruppierung
- **Responsive Dashboards** mit dynamischen Diagrammen
- **Echtzeit-Datenaktualisierung**

## 📋 Unterstützte Dateitypen

### 🖼️ Bilder
- **JPG/JPEG** - Standard-Bildformat
- **PNG** - Verlustfreie Kompression
- **GIF** - Animierte Bilder
- **WebP** - Moderne Kompression
- **ICO** - Favicon und Icons

### 📄 Dokumente
- **PDF** - Portable Document Format
- **TXT** - Textdateien
- **DOC** - Microsoft Word (Legacy)
- **DOCX** - Microsoft Word (Modern)

## 🔧 Installation

### Automatische Installation (empfohlen)
1. Öffnen Sie Ihre **PeerTube Admin-Oberfläche**
2. Navigieren Sie zu **"Plugins & Themes"**
3. Suchen Sie nach **"peertube-plugin-static-files"**
4. Klicken Sie auf **"Installieren"**

### Manuelle Installation
```bash
cd /var/www/peertube
sudo -u peertube npm install peertube-plugin-static-files
sudo systemctl restart peertube
```

### Development Installation
```bash
git clone https://github.com/yarkolife/peertube-plugin-static-files.git
cd peertube-plugin-static-files
npm install
npm run build
```

## ⚙️ Konfiguration

Nach der Installation navigieren Sie zu:
**Admin → Plugins & Themes → peertube-plugin-static-files → Einstellungen**

### 🛠️ Verfügbare Einstellungen

| Einstellung | Beschreibung | Standard | Optionen |
|-------------|--------------|----------|----------|
| **Plugin aktivieren** | Master-Switch für das gesamte Plugin | ✅ Aktiviert | ☑️ / ☐ |
| **Upload-Seiten-Pfad** | URL-Pfad für die Upload-Seite | `files/upload` | Beliebiger Pfad |
| **Berechtigte Benutzer** | Komma-getrennte Liste spezifischer Benutzer | Leer (alle) | `user1,user2,user3` |
| **Berechtigte Rollen** | Systemrollen mit Zugriff | Alle angemeldeten | Siehe unten |
| **Erlaubte Dateitypen** | Upload-Beschränkungen | Alle | Bilder/Dokumente/Alle |
| **Max. Dateigröße** | Upload-Limit in Megabytes | 50 MB | 1-100 MB |

### 👥 Berechtigte Rollen

- **Alle angemeldeten Benutzer** *(Standard)*
  - Jeder mit gültigem Account kann Dateien hochladen
  - Benutzer sehen nur ihre eigenen Dateien
  
- **Nur Administratoren**
  - Maximale Sicherheit
  - Vollzugriff auf alle Funktionen
  
- **Administratoren und Moderatoren**
  - Moderatoren erhalten Upload-Rechte
  - Admins behalten alle Statistik-Funktionen

## 🎯 Verwendung

### 👤 Für Endbenutzer

1. **Zugang zur Upload-Seite**
   ```
   https://ihre-domain.de/p/files/upload
   ```

2. **Datei-Upload-Prozess**
   - Anmeldung (falls erforderlich)
   - Drag & Drop oder Datei-Browser verwenden
   - Upload-Fortschritt beobachten
   - Links kopieren und teilen

3. **Datei-Management**
   - Eigene Dateien anzeigen
   - Vorschau in neuem Tab
   - Download-Funktion
   - Löschung (nur eigene Dateien)

### 🔧 Für Administratoren

#### 📁 Datei-Verwaltung
**Zugang:** `/p/files/admin`

- **Alle Dateien anzeigen** mit Metadaten
- **Bulk-Operationen** für effiziente Verwaltung
- **Aufräumen-Funktion** für verwaiste Dateien
- **Benutzer-Zuordnung** und Upload-Zeitstempel

#### 📊 Statistik-Dashboard
**Zugang:** `/p/admin/stats`

- **Instance-Metriken**
  - Gesamtzahl Benutzer & Videos (+ Monatszuwachs)
  - **NEU:** Belegter Speicherplatz
  - **NEU:** Engagement (Kommentare & Likes)
  - Offene Meldungen/Beschwerden

- **Video-Analytics**
  - **NEU:** Wiedergabezeit (Watch Time) Analyse
  - **NEU:** Top-Listen (Videos & Kanäle)
  - **NEU:** Interaktive Diagramme
  - Flexible Zeitraumauswahl (Tag/Monat/Jahr)

## 🔗 API-Endpunkte

### 🌐 Öffentliche Endpunkte
```http
GET /plugins/static-files/router/file/:category/:filename
```
- Direkte Datei-Auslieferung
- Caching-Header für Performance
- Content-Type Detection

### 🔐 Authentifizierte Endpunkte

#### Datei-Management
```http
GET    /plugins/static-files/router/check-access      # Zugriff prüfen
POST   /plugins/static-files/router/upload            # Datei hochladen  
GET    /plugins/static-files/router/files             # Eigene Dateien
DELETE /plugins/static-files/router/file/:category/:filename  # Datei löschen
```

#### Admin-Funktionen
```http
GET  /plugins/static-files/router/admin/files    # Alle Dateien auflisten
POST /plugins/static-files/router/admin/cleanup  # Verwaiste Dateien aufräumen
GET  /plugins/static-files/router/admin/stats    # Instance-Statistiken
```

### 📝 API-Beispiele

#### Upload mit cURL
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@beispiel.jpg" \
  https://ihre-domain.de/plugins/static-files/router/upload
```

#### Statistiken abrufen
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://ihre-domain.de/plugins/static-files/router/admin/stats?from=2024-01-01&to=2024-12-31&groupBy=month"
```

## 🛠️ Entwicklung

### 📦 Voraussetzungen
- **Node.js** ≥ 16.0.0
- **PeerTube** ≥ 5.2.0
- **npm** oder **yarn**

### 🏗️ Development Setup
```bash
# Repository klonen
git clone https://github.com/yarkolife/peertube-plugin-static-files.git
cd peertube-plugin-static-files

# Abhängigkeiten installieren
npm install

# Development Build
npm run build

# Für Live-Entwicklung
npm run dev
```

### 📁 Projektstruktur
```
peertube-plugin-static-files/
├── assets/
│   └── style.css              # UI-Styling
├── client/
│   ├── client-plugin.js       # Haupt-Client-Code
│   └── stats-page.js          # Statistik-Interface
├── routes/
│   └── stats.js               # Statistik-API-Routen
├── dist/                      # Gebaute Dateien
├── public/uploads/            # Hochgeladene Dateien
│   ├── images/                # Bilder-Kategorie
│   └── documents/             # Dokument-Kategorie
├── metadata/                  # Datei-Metadaten (JSON)
├── scripts/
│   └── build.js               # Build-Pipeline
├── main.js                    # Server-seitiger Hauptcode
├── package.json               # Projekt-Konfiguration
└── README.md                  # Diese Dokumentation
```

### 🔄 Build-Prozess
```bash
# Vollständiger Build
npm run build

# Nur Client-Dateien
node scripts/build.js

# Entwicklung mit Auto-Reload  
npm run dev
```

## 🔒 Sicherheit & Best Practices

### 🛡️ Sicherheitsmaßnahmen
- **Strikte Dateityp-Validierung** auf Server- und Client-Seite
- **Dateigrößen-Limits** konfigurierbar bis 100MB
- **Benutzer-Autorisierung** bei jedem API-Aufruf
- **Pfad-Sanitization** verhindert Directory Traversal
- **MIME-Type-Prüfung** zusätzlich zur Dateiendung

### ⚡ Performance-Optimierungen
- **Streaming File Upload** für große Dateien
- **ETag & Cache-Control** Header für Browser-Caching
- **Lazy Loading** in der Dateiliste
- **Chunked Transfer** für Downloads
- **Database Query Optimization** für Statistiken

### 📊 Monitoring & Logging
- **Detaillierte Upload-Logs** mit Benutzer-Tracking
- **Error Handling** mit aussagekräftigen Fehlermeldungen
- **Performance Metriken** für Admin-Dashboard
- **Audit Trail** für Admin-Aktionen

## 🐛 Troubleshooting

### ❗ Häufige Probleme

#### Plugin lädt nicht
```bash
# PeerTube Logs prüfen
journalctl -u peertube -f

# Plugin-Status überprüfen
sudo -u peertube npm list | grep static-files

# Dateiberechtigungen korrigieren
sudo chown -R peertube:peertube /var/www/peertube/plugins/
```

#### Upload schlägt fehl
- ✅ **Dateigröße prüfen** (Standard: 50MB)
- ✅ **Dateityp validieren** (siehe unterstützte Formate)
- ✅ **Speicherplatz verfügbar** im uploads-Verzeichnis
- ✅ **Nginx Upload-Limit** erhöhen falls nötig

#### 403 Zugriffsverweigert
- ✅ **Benutzer-Anmeldung** überprüfen
- ✅ **Plugin-Einstellungen** kontrollieren
- ✅ **Rollen-Konfiguration** validieren

#### Statistiken laden nicht
- ✅ **Admin/Moderator-Rechte** bestätigen
- ✅ **Datenbank-Zugriff** testen
- ✅ **API-Endpunkte** via Browser/cURL prüfen

### 🔧 Debug-Modus aktivieren
```javascript
// In main.js temporär hinzufügen:
```
console.log('DEBUG: Plugin loaded with settings:', settings);
```

## 📈 Changelog

### v1.6.5 *(Aktuell)*
- 🐛 **Fix:** NPM-Installation repariert (prepare-Skript entfernt)

### v1.6.4
- 🐛 **Fix:** Korrektes Parsen der Kategorien aus der API (Objekt statt Array)

### v1.6.3
- ✅ **Verbessert:** Kategorien werden dynamisch über PeerTube API geladen
- 🔧 **Fix:** Kompatibel mit peertube-plugin-categories

### v1.6.2
- ✅ **Verbessert:** Kategorie-Namen angepasst (Kurzfilm, Heimatdoku, etc.)

### v1.6.1
- 🐛 **Fix:** renderRegionsCard Funktion fehlte
- 🐛 **Fix:** Top Kanäle und Kategorien zeigten falsche View-Zahlen  
- 🐛 **Fix:** Video-Counts waren inflationiert (jetzt COUNT DISTINCT)
- ✅ **Verbessert:** Watch Time = tatsächliche Wiedergabezeit (nicht Video-Länge)
- ✅ **Verbessert:** Views = einzelne View-Events (nicht aggregiert)

### v1.6.0
- 🏆 **Neu:** Top Kanäle Statistiken (Views, Watch Time, Video Count)
- 🏷️ **Neu:** Top Kategorien Analyse
- 📈 **Neu:** Schnell Wachsende Videos (7-Tage-Vergleich)
- 📊 **Neu:** Channel Performance Dashboard
- 🚀 **Neu:** Growth Tracking mit Prozent-Wachstum

### v1.5.0
- 🔥 **Neu:** Aktivitäts-Heatmap (Stunde × Wochentag)
- 💡 **Neu:** Beste Veröffentlichungszeiten-Empfehlungen
- 📊 **Neu:** Watch Time Perzentile (p25, p50, p75, p90, p95)
- 📈 **Neu:** Retention Distribution Visualisierung
- 🎯 **Neu:** Interaktive Heatmap mit Hover-Effekten

### v1.4.1
- 🗺️ **Neu:** Regional-Statistiken (Top Regionen mit Land und Views)
- 📊 **Verbessert:** Detaillierte Aufschlüsselung nach subdivisionName + country
- 👥 **Neu:** Unique Viewers pro Region

### v1.4.0
- ✨ **Neu:** DAU/WAU/MAU Metriken (Daily/Weekly/Monthly Active Users)
- 📊 **Neu:** Retention Metriken (Durchschnittliche & Median Watch Time)
- 📈 **Neu:** Time Series für Watch Time und Active Viewers
- 🎨 **Neu:** Interaktiver Chart-Selector (Views / Watch Time / Active Viewers)
- 🔧 **Verbessert:** Erweiterte Zeitreihen-Analysen

### v1.3.1
- 🎨 **Neu:** Modernes Dashboard-Design mit dunklem Theme und voller Seitenbreite
- ✨ **Verbessert:** Farbcodierte Metrik-Karten (Blau, Grün, Cyan, Orange, Lila, Pink)
- 🔧 **Verbessert:** Responsives Grid-Layout und verbesserte Lesbarkeit
- 💅 **Neu:** Animierte Hover-Effekte und moderne Typografie

### v1.3.0
- ✨ **Neu:** Detaillierte Zuschauer-Statistiken (Eindeutige Zuschauer, Länder, Geräte, Betriebssysteme, Browser)
- 🔧 **Verbessert:** Erweiterte Nutzung der `localVideoViewer` Tabelle für präzise Daten

### v1.2.9
- ✨ **Neu:** Exakte Berechnung der Wiedergabezeit (basierend auf `localVideoViewer`)
- 🔧 **Verbessert:** Fallback auf Schätzung, falls keine detaillierten Daten verfügbar sind
- 🗑️ **Entfernt:** Debug-Route

### v1.2.8
- 🔧 **Debug:** Temporäre Route zur Schema-Analyse hinzugefügt (für exakte Watch-Time)
- ✨ **Neu:** Unterstützung für SVG-Dateien beim Upload
- 🔧 **Verbessert:** Videotitel in Statistiken sind jetzt vollständig lesbar und verlinkt

### v1.2.7
- ✨ **Neu:** Unterstützung für SVG-Dateien beim Upload
- 🔧 **Verbessert:** Videotitel in Statistiken sind jetzt vollständig lesbar und verlinkt

### v1.2.6
- 🔧 **Verbessert:** Videotitel in Statistiken sind jetzt vollständig lesbar und verlinkt
- ℹ️ **Info:** Klarstellung zur Berechnung der Wiedergabezeit (Schätzung)

### v1.2.5
- 🐛 **Behoben:** Fehlende Statistik-Features im Frontend (Build-Prozess korrigiert)
- 🔧 **Verbessert:** Integration der Statistik-Seite

### v1.2.4
- 🐛 **Behoben:** HTTP 500 Fehler auf der Statistik-Seite (Fehlerbehandlung verbessert)
- 🔧 **Verbessert:** Robustere Berechnung der Wiedergabezeit

### v1.2.3
- ✨ **NEU:** Erweiterte Statistiken (Speicherplatz, Engagement, Wiedergabezeit)
- ✨ **NEU:** Top-Listen für Videos und Kanäle
- ✨ **NEU:** Dynamische Diagramme für Views-Verlauf
- 🐛 **Behoben:** Pfad-Probleme beim Datei-Upload (Persistente Speicherung)
- 🔧 **Verbessert:** Performance der Datenbank-Abfragen

### v1.2.0
- ✨ **NEU:** Basis Administrator-Statistiken
- ✨ **NEU:** Video-Analytics mit flexibler Gruppierung  
- ✨ **NEU:** ICO-Datei Unterstützung
- 🔧 **Verbessert:** Modulare Architektur mit separaten Routen
- 🔧 **Verbessert:** Enhanced Error Handling
- 🐛 **Behoben:** ES Module Export-Probleme

### v1.1.4
- 🔧 **Verbessert:** Datei-Metadaten System
- 🔧 **Verbessert:** Admin-Interface Überarbeitung
- 🐛 **Behoben:** Upload-Fehlerbehandlung

### v1.1.0
- ✨ Drag & Drop Upload-Interface
- ✨ Flexible Benutzerrechte-Verwaltung
- 🔧 Responsive Design

## 🤝 Beitragen

Wir freuen uns über Beiträge zur Weiterentwicklung des Plugins!

### 🔄 Contribution Workflow
1. **Fork** des Repositories erstellen
2. **Feature-Branch** erstellen (`git checkout -b feature/amazing-feature`)
3. **Änderungen committen** (`git commit -m 'Add amazing feature'`)
4. **Branch pushen** (`git push origin feature/amazing-feature`)
5. **Pull Request** erstellen

### 🐛 Bug Reports
Bitte verwenden Sie die **GitHub Issues** mit folgenden Informationen:
- PeerTube Version
- Plugin Version  
- Detaillierte Fehlerbeschreibung
- Schritte zur Reproduktion
- Browser/OS Information

### 💡 Feature Requests
Beschreiben Sie neue Funktionswünsche mit:
- Use Case und Motivation
- Erwartetes Verhalten
- Mögliche Implementierungsansätze

## 📄 Lizenz

Dieses Plugin ist unter der **AGPL-3.0** Lizenz veröffentlicht.

```
PeerTube Static Files & Admin Stats Plugin
Copyright (C) 2025 yarkolife

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
```

Vollständige Lizenz-Details finden Sie in der [LICENSE](LICENSE) Datei.

## 🙋‍♂️ Support & Community

### 📞 Support-Kanäle
- **GitHub Issues**: [Bug Reports & Feature Requests](https://github.com/yarkolife/peertube-plugin-static-files/issues)
- **GitHub Discussions**: [Community Forum](https://github.com/yarkolife/peertube-plugin-static-files/discussions)
- **PeerTube Forum**: [Plugin-spezifische Diskussionen](https://framatalk.org/c/peertube)

### 🌟 Mitwirkende
- **[yarkolife](https://github.com/yarkolife)** - Hauptentwickler & Maintainer
- **Community Contributors** - Siehe [Contributors](https://github.com/yarkolife/peertube-plugin-static-files/graphs/contributors)

### 💖 Sponsoring
Wenn dieses Plugin für Sie nützlich ist, können Sie die Entwicklung unterstützen:
- ⭐ **GitHub Star** vergeben
- 🍻 **Buy me a coffee** (Link folgt)
- 💼 **Enterprise Support** anfragen

---

**📌 Hinweis**: Dieses Plugin befindet sich in aktiver Entwicklung. Regelmäßige Updates bringen neue Features und Verbesserungen. Feedback und Verbesserungsvorschläge sind jederzeit willkommen!

---

*Entwickelt mit ❤️ für die PeerTube Community*