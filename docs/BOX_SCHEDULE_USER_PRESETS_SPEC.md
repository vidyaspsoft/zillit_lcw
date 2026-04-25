# Box Schedule — User Presets

**Cross-platform parity spec (Web · iOS · Android).** Two screens — a **Preset List** and a **Create New Preset** form — that let a user save a named bundle of project users for reuse in the event-distribute picker. This doc defines the user experience, state, and request/response contract so all three platforms behave identically.

> **Audience:** Android devs (primary), Web devs, iOS devs, designers, QA. Web + iOS are already shipped (April 2026); Android needs to match.

> **Endpoints concerned:** `GET /api/v2/user-preset` (list), `POST /api/v2/user-preset` (create). Both live on the production-api host (`https://productionapi-dev.zillit.com` for dev), not on the box-schedule subpath.

---

## 1. Where the screens live

### 1.1. Entry point

The Preset feature is reachable from the **Box Schedule side drawer** (Web: a "Presets" toolbar button on the Box Schedule page; iOS: a "Presets" item in the side menu next to "Edit Types"). On Android, add it to the same side drawer used by `BoxScheduleActivity`.

```
┌─ Side Menu ───────────┐
│  ▶ Create Schedule    │
│  ▶ Create Event       │
│  ▶ Create Note        │
│  ─────────────        │
│  ⚙  Edit Types        │
│  ⭐ Presets    ←  here │
│  🕒 History           │
│  ─────────────        │
│  ☾ Dark Mode    [ on ]│
└───────────────────────┘
```

- **Icon:** filled star (`star.fill` on iOS / equivalent vector on Android).
- **Tint:** orange (`#F39C12` family) so it visually groups with the "All Departments / Self" cards inside the Distribute picker.
- **Tap:** push a new full-screen activity (Android) / view (iOS / page (Web)) — **not** a dialog.

### 1.2. Two screens, one feature

```
[Side Menu] → tap "Presets" → [Preset List] → tap "+ New Preset" → [Create Preset]
                                ↑                                       │
                                └────── popped on save / cancel ────────┘
```

The Create screen is a child of the List. When Save succeeds, pop back to the List and refresh.

---

## 2. Preset List screen

### 2.1. Layout

```
┌─ Presets                                    + ─┐
│                                                 │
│  [🔍  Search presets…                        ]  │
│                                                 │
│  ⭐  My Crew                                ⓘ  │
│       5 members                                 │
│                                                 │
│  ⭐  Close Collaborators                    ⓘ  │
│       3 members                                 │
│                                                 │
│  ⭐  MADE BY VIDYA SAGAR                    ⓘ  │
│       10 members                                │
│      …  scrollable  …                           │
└─────────────────────────────────────────────────┘
```

| Element | Behaviour |
|---|---|
| **Title** | "Presets" |
| **Toolbar action** | "+" icon top-right → push **Create Preset** |
| **Search field** | Filters by `preset_name`, case-insensitive, substring match. Shown above the list. |
| **Row** | star (orange) · name (bold) · `N members` subtitle · info icon (right) |
| **Row tap** | (no-op for now — read-only list. Edit / delete / use-in-event are out-of-scope; flag if needed.) |
| **Info icon tap** | Opens **Member Detail Sheet** (§ 2.3). |

### 2.2. Empty / loading / error

| State | UI |
|---|---|
| Loading | Centred spinner. Don't show the search field until first load completes (avoid flicker). |
| Empty (`data: []`) | Centred "No presets yet" placeholder. Search field still visible so the user understands they're not stuck on a filter. |
| Network error | Centred error string from server (`message` field) or generic "Failed to load presets" with no retry button — pulling-to-refresh is the recovery path. (Pull-to-refresh is out-of-scope on Web; nice-to-have on iOS / Android.) |

### 2.3. Member Detail Sheet (info icon)

A bottom sheet (Android) / sheet (iOS) / modal dialog (Web) listing every member of the tapped preset.

```
┌─ MADE BY VIDYA SAGAR ─────────────────┐
│  Aviral Singh                         │
│    Driver                             │
│  Babu Dev                             │
│    Minibus Driver                     │
│  Bhavik Bhavik                        │
│    Art Dept Assistant                 │
│  …                                    │
│                              [ OK ]   │
└───────────────────────────────────────┘
```

- **Title:** the preset name.
- **Row:** full name (bold) + designation (small, secondary). No avatar required for v1.
- **Designation rendering:** the API returns label keys like `{designation:driver_label}` — strip the `{namespace:value}` wrapper before display. Both Web and iOS share a `resolveLabelKey()` helper; mirror it in Kotlin.
- **Dismiss:** OK button or backdrop tap.

---

## 3. Create New Preset screen

### 3.1. Layout

```
┌─ New Preset ──────────────────────────┐
│                                       │
│  PRESET NAME                          │
│  [_______________________________]    │
│                                       │
│  SELECT USERS  (3)         Select All │
│  [🔍  Search users…              ]    │
│                                       │
│  ☑  Randeep Aseries                   │
│       Direction · Director            │
│  ☐  Randeep Singh         [ ADMIN ]   │
│       Asst Directors · 2nd AD         │
│  ☑  Red ios                           │
│       Direction · Director            │
│  ☐  Redmi Device                      │
│       Studio · Studio Executive       │
│      …  scrollable  …                 │
│                                       │
│            [ Save Preset ]            │
└───────────────────────────────────────┘
```

### 3.2. Field 1 — Preset Name

- Single-line text input, required.
- Placeholder: *"e.g., My Crew"*.
- Trimmed on submit. Empty (after trim) → block save and show inline error / toast *"Preset name is required"*.
- No length cap enforced client-side (server limits if any).

### 3.3. Field 2 — Select Users

A multi-select list of the project's users.

- **Source:** `GET /api/v2/project/users` (same call used by the Distribute picker's "Users" tab — cache between picker uses if convenient).
- **Search:** above the list, case-insensitive substring match against `full_name`.
- **Row:** checkbox · full name (bold) · ADMIN tag (orange chip) when `is_admin == true` · `Department · Designation` subtitle (both label keys resolved).
- **Tap row:** toggles the checkbox.
- **Counter:** `Select Users (N)` in the section label, where N = number of currently selected users (across the **whole** list, not just the filtered view).
- **Select All link:** top-right of the section label. Behaviour:
  - If every currently-visible (filtered) user is already selected → label reads **"Clear All"** and tapping deselects them.
  - Otherwise → label reads **"Select All"** and tapping adds every visible user to the selection.
  - Selecting/deselecting respects the search filter — an empty search means "all users".
- At least one user must be selected before Save is allowed.

#### Web-specific note

Web uses a single AntD `<Select mode="multiple">` dropdown. Selected users render as removable tags inside the field. The "Select All" + "Clear" actions live inside the dropdown's header (rendered via `dropdownRender`). Android can use either pattern — full-page list is simpler and matches iOS.

### 3.4. Save / Cancel

- **Save Preset** — orange pill button pinned at the bottom of the screen.
  - Disabled state: `presetName.trim().isEmpty || selectedUserIds.isEmpty`.
  - Loading state: spinner inside the button + label flips to *"Saving…"*. Block subsequent taps while in flight.
  - On success: pop back to the Preset List **and** trigger its reload (the new preset must appear without manual refresh). Toast: *"Preset created"*.
  - On failure: stay on the screen, surface the server error message (toast or inline alert). Inputs are preserved.
- **Cancel** — system back / nav-bar back. Discards changes silently. No confirmation prompt.

### 3.5. Validation rules

| Rule | Error |
|---|---|
| `preset_name` blank after trim | *"Preset name is required"* |
| `user_ids` empty | *"Select at least one user"* |
| Server returns 4xx/5xx | Surface `response.body.message` if present; else generic *"Failed to create preset"* |

Validate on Save tap, not on every keystroke.

---

## 4. API contract

Both endpoints reuse the **same encrypted headers** as the Box Schedule API. They live on the production-api host even though they're not Box-Schedule-scoped — the picker reads them from the same `productionapi-dev.zillit.com` origin.

### 4.1. `GET /api/v2/user-preset` — list

**Headers:** `Accept`, `Accept-Charset`, `Timezone`, `bodyhash`, `moduledata` (same fixed test values as the rest of the box-schedule picker calls).

**Query params:** none.

**Response:**

```json
{
  "status": 200,
  "message": "OK",
  "data": [
    {
      "_id": "65a0…",
      "preset_name": "My Crew",
      "project_id": "640e…",
      "created_by": "67f9…",
      "created_on": 1714608000000,
      "updated_on": 1714608000000,
      "users": [
        {
          "user_id": "67f9…",
          "full_name": "Randeep Singh",
          "designation": "{designation:second_ad_label}",
          "device_id": "ios_…",
          "profile_picture_thumbnail": "https://…"
        }
      ]
    }
  ]
}
```

Map this to a model with:

| Field | Type | Source |
|---|---|---|
| `id` | String | `_id` |
| `name` | String | `preset_name` |
| `members` | List<PresetMember> | `users` |
| `memberCount` | Int | computed: `members.size` |

### 4.2. `POST /api/v2/user-preset` — create

**Headers:** same as GET, plus `Content-Type: application/json`.

**Request body:**

```json
{
  "preset_name": "Test 2",
  "user_ids": [
    "68ad9b9cc52533abf73a9217",
    "68d538734c89636f7da2dd67"
  ]
}
```

- `preset_name` — trimmed string, non-empty.
- `user_ids` — JSON array of user IDs (strings), non-empty. **Always send as an array, never null.**

**Response (success):** 200/201 with the standard `{ status, message, data }` envelope. The `data` field may include the newly-created preset shape from § 4.1, but clients should **not** depend on it — instead, refresh the list endpoint after a successful create.

### 4.3. Reference cURL

```bash
curl 'https://productionapi-dev.zillit.com/api/v2/user-preset' \
  -H 'accept: application/json, text/html' \
  -H 'content-type: application/json' \
  -H 'bodyhash: <fixed bodyhash>' \
  -H 'moduledata: <fixed moduledata>' \
  -H 'timezone: Asia/Calcutta' \
  --data-raw '{"preset_name":"Test 2","user_ids":["68ad9b9cc52533abf73a9217", …]}'
```

---

## 5. State / lifecycle

### 5.1. Preset List

| Trigger | What happens |
|---|---|
| Screen first appears | Fetch list. Show spinner until done. |
| Returning from Create (after success) | Re-fetch list. Don't optimistic-insert — let the server's response be the source of truth (avoids name-collision and id-allocation drift). |
| User taps "+" | Push Create screen. The list state (search query, scroll position) is preserved when popping back. |
| User taps info | Open Member Detail Sheet with the row's preset object — no extra API call needed. |

### 5.2. Create Preset

| Trigger | What happens |
|---|---|
| Screen first appears | Fetch project users (cache across picker openings if practical). Show spinner over the user list area only — the Preset Name input is usable immediately. |
| User edits Preset Name | Local state only. |
| User toggles user / Select All | Local state only. |
| User taps Save | Validate → POST → on success pop back + emit reload signal to the list → toast. |
| User taps Cancel / back | Discard. No prompt. |

---

## 6. Visual style

- **Accent colour:** `#F39C12` (`Color.primaryAccent` on iOS) for star icons, the Save Preset button, the ADMIN tag, the Select All link, and the row-selected highlight (15% opacity tint).
- **Row highlight:** a tinted background (`#F39C12` at ~15% opacity) on selected user rows during the create flow.
- **Form labels:** uppercase, 12px, semibold, secondary text colour, 0.5px letter-spacing — same as the existing Create Event form.
- **Save button:** full-width pill, orange fill, white text, 14px vertical padding, semibold 15px label. Disabled state uses a 40% opacity grey background.

---

## 7. Acceptance checklist

A platform implementation is "done" when **all** of the below are true:

### Preset List
- [ ] Reachable from the Box Schedule side drawer ("Presets" with orange star icon)
- [ ] "+" button in top-right of the screen
- [ ] Search field above the list, filters by `preset_name` substring
- [ ] Each row shows: star · name · "N members" · info icon
- [ ] Info icon opens a sheet listing every member with name + resolved designation
- [ ] Empty state shows "No presets yet"; loading state shows a spinner
- [ ] List re-fetches on return from Create (new preset visible without manual refresh)

### Create Preset
- [ ] Two fields: Preset Name (text input) + Select Users (multi-select list)
- [ ] Preset Name has placeholder "e.g., My Crew" and is required
- [ ] User list shows full name, ADMIN tag where `is_admin`, and `Department · Designation` subtitle (label keys resolved)
- [ ] Search above the user list, filters by `full_name`
- [ ] **Select All link** in the section label, toggles between Select All / Clear All based on whether all *visible* (filtered) users are selected
- [ ] Selected count appears in the section label: `Select Users (N)`
- [ ] Save button is disabled until both name is non-empty AND at least one user is selected
- [ ] Save shows a loading state and blocks repeat taps
- [ ] On success: pop back, list refreshes, toast "Preset created"
- [ ] On failure: stay on screen, surface server error, inputs preserved
- [ ] Cancel/back discards without prompt

### Wire format
- [ ] `POST /api/v2/user-preset` body includes `preset_name` (trimmed string) + `user_ids` (array, never null)
- [ ] Encrypted headers (`moduledata`, `bodyhash`, `Timezone`, `Accept`, `Accept-Charset`) match the Box Schedule picker calls
- [ ] Response is `{ status, message, data }`; client maps `_id` → `id`, `preset_name` → `name`, `users` → `members`

---

## 8. Out-of-scope (flag if you want it later)

- **Edit / rename / delete preset** — list is read-only after create. No PUT/DELETE endpoints used yet.
- **Reorder presets** — server already exposes a sort order field (`updated_on`), but client doesn't surface drag-to-reorder.
- **Use preset directly from this list** — the only consumer of presets is the Distribute picker's "Preset" tab (see `BOX_SCHEDULE_LOCATION_DISTRIBUTE_SPEC.md` § 3.2.4). No "use this preset for a new event" shortcut from this screen.
- **Avatar thumbnails** — the API returns `profile_picture_thumbnail`; client doesn't display it in v1 to keep rows tight.
- **Pull-to-refresh** — Web doesn't have it; iOS / Android can add it independently if it fits the platform idiom.
- **External / guest users in a preset** — server only accepts internal `user_ids`. No emails.

---

## 9. Reference — Web + iOS implementation locations

For cross-checking only. Android should match section 1–7; don't reverse-engineer behaviour from these.

| Concern | Web | iOS |
|---|---|---|
| Side-drawer entry | `frontend/src/components/box-schedule/BoxSchedulePage.jsx` ("Presets" toolbar button) | `ios/ZillitLCW/Features/BoxSchedule/BoxScheduleView.swift` (drawerItem in side drawer) |
| List screen | `frontend/src/components/box-schedule/PresetListModal.jsx` (`renderList`) | `ios/ZillitLCW/Features/BoxSchedule/Presets/PresetListView.swift` |
| Create screen | `PresetListModal.jsx` (`renderForm`) — same modal, two views | `ios/ZillitLCW/Features/BoxSchedule/Presets/CreatePresetView.swift` |
| API client | `frontend/src/services/distributeService.js` (`getUserPresets`, `createUserPreset`) | `ios/ZillitLCW/Core/Network/DistributeAPI.swift` |
| Models | inline in `distributeService.js` (resolveLabelKey + plain objects) | `ios/ZillitLCW/Models/DistributePicker.swift` (`UserPreset`, `PresetMember`) |
| Member sheet | `PresetListModal.jsx` (presetMembersOf modal) | `PresetListView.swift` (`PresetMembersSheet` — shared with `SelectInviteesView`) |

---

**Last updated:** 2026-04-25
**Owner of this doc:** mobile (Web + iOS) — keep in sync if behaviour changes.
