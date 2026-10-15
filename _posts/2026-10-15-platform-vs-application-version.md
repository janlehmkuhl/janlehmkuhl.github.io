---
title: "Platform vs. application version in Business Central"
date: 2026-10-15 16:00:00 +0200
categories: [Business Central, AL]
tags: [business-central, versioning, app-json, al-go]
description: "Business Central reports two versions. What platform and application mean, how their numbers move, and how app.json and AL-Go use them."
---

**Help and Support** → **Troubleshooting** shows two versions:

```
Version: DE Business Central 28.5 (Platform 28.0.54946.55473 + Application 28.5.54151.56021)
```

Same major, but a different minor and a different build. They describe two different parts of Business Central.

## Platform and application

| | Platform | Application |
|---|---|---|
| Contains | server, client and services, plus the system objects they expose | Microsoft's apps: System Application, Base Application and the rest of the solution |
| In app.json | `Microsoft_System_*.app` | `Microsoft_Application_*.app` |
| Minor | always `.0` within a major | the monthly update: `.0` to `.5` online, up to `.18` on-premises |
| Build | changes with every new platform build | fixed per update (28.5 is always build 54151) |
| Revision | hotfix | hotfix |

- The version an environment is "on" is the application version. The name in the line above ("Business Central 28.5") is the application's, and the admin center schedules updates by its major.minor.
- Despite its name, the System Application belongs to the application, not to the platform.

## How the numbers move

Platform version shipped with sandbox artifacts (`w1`), as of October 15, 2026:

| Application | Created | Platform |
|---|---|---|
| 28.4.53241.53312 | Aug 7 | 28.0.53289.0 |
| 28.4.53241.54585 | Sep 11 | 28.0.54476.0 |
| 28.5.54151.54178 | Sep 7 | 28.0.54016.0 |
| 28.5.54151.55284 | Sep 28 | 28.0.54946.55168 |
| 28.5.54151.56376 | Oct 15 | 28.0.54946.56347 |
| 28.0.46665.56377 | Oct 15 | 28.0.54946.56347 |
| 29.0.54011.56400 | Oct 15 | 29.0.56351.0 |

- All minors of a major run on the same, current platform. On October 15, the newest builds of 28.0 through 28.5 all shipped with platform 28.0.54946.56347.
- The platform gets new builds within a major, but its minor stays `.0`.
- The application keeps its build per update and only increases the revision for hotfixes.
- Both are hotfixed independently. The environment above runs application 28.5.54151.56021 on platform 28.0.54946.55473, while the artifact with the same application version ships platform 28.0.54946.55847.

## In app.json

```json
{
  "platform": "1.0.0.0",
  "application": "28.0.0.0"
}
```

| Setting | Means | Raise it when |
|---|---|---|
| `platform` | minimum platform version | you use a system object or platform capability that only exists from that version on |
| `application` | minimum application version | you use objects, fields or events from the Base or System Application that are new in that version |

- Both are minimum versions. An app with `application` set to `28.0.0.0` is accepted on 28.0 and every later version. Set higher than the target environment, it can't be installed there.
- Don't list the Base or System Application under `dependencies`; `application` covers them.
- Many apps leave `platform` at `1.0.0.0`, AL-Go's "Create a new app" template included. Which platform an app needs is mostly decided by its `runtime`, which is a topic of its own.

## In AL-Go

- An artifact's version is the application version: `//28.5/de/latest` selects application 28.5. The platform comes with the artifact and is recorded in its `manifest.json`.
- AL-Go selects artifacts by application only. Its `applicationDependency` is the highest `application` across your app.json files (at least the setting, default `18.0.0.0`). `*` as artifact version builds on it, and the build stops if the artifact is older. All combinations: [The AL-Go artifact setting cookbook]({% post_url 2026-10-14-al-go-artifact-cookbook %}).
- `platform` from app.json plays no role in artifact selection.
- By default (`vsixFile`), AL-Go also takes the AL compiler from the artifact. The artifact therefore decides as well which `runtime` the build can produce at most.

## On-premises

A technical upgrade replaces the platform but keeps the existing application. Platform and application then have different majors until the application is upgraded as well.
