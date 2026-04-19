# Box Schedule — QA Testing Guide

**Audience:** QA Engineers, Test Leads, Product Managers, Stakeholders
**Module:** Box Schedule (production calendar)
**Platforms under test:** Web (React), iOS (SwiftUI), Android (Kotlin)
**Backend:** Location microservice (port 5003), V2 API
**Document version:** 1.0
**Last updated:** 17 April 2026

---

## Table of Contents

1. [Test Environment Setup](#1-test-environment-setup)
2. [Test Data & Accounts](#2-test-data--accounts)
3. [Authentication Flow](#3-authentication-flow)
4. [Feature 1 — Schedule Type Management](#4-feature-1--schedule-type-management)
5. [Feature 2 — Create Schedule](#5-feature-2--create-schedule)
6. [Feature 3 — Conflict Resolution (409)](#6-feature-3--conflict-resolution-409)
7. [Feature 4 — Calendar View (Month/Week/Day)](#7-feature-4--calendar-view)
8. [Feature 5 — List View (By Date / By Schedule)](#8-feature-5--list-view)
9. [Feature 6 — Day Detail Page](#9-feature-6--day-detail-page)
10. [Feature 7 — Edit Schedule (Block + Single Day)](#10-feature-7--edit-schedule)
11. [Feature 8 — Delete Schedule / Event / Note](#11-feature-8--delete-schedule--event--note)
12. [Feature 9 — Create Event](#12-feature-9--create-event)
13. [Feature 10 — Create Note](#13-feature-10--create-note)
14. [Feature 11 — Set Default Preferences](#14-feature-11--set-default-preferences)
15. [Feature 12 — Activity History](#15-feature-12--activity-history)
16. [Feature 13 — Share Schedule](#16-feature-13--share-schedule)
17. [Feature 14 — Dark/Light Theme](#17-feature-14--darklight-theme)
18. [Cross-Platform Parity Checklist](#18-cross-platform-parity-checklist)
19. [Edge Cases & Negative Tests](#19-edge-cases--negative-tests)
20. [Bug Reporting Template](#20-bug-reporting-template)

---

## 1. Test Environment Setup

### Backend
- Base URL (dev): `http://localhost:5003/api/v2/box-schedule`
- Base URL (staging): `https://staging.zillit.com/api/v2/box-schedule`
- MongoDB: Atlas cluster
- Auth header: `moduledata` (AES-256-CBC encrypted)

### Web
- URL: `http://localhost:3000` (dev), `https://staging.zillit.com` (staging)
- Browsers: Chrome 120+, Safari 17+, Firefox 121+, Edge 120+
- Recommended viewports: 1920×1080, 1440×900, 1024×768

### iOS
- Min iOS version: **14.0**
- Test devices:
  - iPhone SE (3rd gen) — small screen
  - iPhone 15 / 15 Pro — standard
  - iPhone 15 Pro Max — large
  - iPad (10th gen) — tablet
- Simulators: Xcode 15+ with iOS 14.5, 16.4, 17.5

### Android
- Min SDK: **24** (Android 7.0)
- Test devices:
  - Pixel 4a (small) — API 30
  - Pixel 7 (standard) — API 33
  - Samsung Galaxy S23 — API 34
  - Tablet: Pixel Tablet — API 33
- Emulator profile: Pixel 5 API 34 baseline

---

## 2. Test Data & Accounts

### Default Test Project
- **Project ID:** `69bc4dec1abadbe2feeb575c`
- **Project Name:** "Test Production"

### Test Users
| Name | Role | Email |
|------|------|-------|
| Alice Manager | Production Manager | alice@test.com |
| Bob Director | Director | bob@test.com |
| Charlie AD | Assistant Director | charlie@test.com |

### Pre-loaded Schedule Types (System)
| Type | Color | Notes |
|------|-------|-------|
| Prep | Orange `#F39C12` | Cannot delete |
| Shoot | Red `#E74C3C` | Cannot delete |
| Wrap | Green `#27AE60` | Cannot delete |
| Day Off | Gray `#95A5A6` | Cannot delete |
| Travel | Blue `#3498DB` | Cannot delete |

### Test Calendar Data
- Today's date references should use system clock
- "Past" tests need backdated existing data — use the seed script: `node backend/scripts/seedBoxSchedule.js`

---

## 3. Authentication Flow

### TC-AUTH-01: First-time Login
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open the app | Login screen with project picker is shown |
| 2 | Tap a project tile | User picker shows for that project |
| 3 | Tap a user | App navigates to Box Schedule home |
| 4 | Force-quit and reopen | App opens directly to Box Schedule (session restored) |

### TC-AUTH-02: Logout
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open drawer (☰ icon) | Drawer slides from right |
| 2 | Tap logout icon at bottom | App returns to project picker |
| 3 | Reopen app | Login required again |

### Validation
- ✅ All API calls must include the `moduledata` header
- ❌ Calls without the header should return 401
- ❌ Expired session (timestamp > 24h old) should re-prompt login

---

## 4. Feature 1 — Schedule Type Management

### TC-TYPE-01: View System Types
**Steps:**
1. Open drawer → tap **Edit Types**
2. Observe the list

**Expected:**
- 5 system types appear: Prep, Shoot, Wrap, Day Off, Travel
- Each shows colored circle + name + "SYSTEM" badge
- System types do NOT show edit/delete buttons

### TC-TYPE-02: Create Custom Type
**Steps:**
1. In Type Manager, scroll to "Add Custom Type" section at bottom
2. Type "Rehearsal" in the name field
3. Tap the colored circle to change color
4. Tap **+ Add**

**Expected:**
- New type "Rehearsal" appears in the list with chosen color
- Toast: "Type created successfully"
- Type is now selectable in Create Schedule
- API call: `POST /types {title: "Rehearsal", color: "#9B59B6"}`

**Validation:**
- ❌ Empty name → Add button disabled
- ❌ Duplicate name → Toast: "A type with this name already exists"
- ❌ Whitespace-only name → Add button disabled (trim before validate)
- Maximum length: 50 characters

### TC-TYPE-03: Edit Custom Type
**Steps:**
1. Tap pencil icon on a custom type (not system)
2. Modify name and tap ✓

**Expected:**
- Name updates in list
- Toast: "Type updated"
- All schedules using this type now show new name

### TC-TYPE-04: Delete Custom Type
**Steps:**
1. Tap trash icon on a custom type
2. Confirm in alert dialog

**Expected:**
- Confirmation alert: "Are you sure you want to delete 'Rehearsal'?"
- After confirm → type removed from list
- Schedules using this type retain the deleted name (denormalized)

**Validation:**
- ❌ Cannot delete system types (no trash icon shown)
- ❌ Cancel button keeps the type

---

## 5. Feature 2 — Create Schedule

### TC-CREATE-01: Date Range Mode (Set by Days)
**Steps:**
1. Drawer → **Create Schedule**
2. Tap type field → select "Prep"
3. Date Range tab is selected by default
4. "Set by Days" is selected by default
5. Tap Start Date → pick today's date
6. Set Number of Days = 5 (use type input or +/- buttons)
7. Observe summary bar
8. Tap **Save Schedule**

**Expected:**
- Summary shows: "5 day(s): Apr 17 – Apr 21, 2026"
- Save creates schedule successfully
- Toast: "Schedule created successfully"
- Returns to home → calendar shows the 5 days highlighted in orange

**Validation:**
- ❌ Number of Days must be ≥ 1 (- button disabled at 1)
- ❌ Save button disabled if no type selected
- ❌ Save button disabled if no dates
- ✅ Past dates are disabled in date picker

### TC-CREATE-02: Date Range Mode (Set by End Date)
**Steps:**
1. Open Create Schedule
2. Select type
3. Toggle to "Set by End Date"
4. Pick start date = today
5. Pick end date = today + 7 days
6. Save

**Expected:**
- Summary shows 8 day(s)
- End date picker minimum = start date

**Validation:**
- ❌ End date < start date should be impossible (minimum date enforced)

### TC-CREATE-03: Calendar Mode (Multi-pick)
**Steps:**
1. Open Create Schedule
2. Select type
3. Tap **Calendar** tab
4. Tap several individual dates (e.g., Apr 1, Apr 5, Apr 8, Apr 12)
5. Verify selected dates appear as removable tags below
6. Save

**Expected:**
- Each tap toggles selection (highlighted dark)
- Tags show below grid: "Mon, Apr 1", "Fri, Apr 5", etc. with ✕ button
- Tap ✕ on a tag → removes that date
- Selected count: "4 date(s) selected" in green
- Save creates 4 separate days
- Calendar shows 4 non-consecutive highlighted cells

**Validation:**
- ❌ Past dates cannot be selected (greyed out)
- ❌ Tapping the locked date (if any) does nothing — shows "(fixed)" tag

### TC-CREATE-04: Day Wise Mode
**Steps:**
1. Open Create Schedule
2. Select type
3. Tap **Day Wise** tab
4. Pick start date and end date
5. Tap weekday chips (e.g., Mon, Wed, Fri)
6. Observe count
7. Save

**Expected:**
- Only weekdays IN the date range are selectable (others greyed out & disabled)
- Count shows: "12 date(s) match"
- Save creates one day per matching weekday
- Calendar shows scattered highlights matching the pattern

**Validation:**
- ❌ Weekdays not in range → disabled (35% opacity, no tap)
- ❌ Both dates required before chips become active

### TC-CREATE-05: Locked Start Date (from Calendar)
**Steps:**
1. Tap a date cell in the calendar (e.g., Apr 16)
2. Day Detail page opens
3. Tap **Add Schedule**
4. Observe the form

**Expected:**
- Start Date is pre-filled with Apr 16 and **disabled** (greyed)
- Calendar tab shows Apr 16 pre-selected with orange highlight + "(fixed)" tag
- User cannot remove or change Apr 16
- User can add additional dates but Apr 16 stays
- Save creates schedule starting on Apr 16

### TC-CREATE-06: Add New Type Inline
**Steps:**
1. Open Create Schedule
2. Tap **+ Add New** button next to type field
3. Type Manager page opens
4. Create a new type
5. Tap back arrow

**Expected:**
- Returns to Create Schedule
- New type is **automatically selected** in the type field
- Form retains all other state (dates, etc.)

---

## 6. Feature 3 — Conflict Resolution (409)

### TC-CONFLICT-01: Trigger Conflict
**Pre-condition:** Schedule "Prep" exists on Apr 16

**Steps:**
1. Try to create another schedule on Apr 16 (e.g., "Shoot")
2. Tap Save Schedule

**Expected:**
- API returns 409
- Conflict popup overlay appears (centered, with dim background)
- Popup title: "Schedule Conflict"
- 3 options shown:
  - **Replace** — "Remove existing schedule on these dates and use your new schedule instead"
  - **Extend** — "Keep existing schedule, extend it at the end to make room"
  - **Overlap** — "Keep existing schedule and also add the new one on the same dates"
- "Back to Edit Dates" button to dismiss

### TC-CONFLICT-02: Replace Action
**Steps:**
1. From conflict popup, tap **Replace**

**Expected:**
- Popup closes
- API: `POST /days {... conflictAction: "replace"}`
- Apr 16 is now "Shoot" (Prep removed from that date)
- Calendar updates: Apr 16 turns red (Shoot color)
- History log records: REMOVED Prep · Apr 16, ADDED Shoot · Apr 16

### TC-CONFLICT-03: Extend Action
**Pre-condition:** Prep block spans Apr 16-20 (5 days)

**Steps:**
1. Try to add Shoot on Apr 16 → conflict popup
2. Tap **Extend**

**Expected:**
- Apr 16 becomes Shoot
- Prep block now spans Apr 17-21 (still 5 days, extended by 1 at end)
- Calendar reflects both blocks
- Toast: "Apr 16 changed to Shoot. Prep extended to Apr 21"

### TC-CONFLICT-04: Overlap Action
**Steps:**
1. Conflict popup → tap **Overlap**

**Expected:**
- Apr 16 shows BOTH Prep AND Shoot pills in the calendar cell
- Both blocks remain unchanged in length
- Day Detail for Apr 16 shows 2 schedule cards

### TC-CONFLICT-05: Cancel Conflict
**Steps:**
1. Conflict popup → tap "Back to Edit Dates" or tap outside the popup

**Expected:**
- Popup closes
- No API call made
- Form remains in its previous state (user can adjust dates and retry)

---

## 7. Feature 4 — Calendar View

### TC-CAL-01: Switch Between Month/Week/Day
**Steps:**
1. On home page, ensure Calendar View is active
2. Tap **Month** segment → see full month grid
3. Tap **Week** segment → see one week with bigger cells
4. Tap **Day** segment → see single day with full details

**Expected:**
- Smooth transition between modes
- Currently visible date is preserved across modes
- Today's date is highlighted with a circle/badge in all modes

### TC-CAL-02: Navigate Months/Weeks/Days
**Steps:**
1. In Month mode, tap left arrow → previous month
2. Tap right arrow → next month
3. Tap **Today** button → returns to current month
4. Repeat in Week and Day modes

**Expected:**
- Correct navigation by 1 month/week/day at a time
- Current month/week/day shown in the title (e.g., "APRIL 2026", "Apr 13–19, 2026", "Thursday, Apr 17, 2026")

### TC-CAL-03: Cell Tap → Day Detail
**Steps:**
1. Tap any calendar cell

**Expected:**
- Pushes to Day Detail page
- Page title: "Thursday, Apr 17, 2026" (full day name)
- Back arrow returns to Calendar View

### TC-CAL-04: Schedule Pills in Cells
**Steps:**
1. Create schedules of multiple types
2. Observe cells

**Expected:**
- Each scheduled cell shows colored pill(s) with type name
- Multi-day blocks span across cells (visual continuity)
- Today's cell has special highlight (green border or filled circle)
- Past dates have reduced opacity

### TC-CAL-05: Legend Strip
**Steps:**
1. Observe the legend below the view toggle

**Expected:**
- Up to 5 type pills shown horizontally with color dot + name
- If > 5 types, shows "+N more" button
- Tap "+N more" → opens Type Manager

---

## 8. Feature 5 — List View

### TC-LIST-01: Switch to List View
**Steps:**
1. Tap **List View** segment at top

**Expected:**
- Shows scrollable list of schedules
- Default tab: "By Date" (one row per day)

### TC-LIST-02: By Date Mode
**Steps:**
1. List View → "By Date" tab

**Expected:**
- One row per day in chronological order
- Each row shows: date, type pill (color + name), title (if any)
- Today is highlighted with a "Today" badge
- Past rows are dimmed
- Tap row → opens Day Detail

### TC-LIST-03: By Schedule Mode
**Steps:**
1. List View → "By Schedule" tab

**Expected:**
- One block per schedule (not per day)
- Each block shows: type pill, date range, day count
- Edit + Delete buttons appear on each block
- Tap block info → opens Day Detail (start date)

### TC-LIST-04: Edit/Delete from By Schedule
**Steps:**
1. By Schedule tab
2. Tap **Edit** on a block

**Expected:**
- Opens Create Schedule with the block data pre-filled
- Title bar shows "Edit Schedule"
- Save button shows "Save Changes"

**Steps (delete):**
1. Tap **Delete** on a block

**Expected:**
- Confirmation alert with block name
- After confirm → block removed
- API: `DELETE /days/:id`

---

## 9. Feature 6 — Day Detail Page

### TC-DAY-01: Empty Day
**Steps:**
1. Tap a future date with no schedules

**Expected:**
- Date header shows day number + day name + month/year
- Empty state: "📅 No schedules on this day"
- Action buttons: **Add Schedule** + **Add Event**

### TC-DAY-02: Day with Schedules
**Steps:**
1. Tap a date that has schedules

**Expected:**
- Schedule cards displayed (one per schedule)
- Each card shows: color dot, type name, optional title, day count + date range
- Each card has **Edit** (blue) + **Delete** (red) buttons (unless past date)
- Today's badge shown if applicable

### TC-DAY-03: Day with Events
**Steps:**
1. Tap a date with events attached

**Expected:**
- "EVENTS" section appears below schedules
- Event cards show: time/full-day label, title, location (with map icon), description
- Each event has **Edit** + **Remove** buttons

### TC-DAY-04: Day with Notes
**Steps:**
1. Tap a date with notes

**Expected:**
- "NOTES" section appears
- Note cards have yellow/parchment background
- Each note shows title + text + Delete button

### TC-DAY-05: Past Day Restrictions
**Steps:**
1. Tap a date in the past

**Expected:**
- All Edit/Delete buttons are HIDDEN
- "Add Schedule" and "Add Event" buttons are HIDDEN
- Schedule/event/note cards are read-only

---

## 10. Feature 7 — Edit Schedule

### TC-EDIT-01: Edit Full Block (from List By Schedule)
**Steps:**
1. List View → By Schedule → tap Edit on a block
2. Change type to "Wrap"
3. Modify dates
4. Save Changes

**Expected:**
- Form pre-filled with current data
- Type field auto-selected
- Dates auto-populated in the correct tab (Date Range or Calendar based on date pattern)
- Save Changes button (not Save Schedule)
- API: `PUT /days/:id`

### TC-EDIT-02: Single Day Edit (from Day Detail)
**Steps:**
1. Day Detail → tap Edit on a schedule card
2. Observe form

**Expected:**
- Page title: "Edit Day"
- Locked date displayed: "Thursday, Apr 16, 2026"
- Note: "Date cannot be changed when editing a single day"
- Type field shows current type (auto-selected)
- Date tabs are HIDDEN

### TC-EDIT-03: Single Day Edit — Type Changed
**Steps:**
1. Single Day Edit → change type from Prep to Shoot
2. Observe form

**Expected:**
- 3 radio options appear: **Replace / Extend / Overlap**
- Each shows description with current type name
- Default selected: "Replace"
- Save button updates the day

### TC-EDIT-04: Auto-Tab Detection
**Pre-condition:** Edit a schedule that has non-consecutive dates (gap > 1 day)

**Expected:**
- Calendar tab is automatically selected (not Date Range)
- Picked dates are pre-populated as removable tags

### TC-EDIT-05: Edit with Same Type
**Steps:**
1. Single Day Edit → keep same type
2. Save

**Expected:**
- No conflict options shown (only the locked date)
- Just updates title (if any)
- API: `PUT /days/:id` with same data

---

## 11. Feature 8 — Delete Schedule / Event / Note

### TC-DEL-01: Delete Schedule from Day Detail
**Steps:**
1. Day Detail → tap trash icon on schedule card
2. Confirm in alert

**Expected:**
- Alert: "Are you sure you want to delete 'Prep - Beach Week'? This cannot be undone."
- Cancel + Delete (red) buttons
- After Delete → schedule removed
- API: `DELETE /days/:id`
- Day Detail refreshes (may auto-close if empty)

### TC-DEL-02: Delete Event
**Steps:**
1. Day Detail → tap trash icon on event card
2. Confirm

**Expected:**
- Same confirmation pattern with event title in message
- API: `DELETE /events/:id`

### TC-DEL-03: Delete Note
**Steps:**
1. Day Detail → tap trash icon on note card
2. Confirm

**Expected:**
- Same confirmation pattern
- API: `DELETE /events/:id`

### TC-DEL-04: Cancel Delete
**Steps:**
1. Tap delete icon
2. Tap Cancel in alert

**Expected:**
- Alert dismisses
- Schedule/event/note remains intact
- No API call made

---

## 12. Feature 9 — Create Event

### TC-EVENT-01: Create Event from Drawer
**Steps:**
1. Drawer → **Create Event**

**Expected:**
- Page title: "Add Event"
- NO tab switcher (Event/Note) shown
- Save button at bottom: "Save Event"

### TC-EVENT-02: Event Form Fields
| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| Title | ✅ Yes | empty | Save disabled if empty |
| Description | No | empty | Multi-line text |
| Full Day toggle | No | Off | If on, hides time fields |
| Start Date | Yes | today | Cannot be past |
| End Date | Yes | today | Must be ≥ start |
| Start Time | If !fullDay | now | |
| End Time | If !fullDay | now | Must be ≥ start time |
| Repeat | No | None | Options: None/Daily/Weekly/Monthly |
| Timezone | No | device tz | |
| Reminder | No | None | Options: At time/5/15/30 min/1hr/1 day |
| Call Type | No | empty | Free text |
| Location | No | empty | Free text |

### TC-EVENT-03: Save Event
**Steps:**
1. Fill required fields (title, dates)
2. Tap Save Event

**Expected:**
- Event created successfully
- Toast: "Event created"
- Returns to home
- Event appears in calendar/day detail

### TC-EVENT-04: Validation Errors
- ❌ Empty title → Alert: "Title is required"
- ❌ End time before start time → Alert: "End time must be after start time"
- ❌ Past start date → date picker won't allow

---

## 13. Feature 10 — Create Note

### TC-NOTE-01: Create Note from Drawer
**Steps:**
1. Drawer → **Create Note**

**Expected:**
- Page title: "Add Note"
- NO tab switcher
- Form has: Title (required), Notes text area, Color picker

### TC-NOTE-02: Save Note
**Steps:**
1. Fill title + text
2. Tap Save Note

**Expected:**
- Note created
- Toast: "Note created"
- Note appears in current day's detail with yellow background

### TC-NOTE-03: Note Validation
- ❌ Empty title → Alert: "Note title is required"

---

## 14. Feature 11 — Set Default Preferences

### TC-DEFAULT-01: Set Default View (Calendar/List)
**Steps:**
1. Home page → tap **Set as Default** next to Calendar/List toggle
2. Popup overlay appears below the button
3. Tap **List View**

**Expected:**
- Popup shows 2 options: Calendar View, List View
- Currently saved option has filled radio circle + green "Current" label
- After tap → preference saved
- Toast: "List View is now your default view"
- Popup auto-dismisses
- App switches to List View immediately

### TC-DEFAULT-02: Persist Across Restarts
**Steps:**
1. Set default = List View
2. Force-quit app
3. Reopen

**Expected:**
- App opens directly in List View

### TC-DEFAULT-03: Set Default Calendar Mode (Month/Week/Day)
**Steps:**
1. In Calendar View, tap **Set as Default** next to Month/Week/Day picker
2. Pick "Week View"

**Expected:**
- Popup shows 3 options
- Saves preference
- Calendar switches to Week mode
- On next app open, Calendar starts in Week mode

### TC-DEFAULT-04: Set Default List Mode (By Date/By Schedule)
**Steps:**
1. List View → **Set as Default** next to By Date/By Schedule
2. Pick "By Schedule"

**Expected:**
- Saves preference
- On next visit, List View opens in By Schedule mode

### TC-DEFAULT-05: Popup Tap-Outside Dismiss
**Steps:**
1. Open any Set Default popup
2. Tap outside the popup (on background)

**Expected:**
- Popup dismisses without changing preference

---

## 15. Feature 12 — Activity History

### TC-HIST-01: View History
**Steps:**
1. Drawer → **History**

**Expected:**
- History page opens
- Recent activities shown as cards
- Each card has colored left border based on action type:
  - Green = Added
  - Blue = Changed
  - Red = Removed
  - Purple = Copied
  - Orange = Shared
- Cards show: action label, target type, title in Georgia serif quotes, date+time, "by Name"

### TC-HIST-02: Filter by Action
**Steps:**
1. History page → tap "All Actions" dropdown
2. Select "Removed"

**Expected:**
- Only DELETED entries shown
- Filter persists during current session

### TC-HIST-03: Filter by Date
**Steps:**
1. History page → tap date picker
2. Pick a specific date

**Expected:**
- Only entries from that date shown
- Empty state if no entries on that date

### TC-HIST-04: History After Actions
**Steps:**
1. Create a schedule "Prep" on Apr 18
2. Open History

**Expected:**
- New entry: ADDED · SCHEDULE · "Prep" · 1 day(s) · Apr 17 · Time · by [User Name]

---

## 16. Feature 13 — Share Schedule

### TC-SHARE-01: Open Share
**Steps:**
1. Tap share icon (top right of home page)

**Expected:**
- Share page opens with options:
  - Share via Link (generates URL)
  - Share via Email (input field + send)

### TC-SHARE-02: Generate Link
**Steps:**
1. Share page → tap "Generate Link"

**Expected:**
- API: `POST /share`
- Link generated
- Copy button available
- Toast: "Link copied to clipboard"

### TC-SHARE-03: Share via Email
**Steps:**
1. Enter email address
2. Tap Send

**Expected:**
- Email sent with schedule link
- Toast: "Email sent successfully"

---

## 17. Feature 14 — Dark/Light Theme

### TC-THEME-01: Toggle Theme
**Steps:**
1. Drawer → toggle Dark/Light switch

**Expected:**
- Theme switches immediately (no app restart)
- All screens reflect new theme
- Drawer closes
- Preference persists across sessions

### TC-THEME-02: Visual Verification
- Light mode: cream/parchment background, dark text
- Dark mode: warm dark background (#2A2718-ish), warm text
- All cards, pills, badges visible in both modes
- No "white-on-white" or "black-on-black" issues

---

## 18. Cross-Platform Parity Checklist

For every test case above, verify the same behavior on **Web, iOS, Android**:

| Behavior | Web | iOS | Android |
|----------|-----|-----|---------|
| Schedule title field | ✅ Yes | ❌ Removed | ❌ Removed |
| Conflict shown as | Modal | Centered overlay | Dialog |
| Day Detail shown as | Right drawer | Pushed page | Activity |
| Set Default shown as | Ant Popover | Custom overlay | Dialog |
| Add new type | Inline form | TypeManager page | TypeManager dialog |
| Theme toggle | Header icon | Drawer toggle | Drawer toggle |

**Special mobile note:** If a test step says "type a title", skip it on mobile — the title field doesn't exist on mobile.

---

## 19. Edge Cases & Negative Tests

### Network Failures
| TC | Scenario | Expected |
|----|----------|----------|
| NEG-01 | Offline → tap Save Schedule | Toast: "Network error. Please check connection" |
| NEG-02 | Server returns 500 | Toast with server's error message |
| NEG-03 | Slow network (3G) | Loading spinner shown until response |
| NEG-04 | Token expired (401) | Auto-redirect to login |

### Data Boundaries
| TC | Scenario | Expected |
|----|----------|----------|
| EDGE-01 | Number of Days = 365 | Saves successfully (max 1 year) |
| EDGE-02 | Number of Days = 366 | Save disabled or error |
| EDGE-03 | Calendar pick 100+ dates | Performance acceptable, all saved |
| EDGE-04 | Schedule spanning year boundary | Dec 30 – Jan 5 works correctly |
| EDGE-05 | DST transition (March/Nov) | Day count remains correct |
| EDGE-06 | Empty schedule list | Empty state shown, no crash |
| EDGE-07 | 0 schedule types | Cannot create — TypeManager prompted |

### Concurrent Editing
| TC | Scenario | Expected |
|----|----------|----------|
| CONC-01 | 2 users edit same day on different devices | Last-write-wins or version conflict shown |
| CONC-02 | User A deletes; User B opens same record | User B sees error or auto-refresh |

### Permission/Auth
| TC | Scenario | Expected |
|----|----------|----------|
| PERM-01 | Read-only user tries to create | Save button disabled or 403 |
| PERM-02 | Wrong project_id in moduledata | API returns 401/403 |

### UI Stress
| TC | Scenario | Expected |
|----|----------|----------|
| UI-01 | Schedule type with 50-char name | Truncates with ellipsis in pills |
| UI-02 | Note text 5000 chars | Scrollable, no UI break |
| UI-03 | 100 events on a single day | Day Detail scrolls smoothly |
| UI-04 | Rotate device while creating | State preserved, no crash |
| UI-05 | Background app for 10 min, return | Session valid, data refreshed |

---

## 20. Bug Reporting Template

When filing a bug ticket, please include:

```
**Title:** [Module] Brief description

**Platform:** Web / iOS / Android (specify version)
**Device/Browser:** e.g., iPhone 15 Pro / Safari 17 / Chrome 120
**Test Case ID:** TC-XXXX-NN (from this document)
**Severity:** Blocker / Critical / Major / Minor / Cosmetic

**Pre-conditions:**
1. Logged in as [user]
2. Project has [data state]
3. Currently on [page]

**Steps to Reproduce:**
1.
2.
3.

**Expected Result:**

**Actual Result:**

**Screenshots/Video:** [attach]

**Backend logs:** [if API-related, paste relevant log entries]

**Frequency:** Always / Sometimes / Rarely
**Workaround:** [if any]
```

---

## Appendix A: API Response Codes

| Code | Meaning | UI Behavior |
|------|---------|-------------|
| 200 | Success | Continue |
| 201 | Created | Show success toast |
| 400 | Bad Request | Show server's message |
| 401 | Unauthorized | Redirect to login |
| 403 | Forbidden | Show "permission denied" |
| 404 | Not Found | Show "not found" or refresh data |
| 409 | Conflict | Show conflict popup with Replace/Extend/Overlap |
| 500 | Server Error | Show error toast, allow retry |

---

## Appendix B: Glossary

- **Block / Schedule Block** — A multi-day group of dates assigned to a single type (e.g., "Prep · Apr 16-20")
- **Day** — A single date within a schedule block (the smallest unit)
- **Type** — Category of schedule activity (Prep/Shoot/Wrap/Day Off/Travel + custom)
- **Event** — Time-based scheduled item (meetings, calls, etc.) attached to a day
- **Note** — Text-based reminder attached to a day
- **Locked Date** — A date that cannot be changed in the form (used when launching from a calendar cell)
- **Single Day Edit** — Editing only one day from a multi-day block (with conflict resolution options)
- **Conflict** — When trying to create a schedule on a date that already has one
- **moduledata** — Encrypted authentication header for all API calls

---

## Appendix C: Test Sign-off

| Sign-off | Name | Date | Result |
|----------|------|------|--------|
| QA Lead | | | Pass / Fail |
| Product Manager | | | Approved / Rejected |
| Engineering Lead | | | Approved / Rejected |
| UX Lead | | | Approved / Rejected |

---

**End of Document**

For technical integration details, see the developer PDFs:
`Box_Schedule_Backend.pdf`, `Box_Schedule_iOS.pdf`, `Box_Schedule_Web.pdf`, `Box_Schedule_Android.pdf`
