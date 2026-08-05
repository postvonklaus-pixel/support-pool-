# Deployment-Vorbereitung

**Wichtig:** Nichts hiervon ist bereits deployt oder kostet aktuell etwas.
Dies ist eine Vorbereitung/Anleitung fuer den Schritt, wenn du bereit bist,
die Beta oeffentlich erreichbar zu machen. Bis dahin laeuft alles lokal im
Mock-Modus (siehe Haupt-README).

Vor jedem der drei Wege: pruefe lokal, dass der Docker-Build funktioniert
(`./deploy.sh check`, siehe unten) - das deckt die meisten Ueberraschungen
vorab ab, ohne dass du dafuer zahlst.

## Kurzvergleich

| | DigitalOcean App Platform | Railway / Render (Free-Tier) | Eigener VPS + Docker |
|---|---|---|---|
| **Aufwand** | niedrig | sehr niedrig | mittel-hoch |
| **Kosten/Monat (Start)** | ~$12-25 | $0 (mit Limits) | ~$4-6 (VPS) |
| **Skaliert automatisch** | ja | begrenzt (Free-Tier) | nein (manuell) |
| **Postgres/Redis inklusive** | als Managed Add-on ($) | als Add-on (teilw. kostenlos) | selbst betreiben (Docker) |
| **Kontrolle** | mittel | niedrig | voll |
| **Empfehlung fuer** | "wir zahlen, wollen's einfach" | Beta/Prototyp, 0 Budget | technisch fit, volle Kontrolle |

---

## Option A: DigitalOcean App Platform (einfach)

**Fuer:** Wer schnell live gehen will und ein kleines, planbares Budget hat.

**Kosten (Stand grobe Richtwerte, bei Deployment pruefen):**
- App (Basic, 1 Instanz): ab ~$5-12/Monat
- Managed Postgres (kleinste Stufe): ab ~$15/Monat
- Redis: optional, ~$15/Monat falls benoetigt (fuer den aktuellen Code-Stand
  nicht zwingend, da REDIS_URL noch ungenutzt ist - siehe TODO in `config.py`)
- **Realistische Startgroesse: ~$20-30/Monat** (App + Postgres, ohne Redis)

**Schritte:**
1. Code-Repo zu GitHub pushen (bereits erledigt: Branch ist gepusht).
2. In DigitalOcean: "Create App" -> GitHub-Repo verbinden -> Branch waehlen.
3. Als Build-Methode den vorhandenen `Dockerfile` erkennen lassen (App
   Platform liest ihn automatisch).
4. Environment-Variablen aus `.env.example` in der App-Konfiguration
   eintragen (echte Keys statt Platzhalter - siehe README "MOCK-Modi").
5. Managed Postgres-Datenbank als Add-on hinzufuegen, `DATABASE_URL`
   automatisch verlinken lassen (DO setzt das meist automatisch).
6. Deploy ausloesen. App Platform baut das Dockerfile und startet
   `python main.py` als Web-Service.
7. **TODO vor echtem Live-Gang:** `main.py` nutzt aktuell den eingebauten
   Flask-Dev-Server (`app.run(...)`) - fuer Produktion durch Gunicorn/
   uWSGI ersetzen (siehe Warnung im main.py-Log: "Do not use it in a
   production deployment").

---

## Option B: Railway / Render (kostenlos, einfach)

**Fuer:** Beta-Phase mit 0 Budget, kleiner Nutzerzahl, Testbetrieb.

**Kosten:**
- Railway: Free-Tier mit monatlichem Nutzungs-Guthaben (aktuelle Limits vor
  Nutzung auf railway.app pruefen, aendern sich regelmaessig).
- Render: kostenloser Web-Service-Tier verfuegbar, **schlaeft nach
  Inaktivitaet ein** (erster Request nach Pause dauert dann laenger) -
  fuer eine Beta mit wenigen Testern meist akzeptabel.
- Postgres: beide bieten kleine kostenlose/guenstige Datenbank-Optionen an.
- **Realistische Startgroesse: $0/Monat**, mit dem Risiko von
  Kaltstart-Verzoegerungen und Nutzungs-Limits.

**Schritte (Railway, Render ist sehr aehnlich):**
1. Bei railway.app mit GitHub einloggen, Repo verbinden.
2. Railway erkennt den `Dockerfile` automatisch.
3. Postgres-Plugin aus dem Railway-Marketplace hinzufuegen -> `DATABASE_URL`
   wird automatisch als Umgebungsvariable injiziert.
4. Restliche `.env`-Variablen manuell im Railway-Dashboard eintragen.
5. Deploy starten, oeffentliche URL wird automatisch vergeben.
6. Gleiches TODO wie bei Option A: Dev-Server vor echtem Traffic durch
   Gunicorn ersetzen.

---

## Option C: Eigener VPS mit Docker (volle Kontrolle)

**Fuer:** Wer technisch fit ist und volle Kontrolle/niedrigste Grundkosten will.

**Kosten:**
- Kleiner VPS (Hetzner CX22, DigitalOcean Droplet o.ae.): ~$4-6/Monat
- Domain (optional, falls gewuenscht): ~$10-15/Jahr
- Alles andere (Postgres, Redis) laeuft im selben `docker-compose.yml` mit,
  keine zusaetzlichen Kosten.
- **Realistische Startgroesse: ~$5/Monat**

**Schritte:**
1. VPS mieten, Docker + Docker Compose installieren.
2. Repo klonen: `git clone <repo-url> && cd support-pool-`
3. `.env` mit echten Werten anlegen (siehe `.env.example`).
4. `docker compose up --build -d postgres redis app dashboard`
5. Reverse-Proxy (z.B. Caddy oder nginx) fuer HTTPS/Domain vorschalten -
   **TODO**: aktuell nicht im Repo enthalten, da explizit "keine Domain/SSL"
   fuer die jetzige Phase gewuenscht war.
6. Firewall: nur Ports 80/443 (und ggf. 22 fuer SSH) oeffentlich freigeben,
   4242/8501/8502 nicht direkt exponieren, sondern nur ueber den Proxy.

---

## Empfehlung fuer den aktuellen Stand (Beta, 0-10 User)

**Option B (Railway/Render, kostenlos)** fuer den ersten oeffentlichen
Beta-Test - kein Risiko, kein Budget noetig, in unter 30 Minuten live.
Wenn die Beta waechst (>10-20 aktive User oder Kaltstart-Verzoegerungen
stoeren), Wechsel zu Option A oder C.

## Deployment-Skript

`deploy.sh` im Projekt-Root validiert lokal, dass der Docker-Build
funktioniert (`docker build .`), und druckt die naechsten Schritte fuer die
gewaehlte Plattform aus. Es fuehrt **kein echtes Deployment aus** und
verursacht keine Kosten - siehe Kommentare im Skript.
