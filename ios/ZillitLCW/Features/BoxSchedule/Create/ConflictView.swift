import SwiftUI

/// ConflictView — conflict resolution dialog (Replace / Extend / Overlap).
struct ConflictView: View {
    @Environment(\.presentationMode) var presentationMode
    var onResolve: (String) -> Void = { _ in }

    var body: some View {
        VStack(spacing: 20) {
            // Title
            Text("conflict_title".localized)
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(.textPrimary)

            // Options
            VStack(spacing: 10) {
                conflictOption(
                    title: "conflict_replace".localized,
                    desc: "conflict_replace_desc".localized,
                    action: "replace",
                    recommended: true
                )
                conflictOption(
                    title: "conflict_extend".localized,
                    desc: "conflict_extend_desc".localized,
                    action: "extend"
                )
                conflictOption(
                    title: "conflict_overlap".localized,
                    desc: "conflict_overlap_desc".localized,
                    action: "overlap"
                )
            }

            // Back button
            Button("conflict_back".localized) {
                presentationMode.wrappedValue.dismiss()
            }
            .secondaryButtonStyle()
        }
        .padding(24)
        .background(Color.surface)
    }

    private func conflictOption(title: String, desc: String, action: String, recommended: Bool = false) -> some View {
        Button(action: {
            onResolve(action)
            presentationMode.wrappedValue.dismiss()
        }) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Text(title)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.textPrimary)
                    if recommended {
                        Text("Recommended")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(.successText)
                    }
                }
                Text(desc)
                    .font(.system(size: 12))
                    .foregroundColor(.textSecondary)
                    .multilineTextAlignment(.leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(Color.surfaceAlt)
            .cornerRadius(8)
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(recommended ? Color.solidDark : Color.borderButton, lineWidth: recommended ? 2 : 1))
        }
    }
}
