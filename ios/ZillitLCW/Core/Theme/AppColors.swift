import SwiftUI
import UIKit

// MARK: - Semantic Color Extension
// All colors are defined as named colors that automatically switch
// between light and dark values based on the system appearance.
// For iOS 14 compatibility, we use programmatic adaptive colors.

extension Color {
    // MARK: - Brand
    static let primaryAccent = Color(UIColor.primaryAccent)

    // MARK: - Surfaces
    static let pageBg = Color(UIColor.pageBg)
    static let surface = Color(UIColor.surface)
    static let surfaceAlt = Color(UIColor.surfaceAlt)
    static let surfaceAlt2 = Color(UIColor.surfaceAlt2)
    static let surfaceHover = Color(UIColor.surfaceHover)
    static let surfaceSelected = Color(UIColor.surfaceSelected)
    static let surfaceExpanded = Color(UIColor.surfaceExpanded)
    static let surfaceMuted = Color(UIColor.surfaceMuted)
    static let surfaceWarning = Color(UIColor.surfaceWarning)
    static let surfaceNoteCard = Color(UIColor.surfaceNoteCard)
    static let surfaceNoteCardBorder = Color(UIColor.surfaceNoteCardBorder)

    // MARK: - Borders
    static let appBorder = Color(UIColor.appBorder)
    static let borderLight = Color(UIColor.borderLight)
    static let borderMedium = Color(UIColor.borderMedium)
    static let borderButton = Color(UIColor.borderButton)
    static let borderInput = Color(UIColor.borderInput)
    static let borderDashed = Color(UIColor.borderDashed)

    // MARK: - Text
    static let textPrimary = Color(UIColor.textPrimary)
    static let textBody = Color(UIColor.textBody)
    static let textSecondary = Color(UIColor.textSecondary)
    static let textMuted = Color(UIColor.textMuted)
    static let textSubtle = Color(UIColor.textSubtle)
    static let textFaint = Color(UIColor.textFaint)
    static let textPlaceholder = Color(UIColor.textPlaceholder)
    static let textDisabled = Color(UIColor.textDisabled)
    static let textLink = Color(UIColor.textLink)

    // MARK: - Solid
    static let solidDark = Color(UIColor.solidDark)
    static let solidDarkText = Color(UIColor.solidDarkText)
    static let dangerBg = Color(UIColor.dangerBg)
    static let successText = Color(UIColor.successText)

    // MARK: - Calendar
    static let calTodayBg = Color(UIColor.calTodayBg)
    static let calTodayText = Color(UIColor.calTodayText)
    static let calWeekendBg = Color(UIColor.calWeekendBg)
    static let surfaceHoverBlue = Color(UIColor.surfaceHoverBlue)
    static let calCellSelected = Color(UIColor.calCellSelected)

    // MARK: - History Actions
    static let actionAdded = Color(hex: "#27AE60")
    static let actionChanged = Color(hex: "#3498DB")
    static let actionRemoved = Color(hex: "#E74C3C")
    static let actionCopied = Color(hex: "#8E44AD")
    static let actionShared = Color(hex: "#F39C12")

    // MARK: - Drawer
    static let drawerHeaderBg = Color(UIColor.drawerHeaderBg)
    static let drawerBodyBg = Color(UIColor.drawerBodyBg)
    static let historyCardBg = Color(UIColor.historyCardBg)
    static let historyCardBorder = Color(UIColor.historyCardBorder)
}

// MARK: - UIColor Adaptive Colors (iOS 14+ compatible)
extension UIColor {

    private static func adaptive(light: String, dark: String) -> UIColor {
        UIColor { traitCollection in
            traitCollection.userInterfaceStyle == .dark
                ? UIColor(hex: dark)
                : UIColor(hex: light)
        }
    }

    // Brand
    static let primaryAccent = UIColor(hex: "#E8930C")

    // Surfaces
    static let pageBg = adaptive(light: "#F8F7F4", dark: "#1A1916")
    static let surface = adaptive(light: "#FFFFFF", dark: "#252320")
    static let surfaceAlt = adaptive(light: "#FAFAF8", dark: "#2A2825")
    static let surfaceAlt2 = adaptive(light: "#F4F3F0", dark: "#232120")
    static let surfaceHover = adaptive(light: "#FAFAF6", dark: "#2E2B27")
    static let surfaceSelected = adaptive(light: "#EEF3FF", dark: "#1E2A3D")
    static let surfaceExpanded = adaptive(light: "#FDFCF8", dark: "#2C2A26")
    static let surfaceMuted = adaptive(light: "#F5F5F5", dark: "#2A2826")
    static let surfaceWarning = adaptive(light: "#FEF9EE", dark: "#2E2618")
    static let surfaceNoteCard = adaptive(light: "#FFFDF0", dark: "#2A2718")
    static let surfaceNoteCardBorder = adaptive(light: "#F0EBC8", dark: "#3A3520")

    // Borders
    static let appBorder = adaptive(light: "#E0DDD8", dark: "#3A3733")
    static let borderLight = adaptive(light: "#EEECE8", dark: "#322F2B")
    static let borderMedium = adaptive(light: "#D8D5CF", dark: "#3E3B36")
    static let borderButton = adaptive(light: "#D0CCC5", dark: "#4A463F")
    static let borderInput = adaptive(light: "#DDDDDD", dark: "#444038")
    static let borderDashed = adaptive(light: "#ECE9E3", dark: "#3A3733")

    // Text
    static let textPrimary = adaptive(light: "#1A1A1A", dark: "#E8E4DE")
    static let textBody = adaptive(light: "#333333", dark: "#D4D0C8")
    static let textSecondary = adaptive(light: "#555555", dark: "#A8A49C")
    static let textMuted = adaptive(light: "#888888", dark: "#807C74")
    static let textSubtle = adaptive(light: "#999999", dark: "#6E6A62")
    static let textFaint = adaptive(light: "#AAAAAA", dark: "#5A5650")
    static let textPlaceholder = adaptive(light: "#BBBBBB", dark: "#504C46")
    static let textDisabled = adaptive(light: "#CCCCCC", dark: "#444038")
    static let textLink = adaptive(light: "#1A73E8", dark: "#5B9CF5")

    // Solid
    static let solidDark = adaptive(light: "#1A1A1A", dark: "#E8E4DE")
    static let solidDarkText = adaptive(light: "#FFFFFF", dark: "#1A1916")
    static let dangerBg = adaptive(light: "#E74C3C", dark: "#C0392B")
    static let successText = adaptive(light: "#27AE60", dark: "#2ECC71")

    // Calendar
    static let calTodayBg = adaptive(light: "#1A1A1A", dark: "#E8E4DE")
    static let calTodayText = adaptive(light: "#FFFFFF", dark: "#1A1916")
    static let calWeekendBg = adaptive(light: "#FDFCFA", dark: "#242220")
    static let surfaceHoverBlue = adaptive(light: "#EEF3FF", dark: "#1A2540")
    static let calCellSelected = adaptive(light: "#FDFCF4", dark: "#2C2818")

    // Drawer
    static let drawerHeaderBg = adaptive(light: "#FAFAF8", dark: "#2A2825")
    static let drawerBodyBg = adaptive(light: "#FFFFFF", dark: "#252320")
    static let historyCardBg = adaptive(light: "#FDFCFA", dark: "#2A2825")
    static let historyCardBorder = adaptive(light: "#ECE9E3", dark: "#3A3733")

    // Hex helper
    convenience init(hex: String) {
        let hex = hex.trimmingCharacters(in: .alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r, g, b: UInt64
        switch hex.count {
        case 6: (r, g, b) = (int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default: (r, g, b) = (0, 0, 0)
        }
        self.init(red: CGFloat(r)/255, green: CGFloat(g)/255, blue: CGFloat(b)/255, alpha: 1)
    }
}
