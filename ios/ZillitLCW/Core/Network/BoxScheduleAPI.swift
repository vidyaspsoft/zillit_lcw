import Foundation

/// BoxScheduleAPI — all Box Schedule endpoints.
/// Uses APIClient for HTTP calls with auto-injected moduledata header.
/// All write endpoints identify the user via moduledata (userId). Display name
/// is resolved client-side from the local users cache.
class BoxScheduleAPI {
    static let shared = BoxScheduleAPI()

    private let client = APIClient.shared

    // ═══════════════════════ SCHEDULE TYPES ═══════════════════════

    func getTypes() async throws -> [ScheduleType] {
        let response: APIResponse<[ScheduleType]> = try await client.request(path: "/types")
        return response.data ?? []
    }

    func createType(title: String, color: String) async throws -> ScheduleType? {
        let response: APIResponse<ScheduleType> = try await client.request(
            path: "/types", method: "POST",
            body: ["title": title, "color": color]
        )
        return response.data
    }

    func updateType(id: String, title: String? = nil, color: String? = nil) async throws -> ScheduleType? {
        var body: [String: Any] = [:]
        if let t = title { body["title"] = t }
        if let c = color { body["color"] = c }
        let response: APIResponse<ScheduleType> = try await client.request(
            path: "/types/\(id)", method: "PUT", body: body
        )
        return response.data
    }

    func deleteType(id: String) async throws {
        let _: APIResponse<EmptyData> = try await client.request(
            path: "/types/\(id)", method: "DELETE"
        )
    }

    // ═══════════════════════ SCHEDULE DAYS ═══════════════════════

    func getDays(startDate: Int64? = nil, endDate: Int64? = nil, typeId: String? = nil) async throws -> [ScheduleDay] {
        var params: [String: String] = [:]
        if let s = startDate { params["startDate"] = "\(s)" }
        if let e = endDate { params["endDate"] = "\(e)" }
        if let t = typeId { params["typeId"] = t }
        let response: APIResponse<[ScheduleDay]> = try await client.request(
            path: "/days", queryParams: params
        )
        return response.data ?? []
    }

    func createDay(
        title: String, typeId: String, dateRangeType: String,
        calendarDays: [Int64], timezone: String = "UTC",
        conflictAction: String = ""
    ) async throws -> ScheduleDay? {
        let body: [String: Any] = [
            "title": title, "typeId": typeId, "dateRangeType": dateRangeType,
            "calendarDays": calendarDays,
            "startDate": calendarDays.min() ?? 0,
            "endDate": calendarDays.max() ?? 0,
            "numberOfDays": calendarDays.count,
            "timezone": timezone,
            "conflictAction": conflictAction
        ]
        let response: APIResponse<ScheduleDay> = try await client.request(
            path: "/days", method: "POST", body: body
        )
        return response.data
    }

    func updateDay(id: String, data: [String: Any]) async throws -> ScheduleDay? {
        let response: APIResponse<ScheduleDay> = try await client.request(
            path: "/days/\(id)", method: "PUT", body: data
        )
        return response.data
    }

    /// Atomic single-day type change — PUT /days/:id/single-date.
    func updateSingleDay(id: String, date: Int64, typeId: String, action: String) async throws {
        let _: APIResponse<EmptyData> = try await client.request(
            path: "/days/\(id)/single-date", method: "PUT",
            body: ["date": date, "typeId": typeId, "action": action]
        )
    }

    func deleteDay(id: String) async throws {
        let _: APIResponse<EmptyData> = try await client.request(
            path: "/days/\(id)", method: "DELETE"
        )
    }

    func bulkUpdateDays(updates: [[String: Any]]) async throws -> [ScheduleDay] {
        let response: APIResponse<[ScheduleDay]> = try await client.request(
            path: "/days/bulk", method: "POST",
            body: ["updates": updates]
        )
        return response.data ?? []
    }

    func removeDates(entries: [[String: Any]]) async throws {
        let _: APIResponse<EmptyData> = try await client.request(
            path: "/days/remove-dates", method: "POST",
            body: ["entries": entries]
        )
    }

    func duplicateDay(sourceDayId: String, newStartDate: Int64) async throws -> ScheduleDay? {
        let response: APIResponse<ScheduleDay> = try await client.request(
            path: "/days/duplicate", method: "POST",
            body: ["sourceDayId": sourceDayId, "newStartDate": newStartDate]
        )
        return response.data
    }

    // ═══════════════════════ EVENTS ═══════════════════════

    func getEvents(
        startDate: Int64? = nil, endDate: Int64? = nil,
        scheduleDayId: String? = nil, eventType: String? = nil
    ) async throws -> [ScheduleEvent] {
        var params: [String: String] = [:]
        if let s = startDate { params["startDate"] = "\(s)" }
        if let e = endDate { params["endDate"] = "\(e)" }
        if let d = scheduleDayId { params["scheduleDayId"] = d }
        if let t = eventType { params["eventType"] = t }
        let response: APIResponse<[ScheduleEvent]> = try await client.request(
            path: "/events", queryParams: params
        )
        return response.data ?? []
    }

    func createEvent(data: [String: Any]) async throws -> ScheduleEvent? {
        let response: APIResponse<ScheduleEvent> = try await client.request(
            path: "/events", method: "POST", body: data
        )
        return response.data
    }

    func updateEvent(id: String, data: [String: Any]) async throws -> ScheduleEvent? {
        let response: APIResponse<ScheduleEvent> = try await client.request(
            path: "/events/\(id)", method: "PUT", body: data
        )
        return response.data
    }

    func deleteEvent(id: String) async throws {
        let _: APIResponse<EmptyData> = try await client.request(
            path: "/events/\(id)", method: "DELETE"
        )
    }

    // ═══════════════════════ CALENDAR ═══════════════════════

    func getCalendar(startDate: Int64? = nil, endDate: Int64? = nil) async throws -> [ScheduleDay] {
        var params: [String: String] = [:]
        if let s = startDate { params["startDate"] = "\(s)" }
        if let e = endDate { params["endDate"] = "\(e)" }
        let response: APIResponse<[ScheduleDay]> = try await client.request(
            path: "/calendar", queryParams: params
        )
        return response.data ?? []
    }

    // ═══════════════════════ ACTIVITY LOG ═══════════════════════

    struct ActivityLogData: Codable {
        let logs: [ActivityLog]
        let total: Int
        let page: Int
        let limit: Int
    }

    func getActivityLog(limit: Int = 50, page: Int = 0) async throws -> ActivityLogData {
        let response: APIResponse<ActivityLogData> = try await client.request(
            path: "/activity-log",
            queryParams: ["limit": "\(limit)", "page": "\(page)"]
        )
        return response.data ?? ActivityLogData(logs: [], total: 0, page: 0, limit: limit)
    }

    // ═══════════════════════ REVISIONS ═══════════════════════

    func getRevisions() async throws -> [Revision] {
        let response: APIResponse<[Revision]> = try await client.request(path: "/revisions")
        return response.data ?? []
    }

    func getCurrentRevision() async throws -> Revision? {
        let response: APIResponse<Revision> = try await client.request(path: "/revisions/current")
        return response.data
    }

    // ═══════════════════════ SHARE ═══════════════════════

    struct ShareLinkData: Codable {
        let token: String
        let shareUrl: String
        let attachment: Attachment?
    }

    /// POST /share/generate-link — backend renders a PDF, uploads to S3,
    /// and returns the share token + an Attachment with presigned URLs.
    ///
    /// All body fields are optional. When `watermark` is provided, both `text`
    /// and `image` may be set; the server overlays them on every page.
    func generateShareLink(
        dayIds: [String]? = nil,
        from: Int64? = nil,
        to: Int64? = nil,
        orientation: String = "landscape",
        title: String? = nil,
        watermark: [String: Any]? = nil
    ) async throws -> ShareLinkData? {
        var body: [String: Any] = ["orientation": orientation]
        if let ids = dayIds { body["dayIds"] = ids }
        if let f = from { body["from"] = f }
        if let t = to { body["to"] = t }
        if let title = title { body["title"] = title }
        if let wm = watermark { body["watermark"] = wm }

        let response: APIResponse<ShareLinkData> = try await client.request(
            path: "/share/generate-link", method: "POST",
            body: body
        )
        return response.data
    }

    struct SharedScheduleData: Codable {
        let projectId: String
        let days: [ScheduleDay]
        let events: [ScheduleEvent]
        let types: [ScheduleType]
    }

    func getSharedSchedule(token: String) async throws -> SharedScheduleData? {
        let response: APIResponse<SharedScheduleData> = try await client.request(
            path: "/share/\(token)"
        )
        return response.data
    }
}

// MARK: - Empty response helper
struct EmptyData: Codable {}
