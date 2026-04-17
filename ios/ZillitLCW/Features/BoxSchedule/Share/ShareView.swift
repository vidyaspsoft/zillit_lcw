import SwiftUI

/// ShareView — generate share link or copy schedule as text.
struct ShareView: View {
    @Environment(\.presentationMode) var presentationMode
    @ObservedObject var viewModel: BoxScheduleViewModel
    @State private var shareUrl = ""
    @State private var isGenerating = false
    @State private var isCopied = false
    @State private var isTextCopied = false

    // MARK: - Build plain text from schedule days
    private var scheduleAsText: String {
        var lines: [String] = []
        lines.append("PRODUCTION SCHEDULE")
        lines.append("Generated: \(DateUtils.formatDate(DateUtils.toEpoch(Date())))")
        lines.append(String(repeating: "=", count: 40))
        lines.append("")

        for day in viewModel.scheduleDays {
            let dateRange = "\(DateUtils.formatShortDate(day.startDate)) – \(DateUtils.formatDate(day.endDate))"
            lines.append("\(day.typeName) — \(day.title.isEmpty ? "(no title)" : day.title)")
            lines.append("  Dates: \(dateRange) (\(day.numberOfDays) day(s))")
            lines.append("")
        }

        if viewModel.scheduleDays.isEmpty {
            lines.append("No schedule days created yet.")
        }

        return lines.joined(separator: "\n")
    }

    var body: some View {
            VStack(spacing: 16) {
                // Share via Link
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 6) {
                        Image(systemName: "link")
                        Text("share_via_link".localized)
                            .font(.system(size: 13, weight: .semibold))
                    }
                    .foregroundColor(.textBody)

                    Text("share_link_desc".localized)
                        .font(.system(size: 12))
                        .foregroundColor(.textMuted)

                    if shareUrl.isEmpty {
                        Button(action: {
                            isGenerating = true
                            viewModel.generateShareLink { url in
                                isGenerating = false
                                if let url = url {
                                    shareUrl = url
                                }
                            }
                        }) {
                            HStack(spacing: 4) {
                                if isGenerating { ProgressView().scaleEffect(0.8) }
                                Image(systemName: "link")
                                Text("share_generate".localized)
                            }
                            .font(.system(size: 13, weight: .semibold))
                        }
                        .secondaryButtonStyle()
                        .disabled(isGenerating)
                    } else {
                        HStack {
                            Text(shareUrl)
                                .font(.system(size: 12))
                                .foregroundColor(.textBody)
                                .lineLimit(1)
                                .truncationMode(.middle)
                                .inputStyle()

                            Button(action: {
                                UIPasteboard.general.string = shareUrl
                                isCopied = true
                                DispatchQueue.main.asyncAfter(deadline: .now() + 2) { isCopied = false }
                            }) {
                                HStack(spacing: 4) {
                                    Image(systemName: isCopied ? "checkmark" : "doc.on.doc")
                                    Text(isCopied ? "share_copied".localized : "share_copy".localized)
                                }
                                .font(.system(size: 12, weight: .medium))
                                .foregroundColor(isCopied ? .successText : .textSecondary)
                            }
                            .secondaryButtonStyle()
                        }
                    }
                }
                .padding(16)
                .background(Color.surfaceAlt)
                .cornerRadius(8)
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.appBorder, lineWidth: 1))

                // Copy as Text
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 6) {
                        Image(systemName: "envelope")
                        Text("share_as_text".localized)
                            .font(.system(size: 13, weight: .semibold))
                    }
                    .foregroundColor(.textBody)

                    Text("share_text_desc".localized)
                        .font(.system(size: 12))
                        .foregroundColor(.textMuted)

                    Button(action: {
                        UIPasteboard.general.string = scheduleAsText
                        isTextCopied = true
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { isTextCopied = false }
                    }) {
                        HStack(spacing: 4) {
                            Image(systemName: isTextCopied ? "checkmark" : "doc.on.doc")
                            Text(isTextCopied ? "share_copied".localized : "share_copy_text".localized)
                        }
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(isTextCopied ? .successText : .textSecondary)
                    }
                    .secondaryButtonStyle()
                }
                .padding(16)
                .background(Color.surfaceAlt)
                .cornerRadius(8)
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.appBorder, lineWidth: 1))

                Spacer()
            }
            .padding(16)
            .background(Color.pageBg.ignoresSafeArea())
            .navigationTitle("share_title".localized)
            .navigationBarTitleDisplayMode(.inline)
        .navigationBarHidden(false)
    }
}
