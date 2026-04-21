import SwiftUI

/// ViewEventView — read-only detail view for an event/note.
/// Web parity: ViewEventDrawer.jsx — shows all filled fields + Edit button.
struct ViewEventView: View {
    @Environment(\.presentationMode) var presentationMode
    let event: ScheduleEvent
    var onEdit: (() -> Void)? = nil

    private var isEvent: Bool { event.eventType == "event" }

    private var formattedTime: String? {
        guard isEvent else { return nil }
        if event.fullDay { return "Full Day" }
        let start = (event.startDateTime ?? 0) > 0 ? DateUtils.formatTime(event.startDateTime!) : ""
        let end = (event.endDateTime ?? 0) > 0 ? DateUtils.formatTime(event.endDateTime!) : ""
        if !start.isEmpty && !end.isEmpty { return "\(start) – \(end)" }
        if !start.isEmpty { return start }
        return nil
    }

    private var formattedDate: String? {
        guard isEvent, let s = event.startDateTime, s > 0 else { return nil }
        let startD = DateUtils.formatFullDay(s)
        if let e = event.endDateTime, e > 0, e != s {
            return "\(startD) → \(DateUtils.formatFullDay(e))"
        }
        return startD
    }

    private let callTypeLabel: [String: String] = [
        "meet_in_person": "Meet In Person", "in_person": "Meet In Person",
        "audio": "Audio Call", "video": "Video Call"
    ]
    private let reminderLabel: [String: String] = [
        "at_time": "At the time of event",
        "5min": "5 minutes before", "15min": "15 minutes before",
        "30min": "30 minutes before", "1hr": "1 hour before", "1day": "1 day before"
    ]
    private let distributeLabel: [String: String] = [
        "self": "Only Me", "users": "Specific Users",
        "departments": "Specific Departments", "all_departments": "All Departments"
    ]

    var body: some View {
        VStack(spacing: 0) {
            // Header bar
            HStack {
                Button(action: { presentationMode.wrappedValue.dismiss() }) {
                    Image(systemName: "xmark").font(.system(size: 15, weight: .medium)).foregroundColor(.textMuted)
                        .frame(width: 36, height: 36)
                }
                Spacer()
                Text(isEvent ? "EVENT DETAILS" : "NOTE DETAILS")
                    .font(.system(size: 14, weight: .bold))
                    .tracking(1)
                    .foregroundColor(.textPrimary)
                Spacer()
                Color.clear.frame(width: 36, height: 36)
            }
            .padding(.horizontal, 8).padding(.vertical, 6)
            .background(Color.surfaceAlt)
            .overlay(Rectangle().frame(height: 1).foregroundColor(.appBorder), alignment: .bottom)

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    // Colored header with title + time/date
                    VStack(alignment: .leading, spacing: 4) {
                        Text(event.title)
                            .font(.custom("Georgia", size: 20)).fontWeight(.bold)
                            .foregroundColor(Color(hex: event.textColor ?? "") != .clear ? Color(hex: event.textColor ?? "#111111") : .textPrimary)
                        if let t = formattedTime {
                            Text(t).font(.system(size: 14, weight: .medium)).foregroundColor(.textMuted)
                        }
                        if let d = formattedDate {
                            Text(d).font(.system(size: 13)).foregroundColor(.textSubtle)
                        }
                    }
                    .padding(20)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.surfaceAlt)
                    .overlay(
                        Rectangle().fill(Color(hex: event.color.isEmpty ? "#3498DB" : event.color))
                            .frame(width: 4), alignment: .leading
                    )

                    // Detail rows
                    VStack(spacing: 0) {
                        if let desc = event.description, !desc.isEmpty {
                            detailRow(icon: "square.and.pencil", label: isEvent ? "Description" : "Notes", value: desc)
                        } else if !isEvent, let n = event.notes, !n.isEmpty {
                            detailRow(icon: "square.and.pencil", label: "Notes", value: n)
                        }
                        if let loc = event.location, !loc.isEmpty {
                            detailRow(icon: "mappin", label: "Location", value: loc, isLink: true, onTap: { openMap() })
                        }
                        if let ct = event.callType, !ct.isEmpty {
                            detailRow(icon: "person.2", label: "Call Type", value: callTypeLabel[ct] ?? ct)
                        }
                        if let tz = event.timezone, !tz.isEmpty {
                            detailRow(icon: "clock", label: "Timezone", value: tz.replacingOccurrences(of: "_", with: " "))
                        }
                        if !event.reminder.isEmpty && event.reminder != "none" {
                            detailRow(icon: "bell", label: "Reminder", value: reminderLabel[event.reminder] ?? event.reminder)
                        }
                        if !event.repeatStatus.isEmpty && event.repeatStatus != "none" {
                            let suffix: String = {
                                if let red = event.repeatEndDate, red > 0 {
                                    return " until \(DateUtils.formatDate(red))"
                                }
                                return ""
                            }()
                            detailRow(icon: "repeat", label: "Repeat", value: "\(event.repeatStatus.capitalized)\(suffix)")
                        }
                        if event.fullDay {
                            detailRow(icon: "calendar", label: "Duration", value: "Full Day Event")
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 4)
                    .padding(.bottom, 16)

                    if let edit = onEdit {
                        Divider().background(Color.borderLight)
                        Button(action: {
                            presentationMode.wrappedValue.dismiss()
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { edit() }
                        }) {
                            HStack(spacing: 6) {
                                Image(systemName: "pencil")
                                Text("Edit This \(isEvent ? "Event" : "Note")")
                            }
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.solidDark)
                            .frame(maxWidth: .infinity).padding(.vertical, 12)
                            .background(Color.surface)
                            .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.solidDark, lineWidth: 1))
                            .cornerRadius(6)
                        }
                        .padding(20)
                    }
                }
            }
        }
        .background(Color.pageBg.ignoresSafeArea())
    }

    private func detailRow(icon: String, label: String, value: String, isLink: Bool = false, onTap: (() -> Void)? = nil) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundColor(.textFaint)
                .frame(width: 22, alignment: .center)
                .padding(.top, 2)
            VStack(alignment: .leading, spacing: 2) {
                Text(label.uppercased())
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(0.5)
                    .foregroundColor(.textFaint)
                Button(action: { onTap?() }) {
                    Group {
                        if isLink {
                            Text(value).underline()
                        } else {
                            Text(value)
                        }
                    }
                    .font(.system(size: 14))
                    .foregroundColor(isLink ? .textLink : .textBody)
                    .multilineTextAlignment(.leading)
                }
                .buttonStyle(PlainButtonStyle())
                .disabled(onTap == nil)
            }
            Spacer()
        }
        .padding(.vertical, 12)
        .overlay(Rectangle().fill(Color.surfaceAlt2).frame(height: 1), alignment: .bottom)
    }

    private func openMap() {
        let q: String
        if let lat = event.locationLat, let lng = event.locationLng {
            q = "?q=\(lat),\(lng)"
        } else if let loc = event.location, !loc.isEmpty {
            q = "?q=\(loc.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")"
        } else { return }
        if let url = URL(string: "https://maps.apple.com/\(q)") { UIApplication.shared.open(url) }
    }
}
