import SwiftUI

/// HistoryView — activity log with color-coded action cards.
struct HistoryView: View {
    @Environment(\.presentationMode) var presentationMode
    @ObservedObject var viewModel: BoxScheduleViewModel
    @State private var selectedAction = "all"
    @State private var selectedDate: Date? = nil

    private let actions = [
        ("all", "history_all_actions"),
        ("created", "history_added"),
        ("updated", "history_changed"),
        ("deleted", "history_removed"),
        ("duplicated", "history_copied"),
        ("shared", "history_shared"),
    ]

    // MARK: - Filtered logs
    private var filteredLogs: [ActivityLog] {
        var logs = viewModel.activityLogs

        // Filter by action
        if selectedAction != "all" {
            logs = logs.filter { $0.action == selectedAction }
        }

        // Filter by date
        if let date = selectedDate {
            let cal = Calendar.current
            logs = logs.filter { log in
                let logDate = DateUtils.fromEpoch(log.createdAt)
                return cal.isDate(logDate, inSameDayAs: date)
            }
        }

        return logs
    }

    var body: some View {
            VStack(spacing: 0) {
                // Filters
                VStack(spacing: 10) {
                    HStack(spacing: 8) {
                        // Action filter
                        Picker("", selection: $selectedAction) {
                            ForEach(actions, id: \.0) { action in
                                Text(action.1.localized).tag(action.0)
                            }
                        }
                        .pickerStyle(MenuPickerStyle())
                        .frame(maxWidth: .infinity)
                        .inputStyle()

                        // Date picker
                        DatePicker("", selection: Binding(
                            get: { selectedDate ?? Date() },
                            set: { selectedDate = $0 }
                        ), displayedComponents: .date)
                        .labelsHidden()
                    }

                    // Color legend
                    HStack(spacing: 14) {
                        legendDot(color: .actionAdded, label: "history_label_added".localized)
                        legendDot(color: .actionChanged, label: "history_label_changed".localized)
                        legendDot(color: .actionRemoved, label: "history_label_removed".localized)
                        legendDot(color: .actionCopied, label: "history_label_copied".localized)
                        legendDot(color: .actionShared, label: "history_label_shared".localized)
                    }
                    .padding(8)
                    .background(Color.surface)
                    .cornerRadius(6)
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.borderDashed, lineWidth: 1))
                }
                .padding(16)
                .background(Color.drawerHeaderBg)

                Divider().background(Color.appBorder)

                // Cards
                ScrollView {
                    if filteredLogs.isEmpty {
                        VStack(spacing: 12) {
                            Text("history_empty".localized)
                                .font(.system(size: 14, weight: .medium))
                                .foregroundColor(.textMuted)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 40)
                    } else {
                        LazyVStack(spacing: 10) {
                            ForEach(filteredLogs) { log in
                                HistoryCardView(log: log)
                            }
                        }
                        .padding(16)
                    }
                }
                .background(Color.drawerBodyBg)
            }
            .navigationTitle("history_title".localized)
            .navigationBarTitleDisplayMode(.inline)
        .navigationBarHidden(false)
            .onAppear {
                viewModel.fetchActivityLog()
            }
    }

    private func legendDot(color: Color, label: String) -> some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text(label)
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(.textSecondary)
        }
    }
}

// MARK: - History Card
struct HistoryCardView: View {
    let log: ActivityLog

    private var actionColor: Color {
        switch log.action {
        case "created": return .actionAdded
        case "updated": return .actionChanged
        case "deleted": return .actionRemoved
        case "duplicated": return .actionCopied
        case "shared": return .actionShared
        default: return .textMuted
        }
    }

    private var actionLabel: String {
        switch log.action {
        case "created": return "history_label_added".localized
        case "updated": return "history_label_changed".localized
        case "deleted": return "history_label_removed".localized
        case "duplicated": return "history_label_copied".localized
        case "shared": return "history_label_shared".localized
        default: return log.action.uppercased()
        }
    }

    private var targetLabel: String {
        switch log.targetType {
        case "schedule_day": return "history_target_schedule".localized
        case "schedule_type": return "history_target_schedule_type".localized
        case "event": return "history_target_event".localized
        case "note": return "history_target_note".localized
        default: return log.targetType
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Action + Target
            HStack(spacing: 8) {
                Circle().fill(actionColor).frame(width: 8, height: 8)
                Text(actionLabel)
                    .font(.system(size: 11, weight: .heavy))
                    .foregroundColor(actionColor)
                    .tracking(0.8)
                Text("·").foregroundColor(.textPlaceholder).font(.system(size: 11))
                Text(targetLabel)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.textSecondary)
                    .textCase(.uppercase)
            }

            // Title
            if !log.targetTitle.isEmpty {
                Text("\"\(log.targetTitle)\"")
                    .font(.custom("Georgia", size: 14))
                    .fontWeight(.bold)
                    .foregroundColor(.textPrimary)
            }

            // Details
            if !log.details.isEmpty {
                Text(log.details)
                    .font(.system(size: 12))
                    .foregroundColor(.textSecondary)
            }

            // Footer
            Divider().background(Color.borderDashed)
            HStack {
                Text("\(DateUtils.formatShortDate(log.createdAt)) · \(DateUtils.formatTime(log.createdAt))")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.textSecondary)
                Text("·").foregroundColor(.textDisabled)
                Text("history_by_name".localized.localized(with: log.performedBy.name.isEmpty ? "history_someone".localized : log.performedBy.name))
                    .font(.system(size: 11))
                    .foregroundColor(.textMuted)
                Spacer()
            }
        }
        .padding(14)
        .background(Color.historyCardBg)
        .cornerRadius(6)
        .overlay(
            HStack {
                Rectangle().fill(actionColor).frame(width: 4)
                Spacer()
            }
            .cornerRadius(6)
        )
        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.historyCardBorder, lineWidth: 1))
    }
}
