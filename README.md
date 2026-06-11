# Raum für Selbstwirksamkeit — App

Progressive Web App (PWA) für die Coaching-Plattform [selbstwirksamkeit.ch](https://www.selbstwirksamkeit.ch).

## Live-URLs

| | URL |
|---|---|
| **Coachee-App (Live)** | https://dicostaempfli.github.io/selbstwirksamkeit-app/ |
| **Admin-App** | https://dicostaempfli.github.io/selbstwirksamkeit-app/admin.html |
| **Staging** | https://dicostaempfli.github.io/selbstwirksamkeit-app/staging/ |

## Stack

- **Frontend:** Preact 10 + htm (UMD, kein Build-Schritt)
- **Backend:** Firebase Compat v10.7.1 — Firestore, Auth, Storage
- **Hosting:** GitHub Pages
- **Region:** europe-west6 (Zürich)

## Dateien

| Datei | Beschreibung |
|---|---|
| `index.html` | Coachee-App — mobile-first, Safari iOS |
| `admin.html` | Coach/Admin-App — desktop, Firefox |
| `sw.js` | Service Worker für Push-Notifications |
| `_headers` | Cache-Control für GitHub Pages |
| `staging/index.html` | Test-Umgebung mit rotem Banner |

## Deployment

```bash
# Änderungen deployen
git add .
git commit -m "fix: beschreibung"
git push origin main
# → Live nach ~30s
```

## Dokumentation

Vollständige Projektdokumentation in den Claude-Projektdateien (Project Knowledge).

---
*Entwickelt von Rico Stämpfli · Stand: Juni 2026*
