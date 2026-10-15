---
title: "Die AL-Go-Einstellung artifact: jede Kombination, die funktioniert (und ein paar, die es nicht tun)"
date: 2026-10-14 21:30:00 +0200
lang: de-DE
hidden: true
categories: [AL-Go, DevOps]
tags: [al-go, artifacts, bccontainerhelper, versioning, ci-cd]
description: "Ein Kochbuch für die AL-Go-Einstellung artifact, gruppiert nach Ziel, mit der Business-Central-Version, auf die jede Angabe tatsächlich auflöst."
---

🇬🇧 [English version]({% post_url 2026-10-14-al-go-artifact-cookbook %})

> Eigenen Wert zusammenklicken und sehen, worauf er heute auflöst: [Artifact Builder]({{ '/artifact-builder/' | relative_url }})
{: .prompt-tip }

Die Einstellung `artifact` legt fest, gegen welche Business-Central-Version AL-Go deine Apps baut und testet. Sie steht in den AL-Go-Einstellungen, meist in `.AL-Go/settings.json`:

```json
{
  "country": "de",
  "artifact": "//28.5/de/latest"
}
```

Ein Wert besteht aus fünf Teilen, und jeder Teil darf leer bleiben:

```
<storageAccount>/<type>/<version>/<country>/<select>
```

| Teil | Wenn leer |
|---|---|
| `storageAccount` | `bcartifacts` (veröffentlichte Versionen) |
| `type` | `Sandbox` |
| `version` | beliebige Version |
| `country` | die Einstellung `country` (Standard `us`) |
| `select` | `latest` |

Deshalb sind Werte wie `////nextmajor` gültig.

Das Land bestimmt nur die Lokalisierung, nicht die Version: `w1`, `de`, `us` und `dk` haben exakt dieselben Build-Nummern. `w1` ist die weltweite Basisversion ohne länderspezifische Funktionen; die Länderversionen bauen darauf auf.

Alle Ergebnisse unten wurden am **14. Oktober 2026** ermittelt, zwei Wochen nach dem Release von 29.0.

## Immer das aktuelle Release

| Einstellung | Ergebnis | |
|---|---|---|
| *(nicht gesetzt)* | 29.0.54011.56330 | neueste Sandbox für dein `country` |
| `///w1/latest` | 29.0.54011.56330 | dasselbe, explizit |
| `///de/daily` | 29.0.54011.56262 | neuester Build vor heute |
| `///us/weekly` | 29.0.54011.56119 | neuester Build vor letztem Sonntag |
| `///dk/current` | 29.0.54011.56330 | wie `latest` |

Alle diese Werte springen am Tag des Releases auf die neue Major-Version. `daily` und `weekly` sorgen nur dafür, dass sich das Artefakt seltener ändert und Caches gültig bleiben. Eine Version legen sie nicht fest.

## Eine Version festlegen

| Einstellung | Ergebnis | |
|---|---|---|
| `//28/w1/latest` | 28.5.54151.56322 | neuester Build von Major 28 |
| `//28/de/first` | 28.0.46665.52632 | ältester Build von Major 28 |
| `//28.5/us/latest` | 28.5.54151.56322 | neuester Build von 28.5 |
| `//28.5/dk/first` | 28.5.54151.54178 | ältester Build von 28.5 |
| `//28.5.54151.56322/w1` | 28.5.54151.56322 | genau dieser Build |
| `//28.5.54151.0/de/closest` | 28.5.54151.54178 | erster Build ≥ der angegebenen Version innerhalb von 28.5, sonst der neueste 28.5 |
| `///us/secondtolastmajor` | 28.5.54151.56322 | neuester Build der vorherigen Major-Version |
| `///dk/first` | 15.4.41023.43755 | ältestes verfügbares Sandbox-Artefakt |

- Die Version ist ein Präfix: `28` trifft alle 28.x, `28.1` trifft 28.1, aber nicht 28.10.
- Ältere Minor-Versionen bekommen weiter Builds. 28.5 hat zwei Wochen nach dem Release von 29.0 noch einen neuen bekommen, `//28.5/…/latest` liefert also immer den aktuellen Hotfix-Stand.
- Bis Major 25 bleibt pro Minor nur ein Build erhalten. Eine fest eingetragene Build-Nummer kann also verschwinden.

## Die Version aus der App ableiten

Mit `*` als Version richtet sich AL-Go nach deiner `applicationDependency`: der höchsten `application`-Version aus deinen app.json-Dateien, mindestens aber der AL-Go-Einstellung `applicationDependency` (Standard `18.0.0.0`).

| Einstellung | app.json `application` | Ergebnis | |
|---|---|---|---|
| `//*/w1/first` | 28.0.0.0 | 28.0.46665.52632 | ältester Build, der zu deiner App passt |
| `//*/de/latest` | 28.0.0.0 | 28.0.46665.56311 | neuester Build von **28.0**, nicht 28.5 |
| `//*/us/latest` | 28.5.0.0 | 28.5.54151.56322 | neuester Build von 28.5 |
| *(nicht gesetzt)* + `"updateDependencies": true` | 28.0.0.0 | 28.0.46665.52632 | ältester Build ≥ der Mindestversion deiner App, notfalls aus den Insider-Builds |

`*` bleibt innerhalb der Major.Minor-Version deiner `applicationDependency` und funktioniert nur mit `first` oder `latest`.

## Das nächste Release testen

| Einstellung | Ergebnis | |
|---|---|---|
| `////nextminor` | 29.1.56191.0 | nächste Minor-Version (Insider-Build) |
| `////nextmajor` | 30.0.56306.0 | nächste Major-Version (Insider-Build) |
| `///dk/nextmajor` | 30.0.56306.0 | dasselbe, mit Land |
| `bcinsider/Sandbox/30.0/de/latest` | 30.0.56306.0 | eine bestimmte Insider-Version |

- `nextminor` und `nextmajor` lesen aus dem Storage Account `bcinsider`. Die Insider-EULA akzeptiert AL-Go für dich.
- Ab Minor .5 liefert `nextminor` die nächste Major-Version, weil es für Sandboxes kein .6 gibt.
- `nextmajor` bleibt leer, bis Microsoft den ersten Insider-Build der nächsten Major-Version veröffentlicht.
- Die PTE-Vorlage bringt `.github/Test Next Minor.settings.json` und `.github/Test Next Major.settings.json` mit, die genau diese Werte für die passenden Workflows setzen. Workflow-spezifische Einstellungsdateien überschreiben die Projekteinstellungen.

## On-Premises

| Einstellung | Ergebnis | |
|---|---|---|
| `/OnPrem//w1/latest` | 29.0.54011.55407 | neuestes On-Premises-Release |
| `/OnPrem/28/de/latest` | 28.6.55443.0 | neuestes kumulatives Update von 28 |
| `/OnPrem//dk/weekly` | 29.0.54011.55407 | `daily`/`weekly` werden wie `latest` behandelt |
| `/OnPrem//dech/latest` | 14.53.50097.0 | deutschsprachige Schweiz, endet mit 14 |

- On-Premises hat genau einen Build pro kumulativem Update, und die Minor-Versionen reichen bis .6.
- Die Sprachvarianten `dech`, `frbe`, `frca`, `frch`, `itch` und `nlbe` gibt es nur On-Premises und nur bis 14. `na` endet mit 16.
- `us` hat deutlich weniger On-Premises-Builds als `w1`. Alles vor 11 und die Major-Versionen 13, 15 und 16 fehlen, deshalb findet `/OnPrem/16/us/latest` nichts, während `/OnPrem/16/w1/latest` 16.19.35126.0 liefert.

## Funktioniert nicht

| Einstellung | Fehler |
|---|---|
| `//28.5/w1/weekly` | `You cannot specify version, before or after when selecting Daily or Weekly build` |
| `bcinsider///de/nextmajor` | `You cannot specify storageAccount, type=OnPrem or version when selecting NextMajor release` |
| `//*/us/closest` | `Version can only be '*' if select is first or latest.` |
| `//28.5/dk/closest` | `Version number must be in the format 1.2.3.4 when you want to get the closest artifact Url` |
| `/OnPrem/16/us/latest` | `No artifacts found for the artifact setting` |
| `bcpublicpreview/Sandbox//w1/latest` | der Storage Account ist derzeit leer |

`daily` und `weekly` lassen sich nicht mit einer Version kombinieren. Wer auf einem älteren Release bleiben will, nimmt stattdessen `latest` mit Version.

## Referenz

**Storage Accounts**

| Wert | Inhalt |
|---|---|
| *(leer)*, `bcartifacts` | veröffentlichte Versionen, Sandbox und On-Premises |
| `bcinsider` | Vorabversionen, nur Sandbox |
| `bcpublicpreview` | derzeit nichts |

**Typen:** `Sandbox`, `OnPrem`

**Länder**

| Typ | Länder |
|---|---|
| Sandbox | at, au, be, bg, br, ca, ch, co, cz, de, dk, ee, es, fi, fr, gb, gr, hk, hr, hu, ie, in, is, it, jp, kr, lt, lv, mx, nl, no, nz, pe, ph, pl, pt, ro, rs, se, si, sk, th, tr, tw, ua, us, vn, w1 |
| On-Premises | at, au, be, ca, ch, cz, de, dk, es, fi, fr, gb, in, is, it, mx, nl, no, nz, ru, se, us, w1; bis 16: na; bis 14: dech, frbe, frca, frch, itch, nlbe |

Bei Sandboxes werden Länder ohne eigene Lokalisierung automatisch umgesetzt, zum Beispiel `ae`, `lu` oder `my` auf `w1` und `fo` oder `gl` auf `dk`.

**Select**

| Wert | Liefert | Einschränkungen |
|---|---|---|
| `latest` | neuester Treffer | Standard |
| `first` | ältester Treffer | |
| `all` | alle Treffer, AL-Go nimmt den ersten | |
| `closest` | erster Build ≥ Version innerhalb ihrer Major.Minor | Version muss `x.x.x.x` sein |
| `secondtolastmajor` | neuester Build der vorherigen Major-Version | keine Version |
| `current` | aktuelles Sandbox-Release | kein Storage Account, keine Version, kein `OnPrem` |
| `nextminor` | Insider-Build der nächsten Minor-Version | kein Storage Account, keine Version, kein `OnPrem` |
| `nextmajor` | Insider-Build der nächsten Major-Version | kein Storage Account, keine Version, kein `OnPrem` |
| `daily` | neuester Build vor heute | keine Version; bei `OnPrem` wie `latest` |
| `weekly` | neuester Build vor letztem Sonntag | keine Version; bei `OnPrem` wie `latest` |

Statt einer Suchangabe akzeptiert `artifact` auch eine vollständige Artefakt-URL, die mit `https://` beginnt.
