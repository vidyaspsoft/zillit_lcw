import SwiftUI

/// LoginView — Select Project → Select User → Auto-login
/// Matches the backend's auth flow (no email/password).
struct LoginView: View {
    @EnvironmentObject var authManager: AuthManager
    @EnvironmentObject var themeManager: ThemeManager

    var body: some View {
        ZStack {
            Color.pageBg.ignoresSafeArea()

            VStack(spacing: 0) {
                // Logo header
                VStack(spacing: 8) {
                    Image(systemName: "film.fill")
                        .font(.system(size: 36))
                        .foregroundColor(.primaryAccent)

                    Text("Zillit")
                        .font(.custom("Georgia", size: 24))
                        .fontWeight(.bold)
                        .foregroundColor(.textPrimary)

                    Text("login_title".localized)
                        .font(.system(size: 13))
                        .foregroundColor(.textMuted)
                }
                .padding(.top, 50)
                .padding(.bottom, 24)

                // Content
                if authManager.selectedProject == nil {
                    // Step 1: Project selection
                    projectSelectionView
                } else {
                    // Step 2: User selection
                    userSelectionView
                }

                Spacer()

                // Theme toggle at bottom
                Button(action: { themeManager.toggleTheme() }) {
                    Image(systemName: themeManager.isDark ? "sun.max.fill" : "moon.fill")
                        .font(.system(size: 18))
                        .foregroundColor(.textMuted)
                        .padding(10)
                        .background(Color.surfaceAlt)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(Color.appBorder, lineWidth: 1))
                }
                .padding(.bottom, 24)
            }
        }
        .onAppear {
            DispatchQueue.main.async {
                authManager.checkStoredSession()
                if !authManager.isAuthenticated {
                    authManager.fetchProjects()
                }
            }
        }
    }

    // MARK: - Step 1: Select Project
    private var projectSelectionView: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Select Project")
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(.textPrimary)
                .textCase(.uppercase)
                .padding(.horizontal, 20)

            if authManager.isLoading {
                HStack {
                    Spacer()
                    ProgressView()
                    Spacer()
                }
                .padding(.vertical, 30)
            } else if authManager.projects.isEmpty {
                Text("No projects found")
                    .font(.system(size: 13))
                    .foregroundColor(.textMuted)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 30)
            } else {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(authManager.projects) { project in
                            Button(action: {
                                authManager.fetchUsers(for: project)
                            }) {
                                HStack(spacing: 12) {
                                    Image(systemName: "folder.fill")
                                        .font(.system(size: 20))
                                        .foregroundColor(.primaryAccent)
                                        .frame(width: 40, height: 40)
                                        .background(Color.primaryAccent.opacity(0.1))
                                        .cornerRadius(10)

                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(project.name)
                                            .font(.system(size: 15, weight: .semibold))
                                            .foregroundColor(.textPrimary)

                                        Text("Tap to select")
                                            .font(.system(size: 11))
                                            .foregroundColor(.textMuted)
                                    }

                                    Spacer()

                                    Image(systemName: "chevron.right")
                                        .font(.system(size: 14))
                                        .foregroundColor(.textPlaceholder)
                                }
                                .padding(14)
                                .background(Color.surface)
                                .cornerRadius(12)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .stroke(Color.appBorder, lineWidth: 1)
                                )
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                }
            }

            // Error
            if let error = authManager.errorMessage {
                Text(error)
                    .font(.system(size: 12))
                    .foregroundColor(.dangerBg)
                    .padding(.horizontal, 20)
            }
        }
    }

    // MARK: - Step 2: Select User
    private var userSelectionView: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Back to projects
            Button(action: {
                authManager.selectedProject = nil
                authManager.users = []
            }) {
                HStack(spacing: 4) {
                    Image(systemName: "chevron.left")
                    Text(authManager.selectedProject?.name ?? "Back")
                }
                .font(.system(size: 13, weight: .medium))
                .foregroundColor(.primaryAccent)
            }
            .padding(.horizontal, 20)

            Text("Select User")
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(.textPrimary)
                .textCase(.uppercase)
                .padding(.horizontal, 20)

            if authManager.isLoading {
                HStack {
                    Spacer()
                    ProgressView()
                    Spacer()
                }
                .padding(.vertical, 30)
            } else if authManager.users.isEmpty {
                Text("No users found in this project")
                    .font(.system(size: 13))
                    .foregroundColor(.textMuted)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 30)
            } else {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(authManager.users) { user in
                            Button(action: {
                                authManager.selectUser(user)
                            }) {
                                HStack(spacing: 12) {
                                    // Avatar circle with initial
                                    Text(String(user.name.prefix(1)).uppercased())
                                        .font(.system(size: 16, weight: .bold))
                                        .foregroundColor(.primaryAccent)
                                        .frame(width: 40, height: 40)
                                        .background(Color.primaryAccent.opacity(0.1))
                                        .clipShape(Circle())

                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(user.name)
                                            .font(.system(size: 15, weight: .semibold))
                                            .foregroundColor(.textPrimary)

                                        Text(user.role.uppercased())
                                            .font(.system(size: 10, weight: .bold))
                                            .foregroundColor(user.role == "admin" ? .primaryAccent : .textMuted)
                                    }

                                    Spacer()

                                    Image(systemName: "arrow.right.circle.fill")
                                        .font(.system(size: 20))
                                        .foregroundColor(.primaryAccent.opacity(0.6))
                                }
                                .padding(14)
                                .background(Color.surface)
                                .cornerRadius(12)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .stroke(Color.appBorder, lineWidth: 1)
                                )
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                }
            }

            if let error = authManager.errorMessage {
                Text(error)
                    .font(.system(size: 12))
                    .foregroundColor(.dangerBg)
                    .padding(.horizontal, 20)
            }
        }
    }
}
