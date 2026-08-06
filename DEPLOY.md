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
| `ai-automation/index.html` | Marketing-Landing-Page | GitHub Pages (Unterpfad, siehe Schritt A), oder jeder Static-Host |
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
