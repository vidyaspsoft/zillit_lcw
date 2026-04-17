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

    // Day lookup for calendar
    var dayLookup: [Int64: [ScheduleDay]] {
        var lookup: [Int64: [ScheduleDay]] = [:]
        for day in calendarData {
            for cd in day.calendarDays {
                let key = DateUtils.toEpoch(Calendar.current.startOfDay(for: DateUtils.fromEpoch(cd)))
                if lookup[key] == nil { lookup[key] = [] }
                lookup[key]?.append(day)
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
                let errMsg = error.localizedDescription
                if errMsg.lowercased().contains("conflict") || errMsg.contains("409") {
                    onConflict?()
                } else {
                    self.errorMessage = errMsg
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
