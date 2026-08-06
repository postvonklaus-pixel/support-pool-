# Live-Deployment

**Aktueller Stand:** Landing Page, Beta-Signup, Dashboard, Admin-Uebersicht
und Webhook laufen alle als EINE Flask-App (`app.py`) auf Railway, live
unter der eigenen Domain **`https://autosocial.cc`**. Kein GitHub Pages mehr
im Spiel fuer dieses Produkt (Support Pool, die andere App in diesem Repo,
laeuft weiterhin unveraendert unter `postvonklaus-pixel.github.io/support-pool-/`
auf GitHub Pages - komplett getrennt, nicht betroffen).

**Historie (fuer's Verstaendnis, nicht mehr aktueller Weg):** Die Landing
Page lief zunaechst auf GitHub Pages (statisch, da GitHub Pages kein Python/
Flask kann), zeitweise sogar als Unterordner `ai-automation/` im selben
Branch wie Support Pool, um dessen bestehende Pages-Seite nicht zu stoeren.
Nach dem Kauf einer eigenen Domain wurde die Landing Page direkt in `app.py`
verschoben (Route `GET /`, siehe `LANDING_TEMPLATE`) - einfacher, ein
Prozess, keine Cross-Origin-Klimmzuege mehr fuer den Beta-Signup-Fetch.
`ai-automation/index.html` ist nur noch ein Redirect-Stub fuer alte Links.

---

## Backend live bringen (Beta-Signup, Dashboard, Workflow)

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

`<deine-app-url>` unten ist aktuell `https://autosocial.cc` (eigene Domain,
siehe RAILWAY_DEPLOY.md &rarr; "Custom Domain").

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

**1. Ueber die Landing Page (empfohlen, sobald das Backend live ist):**
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
| `ai-automation/index.html` | Nur noch ein Redirect-Stub zu `autosocial.cc`, fuer alte Links | GitHub Pages (unveraendert vorhanden, aber nicht mehr die aktive Landing Page) |
| `app.py` | Flask-App: Landing Page (Route `/`, siehe `LANDING_TEMPLATE`) + API + HTML-Dashboard + Admin, EINE Datei. Erledigt beim Import selbst: DB-Init, Seed (falls leer), Logging-Setup, taeglichen Scheduler starten - laeuft dadurch identisch unter Gunicorn und lokal | Jeder Python-Host (Railway, Render, VPS, ...) - live unter `autosocial.cc` |
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
- ✅ **Erledigt:** Persistente Datenbank (Postgres) statt SQLite auf Railways
  fluechtigem Dateisystem. War auf dem kostenlosen Trial-Plan nicht moeglich
  (weder Postgres-Addon noch Volumes verfuegbar) - nach Upgrade auf den
  Hobby-Plan Postgres-Service in Railway hinzugefuegt, `DATABASE_URL` beim
  "web"-Service auf `${{Postgres.DATABASE_URL}}` gesetzt. Code brauchte
  keine Aenderung (war schon vorher lokal mit echtem Postgres-Server
  End-to-End getestet, siehe `RAILWAY_DEPLOY.md`). Live bestaetigt: App
  fand nach dem Wechsel die neue, leere Postgres-DB und seedete sie
  automatisch - Daten ueberleben jetzt Redeploys.
- ✅ **Erledigt:** Echte Onboarding-Mails an beliebige Beta-Tester. Weg
  dorthin: SendGrid (Verifizierung scheiterte) → Gmail-SMTP (Railway
  blockiert ausgehende SMTP-Ports 25/587) → Resend-Sandbox (nur an eigene
  Adresse) → eigene Domain `autosocial.cc` bei Cloudflare gekauft, Railway
  Custom Domain + Resend-Domain-Verifizierung eingerichtet (beide per
  Cloudflare-Ein-Klick-Integration, keine manuellen DNS-Eintraege noetig).
  `RESEND_FROM_EMAIL=beta@autosocial.cc` gesetzt, live verifiziert:
  Beta-Signup an eine echte Fremd-Adresse kommt an. Landing Page laeuft
  jetzt ebenfalls direkt unter `https://autosocial.cc` (Flask statt
  GitHub Pages, siehe Kurzreferenz oben).
- **TODO:** Fuer echte Zahlungen: Stripe-Testmodus-Keys eintragen und
  Webhook in Stripe auf `https://<deine-app-url>/webhook` zeigen lassen
