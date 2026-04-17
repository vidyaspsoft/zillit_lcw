import Foundation

struct ActivityLog: Identifiable, Codable {
    let id: String
    let projectId: String
    let action: String // created, updated, deleted, duplicated, shared
    let targetType: String // schedule_day, schedule_type, event, note
    let targetId: String
    let targetTitle: String
    let details: String
    let performedBy: PerformedBy
    let createdAt: Int64

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case projectId, action, targetType, targetId, targetTitle, details, performedBy, createdAt
    }
}

struct PerformedBy: Codable {
    let userId: String
    let name: String
}
