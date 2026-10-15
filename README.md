# support-pool-
Support Pool Premium App

---

## Cloud Functions Setup

### Voraussetzungen
- Firebase **Blaze-Plan** (Pay-as-you-go) — Cloud Functions benötigen Blaze
- Firebase CLI: `npm install -g firebase-tools`

### Enthaltene Functions

| Function | Trigger | Zweck |
|---|---|---|
| `generateCaption` | HTTPS Callable | KI-Caption-Generator für TikTok |
| `processScheduledVideos` | Cron alle 5 Min (WIB) | Geplante Videos automatisch posten |

### Deploy

```bash
# Einmalig: Login + Init
firebase login
firebase use --add   # Projekt auswählen

# Dependencies installieren
cd functions
npm install
cd ..

# Nur Functions deployen
firebase deploy --only functions

# Einzelne Function deployen
firebase deploy --only functions:processScheduledVideos
```

### Logs prüfen

```bash
firebase functions:log --only processScheduledVideos
firebase functions:log --only generateCaption
```

### Kosten (Blaze Free Tier)

| Resource | Kostenlos | Unser Verbrauch |
|---|---|---|
| Invocations | 2M / Monat | ~8.640 (Cron 5-Min) |
| Compute (GB-s) | 400.000 / Monat | << Limit |
| Outbound Netzwerk | 5 GB / Monat | << Limit |

→ **Effektiv kostenlos** für diese App-Größe.

### Client-Fallback

`checkPendingOnBoot()` in `js/features/posting.js` läuft beim Login als Sicherheitsnetz:
- Prüft Videos mit `status:'scheduled'` + abgelaufenem `scheduledFor`
- Aktiviert sie falls die Cloud Function sie verpasst hat
- Zeigt dem User eine Benachrichtigung
