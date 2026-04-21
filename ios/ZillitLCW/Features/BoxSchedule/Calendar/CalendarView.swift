import SwiftUI

/// ScheduleCalendarView — Month/Week/Day calendar with schedule pills.
/// Fully responsive — no fixed widths. Adapts to any iPhone screen size.
struct ScheduleCalendarView: View {
    @ObservedObject var viewModel: BoxScheduleViewModel
    var onDayTap: ((Int64) -> Void)? = nil
    var onSetDefault: (() -> Void)? = nil

    private let weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    private let calendarModeKey = "box-schedule-calendar-mode"
    @State private var showSetDefaultToast = false
    @State private var showCalModePopover = false
    @State private var showFiltersSheet = false

    private var activeFilterCount: Int {
        var n = 0
        if !viewModel.filterSearchText.trimmingCharacters(in: .whitespaces).isEmpty { n += 1 }
        if !viewModel.filterTypeName.isEmpty { n += 1 }
        if viewModel.filterContentKind != "all" { n += 1 }
        return n
    }

    init(viewModel: BoxScheduleViewModel, onDayTap: ((Int64) -> Void)? = nil) {
        self._viewModel = ObservedObject(wrappedValue: viewModel)
        self.onDayTap = onDayTap
    }

    var body: some View {
        rootBody
            .sheet(isPresented: $showFiltersSheet) {
                ListFiltersSheet(
                    initialType: viewModel.filterTypeName,
                    initialContent: viewModel.filterContentKind,
                    types: viewModel.scheduleTypes,
                    onApply: { t, c in
                        viewModel.filterTypeName = t
                        viewModel.filterContentKind = c
                        showFiltersSheet = false
                    },
                    onClose: { showFiltersSheet = false }
                )
            }
    }

    private var rootBody: some View {
        ZStack {
            VStack(spacing: 0) {
                calendarToolbar

                if viewModel.calendarMode == "day" {
                    DayDetailView(
                        dayKey: DateUtils.toEpoch(viewModel.currentDay),
                        schedules: viewModel.dayLookup[DateUtils.toEpoch(Calendar.current.startOfDay(for: viewModel.currentDay))] ?? [],
                        viewModel: viewModel
                    )
                } else {
                    monthWeekGrid
                }
            }

            // Cal Mode Set Default Popover (at root ZStack — on top of everything)
            if showCalModePopover {
                Color.black.opacity(0.01).ignoresSafeArea()
                    .onTapGesture { showCalModePopover = false }
                VStack {
                    SetDefaultPopover(
                        title: "dv_choose_title".localized,
                        subtitle: "dv_calendar_desc".localized,
                        options: [
                            (value: "month", label: "bs_month".localized + " View", desc: "dv_month_desc".localized),
                            (value: "week", label: "bs_week".localized + " View", desc: "dv_week_desc".localized),
                            (value: "day", label: "bs_day".localized + " View", desc: "dv_day_desc".localized),
                        ],
                        currentValue: UserDefaults.standard.string(forKey: calendarModeKey) ?? "month",
                        onSelect: { selected in
                            UserDefaults.standard.set(selected, forKey: calendarModeKey)
                            DispatchQueue.main.async { viewModel.calendarMode = selected }
                            showSetDefaultToast = true
                            DispatchQueue.main.asyncAfter(deadline: .now() + 2) { showSetDefaultToast = false }
                        },
                        onDismiss: { showCalModePopover = false }
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
        }
        .onAppear {
            // Restore saved mode AFTER view is rendered (avoids "Publishing changes" crash)
            DispatchQueue.main.async {
                if let saved = UserDefaults.standard.string(forKey: calendarModeKey),
                   ["month", "week", "day"].contains(saved),
                   viewModel.calendarMode != saved {
                    viewModel.calendarMode = saved
                }
            }
        }
    }

    // MARK: - Toolbar (mobile responsive — stacked layout)
    private var calendarToolbar: some View {
        VStack(spacing: 6) {
            // Row 1: Mode picker + Set Default
            HStack(spacing: 8) {
                Picker("", selection: $viewModel.calendarMode) {
                    Text("bs_month".localized).tag("month")
                    Text("bs_week".localized).tag("week")
                    Text("bs_day".localized).tag("day")
                }
                .pickerStyle(SegmentedPickerStyle())

                Button(action: { showCalModePopover.toggle() }) {
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

            // Row 1.5: Inline Search + Filter button (matches List view, shared filter state).
            HStack(spacing: 8) {
                HStack(spacing: 6) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 12))
                        .foregroundColor(.textPlaceholder)
                    TextField(
                        "Search by title, type, date…",
                        text: Binding(
                            get: { viewModel.filterSearchText },
                            set: { viewModel.filterSearchText = $0 }
                        )
                    )
                    .font(.system(size: 13))
                    .autocapitalization(.none)
                    if !viewModel.filterSearchText.isEmpty {
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

            // Row 2: Nav arrows + title + Today
            HStack {
                Button(action: { navigatePrev() }) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.textSecondary)
                        .frame(width: 32, height: 32)
                }

                Spacer()

                Text(headerTitle)
                    .font(.custom("Georgia", size: 14))
                    .fontWeight(.heavy)
                    .foregroundColor(.textPrimary)
                    .textCase(.uppercase)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)

                Spacer()

                Button(action: { navigateNext() }) {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.textSecondary)
                        .frame(width: 32, height: 32)
                }

                Button("bs_today".localized) { goToToday() }
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.textSecondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.surface)
                    .cornerRadius(6)
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.borderButton, lineWidth: 1))
            }
            .padding(.horizontal, 12)
        }
        .padding(.vertical, 8)
    }

    // MARK: - Month/Week Grid (responsive — uses maxWidth: .infinity)
    private var monthWeekGrid: some View {
        VStack(spacing: 0) {
            // Weekday headers
            HStack(spacing: 0) {
                ForEach(weekdays, id: \.self) { day in
                    Text(day.uppercased())
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(.textSubtle)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
            }
            .background(Color.surfaceAlt2)

            Divider().background(Color.borderMedium)

            // Grid
            let weeks = viewModel.calendarMode == "week" ? [currentWeekDays] : monthWeeks
            ScrollView {
                VStack(spacing: 0) {
                    ForEach(0..<weeks.count, id: \.self) { weekIdx in
                        HStack(spacing: 0) {
                            ForEach(0..<7, id: \.self) { dayIdx in
                                let date = weeks[weekIdx][dayIdx]
                                let dayKey = DateUtils.toEpoch(Calendar.current.startOfDay(for: date))
                                let schedules = viewModel.dayLookup[dayKey] ?? []

                                CalendarCellView(
                                    date: date,
                                    schedules: schedules,
                                    isCurrentMonth: Calendar.current.component(.month, from: date) == Calendar.current.component(.month, from: viewModel.currentMonth),
                                    isSelected: viewModel.selectedDayKey == dayKey,
                                    hideSchedulePills: !viewModel.showSchedulesInView,
                                    onTap: {
                                        onDayTap?(dayKey)
                                    }
                                )
                                .frame(maxWidth: .infinity)
                            }
                        }
                    }
                }
            }
        }
        .background(Color.surface)
        .cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.appBorder, lineWidth: 1))
        .padding(.horizontal, 8)
    }

    // MARK: - Navigation
    private var headerTitle: String {
        switch viewModel.calendarMode {
        case "day":
            return DateUtils.formatFullDay(DateUtils.toEpoch(viewModel.currentDay))
        case "week":
            let start = DateUtils.formatShortDate(DateUtils.toEpoch(currentWeekDays[0]))
            let end = DateUtils.formatDate(DateUtils.toEpoch(currentWeekDays[6]))
            return "\(start) – \(end)"
        default:
            return DateUtils.formatMonthYear(viewModel.currentMonth)
        }
    }

    private func navigatePrev() {
        switch viewModel.calendarMode {
        case "day": viewModel.currentDay = Calendar.current.date(byAdding: .day, value: -1, to: viewModel.currentDay)!
        case "week": viewModel.currentDay = Calendar.current.date(byAdding: .weekOfYear, value: -1, to: viewModel.currentDay)!
        default: viewModel.currentMonth = Calendar.current.date(byAdding: .month, value: -1, to: viewModel.currentMonth)!
        }
    }

    private func navigateNext() {
        switch viewModel.calendarMode {
        case "day": viewModel.currentDay = Calendar.current.date(byAdding: .day, value: 1, to: viewModel.currentDay)!
        case "week": viewModel.currentDay = Calendar.current.date(byAdding: .weekOfYear, value: 1, to: viewModel.currentDay)!
        default: viewModel.currentMonth = Calendar.current.date(byAdding: .month, value: 1, to: viewModel.currentMonth)!
        }
    }

    private func goToToday() {
        viewModel.currentDay = Date()
        viewModel.currentMonth = Date()
    }

    // MARK: - Date Calculations
    private var currentWeekDays: [Date] {
        var cal = Calendar.current
        cal.firstWeekday = 2
        let startOfWeek = cal.dateInterval(of: .weekOfYear, for: viewModel.currentDay)?.start ?? viewModel.currentDay
        return (0..<7).map { cal.date(byAdding: .day, value: $0, to: startOfWeek)! }
    }

    private var monthWeeks: [[Date]] {
        var cal = Calendar.current
        cal.firstWeekday = 2
        let startOfMonth = cal.date(from: cal.dateComponents([.year, .month], from: viewModel.currentMonth))!
        let range = cal.range(of: .day, in: .month, for: startOfMonth)!
        let firstWeekday = cal.component(.weekday, from: startOfMonth)
        let offset = (firstWeekday - cal.firstWeekday + 7) % 7

        var weeks: [[Date]] = []
        var current = cal.date(byAdding: .day, value: -offset, to: startOfMonth)!
        let totalDays = offset + range.count
        let totalWeeks = Int(ceil(Double(totalDays) / 7.0))

        for _ in 0..<max(totalWeeks, 5) {
            var week: [Date] = []
            for _ in 0..<7 {
                week.append(current)
                current = cal.date(byAdding: .day, value: 1, to: current)!
            }
            weeks.append(week)
        }
        return weeks
    }
}

// MARK: - Calendar Cell (responsive — no fixed widths)
struct CalendarCellView: View {
    let date: Date
    let schedules: [ScheduleDay]
    let isCurrentMonth: Bool
    let isSelected: Bool
    var hideSchedulePills: Bool = false
    let onTap: () -> Void

    private var isToday: Bool { Calendar.current.isDateInToday(date) }
    private var isPast: Bool { date < Calendar.current.startOfDay(for: Date()) }
    private var isWeekend: Bool { Calendar.current.isDateInWeekend(date) }

    // Each event/note has its own `date` — only show it on the cell whose date matches.
    // Without this filter, an event attached to a multi-day block would render on all days of the block.
    private var cellDayMs: Int64 {
        DateUtils.toEpoch(Calendar.current.startOfDay(for: date))
    }
    private var allEvents: [ScheduleEvent] {
        schedules.flatMap { ($0.events ?? []).filter { $0.date == cellDayMs } }
    }
    private var allNotes: [ScheduleEvent] {
        schedules.flatMap { ($0.notes ?? []).filter { $0.date == cellDayMs } }
    }

    // Combined total: each schedule, each event, notes as a single slot.
    private var totalItems: Int {
        (hideSchedulePills ? 0 : schedules.count) + allEvents.count + (allNotes.isEmpty ? 0 : 1)
    }
    private let maxVisible = 2

    private var visibleSchedules: [ScheduleDay] {
        hideSchedulePills ? [] : Array(schedules.prefix(maxVisible))
    }
    private var remainingAfterSchedules: Int { max(0, maxVisible - visibleSchedules.count) }
    private var visibleEvents: [ScheduleEvent] { Array(allEvents.prefix(remainingAfterSchedules)) }
    private var showNoteSlot: Bool {
        !allNotes.isEmpty && (visibleSchedules.count + visibleEvents.count) < maxVisible
    }
    private var shownCount: Int {
        visibleSchedules.count + visibleEvents.count + (showNoteSlot ? 1 : 0)
    }
    private var hiddenCount: Int { max(0, totalItems - shownCount) }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            // Date number
            HStack {
                if isToday {
                    Text("\(Calendar.current.component(.day, from: date))")
                        .font(.system(size: 11, weight: .heavy))
                        .foregroundColor(.calTodayText)
                        .frame(width: 22, height: 22)
                        .background(Color.calTodayBg)
                        .clipShape(Circle())
                } else {
                    Text("\(Calendar.current.component(.day, from: date))")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(isCurrentMonth ? .textSecondary : .textDisabled)
                }
                Spacer()
            }

            // Schedule pills
            ForEach(visibleSchedules, id: \.id) { schedule in
                HStack(spacing: 2) {
                    Circle()
                        .fill(Color(hex: schedule.color))
                        .frame(width: 5, height: 5)

                    Text(schedule.typeName == "Day Off" ? "OFF" : String(schedule.typeName.prefix(4)))
                        .font(.system(size: 8, weight: .semibold))
                        .foregroundColor(.textBody)
                        .lineLimit(1)
                }
                .padding(.horizontal, 3)
                .padding(.vertical, 1)
                .background(Color(hex: schedule.color).opacity(0.12))
                .cornerRadius(3)
            }

            // Events
            ForEach(visibleEvents, id: \.id) { evt in
                HStack(spacing: 3) {
                    Circle()
                        .fill(Color(hex: evt.color.isEmpty ? "#3498DB" : evt.color))
                        .frame(width: 5, height: 5)
                    Text(evt.title)
                        .font(.system(size: 8, weight: .medium))
                        .foregroundColor(.textBody)
                        .lineLimit(1)
                        .truncationMode(.tail)
                }
            }

            // Notes as a single slot
            if showNoteSlot {
                Text(allNotes.count == 1 ? "1 note" : "\(allNotes.count) notes")
                    .font(.system(size: 8))
                    .foregroundColor(.textSubtle)
            }

            // "+N More" if anything was hidden
            if hiddenCount > 0 {
                Text("+\(hiddenCount) More")
                    .font(.system(size: 8, weight: .bold))
                    .foregroundColor(.textSubtle)
            }

            Spacer(minLength: 0)
        }
        .padding(3)
        .frame(maxWidth: .infinity, minHeight: 60, alignment: .topLeading)
        .background(
            isSelected ? Color.calCellSelected :
            schedules.first.map { Color(hex: $0.color).opacity(0.05) } ??
            (isWeekend ? Color.calWeekendBg : Color.surface)
        )
        .opacity(isCurrentMonth ? (isPast ? 0.45 : 1) : 0.3)
        .overlay(
            Rectangle().stroke(
                isSelected ? Color.solidDark : Color.borderLight,
                lineWidth: isSelected ? 2 : 0.5
            )
        )
        .contentShape(Rectangle())
        .onTapGesture { onTap() }
    }
}
