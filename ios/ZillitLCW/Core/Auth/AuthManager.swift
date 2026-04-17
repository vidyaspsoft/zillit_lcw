import Foundation
import Combine

/// Project model from GET /api/v2/auth/projects
struct Project: Identifiable, Codable {
    let id: String
    let name: String

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case name
    }
}

/// User model from GET /api/v2/auth/projects/:projectId/users
struct AppUser: Identifiable, Codable {
    let id: String
    let name: String
    let role: String
    let projectId: String

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case name, role, projectId
    }
}

/// AuthManager — manages authentication state.
/// Login flow: Select Project → Select User → Auto-login
class AuthManager: ObservableObject {
    static let shared = AuthManager()

    // Auth base URL (NOT box-schedule)
    private let authBaseURL = "http://localhost:5003/api/v2/auth"

    @Published var isAuthenticated = false
    @Published var isLoading = false
    @Published var errorMessage: String?

    // Project/User selection
    @Published var projects: [Project] = []
    @Published var users: [AppUser] = []
    @Published var selectedProject: Project? = nil

    // Stored credentials
    var userId: String = ""
    var projectId: String = ""
    var deviceId: String = UUID().uuidString
    var userName: String = ""

    // MARK: - Fetch Projects

    func fetchProjects() {
        isLoading = true
        errorMessage = nil

        guard let url = URL(string: "\(authBaseURL)/projects") else { return }

        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            DispatchQueue.main.async {
                self?.isLoading = false

                if let error = error {
                    self?.errorMessage = error.localizedDescription
                    return
                }

                guard let data = data else {
                    self?.errorMessage = "No data received"
                    return
                }

                do {
                    let decoded = try JSONDecoder().decode(APIResponse<[Project]>.self, from: data)
                    self?.projects = decoded.data ?? []
                } catch {
                    self?.errorMessage = "Failed to parse projects"
                    print("[Auth] Decode error: \(error)")
                }
            }
        }.resume()
    }

    // MARK: - Fetch Users for a Project

    func fetchUsers(for project: Project) {
        selectedProject = project
        isLoading = true
        users = []

        guard let url = URL(string: "\(authBaseURL)/projects/\(project.id)/users") else { return }

        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            DispatchQueue.main.async {
                self?.isLoading = false

                if let error = error {
                    self?.errorMessage = error.localizedDescription
                    return
                }

                guard let data = data else { return }

                do {
                    let decoded = try JSONDecoder().decode(APIResponse<[AppUser]>.self, from: data)
                    self?.users = decoded.data ?? []
                } catch {
                    self?.errorMessage = "Failed to parse users"
                    print("[Auth] Decode error: \(error)")
                }
            }
        }.resume()
    }

    // MARK: - Select User → Auto-login

    func selectUser(_ user: AppUser) {
        userId = user.id
        projectId = user.projectId
        userName = user.name

        // Persist to UserDefaults
        UserDefaults.standard.set(userId, forKey: "user_id")
        UserDefaults.standard.set(projectId, forKey: "project_id")
        UserDefaults.standard.set(userName, forKey: "user_name")
        UserDefaults.standard.set(deviceId, forKey: "device_id")

        isAuthenticated = true
    }

    // MARK: - Logout

    func logout() {
        isAuthenticated = false
        userId = ""
        projectId = ""
        userName = ""
        selectedProject = nil
        users = []
        errorMessage = nil

        UserDefaults.standard.removeObject(forKey: "user_id")
        UserDefaults.standard.removeObject(forKey: "project_id")
    }

    // MARK: - Check stored session

    func checkStoredSession() {
        if let storedUserId = UserDefaults.standard.string(forKey: "user_id"),
           let storedProjectId = UserDefaults.standard.string(forKey: "project_id"),
           !storedUserId.isEmpty, !storedProjectId.isEmpty {
            userId = storedUserId
            projectId = storedProjectId
            userName = UserDefaults.standard.string(forKey: "user_name") ?? ""
            deviceId = UserDefaults.standard.string(forKey: "device_id") ?? UUID().uuidString
            isAuthenticated = true
        }
    }
}
