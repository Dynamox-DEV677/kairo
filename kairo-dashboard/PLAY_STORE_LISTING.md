# Kyno — Google Play launch kit

Everything to paste into Play Console. Live URL: https://kairo-daily-edu.vercel.app

---

## 1. Build the Android package (PWABuilder)
1. Go to **https://www.pwabuilder.com** → paste `https://kairo-daily-edu.vercel.app` → **Start**.
2. Click **Package for stores → Android → Generate**.
3. Use these settings (must match the assetlinks file already on the site):
   - **Package ID:** `app.kairo.kyno`
   - **App name:** `Kyno`
   - **Launch URL:** `/`  (the app auto-skips the landing page in standalone mode)
   - **Display mode:** Standalone
   - **Signing key:** let PWABuilder create one (download + KEEP the `.keystore` + password safe — you need it forever) OR use Play App Signing.
4. It gives you a `.aab` (upload to Play) and a **SHA-256 fingerprint**.
5. **Put that SHA-256 into** `public/.well-known/assetlinks.json` (replace the placeholder) → commit → redeploy. This is what removes the browser URL bar in the app.

---

## 2. Store listing

**App name (max 30):**
```
Kyno: AI Study Buddy
```

**Short description (max 80):**
```
Your AI academic twin — solve doubts, master mistakes, and study smarter.
```

**Full description (max 4000):**
```
Meet Kyno — the AI learning companion that actually adapts to you.

Kyno builds a living "academic twin" of how you learn: it tracks what you've
mastered, what you're forgetting, and exactly what to revise next — so you
never waste time guessing what to study.

WHAT YOU CAN DO
• Solve any doubt — type it or snap a photo, and Kyno explains it step by step.
• Fix your mistakes — turn every wrong answer into real understanding.
• Simulate exams — practise the real thing before it counts.
• AI notebook, flashcards & concept maps — built around your syllabus.
• Stay motivated — earn XP, climb the weekly League, and keep your streak alive.

MADE FOR STUDENTS
Kyno works for school students and self-learners alike. Set your class, board
and goals once, and every explanation is tuned to you.

Learn faster. Think smarter. Achieve more.
Kyno — by Kairo Industries.
```

**Category:** Education
**Tags:** Education, Learning, Study, AI
**Contact email:** kairoindustries.cor@gmail.com
**Privacy policy URL:** https://kairo-daily-edu.vercel.app/privacy.html

---

## 3. Graphics
- **App icon (512×512):** use `public/kairo_icon_512.png` (the black squircle logo). ✅ ready
- **Feature graphic (1024×500):** `out/kyno-feature-graphic.png` (generated). ✅ ready
- **Phone screenshots (need 2–8, 9:16, min 1080px tall):** capture these screens on your phone from the installed PWA — see plan below.

### Screenshot plan (capture in this order)
1. **Home** — greeting + your stats/brief.
2. **Kyno chat** — asking a question, step-by-step answer.
3. **Solver** — a solved problem.
4. **Concept Map** — the mind-map of topics.
5. **League / XP** — the leaderboard + streak.
> Tip: on your phone, open the PWA (Add to Home screen), go to each screen, take a screenshot. Portrait, clean, no personal info.

---

## 4. Content rating questionnaire (answer honestly)
- Violence / sexual / drugs / gambling: **No** to all.
- **User-generated content / user interaction:** Yes — users type questions to an AI and there's a leaderboard with names. (Expect an **Everyone / PEGI 3** rating.)

## 5. Data safety form (declare this)
Data collected: **Name, Email, App activity (your questions & progress)**.
- Purpose: **App functionality + personalisation**.
- Shared with third parties: processed by AI providers (Groq/OpenRouter) to generate answers — declare as "shared for app functionality".
- Encrypted in transit: **Yes**.
- Users can request deletion: **Yes** (via the email in the privacy policy).

## 6. Target audience
- Age groups: includes teens (13+). If you select under-13, Google's **Families** policy + extra requirements apply — simplest is to target **13+**.

---

## 7. The launch checklist (Sunday onward)
- [ ] Parent registers Play Console ($25, Personal account)
- [ ] Identity verification clears (Google, ~2–5 days)
- [ ] Upload the `.aab` from PWABuilder
- [ ] Paste the SHA-256 into assetlinks.json → redeploy
- [ ] Fill listing (above), graphics, content rating, data safety, privacy URL
- [ ] Create a **Closed testing** track → add ~20 testers → run **14 days**
- [ ] Apply for **Production access** → Google review → **live**
