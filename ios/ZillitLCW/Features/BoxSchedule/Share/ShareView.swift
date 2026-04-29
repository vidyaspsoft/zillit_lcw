import SwiftUI
import UIKit

/// ShareView — generate share link backed by a backend-rendered PDF.
/// The "Open PDF" button hands off to UIActivityViewController so the user
/// can preview, print (AirPrint), or share the file.
struct ShareView: View {
    @Environment(\.presentationMode) var presentationMode
    @ObservedObject var viewModel: BoxScheduleViewModel
    @State private var shareUrl = ""
    @State private var attachment: Attachment?
    @State private var isGenerating = false
    @State private var isCopied = false
    @State private var isTextCopied = false
    @State private var presentShareSheetURL: URL?

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
                            viewModel.generateShareLink { result in
                                isGenerating = false
                                if let result = result {
                                    shareUrl = result.shareUrl
                                    attachment = result.attachment
                                }
                            }
                        }) {
                            HStack(spacing: 4) {
                                if isGenerating { ProgressView().scaleEffect(0.8) }
                                Image(systemName: "link")
                                Text(isGenerating ? "Generating PDF…" : "share_generate".localized)
                            }
                            .font(.system(size: 13, weight: .semibold))
                        }
                        .secondaryButtonStyle()
                        .disabled(isGenerating)
                    } else {
                        VStack(alignment: .leading, spacing: 10) {
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

                            if let att = attachment, let url = att.bestURL {
                                HStack(spacing: 10) {
                                    Image(systemName: "doc.richtext")
                                        .foregroundColor(.primaryAccent)
                                        .font(.system(size: 22))
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(att.name).font(.system(size: 12, weight: .semibold)).foregroundColor(.textBody).lineLimit(1)
                                        let kb = (Int(att.fileSize) ?? 0) / 1024
                                        Text("PDF · \(kb) KB").font(.caption).foregroundColor(.textMuted)
                                    }
                                    Spacer()
                                    Button { presentShareSheetURL = url } label: {
                                        Label("Open PDF", systemImage: "square.and.arrow.up")
                                            .font(.system(size: 12, weight: .semibold))
                                    }
                                    .secondaryButtonStyle()
                                }
                                .padding(10)
                                .background(Color.surface)
                                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.appBorder, lineWidth: 1))
                            }
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
        .sheet(isPresented: Binding(
            get: { presentShareSheetURL != nil },
            set: { if !$0 { presentShareSheetURL = nil } }
        )) {
            if let url = presentShareSheetURL {
                ShareSheet(items: [url])
            }
        }
    }
}

/// Thin wrapper around UIActivityViewController so the user can preview /
/// print (AirPrint) / share the rendered PDF.
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}
