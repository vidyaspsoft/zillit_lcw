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

            if viewModel.scheduleDays.isEmpty {
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

    // MARK: - By Date
    private var byDateContent: some View {
        let allDays: [(day: ScheduleDay, singleDate: Int64)] = viewModel.scheduleDays
            .flatMap { day in day.calendarDays.map { (day: day, singleDate: $0) } }
            .sorted { $0.singleDate < $1.singleDate }

        return ForEach(Array(allDays.enumerated()), id: \.offset) { index, item in
            Button(action: {
                let dayKey = DateUtils.toEpoch(Calendar.current.startOfDay(for: DateUtils.fromEpoch(item.singleDate)))
                onDayTap?(dayKey)
            }) {
                ScheduleRowView(
                    typeName: item.day.typeName,
                    typeColor: item.day.color,
                    title: item.day.title,
                    date: DateUtils.formatDayMonth(item.singleDate),
                    isToday: DateUtils.isToday(item.singleDate),
                    isPast: DateUtils.isPast(item.singleDate)
                )
            }
            .buttonStyle(PlainButtonStyle())

            if index < allDays.count - 1 {
                Divider().background(Color.borderLight)
            }
        }
    }

    // MARK: - By Schedule (with Edit + Delete like web)
    private var byScheduleContent: some View {
        ForEach(viewModel.scheduleDays) { day in
            VStack(spacing: 0) {
                // Block info — tap to view detail
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

                // Edit + Delete row (matching web)
                if !DateUtils.isPast(day.endDate) {
                    Divider().background(Color.borderLight)
                    HStack(spacing: 8) {
                        NavigationLink(destination: CreateScheduleView(viewModel: viewModel)) {
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
                            showDeleteConfirm = true
                        }) {
                            HStack(spacing: 3) {
                                Image(systemName: "trash").font(.system(size: 11))
                                Text("action_delete".localized).font(.system(size: 11, weight: .medium))
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
            .overlay(Rectangle().frame(height: 1).foregroundColor(.borderLight), alignment: .bottom)
        }
        .alert(isPresented: $showDeleteConfirm) {
            Alert(
                title: Text("delete_confirm_title".localized),
                message: Text("Are you sure you want to delete \"\(deleteTargetName ?? "")\"? This cannot be undone."),
                primaryButton: .destructive(Text("action_delete".localized)) {
                    if let id = deleteTargetId { viewModel.deleteDay(id: id) }
                },
                secondaryButton: .cancel()
            )
        }
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
