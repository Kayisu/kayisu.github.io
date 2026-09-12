---
title: SoruDepo
slug: sorudepo
translationKey: sorudepo
locale: tr
planet: jupiter
summary: Öğretmenlerin sınav ve çalışma kitabı PDF'lerini yeniden kullanılabilir soru kütüphanelerine ve sınav kâğıtlarına dönüştürmesini sağlayan web uygulaması.
status: active
year: 2026
kind: product
tags: [SaaS, Education, PDF, OCR]
featured: true
role: Geliştirici
---

## Problem

Öğretmenlerin, formülleri ve şekilleri koruyarak sınav ve çalışma kitabı
PDF'lerindeki soruları yeniden kullanması; ardından kendi soru kütüphanelerinden
sınav ve cevap anahtarı oluşturması gerekir.

## Yaklaşım

Uygulama, yüklenen PDF'lerde soru sınırlarını tespit eder, Mathpix ile soru
metnini ve formüller için LaTeX'i çıkarır, şekilleri görsel kırpıntıları olarak
korur. Öğretmenler soruları düzeltebilir ve kaydedebilir; kütüphaneden sınav
oluşturup sınav kâğıdı ile cevap anahtarını PDF olarak indirebilir. Teknoloji
yığını Python API, işçi kuyruğu, PostgreSQL, Redis, MinIO nesne depolama, React
web istemcisi ve Docker Compose kullanır.

## Durum

SoruDepo, Erciyes Teknopark'taki Sera Kuluçka Programı kapsamında 2026'da
geliştiriliyor.
