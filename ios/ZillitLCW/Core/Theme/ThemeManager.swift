import SwiftUI
import Combine

/// ThemeManager — global dark/light theme state.
/// Shares the same conceptual key as the web app ('cnc-theme').
/// Default: dark (matches CNC module).
class ThemeManager: ObservableObject {
    static let shared = ThemeManager()

    private let storageKey = "cnc-theme"

    @Published var themeMode: String {
        didSet {
            UserDefaults.standard.set(themeMode, forKey: storageKey)
        }
    }

    var isDark: Bool { themeMode == "dark" }

    var colorScheme: ColorScheme { isDark ? .dark : .light }

    init() {
        let saved = UserDefaults.standard.string(forKey: storageKey)
        self.themeMode = saved ?? "dark" // Default: dark
    }

    func toggleTheme() {
        themeMode = isDark ? "light" : "dark"
    }

    func setTheme(_ mode: String) {
        themeMode = mode
    }
}
