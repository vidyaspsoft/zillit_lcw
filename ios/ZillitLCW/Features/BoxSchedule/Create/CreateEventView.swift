import SwiftUI

/// CreateEventView — separate page for Event or Note.
/// Pass `mode: "event"` or `mode: "note"` to show only that form.
/// If mode is nil, shows tab switcher (backward compat).
struct CreateEventView: View {
    @Environment(\.presentationMode) var presentationMode
    @ObservedObject var viewModel: BoxScheduleViewModel
    var mode: String? = nil  // "event" or "note" — hides tab switcher

    @State private var validationError: String?
    @State private var activeTab = 0
    @State private var title = ""
    @State private var description = ""
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
    @State private var noteTitle = ""
    @State private var noteText = ""
    @State private var selectedColor = "#3498DB"

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
                    // Tab picker — hidden when mode is set
                    if mode == nil {
                        Picker("", selection: $activeTab) {
                            Text("ce_event_tab".localized).tag(0)
                            Text("ce_note_tab".localized).tag(1)
                        }
                        .pickerStyle(SegmentedPickerStyle())
                    }

                    if activeTab == 0 {
                        eventForm
                    } else {
                        noteForm
                    }
                }
                .padding(20)
            }

            // Save button pinned at bottom
            Button(action: { if activeTab == 0 { saveEvent() } else { saveNote() } }) {
                Text(activeTab == 0 ? "ce_save_event".localized : "ce_save_note".localized)
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
        .navigationTitle(activeTab == 0 ? "ce_add_event".localized : "ce_add_note".localized)
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarHidden(false)
        .onAppear {
            // Set initial tab based on mode
            if mode == "note" { activeTab = 1 }
            else if mode == "event" { activeTab = 0 }
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

        var data: [String: Any] = [
            "eventType": "event",
            "title": title,
            "description": description,
            "startDate": DateUtils.toEpoch(startDate),
            "endDate": DateUtils.toEpoch(endDate),
            "fullDay": isFullDay,
            "repeat": repeatMode,
            "reminder": reminder,
            "timezone": timezone,
            "callType": callType,
            "location": location
        ]
        if !isFullDay {
            data["startTime"] = DateUtils.toEpoch(startTime)
            data["endTime"] = DateUtils.toEpoch(endTime)
        }

        viewModel.createEvent(data: data)
        presentationMode.wrappedValue.dismiss()
    }

    // MARK: - Save Note
    private func saveNote() {
        guard !noteTitle.trimmingCharacters(in: .whitespaces).isEmpty else {
            validationError = "ce_error_note_title_required".localized
            return
        }

        let data: [String: Any] = [
            "eventType": "note",
            "title": noteTitle,
            "description": noteText,
            "startDate": DateUtils.toEpoch(Date()),
            "endDate": DateUtils.toEpoch(Date()),
            "fullDay": true
        ]

        viewModel.createEvent(data: data)
        presentationMode.wrappedValue.dismiss()
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

            // Repeat
            formField(label: "ce_repeat".localized) {
                Picker("", selection: $repeatMode) {
                    ForEach(repeatOptions, id: \.0) { option in
                        Text(option.1.localized).tag(option.0)
                    }
                }
                .pickerStyle(MenuPickerStyle())
                .inputStyle()
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

            // Location
            formField(label: "ce_location".localized) {
                TextField("ce_location_hint".localized, text: $location).inputStyle()
            }

            // Distribute To
            formField(label: "ce_distribute_to".localized) {
                Text("ce_distribute_hint".localized)
                    .font(.system(size: 12))
                    .foregroundColor(.textSubtle)
            }
        }
    }

    // MARK: - Note Form
    private var noteForm: some View {
        VStack(alignment: .leading, spacing: 16) {
            formField(label: "ce_note_title_hint".localized) {
                TextField("ce_note_title_hint".localized, text: $noteTitle).inputStyle()
            }

            formField(label: "ce_note_text_hint".localized) {
                TextEditor(text: $noteText)
                    .frame(minHeight: 120)
                    .padding(8)
                    .background(Color.surface)
                    .cornerRadius(10)
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.borderInput, lineWidth: 1))
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
