import SwiftUI

@main
struct ZillitLCWApp: App {
    @StateObject private var themeManager = ThemeManager.shared
    @StateObject private var authManager = AuthManager.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(themeManager)
                .environmentObject(authManager)
                .preferredColorScheme(themeManager.colorScheme)
        }
    }
}
