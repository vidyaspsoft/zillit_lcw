# Box Schedule — User Presets & Distribute-To Picker

**Cross-platform implementation handoff.** This document specifies two features that ship together inside the Box Schedule module:

1. **User Presets** — manage named bundles of project users (List · Create · Edit)
2. **Distribute-To picker** — choose who receives an event (used inside the Create / Edit Event form)

The two are intentionally bundled because the **Preset** tab inside the Distribute picker reads the same data as the standalone Preset list — they share API endpoints, payload shapes, and the same orange visual language.

This doc is **platform-neutral** — use it to build the equivalent feature in any stack (web framework, mobile, backend client). Web (React/AntD) and iOS (SwiftUI) reference implementations are noted in § 9 for cross-checking only.

> **Endpoints concerned:**
> - `GET https://productionapi-dev.zillit.com/api/v2/user-preset` — list presets
> - `POST https://productionapi-dev.zillit.com/api/v2/user-preset` — create OR update preset (server differentiates by presence of `preset_id` in body)
> - `GET https://projectapi-dev.zillit.com/api/v2/project/users` — fetch project users
> - `GET https://projectapi-dev.zillit.com/api/v2/departments` — fetch project departments
>
> Note that user / department endpoints live on a **different host** (`projectapi-dev`) than the preset and box-schedule endpoints (`productionapi-dev`). Both hosts accept the same encrypted-header auth scheme.

---

## 1. Feature 1 — User Presets

### 1.1. Where it lives

Reachable from the Box Schedule top-level UI:

- **Web:** "Presets" button in the Box Schedule page toolbar, between "Edit Types" and "History" (orange star icon).
- **iOS:** "Presets" item in the side drawer, same group as "Edit Types".
- **Android (target):** match either pattern — toolbar or drawer item.

```
┌─ Box Schedule ─────────────────────────────────┐
│  …  History   Share   Edit Types   ★ Presets  │
└────────────────────────────────────────────────┘
                                       ↓
                              ┌─ Presets ────┐
                              │  …           │
                              └──────────────┘
```

### 1.2. Preset List screen

```
┌─ Presets                                        ✕ ─┐
│                                                     │
│  [🔍  Search presets…                ] [+ New Preset]│
│                                                     │
│  ⭐  My Crew                              ✎    ⓘ   │
│       5 members                                     │
│                                                     │
│  ⭐  Close Collaborators                  ✎    ⓘ   │
│       3 members                                     │
│                                                     │
│  ⭐  MADE BY VIDYA SAGAR                  ✎    ⓘ   │
│       10 members                                    │
│      …  scrollable  …                               │
└─────────────────────────────────────────────────────┘
```

| Element | Behaviour |
|---|---|
| **Title** | "Presets" |
| **Search field** | Top-left, filters by `preset_name`, case-insensitive substring. |
| **+ New Preset button** | Top-right, orange filled. Opens the Create form. |
| **Row** | star (orange) · name (bold, 14px) · "N members" subtitle (12px secondary) · pencil icon (orange) · info icon (secondary) |
| **Pencil tap** | Open the form pre-filled with this preset's data → **Edit mode**. |
| **Info tap** | Open Member Detail dialog (§ 1.4). |
| **Row tap** | (no-op for now — read-only.) |

### 1.3. States

| State | UI |
|---|---|
| Loading | Centred spinner. |
| Empty (`data: []`) | Centred "No presets yet" placeholder. Search field stays visible. |
| Network error | Toast or inline message with the server's `message` field; otherwise *"Failed to load presets"*. |
| After create / edit success | List re-fetches automatically. Toast: *"Preset created"* / *"Preset updated"*. |

### 1.4. Member Detail dialog (info icon)

A modal/sheet listing every member of the tapped preset.

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

- **Title:** the preset's `name`.
- **Row:** `full_name` (bold) + resolved `designation` (small, secondary).
- **Designation rendering:** API returns label keys like `{designation:driver_label}` — strip the `{namespace:value}` wrapper before display (see § 5.4).
- **Dismiss:** OK button or backdrop tap.

### 1.5. Create / Edit Preset form

Same form for both modes — Edit just pre-fills and posts with `preset_id` added.

```
┌─ New Preset       (or "Edit Preset" in edit mode) ─┐
│                                                     │
│  PRESET NAME                                        │
│  [_______________________________________________]  │
│                                                     │
│  SELECT USERS  (3)                          Select All │
│  [ Multi-select dropdown — search inside       ▾ ]  │
│  ┌─────────────────────────────────────────────┐    │
│  │ Select All (29)                       Clear │    │
│  │ ─────────────────────────────────────────── │    │
│  │ ☑  Randeep Aseries                          │    │
│  │      Direction · Director                   │    │
│  │ ☐  Randeep Singh         [ ADMIN ]          │    │
│  │      Asst Directors · 2nd AD                │    │
│  │ ☑  Red ios                                  │    │
│  │      Direction · Director                   │    │
│  │ …  scrollable  …                            │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│              [ Cancel ]  [ Save Preset ]            │
└─────────────────────────────────────────────────────┘
```

#### Field 1 — Preset Name

- Single-line text input, **required**.
- Placeholder: *"e.g., My Crew"*.
- Trimmed on submit. Empty after trim → block save with toast *"Preset name is required"*.
- No client-side length cap.

#### Field 2 — Select Users

- Multi-select. Source: `GET /api/v2/project/users` (§ 4.2). Cache between picker openings if convenient.
- Each option shows: `full_name` (bold) · `[ADMIN]` chip when `is_admin` · subtitle `Department · Designation` (both label keys resolved).
- **Search** inside the dropdown — case-insensitive substring on `full_name`.
- **Select All / Clear All** action visible in the dropdown header:
  - "Select All (N)" adds every currently-visible (filtered) user to the selection.
  - "Clear" removes every selection.
  - The behaviour respects the search filter — typing a query then tapping "Select All" only adds the matches.
- Selected users appear as removable tags inside the field, collapsing on overflow.
- Selection counter in the section label: `Select Users (N)`.
- At least one user must be selected before Save.

#### Save / Cancel

| Button | Behaviour |
|---|---|
| **Save Preset** (Create mode) | Disabled when name is blank or no users selected. On tap → POST → on success: close form, refresh list, toast *"Preset created"*. |
| **Update Preset** (Edit mode) | Same as Save but POSTs with `preset_id`. Toast on success: *"Preset updated"*. |
| **Cancel / back arrow** | Discard changes silently — no confirmation. |

#### Validation

| Rule | Error |
|---|---|
| `preset_name` blank after trim | *"Preset name is required"* |
| `user_ids` empty | *"Select at least one user"* |
| Server 4xx / 5xx | Surface `response.body.message` if present; else generic *"Failed to create preset"* / *"Failed to update preset"* |

### 1.6. Edit-mode pre-fill

When the user taps the pencil icon on a row, the form opens with:

| Field | Initial value |
|---|---|
| Preset Name input | `preset.name` |
| Selected user IDs | `preset.members.map(m => m.user_id)` (members already include the IDs the preset was last saved with) |
| Form title | "Edit Preset" |
| Save button label | "Update Preset" |

On successful update, behave identically to create: close form, re-fetch list, toast.

---

## 2. Feature 2 — Distribute-To picker (inside Create Event)

### 2.1. Where it lives

Inside the Create / Edit Event form, the **Distribute To** field is a **non-editable, tap-to-open row** — same height as the Repeat / Timezone / Reminder spinners so the form has a consistent vertical rhythm.

```
┌─ Create Event ─────────────────────────────────┐
│  Title *                                        │
│  [_____________________________________________]│
│                                                 │
│  …                                              │
│                                                 │
│  DISTRIBUTE TO                                  │
│  [ 3 users selected — tap to edit            > ]│   ← tap to open picker
│  Select the department which you want to send…  │
│                                                 │
│              [ Save Event ]                     │
└─────────────────────────────────────────────────┘
```

The field shows a human-readable summary (see § 2.6). Tapping it opens the Select Invitees picker pre-filled with the current selection.

### 2.2. Picker layout

A **modal** (web) / **full-screen view** (mobile) with **5 tabs** in a horizontally-scrollable row.

```
┌─ Select Invitees                              ✕ ─┐
│                                                  │
│  ‹  [All Depts][Departments][Users][Preset][Self]  ›
│         (active = orange fill, others = neutral) │
│                                                  │
│  …  body changes per active tab  …               │
│                                                  │
│                                  [Cancel]   [Done (N)]
└──────────────────────────────────────────────────┘
```

- **Title:** "Select Invitees"
- **Close ✕:** cancels without saving
- **Active tab:** solid orange (`#F39C12` family) with white text
- **Inactive tabs:** neutral surface with border
- **Narrow screens:** small left/right chevrons appear at row edges; tabs scroll on chevron tap

### 2.3. Tabs

The user picks **exactly one mode** at a time. Switching tabs preserves browse state, but **picking** anything on a tab clears the others (the server's `distributeTo` enum is single-valued).

#### 2.3.1. All Depts

```
       ┌─────┐
       │ ▢ ▢ │       ← grid icon (orange)
       │ ▢ ▢ │
       └─────┘

    Invite all N team members          ← N = total project users
    Everyone in the project will be invited

           ┌──────────┐
           │Select All│                  ← tap to mark; tap again to unmark
           └──────────┘
```

- One-tap confirmation card.
- Button toggles the All-Depts mode on/off.
- When ON: `distributeTo = "all_departments"`. No IDs sent.
- When ON, button label reads **"Selected ✓"**.
- Done counter (footer) = total project user count.

#### 2.3.2. Departments

```
[🔍 Search departments…           Select All]
─────────────────────────────────────────────
☐  👥  Additional Crew
☐  👥  Armoury
☑  👥  Camera                             ← checked = selected
☐  👥  Direction
☑  👥  Producers
   …  scrollable  …
```

- Source: `GET /api/v2/departments` (§ 4.3).
- Search filters by department name (case-insensitive, on the **localised** label).
- "Select All" link selects every department in the (currently-filtered) list.
- Tap anywhere on the row toggles the checkbox.
- Done counter = number of selected departments.
- When ≥1 selected: `distributeTo = "departments"`, send `distributeDepartmentIds: [string]`.

#### 2.3.3. Users

```
[🔍 Search users…                 Select All]
─────────────────────────────────────────────
☐  👤  Randeep Aseries
       Direction · Director
☐  👤  Randeep Singh                    [Admin]
       Asst Directors · 2nd AD
☑  👤  Red ios
       Direction · Director
   …  scrollable  …
```

- Source: `GET /api/v2/project/users` (§ 4.2).
- Each row: avatar slot · full name (bold) · subtitle `"Department · Designation"` (both label keys resolved) · optional `[Admin]` badge.
- Search matches `full_name`.
- Done counter = number of selected users.
- When ≥1 selected: `distributeTo = "users"`, send `distributeUserIds: [string]`.

#### 2.3.4. Preset (single-select)

```
[🔍 Search presets…                          ]
Click ⓘ to view preset members                 ← discovery hint

─────────────────────────────────────────────
○  ⭐  My Crew                            ⓘ
       5 members
○  ⭐  Close Collaborators                ⓘ
       3 members
●  ⭐  MADE BY VIDYA SAGAR                ⓘ    ← radio-selected
       10 members
   …  scrollable  …
```

- Source: `GET /api/v2/user-preset` (§ 4.1) — same endpoint as the standalone Preset list.
- **Single-select** (radio) — only one preset can be picked at a time.
- Each row: name (bold) · "N members" subtitle · info icon.
- **Info icon** opens the same Member Detail dialog used in the standalone Preset list (§ 1.4).
- When picked: `distributeTo = "presets"` (plural — matches server enum), send `userPresetId: string`. **Don't expand into individual user IDs** — server fans out by preset id at delivery time.

#### 2.3.5. Self

```
       ┌─────┐
       │  👤 │      ← person icon (orange)
       └─────┘

           Only You
   This event will be visible to you only

         ┌──────────┐
         │Select Me │
         └──────────┘
```

- One-tap confirmation card (visually mirrors All Depts).
- Button toggles Self mode on/off.
- When ON: `distributeTo = "self"`. No IDs sent.
- When ON, button label reads **"Selected ✓"**.
- Done counter: 1.

### 2.4. Cross-tab rule (latest wins)

- Picking on a tab **clears** all other tabs' selections.
- Switching tabs without selecting doesn't clear (you can browse without disturbing your current pick).
- Footer Done counter only reflects the **active mode's** count.

### 2.5. Footer

```
                                 [Cancel]   [Done (N)]
```

- **Cancel** — outlined, dismisses without saving. Parent form keeps previous value.
- **Done (N)** — orange pill, **disabled when N == 0**.
  - N is the count for the active mode:
    - All Depts → total project user count
    - Self → 1
    - Departments → selected dept count
    - Users → selected user count
    - Preset → 1 (the chosen preset)
- Tap Done → close picker, return selection to parent form.

### 2.6. Field summary on the parent form

After Done, the parent Create-Event form's Distribute To row shows:

| `distributeTo` | Field text |
|---|---|
| `""` | (empty + hint *"Select"*) |
| `"self"` | *"Only Me"* |
| `"all_departments"` | *"All Departments"* |
| `"departments"` | *"Selected Departments: 3"* (or *"Selected Departments"* if count unknown) |
| `"users"` | *"3 users selected — tap to edit"* (use a plural string) |
| `"presets"` | preset name (lookup from cached preset list; fallback *"Preset"*) |

### 2.7. Re-open behaviour (Edit mode on existing event)

When the user re-opens the picker for an event that already has a distribute set:

- The matching tab is auto-selected.
- The tab's selection state is restored (checkboxes / radio / "Selected ✓").
- Picker scrolls to make the selected tab visible if off-screen.

### 2.8. Empty states

| Tab | Empty when | Copy |
|---|---|---|
| All Depts | project has 0 users (rare) | hide "Select All"; show "No team members" |
| Departments | no departments | "No departments yet" centred |
| Users | no users | "No users yet" centred |
| Preset | no presets | "No presets yet" centred |
| Self | always available | n/a |

---

## 3. Wire format — Create / Update Event request

When the user saves an event, the parent form's **Distribute** state contributes the keys below. Always include every key (even with empty / null defaults) so the server doesn't have to special-case missing fields.

### 3.1. Request body keys (relevant subset)

```json
{
  "distributeTo": "users",
  "distributeUserIds": ["6...", "7..."],
  "distributeDepartmentIds": [],
  "userPresetId": null,
  "organizerExcluded": false,
  "advancedEnabled": true
}
```

### 3.2. Distribute fields by mode

| `distributeTo` | `distributeUserIds` | `distributeDepartmentIds` | `userPresetId` |
|---|---|---|---|
| `""` | `[]` | `[]` | `null` |
| `"self"` | `[]` | `[]` | `null` |
| `"all_departments"` | `[]` | `[]` | `null` |
| `"departments"` | `[]` | `["deptA", "deptB", …]` | `null` |
| `"users"` | `["userA", "userB", …]` | `[]` | `null` |
| `"presets"` | `[]` | `[]` | `"<presetId>"` |

> **Note:** `distributeTo` value for the preset mode is `"presets"` (plural) on the wire — matches the server enum.

### 3.3. Server enum (canonical)

```
distributeTo: '' | 'self' | 'users' | 'departments' | 'all_departments' | 'presets'
```

### 3.4. Other event keys (full body for context)

```json
{
  "scheduleDayId": "<dayId>" | null,
  "date": 1714608000000,
  "eventType": "event",
  "title": "Production Meeting",
  "color": "#3498DB",
  "description": "Kickoff sync",
  "startDateTime": 1714608000000,
  "endDateTime":   1714611600000,
  "fullDay": false,
  "location": "Studio A",
  "locationLat": 28.577096 | null,
  "locationLng": 77.317169 | null,
  "reminder": "15min",
  "repeatStatus": "none",
  "repeatEndDate": 0,
  "timezone": "UTC",
  "callType": "meet_in_person",
  "textColor": "#FFFFFF",
  "distributeTo": "users",
  "distributeUserIds": ["6...", "7..."],
  "distributeDepartmentIds": [],
  "userPresetId": null,
  "organizerExcluded": false,
  "advancedEnabled": true
}
```

Send all dates / times as **epoch milliseconds** (numbers). `repeatEndDate: 0` when no repeat (not `null`). `locationLat` / `locationLng` are `null` when no location (not `0`). Arrays are never `null`.

---

## 4. API reference

### 4.1. `GET /api/v2/user-preset` — list presets

- **Host:** `productionapi-dev.zillit.com`
- **Headers:** see § 5
- **Query:** none
- **Response:**

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

Map to a model with:

| Model field | Source |
|---|---|
| `id` | `_id` |
| `name` | `preset_name` |
| `members` | `users` (each → `{ id: user_id, fullName: full_name, designation: resolveLabelKey(designation) }`) |
| `memberCount` | `members.length` |

### 4.2. `GET /api/v2/project/users` — list project users

- **Host:** `projectapi-dev.zillit.com` (different from preset/box-schedule host)
- **Headers:** see § 5
- **Query:** none
- **Response:**

```json
{
  "status": 200,
  "data": [
    {
      "user_id": "67f9…",
      "full_name": "Randeep Singh",
      "first_name": "Randeep",
      "last_name": "Singh",
      "email": "…@…",
      "department_id": "650a…",
      "department_name": "{department:asst_directors_label}",
      "designation_id": "651b…",
      "designation_name": "{designation:second_ad_label}",
      "is_admin": true,
      "status": "ACTIVE",
      "profile_picture": { "url": "https://…" },
      "profile_picture_thumbnail": "https://…"
    }
  ]
}
```

Map to:

| Model field | Source |
|---|---|
| `id` | `user_id` |
| `fullName` | `full_name` (or `first_name + ' ' + last_name`) |
| `departmentName` | `resolveLabelKey(department_name)` |
| `designationName` | `resolveLabelKey(designation_name)` |
| `isAdmin` | `!!is_admin` |
| `avatar` | `profile_picture.url` ‖ `profile_picture_thumbnail` |

> **Don't filter on `status`.** The dev API returns various status values that don't always literally equal `"ACTIVE"`. Show every row the API returns. (Drop only rows missing `user_id`.)

### 4.3. `GET /api/v2/departments` — list project departments

- **Host:** `projectapi-dev.zillit.com`
- **Headers:** see § 5
- **Query:** none
- **Response:**

```json
{
  "status": 200,
  "data": [
    {
      "id": "650a…",
      "project_id": "640e…",
      "department_name": "{department:camera_label}",
      "identifier": "camera",
      "system_defined": true
    }
  ]
}
```

Map to:

| Model field | Source |
|---|---|
| `id` | `id` ‖ `_id` |
| `name` | `resolveLabelKey(department_name)` |
| `systemDefined` | `!!system_defined` |

### 4.4. `POST /api/v2/user-preset` — create OR update preset

**Same endpoint, same method, both for create and update.** The server differentiates by whether `preset_id` is present in the body.

- **Host:** `productionapi-dev.zillit.com`
- **Headers:** see § 5 — including `Content-Type: application/json` and a body-specific `bodyhash` (§ 5.3)

#### Create body

```json
{
  "preset_name": "Test 2",
  "user_ids": [
    "68ad9b9cc52533abf73a9217",
    "68d538734c89636f7da2dd67"
  ]
}
```

#### Update body (extra `preset_id` field)

```json
{
  "preset_id": "69eb7c02ad58a66dca5e17ba",
  "preset_name": "MADE BY VIDYA",
  "user_ids": [
    "68ad9b9cc52533abf73a9217",
    "68d538734c89636f7da2dd67"
  ]
}
```

#### Rules

- `preset_name` — non-empty string after trim.
- `user_ids` — array of user ID strings, **non-empty**, never `null`.
- `preset_id` — string. **Omit entirely for create**; include for update.

#### Response

Standard envelope `{ status, message, data }`. The `data` may include the saved preset, but **don't depend on it** — re-fetch the list (`GET /api/v2/user-preset`) after a successful create/update to keep the UI in sync.

### 4.5. Reference cURLs

#### Create

```bash
curl 'https://productionapi-dev.zillit.com/api/v2/user-preset' \
  -H 'accept: application/json, text/html' \
  -H 'content-type: application/json' \
  -H 'appversion: 1.0.0' \
  -H 'cache-control: no-cache' \
  -H 'devicename: {"browser":{"name":"Chrome"…}}' \
  -H 'timezone: Asia/Calcutta' \
  -H 'bodyhash: <SHA-256 hex of the request body>' \
  -H 'moduledata: <encrypted user/device/project token>' \
  --data-raw '{"preset_name":"Test 2","user_ids":["68ad…","68d5…"]}'
```

#### Update (same URL, `preset_id` in body)

```bash
curl 'https://productionapi-dev.zillit.com/api/v2/user-preset' \
  -H 'accept: application/json, text/html' \
  -H 'content-type: application/json' \
  -H 'appversion: 1.0.0' \
  -H 'cache-control: no-cache' \
  -H 'devicename: {"browser":{"name":"Chrome"…}}' \
  -H 'timezone: Asia/Calcutta' \
  -H 'bodyhash: <SHA-256 hex of the request body>' \
  -H 'moduledata: <encrypted user/device/project token>' \
  --data-raw '{"preset_id":"69eb…","preset_name":"MADE BY VIDYA","user_ids":["68ad…","68d5…"]}'
```

---

## 5. Required headers (all endpoints)

Every request to `productionapi-dev` and `projectapi-dev` must carry the encrypted-header auth scheme. Headers fall into three groups: **always-fixed**, **browser-only fixed**, and **per-request computed**.

### 5.1. Always required (all clients)

| Header | Value | Notes |
|---|---|---|
| `Accept` | `application/json, text/html` | Wider than just `application/json` — server expects both for browser-origin. |
| `Accept-Charset` | `UTF-8` | |
| `Content-Type` | `application/json` | POST / PUT only. |
| `Timezone` | `Asia/Kolkata` (or user's IANA TZ) | Server reads it for date-context. |
| `moduledata` | encrypted token (see § 5.2) | Identifies user · project · device · request timestamp. |
| `bodyhash` | SHA-256 hex of body (see § 5.3) | Server validates body integrity. |

### 5.2. `moduledata` — auth token

`moduledata` is an AES-256-CBC encrypted JSON payload:

```json
{
  "device_id": "<device id>",
  "project_id": "<active project id>",
  "user_id": "<logged-in user id>",
  "time_stamp": <current epoch ms>
}
```

It's hex-encoded after encryption. The encryption key + IV are environment-specific — production / staging / dev use different secrets.

For **testing against the dev API without local auth**, you can use a static `moduledata` value captured from the dev web app (it embeds a timestamp, so it expires; refresh from the browser network tab when it stops working).

### 5.3. `bodyhash` — body signature

For **POST / PUT** requests, `bodyhash` must be the **lower-case hex SHA-256 of the exact request body bytes** the client sends:

```
bodyhash = sha256_hex(JSON.stringify(body))
```

The server validates this signature against the body bytes it receives, so the body must be sent verbatim — don't re-serialise after hashing or the hashes won't match.

For **GET / DELETE** (no body), use a fixed placeholder hash agreed with the server team (or the SHA-256 of an empty string).

### 5.4. Browser-only headers

Browser clients (any HTTP request from `Origin: https://*.zillit.com`) must additionally send:

| Header | Value | Why |
|---|---|---|
| `appversion` | `1.0.0` | Server expects it for browser origins. |
| `cache-control` | `no-cache` | Disables intermediate caching of authenticated responses. |
| `devicename` | JSON string of UA breakdown — example below | Server logs / device-fingerprints by it. |

`devicename` example value (string):

```json
{
  "browser": {"name": "Chrome", "version": "147.0.0.0"},
  "os": {"name": "macOS", "version": "10.15.7", "versionName": "Catalina"},
  "platform": {"type": "desktop", "vendor": "Apple"},
  "engine": {"name": "Blink"}
}
```

Native mobile clients (iOS URLSession, Android OkHttp) **do not** need `appversion` / `cache-control` / `devicename` — the server skips that check when no `Origin` header is present.

### 5.5. Resolving label keys

Department and designation values from the API are wrapped like:

```
{department:camera_label}
{designation:second_ad_label}
```

Strip the `{namespace:value}` wrapper before display. A regex-based helper:

```
input = "{department:camera_label}"
match = /^\{[^:]+:([^}]+)\}$/.exec(input)
output = match ? match[1] : input
// → "camera_label"
```

(The actual localised string is owned by the server-side label table — long-term clients should fetch it. For now, displaying the inner key is acceptable for v1.)

---

## 6. State / lifecycle

### 6.1. Preset List

| Trigger | What happens |
|---|---|
| Modal / screen first opens | Fetch preset list. Show spinner until done. |
| Returning from Create / Edit (success) | Re-fetch list. Don't optimistic-insert — let the server be the source of truth. |
| User taps `+ New Preset` | Open the form in **create** mode (empty fields). |
| User taps pencil on a row | Open the form in **edit** mode, pre-filled. |
| User taps info on a row | Open Member Detail dialog. No extra API call. |
| User types in search | Filter locally. No API call. |

### 6.2. Create / Edit Preset form

| Trigger | What happens |
|---|---|
| Form first appears | Fetch project users (cache across openings if practical). Spinner over the user dropdown only — name input is usable immediately. If editing, pre-fill name + selected IDs. |
| User edits name / toggles users | Local state only. |
| User taps Save / Update | Validate → POST → on success: close form, refresh list, toast. |
| User taps Cancel / back | Discard. No prompt. |

### 6.3. Distribute picker (inside Create Event)

| Trigger | What happens |
|---|---|
| Picker first opens | Fetch users + departments + presets in parallel. Cache at the Distribute picker layer. |
| Picker re-opens (edit existing event) | Pre-select the matching tab, restore the saved selection. |
| User picks anything on a tab | Clear all other tabs' selections (latest-wins rule). |
| User taps Cancel | Discard, parent form unchanged. |
| User taps Done (N) | Map current state to the wire payload (§ 3.2), close, return to parent form. |

---

## 7. Visual style

| Token | Value |
|---|---|
| Accent (orange) | `#F39C12` family — used for star icons, active-tab fill, Save / Done buttons, ADMIN tag, "Select All" link, row-selected highlight at ~15% opacity |
| Active tab | solid orange fill, white text |
| Inactive tab | neutral surface, border, body text colour |
| Form labels | uppercase, 12px, semibold, secondary text colour, 0.5px letter-spacing |
| Save / Update button | full-width pill, orange fill, white text, 14px vertical padding, semibold 15px label. Disabled state at ~40% opacity grey |
| Tap-to-open row | input-style rounded rectangle, chevron-right on the right edge, placeholder colour for empty state |
| Selected row highlight | accent at ~15% opacity background |

---

## 8. Acceptance checklist

A platform implementation is "done" when **all** of the following are true.

### 8.1. Preset List
- [ ] Reachable from Box Schedule top-level UI ("Presets" with orange star icon)
- [ ] Search field + "+ New Preset" button on the same row
- [ ] Each row shows: star · name · "N members" · pencil icon · info icon
- [ ] **Pencil tap** opens the form in edit mode, pre-filled
- [ ] Info tap opens a Member Detail dialog with each member's name + resolved designation
- [ ] Empty state shows "No presets yet"; loading state shows a spinner
- [ ] List re-fetches automatically after a successful create OR update

### 8.2. Create / Edit Preset form
- [ ] Two fields: Preset Name (text input) + Select Users (multi-select with search)
- [ ] Preset Name placeholder *"e.g., My Crew"*; required
- [ ] User options show full name · ADMIN tag where `is_admin` · `Department · Designation` subtitle
- [ ] **Select All / Clear All** action available, respecting the search filter
- [ ] Selected count appears in the section label: `Select Users (N)`
- [ ] Save / Update button disabled until both name is non-empty AND at least one user is selected
- [ ] Save shows a loading state and blocks repeat taps
- [ ] On success: close form, refresh list, toast appropriate message
- [ ] On failure: stay on screen, show server error, inputs preserved
- [ ] Cancel / back discards without prompt
- [ ] Form title + button label flip between "New Preset" / "Save Preset" and "Edit Preset" / "Update Preset"

### 8.3. Distribute-To picker
- [ ] Field on Create Event is a non-editable, tap-to-open row with summary text + chevron
- [ ] Picker opens with **5 tabs** (All Depts · Departments · Users · Preset · Self)
- [ ] Active tab is visually distinct (orange fill); inactive tabs are neutral
- [ ] Tab row is horizontally scrollable on narrow screens with edge fade + chevrons
- [ ] **All Depts** tab shows the project's total user count
- [ ] **Departments** tab supports search + Select All; multi-select via checkbox; subtitles render label keys resolved
- [ ] **Users** tab shows full name, role subtitle (`Dept · Designation`, both resolved), and ADMIN badge where applicable
- [ ] **Preset** tab is single-select (radio); info icon shows member dialog with resolved designations
- [ ] **Self** tab one-tap confirms with "Selected ✓"
- [ ] Picking on any tab clears the other tabs (latest wins)
- [ ] Done counter reflects the active mode's count; disabled when 0
- [ ] Cancel discards changes; Done returns the new selection to the form
- [ ] Re-opening the picker on an event-being-edited restores the previous mode + items

### 8.4. Wire format
- [ ] `POST /api/v2/user-preset` body has `preset_name` (trimmed string) + `user_ids` (array, never null) + optional `preset_id` for updates
- [ ] Create-event body includes all distribute keys (§ 3.2) with the exact key names listed
- [ ] `distributeTo == "presets"` (plural — not `"preset"`)
- [ ] `userPresetId` (not `presetId`)
- [ ] `distributeUserIds` and `distributeDepartmentIds` are arrays, never `null`
- [ ] All dates/times sent as epoch milliseconds (numbers); `repeatEndDate: 0` when no repeat

### 8.5. Headers
- [ ] All requests include `Accept`, `Accept-Charset`, `Timezone`, `moduledata`
- [ ] POST / PUT requests include `Content-Type: application/json` and a freshly-computed SHA-256 `bodyhash`
- [ ] Browser-origin requests additionally include `appversion`, `cache-control: no-cache`, `devicename`
- [ ] User and Department endpoints hit the `projectapi-dev` host; preset and box-schedule endpoints hit `productionapi-dev`

---

## 9. Out-of-scope (flag if you want it later)

- **Delete preset** — no DELETE endpoint used yet. The list is read-only after create/edit.
- **Reorder presets** — server has `updated_on` for sort order, but the client doesn't surface drag-to-reorder.
- **Use preset directly from the standalone list** — the only consumer of presets is the Distribute picker's "Preset" tab. No "use this preset for a new event" shortcut from the standalone Preset screen.
- **Avatar thumbnails** — API returns `profile_picture_thumbnail`; client doesn't display in v1.
- **External / guest users** — server only accepts internal `user_ids`; no email-based invite path.
- **Mixed-mode distribute** — picking departments AND specific users on the same event isn't supported by the server enum; would need a new shape.
- **Pull-to-refresh** — nice-to-have on mobile, out of scope for v1.

---

## 10. Reference — Web (and iOS) implementation locations

For cross-checking only. Other platforms should not look at these to learn behaviour — use sections 1–8 above.

### Web (React / AntD)

| Concern | File |
|---|---|
| Preset list + create + edit (single modal, two views) | `frontend/src/components/box-schedule/PresetListModal.jsx` |
| Distribute-To picker (5-tab modal) | `frontend/src/components/box-schedule/SelectInviteesModal.jsx` |
| Create Event form (parent of distribute picker) | `frontend/src/components/box-schedule/CreateEventModal.jsx` |
| API client (presets, users, departments) | `frontend/src/services/distributeService.js` |
| Box Schedule API client (events) | `frontend/src/api/boxScheduleAxiosConfig.js` |
| Header constants + bodyhash interceptor | `frontend/src/config/constants.js` |

### iOS (SwiftUI)

| Concern | File |
|---|---|
| Preset list | `ios/ZillitLCW/Features/BoxSchedule/Presets/PresetListView.swift` |
| Create / Edit Preset | `ios/ZillitLCW/Features/BoxSchedule/Presets/CreatePresetView.swift` |
| Distribute-To picker | `ios/ZillitLCW/Features/BoxSchedule/Distribute/SelectInviteesView.swift` |
| Create Event form | `ios/ZillitLCW/Features/BoxSchedule/Create/CreateEventView.swift` |
| API client | `ios/ZillitLCW/Core/Network/DistributeAPI.swift` |
| Models | `ios/ZillitLCW/Models/DistributePicker.swift` |

---

**Last updated:** 2026-04-25
**Owner:** mobile / web team — keep in sync if behaviour changes.
