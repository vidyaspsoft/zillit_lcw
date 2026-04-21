import Foundation
import Combine

/// BoxScheduleViewModel — manages Box Schedule state.
/// Connected to real API via BoxScheduleAPI.
class BoxScheduleViewModel: ObservableObject {

    private let api = BoxScheduleAPI.shared

    @Published var scheduleTypes: [ScheduleType] = []
    @Published var scheduleDays: [ScheduleDay] = []
    @Published var calendarData: [ScheduleDay] = []
    @Published var activityLogs: [ActivityLog] = []
    @Published var revisions: [Revision] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    @Published var activeView: String = "calendar"
    @Published var calendarMode: String = "month"
    @Published var listMode: String = "by_date"

    // ── Shared filters (applied to both List + Calendar views) ──
    @Published var filterSearchText: String = ""
    @Published var filterTypeName: String = ""      // "" = All Types
    @Published var filterContentKind: String = "all" // "all" | "schedules" | "events" | "notes"

    /// Apply filters to a ScheduleDay list — reused by List view + Calendar cells.
    func matchesFilters(_ day: ScheduleDay) -> Bool {
        if !filterTypeName.isEmpty && day.typeName != filterTypeName { return false }
        let q = filterSearchText.trimmingCharacters(in: .whitespaces).lowercased()
        if q.isEmpty { return true }
        let hay = "\(day.title) \(day.typeName)".lowercased()
        return hay.contains(q)
    }

    /// Apply content-kind + search filters to a single event/note.
    func matchesFilters(_ evt: ScheduleEvent) -> Bool {
        let kind: String = (evt.eventType == "note") ? "notes" : "events"
        if filterContentKind != "all" && filterContentKind != kind { return false }
        let q = filterSearchText.trimmingCharacters(in: .whitespaces).lowercased()
        if q.isEmpty { return true }
        let hay = "\(evt.title) \(evt.description ?? "") \(evt.notes ?? "")".lowercased()
        return hay.contains(q)
    }

    var showSchedulesInView: Bool { filterContentKind == "all" || filterContentKind == "schedules" }
    var showEventsInView:    Bool { filterContentKind == "all" || filterContentKind == "events" }
    var showNotesInView:     Bool { filterContentKind == "all" || filterContentKind == "notes" }

    // Sheet/Drawer states
    @Published var showDrawer = false
    @Published var showDayDetail = false
    @Published var showHistory = false
    @Published var showShare = false
    @Published var showTypeManager = false
    @Published var showCreateSchedule = false
    @Published var showCreateEvent = false
    @Published var showCreateNote = false

    // Calendar navigation
    @Published var currentMonth = Date()
    @Published var currentDay = Date()
    @Published var selectedDayKey: Int64? = nil

    // Day lookup for calendar — respects the shared filters (Type / Search always;
    // Show controls whether the cell renders schedule pills, not whether the ScheduleDay
    // appears here — we still need it so nested events/notes can render even when pills are hidden).
    var dayLookup: [Int64: [ScheduleDay]] {
        var lookup: [Int64: [ScheduleDay]] = [:]
        for day in calendarData {
            guard matchesFilters(day) else { continue }
            // Strip nested events/notes the user chose to hide, so cells don't leak them.
            var filtered = day
            if !showEventsInView { filtered.events = nil }
            if !showNotesInView  { filtered.notes  = nil }
            // When Show excludes schedules, only keep days that still have visible nested content.
            let hasVisibleContent = (filtered.events?.isEmpty == false) || (filtered.notes?.isEmpty == false)
            if !showSchedulesInView && !hasVisibleContent { continue }
            for cd in day.calendarDays {
                let key = DateUtils.toEpoch(Calendar.current.startOfDay(for: DateUtils.fromEpoch(cd)))
                if lookup[key] == nil { lookup[key] = [] }
                lookup[key]?.append(filtered)
            }
        }
        return lookup
    }

    var visibleTypes: [ScheduleType] { Array(scheduleTypes.prefix(5)) }
    var hiddenTypeCount: Int { max(0, scheduleTypes.count - 5) }

    // MARK: - Load All Data

    func loadAll() {
        Task { @MainActor in
            isLoading = true
            errorMessage = nil

            do {
                async let typesTask = api.getTypes()
                async let daysTask = api.getDays()
                async let calendarTask = api.getCalendar()

                let (types, days, calendar) = try await (typesTask, daysTask, calendarTask)
                self.scheduleTypes = types
                self.scheduleDays = days
                self.calendarData = calendar
            } catch {
                self.errorMessage = error.localizedDescription
                print("[BoxScheduleVM] ❌ loadAll failed: \(error)")
            }

            isLoading = false
        }
    }

    // MARK: - Types

    func fetchTypes() {
        Task { @MainActor in
            do {
                self.scheduleTypes = try await api.getTypes()
            } catch {
                print("[BoxScheduleVM] ❌ fetchTypes: \(error)")
            }
        }
    }

    func createType(title: String, color: String) {
        Task { @MainActor in
            do {
                let _ = try await api.createType(title: title, color: color)
                fetchTypes()
            } catch {
                self.errorMessage = error.localizedDescription
            }
        }
    }

    func updateType(id: String, title: String? = nil, color: String? = nil) {
        Task { @MainActor in
            do {
                let _ = try await api.updateType(id: id, title: title, color: color)
                fetchTypes()
            } catch {
                self.errorMessage = error.localizedDescription
            }
        }
    }

    func deleteType(id: String) {
        Task { @MainActor in
            do {
                try await api.deleteType(id: id)
                fetchTypes()
            } catch {
                self.errorMessage = error.localizedDescription
            }
        }
    }

    // MARK: - Days

    func fetchDays() {
        Task { @MainActor in
            do {
                self.scheduleDays = try await api.getDays()
            } catch {
                print("[BoxScheduleVM] ❌ fetchDays: \(error)")
            }
        }
    }

    func createDay(title: String, typeId: String, dateRangeType: String, calendarDays: [Int64], conflictAction: String = "", onConflict: (() -> Void)? = nil, onSuccess: (() -> Void)? = nil) {
        Task { @MainActor in
            do {
                let _ = try await api.createDay(
                    title: title, typeId: typeId, dateRangeType: dateRangeType,
                    calendarDays: calendarDays, conflictAction: conflictAction
                )
                refreshAll()
                onSuccess?()
            } catch {
                // HTTP 409 only — routed by APIError.conflict (thrown in APIClient when statusCode == 409)
                if case APIError.conflict = error {
                    onConflict?()
                } else {
                    self.errorMessage = error.localizedDescription
                }
            }
        }
    }

    func deleteDay(id: String) {
        Task { @MainActor in
            do {
                try await api.deleteDay(id: id)
                refreshAll()
            } catch {
                self.errorMessage = error.localizedDescription
            }
        }
    }

    /// Update an existing schedule day (PUT /days/:id). Handles 409 via onConflict.
    func updateDay(id: String, typeId: String, dateRangeType: String, calendarDays: [Int64], title: String = "", conflictAction: String = "", onConflict: (() -> Void)? = nil, onSuccess: (() -> Void)? = nil) {
        Task { @MainActor in
            do {
                var body: [String: Any] = [
                    "title": title,
                    "typeId": typeId,
                    "dateRangeType": dateRangeType,
                    "calendarDays": calendarDays,
                    "startDate": calendarDays.min() ?? 0,
                    "endDate": calendarDays.max() ?? 0,
                    "numberOfDays": calendarDays.count
                ]
                if !conflictAction.isEmpty { body["conflictAction"] = conflictAction }
                _ = try await api.updateDay(id: id, data: body)
                refreshAll()
                onSuccess?()
            } catch {
                if case APIError.conflict = error {
                    onConflict?()
                } else {
                    self.errorMessage = error.localizedDescription
                }
            }
        }
    }

    /// Update an existing event/note (PUT /events/:id).
    func updateEvent(id: String, data: [String: Any]) {
        Task { @MainActor in
            do {
                _ = try await api.updateEvent(id: id, data: data)
                refreshAll()
            } catch {
                self.errorMessage = error.localizedDescription
            }
        }
    }

    /// Atomic single-day edit (PUT /days/:id/single-date). Backend handles the split.
    func executeSingleDayEdit(oldDayId: String, singleDate: Int64, originalTypeId: String, newTypeId: String, action: String, onConflict: (() -> Void)? = nil, onSuccess: (() -> Void)? = nil) {
        Task { @MainActor in
            do {
                // Same type — nothing to do (parity with web)
                if originalTypeId == newTypeId {
                    refreshAll()
                    onSuccess?()
                    return
                }
                try await api.updateSingleDay(id: oldDayId, date: singleDate, typeId: newTypeId, action: action)
                refreshAll()
                onSuccess?()
            } catch {
                if case APIError.conflict = error {
                    onConflict?()
                } else {
                    self.errorMessage = error.localizedDescription
                }
            }
        }
    }

    /// Remove specific calendar dates from one or more schedule days (web /days/remove-dates).
    func removeDates(entries: [(id: String, dates: [Int64])]) {
        Task { @MainActor in
            do {
                let payload: [[String: Any]] = entries.map { e in
                    ["id": e.id, "dates": e.dates]
                }
                try await api.removeDates(entries: payload)
                refreshAll()
            } catch {
                self.errorMessage = error.localizedDescription
            }
        }
    }

    func duplicateDay(sourceDayId: String, newStartDate: Int64) {
        Task { @MainActor in
            do {
                let _ = try await api.duplicateDay(sourceDayId: sourceDayId, newStartDate: newStartDate)
                refreshAll()
            } catch {
                self.errorMessage = error.localizedDescription
            }
        }
    }

    // MARK: - Events

    func createEvent(data: [String: Any]) {
        Task { @MainActor in
            do {
                let _ = try await api.createEvent(data: data)
                refreshAll()
            } catch {
                self.errorMessage = error.localizedDescription
            }
        }
    }

    func deleteEvent(id: String) {
        Task { @MainActor in
            do {
                try await api.deleteEvent(id: id)
                refreshAll()
            } catch {
                self.errorMessage = error.localizedDescription
            }
        }
    }

    // MARK: - Calendar

    func fetchCalendar() {
        Task { @MainActor in
            do {
                self.calendarData = try await api.getCalendar()
            } catch {
                print("[BoxScheduleVM] ❌ fetchCalendar: \(error)")
            }
        }
    }

    // MARK: - Activity Log

    func fetchActivityLog() {
        Task { @MainActor in
            do {
                let result = try await api.getActivityLog()
                self.activityLogs = result.logs
            } catch {
                print("[BoxScheduleVM] ❌ fetchActivityLog: \(error)")
            }
        }
    }

    // MARK: - Revisions

    func fetchRevisions() {
        Task { @MainActor in
            do {
                self.revisions = try await api.getRevisions()
            } catch {
                print("[BoxScheduleVM] ❌ fetchRevisions: \(error)")
            }
        }
    }

    // MARK: - Share

    func generateShareLink(completion: @escaping (String?) -> Void) {
        Task { @MainActor in
            do {
                let result = try await api.generateShareLink()
                completion(result?.shareUrl)
            } catch {
                self.errorMessage = error.localizedDescription
                completion(nil)
            }
        }
    }

    // MARK: - Refresh

    func refreshAll() {
        Task { @MainActor in
            do {
                async let daysTask = api.getDays()
                async let calendarTask = api.getCalendar()
                let (days, calendar) = try await (daysTask, calendarTask)
                self.scheduleDays = days
                self.calendarData = calendar
            } catch {
                print("[BoxScheduleVM] ❌ refreshAll: \(error)")
            }
        }
    }
}
