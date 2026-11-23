import { Callout, Divider, Grid, Page, Section, Stat, Table, Text } from "cursor/pages";

export default function FuelDevDashboard() {
  return (
    <Page title="Fuel-dev Dashboard">
      <Text>
        Stand: 12.11.2026, 14:17 Uhr (Europe/Vienna). Repo{" "}
        <a href="https://github.com/nimmsel23/fuel-dev">nimmsel23/fuel-dev</a>, Branch master 5417f59. Nur lesend erhoben, kein Push, kein Merge, kein Deploy.
      </Text>
      <Text>
        Ergänzt die Cloud-Dashboard-Issues{" "}
        <a href="https://github.com/nimmsel23/vitalos/issues/27">vitalos#27–#33</a>: Dort gibt es kein Fuel-Produkt-Dashboard;{" "}
        <a href="https://github.com/nimmsel23/vitalos/issues/32">vitalos#32</a> führt nur den Fuel-Submodul-Pin der Shell. Das PM-Dev-Dashboard in ChatGPT Work existiert, ist von hier aus nicht einsehbar und dient nur als Referenz. Die{" "}
        <a href="https://cursor.com/canvas/store-54236058-5833-43d4-b2a6-ee55da1a2dc0/b566f779-55df-4330-a770-6cf4672c614b">Journal-dev Bestandsaufnahme</a>{" "}
        bleibt die Inventur der Shell, nicht dieser App.
      </Text>

      <Grid columns={4}>
        <Stat value="5417f59" label="master, Check (Fuel) grün" tone="success" />
        <Stat value="2 rot" label="Offene Dependabot-PRs #25 und #26" tone="danger" />
        <Stat value="5/5" label="Fuel-Sites HTTP 200, SW lässt /__/ durch" tone="success" />
        <Stat value="offen" label="Echter iPhone-Login-Test" tone="warning" />
      </Grid>

      <Callout tone="danger" lead="Sicherheitsupdate hängt: Issue #27">
        <a href="https://github.com/nimmsel23/fuel-dev/issues/27">#27</a> ist kein dritter Dependabot-PR, sondern ein offenes CTO-Issue (12.11.2026, 08:35 Uhr Europe/Vienna). Check (Fuel) ist auf{" "}
        <a href="https://github.com/nimmsel23/fuel-dev/pull/25">#25</a> (node-forge 1.4.0 → 1.4.3, High-Security) und{" "}
        <a href="https://github.com/nimmsel23/fuel-dev/pull/26">#26</a> (fast-xml-parser 5.10.1 → 5.12.0) rot, weil actions/checkout für nimmsel23/backend ohne Token abbricht. Dependabot-Läufe sehen keine Actions-Secrets. AutoMerge nach dev wird übersprungen.
      </Callout>

      <Section heading="1. Features und Arbeit">
        <Section heading="Kürzlich gemergt">
          <Table
            columns={["PR", "Titel", "Merge (Europe/Vienna)", "Commit", "Inhalt"]}
            rows={[
              [
                { text: "#23", tone: "success" },
                <a href="https://github.com/nimmsel23/fuel-dev/pull/23">fix(fuel): Notizen, lokale Wochen und Katalogportionen</a>,
                "8.11.2026, 23:33",
                "021da80",
                "Notiz-Save erst nach Laden, Entwürfe pro Tag, Katalog als skalierter Snapshot, Unit-Tests vor Cloud-Build",
              ],
              [
                { text: "#24", tone: "success" },
                <a href="https://github.com/nimmsel23/fuel-dev/pull/24">fix(fuel): iOS-Login auf allen Hosting-Varianten</a>,
                "11.11.2026, 01:43",
                "a87a883",
                "authDomain der Seiten-Domain, Redirect auf iOS/PWA, Persistence vor Auth, SW lässt /__/ durch",
              ],
            ]}
          />
          <Text>
            PR 23 ging auf dev und wurde danach nach master übernommen. PR 24 ging direkt auf master. Die Cloud-Persistenz von Notizen und Katalog-Snapshots ist in Unit-Tests geprüft, nicht an einem echten Konto im Browser.
          </Text>
        </Section>

        <Section heading="Commits auf master seit 11.11.2026">
          <Table
            columns={["Zeit (Europe/Vienna)", "SHA", "Erste Zeile"]}
            rows={[
              ["12.11.2026, 11:16", <a href="https://github.com/nimmsel23/fuel-dev/commit/5417f5931292cf6098d83ffda8087f2c280d3021">5417f59</a>, "docs: Konzept finale Variante vos-fuel"],
              ["12.11.2026, 11:16", <a href="https://github.com/nimmsel23/fuel-dev/commit/d02cf0bc50d99782fd0c103e5d6567991b0986e7">d02cf0b</a>, "fix(store): KI im Store-Build aus, Cloud-Weiche zentral, leerer Katalog, deutsche Labels"],
              ["12.11.2026, 11:02", <a href="https://github.com/nimmsel23/fuel-dev/commit/cbb69891aea540cc21f894dd2d70b1db2c1a04b7">cbb6989</a>, "fix(api): Firebase-/Produkt-Build und Capacitor immer Cloud-Modus"],
              ["12.11.2026, 02:42", <a href="https://github.com/nimmsel23/fuel-dev/commit/fb77713048008720860b9afbc86751c7484935e0">fb77713</a>, "docs(al): 2026-11-12 02:40 — Dep-PR #25/#26 Check rot"],
              ["12.11.2026, 02:18", <a href="https://github.com/nimmsel23/fuel-dev/commit/04c8484b8ce63611c5b180844eaec406827ecec6">04c8484</a>, "ci: restore Gemini repair + Merge-Agent (full automation)"],
              ["11.11.2026, 19:11", <a href="https://github.com/nimmsel23/fuel-dev/commit/bcd5662203e896af61e58574cb17e9270dac65f8">bcd5662</a>, "ci: drop Gemini repair and Merge-Agent (simplicity); später zurückgenommen"],
              ["11.11.2026, 19:09", <a href="https://github.com/nimmsel23/fuel-dev/commit/a021bd9f9c716bf6b06be6de22e96c1f6c53b363">a021bd9</a>, "docs(agents): simplicity default — exception only vitalos/prod"],
              ["11.11.2026, 14:42", <a href="https://github.com/nimmsel23/fuel-dev/commit/d16638b424d2ccbe96211286f1709e90444a7660">d16638b</a>, "docs(al): 2026-11-11 14:40 — Teilergebnis Push"],
              ["11.11.2026, 14:42", <a href="https://github.com/nimmsel23/fuel-dev/commit/af9f6f70cf378049b5a208179c05f9c9b20d6887">af9f6f7</a>, "docs: auto-update RESULTS.md"],
              ["11.11.2026, 14:40 (Committer)", <a href="https://github.com/nimmsel23/fuel-dev/commit/304f20bd79ec20a3e9dd7a69b6b5fe7bd46e1e34">304f20b</a>, "docs(al): 2026-11-11 02:40 — Stabilitätswache, 0 Dep-PRs"],
              ["11.11.2026, 14:40 (Committer)", <a href="https://github.com/nimmsel23/fuel-dev/commit/6064af392b569c4398e76d92939a44dc83b887c0">6064af3</a>, "docs: auto-update NEXT.md"],
              ["11.11.2026, 14:40 (Committer)", <a href="https://github.com/nimmsel23/fuel-dev/commit/59811da40c2ec8c603c531e6435e181d4cc7adc0">59811da</a>, "docs: auto-update RESULTS.md"],
              ["11.11.2026, 14:40 (Committer; Autor 10.11.)", <a href="https://github.com/nimmsel23/fuel-dev/commit/1f94794aeae438385ef57fabcf3ffdb4d0329f3b">1f94794</a>, "docs(al): 2026-11-10 14:40 — Stabilitätswache, Alerts 55, due 17.11"],
              ["11.11.2026, 14:40 (Committer; Autor 10.11.)", <a href="https://github.com/nimmsel23/fuel-dev/commit/e96bd3b57247fdeee41a3b7b9e9308d9d83edc44">e96bd3b</a>, "docs: auto-update NEXT.md"],
              ["11.11.2026, 01:41", <a href="https://github.com/nimmsel23/fuel-dev/commit/a87a8839881d8d9e2df06cef581bf8f9df4e1811">a87a883</a>, "fix(fuel): make iOS Google login same-origin and redirect (PR 24)"],
            ]}
          />
          <Text>
            Die drei Produkt-Commits vom 12.11. (11:02–11:16 Uhr Europe/Vienna) kamen von Autor „Alpha“, nicht aus diesem Chat. Sie stehen auf master und sind live deployed.
          </Text>
        </Section>

        <Section heading="Offener Backlog">
          <Table
            columns={["Thema", "Stand", "Art"]}
            rows={[
              [{ text: "Echter iPhone-Login-Test", tone: "warning" }, "Ausstehend. User-Rückmeldung liegt nicht vor. PWA vollständig schließen, dann Google-Login in Safari und vom Home-Bildschirm.", "Abnahme"],
              [{ text: "Historie nach Kalendertag, inkl. Wasser-only-Tagen", tone: "warning" }, "Offen. Geplant nach Runtime-Abnahme.", "Lücke"],
              [{ text: "Journal-/Vitalos-Vertrag", tone: "warning" }, "Journal-dev #v2 zeigt keine Fuel-Daten. Die v1-Timeline #journal liest Notizen und Mahlzeiten, aber keine Wasser-only-Tage, keine Wassermenge und kein Fasten. getNutritionJournalHistory wird von Journal nicht aufgerufen.", "Schnittstelle"],
              [{ text: "/nutrition/fasting gegen fuel-backend", tone: "warning" }, "Offen. Ob der Fasten-Endpunkt im Backend existiert und angebunden ist, in diesem Stand nicht erneut geprüft.", "Unbekannt / Lücke"],
              [{ text: "Cloud-Persistenz Notizen und Katalog-Snapshots", tone: "warning" }, "Nur Unit-Tests. Prüfung an einem echten Konto im Browser steht aus.", "Abnahme"],
              [{ text: "Produkentscheidungen", tone: "warning" }, "Offen: eigener Journal-Tab in Fuel, Sync des Fasten-Timers, OMAD-Warnlicht. Bis zur Bestätigung durch Daniel nicht als Freigabe behandelt.", "Entscheidung"],
            ]}
          />
        </Section>
      </Section>

      <Section heading="2. Offene PRs und CI">
        <Table
          columns={["Nr.", "Typ", "Titel", "Basis", "Checks", "Hinweis"]}
          rows={[
            [
              { text: "#25", tone: "danger" },
              "PR, Dependabot",
              <a href="https://github.com/nimmsel23/fuel-dev/pull/25">chore(deps): bump node-forge 1.4.0 → 1.4.3 in /functions</a>,
              "dev",
              "check fehlgeschlagen, 11.11.2026, 19:30 Uhr (Europe/Vienna)",
              <>
                High-Security (u. a. X.509 nameConstraints). Lauf{" "}
                <a href="https://github.com/nimmsel23/fuel-dev/actions/runs/43078477552">43078477552</a>, Dauer 5 s.
              </>,
            ],
            [
              { text: "#26", tone: "danger" },
              "PR, Dependabot",
              <a href="https://github.com/nimmsel23/fuel-dev/pull/26">chore(deps): bump fast-xml-parser 5.10.1 → 5.12.0 in /functions</a>,
              "dev",
              "check fehlgeschlagen, 11.11.2026, 19:30 Uhr (Europe/Vienna)",
              <>
                Lauf{" "}
                <a href="https://github.com/nimmsel23/fuel-dev/actions/runs/43078482791">43078482791</a>, Dauer 5 s.
              </>,
            ],
            [
              { text: "#27", tone: "danger" },
              "Issue, offen",
              <a href="https://github.com/nimmsel23/fuel-dev/issues/27">[CTO] Dependabot-PRs scheitern im Check: Backend-Checkout ohne Token</a>,
              "—",
              "betrifft #25 und #26",
              "Ursache laut Issue: fehlendes Dependabot-Secret für den Checkout von nimmsel23/backend. Kein weiterer offener PR.",
            ],
          ]}
        />
        <Text>
          Weitere offene PRs: keine. PR-AutoMerge (Dependabot → dev) läuft auf master-Hooks oft als skipped, weil die Checks der Dep-PRs rot sind.
        </Text>

        <Section heading="Letzte Läufe zum aktuellen SHA 5417f59">
          <Table
            columns={["Workflow", "Ereignis", "Ergebnis", "Zeit (Europe/Vienna)", "Lauf"]}
            rows={[
              [{ text: "Check (Fuel) #134", tone: "success" }, "push (head_branch dev, gleicher SHA wie master nach Promote)", "success", "12.11.2026, 11:16", <a href="https://github.com/nimmsel23/fuel-dev/actions/runs/43198957866">43198957866</a>],
              [{ text: "Live Deploy (Fuel master) #169", tone: "success" }, "workflow_dispatch", "success", "12.11.2026, 11:17", <a href="https://github.com/nimmsel23/fuel-dev/actions/runs/43199076369">43199076369</a>],
              [{ text: "deploy-Jobs (log, supplements, mikros, protokoll) plus Haupt-deploy", tone: "success" }, "im Anschluss an den Check", "success", "12.11.2026, 11:17–11:18", "Checks auf 5417f59 alle success"],
              [{ text: "Auto-Promote dev → master #158", tone: "success" }, "schedule", "success", "12.11.2026, 13:48", <a href="https://github.com/nimmsel23/fuel-dev/actions/runs/43221278230">43221278230</a>],
            ]}
          />
          <Text>
            Die Legacy-Status-API liefert für master keinen kombinierten Status (0 Statuses, state pending). Maßgeblich sind die Checks-Läufe oben. Branch-Schutz auf master verlangt den Check „check“.
          </Text>
        </Section>
      </Section>

      <Section heading="3. Live-Stand">
        <Text>
          Geprüft per HTTP-Header und sw.js am 12.11.2026, 14:16 Uhr (Europe/Vienna). Last-Modified aus GMT nach Europe/Vienna umgerechnet. iOS-Auth-Fix hier nur über den Service-Worker-Durchlass für /__/ belegt; die JS-Bundles wurden in diesem Stand nicht erneut auf authDomain geprüft. Alle fünf Sites liegen nach dem Deploy von 5417f59 (enthält PR 24).
        </Text>
        <Table
          columns={["Site", "HTTP", "Last-Modified (Europe/Vienna)", "sw.js /__/ Durchlass"]}
          rows={[
            [{ text: "fuel-vos.web.app", tone: "success" }, <a href="https://fuel-vos.web.app">öffnen</a>, "12.11.2026, 11:18:31", "ja, path === '/__' oder startsWith('/__/'); Navigation ersetzt den Auth-Handler nicht"],
            [{ text: "vos-fuel-log.web.app", tone: "success" }, <a href="https://vos-fuel-log.web.app">öffnen</a>, "12.11.2026, 11:17:47", "ja, gleicher Durchlass"],
            [{ text: "vos-fuel-supplements.web.app", tone: "success" }, <a href="https://vos-fuel-supplements.web.app">öffnen</a>, "12.11.2026, 11:18:10", "ja, gleicher Durchlass"],
            [{ text: "vos-fuel-mikros.web.app", tone: "success" }, <a href="https://vos-fuel-mikros.web.app">öffnen</a>, "12.11.2026, 11:17:44", "ja, gleicher Durchlass"],
            [{ text: "vos-fuel-protokoll.web.app", tone: "success" }, <a href="https://vos-fuel-protokoll.web.app">öffnen</a>, "12.11.2026, 11:17:51", "ja, gleicher Durchlass"],
          ]}
        />
        <Callout tone="info" lead="fuel-os.web.app ist eine andere App">
          <a href="https://fuel-os.web.app">fuel-os.web.app</a> antwortet HTTP 200, Last-Modified 29.10.2026, 16:10:30 Uhr (Europe/Vienna), Titel „Fuel OS“. Sie gehört nicht zu diesem Deploy und darf nicht überschrieben werden.
        </Callout>
      </Section>

      <Section heading="4. Blocker und Risiken">
        <Table
          columns={["Thema", "Schwere", "Befund"]}
          rows={[
            [{ text: "Dependabot #25/#26 + Issue #27", tone: "danger" }, "hoch", "Sicherheitsupdate node-forge kommt nicht in dev/master, solange das Dependabot-Secret fehlt und der Workflow den Backend-Checkout nicht sauber abbricht."],
            [{ text: "iPhone-Login-Abnahme", tone: "warning" }, "mittel", "Code und SW sind live, der echte Gerätetest fehlt. Bei redirect_uri_mismatch oder unauthorized-domain müssen die sechs Fuel-Domains in Firebase Authentication und im Google-OAuth-Client stehen. Ob das konfiguriert ist, ist von hier aus unbekannt."],
            [{ text: "Journal-/Vitalos-Vertrag", tone: "warning" }, "mittel", "Startansicht der Shell zeigt keine Fuel-Karten; Wasser und Fasten fehlen auch in der alten Timeline."],
            ["Shell-/Produkt-Build Submodul-Pin", "unbekannt", "Ob vitalos den Fuel-Submodul noch auf einem älteren SHA hält, wurde hier nicht geprüft. Das gehört in das vitalos-Meta-Dashboard (#32). Die fünf Hosting-Sites laufen auf 5417f59."],
            ["Feature-Freeze bis 7.2.2027", "ungeklärt", "Vom CPO-Bot gemeldet, von Daniel noch nicht bestätigt. Neue Features deshalb nicht als freigegeben behandeln; Bugfixes laufen weiter."],
            ["Keine Merge/Deploys ohne Freigabe", "Regel", "Weiterhin kein Push auf master und kein Deploy ohne ausdrückliche Freigabe durch Daniel."],
          ]}
        />
      </Section>

      <Section heading="Bestehende Dashboards (nicht doppelt bauen)">
        <Table
          columns={["Quelle", "Scope", "Bezug zu Fuel"]}
          rows={[
            [<a href="https://github.com/nimmsel23/vitalos/issues/27">vitalos#27</a>, "Epic/Index, Session-Digest 12.11., lebende Dashboards pro Bereich", "Kein Fuel-Kind-Issue; Index für #28–#33"],
            [<a href="https://github.com/nimmsel23/vitalos/issues/28">vitalos#28</a>, "workspace Business-Hub (Team, Wochenrhythmus, Git-Sync)", "Keiner"],
            [<a href="https://github.com/nimmsel23/vitalos/issues/29">vitalos#29</a>, "VitalTraining / vitaltrainer (Angebote, Research, B2B)", "Keiner"],
            [<a href="https://github.com/nimmsel23/vitalos/issues/30">vitalos#30</a>, "creator, Build-in-Public / Content", "Keiner"],
            [<a href="https://github.com/nimmsel23/vitalos/issues/31">vitalos#31</a>, "Obsidian-Business-Vault (Focus/Frame, Fristen)", "Keiner"],
            [<a href="https://github.com/nimmsel23/vitalos/issues/32">vitalos#32</a>, "vitalos Meta: Submodul-Pins, Store, CI, Org, Release-Train", "Nur Fuel-SHA gegen origin/master der Shell; kein App-Backlog"],
            [<a href="https://github.com/nimmsel23/vitalos/issues/33">vitalos#33</a>, "coach-dev (Auth, Client-Scope, Plan, CI)", "Keiner"],
            ["PM-Dev-Dashboard (ChatGPT Work)", "Referenz, von hier nicht erreichbar", "Unbekannt"],
          ]}
        />
      </Section>

      <Divider />
      <Text>
        Momentaufnahme, erhoben über den GitHub-Connector und curl. Vorgesehen ist eine tägliche oder ereignisbezogene Aktualisierung dieser Page durch den Fuel Dev Bot. Der Eintrag in vos/org/DASHBOARDS.md ist hier nicht geschrieben (kein Push; die Datei war unter raw master/org/DASHBOARDS.md nicht auffindbar, HTTP 404).
      </Text>
    </Page>
  );
}
