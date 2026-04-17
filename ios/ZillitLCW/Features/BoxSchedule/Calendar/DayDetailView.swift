import SwiftUI

/// DayDetailView — full day detail page matching web's ScheduleDayDetail.
/// Shows schedules with Edit/Delete, events with Edit/Delete, notes with Delete,
/// and Add Schedule/Event/Note buttons.
struct DayDetailView: View {
    let dayKey: Int64
    let schedules: [ScheduleDay]
    var viewModel: BoxScheduleViewModel? = nil

    @State private var navToCreateSchedule = false
    @State private var navToCreateEvent = false
    @State private var navToEditSchedule = false
    @State private var showDeleteConfirm = false
    @State private var deleteTargetId: String? = nil
    @State private var deleteTargetType: String? = nil
    @State private var deleteTargetName: String? = nil

    private var isToday: Bool { DateUtils.isToday(dayKey) }
    private var isPast: Bool { DateUtils.isPast(dayKey) }
    private var isEmpty: Bool { schedules.isEmpty }
    private var allEvents: [ScheduleEvent] { schedules.flatMap { $0.events ?? [] } }
    private var allNotes: [ScheduleEvent] { schedules.flatMap { $0.notes ?? [] } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                dateHeader
                Divider().background(Color.appBorder)
                if !schedules.isEmpty { schedulesSection }
                if !allEvents.isEmpty { eventsSection }
                if !allNotes.isEmpty { notesSection }
                if isEmpty { emptyState }
                if !isPast { actionButtons }
            }
            .padding(20)
        }
        .background(Color.pageBg)
        .navigationTitle(DateUtils.formatFullDay(dayKey))
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarHidden(false)
        .alert(isPresented: $showDeleteConfirm) {
            Alert(
                title: Text("delete_confirm_title".localized),
                message: Text("Are you sure you want to delete \"\(deleteTargetName ?? "")\"? This cannot be undone."),
                primaryButton: .destructive(Text("action_delete".localized)) {
                    performDelete()
                },
                secondaryButton: .cancel()
            )
        }
    }

    // MARK: - Date Header
    private var dateHeader: some View {
        HStack(alignment: .center, spacing: 14) {
            if isToday {
                Text("\(Calendar.current.component(.day, from: DateUtils.fromEpoch(dayKey)))")
                    .font(.system(size: 36, weight: .heavy))
                    .foregroundColor(.calTodayText)
                    .frame(width: 60, height: 60)
                    .background(Color.calTodayBg)
                    .clipShape(Circle())
            } else {
                Text("\(Calendar.current.component(.day, from: DateUtils.fromEpoch(dayKey)))")
                    .font(.custom("Georgia", size: 48)).fontWeight(.heavy).foregroundColor(.textSecondary)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(DateUtils.formatDayName(dayKey)).font(.custom("Georgia", size: 18)).fontWeight(.bold).foregroundColor(.textPrimary)
                Text(DateUtils.formatMonthYear(DateUtils.fromEpoch(dayKey)).uppercased()).font(.system(size: 12, weight: .medium)).foregroundColor(.textMuted)
                if isToday {
                    Text("bs_today".localized).font(.system(size: 10, weight: .bold)).foregroundColor(.successText)
                        .padding(.horizontal, 8).padding(.vertical, 2).background(Color.successText.opacity(0.1)).cornerRadius(8).padding(.top, 2)
                }
            }
        }
    }

    // MARK: - Schedules with Edit + Delete (matching web)
    private var schedulesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("dd_schedules".localized).sectionLabel()

            ForEach(schedules, id: \.id) { schedule in
                VStack(spacing: 0) {
                    HStack(spacing: 10) {
                        Circle().fill(Color(hex: schedule.color)).frame(width: 12, height: 12)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(schedule.typeName).font(.system(size: 14, weight: .bold)).foregroundColor(.textPrimary)
                            if !schedule.title.isEmpty {
                                Text("\"\(schedule.title)\"").font(.custom("Georgia", size: 12)).foregroundColor(.textSecondary)
                            }
                            Text("\(schedule.numberOfDays) day(s) · \(DateUtils.formatShortDate(schedule.startDate)) – \(DateUtils.formatDate(schedule.endDate))")
                                .font(.system(size: 11)).foregroundColor(.textMuted)
                        }
                        Spacer()
                    }
                    .padding(12)

                    // Action buttons row (Edit + Delete) — matching web
                    if !isPast {
                        Divider().background(Color.borderLight)
                        HStack(spacing: 8) {
                            // Edit button
                            if let vm = viewModel {
                                NavigationLink(destination: CreateScheduleView(viewModel: vm, editingDay: schedule, isSingleDayEdit: true, singleDate: dayKey)) {
                                    HStack(spacing: 3) {
                                        Image(systemName: "pencil").font(.system(size: 11))
                                        Text("action_edit".localized).font(.system(size: 11, weight: .medium))
                                    }
                                    .foregroundColor(.textLink)
                                    .padding(.horizontal, 10).padding(.vertical, 6)
                                    .background(Color.surfaceHoverBlue.opacity(0.5)).cornerRadius(5)
                                }
                            }

                            // Delete button
                            Button(action: {
                                deleteTargetId = schedule.id
                                deleteTargetType = "schedule"
                                deleteTargetName = schedule.typeName + (schedule.title.isEmpty ? "" : " - \(schedule.title)")
                                showDeleteConfirm = true
                            }) {
                                HStack(spacing: 3) {
                                    Image(systemName: "trash").font(.system(size: 11))
                                    Text("action_delete".localized).font(.system(size: 11, weight: .medium))
                                }
                                .foregroundColor(.dangerBg)
                                .padding(.horizontal, 10).padding(.vertical, 6)
                                .background(Color.dangerBg.opacity(0.08)).cornerRadius(5)
                            }

                            Spacer()
                        }
                        .padding(.horizontal, 12).padding(.vertical, 8)
                    }
                }
                .background(Color(hex: schedule.color).opacity(0.06))
                .cornerRadius(8)
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(hex: schedule.color).opacity(0.2), lineWidth: 1))
            }
        }
    }

    // MARK: - Events with Edit + Delete (matching web)
    private var eventsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("dd_events".localized).sectionLabel()

            ForEach(allEvents, id: \.id) { event in
                VStack(spacing: 0) {
                    HStack(spacing: 10) {
                        Rectangle().fill(Color(hex: event.color)).frame(width: 4).cornerRadius(2)
                        VStack(alignment: .leading, spacing: 2) {
                            if let start = event.startDateTime, start > 0 {
                                Text(event.fullDay ? "full_day_label".localized : DateUtils.formatTime(start))
                                    .font(.system(size: 11, weight: .semibold)).foregroundColor(.textMuted)
                            }
                            Text(event.title).font(.system(size: 14, weight: .semibold)).foregroundColor(.textPrimary)
                            if let loc = event.location, !loc.isEmpty {
                                HStack(spacing: 3) {
                                    Image(systemName: "mappin").font(.system(size: 10)).foregroundColor(.textLink)
                                    Text(loc).font(.system(size: 11)).foregroundColor(.textLink)
                                }
                            }
                            if let desc = event.description, !desc.isEmpty {
                                Text(desc).font(.system(size: 12)).foregroundColor(.textSubtle).lineLimit(2)
                            }
                        }
                        Spacer()
                    }
                    .padding(10)

                    // Edit + Remove buttons (matching web)
                    if !isPast {
                        Divider().background(Color.borderLight)
                        HStack(spacing: 8) {
                            if let vm = viewModel {
                                NavigationLink(destination: CreateEventView(viewModel: vm)) {
                                    HStack(spacing: 3) {
                                        Image(systemName: "pencil").font(.system(size: 11))
                                        Text("action_edit".localized).font(.system(size: 11, weight: .medium))
                                    }
                                    .foregroundColor(.textLink)
                                    .padding(.horizontal, 10).padding(.vertical, 6)
                                    .background(Color.surfaceHoverBlue.opacity(0.5)).cornerRadius(5)
                                }
                            }

                            Button(action: {
                                deleteTargetId = event.id
                                deleteTargetType = "event"
                                deleteTargetName = event.title
                                showDeleteConfirm = true
                            }) {
                                HStack(spacing: 3) {
                                    Image(systemName: "trash").font(.system(size: 11))
                                    Text("Remove").font(.system(size: 11, weight: .medium))
                                }
                                .foregroundColor(.dangerBg)
                                .padding(.horizontal, 10).padding(.vertical, 6)
                                .background(Color.dangerBg.opacity(0.08)).cornerRadius(5)
                            }

                            Spacer()
                        }
                        .padding(.horizontal, 10).padding(.vertical, 6)
                    }
                }
                .background(Color.surface)
                .cornerRadius(8)
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.appBorder, lineWidth: 1))
            }
        }
    }

    // MARK: - Notes with Delete
    private var notesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("dd_notes".localized).sectionLabel()

            ForEach(allNotes, id: \.id) { note in
                HStack(spacing: 10) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(note.title).font(.system(size: 14, weight: .semibold)).foregroundColor(.textPrimary)
                        if let text = note.notes, !text.isEmpty {
                            Text(text).font(.system(size: 12)).foregroundColor(.textSubtle).lineLimit(3)
                        }
                    }
                    Spacer()
                    if !isPast {
                        Button(action: {
                            deleteTargetId = note.id
                            deleteTargetType = "event"
                            deleteTargetName = note.title
                            showDeleteConfirm = true
                        }) {
                            Image(systemName: "trash").font(.system(size: 13)).foregroundColor(.dangerBg)
                        }
                    }
                }
                .padding(10)
                .background(Color.surfaceNoteCard)
                .cornerRadius(8)
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.surfaceNoteCardBorder, lineWidth: 1))
            }
        }
    }

    // MARK: - Empty State
    private var emptyState: some View {
        VStack(spacing: 12) {
            Text("📅").font(.system(size: 48)).opacity(0.35)
            Text("dd_empty".localized).font(.system(size: 15, weight: .bold)).foregroundColor(.textSubtle)
            Text(isPast ? "dd_past".localized : "dd_add_prompt".localized)
                .font(.system(size: 12)).foregroundColor(.textDisabled)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 40)
    }

    // MARK: - Action Buttons: Add Schedule + Add Event (no Create Note here)
    private var actionButtons: some View {
        VStack(spacing: 0) {
            Divider().background(Color.borderDashed)
            Text("dd_add_to_day".localized).sectionLabel().padding(.top, 12)

            HStack(spacing: 8) {
                if let vm = viewModel {
                    NavigationLink(destination: CreateScheduleView(viewModel: vm, lockedDate: dayKey), isActive: $navToCreateSchedule) {
                        HStack(spacing: 4) {
                            Image(systemName: "calendar").font(.system(size: 12))
                            Text("dd_add_schedule".localized).font(.system(size: 12, weight: .medium))
                        }
                        .foregroundColor(.textSecondary)
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(Color.surface).cornerRadius(6)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.borderButton, lineWidth: 1))
                    }

                    NavigationLink(destination: CreateEventView(viewModel: vm, mode: "event"), isActive: $navToCreateEvent) {
                        HStack(spacing: 4) {
                            Image(systemName: "clock").font(.system(size: 12))
                            Text("dd_add_event".localized).font(.system(size: 12, weight: .medium))
                        }
                        .foregroundColor(.textSecondary)
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(Color.surface).cornerRadius(6)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.borderButton, lineWidth: 1))
                    }
                }
            }
            .padding(.top, 8)
        }
    }

    // MARK: - Delete Action
    private func performDelete() {
        guard let id = deleteTargetId, let type = deleteTargetType else { return }
        if type == "schedule" {
            viewModel?.deleteDay(id: id)
        } else {
            viewModel?.deleteEvent(id: id)
        }
    }
}

// MARK: - FlowLayout (iOS 14 compatible)
struct FlowLayout<Content: View>: View {
    let spacing: CGFloat
    let content: () -> Content
    init(spacing: CGFloat = 8, @ViewBuilder content: @escaping () -> Content) {
        self.spacing = spacing; self.content = content
    }
    var body: some View { HStack(spacing: spacing) { content() } }
}
