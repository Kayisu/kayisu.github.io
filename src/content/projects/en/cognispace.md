---
title: CogniSpace
slug: cognispace
translationKey: cognispace
locale: en
planet: earth
summary: A 2026 Kayseri University Computer Engineering senior thesis for an IoT cognitive-comfort monitoring system.
status: shipped
year: 2026
kind: research
tags: [IoT, Computer Vision, FastAPI, Senior Thesis]
featured: false
---

## Problem

Cognitive comfort is not captured by a single environmental measurement. This
2026 graduation thesis at Kayseri University Computer Engineering records the
environment and work-session events needed to calculate it per sensor reading.

## Approach

A Raspberry Pi 5 collects CO2 from an SCD41, light from a TSL2561, and
temperature, humidity, and gas readings from a BME680. Its camera runs
MediaPipe pose and face analysis. Readings travel through MQTT using Mosquitto
with TLS to a FastAPI and PostgreSQL backend, where they are keyed by work
session. The backend exposes a standards-grounded Cognitive Comfort Score,
posture events, and daily aggregates over REST for Flutter and web clients.

## Status

The full pipeline was verified end to end at runtime in June 2026.
