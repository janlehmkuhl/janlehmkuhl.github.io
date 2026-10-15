---
title: "The AL-Go artifact setting: every combination that works (and some that don't)"
date: 2026-10-14 21:00:00 +0200
categories: [AL-Go, DevOps]
tags: [al-go, artifacts, bccontainerhelper, versioning, ci-cd]
description: "A cookbook of AL-Go artifact settings, grouped by what you want to achieve, with the Business Central version each one actually resolves to."
---

🇩🇪 [Deutsche Version]({% post_url 2026-10-14-al-go-artifact-cookbook-de %})

> Build your own value and see what it resolves to today: [Artifact Builder]({{ '/artifact-builder/' | relative_url }})
{: .prompt-tip }

The `artifact` setting decides which Business Central version AL-Go builds and tests your apps against. It lives in your AL-Go settings, usually `.AL-Go/settings.json`:

```json
{
  "country": "de",
  "artifact": "//28.5/de/latest"
}
```

A value has five parts, and every part can be left empty:

```
<storageAccount>/<type>/<version>/<country>/<select>
```

| Part | If empty |
|---|---|
| `storageAccount` | `bcartifacts` (released versions) |
| `type` | `Sandbox` |
| `version` | any version |
| `country` | the `country` setting (default `us`) |
| `select` | `latest` |

That's why values like `////nextmajor` are valid.

The country only selects the localization, not the version: `w1`, `de`, `us` and `dk` get exactly the same build numbers. `w1` is the worldwide base version without country-specific functionality; the localized versions build on it.

All results below were resolved on **October 14, 2026**, two weeks after the release of 29.0.

## Always the current release

| Setting | Resolves to | |
|---|---|---|
| *(not set)* | 29.0.54011.56330 | newest sandbox for your `country` |
| `///w1/latest` | 29.0.54011.56330 | same, explicit |
| `///de/daily` | 29.0.54011.56262 | newest build before today |
| `///us/weekly` | 29.0.54011.56119 | newest build before last Sunday |
| `///dk/current` | 29.0.54011.56330 | same as `latest` |

All of these switch to the new major on release day. `daily` and `weekly` only reduce how often the artifact changes, so caches stay valid. They don't pin a version.

## Pin a version

| Setting | Resolves to | |
|---|---|---|
| `//28/w1/latest` | 28.5.54151.56322 | newest build of major 28 |
| `//28/de/first` | 28.0.46665.52632 | oldest build of major 28 |
| `//28.5/us/latest` | 28.5.54151.56322 | newest build of 28.5 |
| `//28.5/dk/first` | 28.5.54151.54178 | oldest build of 28.5 |
| `//28.5.54151.56322/w1` | 28.5.54151.56322 | exactly this build |
| `//28.5.54151.0/de/closest` | 28.5.54151.54178 | first build ≥ the given version within 28.5, otherwise the newest 28.5 |
| `///us/secondtolastmajor` | 28.5.54151.56322 | newest build of the previous major |
| `///dk/first` | 15.4.41023.43755 | oldest sandbox artifact available |

- The version is a prefix: `28` matches all of 28.x, `28.1` matches 28.1 but not 28.10.
- Older minors keep receiving builds. 28.5 got a new one two weeks after 29.0 was released, so `//28.5/…/latest` always gives you the current hotfix level.
- For majors up to 25, only one build per minor is kept. A pinned exact build number can disappear.

## Derive the version from your app

With `*` as version, AL-Go uses your `applicationDependency`: the highest `application` version across your app.json files, but at least the AL-Go setting `applicationDependency` (default `18.0.0.0`).

| Setting | app.json `application` | Resolves to | |
|---|---|---|---|
| `//*/w1/first` | 28.0.0.0 | 28.0.46665.52632 | oldest build that satisfies your app |
| `//*/de/latest` | 28.0.0.0 | 28.0.46665.56311 | newest build of **28.0**, not 28.5 |
| `//*/us/latest` | 28.5.0.0 | 28.5.54151.56322 | newest build of 28.5 |
| *(not set)* + `"updateDependencies": true` | 28.0.0.0 | 28.0.46665.52632 | oldest build ≥ your app's minimum, falls back to insider builds if there is none |

`*` stays within the major.minor of your `applicationDependency` and only works with `first` or `latest`.

## Test the next release

| Setting | Resolves to | |
|---|---|---|
| `////nextminor` | 29.1.56191.0 | next minor (insider build) |
| `////nextmajor` | 30.0.56306.0 | next major (insider build) |
| `///dk/nextmajor` | 30.0.56306.0 | same, explicit country |
| `bcinsider/Sandbox/30.0/de/latest` | 30.0.56306.0 | a specific insider version |

- `nextminor` and `nextmajor` read from the `bcinsider` storage account. AL-Go accepts the insider EULA for you.
- From minor .5 on, `nextminor` returns the next major, since there is no .6 for sandboxes.
- `nextmajor` is empty until Microsoft publishes the first insider build of the next major.
- The PTE template ships with `.github/Test Next Minor.settings.json` and `.github/Test Next Major.settings.json`, which set exactly these values for the matching workflows. Workflow-specific settings files override the project settings.

## On-premises

| Setting | Resolves to | |
|---|---|---|
| `/OnPrem//w1/latest` | 29.0.54011.55407 | newest on-premises release |
| `/OnPrem/28/de/latest` | 28.6.55443.0 | newest cumulative update of 28 |
| `/OnPrem//dk/weekly` | 29.0.54011.55407 | `daily`/`weekly` are treated as `latest` |
| `/OnPrem//dech/latest` | 14.53.50097.0 | German-language Switzerland, ends with 14 |

- On-premises has exactly one build per cumulative update, and minors go up to .6.
- The language variants `dech`, `frbe`, `frca`, `frch`, `itch` and `nlbe` exist only on-premises and only up to 14. `na` ends with 16.
- `us` has far fewer on-premises builds than `w1`. Everything before 11 and majors 13, 15 and 16 are missing, so `/OnPrem/16/us/latest` finds nothing while `/OnPrem/16/w1/latest` returns 16.19.35126.0.

## Doesn't work

| Setting | Error |
|---|---|
| `//28.5/w1/weekly` | `You cannot specify version, before or after when selecting Daily or Weekly build` |
| `bcinsider///de/nextmajor` | `You cannot specify storageAccount, type=OnPrem or version when selecting NextMajor release` |
| `//*/us/closest` | `Version can only be '*' if select is first or latest.` |
| `//28.5/dk/closest` | `Version number must be in the format 1.2.3.4 when you want to get the closest artifact Url` |
| `/OnPrem/16/us/latest` | `No artifacts found for the artifact setting` |
| `bcpublicpreview/Sandbox//w1/latest` | the storage account is empty today |

`daily` and `weekly` can't be combined with a version. To stay on an older release, use `latest` with the version instead.

## Reference

**Storage accounts**

| Value | Contains |
|---|---|
| *(empty)*, `bcartifacts` | released versions, sandbox and on-premises |
| `bcinsider` | preview builds, sandbox only |
| `bcpublicpreview` | nothing at the moment |

**Types:** `Sandbox`, `OnPrem`

**Countries**

| Type | Countries |
|---|---|
| Sandbox | at, au, be, bg, br, ca, ch, co, cz, de, dk, ee, es, fi, fr, gb, gr, hk, hr, hu, ie, in, is, it, jp, kr, lt, lv, mx, nl, no, nz, pe, ph, pl, pt, ro, rs, se, si, sk, th, tr, tw, ua, us, vn, w1 |
| On-premises | at, au, be, ca, ch, cz, de, dk, es, fi, fr, gb, in, is, it, mx, nl, no, nz, ru, se, us, w1; up to 16: na; up to 14: dech, frbe, frca, frch, itch, nlbe |

For sandboxes, countries without their own localization are mapped automatically, for example `ae`, `lu` or `my` to `w1`, and `fo` or `gl` to `dk`.

**Select**

| Value | Returns | Restrictions |
|---|---|---|
| `latest` | newest match | default |
| `first` | oldest match | |
| `all` | all matches, AL-Go uses the first | |
| `closest` | first build ≥ version within its major.minor | version must be `x.x.x.x` |
| `secondtolastmajor` | newest build of the previous major | no version |
| `current` | current sandbox release | no storage account, version or `OnPrem` |
| `nextminor` | next minor insider build | no storage account, version or `OnPrem` |
| `nextmajor` | next major insider build | no storage account, version or `OnPrem` |
| `daily` | newest build before today | no version; `latest` for `OnPrem` |
| `weekly` | newest build before last Sunday | no version; `latest` for `OnPrem` |

Instead of a search value, `artifact` also accepts a full artifact URL starting with `https://`.
