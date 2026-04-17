import Foundation

struct ScheduleDay: Identifiable, Codable {
    let id: String
    let projectId: String
    var title: String
    let typeId: String
    var typeName: String
    var color: String
    let dateRangeType: String
    var startDate: Int64
    var endDate: Int64
    var numberOfDays: Int
    var calendarDays: [Int64]
    let timezone: String
    var version: Int
    let deleted: Int64
    let createdAt: Int64
    let updatedAt: Int64
    // Nested from /calendar endpoint
    var events: [ScheduleEvent]?
    var notes: [ScheduleEvent]?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case projectId, title, typeId, typeName, color, dateRangeType
        case startDate, endDate, numberOfDays, calendarDays, timezone
        case version, deleted, createdAt, updatedAt, events, notes
    }
}

// MARK: - Mock Data
extension ScheduleDay {
    static let mockDays: [ScheduleDay] = {
        let apr12: Int64 = 1744416000000
        let oneDay: Int64 = 86400000
        return [
            ScheduleDay(
                id: "d1", projectId: "p1", title: "Beach Week", typeId: "2", typeName: "Shoot", color: "#E74C3C",
                dateRangeType: "by_days", startDate: apr12 + 2*oneDay, endDate: apr12 + 3*oneDay,
                numberOfDays: 2, calendarDays: [apr12 + 2*oneDay, apr12 + 3*oneDay],
                timezone: "UTC", version: 1, deleted: 0, createdAt: apr12, updatedAt: apr12,
                events: nil, notes: nil
            ),
            ScheduleDay(
                id: "d2", projectId: "p1", title: "", typeId: "3", typeName: "Wrap", color: "#27AE60",
                dateRangeType: "by_days", startDate: apr12, endDate: apr12 + 5*oneDay,
                numberOfDays: 6, calendarDays: [apr12, apr12+oneDay, apr12+2*oneDay, apr12+3*oneDay, apr12+4*oneDay, apr12+5*oneDay],
                timezone: "UTC", version: 1, deleted: 0, createdAt: apr12, updatedAt: apr12,
                events: nil, notes: nil
            ),
        ]
    }()
}
