import SwiftUI

/// CreateScheduleView — matches web's CreateScheduleModal A-to-Z.
///
/// Features:
/// 1. Locked start date — when coming from calendar cell "Add Schedule"
/// 2. Single day edit — when editing a specific day (shows Replace/Extend/Overlap inline)
/// 3. 409 Conflict handling — ConflictView shown on date overlap
/// 4. Calendar picked dates shown as removable tags
/// 5. Past dates disabled on all pickers
/// 6. Edit auto-fills type, dates, correct tab
/// 7. No Cancel button (back navigation)
struct CreateScheduleView: View {
    @Environment(\.presentationMode) var presentationMode
    @ObservedObject var viewModel: BoxScheduleViewModel

    // Editing data (nil = new schedule)
    var editingDay: ScheduleDay? = nil
    var lockedDate: Int64? = nil          // From calendar "Add Schedule" — locks start date
    var isSingleDayEdit: Bool = false     // From day detail "Edit" on a specific day
    var singleDate: Int64? = nil          // The specific day being edited

    // Type
    @State private var selectedTypeId = ""
    @State private var typeSearchText = ""
    @State private var showTypeDropdown = false
    @State private var navToTypeManager = false
    @State private var typeCountBefore = 0

    // Date tab: 0=Date Range, 1=Calendar, 2=Day Wise
    @State private var dateTab = 0
    @State private var validationError: String?

    // Date Range mode
    @State private var rangeSubMode = 0 // 0=by_days, 1=by_end_date
    @State private var startDate = Date()
    @State private var numberOfDays = 5
    @State private var endDate = Date()
    @State private var isStartDateLocked = false

    // Calendar mode
    @State private var pickedDatesEpoch: Set<Int64> = []
    @State private var calendarMonth = Date()

    // Day Wise mode
    @State private var dayWiseStart = Date()
    @State private var dayWiseEnd = Calendar.current.date(byAdding: .day, value: 6, to: Date())!
    @State private var selectedWeekDays: Set<Int> = []

    // Single day edit — conflict action
    @State private var singleDayConflictAction = "replace"

    // Multi-day conflict (409 from API)
    @State private var showConflict = false
    @State private var isSubmitting = false

    private var types: [ScheduleType] { viewModel.scheduleTypes }
    private var filteredTypes: [ScheduleType] {
        if typeSearchText.isEmpty { return types }
        return types.filter { $0.title.localizedCaseInsensitiveContains(typeSearchText) }
    }
    private var selectedType: ScheduleType? { types.first { $0.id == selectedTypeId } }
    private var isEditing: Bool { editingDay != nil }
    private var originalTypeId: String { editingDay?.typeId ?? "" }
    private var typeChanged: Bool { !selectedTypeId.isEmpty && selectedTypeId != originalTypeId }

    // MARK: - Computed calendar days
    private var calendarDays: [Int64] {
        if isSingleDayEdit, let sd = singleDate { return [sd] }
        switch dateTab {
        case 0:
            if rangeSubMode == 0 {
                return (0..<numberOfDays).compactMap { i in
                    guard let d = Calendar.current.date(byAdding: .day, value: i, to: Calendar.current.startOfDay(for: startDate)) else { return nil }
                    return DateUtils.toEpoch(d)
                }
            } else {
                var days: [Int64] = []
                var current = Calendar.current.startOfDay(for: startDate)
                let end = Calendar.current.startOfDay(for: endDate)
                while current <= end { days.append(DateUtils.toEpoch(current)); current = Calendar.current.date(byAdding: .day, value: 1, to: current)! }
                return days
            }
        case 1: return Array(pickedDatesEpoch).sorted()
        case 2:
            guard !selectedWeekDays.isEmpty else { return [] }
            var days: [Int64] = []
            var current = Calendar.current.startOfDay(for: dayWiseStart)
            let end = Calendar.current.startOfDay(for: dayWiseEnd)
            while current <= end {
                let wd = Calendar.current.component(.weekday, from: current) - 1
                if selectedWeekDays.contains(wd) { days.append(DateUtils.toEpoch(current)) }
                current = Calendar.current.date(byAdding: .day, value: 1, to: current)!
            }
            return days
        default: return []
        }
    }

    private var summaryText: String {
        let c = calendarDays.count
        guard c > 0, let first = calendarDays.first, let last = calendarDays.last else { return "" }
        return "\(c) day(s): \(DateUtils.formatShortDate(first)) – \(DateUtils.formatDate(last))"
    }

    private var availableWeekdays: Set<Int> {
        var result: Set<Int> = []
        var current = Calendar.current.startOfDay(for: dayWiseStart)
        let end = Calendar.current.startOfDay(for: dayWiseEnd)
        while current <= end {
            result.insert(Calendar.current.component(.weekday, from: current) - 1)
            current = Calendar.current.date(byAdding: .day, value: 1, to: current)!
        }
        return result
    }

    // Minimum date for pickers (today — Feature 5: disable past dates)
    private var minDate: Date { Calendar.current.startOfDay(for: Date()) }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Type picker
                    typeSection

                    // Single day edit mode — show locked date + conflict options
                    if isSingleDayEdit {
                        singleDayEditSection
                    }

                    // Date tabs (hidden in single day edit)
                    if !isSingleDayEdit {
                        dateModeTabs
                        dateModeContent

                        // Summary
                        if !calendarDays.isEmpty {
                            Text(summaryText)
                                .font(.system(size: 13, weight: .medium)).foregroundColor(.textBody)
                                .padding(10).frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color.surfaceWarning).cornerRadius(6)
                        }
                    }
                }
                .padding(16)
            }

            // Save button pinned at bottom
            Button(action: { handleSubmit() }) {
                HStack {
                    if isSubmitting {
                        ProgressView().scaleEffect(0.8)
                    }
                    Text(isEditing ? "Save Changes" : "cs_save".localized)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(.solidDarkText)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background((selectedTypeId.isEmpty || (!isSingleDayEdit && calendarDays.isEmpty) || isSubmitting) ? Color.textDisabled : Color.solidDark)
                .cornerRadius(10)
            }
            .disabled(selectedTypeId.isEmpty || (!isSingleDayEdit && calendarDays.isEmpty) || isSubmitting)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Color.surface)
            .overlay(Rectangle().frame(height: 1).foregroundColor(.appBorder), alignment: .top)
        }
        .background(Color.pageBg.ignoresSafeArea())
        .navigationTitle(isSingleDayEdit ? "Edit Day" : isEditing ? "Edit Schedule" : "bs_create_schedule".localized)
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarHidden(false)
        .alert(isPresented: Binding(get: { validationError != nil }, set: { if !$0 { validationError = nil } })) {
            Alert(title: Text("bs_error_title".localized), message: Text(validationError ?? ""), dismissButton: .default(Text("bs_ok".localized)))
        }
        .overlay(
            Group {
                if showConflict {
                    // Full-screen dim + centered conflict popup
                    ZStack {
                        Color.black.opacity(0.4).ignoresSafeArea()
                            .onTapGesture { showConflict = false }

                        VStack(alignment: .leading, spacing: 12) {
                            Text("conflict_title".localized)
                                .font(.system(size: 18, weight: .bold)).foregroundColor(.textPrimary)

                            Text("These dates overlap with an existing schedule. How would you like to resolve this?")
                                .font(.system(size: 12)).foregroundColor(.textMuted)

                            conflictPopupOption(value: "replace", title: "conflict_replace".localized, desc: "conflict_replace_desc".localized)
                            conflictPopupOption(value: "extend", title: "conflict_extend".localized, desc: "conflict_extend_desc".localized)
                            conflictPopupOption(value: "overlap", title: "conflict_overlap".localized, desc: "conflict_overlap_desc".localized)

                            Button(action: { showConflict = false }) {
                                Text("conflict_back".localized)
                                    .font(.system(size: 13, weight: .medium)).foregroundColor(.textMuted)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 8)
                            }
                        }
                        .padding(20)
                        .background(Color.surface)
                        .cornerRadius(16)
                        .shadow(color: Color.black.opacity(0.2), radius: 12, y: 4)
                        .padding(.horizontal, 24)
                    }
                }
            }
        )
        .onAppear { setupInitialState() }
        .onChange(of: viewModel.scheduleTypes.count) { newCount in
            if newCount > typeCountBefore && typeCountBefore > 0 {
                if let newType = viewModel.scheduleTypes.last {
                    DispatchQueue.main.async { selectedTypeId = newType.id; showTypeDropdown = false }
                }
            }
            typeCountBefore = newCount
        }
    }

    // MARK: - Setup Initial State (Feature 1, 6)
    private func setupInitialState() {
        typeCountBefore = viewModel.scheduleTypes.count

        // Feature 1: Locked date from calendar
        if let locked = lockedDate {
            let lockedDateObj = DateUtils.fromEpoch(locked)
            startDate = lockedDateObj
            isStartDateLocked = true
            numberOfDays = 1
            // Pre-select in calendar tab too
            pickedDatesEpoch.insert(locked)
        }

        // Feature 6: Edit auto-fill
        if let day = editingDay, selectedTypeId.isEmpty {
            DispatchQueue.main.async {
                selectedTypeId = day.typeId
                numberOfDays = day.numberOfDays
                if let first = day.calendarDays.first {
                    startDate = DateUtils.fromEpoch(first)
                }
                if let last = day.calendarDays.last {
                    endDate = DateUtils.fromEpoch(last)
                }
                // Detect correct tab — if dates have gaps, use Calendar tab
                if day.calendarDays.count > 1 {
                    let sorted = day.calendarDays.sorted()
                    let oneDay: Int64 = 86400000
                    var hasGap = false
                    for i in 1..<sorted.count {
                        if sorted[i] - sorted[i-1] > oneDay + 3600000 { hasGap = true; break }
                    }
                    if hasGap || day.dateRangeType == "by_dates" {
                        dateTab = 1
                        pickedDatesEpoch = Set(day.calendarDays)
                    }
                }
                dayWiseStart = DateUtils.fromEpoch(day.startDate)
                dayWiseEnd = DateUtils.fromEpoch(day.endDate)
            }
        }
    }

    // MARK: - Type Section (same as before)
    private var typeSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("cs_type".localized).sectionLabel()
            HStack(spacing: 8) {
                ZStack(alignment: .leading) {
                    if let type = selectedType {
                        HStack(spacing: 8) {
                            Circle().fill(Color(hex: type.color)).frame(width: 12, height: 12)
                            Text(type.title).font(.system(size: 14, weight: .semibold)).foregroundColor(.textPrimary)
                            Spacer()
                            Button(action: { selectedTypeId = ""; showTypeDropdown = true }) {
                                Image(systemName: "xmark.circle.fill").foregroundColor(.textMuted)
                            }
                        }
                        .padding(.horizontal, 14).padding(.vertical, 10)
                        .background(Color(hex: type.color).opacity(0.08)).cornerRadius(10)
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color(hex: type.color), lineWidth: 2))
                    } else {
                        TextField("cs_select_type".localized, text: $typeSearchText, onEditingChanged: { if $0 { showTypeDropdown = true } })
                            .inputStyle()
                            .onTapGesture { showTypeDropdown = true }
                    }
                }
                NavigationLink(destination: TypeManagerView(viewModel: viewModel), isActive: $navToTypeManager) {
                    HStack(spacing: 4) {
                        Image(systemName: "plus").font(.system(size: 12))
                        Text("Add New").font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundColor(.primaryAccent)
                    .padding(.horizontal, 12).padding(.vertical, 10)
                    .background(Color.primaryAccent.opacity(0.08)).cornerRadius(10)
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.primaryAccent.opacity(0.3), lineWidth: 1))
                }
            }
            if showTypeDropdown && selectedType == nil {
                VStack(spacing: 2) {
                    ForEach(filteredTypes) { type in
                        Button(action: { selectedTypeId = type.id; typeSearchText = ""; showTypeDropdown = false }) {
                            HStack(spacing: 8) {
                                Circle().fill(Color(hex: type.color)).frame(width: 10, height: 10)
                                Text(type.title).font(.system(size: 13, weight: .medium)).foregroundColor(.textPrimary)
                                if type.systemDefined {
                                    Text("SYSTEM").font(.system(size: 8, weight: .bold)).foregroundColor(.textSubtle)
                                        .padding(.horizontal, 4).padding(.vertical, 1)
                                        .overlay(RoundedRectangle(cornerRadius: 2).stroke(Color.borderInput, lineWidth: 1))
                                }
                                Spacer()
                            }
                            .padding(.horizontal, 12).padding(.vertical, 8)
                        }
                        Divider().background(Color.borderLight)
                    }
                    if filteredTypes.isEmpty {
                        Text("No types found").font(.system(size: 12)).foregroundColor(.textMuted).padding(10)
                    }
                }
                .background(Color.surface).cornerRadius(8)
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.appBorder, lineWidth: 1))
                .shadow(color: Color.black.opacity(0.08), radius: 4, y: 2)
            }
        }
    }

    // MARK: - Feature 2: Single Day Edit Section
    private var singleDayEditSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Locked date display
            if let sd = singleDate {
                VStack(alignment: .leading, spacing: 4) {
                    Text("DATE").sectionLabel()
                    Text(DateUtils.formatFullDay(sd))
                        .font(.system(size: 15, weight: .semibold)).foregroundColor(.textPrimary)
                    Text("Date cannot be changed when editing a single day")
                        .font(.system(size: 11)).foregroundColor(.textSubtle)
                }
                .padding(12).frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.surfaceAlt).cornerRadius(8)
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.appBorder, lineWidth: 1))
            }

            // Show conflict options when type is changed
            if typeChanged {
                Text("How should this change be applied?").sectionLabel()

                VStack(spacing: 8) {
                    conflictOption(value: "replace", title: "conflict_replace".localized,
                        desc: "Remove this date from the current \(editingDay?.typeName ?? "") block and assign it to the new type. The block will shrink by 1 day.")
                    conflictOption(value: "extend", title: "conflict_extend".localized,
                        desc: "Remove this date from \(editingDay?.typeName ?? "") and assign it to the new type. The block will extend by 1 day at the end to keep the same total.")
                    conflictOption(value: "overlap", title: "conflict_overlap".localized,
                        desc: "Keep the existing \(editingDay?.typeName ?? "") on this date and also add the new type. Both will appear.")
                }
            }
        }
    }

    private func conflictOption(value: String, title: String, desc: String) -> some View {
        let isSelected = singleDayConflictAction == value
        return Button(action: { singleDayConflictAction = value }) {
            HStack(alignment: .top, spacing: 10) {
                ZStack {
                    Circle().stroke(isSelected ? Color.solidDark : Color.textDisabled, lineWidth: isSelected ? 5 : 2)
                        .frame(width: 20, height: 20)
                }
                .padding(.top, 2)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.system(size: 13, weight: .bold)).foregroundColor(.textPrimary)
                    Text(desc).font(.system(size: 11)).foregroundColor(.textMuted).fixedSize(horizontal: false, vertical: true)
                }
                Spacer()
            }
            .padding(12)
            .background(isSelected ? Color.surfaceAlt : Color.surface)
            .cornerRadius(8)
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(isSelected ? Color.solidDark : Color.appBorder, lineWidth: isSelected ? 2 : 1))
        }
    }

    // MARK: - Date Mode Tabs
    private var dateModeTabs: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("cs_how_to_set_dates".localized).sectionLabel()
            Picker("", selection: $dateTab) {
                Text("cs_date_range".localized).tag(0)
                Text("cs_calendar".localized).tag(1)
                Text("cs_day_wise".localized).tag(2)
            }
            .pickerStyle(SegmentedPickerStyle())
        }
    }

    @ViewBuilder
    private var dateModeContent: some View {
        switch dateTab {
        case 0: dateRangeContent
        case 1: calendarContent
        case 2: dayWiseContent
        default: EmptyView()
        }
    }

    // MARK: - Date Range (Feature 5: min date = today)
    private var dateRangeContent: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("cs_date_range_desc".localized)
                .font(.system(size: 12)).foregroundColor(.textSubtle).italic()
                .padding(8).frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.surfaceAlt).cornerRadius(6)

            Picker("", selection: $rangeSubMode) {
                Text("cs_set_by_days".localized).tag(0)
                Text("cs_set_by_end_date".localized).tag(1)
            }
            .pickerStyle(SegmentedPickerStyle())

            if rangeSubMode == 0 {
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("cs_start_date".localized).sectionLabel()
                        DatePicker("", selection: $startDate, in: minDate..., displayedComponents: .date)
                            .labelsHidden().disabled(isStartDateLocked)
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        Text("cs_number_of_days".localized).sectionLabel()
                        HStack(spacing: 0) {
                            TextField("1", text: Binding(
                                get: { "\(numberOfDays)" },
                                set: { if let n = Int($0), n > 0 { numberOfDays = n } }
                            ))
                            .keyboardType(.numberPad).font(.system(size: 15, weight: .semibold))
                            .foregroundColor(.textPrimary).multilineTextAlignment(.center).frame(minWidth: 40)
                            Button(action: { if numberOfDays > 1 { numberOfDays -= 1 } }) {
                                Text("–").font(.system(size: 18)).foregroundColor(.textMuted).frame(width: 36, height: 36)
                            }
                            Button(action: { numberOfDays += 1 }) {
                                Text("+").font(.system(size: 18)).foregroundColor(.textPrimary).frame(width: 36, height: 36)
                            }
                        }
                        .padding(.horizontal, 8).background(Color.surface).cornerRadius(8)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.borderInput, lineWidth: 1))
                    }
                }
            } else {
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("cs_start_date".localized).sectionLabel()
                        DatePicker("", selection: $startDate, in: minDate..., displayedComponents: .date)
                            .labelsHidden().disabled(isStartDateLocked)
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        Text("cs_end_date".localized).sectionLabel()
                        DatePicker("", selection: $endDate, in: startDate..., displayedComponents: .date).labelsHidden()
                    }
                }
            }
        }
    }

    // MARK: - Calendar with removable tags (Feature 4, 5)
    private var calendarContent: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("cs_calendar_desc".localized)
                .font(.system(size: 12)).foregroundColor(.textSubtle).italic()
                .padding(8).frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.surfaceAlt).cornerRadius(6)

            HStack {
                Button(action: { calendarMonth = Calendar.current.date(byAdding: .month, value: -1, to: calendarMonth)! }) {
                    Image(systemName: "chevron.left").foregroundColor(.textSecondary)
                }
                Spacer()
                Text(DateUtils.formatMonthYear(calendarMonth)).font(.system(size: 14, weight: .bold)).foregroundColor(.textPrimary)
                Spacer()
                Button(action: { calendarMonth = Calendar.current.date(byAdding: .month, value: 1, to: calendarMonth)! }) {
                    Image(systemName: "chevron.right").foregroundColor(.textSecondary)
                }
            }

            HStack(spacing: 0) {
                ForEach(["S","M","T","W","T","F","S"], id: \.self) { d in
                    Text(d).font(.system(size: 11, weight: .bold)).foregroundColor(.textSubtle).frame(maxWidth: .infinity)
                }
            }

            let monthDays = calendarMonthDays
            let monthNum = Calendar.current.component(.month, from: calendarMonth)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 2), count: 7), spacing: 2) {
                ForEach(0..<monthDays.count, id: \.self) { i in
                    let date = monthDays[i]
                    let epoch = DateUtils.toEpoch(Calendar.current.startOfDay(for: date))
                    let isCurrentMonth = Calendar.current.component(.month, from: date) == monthNum
                    let isSelected = pickedDatesEpoch.contains(epoch)
                    let isPastDay = date < minDate
                    let isLocked = isStartDateLocked && lockedDate == epoch

                    Button(action: {
                        guard !isLocked else { return }
                        if isSelected { pickedDatesEpoch.remove(epoch) }
                        else { pickedDatesEpoch.insert(epoch) }
                    }) {
                        Text("\(Calendar.current.component(.day, from: date))")
                            .font(.system(size: 13, weight: isSelected ? .bold : .regular))
                            .foregroundColor(
                                isLocked ? .white :
                                isSelected ? .white :
                                isPastDay ? .textDisabled :
                                isCurrentMonth ? .textBody : .textDisabled
                            )
                            .frame(maxWidth: .infinity, minHeight: 34)
                            .background(
                                isLocked ? Color.primaryAccent :
                                isSelected ? Color.solidDark : Color.clear
                            )
                            .cornerRadius(6)
                    }
                    .disabled(!isCurrentMonth || isPastDay)
                }
            }

            // Feature 4: Removable tags for picked dates
            if !pickedDatesEpoch.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 4) {
                        ForEach(Array(pickedDatesEpoch).sorted(), id: \.self) { epoch in
                            let isLocked = isStartDateLocked && lockedDate == epoch
                            HStack(spacing: 4) {
                                Text(DateUtils.formatDayMonth(epoch))
                                    .font(.system(size: 11, weight: isLocked ? .bold : .regular))
                                if isLocked {
                                    Text("(fixed)").font(.system(size: 9)).foregroundColor(.textMuted)
                                } else {
                                    Button(action: { pickedDatesEpoch.remove(epoch) }) {
                                        Image(systemName: "xmark").font(.system(size: 8, weight: .bold)).foregroundColor(.textMuted)
                                    }
                                }
                            }
                            .foregroundColor(.textBody)
                            .padding(.horizontal, 8).padding(.vertical, 4)
                            .background(Color.surfaceMuted).cornerRadius(4)
                            .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color.borderLight, lineWidth: 1))
                        }
                    }
                }

                Text("\(pickedDatesEpoch.count) date(s) selected")
                    .font(.system(size: 12, weight: .medium)).foregroundColor(.successText)
            }
        }
    }

    // MARK: - Day Wise (Feature 5: min date)
    private var dayWiseContent: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("cs_day_wise_desc".localized)
                .font(.system(size: 12)).foregroundColor(.textSubtle).italic()
                .padding(8).frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.surfaceAlt).cornerRadius(6)

            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("cs_start_date".localized).sectionLabel()
                    DatePicker("", selection: $dayWiseStart, in: minDate..., displayedComponents: .date)
                        .labelsHidden().disabled(isStartDateLocked)
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text("cs_end_date".localized).sectionLabel()
                    DatePicker("", selection: $dayWiseEnd, in: dayWiseStart..., displayedComponents: .date).labelsHidden()
                }
            }

            Text("Select days of the week").sectionLabel()
            let dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
            let available = availableWeekdays
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 4), spacing: 6) {
                ForEach(0..<7, id: \.self) { day in
                    let isAvailable = available.contains(day)
                    let isSelected = selectedWeekDays.contains(day)
                    Button(action: {
                        guard isAvailable else { return }
                        if isSelected { selectedWeekDays.remove(day) } else { selectedWeekDays.insert(day) }
                    }) {
                        Text(dayLabels[day])
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(!isAvailable ? Color.textDisabled : isSelected ? .solidDarkText : .textSecondary)
                            .frame(maxWidth: .infinity, minHeight: 36)
                            .background(!isAvailable ? Color.surfaceMuted.opacity(0.5) : isSelected ? Color.solidDark : Color.surface)
                            .cornerRadius(8)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(!isAvailable ? Color.borderLight : isSelected ? Color.solidDark : Color.borderInput, lineWidth: 1))
                    }
                    .disabled(!isAvailable)
                    .opacity(isAvailable ? 1 : 0.35)
                }
            }
            if !calendarDays.isEmpty {
                Text("\(calendarDays.count) date(s) match")
                    .font(.system(size: 12, weight: .medium)).foregroundColor(.successText)
            }
        }
    }

    // MARK: - Helpers
    private var calendarMonthDays: [Date] {
        var cal = Calendar.current; cal.firstWeekday = 1
        let startOfMonth = cal.date(from: cal.dateComponents([.year, .month], from: calendarMonth))!
        let firstWeekday = cal.component(.weekday, from: startOfMonth)
        let offset = firstWeekday - cal.firstWeekday
        let firstDate = cal.date(byAdding: .day, value: -offset, to: startOfMonth)!
        return (0..<42).map { cal.date(byAdding: .day, value: $0, to: firstDate)! }
    }

    // MARK: - Submit (Feature 2, 3)
    private func handleSubmit() {
        guard !selectedTypeId.isEmpty else { validationError = "cs_error_select_type".localized; return }

        isSubmitting = true

        if isSingleDayEdit {
            // Feature 2: Single day edit with Replace/Extend/Overlap
            // TODO: Full single-day edit logic (remove date, create new, extend)
            // For now, create a new day on that date with the selected action
            viewModel.createDay(
                title: "", typeId: selectedTypeId, dateRangeType: "by_dates",
                calendarDays: calendarDays, conflictAction: singleDayConflictAction,
                onConflict: { isSubmitting = false; showConflict = true },
                onSuccess: { isSubmitting = false; presentationMode.wrappedValue.dismiss() }
            )
        } else {
            guard !calendarDays.isEmpty else { validationError = "cs_error_select_dates".localized; isSubmitting = false; return }
            let drt: String = dateTab == 1 ? "by_dates" : dateTab == 2 ? "day_wise" : "by_days"

            // Feature 3: 409 conflict → show ConflictView
            viewModel.createDay(
                title: "", typeId: selectedTypeId, dateRangeType: drt,
                calendarDays: calendarDays, conflictAction: "",
                onConflict: { isSubmitting = false; showConflict = true },
                onSuccess: { isSubmitting = false; presentationMode.wrappedValue.dismiss() }
            )
        }
    }

    private func conflictPopupOption(value: String, title: String, desc: String) -> some View {
        Button(action: {
            showConflict = false
            retryWithConflictAction(value)
        }) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.system(size: 14, weight: .bold)).foregroundColor(.textPrimary)
                Text(desc).font(.system(size: 11)).foregroundColor(.textMuted).fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(Color.surfaceAlt)
            .cornerRadius(8)
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.appBorder, lineWidth: 1))
        }
    }

    private func retryWithConflictAction(_ action: String) {
        isSubmitting = true
        let drt: String = dateTab == 1 ? "by_dates" : dateTab == 2 ? "day_wise" : "by_days"
        viewModel.createDay(
            title: "", typeId: selectedTypeId, dateRangeType: drt,
            calendarDays: calendarDays, conflictAction: action,
            onConflict: { isSubmitting = false },
            onSuccess: { isSubmitting = false; presentationMode.wrappedValue.dismiss() }
        )
    }
}
