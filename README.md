# KI-Social-Media-Automation-System

Ein vollstaendiges Python-Projekt fuer automatisiertes Social-Media-Management
mit 5 KI-Agenten, 4 Abo-Modellen (SaaS-Pricing-Tiers), Stripe-Zahlungen und
einem Streamlit-Dashboard.

> Hinweis: Dieses Repository enthaelt daneben auch eine unabhaengige
> Firebase-App ("Support Pool"). Die hier beschriebenen Python-Dateien
> (main.py, models.py, agents/, ...) bilden ein eigenstaendiges Projekt im
> Repo-Root und haben keine Abhaengigkeit zur Firebase-App.

## Inhalt

- [Abo-Modelle](#abo-modelle)
- [Setup](#setup)
- [Projekt starten](#projekt-starten)
- [CLI](#cli)
- [Dashboard](#dashboard)
- [Phase 2: Beta-Testing](#phase-2-beta-testing)
- [Stripe-Setup (Testmodus)](#stripe-setup-testmodus)
- [MOCK-Modi](#mock-modi)
- [Docker](#docker)
- [Grace-Period & Abo-Ablauf](#grace-period--abo-ablauf)
- [MRR-Tracking](#mrr-tracking)
- [Projektstruktur](#projektstruktur)

## Abo-Modelle

| Feature | Starter ($29) | Creator ($99) | Pro ($299) | Agent ($999) |
|---|---|---|---|---|
| Plattformen | 1 | 3 | 6 | 6 |
| Posts/Monat | 10 | 30 | unbegrenzt | unbegrenzt |
| Agenten | 1 (Content Creator) | 2 (+ Publisher) | 4 (+ Engagement, Analytics) | 5 (+ Growth) |
| Kurzvideos/Monat | 0 | 5 | 30 | unbegrenzt |
| Engagement | keins | Basis (Kommentare lesen) | Voll (Kommentare + DMs) | Voll + Lead-Identifikation |
| Analytics | Basis, woechentlich | Standard, taeglich | Erweitert, Echtzeit | Voll + Empfehlungen |
| Content-Kalender | nein | nein | ja | ja |
| White-Label | nein | nein | nein | ja |
| Prioritaetssupport | nein | nein | nein | ja |

Alle Limits werden strikt durchgesetzt (siehe `payment.check_plan_limits`,
`agents/base_agent.py` und `agents/publisher.py`). Bei abgelaufenem Abo hat
der User nur noch Lesezugriff - es werden keine neuen Posts erstellt oder
veroeffentlicht (siehe [Grace-Period](#grace-period--abo-ablauf)).

Daneben gibt es einen fuenften, internen Plan **Beta-Tester ($0)** mit vollem
Feature-Zugriff wie Agent - wird ausschliesslich automatisch ueber den
Beta-Signup auf der Landing Page vergeben, nicht ueber den regulaeren
Stripe-Checkout waehlbar (siehe [Phase 2: Beta-Testing](#phase-2-beta-testing)).

## Setup

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                # Werte nach Bedarf anpassen (siehe MOCK-Modi)
```

Ohne weitere Konfiguration laeuft das Projekt sofort im **MOCK-Modus** mit
einer lokalen SQLite-Datenbank (`data/app.db`) - kein Postgres, Redis oder
API-Key noetig.

## Projekt starten

```bash
python main.py
```

Das macht Folgendes:

1. Laedt alle Umgebungsvariablen aus `.env`
2. Initialisiert die Datenbank und legt automatisch 5 Test-User an, falls
   die DB leer ist (siehe `seed.py`)
3. Startet den Stripe-Webhook-Server unter `http://localhost:8080/webhook`
4. Initialisiert die 5 KI-Agenten (Content Creator, Publisher, Engagement,
   Analytics, Growth)
5. Fuehrt den taeglichen Workflow einmal sofort aus (nur fuer aktive Abos)
   und plant ihn danach taeglich um 06:00 Uhr erneut ein
6. Schreibt alle Logs nach `logs/app.log`

Mit `Ctrl+C` beenden.

## CLI

```bash
python cli.py create-user --email test@test.com --plan starter
python cli.py list-users
python cli.py generate-content --user-id 1
python cli.py show-usage --user-id 1
```

`--plan` akzeptiert: `starter`, `creator`, `pro`, `agent`.
`generate-content` unterstuetzt zusaetzlich `--platform`, `--topic` und
`--content-type` (`post`, `carousel`, `video` - abhaengig vom Plan des Users).

## Dashboard

```bash
streamlit run dashboard.py
```

Login mit einem der Seed-User (siehe unten), z.B.:

- E-Mail: `user_pro@test.com`
- Passwort: `testpassword123`

Das Dashboard zeigt Plan, Verbrauch vs. Limits, Content-Uebersicht,
Analytics-Charts sowie Plan-Upgrade/-Downgrade inkl. (Mock-)Stripe-Checkout.

### Test-User (automatisch geseedet)

| E-Mail | Plan | Status |
|---|---|---|
| user_starter@test.com | Starter | aktiv |
| user_creator@test.com | Creator | aktiv |
| user_pro@test.com | Pro | aktiv |
| user_agent@test.com | Agent | aktiv |
| user_expired@test.com | Starter | abgelaufen (nur Lesezugriff) |

Passwort fuer alle Seed-User: `testpassword123`.
Manuelles Neu-Seeden: `python seed.py`.

## Phase 2: Beta-Testing

Sobald `python main.py` laeuft, ist zusaetzlich verfuegbar:

- **Landing Page**: Quelle liegt unter [`ai-automation/index.html`](ai-automation/index.html)
  (live auf GitHub Pages, siehe `DEPLOY.md`) - stellt die 4 Abo-Modelle vor
  und hat ein Beta-Access-Formular. `http://localhost:8080/` leitet dorthin
  weiter; die Beta-Signup-API selbst laeuft immer lokal unter `POST /beta-signup`.
- **Beta-Tester-Plan**: kostenlos, voller Feature-Zugriff (wie Agent-Plan).
  Wird automatisch bei Signup ueber die Landing Page vergeben
  (`beta.create_beta_user()`), inkl. Onboarding-Mail und einem
  automatisch erstellten Beispiel-Post.
- **Feedback-System**: Tab "Feedback geben" im Kunden-Dashboard
  (`dashboard.py`); Uebersicht per `python cli.py list-feedback`.
- **Admin-Dashboard** (separat, kein Login noetig - nur lokal starten):
  ```bash
  streamlit run admin_dashboard.py --server.port 8502
  ```
  Zeigt MRR, das 90-Tage-Wachstumsziel (`mrr.mrr_goal_progress()`,
  konfigurierbar ueber `MRR_GOAL_*` in `.env`), Beta-Tester-Aktivitaet
  (Signup-Datum, letzter Login, erstellte Posts) und alle Feedback-Eintraege.
- **Weitere Dokumente**:
  - [`docs/BETA_MARKETING_PLAN.md`](docs/BETA_MARKETING_PLAN.md) - Zielgruppen,
    5 LinkedIn- + 5 Twitter/X-Posts, 3 E-Mail-Vorlagen fuer die ersten 10 Beta-User
  - [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) - 3 Deployment-Optionen mit
    Kosten/Schritten (DigitalOcean, Railway/Render, eigener VPS);
    `./deploy.sh check` validiert lokal den Docker-Build, ohne etwas zu deployen
  - [`docs/ROADMAP_7_DAYS.md`](docs/ROADMAP_7_DAYS.md) - konkreter 7-Tage-Plan
    mit Risiken/Gegenmassnahmen fuer den Beta-Launch

## Stripe-Setup (Testmodus)

Das System laeuft standardmaessig im **MOCK_STRIPE**-Modus (kein API-Call).
Fuer echte Tests im Stripe-Testmodus:

1. Stripe-Account erstellen, **Testmodus** aktivieren.
2. Test-Secret-Key kopieren (`sk_test_...`) nach `.env` -> `STRIPE_SECRET_KEY`.
3. [Stripe CLI](https://stripe.com/docs/stripe-cli) installieren und lokal
   Webhooks weiterleiten:
   ```bash
   stripe login
   stripe listen --forward-to localhost:8080/webhook
   ```
   Die CLI gibt einen `whsec_...` Webhook-Secret aus -> in `.env` als
   `STRIPE_WEBHOOK_SECRET` eintragen.
4. Testzahlungen mit den [Stripe-Testkarten](https://stripe.com/docs/testing)
   ausloesen, z.B. `4242 4242 4242 4242` fuer Erfolg oder
   `4000 0000 0000 0341` fuer eine fehlschlagende Zahlung (loest die
   Grace-Period aus).

`docker-compose.yml` enthaelt optional den Service `stripe-webhook-listener`
(offizielles `stripe/stripe-cli`-Image), der dasselbe automatisiert.

## MOCK-Modi

Jeder externe Service laeuft automatisch im Mock-Modus, solange der
zugehoerige API-Key in `.env` fehlt oder einen Platzhalterwert
(`dein_..._hier`) enthaelt. Das steuert `config.py` (`MOCK_*`-Flags):

| Service | Mock-Flag | Verhalten im Mock-Modus |
|---|---|---|
| OpenAI (Text) | `MOCK_OPENAI` | Generiert Platzhalter-Text statt echtem LLM-Call |
| Replicate (Bilder) | `MOCK_REPLICATE` | Gibt Fake-CDN-URLs zurueck statt echtem Bild |
| Buffer (Veroeffentlichen) | `MOCK_BUFFER` | Simuliert erfolgreiches Posting, kein echter API-Call |
| Stripe (Zahlungen) | `MOCK_STRIPE` | Erstellt Fake-Checkout-Sessions, verbucht direkt in der DB |
| Pinecone (Vektor-DB) | `MOCK_PINECONE` | Reserviert fuer zukuenftiges Retrieval, aktuell ungenutzt |
| SendGrid (E-Mail) | `MOCK_SENDGRID` | Loggt die E-Mail nach `logs/app.log` statt sie zu versenden |

Alle mock-relevanten Stellen sind im Code mit `TODO`-Kommentaren markiert
(z.B. `agents/content_creator.py`, `agents/publisher.py`, `payment.py`,
`email_service.py`).

## Docker

```bash
docker compose up --build postgres redis app dashboard
```

Startet Postgres, Redis, den App-Service (Webhook-Server + Workflow) und das
Streamlit-Dashboard (`http://localhost:8501`). Der optionale
`stripe-webhook-listener`-Service benoetigt einen echten `STRIPE_SECRET_KEY`.

## Grace-Period & Abo-Ablauf

Bei fehlgeschlagener Zahlung (`invoice.payment_failed`) wird der User auf
`past_due` gesetzt und erhaelt eine **7-Tage-Grace-Period**
(`GRACE_PERIOD_DAYS` in `.env`), waehrend der die Agenten weiterlaufen. Der
taegliche Workflow (`workflow.py`) prueft bei jedem Lauf, ob die
Grace-Period abgelaufen ist:

- **Innerhalb** der Grace-Period: Agenten laufen normal weiter.
- **Nach Ablauf**: Status wechselt zu `expired`, Agenten werden deaktiviert
  (nur Lesezugriff, `User.is_read_only()` liefert `True`), eine
  Benachrichtigung wird per E-Mail versendet.

## MRR-Tracking

`mrr.py` berechnet taeglich:

```
MRR = (User_Starter * 29) + (User_Creator * 99) + (User_Pro * 299) + (User_Agent * 999)
```

Nur User mit Status `active`, `trialing` oder `past_due` (Grace-Period)
zaehlen zum MRR. Das Monatsziel (`MRR_TARGET_MONTHLY` in `.env`) wird linear
auf die Tage des Monats umgelegt; liegt der aktuelle MRR darunter, wird ein
Alarm geloggt (`logs/app.log`, Level `WARNING`). Der Report ist Teil jedes
`daily_workflow()`-Laufs.

## Projektstruktur

```
.
├── main.py                 # Einstiegspunkt: DB, Webhook-Server, Agenten, Scheduler
├── config.py                # Env-Variablen, Pricing-Tiers, Mock-Flags
├── models.py                 # SQLAlchemy-Modelle (User, Content, Analytics, Payment)
├── db.py                     # Engine/Session-Handling
├── auth.py                   # Passwort-Hashing
├── payment.py                 # Stripe-Integration (Checkout, Webhooks, Upgrades, Limits)
├── email_service.py           # SendGrid-E-Mails (mock-faehig)
├── workflow.py                 # Taeglicher Workflow (nur aktive Abos)
├── mrr.py                     # MRR-Berechnung & Alarm
├── seed.py                    # 5 Test-User anlegen
├── cli.py                     # Kommandozeilen-Tool
├── dashboard.py                # Streamlit-Dashboard
├── logging_config.py           # Logging-Setup
├── agents/
│   ├── base_agent.py            # Basis-Klasse mit Plan-Zugriffspruefung
│   ├── content_creator.py        # Text/Bild/Carousel/Video-Skript-Generierung
│   ├── publisher.py               # Veroeffentlichung + Limit-Durchsetzung
│   ├── engagement.py               # Kommentare/DMs, Lead-Identifikation
│   ├── analytics.py                 # Taegliche Kennzahlen & Reports
│   └── growth.py                     # Nur Agent-Plan: Follower/Konkurrenz/Strategie
├── requirements.txt
├── .env.example
├── docker-compose.yml
└── Dockerfile
```
