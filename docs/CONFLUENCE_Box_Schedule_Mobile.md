# Box Schedule — Mobile Implementation (iOS + Android)

**Project:** Zillit LCW
**Module:** Box Schedule (6th tool)
**Platforms:** iOS 14+ (SwiftUI), Android 7+ (Kotlin), Web (React)
**Backend:** Location microservice (port 5003) — V2 API
**Status:** ✅ Feature complete, build verified on iOS 17.5 simulator

---

## 1. Executive Summary

Box Schedule is the production calendar feature within Zillit LCW. It allows film crews (50+ year-old film professionals) to plan shoot days, prep, wrap, day-off, and travel blocks across a project timeline. The mobile implementation mirrors the web version with all functionality including:

- Schedule creation with 3 date modes (Date Range, Calendar, Day Wise)
- Single-day editing with conflict resolution (Replace / Extend / Overlap)
- Calendar/List views with persistent default preferences
- Activity history with filtering
- Schedule type management (CRUD)
- Events and Notes tied to schedule days
- 409 conflict popup when overlapping dates

**Critical mobile design decision:** The "schedule title" field has been **removed** on mobile (web has it). Schedules are identified by their type name + date range only.

---

## 2. Architecture Overview

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   Web (React)   │       │   iOS (SwiftUI) │       │ Android (Kotlin)│
│   Port 3000     │       │   Deployment 14+│       │   Min SDK 24    │
└────────┬────────┘       └────────┬────────┘       └────────┬────────┘
         │                         │                         │
         │  HTTPS + moduledata header (AES-256-CBC)          │
         └─────────────────────────┼─────────────────────────┘
                                   │
                       ┌───────────▼────────────┐
                       │  Location Microservice │
                       │  Port 5003 — Express   │
                       │  V2 Box Schedule API   │
                       └───────────┬────────────┘
                                   │
                       ┌───────────▼────────────┐
                       │  MongoDB Atlas         │
                       │  Collections:          │
                       │  - boxScheduleTypes    │
                       │  - boxScheduleDays     │
                       │  - boxScheduleEvents   │
                       │  - activityLogs        │
                       └────────────────────────┘
```

---

## 3. Feature Matrix

| Feature | Web | iOS | Android |
|---------|-----|-----|---------|
| Schedule create — Date Range | ✅ | ✅ | ✅ |
| Schedule create — Calendar (multi-pick) | ✅ | ✅ | ✅ |
| Schedule create — Day Wise (weekday filter) | ✅ | ✅ | ✅ |
| Schedule title field | ✅ | ❌ (removed) | ❌ (removed) |
| Locked start date from calendar cell | ✅ | ✅ | ✅ |
| Single-day edit with Replace/Extend/Overlap | ✅ | ✅ | ✅ |
| 409 conflict popup | ✅ | ✅ | ✅ |
| Past dates disabled | ✅ | ✅ | ✅ |
| Calendar picked dates as removable tags | ✅ | ✅ | ✅ |
| Edit auto-fills type + dates + correct tab | ✅ | ✅ | ✅ |
| Add new type inline | ✅ | ✅ (via TypeManager) | ✅ (via TypeManager) |
| Day Detail with Edit/Delete on schedules | ✅ | ✅ | ✅ |
| Day Detail with Edit/Remove on events | ✅ | ✅ | ✅ |
| Day Detail with Delete on notes | ✅ | ✅ | ✅ |
| Set Default popover (Calendar/List) | ✅ | ✅ (overlay) | ✅ (dialog) |
| Set Default popover (Month/Week/Day) | ✅ | ✅ | ✅ |
| Set Default popover (By Date/Schedule) | ✅ | ✅ | ✅ |
| Activity history with date filter | ✅ | ✅ | ✅ |
| Type Manager (CRUD) | ✅ | ✅ | ✅ |
| Dark/Light theme | ✅ | ✅ | ✅ |
| Share schedule | ✅ | ✅ | ✅ |

---

## 4. Mobile Navigation Pattern

Both iOS and Android use **full-page navigation** (no popups/sheets) for primary screens. iOS specifically uses `NavigationLink` with `isActive` binding; Android uses `startActivity(Intent)`.

```
Box Schedule (Home)
├── ☰ Drawer
│   ├── Create Schedule       → push CreateSchedule page
│   ├── Create Event          → push CreateEvent page (mode="event")
│   ├── Create Note           → push CreateEvent page (mode="note")
│   ├── Edit Types            → push TypeManager page
│   ├── History               → push History page
│   ├── Theme toggle (inline)
│   └── Logout
├── Calendar/List Tab
│   └── Set Default → popover overlay (NOT page)
├── Calendar Tab
│   ├── Month/Week/Day picker
│   │   └── Set Default → popover overlay
│   └── Cell tap → push DayDetail page
│       ├── Edit schedule → push CreateSchedule(editingDay, isSingleDayEdit, singleDate)
│       ├── Delete schedule → confirmation alert
│       ├── Add Schedule → push CreateSchedule(lockedDate)
│       └── Add Event → push CreateEvent(mode="event")
└── List View
    ├── By Date / By Schedule picker
    │   └── Set Default → popover overlay
    └── Row tap → push DayDetail page
```

---

## 5. Critical Implementation Notes

### 5.1 iOS 14 Constraints
- **Only one `.sheet()` at a time** — using NavigationLink for everything
- No `presentationDetents` (iOS 16+)
- No `tint` color on ProgressView (iOS 15+)
- No `Layout` protocol (iOS 16+)

### 5.2 409 Conflict Handling
The backend returns HTTP 409 with a different response body shape (`{ data: { conflicts: [...] } }`) than the success response. The HTTP status MUST be checked before JSON decoding:

```
HTTP 409 → APIError.conflict (no decode attempt)
HTTP 4xx/5xx → APIError.serverError(code, msg)
HTTP 2xx → decode APIResponse<ScheduleDay>
```

The ViewModel catches `APIError.conflict` and triggers a popup overlay with Replace/Extend/Overlap options.

### 5.3 Single Day Edit Logic
When editing a single day from the day detail, the system shows:
- The locked date (read-only)
- Type picker (auto-filled with current type)
- If type is changed → 3 inline radio options:
  - **Replace** — Remove this date from the existing block, assign new type
  - **Extend** — Same as Replace, but extends original block by 1 day at the end
  - **Overlap** — Keep both schedules on the same date

---

## 6. File Structure

### iOS
```
ios/ZillitLCW/
├── App/                       # App entry + ContentView
├── Core/
│   ├── Auth/                  # AuthManager, EncryptionUtil (AES-256-CBC)
│   ├── Network/               # APIClient, BoxScheduleAPI, APIResponse
│   └── Theme/                 # AppColors (warm parchment palette)
├── Features/
│   ├── Login/                 # Project + user picker
│   └── BoxSchedule/
│       ├── BoxScheduleView.swift           # Root with drawer
│       ├── BoxScheduleViewModel.swift      # @MainActor business logic
│       ├── Calendar/
│       │   ├── CalendarView.swift          # Month/Week/Day modes
│       │   └── DayDetailView.swift         # Day detail page
│       ├── ListView/
│       │   └── ScheduleListView.swift      # By Date/By Schedule
│       ├── Create/
│       │   ├── CreateScheduleView.swift    # All 7 features
│       │   ├── CreateEventView.swift       # mode="event"|"note"
│       │   ├── ConflictView.swift          # (legacy, replaced by inline popup)
│       │   └── SetDefaultSheet.swift       # SetDefaultPopover overlay
│       ├── History/
│       │   └── HistoryView.swift           # Activity log with filters
│       ├── Share/
│       │   └── ShareView.swift
│       └── Types/
│           └── TypeManagerView.swift       # CRUD types
├── Models/                    # Codable models
├── Resources/                 # Localizable.strings
└── Utilities/                 # DateUtils, Extensions
```

### Android
```
android/app/src/main/
├── java/com/zillit/lcw/
│   ├── data/
│   │   ├── api/               # Retrofit-style Ktor client
│   │   ├── model/             # ScheduleDay, ScheduleEvent, ScheduleType, ActivityLog
│   │   └── repository/
│   ├── ui/
│   │   ├── login/             # LoginActivity (project + user picker)
│   │   ├── boxschedule/
│   │   │   ├── BoxScheduleActivity.kt      # Root with DrawerLayout
│   │   │   ├── BoxScheduleViewModel.kt     # LiveData ViewModel
│   │   │   ├── calendar/CalendarFragment.kt
│   │   │   ├── list/ListFragment.kt + ScheduleAdapter.kt
│   │   │   ├── create/
│   │   │   │   ├── CreateScheduleActivity.kt   # All 7 features
│   │   │   │   ├── CreateEventActivity.kt
│   │   │   │   └── ConflictDialog.kt
│   │   │   ├── detail/DayDetailActivity.kt # Full Activity (NOT BottomSheet)
│   │   │   ├── history/HistoryBottomSheet.kt
│   │   │   ├── share/ShareDialog.kt
│   │   │   └── types/TypeManagerDialog.kt
│   │   └── common/ThemeManager.kt
│   └── util/                  # DateUtils, extensions
└── res/
    ├── layout/                # XML layouts
    ├── values/                # Colors, dimens, strings (light)
    └── values-night/          # Dark theme overrides
```

---

## 7. API Reference (V2)

Base URL: `http://localhost:5003/api/v2/box-schedule`

All endpoints require `moduledata` header (encrypted JWT-like payload).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/types` | List schedule types |
| POST | `/types` | Create custom type |
| PUT | `/types/:id` | Update type |
| DELETE | `/types/:id` | Delete custom type |
| GET | `/days` | List schedule days |
| POST | `/days` | Create day(s) — returns 409 on conflict |
| PUT | `/days/:id` | Update day |
| DELETE | `/days/:id` | Delete day |
| POST | `/days/remove-dates` | Remove specific dates from a block |
| GET | `/calendar` | Aggregated calendar view |
| GET | `/events` | List events |
| POST | `/events` | Create event/note |
| PUT | `/events/:id` | Update event/note |
| DELETE | `/events/:id` | Delete event/note |
| GET | `/activity-log` | History entries |
| POST | `/share` | Share schedule (email or link) |

**409 Conflict Response:**
```json
{
  "status": 0,
  "message": "Date conflict",
  "data": {
    "conflicts": [{
      "date": 1776348933836,
      "existingType": "Prep"
    }]
  }
}
```

---

## 8. Acceptance Criteria

- [x] Mobile builds successfully on iOS Simulator (iPhone 15, iOS 17.5)
- [x] Mobile builds successfully on Android Emulator (API 34)
- [x] All 3 date modes work in Create Schedule
- [x] Conflict popup appears on overlapping dates
- [x] Past dates are visually disabled
- [x] Edit mode auto-fills type and dates
- [x] Set Default persists across app restarts (UserDefaults / SharedPreferences)
- [x] Day Detail shows Edit + Delete buttons on schedules and events
- [x] Theme toggles between Light/Dark
- [x] Drawer menu opens from right with all actions
- [x] No nested NavigationView causing extra header spacing
- [x] No Cancel button on toolbars (back button handles dismiss)

---

## 9. Known Limitations

1. **Schedule title field**: Intentionally removed from mobile per design decision. If re-added, edit auto-fill must populate it.
2. **Calendar picker performance**: Switched from `Set<DateComponents>` to `Set<Int64>` for O(1) lookup; large date selections (>100) may still feel slow on older devices.
3. **Single-day edit "Extend" action**: Currently uses simplified backend logic (createDay with `conflictAction: "overlap"`). Full extend logic (remove date + extend block) requires backend support.
4. **Iframe-based share**: Web has rich share preview; mobile uses native share sheet with link only.

---

## 10. Contact & Documentation

- Detailed developer documentation: see attached PDFs:
  - `Box_Schedule_Backend.pdf`
  - `Box_Schedule_iOS.pdf`
  - `Box_Schedule_Web.pdf`
  - `Box_Schedule_Android.pdf`
- Codebase: `/Users/vidyasagar/Downloads/zillit_lcw/`
- Memory snapshot: `mobile_box_schedule.md` in Claude session memory
