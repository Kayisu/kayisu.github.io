---
title: YKS Tercih Sihirbazı
slug: yks-tercih-sihirbazi
translationKey: yks-tercih-sihirbazi
locale: tr
planet: mercury
summary: Resmî 2026 YKS yerleştirme kılavuzundaki programları filtreleyen ve karşılaştıran bir tarayıcı aracı; ilk sürüm yalnızca tıp programlarını kapsar ve tüm programlara genişletilecektir.
status: prototype
year: 2026
kind: tool
tags: [Tool, Education, Data]
demo: https://kayisu.github.io/yks/2026/tip-tercih/
---

## Problem

Resmî 2026 YKS yerleştirme kılavuzu, tercih listesi hazırlanırken filtrelenmesi ve karşılaştırılması gereken program bilgileri içerir.

## Nasıl çalışır

Veri, resmî ÖSYM kılavuzundan `scripts/yks/extract-2026-table4.mjs` ile JSON’a aktarılır. Tarayıcı aracı filtreler ve karşılaştırma görünümü sunar; tüm işlem istemci tarafında çalışır.

## Durum

İlk sürüm yalnızca tıp programlarını kapsar. Tüm programlara genişletilmesi planlanmıştır.
