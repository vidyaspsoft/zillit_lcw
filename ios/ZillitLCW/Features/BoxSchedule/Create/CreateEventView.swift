import SwiftUI

/// CreateEventView — separate page for Event or Note.
/// Pass `mode: "event"` or `mode: "note"` to show only that form.
/// If mode is nil, shows tab switcher (backward compat).
struct CreateEventView: View {
    @Environment(\.presentationMode) var presentationMode
    @ObservedObject var viewModel: BoxScheduleViewModel
    var mode: String? = nil  // "event" or "note" — hides tab switcher
    var editingEvent: ScheduleEvent? = nil  // non-nil → edit mode (PUT /events/:id)

    private var isEditingEvent: Bool { editingEvent != nil }

    @State private var validationError: String?
    @State private var activeTab = 0
    @State private var title = ""
    @State private var description = ""
    @State private var linkedScheduleDayId: String? = nil
    @State private var linkedDate: Int64? = nil
    @State private var startDate = Date()
    @State private var endDate = Date()
    @State private var startTime = Date()
    @State private var endTime = Date()
    @State private var isFullDay = false
    @State private var repeatMode = "none"
    @State private var reminder = "none"
    @State private var timezone = TimeZone.current.identifier
    @State private var callType = ""
    @State private var location = ""
    @State private var locationLat: Double? = nil
    @State private var locationLng: Double? = nil
    @State private var textColor: String = ""
    @State private var noteTitle = ""
    @State private var noteText = ""
    @State private var selectedColor = "#3498DB"
    @State private var noteColor = "#3498DB"
    @State private var eventColor = "#3498DB"
    @State private var repeatEndDate: Date? = nil
    @State private var organizerExcluded = false

    // Distribute-To state (single-mode at a time per spec § 3.3)
    @State private var distributeSelection: DistributeSelection = .empty

    // Picker presentation
    @State private var showMapPicker = false
    @State private var showInviteesPicker = false

    // Web-parity color presets (CreateEventModal.jsx COLOR_PRESETS)
    private let noteColorPresets: [(hex: String, label: String)] = [
        ("#3498DB", "Blue"),
        ("#E74C3C", "Red"),
        ("#27AE60", "Green"),
        ("#F39C12", "Orange"),
        ("#8E44AD", "Purple"),
        ("#95A5A6", "Gray")
    ]

    let repeatOptions = [
        ("none", "ce_no_repeat"), ("daily", "ce_daily"),
        ("weekly", "ce_weekly"), ("monthly", "ce_monthly")
    ]

    let reminderOptions = [
        ("none", "ce_no_reminder"), ("at_time", "ce_at_time"),
        ("5min", "ce_5min"), ("15min", "ce_15min"),
        ("30min", "ce_30min"), ("1hr", "ce_1hr"), ("1day", "ce_1day")
    ]

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Tab picker — hidden when mode is set OR when we're editing an existing
                    // item (the event-vs-note kind is already decided and can't be toggled).
                    if mode == nil && editingEvent == nil {
                        Picker("", selection: $activeTab) {
                            Text("ce_event_tab".localized).tag(0)
                            Text("ce_note_tab".localized).tag(1)
                        }
                        .pickerStyle(SegmentedPickerStyle())
                    }

                    // LINK TO A SCHEDULE DAY (OPTIONAL) — web parity, shown on both tabs
                    linkScheduleDayCard

                    if activeTab == 0 {
                        eventForm
                    } else {
                        noteForm
                    }
                }
                .padding(20)
            }

            // Save button pinned at bottom — label flips to "Update" in edit mode.
            Button(action: { if activeTab == 0 { saveEvent() } else { saveNote() } }) {
                Text(saveButtonLabel)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(.solidDarkText)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color.solidDark)
                    .cornerRadius(10)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(Color.surface)
            .overlay(Rectangle().frame(height: 1).foregroundColor(.appBorder), alignment: .top)
        }
        .background(Color.pageBg.ignoresSafeArea())
        .navigationTitle(screenTitle)
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarHidden(false)
        .onAppear {
            // Set initial tab based on editingEvent OR mode
            if let e = editingEvent {
                activeTab = (e.eventType == "note") ? 1 : 0
                prefillFromEditingEvent(e)
            } else if mode == "note" {
                activeTab = 1
            } else if mode == "event" {
                activeTab = 0
            }
        }
            .alert(isPresented: Binding<Bool>(
                get: { validationError != nil },
                set: { if !$0 { validationError = nil } }
            )) {
                Alert(
                    title: Text("bs_error_title".localized),
                    message: Text(validationError ?? ""),
                    dismissButton: .default(Text("bs_ok".localized))
                )
            }
            .fullScreenCover(isPresented: $showMapPicker) {
                MapPickerView(
                    initial: locationLat.flatMap { lat in
                        locationLng.map { lng in PickedLocation(address: location, lat: lat, lng: lng) }
                    },
                    onConfirm: { picked in
                        location = picked.address
                        locationLat = picked.lat
                        locationLng = picked.lng
                        showMapPicker = false
                    },
                    onCancel: { showMapPicker = false }
                )
            }
            .fullScreenCover(isPresented: $showInviteesPicker) {
                SelectInviteesView(
                    initial: distributeSelection,
                    onConfirm: { sel in
                        distributeSelection = sel
                        showInviteesPicker = false
                    },
                    onCancel: { showInviteesPicker = false }
                )
            }
    }

    // MARK: - Edit mode helpers

    private var saveButtonLabel: String {
        if isEditingEvent {
            return activeTab == 0 ? "Update Event" : "Update Note"
        }
        return activeTab == 0 ? "ce_save_event".localized : "ce_save_note".localized
    }

    private var screenTitle: String {
        if isEditingEvent {
            return activeTab == 0 ? "Edit Event" : "Edit Note"
        }
        return activeTab == 0 ? "ce_add_event".localized : "ce_add_note".localized
    }

    /// Copy every field from an existing event into the form state.
    private func prefillFromEditingEvent(_ e: ScheduleEvent) {
        title = e.title
        description = e.description ?? ""

        if let s = e.startDateTime, s > 0 {
            let d = DateUtils.fromEpoch(s)
            startDate = d
            if !e.fullDay { startTime = d }
        }
        if let en = e.endDateTime, en > 0 {
            let d = DateUtils.fromEpoch(en)
            endDate = d
            if !e.fullDay { endTime = d }
        }
        isFullDay = e.fullDay
        location = e.location ?? ""
        locationLat = e.locationLat
        locationLng = e.locationLng
        textColor = e.textColor ?? ""
        distributeSelection = DistributeSelection(
            distributeTo: e.distributeTo ?? "",
            userIds: e.distributeUserIds ?? [],
            departmentIds: e.distributeDepartmentIds ?? [],
            presetId: e.userPresetId
        )
        organizerExcluded = e.organizerExcluded ?? false
        reminder = e.reminder.isEmpty ? "none" : e.reminder
        repeatMode = e.repeatStatus.isEmpty ? "none" : e.repeatStatus
        if let r = e.repeatEndDate, r > 0 { repeatEndDate = DateUtils.fromEpoch(r) }
        timezone = (e.timezone?.isEmpty == false) ? e.timezone! : TimeZone.current.identifier
        callType = e.callType ?? ""
        eventColor = e.color.isEmpty ? "#3498DB" : e.color
        noteColor = e.color.isEmpty ? "#3498DB" : e.color

        // Link to schedule day pre-select
        if let sdId = e.scheduleDayId, !sdId.isEmpty {
            linkedScheduleDayId = sdId
            linkedDate = e.date
        }

        // Note-specific fields
        noteTitle = e.title
        noteText = e.notes ?? ""
    }

    // MARK: - Save Event
    private func saveEvent() {
        guard !title.trimmingCharacters(in: .whitespaces).isEmpty else {
            validationError = "ce_error_title_required".localized
            return
        }
        if !isFullDay && endTime < startTime {
            validationError = "ce_error_end_before_start".localized
            return
        }

        // Spec § 4 — always include every key with explicit empty/null/zero values
        // so the server doesn't need to special-case missing keys.
        let startMs: Int64 = isFullDay
            ? DateUtils.toEpoch(startDate)
            : combinedEpoch(date: startDate, time: startTime)
        let endMs: Int64 = isFullDay
            ? DateUtils.toEpoch(endDate)
            : combinedEpoch(date: endDate, time: endTime)

        var data: [String: Any] = [
            "scheduleDayId": linkedScheduleDayId as Any? ?? NSNull(),
            "date": linkedDate ?? DateUtils.toEpoch(startDate),
            "eventType": "event",
            "title": title,
            "color": eventColor,
            "description": description,
            "startDateTime": startMs,
            "endDateTime": endMs,
            "fullDay": isFullDay,
            "location": location,
            "locationLat": locationLat as Any? ?? NSNull(),
            "locationLng": locationLng as Any? ?? NSNull(),
            "reminder": reminder,
            "repeatStatus": repeatMode,
            "repeatEndDate": repeatEndDate.map { DateUtils.toEpoch($0) } ?? 0,
            "timezone": timezone,
            "callType": callType,
            "textColor": textColor,
            "distributeTo": distributeSelection.distributeTo,
            "distributeUserIds": distributeSelection.distributeTo == "users" ? distributeSelection.userIds : [],
            "distributeDepartmentIds": distributeSelection.distributeTo == "departments" ? distributeSelection.departmentIds : [],
            "userPresetId": (distributeSelection.distributeTo == "presets" ? distributeSelection.presetId : nil) as Any? ?? NSNull(),
            "organizerExcluded": organizerExcluded,
            "advancedEnabled": true
        ]

        if let existing = editingEvent {
            viewModel.updateEvent(id: existing.id, data: data)
        } else {
            viewModel.createEvent(data: data)
        }
        presentationMode.wrappedValue.dismiss()
    }

    /// Merge a date (Y-M-D) with a time (h:m) into a single epoch ms value.
    private func combinedEpoch(date: Date, time: Date) -> Int64 {
        let cal = Calendar.current
        var dc = cal.dateComponents([.year, .month, .day], from: date)
        let tc = cal.dateComponents([.hour, .minute], from: time)
        dc.hour = tc.hour
        dc.minute = tc.minute
        let merged = cal.date(from: dc) ?? date
        return DateUtils.toEpoch(merged)
    }

    // MARK: - Save Note
    private func saveNote() {
        guard !noteTitle.trimmingCharacters(in: .whitespaces).isEmpty else {
            validationError = "ce_error_note_title_required".localized
            return
        }

        var data: [String: Any] = [
            "eventType": "note",
            "title": noteTitle,
            "notes": noteText,
            "color": noteColor,
            "startDate": DateUtils.toEpoch(Date()),
            "endDate": DateUtils.toEpoch(Date()),
            "fullDay": true,
            "date": linkedDate ?? DateUtils.toEpoch(Date())
        ]
        if let id = linkedScheduleDayId { data["scheduleDayId"] = id }

        if let existing = editingEvent {
            viewModel.updateEvent(id: existing.id, data: data)
        } else {
            viewModel.createEvent(data: data)
        }
        presentationMode.wrappedValue.dismiss()
    }

    // MARK: - Link to Schedule Day (web parity)
    private struct LinkDayOption: Identifiable, Hashable {
        let scheduleDayId: String
        let dayMs: Int64
        let label: String
        var id: String { "\(scheduleDayId)|\(dayMs)" }
    }

    private var linkDayOptions: [LinkDayOption] {
        var opts: [LinkDayOption] = []
        for sd in viewModel.scheduleDays {
            for cd in (sd.calendarDays ?? []).sorted() {
                let titleSuffix = sd.title.isEmpty ? "" : " (\(sd.title))"
                opts.append(LinkDayOption(
                    scheduleDayId: sd.id,
                    dayMs: cd,
                    label: "\(DateUtils.formatShortDate(cd)) — \(sd.typeName)\(titleSuffix)"
                ))
            }
        }
        return opts.sorted { $0.dayMs < $1.dayMs }
    }

    private var linkScheduleDayCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Link to a Schedule Day (optional)").sectionLabel()
            Menu {
                Button("Select a schedule day…") {
                    linkedScheduleDayId = nil
                    linkedDate = nil
                }
                ForEach(linkDayOptions) { opt in
                    Button(opt.label) {
                        linkedScheduleDayId = opt.scheduleDayId
                        linkedDate = opt.dayMs
                        let d = DateUtils.fromEpoch(opt.dayMs)
                        startDate = d
                        endDate = d
                    }
                }
            } label: {
                HStack {
                    Text(selectedLinkLabel())
                        .font(.system(size: 14))
                        .foregroundColor(linkedScheduleDayId == nil ? .textPlaceholder : .textBody)
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.system(size: 12))
                        .foregroundColor(.textSubtle)
                }
                .inputStyle()
            }
        }
        .padding(12)
        .background(Color.surfaceAlt)
        .cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.appBorder, lineWidth: 1))
    }

    private func selectedLinkLabel() -> String {
        if let id = linkedScheduleDayId, let date = linkedDate,
           let opt = linkDayOptions.first(where: { $0.scheduleDayId == id && $0.dayMs == date }) {
            return opt.label
        }
        return "Select a schedule day…"
    }

    // MARK: - Event Form
    private var eventForm: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Title
            formField(label: "ce_title_hint".localized) {
                TextField("ce_title_hint".localized, text: $title).inputStyle()
            }

            // Description
            formField(label: "ce_description_hint".localized) {
                TextEditor(text: $description)
                    .frame(minHeight: 80)
                    .padding(8)
                    .background(Color.surface)
                    .cornerRadius(10)
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.borderInput, lineWidth: 1))
            }

            // Full Day toggle
            Toggle("ce_full_day".localized, isOn: $isFullDay)
                .foregroundColor(.textSecondary)

            // Date/Time (stacked for mobile)
            VStack(spacing: 12) {
                HStack(spacing: 12) {
                    formField(label: "cs_start_date".localized) {
                        DatePicker("", selection: $startDate, displayedComponents: .date)
                            .labelsHidden()
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    formField(label: "cs_end_date".localized) {
                        DatePicker("", selection: $endDate, displayedComponents: .date)
                            .labelsHidden()
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }

                if !isFullDay {
                    HStack(spacing: 12) {
                        formField(label: "ce_start_time".localized) {
                            DatePicker("", selection: $startTime, displayedComponents: .hourAndMinute)
                                .labelsHidden()
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        formField(label: "ce_end_time".localized) {
                            DatePicker("", selection: $endTime, displayedComponents: .hourAndMinute)
                                .labelsHidden()
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
            }

            // Repeat + Repeat End Date (web parity: shown when not "none")
            HStack(spacing: 12) {
                formField(label: "ce_repeat".localized) {
                    Picker("", selection: $repeatMode) {
                        ForEach(repeatOptions, id: \.0) { option in
                            Text(option.1.localized).tag(option.0)
                        }
                    }
                    .pickerStyle(MenuPickerStyle())
                    .inputStyle()
                }
                if repeatMode != "none" {
                    formField(label: "Repeat End Date") {
                        DatePicker("", selection: Binding(
                            get: { repeatEndDate ?? Date() },
                            set: { repeatEndDate = $0 }
                        ), displayedComponents: .date)
                            .labelsHidden()
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }

            // Timezone
            formField(label: "ce_timezone".localized) {
                Text(timezone)
                    .font(.system(size: 14))
                    .foregroundColor(.textBody)
                    .inputStyle()
            }

            // Reminder
            formField(label: "ce_reminder".localized) {
                Picker("", selection: $reminder) {
                    ForEach(reminderOptions, id: \.0) { option in
                        Text(option.1.localized).tag(option.0)
                    }
                }
                .pickerStyle(MenuPickerStyle())
                .inputStyle()
            }

            // Call Type
            formField(label: "ce_call_type".localized) {
                Picker("", selection: $callType) {
                    Text("ce_select_call_type".localized).tag("")
                    Text("ce_meet_in_person".localized).tag("meet_in_person")
                    Text("ce_audio".localized).tag("audio")
                    Text("ce_video".localized).tag("video")
                }
                .pickerStyle(MenuPickerStyle())
                .inputStyle()
            }

            // Location — non-editable row, tap opens MapPickerView (spec § 2)
            formField(label: "ce_location".localized) {
                Button { showMapPicker = true } label: {
                    HStack {
                        Text(location.isEmpty ? "Search location on Google Maps…" : location)
                            .font(.system(size: 14))
                            .foregroundColor(location.isEmpty ? .textPlaceholder : .textBody)
                            .lineLimit(2)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Image(systemName: "chevron.right")
                            .font(.system(size: 12)).foregroundColor(.textSubtle)
                    }
                    .inputStyle()
                }
                .buttonStyle(.plain)
                if !location.isEmpty || locationLat != nil {
                    HStack(spacing: 8) {
                        Button("Change") { showMapPicker = true }
                            .font(.system(size: 12, weight: .semibold))
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(Color.primaryAccent.opacity(0.15))
                            .foregroundColor(Color.primaryAccent)
                            .clipShape(Capsule())
                        Button("Remove") {
                            location = ""; locationLat = nil; locationLng = nil
                        }
                        .font(.system(size: 12, weight: .semibold))
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .background(Color.surfaceAlt)
                        .foregroundColor(Color.textBody)
                        .clipShape(Capsule())
                    }
                    .padding(.top, 4)
                }
            }

            // Distribute To — non-editable row, tap opens SelectInviteesView (spec § 3)
            formField(label: "ce_distribute_to".localized) {
                Button { showInviteesPicker = true } label: {
                    HStack {
                        Text(distributeSelection.summary.isEmpty ? "Select" : distributeSelection.summary)
                            .font(.system(size: 14))
                            .foregroundColor(distributeSelection.summary.isEmpty ? .textPlaceholder : .textBody)
                            .lineLimit(1)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Image(systemName: "chevron.right")
                            .font(.system(size: 12)).foregroundColor(.textSubtle)
                    }
                    .inputStyle()
                }
                .buttonStyle(.plain)
                Text("ce_distribute_hint".localized)
                    .font(.system(size: 11))
                    .foregroundColor(.textSubtle)
                    .italic()
            }

            // Organizer Excluded (web parity: boxed checkbox)
            HStack(spacing: 10) {
                Toggle(isOn: $organizerExcluded) { EmptyView() }
                    .labelsHidden()
                Text("The organizer will not be a part of this event.")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(.textBody)
            }
            .padding(12)
            .background(Color.surfaceAlt)
            .cornerRadius(8)
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.appBorder, lineWidth: 1))

            // Event Color (web parity: 6 preset palette)
            formField(label: "Color") {
                HStack(spacing: 8) {
                    ForEach(noteColorPresets, id: \.hex) { preset in
                        Button(action: { eventColor = preset.hex }) {
                            RoundedRectangle(cornerRadius: 6)
                                .fill(Color(hex: preset.hex))
                                .frame(width: 28, height: 28)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 6)
                                        .stroke(
                                            eventColor.lowercased() == preset.hex.lowercased() ? Color.solidDark : Color.borderInput,
                                            lineWidth: eventColor.lowercased() == preset.hex.lowercased() ? 3 : 2
                                        )
                                )
                        }
                        .buttonStyle(PlainButtonStyle())
                    }
                    Spacer()
                }
            }
        }
    }

    // MARK: - Note Form (web parity: Title *, Notes, Color palette)
    private var noteForm: some View {
        VStack(alignment: .leading, spacing: 16) {
            formField(label: "Title *") {
                TextField("e.g., Rain backup plan needed", text: $noteTitle).inputStyle()
            }

            formField(label: "Notes") {
                TextEditor(text: $noteText)
                    .frame(minHeight: 120)
                    .padding(8)
                    .background(Color.surface)
                    .cornerRadius(10)
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.borderInput, lineWidth: 1))
            }

            formField(label: "Color") {
                HStack(spacing: 8) {
                    ForEach(noteColorPresets, id: \.hex) { preset in
                        Button(action: { noteColor = preset.hex }) {
                            RoundedRectangle(cornerRadius: 6)
                                .fill(Color(hex: preset.hex))
                                .frame(width: 28, height: 28)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 6)
                                        .stroke(
                                            noteColor.lowercased() == preset.hex.lowercased() ? Color.solidDark : Color.borderInput,
                                            lineWidth: noteColor.lowercased() == preset.hex.lowercased() ? 3 : 2
                                        )
                                )
                                .shadow(
                                    color: noteColor.lowercased() == preset.hex.lowercased() ? Color.solidDark.opacity(0.3) : Color.clear,
                                    radius: 2
                                )
                        }
                        .buttonStyle(PlainButtonStyle())
                    }
                    Spacer()
                }
            }
        }
    }

    // MARK: - Form Field Helper
    private func formField<Content: View>(label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).sectionLabel()
            content()
        }
    }
}
