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

- [x] `app.py` bereit (Landing Page, Beta-Signup, Webhook, Dashboard, Admin)
- [x] `railway.json` erstellt
- [x] `Procfile` erstellt
- [x] Lokal getestet (siehe unten)
- [x] Deployed auf Railway
- [x] Custom Domain (`autosocial.cc`) eingerichtet
- [x] Beta-Signup funktioniert LIVE
- [x] Dashboard erreichbar
- [x] `ADMIN_PASSWORD` in Railway-Variables gesetzt (echtes Passwort, nicht der Default)
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
- Start-Befehl: `gunicorn app:app --bind 0.0.0.0:$PORT --workers 1 --threads 4
  --timeout 120` (echter WSGI-Server statt Flask-Dev-Server; DB-Init, Seed
  und der taegliche Scheduler laufen automatisch beim Import von `app.py` mit)
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

### 7. Custom Domain einrichten (optional, aber empfohlen)

Die Landing Page laeuft direkt in `app.py` (Route `/`) - kein separater
Verbindungsschritt zu GitHub Pages mehr noetig (das war ein frueherer
Zwischenstand, siehe git-history). Mit einer eigenen Domain (z.B. bei
Cloudflare gekauft) laesst sich die railway.app-URL trotzdem durch etwas
Praesentableres ersetzen:

1. Domain bei einem Registrar kaufen (z.B. Cloudflare Registrar, guenstig,
   kein Markup) - DNS liegt dann automatisch bei Cloudflare
2. Railway: „web"-Service &rarr; Settings &rarr; Networking &rarr; **„+ Custom
   Domain"** &rarr; deine Domain eintragen (z.B. `autosocial.cc`), Port
   `8080` (wird automatisch als "Railway magic" vorgeschlagen)
3. Railway zeigt danach ein **„One-Click DNS Setup"** mit Cloudflare-Logo,
   falls die Domain bei Cloudflare liegt - einfach auf „Connect" tippen und
   die Autorisierung bestaetigen. Railway traegt dann selbststaendig den
   noetigen `CNAME`- und `TXT`-Verifizierungs-Record bei Cloudflare ein
   (Alternative: die Records manuell in Cloudflares DNS-Einstellungen
   eintragen, Railway zeigt sie in der gleichen Ansicht an)
4. Nach ein paar Minuten (DNS-Propagierung) zeigt Railway die Domain als
   aktiv/verifiziert - `https://<deine-domain>` sollte dann die App zeigen
5. In Railway Variables `BACKEND_BASE_URL=https://<deine-domain>` setzen
   (fuer korrekte Links in E-Mails, z.B. zum Dashboard) und deployen

**Fuer echte E-Mails an beliebige Empfaenger** (siehe "Persistente
Datenbank"-Abschnitt weiter unten fuer den analogen DB-Weg) muss die
gleiche Domain zusaetzlich bei Resend verifiziert werden: Resend-Dashboard
&rarr; „Domains" &rarr; „Add Domain" &rarr; deine Domain eintragen. Liegt
die Domain bei Cloudflare, verifiziert Resend oft ganz von selbst (aehnliche
automatische Anbindung wie bei Railway) - sonst zeigt Resend die noetigen
TXT/CNAME-Records zum manuellen Eintragen in Cloudflare an. Danach
`RESEND_FROM_EMAIL=<adresse>@<deine-domain>` in Railway Variables setzen.

## Automatische Deploys (Railway)

Sobald das Projekt einmal verbunden ist, deployed Railway automatisch bei
jedem Push auf `main` neu - das ist Railway-Standardverhalten fuer
GitHub-verbundene Projekte, kein weiteres Setup noetig. Da die Landing Page
mittlerweile direkt in `app.py` laeuft, ist damit auch sie automatisch
aktuell (kein separater GitHub-Pages-Schritt mehr noetig).

## Lokaler Test (bereits durchgefuehrt, zum Nachvollziehen)

```bash
# Identisch zum Railway-Startbefehl:
gunicorn app:app --bind 0.0.0.0:8080 --workers 1 --threads 4 --timeout 120

# Oder als einfacher lokaler Fallback ohne Gunicorn:
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

## Persistente Datenbank: Postgres statt SQLite

> **Status: pausiert.** Auf einem Railway-Trial-Account war weder das
> Postgres-Addon (dauerhaft im richtigen Projekt, nicht als temporaeres
> Wegwerf-Projekt) noch "Volumes" (Alternative, siehe unten) erreichbar -
> "Volumes" taucht in den Service-Settings gar nicht auf, vermutlich eine
> Trial-Einschraenkung. Braucht wahrscheinlich ein bezahltes Railway-Plan-
> Upgrade (Workspace-Settings &rarr; Plans pruefen). Der Code-Teil unten
> bleibt trotzdem gueltig/getestet - nur die Railway-seitige Einrichtung
> steht noch aus.

**Warum:** Railways Dateisystem ist standardmaessig **nicht persistent**
ueber Deploys hinweg - jeder Deploy = frischer Container, die
SQLite-Datei ist danach weg. Fuer die ersten Tests okay (Seed-Daten legen
sich automatisch neu an), aber sobald echte Beta-User/Feedback/Content
angelegt sind, gehen die bei jedem Redeploy verloren.

**Der Code ist bereits vollstaendig Postgres-faehig, ohne jede Aenderung**
(lokal mit einem echten Postgres-Server End-to-End getestet: Tabellen
anlegen, Beta-Signup, Dashboard, Admin-Uebersicht, JSON-/Enum-Spalten -
alles funktioniert identisch zu SQLite). Es fehlt nur die Railway-seitige
Einrichtung:

1. Im Railway-Projekt (selbe Umgebung wie die App): **"+ Create"** &rarr;
   **"Database"** &rarr; **"Add PostgreSQL"**. Railway legt automatisch
   einen neuen Postgres-Service mit eigener `DATABASE_URL` an.
2. Auf den App-Service wechseln &rarr; **Variables** &rarr; neue Variable
   `DATABASE_URL` anlegen und per Railway-Referenz auf den Postgres-Service
   zeigen lassen: Wert eingeben als `${{Postgres.DATABASE_URL}}` (Railway
   loest das automatisch zur echten Verbindungs-URL des Postgres-Service auf
   - exakter Referenzname steht auch direkt im Postgres-Service unter
   "Variables", meist heisst der Service "Postgres").
3. Speichern &rarr; Railway deployed die App automatisch neu. `config.py`
   nimmt `DATABASE_URL` automatisch statt der SQLite-Datei (siehe
   `config.py`: `DATABASE_URL = os.getenv("DATABASE_URL") or "sqlite:///..."`).
4. Testen: `curl https://<deine-railway-url>/health` sollte weiterhin
   `{"status":"ok",...}` liefern; in den Railway-Logs nach
   `"Keine User gefunden, lege Test-Daten an..."` suchen - das bestaetigt,
   dass die App die neue (leere) Postgres-Datenbank gefunden und befuellt
   hat.

**Achtung:** Die bisherigen SQLite-Daten (bereits angelegte Beta-Tester,
Feedback) werden dabei NICHT automatisch uebernommen - die App startet auf
Postgres mit einer frischen, geseedeten Datenbank. Bei nur ein paar
Test-Signups bisher ist das unkritisch; falls schon relevante echte
Beta-Tester-Daten drin stehen, vorher Bescheid sagen, dann bauen wir einen
kurzen Export/Import-Schritt.

## Troubleshooting

- **Healthcheck schlaegt fehl / App startet nicht:** Railway-Logs pruefen
  (Deployments &rarr; View Logs). Haeufigste Ursache: der Gunicorn-Startbefehl
  aus `railway.json` wird nicht erkannt - in Railway unter Settings pruefen,
  dass kein anderer Start-Befehl manuell ueberschrieben wurde.
- **Custom Domain zeigt nichts / Zertifikatsfehler:** DNS-Propagierung kann
  bis zu einer Stunde dauern (meist aber nur wenige Minuten bei Cloudflare).
  In Railway unter Settings &rarr; Networking pruefen, ob die Domain als
  aktiv/verifiziert markiert ist; in Cloudflare unter DNS pruefen, ob der
  CNAME-Record von Railway wirklich angelegt wurde (siehe Schritt 7).
- **SQLite-Daten verschwinden nach Redeploy:** siehe Abschnitt "Persistente
  Datenbank: Postgres statt SQLite" oben - das ist die empfohlene Loesung.
  Alternativ (nicht empfohlen, nur als Notloesung) laesst sich auch ein
  Railway-Volume auf `/app/data` mounten, um die SQLite-Datei selbst
  persistent zu machen - Postgres ist aber die robustere Wahl.
