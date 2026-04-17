# DECK · by IMPRESUB

> Where the ocean ends, the report begins.

A cinematic, single-page interactive prototype for **DECK** — a conversational AI co-worker for offshore engineers, built into the one app they already trust. **WhatsApp in. ERPNext out. Nothing in between.**

Built as a pitch concept for **IMPRESUB** (offshore marine services).

---

## ▶ Live Demo

Open `index.html` in any modern browser. No build step. No dependencies.

```bash
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

Or serve locally:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

---

## 🎬 What's inside

A 9-scene cinematic film that plays end-to-end when you press **Begin**:

| Scene | Story beat |
|---|---|
| 01 · CAIRO HQ | Maged the CEO forwards an email → DECK creates the project |
| 02 · THE SETUP | Technical review → cost sheet → quotation → AWARDED |
| 03 · MOBILIZATION | Crew walks to vessel · cranes load equipment |
| 04 · ON STATION | DSV Saturn at Block 9 |
| 05 · SUBSEA −42 m | Diver inspects anode, captures photos |
| 06 · ON DECK | Marco files the daily report by voice note |
| 07 · THE INVOICE | DPR approved → invoice auto-issued |
| 08 · PAYABLES | Supplier email → PO → AP recorded |
| 09 · END CARD | Credits roll · pilot CTA |

Plus an **interactive WhatsApp-style demo** below the film where you can type messages to the agent yourself.

---

## ✨ Features

- **9-scene cinematic auto-play film** in fullscreen
- **Interactive WhatsApp chat simulation** (type, voice-note, expense, mess-hall mode)
- **Live ERPNext mock dashboard** that fills itself as the chat progresses
- **Cartoon characters** — Maged, Marco, the diver, the deck crew
- **Drilling vessel SVG** with derrick, helideck, living quarters, bow wake
- **Helicopter** that flies in and lands on the helideck
- **Web Audio API** sound design — chimes, swooshes, camera clicks (no external files)
- **English ↔ Arabic toggle** with RTL support
- **Live clock + ticker** on the HQ panel
- **Chapter navigation strip** in fullscreen
- **Scene title cards · iris transitions · cursor auto-hide**
- **End card** with credits, replay button, pilot CTA
- **Trust badges** (ISO 9001/14001/45001, audit-ready, self-hosted)
- **12 IMPRESUB service tiles** (Diving · ROV · Subsea Construction · etc.)

---

## 🎨 Design language

- **Palette:** deep navy (`#0A1628`) dominant · ocean teal accents · orange (`#FF6B35`) reserved for action only
- **Typography:** Inter (UI) · Space Grotesk (display, ALL-CAPS) · JetBrains Mono (data, IDs, timestamps)
- **Aesthetic:** industrial cinematic with friendly Pixar-style characters

Inspired by [impresub.com](https://www.impresub.com)'s brand language — deep blues, technical authority, 50 years of offshore heritage.

---

## 🛠 Stack

- **HTML5** · pure semantic markup
- **CSS3** · custom design system, CSS animations, no frameworks
- **Vanilla JavaScript** (ES6+) · single IIFE, ~1,500 lines
- **SVG** · all illustrations hand-coded
- **Web Audio API** · all sounds generated programmatically, zero external files

**Total:** 3 files (`index.html`, `styles.css`, `script.js`). No build. No npm. No CDN dependencies (except Google Fonts).

---

## 🎯 Pitch summary

The prototype answers a single question:

> *Why are offshore engineers still filling out forms in 2026?*

Because every previous attempt — better forms, mobile apps, training — failed. The problem was never the form. The problem is that a form exists at all.

**DECK eliminates the interface.**
The engineer talks. The agent listens. ERPNext fills itself.

---

## 📜 Disclaimers

This is a **concept prototype**. Not affiliated with WhatsApp / Meta or ERPNext / Frappe. The IMPRESUB logo is referenced from their public CDN under fair use for client-pitch context.

---

## 👤 Created by

**Mohamed Zaghloul**
mo_zaghloul@icloud.com

A prototype made with ◆ in Cairo · 2026
