"""
Generates 4 developer PDFs for the Box Schedule mobile feature:
- Box_Schedule_Backend.pdf
- Box_Schedule_iOS.pdf
- Box_Schedule_Web.pdf
- Box_Schedule_Android.pdf
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, KeepTogether
)
from reportlab.lib import colors

# ─────────── Styles ───────────
styles = getSampleStyleSheet()

TITLE = ParagraphStyle('CustomTitle', parent=styles['Title'],
                       fontSize=22, textColor=HexColor('#1a1a1a'),
                       spaceAfter=14, alignment=TA_LEFT)

SUBTITLE = ParagraphStyle('Subtitle', parent=styles['Normal'],
                          fontSize=11, textColor=HexColor('#666666'),
                          spaceAfter=24, italic=True)

H1 = ParagraphStyle('H1', parent=styles['Heading1'],
                    fontSize=18, textColor=HexColor('#1a1a1a'),
                    spaceBefore=18, spaceAfter=10, leading=22)

H2 = ParagraphStyle('H2', parent=styles['Heading2'],
                    fontSize=14, textColor=HexColor('#2c3e50'),
                    spaceBefore=12, spaceAfter=6, leading=18)

H3 = ParagraphStyle('H3', parent=styles['Heading3'],
                    fontSize=12, textColor=HexColor('#444444'),
                    spaceBefore=8, spaceAfter=4)

BODY = ParagraphStyle('Body', parent=styles['Normal'],
                      fontSize=10, leading=14, spaceAfter=6,
                      textColor=HexColor('#222222'))

CODE = ParagraphStyle('Code', parent=styles['Code'],
                      fontSize=9, leading=12, fontName='Courier',
                      backColor=HexColor('#f5f5f5'),
                      borderColor=HexColor('#dddddd'), borderWidth=0.5,
                      borderPadding=8, leftIndent=0, rightIndent=0,
                      spaceBefore=4, spaceAfter=8,
                      textColor=HexColor('#1a1a1a'))

NOTE = ParagraphStyle('Note', parent=styles['Normal'],
                      fontSize=9, leading=12, fontName='Helvetica-Oblique',
                      backColor=HexColor('#fff3cd'),
                      borderColor=HexColor('#ffeeba'), borderWidth=0.5,
                      borderPadding=6, spaceBefore=4, spaceAfter=8,
                      textColor=HexColor('#856404'))


def code(text):
    """Wrap text as a code block with HTML escaping for reportlab."""
    escaped = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    return Paragraph(f'<font face="Courier" size="9">{escaped}</font>', CODE)


def note(text):
    return Paragraph(f"<b>📌 NOTE:</b> {text}", NOTE)


def make_table(data, col_widths=None):
    if not col_widths:
        col_widths = [2 * inch, 4 * inch]
    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#2c3e50')),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#cccccc')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, HexColor('#f9f9f9')]),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    return t


# ═══════════════════════════════════════════════════════════════════════
#  BACKEND PDF
# ═══════════════════════════════════════════════════════════════════════
def build_backend():
    doc = SimpleDocTemplate("Box_Schedule_Backend.pdf", pagesize=letter,
                            leftMargin=0.6 * inch, rightMargin=0.6 * inch,
                            topMargin=0.6 * inch, bottomMargin=0.6 * inch)
    s = []
    s.append(Paragraph("Box Schedule — Backend Developer Guide", TITLE))
    s.append(Paragraph("Zillit LCW · Location Microservice (port 5003) · V2 API", SUBTITLE))

    s.append(Paragraph("1. Overview", H1))
    s.append(Paragraph(
        "The Box Schedule backend lives in the Location microservice. All endpoints are V2 "
        "and use the encrypted <b>moduledata</b> header for authentication (AES-256-CBC). "
        "Mobile and web clients share the same API.", BODY))

    s.append(Paragraph("2. Authentication", H1))
    s.append(Paragraph(
        "Every request must include a <b>moduledata</b> header containing an AES-256-CBC encrypted "
        "JSON payload. The payload identifies the project, user, device, and timestamp.",
        BODY))
    s.append(code('''Payload (plaintext):
{
  "device_id": "string",
  "project_id": "string",
  "user_id": "string",
  "time_stamp": <epoch_ms>
}

Encryption: AES-256-CBC
Key: process.env.MODULE_DATA_KEY (32 bytes)
IV: First 16 bytes of the encrypted output
Header value: base64(IV + ciphertext)'''))

    s.append(Paragraph("3. Endpoints", H1))
    s.append(Paragraph("Base URL: <font face=\"Courier\">http://[host]:5003/api/v2/box-schedule</font>", BODY))

    s.append(Paragraph("3.1 Schedule Types", H2))
    s.append(make_table([
        ['Method · Path', 'Purpose'],
        ['GET /types', 'List all types for the project (system + custom)'],
        ['POST /types', 'Create custom type. Body: {title, color}'],
        ['PUT /types/:id', 'Update type. Body: {title, color}'],
        ['DELETE /types/:id', 'Delete custom type (system types are protected)'],
    ]))

    s.append(Paragraph("3.2 Schedule Days", H2))
    s.append(make_table([
        ['Method · Path', 'Purpose'],
        ['GET /days', 'List days. Query: startDate, endDate, typeId'],
        ['POST /days', 'Create day(s). May return 409 on date conflict'],
        ['PUT /days/:id', 'Update day'],
        ['DELETE /days/:id', 'Delete day'],
        ['POST /days/remove-dates', 'Remove specific dates from a block'],
        ['GET /calendar', 'Aggregated calendar view by month'],
    ]))

    s.append(Paragraph("3.3 Events & Notes", H2))
    s.append(make_table([
        ['Method · Path', 'Purpose'],
        ['GET /events', 'List events and notes'],
        ['POST /events', 'Create event/note. eventType: "event" | "note"'],
        ['PUT /events/:id', 'Update event/note'],
        ['DELETE /events/:id', 'Delete event/note'],
    ]))

    s.append(Paragraph("3.4 Activity Log & Sharing", H2))
    s.append(make_table([
        ['Method · Path', 'Purpose'],
        ['GET /activity-log', 'List activity entries (filterable by action, date)'],
        ['POST /share', 'Share schedule (email or generate shareable link)'],
    ]))

    s.append(PageBreak())

    s.append(Paragraph("4. Request/Response Shapes", H1))
    s.append(Paragraph("4.1 POST /days — Create Schedule", H2))
    s.append(code('''Request:
{
  "title": "",                 // mobile sends empty string (no title field)
  "typeId": "69daa04e...",
  "dateRangeType": "by_days" | "by_dates" | "day_wise",
  "calendarDays": [1776348933836, ...],
  "startDate": 1776348933836,
  "endDate": 1776348933836,
  "numberOfDays": 1,
  "timezone": "UTC",
  "conflictAction": "" | "replace" | "extend" | "overlap",
  "userName": "Alice Manager"
}

Success (201):
{
  "status": 1,
  "message": "schedule_day_created",
  "data": { _id, projectId, typeId, typeName, color,
            startDate, endDate, numberOfDays, calendarDays,
            createdBy, createdAt, updatedAt, ... }
}

Conflict (409):
{
  "status": 0,
  "message": "Date conflict on {N} day(s)",
  "data": {
    "conflicts": [
      { "date": 1776348933836, "existingType": "Prep" }
    ]
  }
}'''))

    s.append(Paragraph("4.2 Conflict Action Semantics", H2))
    s.append(make_table([
        ['Action', 'Behavior'],
        ['replace', 'Remove existing schedule on conflicting dates, create new in their place'],
        ['extend', 'Same as replace, but extend the original block by 1 day at the end'],
        ['overlap', 'Keep both schedules on the same date'],
        ['(empty)', 'No conflict resolution — return 409 if any overlap'],
    ]))

    s.append(Paragraph("5. Data Models (MongoDB)", H1))

    s.append(Paragraph("5.1 BoxScheduleType", H2))
    s.append(code('''{
  _id: ObjectId,
  projectId: ObjectId,
  title: String (unique per project),
  color: String (hex, e.g. "#F39C12"),
  systemDefined: Boolean (Prep/Shoot/Wrap/DayOff/Travel = true),
  createdBy: { userId, name },
  createdAt, updatedAt
}'''))

    s.append(Paragraph("5.2 BoxScheduleDay", H2))
    s.append(code('''{
  _id: ObjectId,
  projectId: ObjectId,
  title: String (mobile sends ""),
  typeId: ObjectId (ref BoxScheduleType),
  typeName: String (denormalized),
  color: String (denormalized),
  dateRangeType: "by_days" | "by_dates" | "day_wise",
  startDate: Number (epoch ms),
  endDate: Number (epoch ms),
  numberOfDays: Number,
  calendarDays: [Number] (epoch ms array),
  timezone: String,
  events: [ObjectId],
  notes: [ObjectId],
  version: Number,
  createdBy: { userId, name },
  deleted: 0 | 1,
  createdAt, updatedAt
}'''))

    s.append(Paragraph("5.3 BoxScheduleEvent (events + notes)", H2))
    s.append(code('''{
  _id: ObjectId,
  projectId: ObjectId,
  scheduleDayId: ObjectId,
  eventType: "event" | "note",
  title: String,
  description: String,
  startDate, endDate: Number (epoch ms),
  startTime, endTime: Number (epoch ms),
  fullDay: Boolean,
  repeat: "none" | "daily" | "weekly" | "monthly",
  reminder: "none" | "at_time" | "5min" | "15min" | "30min" | "1hr" | "1day",
  timezone: String,
  callType: String,
  location: String,
  color: String,
  createdBy: { userId, name },
  createdAt, updatedAt
}'''))

    s.append(Paragraph("6. Conflict Detection Algorithm", H1))
    s.append(Paragraph(
        "When POST /days is called without conflictAction, the controller queries for any "
        "existing BoxScheduleDay where calendarDays intersects with the incoming calendarDays. "
        "If matches exist, return 409 with the conflict array. Mobile/web clients then prompt "
        "the user for action and re-submit with conflictAction set.", BODY))
    s.append(code('''// Pseudocode
const overlap = await BoxScheduleDay.find({
  projectId,
  deleted: 0,
  calendarDays: { $in: incomingCalendarDays }
});

if (overlap.length > 0 && !conflictAction) {
  return res.status(409).json({
    status: 0,
    message: `Date conflict on ${overlap.length} day(s)`,
    data: { conflicts: overlap.map(formatConflict) }
  });
}'''))

    s.append(Paragraph("7. Notes for Mobile Compatibility", H1))
    s.append(note("Mobile sends <b>title: \"\"</b> on every schedule create. Backend should accept empty title (do not validate as required)."))
    s.append(note("HTTP status code MUST be exactly 409 for conflicts (not 400 or 200 with an error flag) — mobile clients depend on the status code."))
    s.append(note("All dates are <b>epoch milliseconds</b> (Number). No ISO strings."))
    s.append(note("The <b>userName</b> field in createdBy is denormalized for activity log readability."))

    doc.build(s)
    print("✅ Generated Box_Schedule_Backend.pdf")


# ═══════════════════════════════════════════════════════════════════════
#  iOS PDF
# ═══════════════════════════════════════════════════════════════════════
def build_ios():
    doc = SimpleDocTemplate("Box_Schedule_iOS.pdf", pagesize=letter,
                            leftMargin=0.6 * inch, rightMargin=0.6 * inch,
                            topMargin=0.6 * inch, bottomMargin=0.6 * inch)
    s = []
    s.append(Paragraph("Box Schedule — iOS Developer Guide", TITLE))
    s.append(Paragraph("SwiftUI · iOS 14+ deployment target · Native URLSession", SUBTITLE))

    s.append(Paragraph("1. Project Setup", H1))
    s.append(Paragraph("Path: <font face=\"Courier\">/Users/vidyasagar/Downloads/zillit_lcw/ios/</font>", BODY))
    s.append(Paragraph("Open <b>ZillitLCW.xcodeproj</b> in Xcode 15+. The project is generated from a Python script — never edit project.pbxproj by hand.", BODY))
    s.append(note("If <b>xcodeproj</b> is corrupted, regenerate it: <font face=\"Courier\">cd ios && python3 docs/regen_xcodeproj.py</font>"))

    s.append(Paragraph("2. iOS 14 Deployment Constraints", H1))
    s.append(Paragraph("These APIs are NOT available — do not use:", BODY))
    s.append(make_table([
        ['API', 'Min iOS', 'Use Instead'],
        ['.presentationDetents([.medium])', '16+', 'Custom overlay or full-screen sheet'],
        ['.tint(color) on ProgressView', '15+', 'Use color modifier or wrap in a styled view'],
        ['Layout protocol', '16+', 'Use HStack/VStack/GeometryReader'],
        ['Multiple .sheet() at once', 'N/A', 'Use NavigationLink for everything'],
    ]))

    s.append(Paragraph("3. Architecture", H1))
    s.append(code('''┌─ App/                       (entry point)
├─ Core/
│  ├─ Auth/                  AuthManager, EncryptionUtil
│  ├─ Network/               APIClient, BoxScheduleAPI, APIResponse<T>
│  └─ Theme/                 AppColors (light + dark)
├─ Features/
│  ├─ Login/                 LoginView (project + user picker)
│  └─ BoxSchedule/
│     ├─ BoxScheduleView.swift           Root + drawer
│     ├─ BoxScheduleViewModel.swift      @MainActor business logic
│     ├─ Calendar/CalendarView.swift     Month/Week/Day modes
│     ├─ Calendar/DayDetailView.swift    Day detail page
│     ├─ ListView/ScheduleListView.swift By Date / By Schedule
│     ├─ Create/CreateScheduleView.swift All 7 features (see §6)
│     ├─ Create/CreateEventView.swift    mode="event"|"note"
│     ├─ Create/SetDefaultSheet.swift    SetDefaultPopover overlay
│     ├─ History/HistoryView.swift       Activity log + filters
│     ├─ Share/ShareView.swift
│     └─ Types/TypeManagerView.swift     CRUD types
├─ Models/                   Codable models
├─ Resources/                Localizable.strings
└─ Utilities/                DateUtils, Extensions'''))

    s.append(Paragraph("4. Navigation Pattern", H1))
    s.append(Paragraph(
        "<b>BoxScheduleView</b> is the root and contains a <font face=\"Courier\">NavigationView</font> with "
        "<font face=\"Courier\">.navigationBarHidden(true)</font> (custom header). All sub-pages are pushed "
        "via NavigationLink with the <b>hidden link pattern</b>:", BODY))
    s.append(code('''@State private var navToCreateSchedule = false

NavigationLink(
  destination: CreateScheduleView(viewModel: viewModel),
  isActive: $navToCreateSchedule
) { EmptyView() }
.frame(width: 0, height: 0).hidden()

// Trigger from anywhere:
Button("Create Schedule") { navToCreateSchedule = true }'''))

    s.append(Paragraph("Each child page MUST:", BODY))
    s.append(Paragraph(
        "• NOT wrap in its own <font face=\"Courier\">NavigationView</font> (causes nested nav bars)<br/>"
        "• Set <font face=\"Courier\">.navigationBarHidden(false)</font> to override parent<br/>"
        "• Set <font face=\"Courier\">.navigationTitle(...)</font> + <font face=\"Courier\">.navigationBarTitleDisplayMode(.inline)</font><br/>"
        "• NOT add a Cancel/Done/Close button to the toolbar — back arrow handles dismiss",
        BODY))

    s.append(PageBreak())

    s.append(Paragraph("5. APIClient — 409 Conflict Handling", H1))
    s.append(Paragraph(
        "The conflict response body has a <b>different shape</b> from success. HTTP status MUST "
        "be checked BEFORE JSON decoding to avoid the dreaded <i>'data couldn't be read because "
        "it is missing'</i> error.", BODY))
    s.append(code('''// In APIClient.request<T>()
let (data, response) = try await session.data(for: request)

if let httpResponse = response as? HTTPURLResponse {
    if httpResponse.statusCode == 409 {
        throw APIError.conflict
    }
    if httpResponse.statusCode == 401 {
        throw APIError.unauthorized
    }
    if !(200...299).contains(httpResponse.statusCode) {
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let message = json["message"] as? String {
            throw APIError.serverError(httpResponse.statusCode, message)
        }
        throw APIError.serverError(httpResponse.statusCode, "Request failed")
    }
}

return try decoder.decode(APIResponse<T>.self, from: data)

// APIError.conflict.errorDescription returns "409"
// ViewModel checks error.localizedDescription.contains("409")
// to trigger onConflict callback.'''))

    s.append(Paragraph("6. CreateScheduleView — All 7 Features", H1))
    s.append(make_table([
        ['Feature', 'Param / Logic'],
        ['1. Locked start date', 'lockedDate: Int64? — disables Start Date picker, pre-selects in Calendar tab'],
        ['2. Single day edit', 'isSingleDayEdit: Bool, singleDate: Int64?, editingDay: ScheduleDay?'],
        ['3. 409 Conflict', 'showConflict: Bool — overlay popup with Replace/Extend/Overlap'],
        ['4. Calendar tags', 'pickedDatesEpoch: Set<Int64> — horizontal scroll of removable tags'],
        ['5. Past dates disabled', 'minDate = startOfDay(today) — applied to all DatePickers'],
        ['6. Edit auto-fill', '.onAppear populates state from editingDay; gap detection auto-switches tab'],
        ['7. Add New type', 'NavigationLink to TypeManagerView; .onChange(types.count) auto-selects new'],
    ], col_widths=[1.5 * inch, 4.5 * inch]))

    s.append(Paragraph("6.1 Launching from Calendar Cell (Locked Date)", H2))
    s.append(code('''// In DayDetailView "Add Schedule" button
NavigationLink(destination: CreateScheduleView(
  viewModel: vm,
  lockedDate: dayKey  // ← passes the tapped day
)) { ... }'''))

    s.append(Paragraph("6.2 Launching for Single-Day Edit", H2))
    s.append(code('''// In DayDetailView "Edit" button on a schedule
NavigationLink(destination: CreateScheduleView(
  viewModel: vm,
  editingDay: schedule,
  isSingleDayEdit: true,
  singleDate: dayKey
)) { ... }'''))

    s.append(Paragraph("6.3 Conflict Popup (Overlay, Not Page)", H2))
    s.append(code('''.overlay(
  Group {
    if showConflict {
      ZStack {
        Color.black.opacity(0.4).ignoresSafeArea()
          .onTapGesture { showConflict = false }
        VStack(alignment: .leading, spacing: 12) {
          Text("Schedule Conflict").font(...)
          conflictPopupOption(value: "replace", ...)
          conflictPopupOption(value: "extend", ...)
          conflictPopupOption(value: "overlap", ...)
          Button("Back to Edit Dates") { showConflict = false }
        }
        .padding(20).background(Color.surface).cornerRadius(16)
      }
    }
  }
)'''))

    s.append(PageBreak())

    s.append(Paragraph("7. CreateEventView — Separate Pages", H1))
    s.append(Paragraph(
        "Use <b>mode parameter</b> to show only Event or only Note form (no tab switcher):", BODY))
    s.append(code('''// Drawer "Create Event"
NavigationLink(destination: CreateEventView(viewModel: vm, mode: "event")) { ... }

// Drawer "Create Note"
NavigationLink(destination: CreateEventView(viewModel: vm, mode: "note")) { ... }

// Inside CreateEventView
.onAppear {
  if mode == "note" { activeTab = 1 }
  else if mode == "event" { activeTab = 0 }
}

if mode == nil {
  Picker("", selection: $activeTab) { ... }   // tab switcher only if no mode
}'''))

    s.append(Paragraph("8. Set Default Popover", H1))
    s.append(Paragraph(
        "Three Set Default buttons (Calendar/List, Month/Week/Day, By Date/By Schedule). Each "
        "uses <b>SetDefaultPopover</b> rendered at the root ZStack (NOT as button overlay) so it "
        "appears above all content with <font face=\"Courier\">.zIndex(200)</font>:", BODY))
    s.append(code('''@State private var showCalModePopover = false

ZStack {
  // ... main content ...

  if showCalModePopover {
    Color.black.opacity(0.01).ignoresSafeArea()
      .onTapGesture { showCalModePopover = false }
    VStack {
      SetDefaultPopover(
        title: "Choose your default view",
        subtitle: "...",
        options: [
          (value: "month", label: "Month View", desc: "..."),
          (value: "week", label: "Week View", desc: "..."),
          (value: "day", label: "Day View", desc: "..."),
        ],
        currentValue: UserDefaults.standard.string(forKey: key) ?? "month",
        onSelect: { selected in
          UserDefaults.standard.set(selected, forKey: key)
          DispatchQueue.main.async { viewModel.calendarMode = selected }
        },
        onDismiss: { showCalModePopover = false }
      )
      Spacer()
    }
    .padding(.top, 40).padding(.trailing, 12)
    .frame(maxWidth: .infinity, alignment: .trailing)
    .zIndex(200)
  }
}'''))

    s.append(Paragraph("9. Anti-Patterns", H1))
    s.append(note("DO NOT modify @Published ViewModel properties inside view init or directly inside .onAppear — wrap in DispatchQueue.main.async to avoid 'Publishing changes from within view updates' crash."))
    s.append(note("DO NOT use .sheet() for multiple screens — iOS 14 only allows one at a time. Use NavigationLink for everything."))
    s.append(note("DO NOT add the schedule title field on mobile — design decision. Always pass title: \"\"."))
    s.append(note("DO NOT wrap pushed views in NavigationView — causes nested nav bar with extra spacing. Only the root BoxScheduleView wraps."))

    s.append(Paragraph("10. Build & Run", H1))
    s.append(code('''cd /Users/vidyasagar/Downloads/zillit_lcw/ios

xcodebuild -project ZillitLCW.xcodeproj \\
  -scheme ZillitLCW \\
  -destination 'platform=iOS Simulator,name=iPhone 15,OS=17.5' \\
  build

# Or open in Xcode:
open ZillitLCW.xcodeproj'''))

    doc.build(s)
    print("✅ Generated Box_Schedule_iOS.pdf")


# ═══════════════════════════════════════════════════════════════════════
#  WEB PDF
# ═══════════════════════════════════════════════════════════════════════
def build_web():
    doc = SimpleDocTemplate("Box_Schedule_Web.pdf", pagesize=letter,
                            leftMargin=0.6 * inch, rightMargin=0.6 * inch,
                            topMargin=0.6 * inch, bottomMargin=0.6 * inch)
    s = []
    s.append(Paragraph("Box Schedule — Web Developer Guide", TITLE))
    s.append(Paragraph("React 18 · Ant Design 5 · Vite · Theme Context", SUBTITLE))

    s.append(Paragraph("1. Project Setup", H1))
    s.append(Paragraph("Path: <font face=\"Courier\">/Users/vidyasagar/Downloads/zillit_lcw/frontend/</font>", BODY))
    s.append(code('''cd frontend
npm install
npm run dev    # http://localhost:3000
npm run build  # production'''))

    s.append(Paragraph("2. Component Structure", H1))
    s.append(code('''src/components/box-schedule/
├─ BoxSchedulePage.jsx          Main host page
├─ CalendarView.jsx              Month/Week/Day calendar
├─ ScheduleTable.jsx             List view (By Date + By Schedule)
├─ ScheduleDayDetail.jsx         Day detail drawer
├─ CreateScheduleModal.jsx       Drawer with all 7 features
├─ CreateEventModal.jsx          Tabs: Event + Note
├─ ConflictDialog.jsx            409 resolution popup
├─ HistoryDrawer.jsx             Activity log
├─ ShareModal.jsx
└─ TypeManagerModal.jsx

src/services/
└─ boxScheduleService.js         Axios API wrapper

src/hooks/
└─ useBoxSchedule.js             Custom hook with all state'''))

    s.append(Paragraph("3. CreateScheduleModal — All 7 Features", H1))
    s.append(Paragraph("Located: <font face=\"Courier\">src/components/box-schedule/CreateScheduleModal.jsx</font>", BODY))

    s.append(Paragraph("3.1 Editing Day Props", H2))
    s.append(code('''<CreateScheduleModal
  open={showCreate}
  onClose={() => setShowCreate(false)}
  onSubmit={createDay}
  scheduleTypes={types}
  editingDay={editingDay}    // ← null for new, object for edit
  onEdit={updateDay}
/>

// editingDay can include special flags:
{
  ...scheduleDay,
  _singleDayEdit: true,       // shows Replace/Extend/Overlap
  _lockedStartDate: true,     // disables start date picker
  singleDate: 1776348933836,
  typeName: "Prep"            // for conflict messages
}'''))

    s.append(Paragraph("3.2 Date Mode Detection (Auto-Tab on Edit)", H2))
    s.append(code('''const getInitialDateTab = () => {
  if (editingDay?.dateRangeType === 'by_dates') return 'calendar';

  // If editing a block with non-consecutive dates, use Calendar tab
  if (editingDay?._id && editCalendarDays.length > 1) {
    const sorted = [...editCalendarDays].map(Number).sort((a, b) => a - b);
    const oneDay = 24 * 60 * 60 * 1000;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] > oneDay + 3600000) {  // +1hr DST
        return 'calendar';
      }
    }
  }
  return 'date_range';
};'''))

    s.append(Paragraph("3.3 Single Day Edit — executeSingleDayEdit()", H2))
    s.append(Paragraph("When user changes the type for a single day, three actions are available:", BODY))
    s.append(make_table([
        ['Action', 'API Calls'],
        ['replace', '1) removeDates from old block, 2) createDay with overlap'],
        ['extend', '1) removeDates, 2) updateDay with extended end, 3) createDay'],
        ['overlap', '1) createDay with conflictAction: "overlap"'],
    ]))

    s.append(PageBreak())

    s.append(Paragraph("4. ConflictDialog — 409 Handler", H1))
    s.append(Paragraph(
        "Triggered automatically by useBoxSchedule when API returns 409. Shows three options "
        "and re-submits the original request with the chosen conflictAction.", BODY))
    s.append(code('''// In useBoxSchedule.js
try {
  await boxScheduleService.createDay(data);
} catch (err) {
  if (err.response?.status === 409) {
    setConflictData({
      pendingData: data,
      conflicts: err.response.data.data.conflicts
    });
    setShowConflict(true);
    return;
  }
  toast.error(err.response?.data?.message || 'Failed to create');
}

// In ConflictDialog onResolve:
const retryWithAction = async (action) => {
  await boxScheduleService.createDay({
    ...conflictData.pendingData,
    conflictAction: action
  });
  setShowConflict(false);
};'''))

    s.append(Paragraph("5. boxScheduleService.js", H1))
    s.append(code('''import axios from 'axios';
import { getModuleDataHeader } from '../utils/auth';

const API_BASE = `${import.meta.env.VITE_API_URL}/api/v2/box-schedule`;

const client = axios.create({ baseURL: API_BASE });

client.interceptors.request.use((config) => {
  config.headers['moduledata'] = getModuleDataHeader();
  return config;
});

export default {
  getTypes:    () => client.get('/types'),
  createType:  (d) => client.post('/types', d),
  updateType:  (id, d) => client.put(`/types/${id}`, d),
  deleteType:  (id) => client.delete(`/types/${id}`),

  getDays:     (params) => client.get('/days', { params }),
  createDay:   (d) => client.post('/days', d),
  updateDay:   (id, d) => client.put(`/days/${id}`, d),
  deleteDay:   (id) => client.delete(`/days/${id}`),
  removeDates: (data) => client.post('/days/remove-dates', { items: data }),

  getCalendar: () => client.get('/calendar'),
  getEvents:   (dayId) => client.get('/events', { params: { dayId } }),
  createEvent: (d) => client.post('/events', d),
  updateEvent: (id, d) => client.put(`/events/${id}`, d),
  deleteEvent: (id) => client.delete(`/events/${id}`),

  getActivityLog: (params) => client.get('/activity-log', { params }),
  share:          (d) => client.post('/share', d),
};'''))

    s.append(Paragraph("6. Set Default Popovers (Per View)", H1))
    s.append(Paragraph(
        "Each section (Calendar/List, Month/Week/Day, By Date/Schedule) has its own Set Default "
        "popover using Ant Design <font face=\"Courier\">Popover</font> with custom content:", BODY))
    s.append(code('''<Popover
  trigger="click"
  placement="bottomLeft"
  open={showDefaultPopover}
  onOpenChange={setShowDefaultPopover}
  content={
    <div style={{ width: 240 }}>
      <div className="title">Choose your default view</div>
      <div className="subtitle">This view will load first ...</div>
      {options.map(opt => (
        <button onClick={() => {
          localStorage.setItem(KEY, opt.value);
          setSavedMode(opt.value);
          setActiveMode(opt.value);
          setShowDefaultPopover(false);
          toast.success(`${opt.label} is now your default.`);
        }}>
          {opt.label}
        </button>
      ))}
    </div>
  }
>
  <Button>Set as Default</Button>
</Popover>'''))

    s.append(Paragraph("7. Theme System", H1))
    s.append(Paragraph(
        "Uses <font face=\"Courier\">ThemeContext</font> with <font face=\"Courier\">useTheme()</font> "
        "hook. All colors come from <font face=\"Courier\">colors</font> object — never hard-code hex values.", BODY))
    s.append(code('''import { useTheme } from '../../context/ThemeContext';

const MyComponent = () => {
  const { colors, isDark, toggleTheme } = useTheme();

  return (
    <div style={{
      background: colors.surface,
      color: colors.textPrimary,
      border: `1px solid ${colors.border}`
    }}>
      ...
    </div>
  );
};'''))

    s.append(Paragraph("8. Mobile-Web Differences", H1))
    s.append(Paragraph("If you maintain web only, be aware of these mobile decisions that may diverge:", BODY))
    s.append(make_table([
        ['Aspect', 'Web', 'Mobile'],
        ['Schedule title', 'Optional input', 'Removed (always "")'],
        ['Add new type', 'Inline form', 'Navigate to TypeManager'],
        ['Day Detail', 'Drawer (right slide)', 'Full page push'],
        ['Set Default', 'Ant Popover', 'Custom overlay'],
        ['Conflict UI', 'Modal Dialog', 'Centered overlay popup'],
    ], col_widths=[1.5 * inch, 2.25 * inch, 2.25 * inch]))

    doc.build(s)
    print("✅ Generated Box_Schedule_Web.pdf")


# ═══════════════════════════════════════════════════════════════════════
#  ANDROID PDF
# ═══════════════════════════════════════════════════════════════════════
def build_android():
    doc = SimpleDocTemplate("Box_Schedule_Android.pdf", pagesize=letter,
                            leftMargin=0.6 * inch, rightMargin=0.6 * inch,
                            topMargin=0.6 * inch, bottomMargin=0.6 * inch)
    s = []
    s.append(Paragraph("Box Schedule — Android Developer Guide", TITLE))
    s.append(Paragraph("Kotlin · View Binding · Material 3 · Min SDK 24", SUBTITLE))

    s.append(Paragraph("1. Project Setup", H1))
    s.append(Paragraph("Path: <font face=\"Courier\">/Users/vidyasagar/Downloads/zillit_lcw/android/</font>", BODY))
    s.append(code('''cd android
./gradlew assembleDebug
./gradlew installDebug

# Or open in Android Studio Hedgehog+'''))

    s.append(Paragraph("2. Architecture", H1))
    s.append(code('''app/src/main/
├─ AndroidManifest.xml          (must register all activities)
├─ java/com/zillit/lcw/
│  ├─ data/
│  │  ├─ api/                   Ktor client + interceptor
│  │  ├─ model/                 ScheduleDay, ScheduleEvent, ScheduleType, etc.
│  │  └─ repository/            Repository pattern
│  ├─ ui/
│  │  ├─ login/LoginActivity.kt
│  │  ├─ boxschedule/
│  │  │  ├─ BoxScheduleActivity.kt        Root with DrawerLayout (right)
│  │  │  ├─ BoxScheduleViewModel.kt       LiveData ViewModel
│  │  │  ├─ calendar/CalendarFragment.kt
│  │  │  ├─ list/ListFragment.kt + ScheduleAdapter.kt
│  │  │  ├─ create/
│  │  │  │  ├─ CreateScheduleActivity.kt  All 7 features (see §4)
│  │  │  │  ├─ CreateEventActivity.kt
│  │  │  │  └─ ConflictDialog.kt          DialogFragment
│  │  │  ├─ detail/DayDetailActivity.kt   Full Activity (NOT BottomSheet)
│  │  │  ├─ history/HistoryBottomSheet.kt
│  │  │  ├─ share/ShareDialog.kt
│  │  │  └─ types/TypeManagerDialog.kt
│  │  └─ common/ThemeManager.kt
│  └─ util/                     DateUtils, extensions
└─ res/
   ├─ layout/                   XML layouts
   ├─ values/                   colors, dimens, strings
   └─ values-night/             dark theme overrides'''))

    s.append(Paragraph("3. Navigation Pattern", H1))
    s.append(Paragraph(
        "Each major screen is its own <b>Activity</b> launched via <font face=\"Courier\">startActivity(Intent)</font>. "
        "The drawer in BoxScheduleActivity launches CreateScheduleActivity, CreateEventActivity, etc. "
        "Day Detail is a full Activity (not BottomSheet) for consistency with iOS.", BODY))
    s.append(code('''// In CalendarFragment when cell tapped:
DayDetailActivity.launch(requireContext(), dayMs)

// In DayDetailActivity "Add Schedule" button:
CreateScheduleActivity.launchForDate(this, dayMs)   // ← passes locked date

// In DayDetailActivity "Edit" on schedule:
CreateScheduleActivity.launchForSingleDayEdit(
  this, schedule.id, schedule.typeId, schedule.typeName,
  dayMs, schedule.numberOfDays, schedule.startDate, schedule.endDate
)'''))

    s.append(PageBreak())

    s.append(Paragraph("4. CreateScheduleActivity — All 7 Features", H1))

    s.append(Paragraph("4.1 Intent Extras", H2))
    s.append(code('''companion object {
  const val EXTRA_LOCKED_DATE = "locked_date"
  const val EXTRA_SINGLE_DAY_EDIT = "single_day_edit"
  const val EXTRA_SINGLE_DATE = "single_date"
  const val EXTRA_EDITING_DAY_ID = "editing_day_id"
  const val EXTRA_EDITING_TYPE_ID = "editing_type_id"
  const val EXTRA_EDITING_TYPE_NAME = "editing_type_name"
  const val EXTRA_EDITING_NUM_DAYS = "editing_num_days"
  const val EXTRA_EDITING_START_DATE = "editing_start_date"
  const val EXTRA_EDITING_END_DATE = "editing_end_date"

  fun launchForDate(context: Context, lockedDateMs: Long) {
    context.startActivity(Intent(context, CreateScheduleActivity::class.java).apply {
      putExtra(EXTRA_LOCKED_DATE, lockedDateMs)
    })
  }

  fun launchForSingleDayEdit(
    context: Context, dayId: String, typeId: String, typeName: String,
    singleDateMs: Long, numDays: Int, startDate: Long, endDate: Long
  ) {
    context.startActivity(Intent(context, CreateScheduleActivity::class.java).apply {
      putExtra(EXTRA_SINGLE_DAY_EDIT, true)
      putExtra(EXTRA_SINGLE_DATE, singleDateMs)
      putExtra(EXTRA_EDITING_DAY_ID, dayId)
      putExtra(EXTRA_EDITING_TYPE_ID, typeId)
      putExtra(EXTRA_EDITING_TYPE_NAME, typeName)
      putExtra(EXTRA_EDITING_NUM_DAYS, numDays)
      putExtra(EXTRA_EDITING_START_DATE, startDate)
      putExtra(EXTRA_EDITING_END_DATE, endDate)
    })
  }
}'''))

    s.append(Paragraph("4.2 readIntentExtras() Pattern", H2))
    s.append(code('''private fun readIntentExtras() {
  // Feature 1: Locked date
  lockedDate = intent.getLongExtra(EXTRA_LOCKED_DATE, 0L)
  if (lockedDate > 0) {
    isStartDateLocked = true
    startDateMs = DateUtils.startOfDayMs(lockedDate)
    numberOfDays = 1
    pickedDates.add(startDateMs)
  }

  // Feature 2: Single day edit
  isSingleDayEdit = intent.getBooleanExtra(EXTRA_SINGLE_DAY_EDIT, false)
  singleDate = intent.getLongExtra(EXTRA_SINGLE_DATE, 0L)
  editingDayId = intent.getStringExtra(EXTRA_EDITING_DAY_ID) ?: ""
  editingTypeId = intent.getStringExtra(EXTRA_EDITING_TYPE_ID) ?: ""
  editingTypeName = intent.getStringExtra(EXTRA_EDITING_TYPE_NAME) ?: ""

  // Feature 6: Edit mode
  isEditing = editingDayId.isNotEmpty()
  if (isEditing) {
    selectedTypeId = editingTypeId
    numberOfDays = intent.getIntExtra(EXTRA_EDITING_NUM_DAYS, 5)
    startDateMs = DateUtils.startOfDayMs(intent.getLongExtra(EXTRA_EDITING_START_DATE, startDateMs))
    endDateMs = DateUtils.startOfDayMs(intent.getLongExtra(EXTRA_EDITING_END_DATE, 0L))
  }
}'''))

    s.append(Paragraph("4.3 409 Conflict Handling", H2))
    s.append(code('''// Observe error message in observeViewModel():
viewModel.errorMessage.observe(this) { message ->
  if (!message.isNullOrEmpty()) {
    if (message.contains("409") || message.contains("conflict", ignoreCase = true)) {
      showConflictDialog()
    } else {
      Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }
  }
}

private fun showConflictDialog() {
  ConflictDialog.newInstance(1) { resolution ->
    saveSchedule(resolution)  // retry with action
  }.show(supportFragmentManager, "conflict")
}'''))

    s.append(Paragraph("4.4 Past Date Disabling", H2))
    s.append(code('''private fun showDatePicker(minDateMs: Long = 0L, onPick: (Long) -> Unit) {
  val cal = Calendar.getInstance()
  val dialog = DatePickerDialog(this, { _, year, month, day ->
    val picked = Calendar.getInstance().apply {
      set(year, month, day, 0, 0, 0)
      set(Calendar.MILLISECOND, 0)
    }
    onPick(picked.timeInMillis)
  }, cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH))

  if (minDateMs > 0) dialog.datePicker.minDate = minDateMs
  dialog.show()
}

// Usage:
val today = DateUtils.startOfDayMs(System.currentTimeMillis())
binding.tvStartDate.setOnClickListener {
  showDatePicker(today) { ms ->
    startDateMs = ms
    binding.tvStartDate.text = DateUtils.formatDate(ms)
    updateSummary()
  }
}'''))

    s.append(PageBreak())

    s.append(Paragraph("5. DayDetailActivity (Not BottomSheet)", H1))
    s.append(Paragraph(
        "DayDetailBottomSheet is DEPRECATED. Use full Activity for consistency with iOS:", BODY))
    s.append(code('''class DayDetailActivity : AppCompatActivity() {
  companion object {
    private const val EXTRA_DAY_MS = "day_ms"
    fun launch(context: Context, dayMs: Long) {
      context.startActivity(Intent(context, DayDetailActivity::class.java).apply {
        putExtra(EXTRA_DAY_MS, dayMs)
      })
    }
  }

  // Toolbar with back arrow
  setSupportActionBar(binding.toolbar)
  supportActionBar?.setDisplayHomeAsUpEnabled(true)
  supportActionBar?.title = DateUtils.formatFullDay(dayMs)
  binding.toolbar.setNavigationOnClickListener { finish() }

  // Schedule cards programmatically generated with Edit + Delete buttons
  // Event cards with Edit + Remove buttons
  // Note cards with Delete button
}'''))

    s.append(Paragraph("6. Manifest Registration", H1))
    s.append(code('''<!-- AndroidManifest.xml -->
<application ...>
  <activity android:name=".ui.login.LoginActivity"
            android:exported="true">
    <intent-filter>
      <action android:name="android.intent.action.MAIN" />
      <category android:name="android.intent.category.LAUNCHER" />
    </intent-filter>
  </activity>

  <activity android:name=".ui.boxschedule.BoxScheduleActivity" />
  <activity android:name=".ui.boxschedule.create.CreateScheduleActivity" />
  <activity android:name=".ui.boxschedule.create.CreateEventActivity" />
  <activity android:name=".ui.boxschedule.detail.DayDetailActivity" />
</application>'''))

    s.append(Paragraph("7. SharedPreferences for Set Default", H1))
    s.append(code('''val prefs = getSharedPreferences("zillit_prefs", MODE_PRIVATE)

// Save default
prefs.edit().putString("box-schedule-default-view", "calendar").apply()
prefs.edit().putString("box-schedule-calendar-mode", "month").apply()
prefs.edit().putString("box-schedule-list-mode", "by_date").apply()

// Restore on activity start
val saved = prefs.getString("box-schedule-default-view", "calendar") ?: "calendar"'''))

    s.append(Paragraph("8. Theme Management", H1))
    s.append(code('''// ThemeManager.kt
object ThemeManager {
  fun isDark(context: Context): Boolean {
    val prefs = context.getSharedPreferences("zillit_prefs", MODE_PRIVATE)
    return prefs.getBoolean("dark_mode", false)
  }

  fun toggleTheme(context: Context) {
    val isDark = !isDark(context)
    context.getSharedPreferences("zillit_prefs", MODE_PRIVATE)
      .edit().putBoolean("dark_mode", isDark).apply()
    AppCompatDelegate.setDefaultNightMode(
      if (isDark) AppCompatDelegate.MODE_NIGHT_YES
      else AppCompatDelegate.MODE_NIGHT_NO
    )
  }
}'''))

    s.append(Paragraph("9. Build & Run", H1))
    s.append(code('''cd /Users/vidyasagar/Downloads/zillit_lcw/android

# Build
./gradlew assembleDebug

# Install on connected device/emulator
./gradlew installDebug

# Or with Gradle wrapper:
./gradlew app:assembleDebug -PminSdk=24'''))

    s.append(Paragraph("10. Anti-Patterns", H1))
    s.append(note("DO NOT add the schedule title field on mobile — design decision. Always pass empty title."))
    s.append(note("DO NOT use BottomSheetDialogFragment for Day Detail anymore — use DayDetailActivity for consistency with iOS."))
    s.append(note("DO NOT forget to add new Activities to AndroidManifest.xml — they will crash with ActivityNotFoundException."))
    s.append(note("DO NOT block the main thread with synchronous API calls — use viewModelScope.launch and observe LiveData."))

    doc.build(s)
    print("✅ Generated Box_Schedule_Android.pdf")


# ═══════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    import os
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    build_backend()
    build_ios()
    build_web()
    build_android()
    print("\n✨ All 4 PDFs generated successfully!")
