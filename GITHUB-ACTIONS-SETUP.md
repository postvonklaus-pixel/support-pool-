# GitHub Actions Setup

## Falls Actions nicht laufen

### 1. Actions-Berechtigungen prüfen

1. Repository öffnen → **Settings** → **Actions** → **General**
2. Bei "Actions permissions" → **Allow all actions and reusable workflows** auswählen
3. Speichern

### 2. Workflows aktivieren

1. Repository → **Actions**-Tab öffnen
2. In der linken Leiste: Siehst du "TikTok Thumbnails" und "Process Video Queue"?
3. Falls ein Workflow den Hinweis **"This scheduled workflow is disabled"** zeigt:
   - Workflow öffnen → **Enable workflow** klicken

### 3. Manuell testen

Zum manuellen Auslösen:

1. **Actions** → "TikTok Thumbnails" → **Run workflow** → **Run workflow** (grüner Button)
2. Warten bis der Run grün wird (ca. 1–2 Min)
3. Gleiches für "Process Video Queue"

### 4. Secrets prüfen

Für beide Workflows wird das Secret `FIREBASE_SERVICE_ACCOUNT` benötigt:

1. **Settings** → **Secrets and variables** → **Actions**
2. `FIREBASE_SERVICE_ACCOUNT` muss vorhanden sein
3. Falls nicht: Neues Secret anlegen mit dem Firebase Admin SDK JSON-Inhalt

---

## Falls GitHub Cron unzuverlässig läuft

GitHub scheduled workflows sind "best-effort" — sie können bis zu mehrere Stunden verzögert sein oder bei inaktiven Repos pausiert werden.

**Lösung:** Externen Trigger einrichten → siehe [EXTERNAL-TRIGGER.md](EXTERNAL-TRIGGER.md)

---

## Workflow-Übersicht

| Workflow | Datei | Intervall | Funktion |
|---|---|---|---|
| TikTok Thumbnails | `tiktok-thumbnails.yml` | alle 30 Min | Lädt Thumbnail-Bilder für neue Videos |
| Process Video Queue | `process-queue.yml` | alle 2h | Aktiviert vorgemerkte Videos, markiert abgelaufene |
