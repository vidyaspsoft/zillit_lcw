import SwiftUI

/// ScheduleListView — By Date / By Schedule toggle with schedule rows.
struct ScheduleListView: View {
    @ObservedObject var viewModel: BoxScheduleViewModel
    var onDayTap: ((Int64) -> Void)? = nil

    private let listModeKey = "box-schedule-list-mode"
    @State private var showSetDefaultToast = false
    @State private var showListModePopover = false
    @State private var showDeleteConfirm = false
    @State private var deleteTargetId: String? = nil
    @State private var deleteTargetName: String? = nil
    @State private var deleteSingleDate: Int64? = nil  // non-nil → byDate single-date delete; nil → delete whole schedule
    // Shared filter state lives on the view model so both List + Calendar views use it.
    @State private var showFiltersSheet = false
    @State private var showEventDeleteConfirm = false
    @State private var eventDeleteTarget: ScheduleEvent? = nil

    // Read-only projections + write-capable Binding for TextField.
    private var searchText: String { viewModel.filterSearchText }
    private var searchBinding: Binding<String> {
        Binding(get: { viewModel.filterSearchText }, set: { viewModel.filterSearchText = $0 })
    }
    private var typeFilter: String { viewModel.filterTypeName }
    private var contentFilter: String { viewModel.filterContentKind }

    private var activeFilterCount: Int {
        var n = 0
        if !viewModel.filterSearchText.trimmingCharacters(in: .whitespaces).isEmpty { n += 1 }
        if !viewModel.filterTypeName.isEmpty { n += 1 }
        if viewModel.filterContentKind != "all" { n += 1 }
        return n
    }

    /// Prefer calendarData (carries nested events/notes); fall back to scheduleDays.
    private var sourceDays: [ScheduleDay] {
        viewModel.calendarData.isEmpty ? viewModel.scheduleDays : viewModel.calendarData
    }

    private var filteredDays: [ScheduleDay] {
        let q = searchText.trimmingCharacters(in: .whitespaces).lowercased()
        return sourceDays.filter { day in
            let matchesType = typeFilter.isEmpty || day.typeName.lowercased() == typeFilter.lowercased()
            if !matchesType { return false }
            if q.isEmpty { return true }
            let dateStr = "\(DateUtils.formatShortDate(day.startDate)) \(DateUtils.formatShortDate(day.endDate))".lowercased()
            return day.title.lowercased().contains(q)
                || day.typeName.lowercased().contains(q)
                || dateStr.contains(q)
        }
    }

    private var showSchedules: Bool { contentFilter == "all" || contentFilter == "schedules" }
    private var showEvents:    Bool { contentFilter == "all" || contentFilter == "events" }
    private var showNotes:     Bool { contentFilter == "all" || contentFilter == "notes" }

    var body: some View {
        ZStack {
        VStack(spacing: 0) {
            // Mode toggle + Set Default
            HStack(spacing: 8) {
                Picker("", selection: $viewModel.listMode) {
                    Text("bs_by_date".localized).tag("by_date")
                    Text("bs_by_schedule".localized).tag("by_schedule")
                }
                .pickerStyle(SegmentedPickerStyle())

                Button(action: { showListModePopover.toggle() }) {
                    HStack(spacing: 2) {
                        Image(systemName: "square.grid.2x2").font(.system(size: 9))
                        Text("bs_set_default".localized).font(.system(size: 9, weight: .medium))
                    }
                    .foregroundColor(.textSecondary)
                    .padding(.horizontal, 6).padding(.vertical, 4)
                    .background(Color.surface).cornerRadius(5)
                    .overlay(RoundedRectangle(cornerRadius: 5).stroke(Color.borderButton, lineWidth: 1))
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)

            // Inline Search (grows) + Filter button on its right.
            HStack(spacing: 8) {
                HStack(spacing: 6) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 12))
                        .foregroundColor(.textPlaceholder)
                    TextField("Search by title, type, date…", text: searchBinding)
                        .font(.system(size: 13))
                        .autocapitalization(.none)
                    if !searchText.isEmpty {
                        Button(action: { viewModel.filterSearchText = "" }) {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 12))
                                .foregroundColor(.textSubtle)
                        }
                    }
                }
                .padding(.horizontal, 10).padding(.vertical, 6)
                .background(Color.surface)
                .cornerRadius(6)
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.borderInput, lineWidth: 1))

                Button(action: { showFiltersSheet = true }) {
                    HStack(spacing: 6) {
                        Image(systemName: "line.3.horizontal.decrease.circle").font(.system(size: 12))
                        Text("Filter").font(.system(size: 12, weight: .medium))
                        if activeFilterCount > 0 {
                            Text("\(activeFilterCount)")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 6).padding(.vertical, 1)
                                .background(Color.primaryAccent)
                                .clipShape(Capsule())
                        }
                    }
                    .foregroundColor(.textSecondary)
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(Color.surface)
                    .cornerRadius(6)
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.borderInput, lineWidth: 1))
                }
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 6)

            if sourceDays.isEmpty {
                // Empty state
                VStack(spacing: 12) {
                    Text("📅")
                        .font(.system(size: 48))
                        .opacity(0.3)
                    Text("no_schedule_title".localized)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.textMuted)
                    Text("no_schedule_desc".localized)
                        .font(.system(size: 13))
                        .foregroundColor(.textPlaceholder)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                // Content — keyed by mode to force re-render
                ScrollView {
                    LazyVStack(spacing: 0) {
                        if viewModel.listMode == "by_date" {
                            byDateContent
                        } else {
                            byScheduleContent
                        }
                    }
                    .background(Color.surface)
                    .cornerRadius(10)
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.appBorder, lineWidth: 1))
                    .padding(.horizontal, 12)
                }
                .id(viewModel.listMode) // Force ScrollView re-create on mode change
            }
        }
        .onAppear {
            // Restore saved mode AFTER view is rendered (DispatchQueue avoids "Publishing changes" crash)
            DispatchQueue.main.async {
                if let saved = UserDefaults.standard.string(forKey: listModeKey),
                   ["by_date", "by_schedule"].contains(saved),
                   viewModel.listMode != saved {
                    viewModel.listMode = saved
                }
            }
        }
        .onChange(of: viewModel.listMode) { newMode in
            UserDefaults.standard.set(newMode, forKey: listModeKey)
        }
        .alert(isPresented: $showEventDeleteConfirm) {
            Alert(
                title: Text("delete_confirm_title".localized),
                message: Text("Delete \"\(eventDeleteTarget?.title.isEmpty == false ? eventDeleteTarget!.title : "(untitled)")\"?"),
                primaryButton: .destructive(Text("action_delete".localized)) {
                    if let id = eventDeleteTarget?.id { viewModel.deleteEvent(id: id) }
                    eventDeleteTarget = nil
                },
                secondaryButton: .cancel { eventDeleteTarget = nil }
            )
        }
        .sheet(isPresented: $showFiltersSheet) {
            ListFiltersSheet(
                initialType: typeFilter,
                initialContent: contentFilter,
                types: viewModel.scheduleTypes,
                onApply: { t, c in
                    viewModel.filterTypeName = t
                    viewModel.filterContentKind = c
                    showFiltersSheet = false
                },
                onClose: { showFiltersSheet = false }
            )
        }

            // List Mode Set Default Popover
            if showListModePopover {
                Color.black.opacity(0.01).ignoresSafeArea()
                    .onTapGesture { showListModePopover = false }
                VStack {
                    SetDefaultPopover(
                        title: "dv_choose_title".localized,
                        subtitle: "dv_list_desc".localized,
                        options: [
                            (value: "by_date", label: "bs_by_date".localized, desc: "dv_by_date_desc".localized),
                            (value: "by_schedule", label: "bs_by_schedule".localized, desc: "dv_by_schedule_desc".localized),
                        ],
                        currentValue: UserDefaults.standard.string(forKey: listModeKey) ?? "by_date",
                        onSelect: { selected in
                            UserDefaults.standard.set(selected, forKey: listModeKey)
                            DispatchQueue.main.async { viewModel.listMode = selected }
                            showSetDefaultToast = true
                            DispatchQueue.main.asyncAfter(deadline: .now() + 2) { showSetDefaultToast = false }
                        },
                        onDismiss: { showListModePopover = false }
                    )
                    Spacer()
                }
                .padding(.top, 40)
                .padding(.trailing, 12)
                .frame(maxWidth: .infinity, alignment: .trailing)
                .zIndex(200)
            }

            // Toast
            if showSetDefaultToast {
                VStack {
                    Spacer()
                    Text("Saved as default!")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.solidDarkText)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(Color.solidDark)
                        .cornerRadius(8)
                        .shadow(radius: 4)
                        .padding(.bottom, 20)
                }
                .transition(.opacity)
                .animation(.easeInOut, value: showSetDefaultToast)
            }
        } // ZStack
    }

    // MARK: - Merged list items (schedules + events/notes chronologically interleaved — matches Android)
    fileprivate enum MergedItem {
        case schedule(day: ScheduleDay, singleDate: Int64, isSingleDay: Bool)
        case event(ScheduleEvent, kind: String)

        var sortKey: Int64 {
            switch self {
            case .schedule(_, let d, _): return d
            case .event(let e, _): return e.date
            }
        }
        var itemId: String {
            switch self {
            case .schedule(let d, let date, _): return "s-\(d.id)-\(date)"
            case .event(let e, let k): return "\(k)-\(e.id)"
            }
        }
    }

    private var mergedByDateItems: [MergedItem] {
        var items: [MergedItem] = []
        if showSchedules {
            for day in filteredDays {
                for d in day.calendarDays {
                    items.append(.schedule(day: day, singleDate: d, isSingleDay: true))
                }
            }
        }
        if showEvents {
            items.append(contentsOf: filteredDays.flatMap { $0.events ?? [] }.map { .event($0, kind: "event") })
        }
        if showNotes {
            items.append(contentsOf: filteredDays.flatMap { $0.notes ?? [] }.map { .event($0, kind: "note") })
        }
        return items.sorted { $0.sortKey < $1.sortKey }
    }

    private var mergedByScheduleItems: [MergedItem] {
        var items: [MergedItem] = []
        if showSchedules {
            items.append(contentsOf: filteredDays.map { .schedule(day: $0, singleDate: $0.startDate, isSingleDay: false) })
        }
        if showEvents {
            items.append(contentsOf: filteredDays.flatMap { $0.events ?? [] }.map { .event($0, kind: "event") })
        }
        if showNotes {
            items.append(contentsOf: filteredDays.flatMap { $0.notes ?? [] }.map { .event($0, kind: "note") })
        }
        return items.sorted { $0.sortKey < $1.sortKey }
    }

    // MARK: - By Date (per-calendar-day rows, interleaved with events/notes by date)
    @ViewBuilder
    private var byDateContent: some View {
        let items = mergedByDateItems
        ForEach(Array(items.enumerated()), id: \.offset) { index, item in
            renderMergedItem(item)
            if index < items.count - 1 {
                Divider().background(Color.borderLight)
            }
        }
    }

    // MARK: - By Schedule (one row per block, interleaved with events/notes by date)
    @ViewBuilder
    private var byScheduleContent: some View {
        let items = mergedByScheduleItems
        ForEach(Array(items.enumerated()), id: \.offset) { index, item in
            renderMergedItem(item)
            if index < items.count - 1 {
                Divider().background(Color.borderLight)
            }
        }
        .alert(isPresented: $showDeleteConfirm) {
            if let singleDate = deleteSingleDate {
                return Alert(
                    title: Text("delete_confirm_title".localized),
                    message: Text("Remove \"\(deleteTargetName ?? "")\"?"),
                    primaryButton: .destructive(Text("action_delete".localized)) {
                        if let id = deleteTargetId {
                            viewModel.removeDates(entries: [(id: id, dates: [singleDate])])
                        }
                    },
                    secondaryButton: .cancel()
                )
            } else {
                return Alert(
                    title: Text("Delete Script"),
                    message: Text("Delete the entire \"\(deleteTargetName ?? "")\" schedule? This cannot be undone."),
                    primaryButton: .destructive(Text("action_delete".localized)) {
                        if let id = deleteTargetId { viewModel.deleteDay(id: id) }
                    },
                    secondaryButton: .cancel()
                )
            }
        }
    }

    @ViewBuilder
    private func renderMergedItem(_ item: MergedItem) -> some View {
        switch item {
        case .schedule(let day, let singleDate, let isSingleDay):
            if isSingleDay {
                scheduleByDateRow(day: day, singleDate: singleDate)
            } else {
                scheduleByBlockRow(day: day)
            }
        case .event(let event, let kind):
            EventListRow(
                event: event, kind: kind, viewModel: viewModel,
                onDelete: { eventDeleteTarget = event; showEventDeleteConfirm = true }
            )
        }
    }

    @ViewBuilder
    private func scheduleByDateRow(day: ScheduleDay, singleDate: Int64) -> some View {
        VStack(spacing: 0) {
            Button(action: {
                let dayKey = DateUtils.toEpoch(Calendar.current.startOfDay(for: DateUtils.fromEpoch(singleDate)))
                onDayTap?(dayKey)
            }) {
                ScheduleRowView(
                    typeName: day.typeName, typeColor: day.color, title: day.title,
                    date: DateUtils.formatDayMonth(singleDate),
                    isToday: DateUtils.isToday(singleDate),
                    isPast: DateUtils.isPast(singleDate)
                )
            }
            .buttonStyle(PlainButtonStyle())

            HStack(spacing: 8) {
                NavigationLink(destination: CreateScheduleView(
                    viewModel: viewModel, editingDay: day,
                    isSingleDayEdit: true, singleDate: singleDate
                )) {
                    HStack(spacing: 3) {
                        Image(systemName: "pencil").font(.system(size: 11))
                        Text("action_edit".localized).font(.system(size: 11, weight: .medium))
                    }
                    .foregroundColor(.textLink)
                    .padding(.horizontal, 10).padding(.vertical, 5)
                    .background(Color.surfaceHoverBlue.opacity(0.5)).cornerRadius(5)
                }

                Button(action: {
                    deleteTargetId = day.id
                    deleteTargetName = "\(day.typeName)\(day.title.isEmpty ? "" : " - \(day.title)") on \(DateUtils.formatShortDate(singleDate))"
                    deleteSingleDate = singleDate
                    showDeleteConfirm = true
                }) {
                    HStack(spacing: 3) {
                        Image(systemName: "trash").font(.system(size: 11))
                        Text("action_delete".localized).font(.system(size: 11, weight: .medium))
                    }
                    .foregroundColor(.dangerBg)
                    .padding(.horizontal, 10).padding(.vertical, 5)
                    .background(Color.dangerBg.opacity(0.08)).cornerRadius(5)
                }
                Spacer()
            }
            .padding(.horizontal, 12).padding(.bottom, 8)
        }
    }

    @ViewBuilder
    private func scheduleByBlockRow(day: ScheduleDay) -> some View {
        VStack(spacing: 0) {
            Button(action: { onDayTap?(day.startDate) }) {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        RoundedRectangle(cornerRadius: 3).fill(Color(hex: day.color)).frame(width: 12, height: 12)
                        Text(day.typeName).font(.system(size: 14, weight: .bold)).foregroundColor(.textPrimary)
                        if !day.title.isEmpty {
                            Text("— \(day.title)").font(.custom("Georgia", size: 12)).foregroundColor(.textSecondary).lineLimit(1)
                        }
                        Spacer()
                        Text("\(day.numberOfDays) day(s)").font(.system(size: 10, weight: .medium)).foregroundColor(.textMuted)
                    }
                    Text("\(DateUtils.formatShortDate(day.startDate)) – \(DateUtils.formatDate(day.endDate))")
                        .font(.system(size: 11)).foregroundColor(.textSubtle)
                }
                .padding(12)
            }
            .buttonStyle(PlainButtonStyle())

            if !DateUtils.isPast(day.endDate) {
                Divider().background(Color.borderLight)
                HStack(spacing: 8) {
                    NavigationLink(destination: CreateScheduleView(viewModel: viewModel, editingDay: day)) {
                        HStack(spacing: 3) {
                            Image(systemName: "pencil").font(.system(size: 11))
                            Text("action_edit".localized).font(.system(size: 11, weight: .medium))
                        }
                        .foregroundColor(.textLink)
                        .padding(.horizontal, 8).padding(.vertical, 5)
                        .background(Color.surfaceHoverBlue.opacity(0.5)).cornerRadius(4)
                    }
                    Button(action: {
                        deleteTargetId = day.id
                        deleteTargetName = day.typeName + (day.title.isEmpty ? "" : " - \(day.title)")
                        deleteSingleDate = nil
                        showDeleteConfirm = true
                    }) {
                        HStack(spacing: 3) {
                            Image(systemName: "trash").font(.system(size: 11))
                            Text("Delete Script").font(.system(size: 11, weight: .medium))
                        }
                        .foregroundColor(.dangerBg)
                        .padding(.horizontal, 8).padding(.vertical, 5)
                        .background(Color.dangerBg.opacity(0.08)).cornerRadius(4)
                    }
                    Spacer()
                }
                .padding(.horizontal, 12).padding(.vertical, 6)
            }
        }
        .background(Color.surface)
    }
}

// MARK: - Event / Note list row
private struct EventListRow: View {
    let event: ScheduleEvent
    let kind: String // "event" | "note"
    let viewModel: BoxScheduleViewModel
    let onDelete: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            Rectangle()
                .fill(Color(hex: event.color.isEmpty ? "#3498DB" : event.color))
                .frame(width: 3)

            VStack(alignment: .leading, spacing: 2) {
                Text(kind == "note" ? "NOTE" : "EVENT")
                    .font(.system(size: 9, weight: .bold))
                    .tracking(0.5)
                    .foregroundColor(Color(hex: event.color.isEmpty ? "#3498DB" : event.color))
                Text(event.title.isEmpty ? "(untitled)" : event.title)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.textPrimary)
                    .lineLimit(1)
                if event.date > 0 {
                    Text(DateUtils.formatDayMonth(event.date))
                        .font(.system(size: 10))
                        .foregroundColor(.textMuted)
                }
                let preview: String = {
                    let desc = event.description ?? ""
                    return desc.isEmpty ? (event.notes ?? "") : desc
                }()
                if !preview.isEmpty {
                    Text(preview)
                        .font(.system(size: 12))
                        .foregroundColor(.textSubtle)
                        .lineLimit(2)
                }

                HStack(spacing: 8) {
                    NavigationLink(destination: CreateEventView(
                        viewModel: viewModel,
                        mode: event.eventType,
                        editingEvent: event
                    )) {
                        HStack(spacing: 3) {
                            Image(systemName: "pencil").font(.system(size: 11))
                            Text("action_edit".localized).font(.system(size: 11, weight: .medium))
                        }
                        .foregroundColor(.textLink)
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .background(Color.surfaceHoverBlue.opacity(0.5)).cornerRadius(5)
                    }
                    Button(action: onDelete) {
                        HStack(spacing: 3) {
                            Image(systemName: "trash").font(.system(size: 11))
                            Text("action_delete".localized).font(.system(size: 11, weight: .medium))
                        }
                        .foregroundColor(.dangerBg)
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .background(Color.dangerBg.opacity(0.08)).cornerRadius(5)
                    }
                    Spacer()
                }
                .padding(.top, 4)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
        }
        .background(Color.surface)
    }
}

// MARK: - Schedule Row
struct ScheduleRowView: View {
    let typeName: String
    let typeColor: String
    let title: String
    let date: String
    let isToday: Bool
    let isPast: Bool

    var body: some View {
        HStack(spacing: 8) {
            Text(date)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(isToday ? .primaryAccent : isPast ? .textDisabled : .textSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)

            HStack(spacing: 3) {
                Circle()
                    .fill(Color(hex: typeColor))
                    .frame(width: 6, height: 6)
                Text(typeName)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(.textBody)
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(Color(hex: typeColor).opacity(0.12))
            .cornerRadius(4)

            if !title.isEmpty {
                Text(title)
                    .font(.system(size: 12))
                    .foregroundColor(.textBody)
                    .lineLimit(1)
            }

            Spacer()

            if isToday {
                Text("bs_today".localized)
                    .font(.system(size: 8, weight: .bold))
                    .foregroundColor(.calTodayText)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.calTodayBg)
                    .cornerRadius(6)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(isToday ? Color.surfaceWarning : Color.surface)
        .opacity(isPast ? 0.5 : 1)
    }
}

// MARK: - Consolidated filters sheet (simple, chip-based) — shared by List + Calendar views.
struct ListFiltersSheet: View {
    let initialType: String
    let initialContent: String
    let types: [ScheduleType]
    let onApply: (String, String) -> Void
    let onClose: () -> Void

    @State private var draftType: String = ""
    @State private var draftContent: String = "all"

    private var hasActive: Bool { !draftType.isEmpty || draftContent != "all" }
    /// Type filter only applies to schedules — hide its section when Show is Events/Notes.
    private var typeSectionVisible: Bool {
        draftContent == "all" || draftContent == "schedules"
    }

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        // Show (content kind) — chip row, most important filter
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Show")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(.textMuted)
                            HStack(spacing: 8) {
                                ForEach([
                                    ("all", "All"),
                                    ("schedules", "Schedules"),
                                    ("events", "Events"),
                                    ("notes", "Notes")
                                ], id: \.0) { (value, label) in
                                    FilterChip(
                                        label: label,
                                        isSelected: draftContent == value,
                                        action: {
                                            draftContent = value
                                            // Drop a hidden type when switching to Events/Notes.
                                            if value == "events" || value == "notes" {
                                                draftType = ""
                                            }
                                        }
                                    )
                                }
                            }
                        }

                        // Schedule Type — only shown when Schedules are visible.
                        if typeSectionVisible {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Schedule Type")
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundColor(.textMuted)
                                FlexibleChips(types: types, selected: draftType) { t in
                                    draftType = t
                                }
                            }
                        }
                    }
                    .padding(16)
                }

                // Sticky primary Apply button; Reset shows only when something is active.
                VStack(spacing: 8) {
                    Button(action: { onApply(draftType, draftContent) }) {
                        Text("Apply Filters")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity, minHeight: 48)
                            .background(Color.primaryAccent)
                            .cornerRadius(10)
                    }
                    if hasActive {
                        Button(action: {
                            draftType = ""
                            draftContent = "all"
                        }) {
                            Text("Clear all filters")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundColor(.textLink)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(Color.surface)
            }
            .navigationBarTitle("Filters", displayMode: .inline)
            .navigationBarItems(trailing: Button(action: onClose) {
                Image(systemName: "xmark").foregroundColor(.textMuted)
            })
        }
        .onAppear {
            draftType = initialType
            draftContent = initialContent
        }
    }
}

// Reusable filter chip — uniform shape for Show + Type pickers.
struct FilterChip: View {
    let label: String
    let isSelected: Bool
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 13, weight: isSelected ? .semibold : .medium))
                .foregroundColor(isSelected ? .white : .textSecondary)
                .padding(.horizontal, 14).padding(.vertical, 8)
                .background(isSelected ? Color.primaryAccent : Color.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: 18)
                        .stroke(isSelected ? Color.primaryAccent : Color.borderInput, lineWidth: 1)
                )
                .cornerRadius(18)
        }
    }
}

// Horizontal scrolling chip row for Schedule Type — "All Types" + one per type.
struct FlexibleChips: View {
    let types: [ScheduleType]
    let selected: String
    let onSelect: (String) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                FilterChip(label: "All Types", isSelected: selected.isEmpty, action: { onSelect("") })
                ForEach(types) { t in
                    FilterChip(label: t.title, isSelected: selected == t.title, action: { onSelect(t.title) })
                }
            }
            .padding(.vertical, 2)
        }
    }
}
