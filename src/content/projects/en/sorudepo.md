---
title: SoruDepo
slug: sorudepo
translationKey: sorudepo
locale: en
planet: jupiter
summary: A web application that lets teachers turn exam and workbook PDFs into reusable question libraries and test papers.
status: active
year: 2026
kind: product
tags: [SaaS, Education, PDF, OCR]
featured: true
role: Developer
---

## Problem

Teachers need to reuse questions from exam and workbook PDFs while retaining
formulas and figures, then assemble tests and answer keys from their own
question library.

## Approach

The application detects question boundaries in uploaded PDFs, extracts question
text and LaTeX formulas with Mathpix, and retains figures as image crops.
Teachers can correct and save questions, compose a test from the library, and
download the exam paper and answer key as PDFs. The stack uses a Python API,
worker queue, PostgreSQL, Redis, MinIO object storage, a React web client, and
Docker Compose.

## Status

SoruDepo is being developed in 2026 within the Sera Incubation Programme at
Erciyes Teknopark.
