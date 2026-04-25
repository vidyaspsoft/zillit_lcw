import Foundation

struct ScheduleEvent: Identifiable, Codable {
    let id: String
    let projectId: String
    let scheduleDayId: String?
    let date: Int64
    let eventType: String // "event" or "note"
    var title: String
    var color: String
    var description: String?
    var startDateTime: Int64?
    var endDateTime: Int64?
    var fullDay: Bool
    var location: String?
    var locationLat: Double?
    var locationLng: Double?
    var reminder: String
    var repeatStatus: String
    var repeatEndDate: Int64?
    var timezone: String?
    var callType: String?
    var textColor: String?
    var notes: String?
    var distributeTo: String?
    var distributeUserIds: [String]?
    var distributeDepartmentIds: [String]?
    var userPresetId: String?
    var organizerExcluded: Bool?
    let deleted: Int64
    let createdAt: Int64
    let updatedAt: Int64

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case projectId, scheduleDayId, date, eventType, title, color
        case description, startDateTime, endDateTime, fullDay
        case location, locationLat, locationLng
        case reminder, repeatStatus, repeatEndDate, timezone, callType, textColor
        case notes
        case distributeTo, distributeUserIds, distributeDepartmentIds, userPresetId, organizerExcluded
        case deleted, createdAt, updatedAt
    }
}
