import SwiftUI

/// SetDefaultPopover — dropdown popup anchored below the "Set Default" button.
/// Shows radio options matching web's Popover component.
/// Use as an overlay with ZStack — not a sheet or NavigationLink.
struct SetDefaultPopover: View {
    let title: String
    let subtitle: String
    let options: [(value: String, label: String, desc: String)]
    let currentValue: String
    let onSelect: (String) -> Void
    let onDismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Title
            Text(title)
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(.textPrimary)

            // Subtitle
            Text(subtitle)
                .font(.system(size: 11))
                .foregroundColor(.textMuted)
                .padding(.bottom, 4)

            // Options
            ForEach(options, id: \.value) { option in
                let isCurrent = option.value == currentValue

                Button(action: {
                    onSelect(option.value)
                    onDismiss()
                }) {
                    HStack(spacing: 10) {
                        // Radio circle
                        ZStack {
                            Circle()
                                .stroke(isCurrent ? Color.solidDark : Color.textDisabled, lineWidth: isCurrent ? 5 : 2)
                                .frame(width: 18, height: 18)
                            if isCurrent {
                                Circle().fill(Color.surface).frame(width: 8, height: 8)
                            }
                        }

                        VStack(alignment: .leading, spacing: 1) {
                            Text(option.label)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(.textPrimary)
                            Text(option.desc)
                                .font(.system(size: 10))
                                .foregroundColor(.textSubtle)
                        }

                        Spacer()

                        if isCurrent {
                            Text("dv_current".localized)
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundColor(.successText)
                        }
                    }
                    .padding(10)
                    .background(isCurrent ? Color.surfaceAlt : Color.surface)
                    .cornerRadius(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(isCurrent ? Color.solidDark : Color.appBorder, lineWidth: isCurrent ? 2 : 1)
                    )
                }
            }
        }
        .padding(14)
        .frame(width: 260)
        .background(Color.surface)
        .cornerRadius(12)
        .shadow(color: Color.black.opacity(0.15), radius: 8, y: 4)
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.appBorder, lineWidth: 1))
    }
}

// Keep old name for backward compat but redirect
struct SetDefaultSheet: View {
    let title: String
    let subtitle: String
    let options: [(value: String, label: String, desc: String)]
    let currentValue: String
    let onSelect: (String) -> Void

    var body: some View {
        SetDefaultPopover(
            title: title, subtitle: subtitle, options: options,
            currentValue: currentValue, onSelect: onSelect, onDismiss: {}
        )
        .padding(20)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Color.pageBg)
    }
}
