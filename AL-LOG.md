# AL-LOG — Abteilungsleiter fuel-dev

Tageslog der Abteilungsleitungs-Läufe (02:10, abteilung@fuel-dev.service). Vom
Hilfsskript vos-al-log mechanisch vorbefüllt, vom AL knapp ausgefüllt und mit
der Arbeit committet. Leser: PM (Produkt-Backlog-Abgleich, fachlich direkt),
CEO-Runde, CTO-Drilldown. Additiv: alte Sektionen unangetastet lassen, keine
Erzählberichte — Belege (Commits, PRs, CI-Runs) statt Text.

## 2026-11-07 (Saturday) — Abteilungsleiter-Lauf

_Automatik (vos-al-log Vorlage 2026-11-07):_
- Commits seit 2026-11-06: e9b0ce9 docs(todo): P1 iOS-Login-Problem Mini Apps (CEO-Triage Home-TODO 2026-11-07)
66cfb97 Merge branch 'dev' into master
7251c8b Merge remote-tracking branch 'origin/dev' into dev
fc57032 refactor(fuel): Formular-Helfer (nowHHMM, emptyForm, hhmmFromISO) aus LogView in mealForm.js
6a39bc8 Merge remote-tracking branch 'origin/master' into dev
0b559ba Merge branch 'dev' into master: a11y + mealSavePlan-Refactor
1a2022a refactor(fuel): buildSavePlan aus LogView in testbares Modul mealSavePlan herausloesen
4828901 a11y(fuel): Labels, aria-pressed und Trefferflaeche in Settings/Micros/Log
04493de fix(css): @tailwind-Direktiven aus styles.embedded.css entfernen (TW4)
fe2c67d fix(ci): Live-Deploy installiert mit dem overrides-Block des Lockfiles (ERR_PNPM_LOCKFILE_CONFIG_MISMATCH)
79f9ed7 Merge pull request #21 from nimmsel23/dev
9187fe0 Merge remote-tracking branch 'origin/master' into dev
- Offene PRs: (keine offenen PRs / gh nicht verfuegbar)
- CI (letzte Läufe): (CI-Status nicht ermittelbar)
- Arbeitsbaum: sauber

_Vom AL ausfüllen (knapp & belegbar, je 1–3 Zeilen, Commit-/PR-Referenzen statt Erzählung):_
- Erledigt: iOS-Login verglichen; Firebase Authorized Domains live 8/8 Fuel-Hosts vorhanden (CEO-Prüfung). Historischer iPad-Befund: Popup beendet sich, App bleibt abgemeldet (`RESULTS.md:83`); kein Error-Code/Repro.
- Offen/Weiter: Fuel Firebase 11.10.0 / `@firebase/auth` 1.10.8 vs Fitness 13.1.0 / 1.13.8 ist ein möglicher Diagnosevergleich, keine bestätigte Ursache. Bei erneutem iPad-Repro Modus (Safari/PWA), Auth-State und Fehlercode festhalten.
- Blocker: Kein aktueller iOS-Repro oder Console-Beleg; daher kein belastbarer Code-Fix und keine Änderung.
