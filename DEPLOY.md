# Live-Deployment

Kurz vorweg, weil es fuer alles Folgende wichtig ist:

> **GitHub Pages kann nur statische Dateien ausliefern** (HTML/CSS/JS) - kein
> Python, kein Flask, keine Datenbank, keine Server-Logik. Das ist keine
> Konfigurationsfrage, sondern eine harte Plattform-Grenze von GitHub Pages.
>
> Das heisst konkret:
> - Die **Landing Page** (`ai-automation/index.html`) kann direkt auf GitHub
>   Pages live gehen - das deckt Schritt A unten ab.
> - Das **Python-Backend** (`app.py` / `production.py` mit Beta-Signup,
>   Dashboard, Workflow) kann NICHT auf GitHub Pages laufen. Dafuer brauchst
>   du einen echten Compute-Host - Schritt B unten zeigt den schnellsten
>   Weg dahin, weiterhin kostenlos, weiterhin ohne echte API-Keys.

---

## Schritt A: Landing Page auf GitHub Pages (rein GitHub, $0)

**Historie/wichtig:** Dieses Repo hatte bereits vor diesem Projekt eine
eigene GitHub-Pages-Seite (eine andere, bestehende App unter dem Repo-Root
`index.html`, Pages-Source "Deploy from a branch"). Ein frueherer Versuch,
die Landing Page per eigenem GitHub-Actions-Workflow direkt auf den Root zu
deployen, ist deshalb wiederholt fehlgeschlagen: der Actions-Workflow hat
den Root ueberschrieben, aber die Legacy-Branch-Pipeline hat ihn bei jedem
Push kurz danach wieder mit der alten Seite ueberschrieben (Race
Condition) - und die Root-`index.html` gehoert ohnehin der anderen App,
sie durfte gar nicht angefasst werden.

**Loesung:** Die Landing Page liegt stattdessen als eigener Unterordner
direkt im Branch: [`ai-automation/index.html`](ai-automation/index.html).
Da GitHub Pages im Legacy-Branch-Modus den kompletten Branch-Inhalt 1:1
ausliefert, wird dieser Unterordner automatisch mitpubliziert - **ohne
jeden weiteren Schritt, ohne Settings-Aenderung, ohne Workflow, ohne
Race-Condition-Risiko fuer die bestehende App.** Jeder Push auf `main`
aktualisiert die Seite automatisch (GitHub's eingebauter Pages-Mechanismus,
kein eigener Workflow mehr noetig).

### 1. Live-URL

```
https://postvonklaus-pixel.github.io/support-pool-/ai-automation/
```

(Root `https://postvonklaus-pixel.github.io/support-pool-/` bleibt
unveraendert die bestehende App.)

### 2. Testen

```bash
curl -I https://postvonklaus-pixel.github.io/support-pool-/ai-automation/
# Erwartet: HTTP/2 200
```

Oder einfach im Browser oeffnen - das Beta-Formular auf der Seite selbst
funktioniert dort aber **nicht von allein**, solange kein Backend
deployed ist (es ruft `/beta-signup` auf, das es auf GitHub Pages nicht
gibt - siehe Schritt B).

---

## Schritt B: Backend live bringen (Beta-Signup, Dashboard, Workflow)

Braucht einen echten Host. Schnellster kostenloser Weg (Details/Alternativen
in `docs/DEPLOYMENT.md`):

### Railway oder Render (empfohlen, $0 zum Start)

1. Auf [railway.app](https://railway.app) oder [render.com](https://render.com)
   mit GitHub einloggen, dieses Repo verbinden
2. Start-Befehl: `gunicorn app:app --bind 0.0.0.0:$PORT --workers 1 --threads 4
   --timeout 120` (steht auch im `Procfile` bzw. `railway.json`, wird von
   beiden Plattformen automatisch erkannt) - echter WSGI-Server statt Flask-
   Dev-Server, DB-Init/Seed/taeglicher Workflow laufen dabei automatisch beim
   Start von `app.py` mit (siehe Kurzreferenz unten)
3. Umgebungsvariablen: **keine zwingend noetig** - laeuft automatisch im
   Mock-Modus mit SQLite. Optional aus `.env.example` uebernehmen, wenn du
   z.B. echte E-Mails willst.
4. `PORT` setzt die Plattform automatisch, Gunicorn bindet direkt darauf
5. Deploy ausloesen - die Plattform vergibt automatisch eine oeffentliche URL
   (z.B. `https://dein-projekt.up.railway.app`)

### Testen

```bash
curl https://<deine-app-url>/health
# Erwartet: {"status": "ok", "mock_stripe": true}

curl -X POST https://<deine-app-url>/beta-signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
# Erwartet: {"status": "created", "user_id": ..., "email": "test@example.com", "example_content_id": ...}
```

Dashboard: `https://<deine-app-url>/dashboard` im Browser oeffnen, mit
`user_pro@test.com` / `testpassword123` einloggen (oder dem gerade
angelegten Beta-User - Passwort steht im Server-Log der Plattform, da im
Mock-Modus keine echte Mail verschickt wird, siehe unten).

Frisch registrierte Beta-Tester sehen zunaechst nur den einen automatisch
erzeugten Beispiel-Post, da die volle Agenten-Pipeline (Post erstellen +
veroeffentlichen + Kommentare/DMs beantworten + Analytics-Report +
Wachstumsstrategie) normalerweise nur einmal taeglich fuer alle User
gemeinsam laeuft (06:00 Uhr). Im Dashboard gibt es dafuer den Button
"🔄 Neue Beispiel-Aktivitaet generieren" - stoesst denselben Durchlauf
sofort nur fuer den eingeloggten User an, damit man ohne Wartezeit direkt
etwas zum Testen hat.

**Admin-Uebersicht** (MRR, Wachstumsziel, Beta-Tester-Aktivitaet, Feedback):
`https://<deine-app-url>/admin` im Browser oeffnen, mit dem `ADMIN_PASSWORD`
einloggen. **WICHTIG:** Auf der Deployment-Plattform (z.B. Railway) unbedingt
im Variables-Tab eine echte `ADMIN_PASSWORD` setzen - der Code-Default
`changeme-admin` ist nur fuer lokale Tests gedacht und unsicher, wenn er live
stehen bleibt.

---

## Beta-User hinzufuegen

Drei Wege, je nachdem wo das Backend laeuft:

**1. Ueber die Landing Page (empfohlen, sobald Schritt B live ist):**
Landing Page &rarr; Formular am Ende &rarr; E-Mail eingeben &rarr;
"Beta Access anfordern". Legt automatisch einen User mit dem kostenlosen
Beta-Tester-Plan an (voller Feature-Zugriff) und erstellt einen
Beispiel-Post.

**2. Direkt per API-Call** (lokal oder gegen die deployte URL):
```bash
curl -X POST http://localhost:8080/beta-signup \
  -H "Content-Type: application/json" \
  -d '{"email":"neuer.beta.user@firma.de"}'
```

**3. Per CLI** (nur lokal, mit direktem DB-Zugriff):
```bash
python cli.py create-user --email neuer.beta.user@firma.de --plan agent
```
(Erstellt technisch einen Agent-Plan-User statt "beta" - fuer echtes
Beta-Onboarding inkl. Willkommens-Mail und Beispiel-Content lieber Weg 1
oder 2 nutzen.)

**Temporaeres Passwort finden:** Im Mock-Modus (Standard) wird die
Onboarding-Mail nicht wirklich verschickt, sondern nur geloggt. Auf der
Deployment-Plattform in den Logs nach `[MOCK-EMAIL]` suchen, dort steht das
temporaere Passwort. Lokal steht es in `logs/app.log` bzw. in der
Konsolen-Ausgabe von `python production.py` (lokaler Fallback ohne
Gunicorn).

---

## Kurzreferenz: Was laeuft wo

| Datei | Zweck | Wo lauffaehig |
|---|---|---|
| `ai-automation/index.html` | Marketing-Landing-Page | GitHub Pages (Unterpfad, siehe Schritt A), oder jeder Static-Host |
| `app.py` | Flask-App: Landing Page + API + HTML-Dashboard, EINE Datei. Erledigt beim Import selbst: DB-Init, Seed (falls leer), Logging-Setup, taeglichen Scheduler starten - laeuft dadurch identisch unter Gunicorn und lokal | Jeder Python-Host (Railway, Render, VPS, ...) - NICHT GitHub Pages |
| `production.py` | Duenner lokaler Fallback ohne Gunicorn (`python production.py`) - fuer den echten Deploy nicht mehr noetig, siehe Gunicorn-Startbefehl oben | Nur lokal |
| `main.py` + `dashboard.py` + `admin_dashboard.py` | Voller lokaler Dev-Modus mit Streamlit-Dashboards (Charts etc.) | Nur lokal / eigener Host, nicht als "ein Prozess" gedacht |

`app.py` (per Gunicorn gestartet) ist die schlanke Production-Variante (ein
Prozess, ein Port, kein Streamlit) - fuer lokale Entwicklung mit vollem
Funktionsumfang bleibt `main.py` die bessere Wahl (siehe Haupt-README).

**Hinweis zum Neustart-Verhalten:** Der taegliche Agenten-Workflow laeuft nur
noch nach Zeitplan (06:00 Uhr), nicht mehr automatisch bei jedem Server-Start/
-Neustart - bei echten Beta-Nutzern soll ein Redeploy nicht jedes Mal die
volle Pipeline fuer alle User neu anstossen. Fuer sofortige Test-Aktivitaet
nach einem Signup gibt es den "🔄 Neue Beispiel-Aktivitaet generieren"-Button
im Dashboard.

## Naechste Schritte fuer echten Live-Betrieb

- ✅ **Erledigt:** Flask-Dev-Server durch Gunicorn (WSGI-Server) ersetzt.
- **PAUSIERT (Railway-Trial-Limit):** Persistente Datenbank (Postgres) statt
  SQLite auf Railways fluechtigem Dateisystem - Code ist bereits vollstaendig
  Postgres-faehig (lokal mit echtem Postgres-Server End-to-End getestet,
  keine Aenderung noetig, siehe `RAILWAY_DEPLOY.md`). Sowohl das
  Postgres-Addon als dauerhafter Service als auch Volumes (Alternative fuer
  persistente SQLite-Datei) waren im Railway-Trial-Plan nicht verfuegbar
  ("Volumes" taucht in den Service-Settings gar nicht erst auf). Erfordert
  vermutlich ein Upgrade auf einen bezahlten Railway-Plan (ab ca. $5/Monat,
  Workspace-Settings &rarr; Plans pruefen) - bewusste Kostenentscheidung des
  Users, daher aktuell zurueckgestellt. Bis dahin: SQLite-Daten (Beta-Tester,
  Feedback, Content) gehen bei jedem Redeploy verloren; fuer die aktuelle
  Beta-Phase mit wenigen Signups tragbar.
- **Code-seitig fertig, dein Schritt fehlt noch:** Echte Onboarding-Mails
  via Gmail-SMTP statt SendGrid (Umstieg wegen SendGrid-Verifizierungs-
  problemen) - `SMTP_USERNAME`/`SMTP_PASSWORD` (Gmail-App-Passwort, siehe
  `.env.example`) in Railway Variables setzen.
- **TODO:** Fuer echte Zahlungen: Stripe-Testmodus-Keys eintragen und
  Webhook in Stripe auf `https://<deine-app-url>/webhook` zeigen lassen
