import Foundation

struct Revision: Identifiable, Codable {
    let id: String
    let projectId: String
    let revisionNumber: Int
    let revisionColor: String
    let typeColor: String
    let description: String
    let changedBy: PerformedBy
    let createdAt: Int64

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case projectId, revisionNumber, revisionColor, typeColor, description, changedBy, createdAt
    }
}
