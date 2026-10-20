---
title: "Platform vs. application version in Business Central"
draft: true
date: 2026-10-15 16:00:00 +0200
categories: [Business Central, AL]
tags: [business-central, versioning, app-json, al-go]
description: "Business Central reports two versions. What platform and application mean, how their numbers move, and how app.json and AL-Go use them."
---

🇩🇪 [Deutsche Version]({% post_url 2026-10-15-platform-vs-application-version-de %})

**Help and Support** → **Troubleshooting** shows two versions:

```
Version: DE Business Central 28.5 (Platform 28.0.54946.55473 + Application 28.5.54151.56021)
```

Same major, but a different minor and a different build. They describe two different parts of Business Central.

## Platform and application

| | Platform | Application |
|---|---|---|
| Contains | server, client and services, plus the system objects they expose | Microsoft's apps: System Application, Base Application and the rest of the solution |
| Minor | always `.0` within a major | the monthly update: `.0` to `.5` online, up to `.18` on-premises |
| Build (3rd number) | changes over time, even within a major | never changes within a minor version |
| Revision (4th number) | hotfix | hotfix |

How a hotfix changes the version:

```
Application  28.5.54151.54178  →  28.5.54151.56021   (only the revision changes)
Platform     28.0.54016.0      →  28.0.54946.56347   (build and revision change)
```

- The version an environment is "on" is the application version. The name in the Help and Support line ("Business Central 28.5") is the application's, and the admin center schedules updates by its major.minor.
- Despite its name, the System Application belongs to the application, not to the platform. It follows the application's minor (28.5.x), the platform's own symbol package is the app "System" (28.0.x).

## How the numbers move

Platform version shipped with sandbox artifacts (`w1`), as of October 15, 2026.

**Over time**, the builds of 28.5:

| Application | Created | Platform |
|---|---|---|
| 28.5.54151.54178 | Sep 7 | 28.0.54016.0 |
| 28.5.54151.55284 | Sep 28 | 28.0.54946.55168 |
| 28.5.54151.56376 | Oct 15 | 28.0.54946.56347 |

The application only changes its revision, the platform changes build and revision.

**On one day**, the newest build of each minor on October 15:

| Application | Platform |
|---|---|
| 28.0.46665.56377 | 28.0.54946.56347 |
| 28.1.49838.56384 | 28.0.54946.56347 |
| 28.2.50931.56383 | 28.0.54946.56347 |
| 28.3.52162.56385 | 28.0.54946.56347 |
| 28.4.53241.56386 | 28.0.54946.56347 |
| 28.5.54151.56376 | 28.0.54946.56347 |
| 29.0.54011.56400 | 29.0.56351.0 |

All minors of a major run on the same, current platform, and a new major brings its own.

Platform and application are also hotfixed independently. The environment from the beginning runs application 28.5.54151.56021 on platform 28.0.54946.55473, while the artifact with the same application version ships platform 28.0.54946.55847.

An environment also differs from the artifact in how its apps are versioned. In the artifact for 28.5.54151.56021, all 204 apps carry revision 56021. The environment from the beginning shows the same application version, but hotfixes only update the apps they change:

| App in the environment | Version |
|---|---|
| Base Application | 28.5.54151.56021 |
| System Application | 28.5.54151.55939 |
| Application | 28.5.54151.54178 |
| most other Microsoft apps | 28.5.54151.54178 |

The application version in Help and Support is the Base Application's.

## In app.json

```json
{
  "platform": "1.0.0.0",
  "application": "28.0.0.0"
}
```

| Setting | Means | Raise it when |
|---|---|---|
| `platform` | minimum version of the symbol package `Microsoft_System_*.app` (the app "System") | you use a system object or platform capability that only exists from that version on |
| `application` | minimum version of `Microsoft_Application_*.app` (the app "Application") | you use objects, fields or events from the Base or System Application that are new in that version |

- Both are minimum versions. An app with `application` set to `28.0.0.0` is accepted on 28.0 and every later version. Set higher than the target environment, it can't be installed there.
- Use major.minor.0.0 for `application`, never a full build. An environment's Application app can be older than the artifact you built against, as shown above: `28.5.54151.56021` would build fine but fail to install there.
- Don't list the Base or System Application under `dependencies`; `application` covers them.
- Many apps leave `platform` at `1.0.0.0`, AL-Go's "Create a new app" template included. Which platform an app needs is mostly decided by its `runtime`, which is a topic of its own.

## In AL-Go

- An artifact's version is the application version: `//28.5/de/latest` selects application 28.5. The platform comes with the artifact and is recorded in its `manifest.json`.
- AL-Go selects artifacts by application only. Its `applicationDependency` is the highest `application` across your app.json files (at least the setting, default `18.0.0.0`). `*` as artifact version builds on it, and the build stops if the artifact is older. All combinations: [The AL-Go artifact setting cookbook]({% post_url 2026-10-14-al-go-artifact-cookbook %}).
- `platform` from app.json plays no role in artifact selection.
- By default (`vsixFile`), AL-Go also takes the AL compiler from the artifact. The artifact therefore decides as well which `runtime` the build can produce at most.

## On-premises

A technical upgrade replaces the platform but keeps the existing application. Platform and application then have different majors until the application is upgraded as well.
