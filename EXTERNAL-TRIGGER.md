# External Trigger (zuverlässiger als GitHub Cron)

## Problem

GitHub scheduled workflows laufen nicht immer zuverlässig:
- Repos mit wenig Aktivität werden von GitHub pausiert
- Cron-Ausführungen können bis zu mehrere Stunden verzögert sein
- Bei längerer Inaktivität (>60 Tage ohne Commits) werden Schedules deaktiviert

## Lösung: cron-job.org (kostenlos)

Externer Dienst triggert die GitHub Actions via API — unabhängig von GitHub-internen Heuristiken.

---

### Schritt 1: GitHub Personal Access Token erstellen

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. **Generate new token (classic)**
3. Name: `support-pool-actions`
4. Scope: Haken bei **workflow** setzen
5. Token kopieren und sicher aufbewahren (wird nur einmal angezeigt)

---

### Schritt 2: cron-job.org Account

1. https://cron-job.org aufrufen → kostenlos registrieren

---

### Schritt 3: Cronjob für TikTok Thumbnails

**Neuer Cronjob** mit diesen Einstellungen:

| Feld | Wert |
|---|---|
| URL | `https://api.github.com/repos/postvonklaus-pixel/support-pool-/actions/workflows/tiktok-thumbnails.yml/dispatches` |
| Method | `POST` |
| Header | `Authorization: token DEIN_TOKEN` |
| Header | `Accept: application/vnd.github.v3+json` |
| Header | `Content-Type: application/json` |
| Body | `{"ref":"main"}` |
| Schedule | Alle 30 Minuten |

---

### Schritt 4: Cronjob für Process Video Queue

Gleiche Einstellungen, nur andere URL:

| Feld | Wert |
|---|---|
| URL | `https://api.github.com/repos/postvonklaus-pixel/support-pool-/actions/workflows/process-queue.yml/dispatches` |
| Schedule | Alle 2 Stunden |

---

### Schritt 5: Testen

1. Cronjob in cron-job.org manuell auslösen ("Run now")
2. GitHub → Actions prüfen: Läuft ein neuer Run an?
3. Run sollte grün werden

---

## Vorteile gegenüber GitHub Cron

- Zuverlässig: Läuft auch bei inaktiven Repos
- Kostenlos: cron-job.org Basis-Plan reicht
- Transparenz: Logs in cron-job.org zeigen jeden Aufruf
