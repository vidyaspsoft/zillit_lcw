import SwiftUI

// MARK: - Localized String Helper
extension String {
    var localized: String {
        NSLocalizedString(self, comment: "")
    }

    func localized(with args: CVarArg...) -> String {
        String(format: NSLocalizedString(self, comment: ""), arguments: args)
    }
}

// MARK: - Color from Hex String
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: .alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r, g, b: UInt64
        switch hex.count {
        case 6: (r, g, b) = (int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default: (r, g, b) = (0, 0, 0)
        }
        self.init(red: Double(r)/255, green: Double(g)/255, blue: Double(b)/255)
    }
}

// MARK: - View Modifiers
extension View {
    func cardStyle() -> some View {
        self.background(Color.surface)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.appBorder, lineWidth: 1)
            )
    }

    func pillStyle(color: Color) -> some View {
        self.padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.12))
            .cornerRadius(4)
            .overlay(
                RoundedRectangle(cornerRadius: 4)
                    .stroke(color.opacity(0.25), lineWidth: 1)
            )
    }

    func inputStyle() -> some View {
        self.padding(.horizontal, 14)
            .frame(minHeight: 44)
            .background(Color.surface)
            .cornerRadius(10)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Color.borderInput, lineWidth: 1)
            )
    }

    func primaryButtonStyle() -> some View {
        self.frame(maxWidth: .infinity, minHeight: 44)
            .background(Color.solidDark)
            .foregroundColor(Color.solidDarkText)
            .cornerRadius(10)
            .font(.system(size: 14, weight: .semibold))
    }

    func secondaryButtonStyle() -> some View {
        self.frame(minHeight: 36)
            .padding(.horizontal, 12)
            .background(Color.surface)
            .foregroundColor(Color.textSecondary)
            .cornerRadius(6)
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .stroke(Color.borderButton, lineWidth: 1)
            )
            .font(.system(size: 13, weight: .medium))
    }

    func sectionLabel() -> some View {
        self.font(.system(size: 10, weight: .semibold))
            .foregroundColor(Color.textSecondary)
            .textCase(.uppercase)
    }
}
