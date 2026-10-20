---
title: "Platform vs. Application Version in Business Central"
draft: true
date: 2026-10-15 16:30:00 +0200
lang: de-DE
hidden: true
categories: [Business Central, AL]
tags: [business-central, versioning, app-json, al-go]
description: "Business Central zeigt zwei Versionen an. Was Platform und Application bedeuten, wie sich ihre Nummern entwickeln und wie app.json und AL-Go sie verwenden."
---

🇬🇧 [English version]({% post_url 2026-10-15-platform-vs-application-version %})

Unter **Help and Support** → **Troubleshooting** zeigt Business Central zwei Versionen:

```
Version: DE Business Central 28.5 (Platform 28.0.54946.55473 + Application 28.5.54151.56021)
```

Gleiche Major, aber eine andere Minor und ein anderer Build. Die beiden Versionen beschreiben zwei verschiedene Teile von Business Central.

## Platform und Application

| | Platform | Application |
|---|---|---|
| Enthält | Server, Client und Dienste, dazu die Systemobjekte, die sie bereitstellen | Microsofts Apps: System Application, Base Application und der Rest der Lösung |
| Minor | innerhalb einer Major immer `.0` | das monatliche Update: online `.0` bis `.5`, On-Premises bis `.18` |
| Build (3. Zahl) | ändert sich laufend, auch innerhalb einer Major | ändert sich innerhalb einer Minor nie |
| Revision (4. Zahl) | Hotfix | Hotfix |

So verändert ein Hotfix die Version:

```
Application  28.5.54151.54178  →  28.5.54151.56021   (nur die Revision ändert sich)
Platform     28.0.54016.0      →  28.0.54946.56347   (Build und Revision ändern sich)
```

- Die Version, auf der eine Umgebung „steht“, ist die Application-Version. Der Name in der Help-and-Support-Zeile („Business Central 28.5“) ist der der Application, und das Admin Center plant Updates nach ihrer Major.Minor.
- Die System Application gehört trotz ihres Namens zur Application, nicht zur Platform. Sie folgt der Minor der Application (28.5.x), das eigene Symbolpaket der Platform ist die App „System“ (28.0.x).

## Wie sich die Nummern entwickeln

Platform-Version, die mit den Sandbox Artifacts (`w1`) ausgeliefert wird, Stand 15. Oktober 2026.

**Über die Zeit**, die Builds von 28.5:

| Application | Erstellt | Platform |
|---|---|---|
| 28.5.54151.54178 | 7. Sep. | 28.0.54016.0 |
| 28.5.54151.55284 | 28. Sep. | 28.0.54946.55168 |
| 28.5.54151.56376 | 15. Okt. | 28.0.54946.56347 |

Die Application ändert nur ihre Revision, die Platform ändert Build und Revision.

**An einem Tag**, der neueste Build jeder Minor am 15. Oktober:

| Application | Platform |
|---|---|
| 28.0.46665.56377 | 28.0.54946.56347 |
| 28.1.49838.56384 | 28.0.54946.56347 |
| 28.2.50931.56383 | 28.0.54946.56347 |
| 28.3.52162.56385 | 28.0.54946.56347 |
| 28.4.53241.56386 | 28.0.54946.56347 |
| 28.5.54151.56376 | 28.0.54946.56347 |
| 29.0.54011.56400 | 29.0.56351.0 |

Alle Minors einer Major laufen auf derselben, aktuellen Platform, und eine neue Major bringt ihre eigene mit.

Platform und Application werden außerdem unabhängig voneinander gehotfixt. Die Umgebung vom Anfang läuft mit Application 28.5.54151.56021 auf Platform 28.0.54946.55473, während das Artifact mit derselben Application-Version Platform 28.0.54946.55847 mitbringt.

Eine Umgebung unterscheidet sich vom Artifact auch darin, wie ihre Apps versioniert sind. Im Artifact für 28.5.54151.56021 tragen alle 204 Apps die Revision 56021. Die Umgebung vom Anfang zeigt dieselbe Application-Version, aber Hotfixes aktualisieren nur die Apps, die sie ändern:

| App in der Umgebung | Version |
|---|---|
| Base Application | 28.5.54151.56021 |
| System Application | 28.5.54151.55939 |
| Application | 28.5.54151.54178 |
| die meisten anderen Microsoft-Apps | 28.5.54151.54178 |

Die Application-Version in Help and Support ist die der Base Application.

## In der app.json

```json
{
  "platform": "1.0.0.0",
  "application": "28.0.0.0"
}
```

| Setting | Bedeutet | Anheben, wenn |
|---|---|---|
| `platform` | Mindestversion des Symbolpakets `Microsoft_System_*.app` (die App „System“) | du ein Systemobjekt oder eine Platform-Funktion nutzt, die es erst ab dieser Version gibt |
| `application` | Mindestversion von `Microsoft_Application_*.app` (die App „Application“) | du Objekte, Felder oder Events aus Base oder System Application nutzt, die in dieser Version neu sind |

- Beides sind Mindestversionen. Eine App mit `application` auf `28.0.0.0` wird auf 28.0 und jeder späteren Version akzeptiert. Liegt der Wert über der Version der Zielumgebung, lässt sie sich dort nicht installieren.
- Für `application` immer Major.Minor.0.0 verwenden, nie einen vollen Build. Die Application-App einer Umgebung kann älter sein als das Artifact, gegen das gebaut wurde, wie oben gezeigt: Mit `28.5.54151.56021` würde der Build durchlaufen, die Installation dort aber scheitern.
- Base und System Application nicht unter `dependencies` eintragen; `application` deckt sie ab.
- Viele Apps lassen `platform` auf `1.0.0.0`, auch das AL-Go Template „Create a new app“. Welche Platform eine App braucht, entscheidet vor allem ihre `runtime`, und die ist ein eigenes Thema.

## In AL-Go

- Die Version eines Artifacts ist die Application-Version: `//28.5/de/latest` wählt Application 28.5. Die Platform kommt mit dem Artifact und steht in dessen `manifest.json`.
- AL-Go wählt Artifacts nur nach der Application aus. Seine `applicationDependency` ist die höchste `application` aus deinen app.json Dateien (mindestens das Setting, Default `18.0.0.0`). `*` als Artifact-Version baut darauf auf, und der Build bricht ab, wenn das Artifact älter ist. Alle Kombinationen: [Das AL-Go artifact Setting]({% post_url 2026-10-14-al-go-artifact-cookbook-de %}).
- `platform` aus der app.json spielt für die Artifact-Auswahl keine Rolle.
- Per Default (`vsixFile`) nimmt AL-Go auch den AL Compiler aus dem Artifact. Das Artifact entscheidet damit auch, welche `runtime` der Build höchstens erzeugen kann.

## On-Premises

Ein technisches Upgrade ersetzt die Platform, behält aber die bestehende Application. Platform und Application haben dann unterschiedliche Majors, bis auch die Application aktualisiert ist.
