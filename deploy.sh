#!/usr/bin/env bash
# Deployment-Vorbereitungs-Skript.
#
# Fuehrt KEIN echtes Deployment aus und verursacht KEINE Kosten - es
# validiert nur lokal, dass alles bereit ist, und zeigt die naechsten
# Schritte je nach Ziel-Plattform (siehe docs/DEPLOYMENT.md fuer Details
# und Kostenschaetzungen).
#
# Verwendung:
#   ./deploy.sh check              - lokalen Docker-Build validieren
#   ./deploy.sh digitalocean        - Schritte fuer DigitalOcean App Platform
#   ./deploy.sh railway             - Schritte fuer Railway/Render
#   ./deploy.sh vps                 - Schritte fuer eigenen VPS + Docker

set -euo pipefail

CMD="${1:-check}"

check_build() {
  echo "==> Pruefe, ob Docker verfuegbar ist..."
  if ! command -v docker &> /dev/null; then
    echo "!! Docker ist hier nicht installiert/verfuegbar."
    echo "   Das ist kein Problem fuer die lokale Mock-Entwicklung (python main.py"
    echo "   laeuft ohne Docker) - fuer ein echtes Deployment brauchst du Docker"
    echo "   entweder lokal zum Testen oder auf der Ziel-Plattform."
    return 0
  fi

  if ! docker info &> /dev/null; then
    echo "!! Docker-CLI ist installiert, aber der Docker-Daemon laeuft hier nicht"
    echo "   (z.B. weil du in einer Sandbox/CI-Umgebung ohne Docker-Daemon bist)."
    echo "   Fuehre './deploy.sh check' stattdessen auf deinem lokalen Rechner aus,"
    echo "   dort wo Docker Desktop/Engine laeuft, um den Build zu validieren."
    return 0
  fi

  echo "==> Baue Docker-Image lokal (nur Validierung, kein Push, keine Kosten)..."
  docker build -t social-media-automation:local-check .
  echo "==> Docker-Build erfolgreich. Image: social-media-automation:local-check"
  echo "    Lokal testen mit:"
  echo "    docker compose up --build postgres redis app dashboard"
}

case "$CMD" in
  check)
    check_build
    ;;
  digitalocean)
    check_build
    cat <<'EOF'

==> Naechste Schritte: DigitalOcean App Platform
   1. Repo ist bereits auf GitHub gepusht (Branch pruefen: git branch --show-current)
   2. In DigitalOcean: "Create App" -> GitHub-Repo verbinden -> Branch waehlen
   3. App Platform erkennt das Dockerfile automatisch
   4. Env-Variablen aus .env.example eintragen (echte Werte!)
   5. Managed Postgres-Add-on hinzufuegen, DATABASE_URL verlinken
   6. Deploy ausloesen

   Kosten: ~$20-30/Monat (App + kleinste Postgres-Stufe). Details: docs/DEPLOYMENT.md
   TODO vor Live-Gang: main.py nutzt noch den Flask-Dev-Server - fuer Produktion
   auf Gunicorn umstellen.
EOF
    ;;
  railway)
    check_build
    cat <<'EOF'

==> Naechste Schritte: Railway / Render (kostenloser Start)
   1. Auf railway.app (oder render.com) mit GitHub einloggen
   2. Repo verbinden - Dockerfile wird automatisch erkannt
   3. Postgres-Plugin/Add-on hinzufuegen (DATABASE_URL wird meist automatisch gesetzt)
   4. Restliche .env-Variablen im Dashboard eintragen
   5. Deploy starten - oeffentliche URL wird automatisch vergeben

   Kosten: $0 zum Start (Free-Tier-Limits beachten). Details: docs/DEPLOYMENT.md
   Hinweis: Render Free-Tier schlaeft nach Inaktivitaet ein (Kaltstart-Delay).
EOF
    ;;
  vps)
    check_build
    cat <<'EOF'

==> Naechste Schritte: Eigener VPS + Docker
   1. VPS mieten (z.B. Hetzner CX22, ~$4-6/Monat), Docker + Compose installieren
   2. git clone <repo-url> && cd support-pool-
   3. .env mit echten Werten anlegen
   4. docker compose up --build -d postgres redis app dashboard
   5. Reverse-Proxy (Caddy/nginx) fuer HTTPS vorschalten (TODO, nicht im Repo)
   6. Firewall: nur 80/443 (+22 fuer SSH) oeffentlich freigeben

   Kosten: ~$5/Monat (VPS). Details: docs/DEPLOYMENT.md
EOF
    ;;
  *)
    echo "Unbekannter Befehl: $CMD"
    echo "Verwendung: ./deploy.sh [check|digitalocean|railway|vps]"
    exit 1
    ;;
esac
