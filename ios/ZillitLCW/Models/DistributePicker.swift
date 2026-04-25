import Foundation

// MARK: - Project User (for Distribute "Users" tab)

struct ProjectUser: Identifiable, Decodable, Hashable {
    let id: String
    let fullName: String
    let departmentName: String
    let designationName: String
    let isAdmin: Bool

    enum CodingKeys: String, CodingKey {
        case id = "user_id"
        case fullName = "full_name"
        case firstName = "first_name"
        case lastName = "last_name"
        case departmentName = "department_name"
        case designationName = "designation_name"
        case isAdmin = "is_admin"
        case status
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decode(String.self, forKey: .id)) ?? ""
        let full = try? c.decode(String.self, forKey: .fullName)
        if let f = full, !f.isEmpty {
            fullName = f
        } else {
            let first = (try? c.decode(String.self, forKey: .firstName)) ?? ""
            let last = (try? c.decode(String.self, forKey: .lastName)) ?? ""
            fullName = "\(first) \(last)".trimmingCharacters(in: .whitespaces)
        }
        let rawDept = (try? c.decode(String.self, forKey: .departmentName)) ?? ""
        let rawDesg = (try? c.decode(String.self, forKey: .designationName)) ?? ""
        departmentName = ProjectUser.resolveLabel(rawDept)
        designationName = ProjectUser.resolveLabel(rawDesg)
        isAdmin = (try? c.decode(Bool.self, forKey: .isAdmin)) ?? false
    }

    /// Strip the "{namespace:value}" wrapper used for localised label keys.
    static func resolveLabel(_ raw: String) -> String {
        guard !raw.isEmpty else { return "" }
        if let range = raw.range(of: #"^\{[^:]+:([^}]+)\}$"#, options: .regularExpression) {
            let inside = String(raw[range])
            // grab between the colon and closing brace
            if let colon = inside.firstIndex(of: ":"), let close = inside.lastIndex(of: "}") {
                return String(inside[inside.index(after: colon)..<close])
            }
        }
        return raw
    }
}

struct ProjectUsersResponse: Decodable {
    let status: Int?
    let message: String?
    let data: [ProjectUser]?
}

// MARK: - Department

struct Department: Identifiable, Decodable, Hashable {
    let id: String
    let name: String
    let systemDefined: Bool

    enum CodingKeys: String, CodingKey {
        case id, _id
        case departmentName = "department_name"
        case systemDefined = "system_defined"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decode(String.self, forKey: .id))
            ?? (try? c.decode(String.self, forKey: ._id))
            ?? UUID().uuidString
        let raw = (try? c.decode(String.self, forKey: .departmentName)) ?? ""
        name = ProjectUser.resolveLabel(raw)
        systemDefined = (try? c.decode(Bool.self, forKey: .systemDefined)) ?? false
    }
}

struct DepartmentsResponse: Decodable {
    let status: Int?
    let message: String?
    let data: [Department]?
}

// MARK: - User Preset

struct PresetMember: Decodable, Hashable {
    let userId: String
    let fullName: String
    let designation: String

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case fullName = "full_name"
        case designation
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        userId = (try? c.decode(String.self, forKey: .userId)) ?? ""
        fullName = (try? c.decode(String.self, forKey: .fullName)) ?? ""
        let raw = (try? c.decode(String.self, forKey: .designation)) ?? ""
        designation = ProjectUser.resolveLabel(raw)
    }
}

struct UserPreset: Identifiable, Decodable, Hashable {
    let id: String
    let name: String
    let members: [PresetMember]
    var memberCount: Int { members.count }

    enum CodingKeys: String, CodingKey {
        case id, _id
        case presetName = "preset_name"
        case users
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decode(String.self, forKey: .id))
            ?? (try? c.decode(String.self, forKey: ._id))
            ?? UUID().uuidString
        name = (try? c.decode(String.self, forKey: .presetName)) ?? ""
        members = (try? c.decode([PresetMember].self, forKey: .users)) ?? []
    }
}

struct UserPresetsResponse: Decodable {
    let status: Int?
    let message: String?
    let data: [UserPreset]?
}

// MARK: - Distribute selection (returned from picker)

struct DistributeSelection: Equatable {
    var distributeTo: String       // "" | "self" | "all_departments" | "departments" | "users" | "presets"
    var userIds: [String]
    var departmentIds: [String]
    var presetId: String?

    var summary: String {
        switch distributeTo {
        case "self": return "Only Me"
        case "all_departments": return "All Departments"
        case "departments":
            return departmentIds.isEmpty
                ? "Selected Departments"
                : "Selected Departments: \(departmentIds.count)"
        case "users":
            let n = userIds.count
            return n == 0 ? "Users" : "\(n) user\(n == 1 ? "" : "s") selected — tap to edit"
        case "presets": return "Preset"
        default: return ""
        }
    }

    static let empty = DistributeSelection(distributeTo: "", userIds: [], departmentIds: [], presetId: nil)
}
