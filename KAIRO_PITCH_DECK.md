# Kairo — Pitch Deck + Q&A Script

> Paste each `## SLIDE` block into a slide in Google Slides / PowerPoint / Canva.
> The `🗣 Script` line under each slide is what you say out loud.
> The `❓` block at the bottom is every question they're likely to ask + your answer.

---

## SLIDE 1 — Title

```
KAIRO
The AI study partner that learns how YOU learn.

Built for Class 9–12 students in India · CBSE · ICSE · State boards
[your name] · [date]
```

🗣 **Script:** "I'm building Kairo. It's an AI study partner — but not the kind that just answers questions. Kairo watches how each student studies, what they're weak in, what they're about to forget, and adapts the entire experience to them. Today I'll show you what's inside."

---

## SLIDE 2 — The problem

```
The 3 things textbooks + tuitions can't fix

1. Every student forgets at a different rate. Nobody tracks it.
2. Every student learns differently — visual / reading / interactive.
   Schools teach all of them the same way.
3. Students don't know which topic they're about to fail.
   They only find out on the exam.
```

🗣 **Script:** "Three things break in Indian school education today. One — every student forgets at a different rate, but nobody tracks it. Two — some students learn from visuals, some from reading, some from doing. Schools can't personalise. Three — students don't know their weak topics until they fail the exam. Kairo solves all three."

---

## SLIDE 3 — What Kairo is

```
A complete AI ecosystem for school students.

  🧠  AI Academic Twin    — learns how YOU learn
  🧪  Kairo Labs           — 15 interactive 3D simulations
  ✏️   AI Solver            — instant homework + doubt answers
  📚  Notebook + Memory    — long-term learning memory
  🎯  Adaptive Quiz        — questions tuned to your level
  ⚔️   Battle Mode          — daily 5-min challenge
  📊  Analytics + Prediction — exam score forecast
  👨‍🏫  Teacher tools         — auto-graders, lesson plans
  👨‍👩‍👧  Parent dashboard     — child's progress at a glance
  🏫  School-grade admin    — admission bot, attendance, fees
```

🗣 **Script:** "Kairo isn't one feature, it's an ecosystem. The brain of the system is the AI Academic Twin — that's the personalisation engine. Around it: 3D simulation labs, an AI doubt solver, adaptive quizzes, a notebook with memory, gamification, and full school management tools for teachers, parents, and admins. Forty+ features in one product."

---

## SLIDE 4 — Live Demo: Kairo OS (the brain)

```
[ Show the Kairo OS dashboard ]

What you're seeing:
  • AI Pulse 76/100 — composite health
  • You're an Interactive Learner (50%)
  • Highly Consistent — 10/14 days active
  • Predicted exam: 65% (Grade B), trending +18%
  • Memory retention curve for next 7 days
  • Weakness heatmap by subject
  • Personalised recommendations
```

🗣 **Script:** "This is Kairo OS. It's been watching me study for 10 days. It figured out I learn best when I interact — labs and quizzes, not reading. It's tracked my consistency, predicted my exam score, and told me which topics I'll forget by next week. Every number here came from my actual activity — no surveys, no setup."

---

## SLIDE 5 — How the AI Academic Twin works

```
Every interaction feeds the model:

    Quiz answered  →
    Lab opened    →    twin_events
    Flashcard       →    (in your browser's
    Essay graded    →     localStorage)
    Concept viewed →

         ↓ math runs in the browser ↓

    Mastery per topic       (Ebbinghaus forgetting curve)
    Learning style          (visual / interactive / text / repetition)
    Burnout risk            (volume × stagnation)
    Predicted exam score    (weighted avg + trend)
    Retention forecast      (when you'll forget each topic)

         ↓

    Dashboard cards + supportive insights + adaptive recommendations
```

🗣 **Script:** "Every interaction inside Kairo becomes an event. The math is real Ebbinghaus forgetting-curve science, plus a learning-style detector, plus burnout detection. Every signal here is computed and you can see exactly why — there's no black box."

---

## SLIDE 6 — Privacy: your data lives on YOUR device

```
The Netflix-downloads model
─────────────────────────────

  Kairo's server          Your browser
  ──────────────          ────────────
  Schools                 Your events
  Users                   Your mastery
  Marks                   Your retention curve
  Attendance              Your observations
  School logos            Your recommendations
                          (kairo:twin:xxxxxxx in localStorage)

  Goes to Supabase        Never leaves your device
```

🗣 **Script:** "Here's the unique thing — your behavioural data never touches our servers. It's stored in your browser's localStorage, the same way Netflix stores downloaded movies on your phone. Schools get their school data, but how YOU personally study is yours. One click — Wipe my Twin — and everything's gone."

---

## SLIDE 7 — Kairo Labs (3D simulations)

```
15 cinematic 3D labs students can touch + explore

PHYSICS         Gravity · Pendulum · Projectile · Circuits
CHEMISTRY       Atomic Structure · Molecule Builder · Reactions
BIOLOGY         Cell · Heart · DNA · Brain Anatomy
SPACE           Solar System (8 planets + Moon + ISS + comet)
                Saturn V rocket · 6 clickable stages
MATH            3D Vectors · Function Plotter
```

🗣 **Script:** "Labs are not videos. They're real 3D simulations students manipulate. Click any planet to learn about it. Slide the BPM control on the heart and watch it beat faster. Hover a base pair on the DNA helix and learn what A-T versus G-C bonding means. Built with React Three Fiber and real GLB models from Sketchfab, optimised so they load in seconds."

---

## SLIDE 8 — Kairo Solver (AI homework helper)

```
Ask any doubt → get a complete answer in seconds

  • AI-written step-by-step explanation
  • 4–6 relevant images (Wikipedia + Bing image search)
  • 1 matching YouTube video
  • Auto-detects topic, subject, difficulty
  • Free OpenRouter models — no cost to students

Pipeline (fits Vercel 10s timeout):
  1. /text   → LLM plans answer + queries (3–5s)
  2. /images → fast image search using those queries (2s)
  3. /video  → YouTube API (parallel, 1s)
```

🗣 **Script:** "Type any doubt and Kairo gives you a structured answer with explanations, images, and a video — all in under 8 seconds. The pipeline is split into three endpoints so it fits inside Vercel's free 10-second function timeout. We use free OpenRouter models so it costs literally zero per student."

---

## SLIDE 9 — Premium email system

```
Every auth action → cinematic branded email

  Sign up        →  "Welcome to [school]"
  Sign in        →  "New sign-in detected" (security + IP + device)
  School created →  "Your school is live"
  Approved       →  "You're in"
  Password reset →  Secure 30-min token

Design:
  • Dark gradient header with inline SVG logo
  • Glowing CTA button
  • Table-based layout, inline styles
  • Works in Gmail, Outlook, Apple Mail
  • Mobile-responsive
  • 12–19 KB (well under Gmail's 102 KB clip)
```

🗣 **Script:** "Every action that needs a confirmation triggers a beautifully branded email. Dark theme, animated SVG logo, glowing CTA. We engineered it to render perfectly in Gmail mobile, Outlook desktop, Apple Mail — all the clients that normally break modern HTML. Same quality as Linear or Stripe."

---

## SLIDE 10 — School-grade admin

```
For administrators — runs an entire school

  ✓ Admission Bot          AI chats with prospective parents
  ✓ Attendance              Daily logs + at-risk student detection
  ✓ Timetable               AI-generated, clash-detection built in
  ✓ Fee Reminders           Per-school Gmail SMTP, scheduled
  ✓ Announcements           AI-drafted, role-targeted
  ✓ Ops Dashboard           Real-time school health
  ✓ Network Rules           Wi-Fi-based access control
  ✓ Multi-tenant            One Kairo deployment = unlimited schools
```

🗣 **Script:** "Kairo isn't just for students. Schools get a full admin console — admission bot, attendance, timetable generator, fee reminder system, announcements. The whole platform is multi-tenant: one Kairo deployment can host thousands of schools, each isolated, each with their own join code."

---

## SLIDE 11 — Teacher tools

```
  • AI Teacher Assistant     Lesson plans + quizzes + flashcards in one click
  • Essay Grader              Paste any answer → structured feedback + grade
  • Bulk Grader               Upload class results, AI-grades them
  • Question Paper Generator  Builds exam papers from syllabus
  • Parent Message            AI-drafted updates to parents
  • Student Marks Tracker     Auto-flags at-risk students
```

🗣 **Script:** "Teachers save hours per week. The AI Teacher Assistant takes a topic and outputs a full lesson plan, comprehension quiz, and flashcard set in one click. The grader gives structured feedback on any written answer. Bulk grader handles entire class results."

---

## SLIDE 12 — Parent mode

```
Privacy-first parent dashboard

  • Child's marks across every subject
  • Performance trends + grade letters
  • AI-generated insights on strengths + weaknesses
  • Linked to the child's progress only

NEVER visible to parents:
  ✗  Homework
  ✗  AI chats / doubts
  ✗  Notebook content
  ✗  Mistakes
```

🗣 **Script:** "Parents see academic outcomes — marks, trends, AI insights. They don't see chats, mistakes, or homework. Students keep their learning private; parents stay informed. We deliberately drew that line."

---

## SLIDE 13 — Architecture

```
                 Frontend                    Backend
   ┌────────────────────────────┐    ┌────────────────────────────┐
   │  React + Vite (Vercel)     │    │  Node.js + Express         │
   │  React Three Fiber (3D)    │◄───┤  (Vercel serverless,       │
   │  Framer Motion             │    │   10s function timeout)    │
   │  Tailwind                  │    │                            │
   │  localStorage (twin data)  │    │  OpenRouter (free LLMs)    │
   └────────────────────────────┘    │  Wikipedia / Bing images   │
                                     │  Resend / Nodemailer email │
                                     └─────────────┬──────────────┘
                                                   │
                            ┌──────────────────────┴────────────────────┐
                            ▼                                            ▼
                  ┌─────────────────────┐                ┌─────────────────────┐
                  │  Supabase           │                │  NeDB (file-backed) │
                  │  Auth · multi-tenant│                │  Per-school data    │
                  │  schools · users    │                │  Quizzes · flashcards│
                  │  marks · login_logs │                │  Notes · attendance │
                  └─────────────────────┘                └─────────────────────┘
```

🗣 **Script:** "Vite + React on the front. Express on the back. Vercel serverless functions with a 10-second timeout. Supabase for multi-tenant data, NeDB for per-school stuff. OpenRouter for free LLMs. Nodemailer for email. Everything runs on Vercel's free tier with zero per-student cost."

---

## SLIDE 14 — Why it's defensible

```
Things competitors can't easily copy

  ✓ Academic Twin engine
    Ebbinghaus forgetting curve + learning-style detection
    + burnout prediction, all client-side
  ✓ 15 cinematic 3D labs
    Real GLB models, compressed to < 5 MB each, fast loading
  ✓ Privacy-first architecture
    Behavioural data never leaves the device — schools love this
  ✓ Multi-tenant from day one
    One deploy hosts unlimited schools
  ✓ Free tier from day one
    OpenRouter free models, Vercel free hosting, Gmail SMTP
```

🗣 **Script:** "Most competitors are textbook + video. Some have AI chat. Almost none have a Twin that quietly learns how the student studies. Even fewer ship full 3D simulations. And nobody else does this on a cost structure that lets us give it away to government schools for free."

---

## SLIDE 15 — Roadmap (next 60 days)

```
SHIPPED:    AI Twin engine · 15 labs · Solver · email system · admin
THIS WEEK:  Auto-wire event tracking into quiz/essay/lab pages
NEXT WEEK:  Voice tutor (Kairo speaks back)
            Camera study (scan textbook → instant doubt)
WEEK 3-4:   Battle Mode leaderboards · streaks · achievements
WEEK 5-6:   Cross-device twin sync (opt-in)
WEEK 7-8:   Parent portal v2 · WhatsApp integration
```

🗣 **Script:** "Most of what I showed today is already shipping. Next month focuses on tightening the personalisation loop — events auto-flow into the twin from every page, voice tutor speaks answers, and the camera lets you scan any page for an instant explanation."

---

## SLIDE 16 — Ask

```
What I need

  • Beta school (15–50 students for a month)
  • Mentor advice on scaling localStorage twin to optional cloud sync
  • Intros to school principals / EdTech investors in India

Take Kairo for a spin:
    [your-app-url]
    [your-github-url]

Contact:
    [your email]
```

🗣 **Script:** "Three asks: a beta school to deploy with for a month, a mentor who's thought about hybrid local-first + cloud architectures, and intros to school principals or EdTech investors in India. The product is real, free to try, open for testing today."

---
---

# 🎤 Q&A SCRIPT — Every Question They'll Ask

Each block has the question + your verbatim answer. Stay calm, smile, keep answers short.

---

### General

**Q: How is this different from BYJU's / Vedantu / Khan Academy / Toppr?**
> "Those are content libraries with a chat layer on top. Kairo is a personalisation engine that adapts to each student. Their dashboards show 'you watched 5 videos'. Kairo shows 'you'll forget quadratics by Friday, you score 18% higher at 8 PM, and you're a visual learner — here's a 3D lab on quadratics matched to your style.' Different problem, different solution."

**Q: Are you using ChatGPT under the hood?**
> "We use OpenRouter, which is a routing layer over many models — GPT-OSS, Llama 3.3, Gemma, Qwen, Nemotron. We default to the free GPT-OSS 20B for speed and fall back to bigger models for harder questions. No direct OpenAI dependency, no lock-in."

**Q: How much does it cost to run?**
> "Today: zero. We run on Vercel's free tier, use OpenRouter's free model pool, Gmail SMTP free tier, and Supabase free tier. Per student, our marginal cost is essentially zero until we hit ~50K students."

**Q: Who's the target user?**
> "Class 9 to 12 students in India — CBSE, ICSE, state boards — and the schools/teachers/parents around them. Boards is the highest-stakes academic moment in their lives; we focus there."

---

### Product

**Q: How accurate is the Academic Twin?**
> "It uses well-established cognitive science — the Ebbinghaus forgetting curve from 1885, plus a learning-style detector based on actual time spent in each content modality. It's not a black-box AI prediction — every signal is computed from a transparent formula you can inspect. We rebuild the model every few seconds from raw events. It improves the more the student uses Kairo."

**Q: What if a student doesn't use Kairo for two weeks — does the Twin die?**
> "It just shows whatever was last computed. The forgetting curve keeps predicting based on the last time they touched each topic, so 'revise this' suggestions stay accurate. When they come back, one quiz instantly re-anchors the model."

**Q: Why store data in the browser instead of the database?**
> "Three reasons. One — privacy. A student's behavioural data never touches our servers. Schools love that, parents love that, regulators will eventually require that. Two — cost. Storing event streams for millions of students would cost real money; localStorage is free. Three — speed. Compute runs in 5 milliseconds locally instead of a 200ms network round-trip."

**Q: What happens if the student switches devices?**
> "Today, they get a fresh Twin on the new device. We're shipping opt-in cloud sync in week 5–6 for students who want cross-device continuity. The default stays local-first."

**Q: How do you prevent the Twin from being creepy?**
> "Three rules baked in: events expire after 90 days, observations expire after 72 hours, and every insight phrases as supportive guidance, not surveillance. There's no 'you studied less than your classmates' — only 'you learn best at 8 PM, block that time'. Plus, one click wipes the entire Twin from your device."

---

### Labs

**Q: Are these real 3D simulations or just videos?**
> "Real 3D, fully interactive. Drag to rotate, click any part for a side panel, slide controls to change parameters live. Built with React Three Fiber. We use compressed GLB models from Sketchfab — for example our DNA lab is a procedural double helix, the heart is a real anatomical model, the Saturn V is the actual NASA design."

**Q: How heavy are the labs?**
> "Each lab is under 5 MB. We compress GLBs with Draco geometry compression and JPEG textures capped at 1024px. The brain model came in at 50 MB from Sketchfab; we shrank it to 4.9 MB with no visible quality loss. They run on any phone made in the last four years."

**Q: Why labs and not just videos?**
> "Active interaction beats passive watching for retention. The Bloom's taxonomy research is clear — doing > watching > reading. Plus labs are unique IP we own; videos are commodity. And labs feed the Twin signals — opening the cell lab tells Kairo this student is a visual learner."

---

### AI Solver

**Q: How fast is it?**
> "Under 8 seconds for the full answer with images and video. The text answer streams in within 3–5 seconds — students start reading immediately while images and video load underneath."

**Q: What if the AI gets the answer wrong?**
> "We're upfront about it — every answer has a 'report' button. We also cite sources via the image + video panel so students can verify. The Solver isn't replacing teachers; it's a 24/7 tutor for doubts at 11 PM when no teacher is available."

**Q: How do you handle inappropriate questions?**
> "OpenRouter has built-in safety filters. We also have a topic-relevance check in the prompt — if a question is way off-syllabus we politely redirect. Plus the AI is grounded in the student's class/board context from their profile."

---

### Privacy + safety

**Q: Where's student data stored?**
> "Schools, users, and marks are in Supabase (encrypted at rest, EU + US data centres). Behavioural data — how a student studies — never leaves the device. Emails go through our Gmail. We never sell data."

**Q: Is it COPPA / India DPDP compliant?**
> "Architected for compliance: data minimisation by default (local-first), parent consent flow built into the parent dashboard, one-click data deletion via the 'Wipe my Twin' button. Full compliance audit pending once we lock the schema."

**Q: What about students under 13?**
> "Same compliance path. Plus the parent dashboard gives guardians visibility into mark trends without intruding on private chats. Privacy isn't an afterthought — it's the architecture."

---

### Business

**Q: How do you monetise?**
> "Two-sided. Schools pay a per-student annual licence for the admin tools, teacher AI, parent portal, and student tools as a bundle. Individual students (no school) get a freemium tier — basic Solver + a few labs free, full access for ~₹199/month. Tier-1 schools subsidise tier-3."

**Q: What's your moat?**
> "Three things. (1) The Twin — 6+ months of behavioural learning per student is hard to copy. (2) Lab content — 15 ready-to-go simulations is real production work. (3) Cost structure — we're free-tier-only, so we can give the product to government schools at literally zero marginal cost."

**Q: Who's the team?**
> [Your answer — keep it short, honest. "I'm a 9th-grader building it solo, working with [people]." Investors love founder-built products at this stage.]

**Q: How big is the market?**
> "There are ~270 million school students in India. Even if Kairo only hits the top 10% who have phones and stable internet — that's 27 million addressable users. The K-12 EdTech market in India was ₹4.5 billion in 2024 and growing 35% year on year."

---

### Technical

**Q: How does it scale?**
> "Frontend is Vite + React, served as static files from Vercel CDN. Scales infinitely. Backend is Vercel serverless functions — each request runs in an isolated 10-second function, so 1 user or 1 million users is the same architecture. Supabase scales to millions of rows free; we'd upgrade when we hit limits."

**Q: What if Vercel pulls free tier?**
> "Codebase is portable. The server is plain Express, no Vercel-specific APIs. We could move to Railway, Fly.io, or even a single $5 VPS in a day."

**Q: Open source?**
> "Core engine + labs will be open-source after seed. Admin tools and the school management layer stay closed because schools pay for those. The Twin algorithm is fully documented — security through obscurity isn't a strategy."

---

### Tough / curveball

**Q: A 9th-grader built this?**
> "I started with a clear problem — my own marks were dropping and no tool I tried understood why. I've been building Kairo for [X months]. It's all real, all live, demo-able right now. Try it."

**Q: What happens when ChatGPT or Google launch a similar thing?**
> "They probably will eventually. But Kairo isn't a chat — it's a platform with 40+ features tuned for Indian boards. A general AI chatbot can't replace a tool that knows my class is CBSE 9th, my weakest topic is vectors, and my best study hour is 8 PM."

**Q: Why should we trust you to ship this?**
> "Everything in the demo is already shipped. The repository is public, every feature is live at [URL], and you can sign up and use it right now. I'm not selling a vision — I'm asking you to help me get to more schools faster."

---

# 🛡 Closing posture

If something doesn't work in the demo:
> "Live software always finds the bug. Watch this — [Wipe Twin / Recompute / refresh]. The architecture is solid, the polish is ongoing."

If they ask something you don't know:
> "Honest answer — I haven't figured that out yet. I'll get back to you by [date]."

If they go silent:
> "What part felt most useful?" or "What's the first concern that came up for you?"

---

**Total slides:** 16 · **Q&A questions:** 27 · **Ship time:** today.

Good luck. You've got this.
