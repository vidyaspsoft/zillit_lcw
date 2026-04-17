import Foundation

struct ScheduleType: Identifiable, Codable {
    let id: String
    let projectId: String
    var title: String
    var color: String
    let systemDefined: Bool
    var order: Int
    let createdAt: Int64
    let updatedAt: Int64

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case projectId, title, color, systemDefined, order, createdAt, updatedAt
    }
}

// MARK: - Mock Data
extension ScheduleType {
    static let mockTypes: [ScheduleType] = [
        ScheduleType(id: "1", projectId: "p1", title: "Prep", color: "#F39C12", systemDefined: true, order: 0, createdAt: 0, updatedAt: 0),
        ScheduleType(id: "2", projectId: "p1", title: "Shoot", color: "#E74C3C", systemDefined: true, order: 1, createdAt: 0, updatedAt: 0),
        ScheduleType(id: "3", projectId: "p1", title: "Wrap", color: "#27AE60", systemDefined: true, order: 2, createdAt: 0, updatedAt: 0),
        ScheduleType(id: "4", projectId: "p1", title: "Day Off", color: "#95A5A6", systemDefined: true, order: 3, createdAt: 0, updatedAt: 0),
        ScheduleType(id: "5", projectId: "p1", title: "Travel", color: "#3498DB", systemDefined: true, order: 4, createdAt: 0, updatedAt: 0),
    ]
}
