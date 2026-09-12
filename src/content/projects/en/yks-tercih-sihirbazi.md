---
title: YKS Preference Wizard
slug: yks-tercih-sihirbazi
translationKey: yks-tercih-sihirbazi
locale: en
planet: mercury
summary: A browser tool that filters and compares programmes from the official 2026 YKS placement guide; the first release covers medicine programmes only and will be extended to all programmes.
status: prototype
year: 2026
tags: [Tool, Education, Data]
demo: https://kayisu.github.io/yks/2026/tip-tercih/
---

## Problem

The official 2026 YKS placement guide contains programme information that needs to be filtered and compared while forming a preference list.

## How it works

The data is extracted from the official ÖSYM guide into JSON by `scripts/yks/extract-2026-table4.mjs`. The browser tool provides filters and a comparison view; all processing runs client-side.

## Status

The first release covers medicine programmes only. Extension to all programmes is planned.
