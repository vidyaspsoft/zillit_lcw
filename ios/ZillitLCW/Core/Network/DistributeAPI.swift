import Foundation

/// API client for the three Distribute-To picker endpoints.
/// Lives outside APIClient because each call uses a different absolute URL
/// (project-api host for users/depts, production-api v3 for presets).
final class DistributeAPI {
    static let shared = DistributeAPI()
    private let session: URLSession
    private let decoder = JSONDecoder()

    init() {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 30
        cfg.timeoutIntervalForResource = 60
        session = URLSession(configuration: cfg)
    }

    func getProjectUsers() async throws -> [ProjectUser] {
        let url = URL(string: "\(APIConstants.projectBaseURL)/project/users")!
        let resp: ProjectUsersResponse = try await get(url)
        return resp.data ?? []
    }

    func getDepartments() async throws -> [Department] {
        let url = URL(string: "\(APIConstants.projectBaseURL)/departments")!
        let resp: DepartmentsResponse = try await get(url)
        return resp.data ?? []
    }

    func getUserPresets() async throws -> [UserPreset] {
        let url = URL(string: APIConstants.userPresetURL)!
        let resp: UserPresetsResponse = try await get(url)
        return resp.data ?? []
    }

    /// POST /api/v2/user-preset — body: { preset_name, user_ids }
    func createUserPreset(name: String, userIds: [String]) async throws {
        let url = URL(string: APIConstants.userPresetURL)!
        let body: [String: Any] = ["preset_name": name, "user_ids": userIds]
        try await post(url, body: body)
    }

    /// POST /api/v2/user-preset (same endpoint as create) with `preset_id` in
    /// the body to signal update.
    func updateUserPreset(id: String, name: String, userIds: [String]) async throws {
        let url = URL(string: APIConstants.userPresetURL)!
        let body: [String: Any] = [
            "preset_id": id,
            "preset_name": name,
            "user_ids": userIds
        ]
        try await post(url, body: body)
    }

    // MARK: - Private

    private func get<T: Decodable>(_ url: URL) async throws -> T {
        let req = makeRequest(url, method: "GET")
        let (data, response) = try await session.data(for: req)
        try ensureSuccess(response)
        return try decoder.decode(T.self, from: data)
    }

    private func post(_ url: URL, body: [String: Any]) async throws {
        var req = makeRequest(url, method: "POST")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (_, response) = try await session.data(for: req)
        try ensureSuccess(response)
    }

    private func makeRequest(_ url: URL, method: String) -> URLRequest {
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(APIConstants.accept, forHTTPHeaderField: "Accept")
        req.setValue(APIConstants.acceptCharset, forHTTPHeaderField: "Accept-Charset")
        req.setValue(APIConstants.timezone, forHTTPHeaderField: "Timezone")
        req.setValue(APIConstants.bodyhash, forHTTPHeaderField: "bodyhash")
        req.setValue(APIConstants.moduledata, forHTTPHeaderField: "moduledata")
        return req
    }

    private func ensureSuccess(_ response: URLResponse) throws {
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            throw APIError.serverError(http.statusCode, "Request failed")
        }
    }
}
