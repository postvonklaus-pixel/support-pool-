# 7-Tage-Plan: Beta-Launch

Ausgangslage (Stand heute): System laeuft lokal im Mock-Modus, Landing Page +
Beta-Signup funktionieren, Feedback-System steht, Admin-Dashboard zeigt
MRR/Beta-Stats. Noch **nichts ist oeffentlich erreichbar**.

## Tag 1 (morgen)
**Ziel:** Landing Page live, erste 2 Outreach-Kanaele aktiv.
- [ ] Deployment-Option waehlen (Empfehlung: Railway/Render, $0 Start - siehe `docs/DEPLOYMENT.md`)
- [ ] `./deploy.sh check` lokal ausfuehren, um den Docker-Build zu validieren
- [ ] Landing Page live deployen, URL testen (Health-Check `/health`, Signup-Flow einmal durchklicken)
- [ ] LinkedIn-Post 1 + Twitter-Post 1 aus `docs/BETA_MARKETING_PLAN.md` posten
- [ ] Vorbereiten: SendGrid-Account (kostenloser Tier reicht) fuer echte Onboarding-Mails, falls gewuenscht - optional, Mock-Modus funktioniert auch ohne

**Risiko:** Free-Tier-Deploy-Plattform verhaelt sich anders als lokal (Env-Var
vergessen, DB-Verbindung fehlt). **Gegenmassnahme:** `/health`-Endpoint direkt
nach Deploy pruefen, bevor Traffic draufgeschickt wird.

## Tag 2
**Ziel:** Erste 2-3 Signups, Outreach starten.
- [ ] LinkedIn-Post 2 posten
- [ ] 5 Personen aus Zielgruppe 1 (Solo-Creator) direkt per DM/E-Mail anschreiben (Template 1)
- [ ] Admin-Dashboard (`streamlit run admin_dashboard.py`) taeglich checken: Signups, MRR-Widget

**Risiko:** Null Resonanz auf den ersten Post. **Gegenmassnahme:** Nicht auf
einen einzigen Kanal verlassen - Tag 2 bereits DM-Outreach parallel starten,
nicht erst abwarten.

## Tag 3
**Ziel:** Erstes Nutzer-Feedback einsammeln und reagieren.
- [ ] LinkedIn-Post 3 posten
- [ ] Bei allen bisherigen Beta-Usern nachfragen: "Schon eingeloggt? Fragen?"
- [ ] `python cli.py list-feedback` checken, auf Bugs sofort reagieren
- [ ] Beta-User, die sich seit >2 Tagen nicht eingeloggt haben, identifizieren (Admin-Dashboard, Tab "Beta-Tester") und gezielt nachfassen

**Risiko:** Signups registrieren sich, loggen sich aber nie ein
("Signup ≠ Aktivierung"). **Gegenmassnahme:** Onboarding-Mail (Template 3)
manuell nachschieben, wenn kein Login nach 24h.

## Tag 4
**Ziel:** Agentur-Zielgruppe angehen.
- [ ] 5 kleine Agenturen per E-Mail anschreiben (Template 2)
- [ ] Erstes eingegangenes Feedback in eine Prioritaetenliste sortieren (Bug > Feature > Idee)
- [ ] Falls kritische Bugs gemeldet: fixen, bevor neue Reichweite aufgebaut wird

**Risiko:** Agenturen antworten traege (laengere Entscheidungswege).
**Gegenmassnahme:** Parallel weiter Solo-Creator ansprechen, nicht auf
Agentur-Antworten warten.

## Tag 5
**Ziel:** Momentum halten, zweite Content-Welle.
- [ ] LinkedIn-Post 4 (Objection Handling) + Twitter-Post 4 posten
- [ ] MRR-Widget im Admin-Dashboard checken: Sind wir on-track fuers 90-Tage-Ziel? (`mrr_goal_progress()`)
- [ ] Falls <5 Signups bisher: Ursache pruefen (Landing Page-Conversion? Falsche Zielgruppe? Zu wenig Reichweite?)

**Risiko:** Zu wenig Signups trotz Aktivitaet. **Gegenmassnahme:** Landing
Page-Text testen (anderer Hook), oder direkteren 1:1-Ansatz staerker
gewichten als Social-Posts.

## Tag 6
**Ziel:** Bestehende Beta-User zu Fuersprechern machen.
- [ ] Aktive Beta-User (die schon Content erstellt haben) direkt fragen: "Wuerdest du das jemandem empfehlen?"
- [ ] Falls ja: um Weiterempfehlung/Post/Erwaehnung bitten
- [ ] Restliches Feedback aus `list-feedback` durcharbeiten

## Tag 7
**Ziel:** Woche abschliessen, Status ehrlich bewerten.
- [ ] LinkedIn-Post 5 + Twitter-Post 5 (Recap) posten
- [ ] Admin-Dashboard: finale Zahlen fuer Woche 1 (Signups, aktive User, Feedback-Kategorien)
- [ ] Entscheidung treffen: Ziel (10 Beta-User) erreicht? Wenn nein - woran lag's, was aendert sich in Woche 2?
- [ ] Naechste 7-Tage-Prioritaeten grob skizzieren (z.B. Deployment auf Option A, wenn Nutzerzahl waechst)

---

## Uebergreifende Risiken (die ganze Woche)

| Risiko | Auswirkung | Gegenmassnahme |
|---|---|---|
| Deployment-Plattform-Limits (Free-Tier) | App wird langsam/nicht erreichbar | Admin-Dashboard taeglich pruefen, bei Bedarf frueher auf Option A/C wechseln |
| Mock-Modus wird oeffentlich sichtbar (z.B. "MOCK-EMAIL" in Logs) | Wirkt unprofessionell gegenueber Beta-Testern | Vor Live-Gang mind. SendGrid auf echten Key umstellen, damit Onboarding-Mails wirklich ankommen |
| Kein Login/Passwort-Reset-Flow | Beta-User verlieren temp. Passwort, koennen sich nicht einloggen | Kurzfristig: Passwort per Hand im Admin-Dashboard/DB nachschauen und erneut zuschicken; TODO fuer spaeter: echten Magic-Link-Login bauen |
| Alle Limits/Preise sind aktuell nur Mock-Stripe | Keine echten Zahlungen moeglich, falls jemand direkt zahlen will | Fuer die Beta okay (Ziel ist Feedback, nicht Umsatz) - vor Umstieg auf zahlende Kunden echten Stripe-Testmodus-Flow durchspielen (siehe Haupt-README) |
