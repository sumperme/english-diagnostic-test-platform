# EDT Platform — User Guide

English Diagnostic Test (EDT) is a web platform for CEFR-aligned (C1/C2) English assessment.
It offers **three papers**, and three roles use it: **Candidate**, **Teacher**, and **Admin**.

**Production site:** https://eng-diagnostic.tzy667.workers.dev

---

## Roles at a glance

| Role | How to sign in | Main purpose |
|------|----------------|--------------|
| **Candidate** | E-voucher code | Sit one or more papers and view a personal diagnostic report |
| **Teacher** | Teacher credential key | View class cohort performance across all three papers |
| **Admin** | Admin password at `/admin` | Manage vouchers, user groups, teacher keys, and AI spend |

---

## The three papers

| Paper | Content | Items | Nominal time |
|-------|---------|-------|--------------|
| **Paper I — Applied Grammar & Vocabulary** | Gap-fill MCQs: Part A grammar across **12 dimensions** (60 items) + Part B vocabulary (30 items) | **90** | 60 min |
| **Paper II — Listening & Reading** | Part A listening (20 items, audio plays **once only**) + Part B reading (25 items over **6 shared passages**) | **45** | 60 min |
| **Paper III — Speaking & Writing** | Part A speaking (8 one-shot recorded tasks) + Part B writing (2 tasks) | **10** | ~60 min |

How each is scored:

- **Paper I** — Part A /60 CEFR (with indicative IELTS/TOEFL from that Part A band) plus Part B /30 vocabulary profile; 12-area 0–5 mastery profile. No combined 0–90 CEFR grade.
- **Paper II** — separate conversion grids per part (Listening /20, Reading /25), then an overall level derived from the two part bands.
- **Paper III** — marked asynchronously against rubric bands (`B1/B2`, `C1`, `C2`) per task; speaking answers are transcribed automatically first. See [Paper III marking takes a couple of minutes](#paper-iii-marking-takes-a-couple-of-minutes).

Score-to-CEFR mappings (and the indicative IELTS / TOEFL ranges shown beside them) are stored as
data, not hardcoded — the exact grids are in [`TEST_BANK_GUIDE.md`](TEST_BANK_GUIDE.md). All
mappings are presented as **indicative**, never as exact equivalences.

---

## How user groups work

A **user group** (e.g. `Class-ENG101`, `General Learner`) links candidates, teachers, and vouchers:

```
Admin creates user group  →  Admin assigns vouchers to group  →  Candidate redeems voucher
        ↓
Admin links teacher key to same group  →  Teacher sees that group's results
```

- **Default group:** `General Learner` (used when no class is assigned).
- One teacher key maps to **one** user group.
- Deleting a teacher credential reassigns that group's vouchers to `General Learner`.
- Candidates do not choose their group — it comes from the voucher.

---

## Candidate

### Getting to your paper

The site opens on a landing page with **audience sections** (learners, teachers, universities)
and an **About Us** page reachable from the footer. From there:

```
Landing → audience section / About Us → start CTA → voucher entry
        → candidate info + paper picker → paper → report
```

A note on URLs: the candidate journey is a single-page app. The address bar stays on `/`
throughout — the landing page, marketing sections, voucher entry, candidate info, the paper
itself, and the report are all screens within that one page rather than separate URLs. Only
`/admin` and `/teacher` are distinct paths.

### Steps

1. Open the site and follow the start / log-in call to action.
2. Enter your **e-voucher code** (format `XXXX-XXXX-XXXX`). Codes are case-insensitive.
3. Fill in candidate info: **full name** (required) and your **student / candidate ID**
   (optional — recorded as `N/A` if you leave it blank). Your user group is shown but is not
   editable.
4. **Pick your paper** — Paper I, II, or III. Each option shows how many attempts you have
   left; a paper with none left is disabled.
5. Sit the paper (see below for what each involves).
6. View your **diagnostic report** on screen, optionally generate **AI tutor feedback**, and
   download the **PDF**.

### Before the paper starts

Papers II and III put a hardware check in front of the timer, and the clock does not start
until you press start:

- **Paper II** — a sound check. Play the sample track as many times as you need to set your
  volume. This matters because the real listening clips play only once.
- **Paper III** — a speaker check **and** a microphone check. You record a short sample and
  hear it played back. Start stays disabled until the mic check succeeds.

### What each paper involves

**Paper I** — 90 MCQs, one hour, free navigation between questions. The timer auto-submits when
it reaches zero. Part A grammar items are drawn from a variant pool (one item per slot);
Part B vocabulary stays in fixed order. Marking is server-side, same as Paper II.

**Paper II** — 20 listening items then 25 reading items across 6 passages. Each listening clip
**plays once only**; once you start a clip you cannot replay it, and navigation is locked while
audio is playing. Reading passages stay on screen beside their questions.

**Paper III** — 8 speaking tasks then 2 writing tasks.

- Speaking is **one shot**. A task plays its prompt, gives you a short countdown, then records.
  You cannot re-record, and **navigating away from a task you have started commits it** as your
  answer. Some tasks include preparation time before recording begins.
- Writing gives you two tasks with a word counter and a target word range. Copy and paste are
  blocked.

### Paper III marking takes a couple of minutes

Papers I and II are marked instantly. Paper III is not: your speaking recordings are transcribed
and then graded against rubrics by an AI marker, which runs as a background job.

After you submit, **stay on the page** — the app shows a "being marked" message and waits
(typically well under two minutes) while grading completes, then opens your report. If you close
the tab during this window you will not be able to reopen the report yourself; see below.

### Your report

| Paper | What the report shows |
|-------|----------------------|
| **Paper I** | Overall score /90 with a percentage, overall CEFR level and approximate IELTS/TOEFL (with an "approximate, not official" disclaimer); Part A /60 CEFR band, 12 grammar-area percentage bars (Foundation / Emerging / Approaching / Advanced / Proficient) and radar; strengths, then a priority roadmap with grammar-point notes for the questions you missed; a closing "moving forward" comment; Part B placement with B1–C2 percentage bars, an extra comment when the profile is uneven, and a vocabulary roadmap |
| **Paper II** | Listening, Reading, and overall scores each with a CEFR band; radar chart across the B2 and C1/C2 difficulty groupings |
| **Paper III** | Speaking, writing, and overall scores with their bands and approximate IELTS/TOEFL. No radar chart. |

Reports are in **English only** and never show the test questions, your answers, the correct
answers, or any cohort ranking. On every report you can:

- **Generate AI tutor feedback** — a short personalized summary in English. This can be
  generated **once per completed attempt**.
- **Download the report as a PDF** — rendered server-side in English and branded consistently
  with the on-screen report.

### What candidates can see

| Data | Access |
|------|--------|
| Own report | Yes — as soon as marking finishes |
| Cohort rank or peer comparison | No |
| Other candidates' names or scores | No |
| Questions, own answers, correct answers, transcripts | No — not before or after submitting |
| Teacher dashboard, admin console | No |

### Vouchers: attempts are counted per paper

This is the part most often misunderstood.

- `uses_allowed` on a voucher is an allowance **per paper**, not one use in total. A voucher with
  3 uses allows 3 Paper I attempts *and* 3 Paper II attempts *and* 3 Paper III attempts.
- An attempt is only counted **when you submit**. Signing in does not consume anything, and
  neither does starting a paper and abandoning it.
- Your code stops working only once **every** paper's allowance is used up.
- The paper picker shows the remaining count per paper and disables any paper you have exhausted.

### Reopening a report later

The server supports three ways to re-open a finished report, including its PDF:

| Credential | Who uses it |
|------------|-------------|
| Attempt ID + the original voucher code | Candidate |
| The session token that owns the attempt | Candidate, while still signed in |
| A teacher key whose user group matches the candidate's | Teacher |

> **Caveat — verified in code, worth confirming as a product decision:** there is currently **no
> candidate-facing screen** that accepts an attempt ID and voucher code, and the browser does not
> restore a voucher session after a page reload. In practice a candidate who closes or reloads the
> tab cannot get back to their own report unaided, even though the API would allow it. Download
> the PDF before leaving the report. Teachers can still open Papers II/III reports from their
> dashboard.

### Notes

- Results are stored on the server for teacher cohort reporting.
- The interface is available in **English** and **Traditional Chinese (zh-HK)**; the language
  switcher sits in the top navigation bar. It is not available inside a paper while you are
  sitting it, so set your language beforehand. Reports and their PDFs are always in English.

---

## Teacher

### Access

1. Open the site and go to the **teachers** audience section.
2. Enter your **teacher credential key** and open the dashboard.

Your session is remembered in the browser for that tab, and `/teacher` will restore it. Note that
`/teacher` is **not** a login page — visiting it without an existing session gives you nothing;
always sign in from the teachers section first.

### What the dashboard shows

Everything is scoped to **your assigned user group only**.

Always visible, across the whole cohort:

| Section | Content |
|---------|---------|
| Summary cards | Total vouchers, used vouchers, submission count, Part A mean /60, Part B mean /30 |
| Part A score distribution | Mean, median, standard deviation, and a distribution chart on the Part A /60 bands |
| Dimension performance | Mean per Part A grammar dimension, across the 12 dimensions |

> These three panels are Paper I: Part A is out of 60, Part B out of 30, and the dimensions are the Paper I grammar areas. Use the paper filter below for Papers II and III. After the Paper I bank replace, new Paper I sits are stored as attempts (like Paper II); the dashboard reads those attempts, not the retired `submissions` table.

Then a **paper filter (I / II / III)** switches the detail below it:

| Paper | Detail view |
|-------|-------------|
| **Paper I** | Attempts table: submission time, name, ID, test date, Part A /60, Part B /30, Part A CEFR band, growth areas, AI feedback snippet, and a **PDF** download per row |
| **Paper II** | Attempts table: submission time, candidate, reference, overall band, part scores, grading status, and a **PDF** download per row |
| **Paper III** | Same attempts table plus **Open report** — a detail pane per task with its band, playback of the candidate's recording, the essay text, and the transcript |

At the bottom, **Class AI Overview** generates an AI summary of the cohort for the currently
selected paper, with a history of previously generated overviews. This draws on a quota
(default **20** generations, shared across all three papers, adjustable per credential by an
admin).

### What teachers can and cannot do

| Action | Allowed |
|--------|---------|
| View cohort data and individual results for own group | Yes |
| Open individual Paper I / II / III reports and download their PDFs | Yes |
| Generate a class AI overview per paper | Yes, within quota |
| See other user groups | No |
| Change vouchers or user groups | No |
| Create teacher keys | No |
| Bulk export | No — on-screen only, plus per-candidate PDFs |

### Notes

- Teachers only see results from vouchers in **their** user group.
- If nobody has submitted yet, tables show empty / N/A.
- The dashboard interface is English-only, and teacher-initiated PDF downloads are in English
  regardless of the site language.
- Sign out from the dashboard header when finished.

---

## Admin

### Access

| Environment | URL |
|-------------|-----|
| Production | https://eng-diagnostic.tzy667.workers.dev/admin |
| Local preview | http://localhost:5173/admin |

Sign in with the **admin password**. It is stored as a Wrangler **secret**
(`npx wrangler secret put ADMIN_PASSWORD`), never in a config file — ask your platform operator
if you do not have it. If the secret is unset, the admin API fails closed and returns
`503` rather than allowing access. See [`PUBLISH_UI.md`](PUBLISH_UI.md).

### Tab 1 — User Vouchers

| Feature | Description |
|---------|-------------|
| Summary cards | Totals, plus used counts and submission counts broken down **per paper** (I / II / III), available, assigned |
| Batch generate | Create 1–200 random codes and assign a user group |
| Voucher list | Search and filter (available / used); per-row edit |
| Per-paper usage | Each row shows how many attempts have been used for each paper against the allowance |
| Save per row | Save appears when a row has unsaved changes |

**Editable voucher fields:** user group, education level, sold to, remark, and uses allowed.

The same tab also carries a **DeepSeek API spending** panel: total calls, estimated cost, and a
log showing time, cost, tokens, whether the call was student feedback or a class overview, who
triggered it, and which paper.

### Tab 2 — Teacher Vouchers

| Feature | Description |
|---------|-------------|
| Add credential | Teacher key + user group + optional remark |
| Credential list | Key, group, voucher count, per-paper used/allowed, AI uses used/allowed, remark |
| Edit | Remark and the AI overview quota are editable per credential |
| Delete credential | Removes the key; vouchers in that group revert to `General Learner` |

**Rules when adding a teacher key:**

- **New user group** → credential is created; the group appears in the User Vouchers dropdown.
- **Existing group with no key** → credential is created and linked.
- **Existing group that already has a key** → error; edit or delete the existing row instead.

### What admins can see and manage

| Data | View | Manage |
|------|------|--------|
| All vouchers | Yes | Create, batch generate, edit metadata and allowance |
| Per-paper voucher usage | Yes | — |
| User groups | Yes | Via teacher credentials + voucher assignment |
| Teacher credentials | Yes | Create, edit remark and AI quota, delete |
| AI usage and spend | Yes | — |
| Candidate reports | No direct UI | Stored in D1; surfaced through the teacher dashboard per group |

### Notes

- Changes to vouchers and credentials affect the **production database** immediately.
- After adding or removing a teacher credential, switch to **User Vouchers** — the user group
  dropdown updates automatically.
- The admin console is English-only.
- Local preview uses a **separate local database**; production data is untouched. See
  [`PUBLISH_UI.md`](PUBLISH_UI.md).

---

## What is stored per attempt

| Data | Used by |
|------|---------|
| Candidate name, ID, user group, test date | Teacher dashboard, report header |
| Which paper, start / end time, duration, whether auto-submitted | Report, teacher dashboard |
| The exact question variant served for every slot, and the answer given | Scoring, Paper I missed-question feedback, teacher question analysis |
| Per-part and overall scores, CEFR band keys | Report, teacher stats |
| Per-dimension scores and levels (Papers I–II) | Radar chart and mastery bars, weak areas |
| Paper I feedback codes (which preset comments apply) | Report narratives |
| Paper III: audio recording, transcript, per-task rubric band | Teacher review |
| AI feedback text, once generated | Report, teacher table snippet |

Reports are stored as **layout-free variables** — scores, band keys and Paper I feedback codes,
never rendered text — so the on-screen report and the PDF come from one source. Paper I comment
wording lives in the database (`feedback_items`) and is looked up when the report is shown. The
full specification is in [`DATABASE_README.md`](DATABASE_README.md).

---

## Quick reference — who does what

| Item | Candidate | Teacher | Admin |
|------|:---------:|:-------:|:-----:|
| Sit a paper | ✓ | | |
| Own report + PDF | View | | |
| Class cohort dashboard | | View (own group) | |
| Individual reports in own group | | View + PDF | |
| Class AI overview | | Generate (quota) | Set quota |
| AI tutor feedback on own report | Generate once | | Monitor spend |
| E-voucher codes | Redeem | | Create / edit / batch generate |
| User groups | | | Define via credentials & vouchers |
| Teacher keys | | Use | Create / edit / delete |

---

## Local testing (developers)

```powershell
.\scripts\local-preview.ps1
```

| Item | Local value |
|------|-------------|
| Site | http://localhost:5173 |
| Admin | http://localhost:5173/admin (password from `worker/.dev.vars`) |
| Sample voucher | Printed in the script output |
| Sample teacher key | `TEACHER-LOCAL-001` (user group `Class-ENG101`) |
| Attempts per paper | Reset on every run |

Full details, including what the script seeds and why running the dev servers by hand is not
equivalent, are in [`PUBLISH_UI.md`](PUBLISH_UI.md).

---

## Support

- **Candidates:** invalid or exhausted voucher → contact whoever issued your code.
- **Teachers:** lost credential key → contact your admin.
- **Admins:** deployment, database, and troubleshooting → [`PUBLISH_UI.md`](PUBLISH_UI.md).
