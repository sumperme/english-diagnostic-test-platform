# EDT Platform — User Guide

English Diagnostic Test (EDT) is a web platform for C1/C2 English assessment. Three roles use it: **Student**, **Teacher**, and **Admin**.

**Production site:** https://eng-diagnostic.tzy667.workers.dev

---

## Roles at a glance

| Role | How to sign in | Main purpose |
|------|----------------|--------------|
| **Student** | Single-use e-voucher code | Take the 72-question test and view personal report |
| **Teacher** | Teacher credential key | View class cohort performance and submissions |
| **Admin** | Admin password at `/admin` | Manage vouchers, user groups, and teacher keys |

---

## How user groups work

A **user group** (e.g. `Class-ENG101`, `General Learner`) links students, teachers, and vouchers:

```
Admin creates user group  →  Admin assigns vouchers to group  →  Student redeems voucher
        ↓
Admin links teacher key to same group  →  Teacher sees that group's submissions
```

- **Default group:** `General Learner` (used when no class is assigned).
- One teacher key maps to **one** user group.
- Deleting a teacher credential resets that group's vouchers to `General Learner`.

---

## Student

### Access

1. Open the site → click **Log in** or **Start Diagnostic Test**.
2. Enter your **e-voucher code** (format `XXXX-XXXX-XXXX`).
3. Complete candidate info (name, ID).
4. Take the **72-question, 60-minute** test.
5. View your **diagnostic report** (12 dimensions, CEFR band, PDF export).

### What students can see

| Data | Access |
|------|--------|
| Own test answers & report | Yes — immediately after submit |
| Cohort percentile (all learners + own group) | Yes — on results screen |
| Other students' names or scores | No |
| Teacher dashboard | No |
| Admin panel | No |

### Notes

- Each voucher is **single-use**. A used code cannot be reused.
- Your user group is set by the voucher admin assigned to your code (shown in your session; you do not choose it).
- Results are stored on the server for teacher cohort reporting; you keep a local copy in the browser during the session.

---

## Teacher

### Access

1. Open the site → nav **For schools**.
2. Scroll to **For Subscribed Teachers**.
3. Enter your **teacher credential key** → **Access Dashboard**.

Alternatively, go directly to `/teacher` after signing in with a key (session is remembered in the browser).

### What teachers can see

Dashboard for **their assigned user group only**:

| Section | Content |
|---------|---------|
| Summary | Total vouchers, used vouchers, submission count |
| Overall stats | Mean, median, std dev; score distribution chart |
| 12 dimensions | Mean and std dev per skill area |
| Student table | Name, ID, test date, CEFR, weak areas, recommendation |
| Question analysis | Correctness rate for all 72 questions (sortable) |

### What teachers can manage

| Action | Allowed |
|--------|---------|
| View cohort data for own group | Yes |
| Export built-in bulk export | No (view on screen only) |
| Change vouchers or user groups | No |
| Create teacher keys | No |

### Notes

- Teachers only see submissions from vouchers in **their** user group.
- If no students have submitted yet, tables show empty / N/A.
- Sign out from the dashboard header when finished.

---

## Admin

### Access

| Environment | URL |
|-------------|-----|
| Production | https://eng-diagnostic.tzy667.workers.dev/admin |
| Local preview | http://localhost:5173/admin |

Sign in with the **admin password** (configured in `wrangler.toml` as `ADMIN_PASSWORD`; ask your platform operator if you do not have it).

### Tab 1 — User Vouchers

Manage student e-vouchers.

| Feature | Description |
|---------|-------------|
| Summary cards | Total, used, available, assigned vouchers |
| Batch generate | Create 1–200 random codes; assign a user group |
| Voucher list | Search, filter, edit per-row metadata |
| User group dropdown | Reassign voucher to any defined group |
| Save per row | Green **Save** when row has unsaved changes |

**Editable voucher fields:** user group, education level, sold to, remark.

### Tab 2 — Teacher Vouchers

Manage teacher access and user groups.

| Feature | Description |
|---------|-------------|
| Add credential | Teacher key + user group (max 30 chars) + optional remark |
| Credential list | Key, group, voucher counts, remark |
| Delete credential | Removes key; vouchers in that group revert to `General Learner` |

**Rules when adding a teacher key:**

- **New user group** → credential is created; group appears in User Vouchers dropdown.
- **Existing group, no key yet** → credential is created and linked.
- **Existing group, already has a key** → error shown; edit or delete the existing row instead.

### What admins can see and manage

| Data | View | Manage |
|------|------|--------|
| All vouchers | Yes | Create, edit metadata, batch generate |
| Voucher usage (used / available) | Yes | — |
| User groups | Yes | Via teacher credentials + voucher assignment |
| Teacher credentials | Yes | Create, edit remark, delete |
| All student submissions (raw) | No direct UI | Stored in D1; exposed via teacher dashboard per group |
| Student personal reports | No | Students see own report only |

### Notes

- Changes to vouchers and credentials affect the **production database** immediately.
- After adding or removing a teacher credential, switch to **User Vouchers** — the user group dropdown updates automatically.
- Local preview (`scripts/local-preview.ps1`) uses a **separate local database**; production data is unchanged.

---

## Data stored per submission

When a student submits a test, the server stores:

| Field | Used by |
|-------|---------|
| Candidate name, ID, test date | Teacher dashboard |
| Total score (0–72) | Teacher stats, percentiles |
| 12 dimension scores | Teacher dimension cards |
| Per-question correctness (72 items) | Teacher question analysis |
| CEFR band, weak areas, recommendation | Teacher student table |
| User group | Scopes teacher access |

---

## Quick reference — who manages what

| Item | Student | Teacher | Admin |
|------|:-------:|:-------:|:-----:|
| Take test | ✓ | | |
| Own report | View | | |
| Class cohort dashboard | | View (own group) | |
| E-voucher codes | Redeem | | Create / edit / batch |
| User groups | | | Define via credentials & vouchers |
| Teacher keys | | Use | Create / delete |
| Voucher metadata (sold to, remark) | | | Edit |

---

## Local testing (developers)

```powershell
.\scripts\local-preview.ps1
```

| Item | Local test value |
|------|------------------|
| Site | http://localhost:5173 |
| Admin | http://localhost:5173/admin |
| Sample voucher | Printed in script output (e.g. `TEST-LOCAL-001`) |
| Sample teacher key | `TEACHER-LOCAL-001` (group: `Class-ENG101`) |

---

## Support

- **Students:** Invalid or used voucher → contact whoever issued your code.
- **Teachers:** Lost credential key → contact your admin.
- **Admins:** Deployment and database → see [CLOUDFLARE_DEPLOYMENT.md](CLOUDFLARE_DEPLOYMENT.md) and [PUBLISH_UI.md](PUBLISH_UI.md).
