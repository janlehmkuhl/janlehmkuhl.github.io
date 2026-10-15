---
# the default layout is 'page'
title: Artifact Builder
description: "Build the AL-Go for GitHub artifact setting and see which Business Central version it resolves to, using today's artifact data."
image:
  path: /assets/img/artifact-builder-preview.png
  alt: AL-Go Artifact Builder
icon: fas fa-screwdriver-wrench
order: 4
---

Build the `artifact` setting for [AL-Go for GitHub](https://github.com/microsoft/AL-Go) and see which Business Central version it resolves to. Dashed options don't work in this combination: pick one to see the error AL-Go would raise. All combinations explained: [The AL-Go artifact setting cookbook]({% post_url 2026-10-14-al-go-artifact-cookbook %}).

<link rel="stylesheet" href="{{ '/assets/css/artifact-builder.css' | relative_url }}">
<div id="artifact-builder" data-src="{{ '/assets/data/bc-artifacts.json' | relative_url }}">
  <p>Loading artifact data…</p>
</div>
<script src="{{ '/assets/js/artifact-builder.js' | relative_url }}" defer></script>
