import Foundation

/// APIClient — singleton HTTP client with:
/// - Auto-injected `moduledata` header (AES-256-CBC encrypted)
/// - Request/response logging to Console
/// - Generic request method returning Codable types
class APIClient {
    static let shared = APIClient()

    let baseURL = "http://localhost:5003/api/v2/box-schedule"

    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        self.session = URLSession(configuration: config)
        self.decoder = JSONDecoder()
        self.encoder = JSONEncoder()
    }

    // MARK: - Generic Request

    /// Execute an API request with logging and auth header.
    func request<T: Decodable>(
        path: String,
        method: String = "GET",
        body: [String: Any]? = nil,
        queryParams: [String: String]? = nil
    ) async throws -> APIResponse<T> {

        // Build URL with query params
        var urlString = "\(baseURL)\(path)"
        if let params = queryParams, !params.isEmpty {
            let query = params.map { "\($0.key)=\($0.value)" }.joined(separator: "&")
            urlString += "?\(query)"
        }

        guard let url = URL(string: urlString) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        // Inject moduledata auth header
        let auth = AuthManager.shared
        if !auth.userId.isEmpty {
            if let moduleData = EncryptionUtil.buildModuleDataHeader(
                userId: auth.userId,
                projectId: auth.projectId,
                deviceId: auth.deviceId
            ) {
                request.setValue(moduleData, forHTTPHeaderField: "moduledata")
                log("🔐 moduledata header injected (\(moduleData.count) chars)")
            }
        }

        // Set body
        if let body = body {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        // Log request
        log("📡 \(method) \(path)")
        if let body = body {
            log("   Body: \(body)")
        }

        // Execute
        let (data, response) = try await session.data(for: request)

        // Log response
        if let httpResponse = response as? HTTPURLResponse {
            let statusEmoji = (200...299).contains(httpResponse.statusCode) ? "✅" : "❌"
            log("\(statusEmoji) \(httpResponse.statusCode) \(path)")
        }
        if let responseString = String(data: data, encoding: .utf8) {
            let preview = responseString.prefix(500)
            log("   Response: \(preview)\(responseString.count > 500 ? "..." : "")")
        }

        // Check HTTP status BEFORE decoding (409 conflict has different data shape)
        if let httpResponse = response as? HTTPURLResponse {
            if httpResponse.statusCode == 409 {
                throw APIError.conflict
            }
            if httpResponse.statusCode == 401 {
                throw APIError.unauthorized
            }
            if !(200...299).contains(httpResponse.statusCode) {
                // Try to extract error message from response
                if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let message = json["message"] as? String {
                    throw APIError.serverError(httpResponse.statusCode, message)
                }
                throw APIError.serverError(httpResponse.statusCode, "Request failed")
            }
        }

        // Decode only on success (2xx)
        return try decoder.decode(APIResponse<T>.self, from: data)
    }

    // MARK: - Logging

    private func log(_ message: String) {
        #if DEBUG
        print("[APIClient] \(message)")
        #endif
    }
}

// MARK: - API Error

enum APIError: Error, LocalizedError {
    case invalidURL
    case unauthorized
    case conflict       // 409 — schedule date conflict
    case serverError(Int, String)
    case decodingError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL"
        case .unauthorized: return "Unauthorized — please log in again"
        case .conflict: return "Schedule date conflict"  // UI routes via type check (APIError.conflict), not this string
        case .serverError(let code, let msg): return "Server error \(code): \(msg)"
        case .decodingError(let err): return "Failed to parse response: \(err.localizedDescription)"
        }
    }
}
