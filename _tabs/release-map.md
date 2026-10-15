---
# the default layout is 'page'
title: Release Map
description: "When each Business Central version was released for cloud and on-premises, what's in preparation and what to expect next."
icon: fas fa-timeline
order: 5
---

When each Business Central version became available as an artifact, for cloud and on-premises, and what comes next. A major is released every April and October, followed by one minor per month. On-premises versions get a cumulative update every month for 18 months.

> These are the dates the **artifacts** became available, which is when AL-Go can build against a version. Your own environments are updated later, within their update window.
{: .prompt-info }

<link rel="stylesheet" href="{{ '/assets/css/release-map.css' | relative_url }}">
<div id="release-map" data-src="{{ '/assets/data/bc-releases.json' | relative_url }}">
  <p>Loading release data…</p>
</div>
<script src="{{ '/assets/js/release-map.js' | relative_url }}" defer></script>

Release dates come from the on-premises artifacts, which keep their original dates. Cloud versions .0 to .5 are released on the same days. Future dates are projected from the release cadence, insider builds mark versions already in preparation. To pick the version AL-Go builds against, use the [Artifact Builder]({{ '/artifact-builder/' | relative_url }}).
