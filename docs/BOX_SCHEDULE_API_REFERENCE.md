# Box Schedule — API Reference

Complete endpoint reference for the Box Schedule module and its supporting endpoints (User Presets, Project Users, Departments). Use this when building or testing any client (web, iOS, Android, backend integration).

---

## Table of Contents

1. [Hosts](#1-hosts)
2. [Authentication & Headers](#2-authentication--headers)
3. [Common Response Envelope](#3-common-response-envelope)
4. [Schedule Types](#4-schedule-types)
5. [Schedule Days](#5-schedule-days)
6. [Events](#6-events)
7. [Calendar](#7-calendar)
8. [Activity Log](#8-activity-log)
9. [Revisions](#9-revisions)
10. [Share](#10-share)
11. [User Presets](#11-user-presets)
12. [Project Users](#12-project-users)
13. [Departments](#13-departments)
14. [Error Codes](#14-error-codes)

---

## 1. Hosts

| Environment | Production-API host (presets, box-schedule) | Project-API host (users, departments) |
|---|---|---|
| **Development** | `https://productionapi-dev.zillit.com` | `https://projectapi-dev.zillit.com` |
| **QA** | `https://productionapi-qa.zillit.com` | `https://projectapi-qa.zillit.com` |
| **Production** | `https://productionapi.zillit.com` | `https://projectapi.zillit.com` |

> **Important:** Box Schedule and User Presets live on **`productionapi`**. Project Users and Departments live on **`projectapi`**. Both hosts share the same auth scheme.

All paths in this doc are relative — prefix them with the host above.

---

## 2. Authentication & Headers

Every request carries an encrypted-header auth scheme. There are three categories: **always-required**, **per-request computed**, and **browser-only**.

### 2.1. Always required

| Header | Example | Notes |
|---|---|---|
| `Accept` | `application/json, text/html` | |
| `Accept-Charset` | `UTF-8` | |
| `Content-Type` | `application/json` | POST / PUT only |
| `Timezone` | `Asia/Kolkata` | User's IANA timezone |
| `moduledata` | (encrypted hex token — see § 2.2) | Identifies user · project · device · timestamp |
| `bodyhash` | (SHA-256 hex — see § 2.3) | Body integrity signature |

### 2.2. `moduledata`

AES-256-CBC encrypted hex of:

```json
{
  "device_id": "<device id>",
  "project_id": "<active project id>",
  "user_id": "<logged-in user id>",
  "time_stamp": <current epoch ms>
}
```

The encryption key + IV are environment-specific. Keep `moduledata` fresh per request — it embeds a timestamp the server may validate.

### 2.3. `bodyhash`

For **POST / PUT** with a body:

```
bodyhash = sha256_hex(JSON.stringify(body))
```

Lower-case hex (64 chars). The server verifies the hash against the body bytes received, so send the body verbatim — re-serialising after hashing will mismatch.

For **GET / DELETE** (no body): use a fixed placeholder hash agreed with the server team.

### 2.4. Browser-only headers

Required for any request originating from `Origin: https://*.zillit.com`:

| Header | Example |
|---|---|
| `appversion` | `1.0.0` |
| `cache-control` | `no-cache` |
| `devicename` | `{"browser":{"name":"Chrome","version":"147.0.0.0"},"os":{"name":"macOS","version":"10.15.7"},"platform":{"type":"desktop","vendor":"Apple"},"engine":{"name":"Blink"}}` |

Native mobile clients (iOS URLSession, Android OkHttp) skip these — server only enforces them when an `Origin` header is present.

---

## 3. Common Response Envelope

All endpoints return:

```json
{
  "status": 200,
  "message": "OK",
  "data": <payload — object, array, or null>
}
```

| Field | Type | Notes |
|---|---|---|
| `status` | number | HTTP-style code; `200`/`201` = success |
| `message` | string | Human-readable. Use this in error toasts |
| `data` | any | Payload; shape documented per-endpoint below |

Some error responses also include `messageElements: string[]` for templated messages.

### 3.1. Label-key wrapper

Department / designation values from the API are wrapped:

```
"{department:camera_label}"
"{designation:second_ad_label}"
```

Strip the wrapper before display. Regex: `^\{[^:]+:([^}]+)\}$` → group 1 is the inner key.

---

## 4. Schedule Types

Base path: `/api/v2/box-schedule/types`

### 4.1. `GET /api/v2/box-schedule/types`

List all schedule types for the active project.

**Request:** no body.

**Response `data`:** `Array<ScheduleType>`

```json
{
  "status": 200,
  "data": [
    {
      "_id": "65a1…",
      "projectId": "640e…",
      "title": "Pre-production",
      "color": "#3498DB",
      "order": 0,
      "createdAt": 1714608000000,
      "updatedAt": 1714608000000
    }
  ]
}
```

### 4.2. `POST /api/v2/box-schedule/types`

Create a new schedule type.

**Request body:**

```json
{
  "title": "Pre-production",
  "color": "#3498DB"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | yes | Trimmed, non-empty |
| `color` | string | yes | Hex with `#` prefix |

**Response `data`:** the created `ScheduleType` (same shape as § 4.1).

### 4.3. `PUT /api/v2/box-schedule/types/:id`

Update an existing schedule type.

**Path params:** `id` — the type's `_id`.

**Request body:**

```json
{
  "title": "Pre-production",
  "color": "#3498DB",
  "order": 1
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | yes | |
| `color` | string | yes | |
| `order` | number | no | Integer sort index |

### 4.4. `DELETE /api/v2/box-schedule/types/:id`

Delete a schedule type.

**Path params:** `id`.
**Request:** no body.

---

## 5. Schedule Days

Base path: `/api/v2/box-schedule/days`

### 5.1. `GET /api/v2/box-schedule/days`

List schedule days, optionally filtered.

**Query params (all optional):**

| Param | Type | Notes |
|---|---|---|
| `from` | epoch ms | Start of window (inclusive) |
| `to` | epoch ms | End of window (inclusive) |
| `typeId` | string | Filter by schedule-type id |

**Response `data`:** `Array<ScheduleDay>`

```json
{
  "status": 200,
  "data": [
    {
      "_id": "66b2…",
      "projectId": "640e…",
      "typeId": "65a1…",
      "typeName": "Pre-production",
      "title": "Director recce",
      "calendarDays": [1714608000000, 1714694400000],
      "color": "#3498DB",
      "createdAt": 1714608000000,
      "updatedAt": 1714608000000
    }
  ]
}
```

### 5.2. `POST /api/v2/box-schedule/days`

Create a new schedule day.

**Request body:**

```json
{
  "typeId": "65a1…",
  "title": "Director recce",
  "calendarDays": [1714608000000, 1714694400000],
  "color": "#3498DB"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `typeId` | string | yes | Schedule-type id |
| `title` | string | no | Optional display label |
| `calendarDays` | number[] | yes | Epoch-ms timestamps for each day |
| `color` | string | no | Override the type's default colour |

### 5.3. `PUT /api/v2/box-schedule/days/:id`

Update a schedule day. Same body as § 5.2; all fields optional.

### 5.4. `PUT /api/v2/box-schedule/days/:id/single-date`

Atomic single-day type change (used by the "Edit Day" flow).

**Path params:** `id`.

**Request body:**

```json
{
  "date": 1714608000000,
  "typeId": "65a1…",
  "action": "change_type"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `date` | number (epoch ms) | yes | The single day to change |
| `typeId` | string | yes | New type to apply |
| `action` | string | yes | Server-defined action verb (e.g. `"change_type"`) |

### 5.5. `DELETE /api/v2/box-schedule/days/:id`

Delete a schedule day.

### 5.6. `POST /api/v2/box-schedule/days/bulk`

Bulk-update multiple days in one call.

**Request body:**

```json
{
  "updates": [
    { "id": "66b2…", "typeId": "65a1…", "title": "Recce" },
    { "id": "66b3…", "calendarDays": [1714608000000] }
  ]
}
```

### 5.7. `POST /api/v2/box-schedule/days/remove-dates`

Remove specific dates from existing days (without deleting the whole day).

**Request body:**

```json
{
  "entries": [
    { "dayId": "66b2…", "dates": [1714608000000] }
  ]
}
```

### 5.8. `POST /api/v2/box-schedule/days/duplicate`

Duplicate a day onto a new start date.

**Request body:**

```json
{
  "sourceDayId": "66b2…",
  "newStartDate": 1714780800000
}
```

---

## 6. Events

Base path: `/api/v2/box-schedule/events`

### 6.1. `GET /api/v2/box-schedule/events`

List events, optionally scoped.

**Query params (all optional):**

| Param | Type | Notes |
|---|---|---|
| `scheduleDayId` | string | Filter by schedule-day id |
| `from` | epoch ms | Window start |
| `to` | epoch ms | Window end |

**Response `data`:** `Array<Event>` — same shape as the create body (§ 6.2) plus server fields (`_id`, `createdAt`, `updatedAt`).

### 6.2. `POST /api/v2/box-schedule/events`

Create an event or note.

**Request body — full event payload (always send every key):**

```json
{
  "scheduleDayId": "66b2…",
  "date": 1714608000000,
  "eventType": "event",
  "title": "Production Meeting",
  "color": "#3498DB",
  "description": "Kickoff sync",
  "startDateTime": 1714608000000,
  "endDateTime":   1714611600000,
  "fullDay": false,
  "location": "Studio A",
  "locationLat": 28.577096,
  "locationLng": 77.317169,
  "reminder": "15min",
  "repeatStatus": "none",
  "repeatEndDate": 0,
  "timezone": "Asia/Kolkata",
  "callType": "meet_in_person",
  "textColor": "#FFFFFF",
  "distributeTo": "users",
  "distributeUserIds": ["67f9…", "68d5…"],
  "distributeDepartmentIds": [],
  "userPresetId": null,
  "organizerExcluded": false,
  "advancedEnabled": true
}
```

| Field | Type | Notes |
|---|---|---|
| `scheduleDayId` | string \| null | Link to a Schedule Day; `null` for standalone events |
| `date` | number (epoch ms) | Day cell the event lives in |
| `eventType` | `"event"` \| `"note"` | Note bodies use a smaller subset (`title`, `notes`, `color`) |
| `title` | string | Trimmed, non-empty |
| `color` | string | Hex `#RRGGBB` |
| `description` | string | Free-text |
| `startDateTime` | number (epoch ms) | |
| `endDateTime` | number (epoch ms) | |
| `fullDay` | boolean | When `true`, time portion ignored |
| `location` | string | Human-readable address; `""` when not picked |
| `locationLat` | number \| null | `null` when not picked, **never `0`** |
| `locationLng` | number \| null | `null` when not picked |
| `reminder` | enum | `none` \| `at_time` \| `5min` \| `15min` \| `30min` \| `1hr` \| `1day` |
| `repeatStatus` | enum | `none` \| `daily` \| `weekly` \| `monthly` |
| `repeatEndDate` | number | `0` when no repeat (**never `null`**) |
| `timezone` | string | IANA timezone |
| `callType` | enum | `""` \| `meet_in_person` \| `audio` \| `video` |
| `textColor` | string | Hex; `""` when default |
| `distributeTo` | enum | See § 6.3 |
| `distributeUserIds` | string[] | Array, never `null`; populated only for `"users"` mode |
| `distributeDepartmentIds` | string[] | Array, never `null`; populated only for `"departments"` mode |
| `userPresetId` | string \| null | Populated only for `"presets"` mode |
| `organizerExcluded` | boolean | When `true`, the creator is excluded from invitees |
| `advancedEnabled` | boolean | Reserved flag |

#### Note body

For `eventType == "note"`:

```json
{
  "scheduleDayId": "66b2…",
  "date": 1714608000000,
  "eventType": "note",
  "title": "Rain backup plan",
  "notes": "Move scene 12 indoor",
  "color": "#F39C12"
}
```

### 6.3. `distributeTo` enum (canonical)

```
'' | 'self' | 'users' | 'departments' | 'all_departments' | 'presets'
```

Field combinations by mode (server validates):

| `distributeTo` | `distributeUserIds` | `distributeDepartmentIds` | `userPresetId` |
|---|---|---|---|
| `""` | `[]` | `[]` | `null` |
| `"self"` | `[]` | `[]` | `null` |
| `"all_departments"` | `[]` | `[]` | `null` |
| `"departments"` | `[]` | `["deptA", "deptB", …]` | `null` |
| `"users"` | `["userA", "userB", …]` | `[]` | `null` |
| `"presets"` | `[]` | `[]` | `"<presetId>"` |

> `"presets"` is **plural** on the wire. The body key is `userPresetId` (not `presetId`).

### 6.4. `PUT /api/v2/box-schedule/events/:id`

Update an event. Same body as § 6.2.

**Special response — 409 Conflict:** when the requested time slot conflicts with another schedule. UI should show a conflict view; do not retry.

### 6.5. `DELETE /api/v2/box-schedule/events/:id`

Delete an event.

---

## 7. Calendar

### 7.1. `GET /api/v2/box-schedule/calendar`

Composite endpoint returning the data needed to render the calendar grid (days + events keyed by day).

**Query params (all optional):**

| Param | Type | Notes |
|---|---|---|
| `from` | epoch ms | Window start |
| `to` | epoch ms | Window end |

**Response `data`:**

```json
{
  "days": [ /* ScheduleDay[] (§ 5.1 shape) */ ],
  "events": [ /* Event[] (§ 6.2 shape) */ ]
}
```

Standalone events (no linked schedule day) come back with `scheduleDayId: null`. Render them on the grid using `event.date` as the cell key.

---

## 8. Activity Log

### 8.1. `GET /api/v2/box-schedule/activity-log`

Audit trail for the active project.

**Query params (all optional):**

| Param | Type | Notes |
|---|---|---|
| `limit` | number | Page size |
| `cursor` | string | Pagination token from a previous response |

**Response `data`:**

```json
{
  "entries": [
    {
      "_id": "ac12…",
      "actorUserId": "67f9…",
      "action": "event_created",
      "entityType": "event",
      "entityId": "ev34…",
      "metadata": { "title": "Production Meeting" },
      "createdAt": 1714608000000
    }
  ],
  "nextCursor": "…" | null
}
```

---

## 9. Revisions

### 9.1. `GET /api/v2/box-schedule/revisions`

List historical revisions of the schedule.

**Query params:** same pagination shape as activity log.

**Response `data`:** `Array<Revision>`

```json
{
  "status": 200,
  "data": [
    {
      "_id": "rv11…",
      "projectId": "640e…",
      "revisionNumber": 12,
      "label": "Director's cut",
      "createdBy": "67f9…",
      "createdAt": 1714608000000
    }
  ]
}
```

### 9.2. `GET /api/v2/box-schedule/revisions/current`

Get the current (latest) revision marker.

**Request:** no body.
**Response `data`:** single `Revision`.

---

## 10. Share & PDF

A single endpoint generates a backend-rendered PDF (Puppeteer → S3) and returns the file as an **Attachment** alongside the share token. Both the **Share → Generate Link** flow and the **Print** button on every client call this one endpoint.

### 10.1. `POST /api/v2/box-schedule/share/generate-link`

**Request body — all fields optional:**

| Field | Type | Default | Notes |
|---|---|---|---|
| `from` | epoch ms | earliest day | Window start (filters which schedule days go into the PDF) |
| `to` | epoch ms | latest day | Window end |
| `dayIds` | string[] | all days | Specific schedule-day ids to include |
| `orientation` | `"landscape"` \| `"portrait"` | `"landscape"` | A4 page orientation |
| `format` | `"list"` \| `"calendar"` | `"list"` | Reserved for future calendar-grid layout |
| `title` | string | `"Production Schedule"` | Header title on the PDF |
| `watermark` | object \| null | none | Text + image overlay — see § 10.2 |

**Example:**

```json
{
  "orientation": "landscape",
  "title": "My Production Schedule",
  "watermark": {
    "text": "CONFIDENTIAL",
    "image": "https://cdn.zillit.com/logos/client.png",
    "opacity": 0.1,
    "fontSize": 96,
    "position": "center"
  }
}
```

**Response `data`:**

```json
{
  "token": "8f2c…",
  "shareUrl": "/shared/box-schedule/8f2c…",
  "attachment": {
    "bucket": "zillit-bucket-mumbai-prod",
    "region": "ap-south-1",
    "content_type": "document",
    "content_subtype": "pdf",
    "media": "box-schedule/file/640e…/Zillit_1714608000000.pdf",
    "thumbnail": "box-schedule/thumbnail/640e…/Zillit_1714608000000.jpg",
    "name": "Zillit_1714608000000.pdf",
    "file_size": "222855",
    "width": 1123,
    "height": 794,
    "duration": 0,
    "mediaUrl": "https://zillit-bucket-mumbai-prod.s3.ap-south-1.amazonaws.com/...?X-Amz-…",
    "thumbnailUrl": "https://zillit-bucket-mumbai-prod.s3.ap-south-1.amazonaws.com/...?X-Amz-…",
    "localFilePath": "",
    "localThumbnailPath": ""
  }
}
```

| Attachment field | Type | Notes |
|---|---|---|
| `bucket` | string | S3 bucket name |
| `region` | string | AWS region |
| `content_type` | string | Always `"document"` for PDFs |
| `content_subtype` | string | Always `"pdf"` |
| `media` | string | S3 key of the PDF |
| `thumbnail` | string | S3 key of the JPEG preview (page 1) |
| `name` | string | Suggested file name |
| `file_size` | string | Bytes (string per legacy model) |
| `width` / `height` | number | Page dimensions in px (1123×794 = A4 landscape @ 96 DPI) |
| `mediaUrl` | string | **Presigned read URL — TTL 1 hour.** Open this directly to view/print. |
| `thumbnailUrl` | string | Presigned URL for the thumbnail JPEG |
| `localFilePath` | string | Empty on response — clients fill after download |
| `localThumbnailPath` | string | Same — client-only |

### 10.2. Watermark spec

The `watermark` object overlays a text and/or image layer on every page. Both `text` and `image` may be present at once.

```ts
watermark?: {
  text?: string;        // e.g. "CONFIDENTIAL" — diagonal across each page
  image?: string;       // full URL or data: URI (logo / stamp)
  opacity?: number;     // 0..1, default 0.10
  fontSize?: number;    // px, default 96
  position?: "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
}
```

Behaviour notes:
- `center` (default) rotates text 30° counter-clockwise.
- Image scales to a max of 50% viewport width × 50% viewport height.
- `text` renders **on top of** `image` when both are set.
- Omit the `watermark` field entirely to skip the overlay.

### 10.3. Reuse semantics

- **Print button (any client)** → call `/share/generate-link` → open `attachment.mediaUrl` in a viewer/share sheet.
- **Share Link button** → same call; UI surfaces both the `shareUrl` (copy-paste) **and** a "Open PDF" action wired to `attachment.mediaUrl`.
- **Cache:** none in v1 — every call regenerates. Cheap on the dev server, may need throttling in prod.
- **History:** every successful call writes one `BoxScheduleActivityLog` entry: `action="shared"`, `details="Generated PDF (<filename>)"`. Visible in the History drawer.
- **Presigned URL TTL:** 1 hour. Re-call the endpoint to get a fresh URL once expired (or add `GET /share/:token/attachment` later if you need the same PDF rehydrated).

### 10.4. Reference cURL

```bash
curl 'https://productionapi-dev.zillit.com/api/v2/box-schedule/share/generate-link' \
  -H 'accept: application/json, text/html' \
  -H 'content-type: application/json' \
  -H 'timezone: Asia/Kolkata' \
  -H 'bodyhash: <SHA-256 hex of body>' \
  -H 'moduledata: <encrypted token>' \
  --data-raw '{
    "orientation": "landscape",
    "watermark": { "text": "DRAFT", "opacity": 0.08 }
  }'
```

---

## 11. User Presets

Base path: `/api/v2/user-preset` on **`productionapi-dev`**.

### 11.1. `GET /api/v2/user-preset`

List all user presets for the active project.

**Request:** no body.

**Response `data`:** `Array<UserPreset>`

```json
{
  "status": 200,
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

### 11.2. `POST /api/v2/user-preset` — create OR update

**Same endpoint, same method, both for create and update.** The server differentiates by whether `preset_id` is in the body.

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

| Field | Type | Required | Notes |
|---|---|---|---|
| `preset_id` | string | for **update** only | Omit entirely when creating |
| `preset_name` | string | yes | Non-empty after trim |
| `user_ids` | string[] | yes | Non-empty array, never `null` |

**Response:** standard envelope. The `data` may include the saved preset; clients should re-fetch the list (§ 11.1) to refresh UI.

#### Reference cURLs

```bash
# Create
curl 'https://productionapi-dev.zillit.com/api/v2/user-preset' \
  -H 'accept: application/json, text/html' \
  -H 'content-type: application/json' \
  -H 'appversion: 1.0.0' \
  -H 'cache-control: no-cache' \
  -H 'devicename: {"browser":{"name":"Chrome"…}}' \
  -H 'timezone: Asia/Kolkata' \
  -H 'bodyhash: <SHA-256 hex of body>' \
  -H 'moduledata: <encrypted token>' \
  --data-raw '{"preset_name":"Test 2","user_ids":["68ad…","68d5…"]}'

# Update — same URL, preset_id added
curl 'https://productionapi-dev.zillit.com/api/v2/user-preset' \
  -H 'accept: application/json, text/html' \
  -H 'content-type: application/json' \
  -H 'appversion: 1.0.0' \
  -H 'cache-control: no-cache' \
  -H 'devicename: {"browser":{"name":"Chrome"…}}' \
  -H 'timezone: Asia/Kolkata' \
  -H 'bodyhash: <SHA-256 hex of body>' \
  -H 'moduledata: <encrypted token>' \
  --data-raw '{"preset_id":"69eb…","preset_name":"MADE BY VIDYA","user_ids":["68ad…","68d5…"]}'
```

---

## 12. Project Users

Lives on **`projectapi-dev`** (different host from box-schedule).

### 12.1. `GET /api/v2/project/users`

List all users in the active project.

**Request:** no body.

**Response `data`:** `Array<ProjectUser>`

```json
{
  "status": 200,
  "data": [
    {
      "user_id": "67f9…",
      "full_name": "Randeep Singh",
      "first_name": "Randeep",
      "last_name": "Singh",
      "email": "randeep@example.com",
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

| Field | Type | Notes |
|---|---|---|
| `user_id` | string | Use as the canonical id (e.g. for `distributeUserIds`, `user_ids`) |
| `full_name` | string | Pre-built; fallback is `first_name + ' ' + last_name` |
| `department_name` | string (label key) | Resolve via § 3.1 |
| `designation_name` | string (label key) | Resolve via § 3.1 |
| `is_admin` | boolean | Show ADMIN badge in UI |
| `status` | string | **Don't filter by this client-side** — values vary, show every row the API returns |
| `profile_picture` | object \| null | `{ url, thumbnail }` shape varies; fallback to `profile_picture_thumbnail` string |

---

## 13. Departments

Lives on **`projectapi-dev`**.

### 13.1. `GET /api/v2/departments`

List all departments in the active project.

**Query params (optional):**

| Param | Type | Notes |
|---|---|---|
| `designations` | boolean | When `true`, each department row includes a nested `designations` array |

**Request:** no body.

**Response `data`:** `Array<Department>`

```json
{
  "status": 200,
  "data": [
    {
      "id": "650a…",
      "project_id": "640e…",
      "department_name": "{department:camera_label}",
      "identifier": "camera",
      "system_defined": true,
      "designations": [
        {
          "id": "651b…",
          "designation_name": "{designation:dop_label}",
          "identifier": "dop",
          "system_defined": true
        }
      ]
    }
  ]
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | string | Some payloads use `_id` — accept either |
| `department_name` | string (label key) | Resolve via § 3.1 |
| `system_defined` | boolean | `true` for built-in departments |
| `designations` | array \| absent | Present only when `?designations=true` |

---

## 14. Error Codes

Servers return non-2xx HTTP statuses with the standard envelope (§ 3) holding the error message.

| Status | Meaning | Client behaviour |
|---|---|---|
| **400** | Bad request — body validation failed | Surface `message` to the user |
| **401** | Unauthorized — `moduledata` invalid / expired | Clear local auth and redirect to login |
| **403** | Forbidden — user lacks access to this project / resource | Show "permission denied" |
| **404** | Resource not found | |
| **409** | Conflict — currently used by `PUT /events/:id` for time-slot collisions | Show conflict UI; do not auto-retry |
| **5xx** | Server error | Generic "Something went wrong" + offer retry |

Sample error response:

```json
{
  "status": 400,
  "message": "Preset name is required",
  "messageElements": ["preset_name"]
}
```

---

**Last updated:** 2026-04-25
**Owner:** mobile / web team
