# Backend live auf Railway (kostenlos)

**Wichtig vorab:** Alles Code-/Konfigurationsseitige ist fertig, committet und
lokal vollstaendig getestet (siehe Test-Protokoll unten). Der eigentliche
Railway-Klick-Durch (Schritte 1-6) muss aus deinem eigenen Railway-Account
kommen - dafuer gibt es keine API, ueber die das automatisiert werden kann.
Alles danach (Schritt 7+) ist wieder automatisch.

**Korrektur zur SQLite-Annahme:** Railway speichert die SQLite-Datei
standardmaessig **nicht** dauerhaft - jeder Redeploy startet einen frischen
Container, die Datei ist weg (Seed-Daten legen sich automatisch neu an,
aber echte Beta-User/Feedback/Content waeren dann auch weg). Fuer die
Testphase mit haeufigen Deploys ist das meist okay; fuer echte Daten siehe
"Troubleshooting" unten (Volume mounten).

## Checkliste

- [x] `app.py` bereit (Landing-Redirect, Beta-Signup, Webhook, Dashboard, CORS)
- [x] `railway.json` erstellt
- [x] `Procfile` erstellt
- [x] CORS eingebaut (`Access-Control-Allow-Origin: *` fuer Beta-Signup von GitHub Pages)
- [x] Lokal getestet (siehe unten)
- [ ] Deployed auf Railway ← **dein Schritt**
- [ ] `API_BASE_URL` in `ai-automation/index.html` mit echter Railway-URL aktualisiert ← **dein Schritt**
- [ ] Beta-Signup funktioniert LIVE
- [ ] Dashboard erreichbar
- [ ] `ADMIN_PASSWORD` in Railway-Variables gesetzt (echtes Passwort, nicht der Default) ← **dein Schritt**
- [ ] `/admin`-Uebersicht erreichbar

## Schritte

### 1. Auf railway.app registrieren
[railway.app](https://railway.app) &rarr; "Login" &rarr; mit GitHub anmelden.

### 2. Neues Projekt
Dashboard &rarr; **"New Project"** &rarr; **"Deploy from GitHub repo"**

### 3. Repository auswaehlen
`postvonklaus-pixel/support-pool-` auswaehlen. Falls Railway noch keinen
Zugriff auf das Repo hat, "Configure GitHub App" anbieten lassen und Zugriff
gewaehren.

### 4. Konfiguration pruefen
Railway liest `railway.json` automatisch:
- Builder: NIXPACKS (nicht das vorhandene `Dockerfile` - bewusst so
  konfiguriert, siehe Kommentar in `railway.json`)
- Start-Befehl: `python production.py`
- Healthcheck: `/health`

Nichts weiter einzustellen noetig. Umgebungsvariablen sind **optional** -
ohne sie laeuft alles automatisch im Mock-Modus mit SQLite (siehe
`.env.example`, falls du z.B. echte E-Mails willst).

**Eine Variable solltest du trotzdem setzen:** `Settings → Variables` &rarr;
`ADMIN_PASSWORD` mit einem eigenen, echten Passwort anlegen. Schuetzt die
`/admin`-Uebersicht (MRR, Wachstumsziel, Beta-Tester, Feedback - siehe Schritt
6). Ohne diese Variable gilt der unsichere Code-Default `changeme-admin`.

### 5. Deploy starten
Railway deployed automatisch nach dem Verbinden. Fortschritt im "Deployments"-Tab
verfolgen (dauert ueblicherweise 1-3 Minuten fuer den ersten Build).

### 6. URL kopieren
Nach erfolgreichem Deploy: **Settings &rarr; Networking &rarr; "Generate Domain"**
(Railway vergibt Domains nicht automatisch, das ist ein bewusster Klick).
Du bekommst eine URL nach dem Muster:
```
https://<projektname>-production.up.railway.app
```
Das ist deine echte Backend-URL - ich kann sie nicht vorher erraten oder
festlegen, das entscheidet Railway beim Deploy.

**Test sofort danach:**
```bash
curl https://<deine-railway-url>/health
# Erwartet: {"status": "ok", "mock_stripe": true}
```

**Admin-Uebersicht:** `https://<deine-railway-url>/admin` im Browser oeffnen,
mit dem in Schritt 4 gesetzten `ADMIN_PASSWORD` einloggen - zeigt MRR,
Wachstumsziel-Fortschritt, Beta-Tester-Aktivitaet (inkl. Inaktivitaets-Warnung)
und alle Feedback-Eintraege, live von der Railway-Datenbank.

### 7. Landing Page mit dem Backend verbinden

`ai-automation/index.html` hat aktuell absichtlich eine leere `API_BASE_URL`
(die Seite zeigt sonst einen freundlichen Hinweis statt eines stillen
Fehlers). Jetzt eintragen:

```js
// in ai-automation/index.html, im <script>-Block:
const API_BASE_URL = 'https://<deine-railway-url>';
```

Dann committen und pushen (auf `main`, oder auf einen Branch + PR, je nachdem
was du bevorzugst) - `ai-automation/index.html` liegt direkt im Branch, GitHub
Pages liefert Aenderungen daran automatisch bei jedem Push aus (kein
Workflow, kein Build-Schritt, siehe `DEPLOY.md` Schritt A). Kein weiterer
manueller Schritt noetig.

## Automatische Deploys (Railway)

Sobald das Projekt einmal verbunden ist, deployed Railway automatisch bei
jedem Push auf `main` neu - das ist Railway-Standardverhalten fuer
GitHub-verbundene Projekte, kein weiteres Setup noetig. Die Landing Page auf
GitHub Pages aktualisiert sich unabhaengig davon fuer sich (siehe oben).

## Lokaler Test (bereits durchgefuehrt, zum Nachvollziehen)

```bash
python production.py
```

| Route | Test-Befehl | Ergebnis (lokal verifiziert) |
|---|---|---|
| `/` | `curl -I http://localhost:8080/` | `302` &rarr; redirected zu GitHub Pages |
| `/health` | `curl http://localhost:8080/health` | `{"status":"ok","mock_stripe":true}` |
| `/beta-signup` | `curl -X POST http://localhost:8080/beta-signup -H "Content-Type: application/json" -d '{"email":"test@test.com"}'` | `201`, User angelegt, CORS-Header gesetzt |
| `/dashboard` | Login mit `user_pro@test.com` / `testpassword123` | `200`, Session-Cookie gesetzt |
| `/webhook` | Mock-Stripe-Event per POST | `{"status":"handled",...}` |

Sobald die Railway-URL da ist, dieselben `curl`-Befehle einfach mit der neuen
URL statt `localhost:8080` wiederholen.

## Test-User fuer die Live-Demo anlegen

Sobald Railway live ist:
```bash
curl -X POST https://<deine-railway-url>/beta-signup \
  -H "Content-Type: application/json" \
  -d '{"email":"dein.test@example.com"}'
```
Antwort enthaelt `user_id`, aber **nie das Passwort** (bewusst nicht in der
HTTP-Antwort, siehe `app.py`). Das temporaere Passwort steht in den
Railway-Logs (Deployments &rarr; laufende Instanz &rarr; Logs, dort nach
`[MOCK-EMAIL]` suchen - im Mock-Modus wird die Onboarding-Mail nur geloggt,
nicht wirklich verschickt).

Alternativ: die bereits geseedeten Test-User funktionieren auch live sofort
(Passwort fuer alle: `testpassword123`):

| E-Mail | Plan |
|---|---|
| `user_starter@test.com` | Starter |
| `user_creator@test.com` | Creator |
| `user_pro@test.com` | Pro |
| `user_agent@test.com` | Agent |
| `user_expired@test.com` | Starter (abgelaufen) |

## Troubleshooting

- **Healthcheck schlaegt fehl / App startet nicht:** Railway-Logs pruefen
  (Deployments &rarr; View Logs). Haeufigste Ursache: `python production.py`
  wird nicht als Start-Befehl erkannt - in Railway unter Settings pruefen,
  dass kein anderer Start-Befehl manuell ueberschrieben wurde.
- **CORS-Fehler im Browser (Landing Page kann Backend nicht erreichen):**
  `API_BASE_URL` in `ai-automation/index.html` pruefen (Schritt 7) - haeufigster
  Fehler ist ein vergessenes `https://` oder ein tippfehlerhafter Domainname.
- **SQLite-Daten verschwinden nach Redeploy:** Railway's Dateisystem ist
  standardmaessig **nicht persistent** ueber Deploys hinweg (jeder Deploy =
  frischer Container). Fuer dauerhafte Daten in Railway unter "Volumes" ein
  Volume auf `/app/data` mounten. Fuer die Beta-Testphase mit haeufigen
  Redeploys ist das ok (Seed-Daten werden automatisch neu angelegt), fuer
  echten Betrieb aber vorher einrichten.
