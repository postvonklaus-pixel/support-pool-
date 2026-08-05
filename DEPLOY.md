# Live-Deployment

Kurz vorweg, weil es fuer alles Folgende wichtig ist:

> **GitHub Pages kann nur statische Dateien ausliefern** (HTML/CSS/JS) - kein
> Python, kein Flask, keine Datenbank, keine Server-Logik. Das ist keine
> Konfigurationsfrage, sondern eine harte Plattform-Grenze von GitHub Pages.
>
> Das heisst konkret:
> - Die **Landing Page** (`static/landing.html`) kann direkt auf GitHub
>   Pages live gehen - das deckt Schritt A unten ab.
> - Das **Python-Backend** (`app.py` / `production.py` mit Beta-Signup,
>   Dashboard, Workflow) kann NICHT auf GitHub Pages laufen. Dafuer brauchst
>   du einen echten Compute-Host - Schritt B unten zeigt den schnellsten
>   Weg dahin, weiterhin kostenlos, weiterhin ohne echte API-Keys.

---

## Schritt A: Landing Page auf GitHub Pages (rein GitHub, $0)

### 1. Einmalig: GitHub Pages aktivieren

Das kann nur im Repo selbst per Klick gemacht werden (keine API dafuer
verfuegbar) - **einmalig, dauert 10 Sekunden:**

1. Im Repo auf GitHub: **Settings** &rarr; **Pages** (linkes Menu, unter "Code and automation")
2. Bei **"Build and deployment"** &rarr; **Source**: `GitHub Actions` auswaehlen
   (NICHT "Deploy from a branch")
3. Fertig - nichts speichern/bestaetigen noetig, die Auswahl greift sofort.

> **Falls dieses Repo vorher schon eine GitHub-Pages-Seite hatte** (z.B. weil
> hier bereits eine andere App lag): Der Schritt oben ist dann nicht
> optional, sondern zwingend zu pruefen. Steht Source noch auf "Deploy from
> a branch", liefert GitHub bei jedem Push auf `main` automatisch den
> kompletten Root-Inhalt von `main` aus (die alte Seite) und ueberschreibt
> damit stillschweigend jeden erfolgreichen Deploy dieses Workflows - der
> Workflow selbst meldet trotzdem "success", das Ergebnis ist aber die
> falsche Seite. Symptom: Die Pages-URL zeigt die alte/falsche Seite, obwohl
> der Actions-Run gruen ist. Fix: wie oben, Source auf "GitHub Actions"
> umstellen, danach einmal per Push (oder Actions -&gt; "Run workflow")
> neu deployen.

### 2. Workflow ausloesen

Der Workflow `.github/workflows/deploy.yml` deployed `static/landing.html`
als `index.html` zu GitHub Pages:
- **Automatisch** bei jedem Push auf `main`
- **Manuell** jederzeit ueber: Repo &rarr; **Actions** &rarr; "Deploy Landing
  Page to GitHub Pages" &rarr; **Run workflow**

### 3. Live-URL bekommen

Nach dem ersten erfolgreichen Workflow-Lauf (gruener Haken) erscheint die
URL an zwei Stellen:
- Im Workflow-Run selbst, unter dem Job "deploy" &rarr; Feld "Deploy to
  GitHub Pages" zeigt die URL
- In den Repo-**Settings &rarr; Pages** oben ("Your site is live at ...")

Das Muster fuer Projekt-Repos ist immer:
```
https://<dein-github-username>.github.io/<repo-name>/
```

### 4. Testen

```bash
curl -I https://<dein-github-username>.github.io/<repo-name>/
# Erwartet: HTTP/2 200
```

Oder einfach im Browser oeffnen - das Beta-Formular auf der Seite selbst
funktioniert dort aber **nicht** (es ruft `/beta-signup` auf, das es auf
GitHub Pages nicht gibt - siehe Schritt B).

---

## Schritt B: Backend live bringen (Beta-Signup, Dashboard, Workflow)

Braucht einen echten Host. Schnellster kostenloser Weg (Details/Alternativen
in `docs/DEPLOYMENT.md`):

### Railway oder Render (empfohlen, $0 zum Start)

1. Auf [railway.app](https://railway.app) oder [render.com](https://render.com)
   mit GitHub einloggen, dieses Repo verbinden
2. Start-Befehl: `python production.py` (steht auch im `Procfile`, wird von
   beiden Plattformen automatisch erkannt)
3. Umgebungsvariablen: **keine zwingend noetig** - `production.py` laeuft
   automatisch im Mock-Modus mit SQLite. Optional aus `.env.example`
   uebernehmen, wenn du z.B. echte E-Mails willst.
4. `PORT` setzt die Plattform automatisch (production.py liest das automatisch,
   siehe `config.py`)
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
Konsolen-Ausgabe von `python production.py`.

---

## Kurzreferenz: Was laeuft wo

| Datei | Zweck | Wo lauffaehig |
|---|---|---|
| `static/landing.html` | Marketing-Landing-Page | GitHub Pages, oder jeder Static-Host |
| `app.py` | Flask-App: Landing Page + API + HTML-Dashboard, EINE Datei | Jeder Python-Host (Railway, Render, VPS, ...) - NICHT GitHub Pages |
| `production.py` | Start-Befehl fuer `app.py` inkl. DB-Init, Seed, taeglichem Workflow | s.o. |
| `main.py` + `dashboard.py` + `admin_dashboard.py` | Voller lokaler Dev-Modus mit Streamlit-Dashboards (Charts etc.) | Nur lokal / eigener Host, nicht als "ein Prozess" gedacht |

`app.py`/`production.py` sind die schlanke Production-Variante (ein Prozess,
ein Port, kein Streamlit) - fuer lokale Entwicklung mit vollem
Funktionsumfang bleibt `main.py` die bessere Wahl (siehe Haupt-README).

## Naechste Schritte fuer echten Live-Betrieb

- **TODO:** Flask-Dev-Server durch einen WSGI-Server ersetzen:
  `gunicorn app:app --bind 0.0.0.0:$PORT` (ist bereits in `requirements.txt`
  enthalten). Der eingebaute Server warnt selbst: "Do not use it in a
  production deployment."
- **TODO:** Fuer mehr als ein paar Test-User: SendGrid-Key eintragen, damit
  Onboarding-Mails wirklich verschickt werden (siehe README &rarr; MOCK-Modi)
- **TODO:** Fuer echte Zahlungen: Stripe-Testmodus-Keys eintragen und
  Webhook in Stripe auf `https://<deine-app-url>/webhook` zeigen lassen
