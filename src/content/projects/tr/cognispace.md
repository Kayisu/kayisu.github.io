---
title: CogniSpace
slug: cognispace
translationKey: cognispace
locale: tr
planet: earth
summary: Kayseri Üniversitesi Bilgisayar Mühendisliğinde 2026 tarihli, IoT tabanlı bilişsel konfor izleme sistemi üzerine bitirme tezi.
status: shipped
year: 2026
kind: research
tags: [IoT, Computer Vision, FastAPI, Senior Thesis]
featured: false
---

## Problem

Bilişsel konfor tek bir çevresel ölçümle yakalanamaz. Kayseri Üniversitesi
Bilgisayar Mühendisliğinde 2026 tarihli bu bitirme tezi, her sensör okuması için
puan hesaplamaya gerekli ortam ve çalışma oturumu olaylarını kaydeder.

## Yaklaşım

Raspberry Pi 5; SCD41 ile CO2, TSL2561 ile ışık, BME680 ile sıcaklık, nem ve gaz
verisi toplar. Kamerada MediaPipe duruş ve yüz analizi çalışır. Okumalar, TLS ile
Mosquitto MQTT üzerinden çalışma oturumuna göre anahtarlanan FastAPI ve
PostgreSQL arka ucuna iletilir. Arka uç; standartlara dayalı Bilişsel Konfor
Skorunu, duruş olaylarını ve günlük toplamları Flutter ve web istemcileri için
REST üzerinden sunar.

## Durum

Tüm işlem hattı Haziran 2026'da çalışma zamanında uçtan uca doğrulandı.
