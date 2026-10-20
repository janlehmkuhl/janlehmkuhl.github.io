---
title: "Das AL-Go artifact Setting: jede Kombination, die funktioniert (und ein paar, die es nicht tun)"
draft: true
date: 2026-10-14 21:30:00 +0200
lang: de-DE
hidden: true
categories: [AL-Go, DevOps]
tags: [al-go, artifacts, bccontainerhelper, versioning, ci-cd]
description: "Ein Cookbook für das AL-Go artifact Setting, gruppiert nach Ziel, mit der Business-Central-Version, auf die jeder Wert tatsächlich auflöst."
---

🇬🇧 [English version]({% post_url 2026-10-14-al-go-artifact-cookbook %})

> Ein `artifact` Setting zusammenklicken und sehen, auf welche Version es heute auflöst: [Artifact Builder]({{ '/artifact-builder/' | relative_url }})
{: .prompt-tip }

Das `artifact` Setting legt fest, gegen welche Business-Central-Version AL-Go deine Apps baut und testet. Es steht in den AL-Go Settings, meist in `.AL-Go/settings.json`:

```json
{
  "country": "de",
  "artifact": "//28.5/de/latest"
}
```

`country` ist ein eigenes Setting: die Lokalisierung, für die AL-Go baut. Der Wert von `artifact` (oben `//28.5/de/latest`) besteht aus fünf Teilen, getrennt durch `/`. Jeder Teil darf leer bleiben, deshalb sind Werte wie `////nextmajor` gültig:

```
<storageAccount>/<type>/<version>/<country>/<select>
```

| Teil | Werte | Wenn leer |
|---|---|---|
| `storageAccount` | `bcartifacts`, `bcinsider` | `bcartifacts` (veröffentlichte Versionen) |
| `type` | `Sandbox`, `OnPrem` | `Sandbox` |
| `version` | Major (`28`), Major.Minor (`28.5`), volle Version (`28.5.54151.56322`), `*` | beliebige Version |
| `country` | `w1`, `de`, `us`, `dk`, … (siehe [Referenz](#referenz)) | das `country` Setting (Default `us`) |
| `select` | `latest`, `first`, `all`, `closest`, `secondtolastmajor`, `current`, `nextminor`, `nextmajor`, `daily`, `weekly` | `latest` |

Ein anderes `country` ändert nichts an der Version, die du bekommst. Microsoft veröffentlicht jeden Build für alle Länder unter derselben Versionsnummer: 29.0.54011.56330 gibt es für `w1`, `de`, `us` und `dk` gleichermaßen. Das Land entscheidet nur, welche Lokalisierung enthalten ist, also länderspezifische Features wie lokale Steuern und Reporting. `w1` ist die weltweite Basisversion ohne Lokalisierung.

Deshalb verwenden die Beispiele unten verschiedene Länder: Die Ergebnisse sind für jedes Land gleich.

Alle Ergebnisse unten wurden am **14. Oktober 2026** ermittelt, zwei Wochen nach dem Release von 29.0, jeweils mit einem `country` Setting, das zum `country` Teil des `artifact` Werts passt.

## Immer das aktuelle Release

| Setting | Ergebnis | |
|---|---|---|
| *(nicht gesetzt)* | 29.0.54011.56330 | neueste Sandbox für dein `country` Setting |
| `///w1/latest` | 29.0.54011.56330 | neueste `w1` Sandbox |
| `///de/daily` | 29.0.54011.56262 | neuester `de` Build vor heute |
| `///us/weekly` | 29.0.54011.56119 | neuester `us` Build vor letztem Sonntag |
| `///dk/current` | 29.0.54011.56330 | aktuelles `dk` Release |

Alle diese Werte springen am Release-Tag auf die neue Major (siehe [Release Map]({{ '/release-map/' | relative_url }})). `daily` und `weekly` sorgen nur dafür, dass sich das Artifact seltener ändert und Caches gültig bleiben. Eine Version pinnen sie nicht.

`current` liefert dasselbe Ergebnis wie `latest`, lehnt aber `storageAccount`, `version` und `OnPrem` ab. AL-Gos eigener Test Current Workflow verwendet `////latest`.

## Eine Version pinnen

| Setting | Ergebnis | |
|---|---|---|
| `//28/w1/latest` | 28.5.54151.56322 | neuester `w1` Build von Major 28 |
| `//28/de/first` | 28.0.46665.52632 | ältester `de` Build von Major 28 |
| `//28.5/us/latest` | 28.5.54151.56322 | neuester `us` Build von 28.5 |
| `//28.5/dk/first` | 28.5.54151.54178 | ältester `dk` Build von 28.5 |
| `//28.5.54151.56322/w1` | 28.5.54151.56322 | genau dieser `w1` Build |
| `//28.5.54151.0/de/closest` | 28.5.54151.54178 | erster `de` Build ≥ der angegebenen Version innerhalb von 28.5, sonst der neueste 28.5 |
| `///us/secondtolastmajor` | 28.5.54151.56322 | neuester `us` Build der vorherigen Major |
| `///dk/first` | 15.4.41023.43755 | ältestes verfügbares `dk` Sandbox Artifact |

- `version` ist ein Präfix: `28` trifft alle 28.x, `28.1` trifft 28.1, aber nicht 28.10.
- Ältere Minors bekommen weiter Builds. 28.5 hat zwei Wochen nach dem Release von 29.0 noch einen neuen bekommen, `//28.5/…/latest` liefert also immer den aktuellen Hotfix-Stand.
- Bis Major 25 bleibt pro Minor nur ein Build erhalten. Eine gepinnte Build-Nummer kann also verschwinden.

## Die Version aus der App ableiten

Mit `*` als `version` verwendet AL-Go deine `applicationDependency`: die höchste `application` Version aus deinen app.json Dateien, mindestens aber das AL-Go Setting `applicationDependency` (Default `18.0.0.0`). Dieses Setting setzt man normalerweise nicht selbst, weil der Wert aus deinen app.json Dateien kommt. AL-Go bricht außerdem den Build ab, wenn das Artifact älter als dieser Wert ist.

| Setting | Application in app.json | Ergebnis | |
|---|---|---|---|
| `//*/w1/first` | 28.0.0.0 | 28.0.46665.52632 | ältester Build, der zu deiner App passt |
| `//*/de/latest` | 28.0.0.0 | 28.0.46665.56311 | neuester Build von **28.0**, nicht 28.5 |
| `//*/us/latest` | 28.5.0.0 | 28.5.54151.56322 | neuester Build von 28.5 |
| *(nicht gesetzt)* | 28.0.0.0 | 28.0.46665.52632 | mit `"updateDependencies": true`: ältester Build ≥ der Mindestversion deiner App, notfalls aus den Insider Builds |

`*` bleibt innerhalb der Major.Minor deiner `applicationDependency` und funktioniert nur mit `first` oder `latest`.

## Das nächste Release testen

| Setting | Ergebnis | |
|---|---|---|
| `////nextminor` | 29.1.56191.0 | nächste Minor (Insider Build) |
| `////nextmajor` | 30.0.56306.0 | nächste Major (Insider Build) |
| `///dk/nextmajor` | 30.0.56306.0 | dasselbe, mit explizit gesetztem `country` |
| `bcinsider/Sandbox/30.0/de/latest` | 30.0.56306.0 | eine bestimmte Insider-Version |

- `nextminor` und `nextmajor` lesen aus dem `bcinsider` Storage Account. Die Insider EULA akzeptiert AL-Go für dich.
- `nextminor` und `nextmajor` gibt es nur für Sandbox; für On-Premises sind keine Insider Builds verfügbar.
- Ab Minor .5 liefert `nextminor` die nächste Major, weil es für Sandboxes kein .6 gibt.
- `nextmajor` bleibt leer, bis Microsoft den ersten Insider Build der nächsten Major veröffentlicht.
- Das PTE Template bringt `.github/Test Next Minor.settings.json` und `.github/Test Next Major.settings.json` mit, die genau diese Werte für die passenden Workflows setzen. Workflow-spezifische Settings-Dateien überschreiben die Projekt-Settings.

## On-Premises

| Setting | Ergebnis | |
|---|---|---|
| `/OnPrem//w1/latest` | 29.0.54011.55407 | neuestes On-Premises Release |
| `/OnPrem/28/de/latest` | 28.6.55443.0 | neuestes Cumulative Update von 28 |
| `/OnPrem//dk/weekly` | 29.0.54011.55407 | `daily`/`weekly` werden wie `latest` behandelt |
| `/OnPrem//dech/latest` | 14.53.50097.0 | deutschsprachige Schweiz, endet mit 14 |

- On-Premises hat genau einen Build pro Cumulative Update, eins pro Monat für 18 Monate. Die Minors gehen deshalb bis .18 (26.0 bis 26.18). Sandboxes hören bei .5 auf.
- Die Sprachvarianten `dech`, `frbe`, `frca`, `frch`, `itch` und `nlbe` gibt es nur On-Premises und nur bis 14. `na` endet mit 16.
- `us` hat deutlich weniger On-Premises Builds als `w1`. Alles vor 11 und die Majors 13, 15 und 16 fehlen, deshalb findet `/OnPrem/16/us/latest` nichts, während `/OnPrem/16/w1/latest` 16.19.35126.0 liefert.

## Funktioniert nicht

| Setting | Fehler |
|---|---|
| `//28.5/w1/weekly` | `You cannot specify version, before or after when selecting Daily or Weekly build` |
| `bcinsider///de/nextmajor` | `You cannot specify storageAccount, type=OnPrem or version when selecting NextMajor release` |
| `//*/us/closest` | `Version can only be '*' if select is first or latest.` |
| `//28.5/dk/closest` | `Version number must be in the format 1.2.3.4 when you want to get the closest artifact Url` |
| `/OnPrem/16/us/latest` | `No artifacts found for the artifact setting` |
| `bcpublicpreview/Sandbox//w1/latest` | der Storage Account ist derzeit leer |

`daily` und `weekly` lassen sich nicht mit einer `version` kombinieren. Wer auf einem älteren Release bleiben will, nimmt stattdessen `latest` mit der `version`.

## Referenz

**Storage Accounts**

| Wert | Inhalt |
|---|---|
| *(leer)*, `bcartifacts` | veröffentlichte Versionen, Sandbox und On-Premises |
| `bcinsider` | Preview Builds, nur Sandbox |
| `bcpublicpreview` | derzeit nichts |

**Types:** `Sandbox`, `OnPrem`

**Länder**

| Type | Länder |
|---|---|
| Sandbox | at, au, be, bg, br, ca, ch, co, cz, de, dk, ee, es, fi, fr, gb, gr, hk, hr, hu, ie, in, is, it, jp, kr, lt, lv, mx, nl, no, nz, pe, ph, pl, pt, ro, rs, se, si, sk, th, tr, tw, ua, us, vn, w1 |
| On-Premises | at, au, be, ca, ch, cz, de, dk, es, fi, fr, gb, in, is, it, mx, nl, no, nz, ru, se, us, w1; bis 16: na; bis 14: dech, frbe, frca, frch, itch, nlbe |

Bei Sandboxes werden Länder ohne eigene Lokalisierung automatisch gemappt, zum Beispiel `ae`, `lu` oder `my` auf `w1` und `fo` oder `gl` auf `dk`.

**Select**

| Wert | Liefert | Einschränkungen |
|---|---|---|
| `latest` | neuester Treffer | Default |
| `first` | ältester Treffer | |
| `all` | alle Treffer, AL-Go nimmt den ersten | |
| `closest` | erster Build ≥ `version` innerhalb ihrer Major.Minor | `version` muss `x.x.x.x` sein |
| `secondtolastmajor` | neuester Build der vorherigen Major | keine `version` |
| `current` | aktuelles Sandbox Release | kein `storageAccount`, keine `version`, kein `OnPrem` |
| `nextminor` | Insider Build der nächsten Minor | kein `storageAccount`, keine `version`, kein `OnPrem` |
| `nextmajor` | Insider Build der nächsten Major | kein `storageAccount`, keine `version`, kein `OnPrem` |
| `daily` | neuester Build vor heute | keine `version`; bei `OnPrem` wie `latest` |
| `weekly` | neuester Build vor letztem Sonntag | keine `version`; bei `OnPrem` wie `latest` |

Statt eines Suchwerts akzeptiert `artifact` auch eine vollständige Artifact-URL, die mit `https://` beginnt.
