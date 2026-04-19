# 📅 Box Schedule Module — Requirements & Features

**By:** Zillit Engineering
**Last updated:** 17 April 2026
**Reading time:** ~12 min

---

## Overview

Production calendar system for film and television productions. Lets the production team plan day-by-day phases (Prep, Shoot, Wrap, Day Off, Travel) as colored blocks on a shared calendar, attach events and notes to specific days, resolve scheduling conflicts with Replace / Extend / Overlap actions, share read-only links with cast and crew, and track every change in an activity log. Available on Web, Android, and iOS with shared behaviour.

---

## Architecture

### Two-Layer Data Model

The schedule is built from two distinct layers that work together:

```
                       PRODUCTION SCHEDULE
                      /                   \
                     /                     \
            LAYER 1                       LAYER 2
       Schedule Days (Blocks)        Events & Notes
                |                           |
                v                           v
        Type · Date Range            Attached to a Day
        (e.g., Prep Apr 17-21)       (e.g., Meeting 9 AM)
```

**Layer 1 — Schedule Days** define the broad phase of the production for a given day (Prep, Shoot, etc.). Each day belongs to one or more schedule blocks.

**Layer 2 — Events & Notes** attach specific activities or reminders to individual days inside those blocks.

### Role Model (Two Roles)

**Creator / Editor:** Any authenticated user on the project — can create / edit / delete schedules, types, events, notes; can resolve conflicts; can share the schedule.

**Viewer (via shared link):** External recipients (cast agents, vendors) who receive a shared link — read-only view of the schedule, no app installation required.

### How the 2 Roles Interact

```
                   CREATOR (Production Manager)
                  /         |               \
        creates blocks   edits/deletes    shares link
              |              |                  |
              v              v                  v
            Schedule        Activity         VIEWER (Cast Agent)
            updates live    log records      opens read-only URL
            for all crew    every change     sees current schedule
```

---

## FUNCTIONAL REQUIREMENTS

### FR-01: Showing Schedule Views

| # | Requirement |
|---|-------------|
| FR-01.1 | Two main views: **Calendar View** and **List View** — switched from the segmented toggle at the top |
| FR-01.2 | Calendar View has three sub-modes: **Month**, **Week**, **Day** — switched from a sub-toggle |
| FR-01.3 | List View has two sub-modes: **By Date** (one row per day) and **By Schedule** (one row per block) |
| FR-01.4 | Navigation in Calendar: Previous / Next arrows (one period), **Today** button jumps to today and highlights it |
| FR-01.5 | Header title reflects the current period (e.g., "APRIL 2026", "Apr 13 – 19, 2026", "Thursday, Apr 17, 2026") |
| FR-01.6 | Each schedule day displays as a colored pill with its type name (e.g., orange "Prep") |
| FR-01.7 | Multi-day blocks visually span across consecutive cells |
| FR-01.8 | Today's cell has a special highlight (filled circle / colored border) |
| FR-01.9 | Past dates render with reduced opacity (dimmed) |
| FR-01.10 | Color legend strip is shown below the view toggle, listing up to 5 type pills with "+N more" overflow |
| FR-01.11 | Tapping any calendar cell or list row opens the **Day Detail** page for that date |
| FR-01.12 | "Set as Default" button next to each toggle saves the user's preferred view to load first |

### Calendar Cell Visual States

| State | Visual Treatment |
|-------|------------------|
| Today | Filled circle with bold border |
| Past | 50% opacity, no action buttons |
| Scheduled | Color pill of the type (matches type color) |
| Multi-schedule (overlap) | Multiple pills stacked vertically |
| Selected | Dark fill (during multi-pick in Calendar mode) |
| Locked | Orange fill with "(fixed)" label |
| Disabled | Greyed out (past dates, days not in range) |

### FR-02: Day Detail Page

| # | Requirement |
|---|-------------|
| FR-02.1 | Day Detail opens as a **full-screen pushed page** (not a popup or drawer) |
| FR-02.2 | Page header: large day number + day name + month/year + "Today" badge if applicable |
| FR-02.3 | "Schedules on this day" section lists every schedule block covering this date |
| FR-02.4 | Each schedule card shows: color dot, type name, optional title, day count + date range |
| FR-02.5 | Each schedule card has Edit (blue) + Delete (red) buttons (hidden on past dates) |
| FR-02.6 | "Events" section lists events tied to this day with time, title, location (📍 icon), description |
| FR-02.7 | Each event card has Edit + Remove buttons (hidden on past dates) |
| FR-02.8 | "Notes" section lists notes with yellow/parchment background and Delete button |
| FR-02.9 | Empty state when no schedules: "📅 No schedules on this day" |
| FR-02.10 | Action buttons at bottom: "Add Schedule" + "Add Event" (hidden on past dates) |
| FR-02.11 | "Add Schedule" launches Create Schedule with **lockedDate** = this day |
| FR-02.12 | Past dates display the page in **read-only mode** (all action buttons hidden) |

### FR-03: Create Schedule

| # | Requirement |
|---|-------------|
| FR-03.1 | Open via Drawer → "Create Schedule" OR Day Detail → "Add Schedule" |
| FR-03.2 | **Type** field required — searchable dropdown of all schedule types (system + custom) |
| FR-03.3 | "+ Add New" button next to type field opens the Type Manager page |
| FR-03.4 | After creating a new type and returning, the new type is **automatically selected** |
| FR-03.5 | Three date selection modes shown as tabs: **Date Range**, **Calendar**, **Day Wise** |
| FR-03.6 | Date Range — Two sub-modes: "Set by Days" (start + N days) or "Set by End Date" (start + end) |
| FR-03.7 | Calendar — Multi-pick individual dates from a month grid; selected dates appear as removable tags below |
| FR-03.8 | Day Wise — Pick a date range + weekdays (Sun–Sat); only weekdays present in the range are clickable |
| FR-03.9 | Past dates are disabled across all 3 modes |
| FR-03.10 | Number of Days input accepts manual typing + has – / + stepper buttons |
| FR-03.11 | Summary bar shows: "N day(s): Apr 17 – Apr 21, 2026" with count + first + last date |
| FR-03.12 | **Save** button pinned at bottom (full-width dark button), disabled until type + dates are valid |
| FR-03.13 | Success → toast "Schedule created" + return to home + calendar updates live |
| FR-03.14 | Schedule **title field is NOT shown** on mobile (web has it as optional) — mobile sends empty string |

### Validation Summary — Create Schedule

| Condition | Result |
|-----------|--------|
| No type selected | Save button disabled |
| No dates selected | Save button disabled |
| Number of Days < 1 | – button disabled at 1 |
| Past start date | Date picker won't allow selection |
| End date < start date | End date picker minimum enforced to start |
| Calendar mode: 0 dates picked | Save button disabled |
| Day Wise: 0 weekdays selected | Summary shows 0, Save disabled |
| Day Wise: end date < start date | End date picker minimum enforced |

### FR-04: Locked Start Date

| # | Requirement |
|---|-------------|
| FR-04.1 | When Create Schedule is opened from a calendar cell, that cell's date is **locked** as the start |
| FR-04.2 | Start Date picker is disabled (greyed) — cannot change |
| FR-04.3 | In Calendar tab, the locked date is pre-selected with orange highlight (not the default dark) |
| FR-04.4 | The locked date appears as a tag with "(fixed)" label and **no remove button** |
| FR-04.5 | User can add additional dates but cannot remove the locked one |
| FR-04.6 | Day Wise mode: Start Date picker is also disabled when launched from a cell |

### FR-05: Conflict Resolution (409)

| # | Requirement |
|---|-------------|
| FR-05.1 | Backend returns HTTP **409** when new schedule overlaps existing dates |
| FR-05.2 | Mobile shows a **centered popup overlay** (not a pushed page); web shows a modal |
| FR-05.3 | Popup title: "Schedule Conflict" |
| FR-05.4 | Popup subtitle: "These dates overlap with an existing schedule. How would you like to resolve this?" |
| FR-05.5 | Three resolution buttons shown vertically: **Replace**, **Extend**, **Overlap** |
| FR-05.6 | Each option shows title + descriptive sub-text |
| FR-05.7 | "Back to Edit Dates" button or tapping outside dismisses the popup |
| FR-05.8 | Tapping a resolution → re-submits the API call with `conflictAction` set → popup auto-closes |
| FR-05.9 | Success → toast describing the action taken (e.g., "Apr 16 changed to Shoot. Prep extended to Apr 21") |

### Conflict Resolution Actions

| Action | Behavior | Example: Existing Prep Apr 16-20 (5 days), New Shoot on Apr 16 |
|--------|----------|----------------------------------------------------------------|
| **Replace** | Remove conflicting date from existing block; new schedule takes that date | Prep becomes Apr 17-20 (4 days). Shoot on Apr 16. |
| **Extend** | Same as Replace, BUT existing block extends 1 day at end to keep length | Prep becomes Apr 17-21 (5 days, shifted). Shoot on Apr 16. |
| **Overlap** | Both schedules coexist on the same date (no removal) | Apr 16 shows BOTH Prep + Shoot pills. Both blocks unchanged. |

### FR-06: Edit Schedule (Two Modes)

| # | Requirement |
|---|-------------|
| FR-06.1 | Access: List View → By Schedule → Edit pencil OR Day Detail → Edit on schedule card |
| FR-06.2 | Edit button visible only on **active** (non-past) schedules |
| FR-06.3 | Page title becomes "Edit Schedule" (block edit) or "Edit Day" (single-day edit) |
| FR-06.4 | Form opens **pre-filled** with current values: type, dates, mode |
| FR-06.5 | System detects gaps in dates: if dates are non-consecutive, automatically opens **Calendar tab** |
| FR-06.6 | Save button text changes to "Save Changes" (was "Save Schedule") |
| FR-06.7 | API: `PUT /days/:id` instead of `POST /days` |
| FR-06.8 | Block edit allows changing: type, dates, mode |
| FR-06.9 | Single-day edit (FR-07) restricts: only type + conflict action can change |

### FR-07: Single-Day Edit with Conflict Options

| # | Requirement |
|---|-------------|
| FR-07.1 | Triggered from Day Detail → Edit button on a schedule card |
| FR-07.2 | Page title: **"Edit Day"** |
| FR-07.3 | Locked date displayed in a card: "Thursday, Apr 16, 2026" |
| FR-07.4 | Note shown: "Date cannot be changed when editing a single day" |
| FR-07.5 | Type field pre-selected with current type |
| FR-07.6 | Date selection tabs are **hidden** entirely |
| FR-07.7 | Three radio options appear ONLY when the type is changed: Replace / Extend / Overlap |
| FR-07.8 | Each radio option shows title + detailed description with current type name and dates |
| FR-07.9 | Default selection: "Replace" |
| FR-07.10 | If type unchanged → save just updates the day with no conflict prompt |

### Single-Day Edit Action Descriptions

| Option | Description Example |
|--------|--------------------|
| **Replace** | "Remove **Apr 16** from the current **Shoot** block and assign it to the new type. The Shoot block will shrink from **5** to **4** day(s)." |
| **Extend** | "Remove **Apr 16** from **Shoot** and assign it to the new type. The Shoot block will extend by **1 day at the end** to keep the same total (5 days). Shoot will now end on **Apr 22** instead of **Apr 21**." |
| **Overlap** | "Keep the existing **Shoot** on this date and also add the new type. Both will appear on **Apr 16**." |

### FR-08: Delete Schedule / Event / Note

| # | Requirement |
|---|-------------|
| FR-08.1 | Schedule delete: List View → By Schedule → Trash icon OR Day Detail → Trash on schedule card |
| FR-08.2 | Event delete: Day Detail → Remove button on event card |
| FR-08.3 | Note delete: Day Detail → Trash icon on note card |
| FR-08.4 | Delete buttons visible only on **active** items (hidden on past dates) |
| FR-08.5 | Confirmation alert: "Are you sure you want to delete '[name]'? This cannot be undone." |
| FR-08.6 | Cancel + Delete (red, destructive) buttons in alert |
| FR-08.7 | Cancel → alert dismisses, no API call, item remains |
| FR-08.8 | Delete → API: `DELETE /days/:id` or `DELETE /events/:id` |
| FR-08.9 | Success → item removed from view; calendar/list refresh; activity log updated |
| FR-08.10 | Soft delete: backend marks `deleted: 1`, allowing future undo |

### FR-09: Schedule Type Management

| # | Requirement |
|---|-------------|
| FR-09.1 | Access via Drawer → "Edit Types" OR Create Schedule → "+ Add New" button |
| FR-09.2 | List shows all types with colored circle + name + "SYSTEM" badge (if system) |
| FR-09.3 | 5 system types pre-loaded: **Prep** (orange), **Shoot** (red), **Wrap** (green), **Day Off** (grey), **Travel** (blue) |
| FR-09.4 | System types **cannot be edited or deleted** (no pencil/trash icons shown) |
| FR-09.5 | Custom types show pencil (edit) + trash (delete) icons |
| FR-09.6 | "Add Custom Type" section pinned at the bottom: color circle + name input + "+ Add" button |
| FR-09.7 | Tap colored circle → color picker (preset palette + custom hex) |
| FR-09.8 | Add button disabled if name is empty or whitespace-only |
| FR-09.9 | Edit: tap pencil → name becomes editable inline → ✓ to save / ✗ to cancel |
| FR-09.10 | Delete: tap trash → confirmation alert → API: `DELETE /types/:id` |
| FR-09.11 | Schedules using a deleted custom type retain its name (denormalized in DB) |

### Type Validation Rules

| Condition | Result |
|-----------|--------|
| Empty name | Add/Save button disabled |
| Whitespace-only name | Add/Save button disabled (trimmed) |
| Duplicate name in project | Toast: "A type with this name already exists" |
| Name > 50 chars | Truncated or rejected |
| Invalid color | Defaults to system blue |

### FR-10: Create Event

| # | Requirement |
|---|-------------|
| FR-10.1 | Access via Drawer → "Create Event" OR Day Detail → "Add Event" |
| FR-10.2 | On mobile, opens as a separate page with no Event/Note tab switcher |
| FR-10.3 | Title field required — Save Event button disabled if empty |
| FR-10.4 | Description: multi-line textarea (optional) |
| FR-10.5 | Full Day toggle — when ON, hides start/end time fields |
| FR-10.6 | Start Date required, defaults to today, cannot be past |
| FR-10.7 | End Date required, defaults to start date, must be ≥ start |
| FR-10.8 | Start Time + End Time visible only when Full Day is OFF |
| FR-10.9 | End Time must be ≥ Start Time |
| FR-10.10 | Repeat dropdown: None / Daily / Weekly / Monthly |
| FR-10.11 | Reminder dropdown: None / At time / 5 / 15 / 30 min / 1 hr / 1 day |
| FR-10.12 | Timezone auto-detected from device, can be overridden |
| FR-10.13 | Call Type field (free text) — e.g., "All Hands", "Stunt Team Only" |
| FR-10.14 | Location field (free text) — e.g., "Studio A", "Beach Set" |
| FR-10.15 | Save Event button pinned at bottom (full-width dark) |
| FR-10.16 | Success → toast "Event created" + return + event appears in Day Detail |

### Event Validation Rules

| Condition | Result |
|-----------|--------|
| Empty title | Save disabled, alert: "Title is required" |
| End time < Start time (when !Full Day) | Alert: "End time must be after start time" |
| Past start date | Date picker won't allow |

### FR-11: Create Note

| # | Requirement |
|---|-------------|
| FR-11.1 | Access via Drawer → "Create Note" only (NOT in Day Detail action buttons) |
| FR-11.2 | On mobile, opens as a separate page with no tab switcher |
| FR-11.3 | Title field required |
| FR-11.4 | Notes text area (multi-line, free text) |
| FR-11.5 | Color picker (yellow/parchment default) |
| FR-11.6 | Save Note button pinned at bottom |
| FR-11.7 | Success → toast "Note created" → note appears in Day Detail with yellow background |

### Note Validation

| Condition | Result |
|-----------|--------|
| Empty title | Save disabled, alert: "Note title is required" |

### FR-12: Set Default Preferences

| # | Requirement |
|---|-------------|
| FR-12.1 | Three "Set as Default" buttons appear at: Calendar/List toggle, Month/Week/Day picker, By Date/By Schedule picker |
| FR-12.2 | Tapping a Set Default button opens a small **popover overlay** below the button |
| FR-12.3 | Popover shows: title, subtitle, list of radio options |
| FR-12.4 | Each option has: radio circle, label, description, "Current" green badge if currently saved |
| FR-12.5 | Tapping an option → saves preference, switches view immediately, popup auto-dismisses |
| FR-12.6 | Tapping outside the popover dismisses it without changes |
| FR-12.7 | Preferences saved locally on device (UserDefaults / SharedPreferences) — not synced |
| FR-12.8 | Preferences persist across app close/restart |
| FR-12.9 | On next app open, the saved view loads first |

### Set Default Options Matrix

| Button Location | Options | Default |
|-----------------|---------|---------|
| Calendar / List toggle | Calendar View, List View | Calendar View |
| Month / Week / Day picker | Month View, Week View, Day View | Month View |
| By Date / By Schedule | By Date, By Schedule | By Date |

### FR-13: Activity History

| # | Requirement |
|---|-------------|
| FR-13.1 | Access via Drawer → "History" |
| FR-13.2 | History page lists all activity entries in reverse chronological order |
| FR-13.3 | Top filters: action dropdown (All / Added / Changed / Removed / Copied / Shared) + date picker |
| FR-13.4 | Color legend below filters |
| FR-13.5 | Each entry as a card with **colored left border** based on action type |
| FR-13.6 | Card content: action label, target type, title in Georgia serif quotes, optional details, footer with date/time + "by [user name]" |
| FR-13.7 | Logged actions: schedule created/updated/removed, event created/updated/removed, note created/updated/removed, type created/updated/removed, schedule shared |
| FR-13.8 | Empty state: "No history entries" |
| FR-13.9 | Filters reset on page close |

### History Card Color Coding

| Action | Color | Meaning |
|--------|-------|---------|
| Added | 🟢 Green | New record created |
| Changed | 🔵 Blue | Existing record updated |
| Removed | 🔴 Red | Record deleted |
| Copied | 🟣 Purple | Record duplicated |
| Shared | 🟠 Orange | Schedule shared via link or email |

### FR-14: Sharing the Schedule

| # | Requirement |
|---|-------------|
| FR-14.1 | Tap **share icon** at top-right of home page → opens Share page |
| FR-14.2 | Two share methods offered: **Share via Link**, **Share via Email** |
| FR-14.3 | Share via Link: tap "Generate Link" → backend creates public read-only URL |
| FR-14.4 | After generation: URL shown + Copy button → copies to clipboard |
| FR-14.5 | Toast: "Link copied to clipboard" |
| FR-14.6 | Share via Email: input email address + tap Send |
| FR-14.7 | Email contains link + project name + sender info |
| FR-14.8 | Toast: "Email sent successfully" |
| FR-14.9 | Recipient opens link → sees clean, read-only schedule view (no edit buttons) |
| FR-14.10 | Activity log records: SHARED · SCHEDULE · "[link/email]" · by [user] |

### FR-15: Theme System (Light / Dark)

| # | Requirement |
|---|-------------|
| FR-15.1 | Toggle accessible via Drawer → "Dark Mode" / "Light Mode" switch |
| FR-15.2 | Switch label and icon update based on current state (sun ☀️ / moon 🌙) |
| FR-15.3 | Theme switches **immediately** (no app restart) |
| FR-15.4 | All screens reflect the new theme: backgrounds, text, cards, pills, badges |
| FR-15.5 | Light mode: cream/parchment background, dark warm text |
| FR-15.6 | Dark mode: warm dark background (not pure black), cream text |
| FR-15.7 | Theme preference persists across app close/restart (UserDefaults / SharedPreferences) |
| FR-15.8 | Drawer auto-closes after theme toggle |

### FR-16: Drawer (Hamburger Menu)

| # | Requirement |
|---|-------------|
| FR-16.1 | Right-side slide-out drawer accessed via ☰ icon in top-right of home page |
| FR-16.2 | Drawer slides in with smooth animation; tap outside or back button dismisses |
| FR-16.3 | Drawer items in order: **Create Schedule**, **Create Event**, **Create Note**, **Edit Types**, **History**, Theme toggle, User info, **Logout** |
| FR-16.4 | Each menu item has icon + label + chevron (right arrow) |
| FR-16.5 | Tapping a menu item closes drawer THEN navigates to the destination |
| FR-16.6 | Theme toggle is inline (switch widget) — does NOT navigate |
| FR-16.7 | User info footer shows: avatar circle with initial, full name, logout icon |
| FR-16.8 | Logout: clears session + navigates back to login screen |

### Drawer Item Icons & Colors

| Item | Icon | Accent |
|------|------|--------|
| Create Schedule | 📅 calendar.badge.plus | Primary accent |
| Create Event | 🕐 clock.badge.fill | Action changed (blue) |
| Create Note | 📝 note.text.badge.plus | Action copied (purple) |
| Edit Types | 🎚️ slider.horizontal.3 | Text secondary |
| History | 🔄 clock.arrow.circlepath | Text secondary |
| Dark/Light Mode | ☀️ / 🌙 | Primary accent |
| Logout | ↗️ rectangle.portrait.and.arrow.right | Danger (red) |

### FR-17: Navigation Pattern

| # | Requirement |
|---|-------------|
| FR-17.1 | All major screens push as **full pages** with native back button (no popups for primary actions) |
| FR-17.2 | Standard inline navigation bar: `< Title` on the same line at the top |
| FR-17.3 | No "Cancel" / "Done" / "Close" buttons in toolbars — back arrow handles dismiss |
| FR-17.4 | Save buttons pinned at the **bottom** of the page as full-width dark buttons (Create Schedule, Create Event, Create Note) |
| FR-17.5 | Set Default appears as a small popover overlay (NOT a pushed page) |
| FR-17.6 | Conflict Resolution appears as a centered modal popup (NOT a pushed page) |
| FR-17.7 | Delete confirmations appear as native alert dialogs |
| FR-17.8 | Type Manager opens as a pushed page when accessed from "+ Add New" inside Create Schedule |

---

## Cross-Platform Consistency Matrix

| Behavior | Web | iOS | Android |
|----------|-----|-----|---------|
| Schedule title field | ✅ Optional | ❌ Removed | ❌ Removed |
| Day Detail | Right drawer | Pushed page | Activity |
| Set Default | Ant Popover | Custom overlay | Dialog |
| Conflict Resolution | Modal Dialog | Centered popup overlay | Dialog |
| Add New Type | Inline form | TypeManager page | TypeManager dialog |
| Theme toggle | Header icon | Drawer toggle | Drawer toggle |
| Tab switcher in Event/Note | Single page with tabs | Separate pages (mode param) | Separate Activities |
| Save button position | Toolbar top-right | Pinned bottom (full-width) | Pinned bottom (full-width) |

---

## Feature Summary by Role

### Creator / Editor (Authenticated User)

| Screen | Key Features |
|--------|--------------|
| **Calendar (Month/Week/Day)** | View all schedules, navigate periods, tap cell to drill into Day Detail, see today indicator + past date dimming |
| **List View (By Date / By Schedule)** | Tabular alternative — By Date row per day, By Schedule row per block with Edit + Delete buttons |
| **Day Detail** | View all schedules, events, notes for one day; Add Schedule (locked date), Add Event; Edit/Delete on each item |
| **Create Schedule** | Pick type, choose date mode (Date Range / Calendar / Day Wise), Add New Type inline, summary preview, Save |
| **Edit Schedule** | Pre-filled form, gap-detection auto-tab, Save Changes; for single-day edits — Replace/Extend/Overlap options |
| **Create Event** | Title, dates, times, full-day toggle, repeat, reminder, timezone, call type, location, description |
| **Create Note** | Title + text + color picker; lighter than events |
| **Type Manager** | List system + custom types, edit/delete custom, add new type with color picker |
| **History** | Filter by action type + date, view all activity cards with color-coded borders |
| **Share** | Generate link or send email; recipients get read-only view |
| **Set Default** | Three popovers — Calendar/List view, Month/Week/Day mode, By Date/By Schedule mode |
| **Theme Toggle** | Switch between Light and Dark instantly |

### Viewer (Read-Only via Shared Link)

| Screen | Key Features |
|--------|--------------|
| **Public Read-Only View** | Web-only — opens in browser, no app install required |
| **Calendar Display** | Month view of schedule with all blocks, types, dates |
| **No Actions** | No Edit, Delete, Create buttons; no drawer; no settings |
| **Auto-Refresh** | Page refreshes periodically to reflect creator's updates |

---

## Cross-Role Flow Summary

### Flow A: Initial Schedule Setup
Creator opens Box Schedule → empty calendar → drawer "Create Schedule" → picks type "Prep" → picks dates Apr 1-14 → Save → toast "Schedule created" → calendar updates with orange Prep pills → repeats for Shoot, Wrap, Day Off, Travel.

### Flow B: Daily Use (Active Production)
Creator opens app → calendar shows today's date as "Shoot Day 12" → taps today's cell → Day Detail page → adds Event "9 AM Production Meeting at Studio A" → adds Note "Lead actor allergic to nuts" → returns home → shares link with crew via email.

### Flow C: Schedule Conflict Resolution
Creator wants to change Apr 18 from "Day Off" to "Shoot" → taps Apr 18 cell → Day Detail → taps Edit on Day Off card → "Edit Day" page opens with locked date → changes type to Shoot → 3 conflict options appear → picks **Extend** → Day Off block shifts forward 1 day → calendar reflects: Apr 18 = Shoot, Day Off block now Apr 17, 19, 20.

### Flow D: New Type + New Schedule
Creator needs a "Rehearsal" type → opens Create Schedule → taps "+ Add New" next to type field → Type Manager opens → creates "Rehearsal" with purple color → taps back arrow → returns to Create Schedule with Rehearsal **auto-selected** → picks dates → Save → toast.

### Flow E: External Sharing
Creator wraps the day, needs to send schedule to talent agent → taps share icon → Share page → "Generate Link" → URL created → tap Copy → pastes into email → agent opens link → reads schedule in browser without installing app.

### Flow F: Personal Defaults Setup
First-time creator prefers Week View → opens Calendar View → taps "Set as Default" next to Month/Week/Day picker → popover opens with 3 options → picks "Week View" → popover closes → calendar switches to Week mode → on next app launch, app opens directly in Week mode.

---

## Business Rules Summary

| # | Rule |
|---|------|
| BR-01 | Schedule title field exists on web only (mobile sends empty string) |
| BR-02 | Past dates cannot be selected for new schedules (blocked at picker) |
| BR-03 | Edit/Delete buttons hidden on past schedules in Day Detail |
| BR-04 | 5 system types are pre-installed and cannot be deleted (Prep, Shoot, Wrap, Day Off, Travel) |
| BR-05 | Custom type names must be unique within a project |
| BR-06 | Schedule conflicts trigger HTTP 409 → user must explicitly choose Replace/Extend/Overlap |
| BR-07 | All deletes are soft (deleted: 1 flag), not hard removals |
| BR-08 | Activity log records every action; cannot be cleared by users |
| BR-09 | Maximum 365 days per schedule block |
| BR-10 | Maximum 50 characters per type name |
| BR-11 | Set Default preferences are local to the device (no cross-device sync) |
| BR-12 | All API calls require encrypted `moduledata` header (AES-256-CBC) |
| BR-13 | Mobile uses NavigationLink/Activity navigation; no nested popups |
| BR-14 | Save buttons on mobile are pinned at the bottom (full-width dark) |
| BR-15 | Notes are NOT exposed in Day Detail action buttons (drawer only) |

---

## Status Badges & Visual Indicators

### Day-level Indicators

| Badge | Color | Meaning |
|-------|-------|---------|
| Today | 🟢 Green pill | Current date |
| Past | Grey text | Date is in the past (blocks edits) |
| Locked | 🟧 Orange highlight + "(fixed)" | Date locked by parent context |
| Selected | ⬛ Dark fill | User has chosen this date |

### Schedule Type Pills (System)

| Type | Color | Hex |
|------|-------|-----|
| Prep | 🟧 Orange | `#F39C12` |
| Shoot | 🟥 Red | `#E74C3C` |
| Wrap | 🟩 Green | `#27AE60` |
| Day Off | ⬜ Grey | `#95A5A6` |
| Travel | 🟦 Blue | `#3498DB` |

### Activity History Action Borders

| Action | Color |
|--------|-------|
| Added | 🟢 Green |
| Changed | 🔵 Blue |
| Removed | 🔴 Red |
| Copied | 🟣 Purple |
| Shared | 🟠 Orange |

---

## Glossary

| Term | Definition |
|------|------------|
| **Box Schedule** | The production calendar module — the entire feature being documented |
| **Schedule Day** | A single date assigned to a type (smallest unit) |
| **Schedule Block** | A multi-day group of dates assigned to a single type (e.g., "Prep Apr 17-21") |
| **Type** | A category of activity with name + color |
| **System Type** | One of 5 pre-installed types — cannot delete |
| **Custom Type** | User-created type with any name and color |
| **Event** | Timed activity attached to a day |
| **Note** | Text reminder attached to a day |
| **Conflict** | Trying to schedule on a date that already has a schedule |
| **Replace / Extend / Overlap** | The 3 conflict resolution options |
| **Locked Date** | Date that cannot be changed in the form (used when launched from a calendar cell) |
| **Single Day Edit** | Editing only one day from a multi-day block |
| **Activity Log** | Chronological history of all user actions |
| **Set as Default** | Saving the user's preferred view to load first |
| **Drawer** | Slide-out menu accessed from ☰ icon |
| **Day Detail** | Page showing all schedules/events/notes for a specific day |
| **Pill** | Colored capsule showing a type name |
| **Tag** | Small removable chip showing a selected date |
| **moduledata** | Encrypted authentication header for all API calls |

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Manager | | | |
| Lead Designer | | | |
| QA Lead | | | |
| Engineering Lead | | | |
| Stakeholder | | | |

---

**End of Document**

For additional documentation:
- **Tester Guide:** `CONFLUENCE_Testing_Guide.md` — step-by-step test cases
- **Architecture Overview:** `CONFLUENCE_Box_Schedule_Mobile.md` — system design
- **Developer PDFs:** `Box_Schedule_Backend.pdf`, `Box_Schedule_iOS.pdf`, `Box_Schedule_Web.pdf`, `Box_Schedule_Android.pdf`
