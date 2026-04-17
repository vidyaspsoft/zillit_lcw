import SwiftUI

/// TypeManagerView — manage schedule types (add/edit/delete custom types).
struct TypeManagerView: View {
    @Environment(\.presentationMode) var presentationMode
    @ObservedObject var viewModel: BoxScheduleViewModel

    @State private var newTitle = ""
    @State private var newColor = "#9B59B6"
    @State private var editingId: String? = nil
    @State private var editTitle = ""
    @State private var showDeleteConfirm = false
    @State private var deleteTargetId: String? = nil

    private var types: [ScheduleType] { viewModel.scheduleTypes }

    var body: some View {
            VStack(spacing: 0) {
                // Type list (scrollable)
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(types) { type in
                            typeRow(type)
                            Divider().background(Color.borderLight)
                        }
                    }
                }

                // Add Custom Type (pinned at bottom)
                VStack(alignment: .leading, spacing: 8) {
                    Text("tm_add_custom".localized)
                        .sectionLabel()

                    HStack(spacing: 8) {
                        Circle()
                            .fill(Color(hex: newColor))
                            .frame(width: 28, height: 28)
                            .overlay(Circle().stroke(Color.borderInput, lineWidth: 1))

                        TextField("tm_type_name_hint".localized, text: $newTitle)
                            .inputStyle()

                        Button(action: {
                            let trimmed = newTitle.trimmingCharacters(in: .whitespaces)
                            guard !trimmed.isEmpty else { return }
                            viewModel.createType(title: trimmed, color: newColor)
                            newTitle = ""
                        }) {
                            HStack(spacing: 4) {
                                Image(systemName: "plus")
                                Text("tm_add".localized)
                            }
                            .font(.system(size: 13, weight: .medium))
                        }
                        .secondaryButtonStyle()
                        .disabled(newTitle.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
                .padding(16)
                .background(Color.surfaceAlt)
                .overlay(Rectangle().frame(height: 1).foregroundColor(.appBorder), alignment: .top)
            }
            .background(Color.pageBg)
            .navigationTitle("tm_title".localized)
            .navigationBarTitleDisplayMode(.inline)
        .navigationBarHidden(false)
            .alert(isPresented: $showDeleteConfirm) {
                Alert(
                    title: Text("tm_delete_title".localized),
                    message: Text("tm_delete_message".localized),
                    primaryButton: .destructive(Text("tm_delete_confirm".localized)) {
                        if let id = deleteTargetId {
                            viewModel.deleteType(id: id)
                        }
                    },
                    secondaryButton: .cancel()
                )
            }
    }

    private func typeRow(_ type: ScheduleType) -> some View {
        HStack(spacing: 12) {
            Circle()
                .fill(Color(hex: type.color))
                .frame(width: 28, height: 28)
                .overlay(Circle().stroke(Color.borderInput, lineWidth: 1))

            if editingId == type.id {
                TextField("tm_type_name_hint".localized, text: $editTitle)
                    .inputStyle()

                Button(action: {
                    let trimmed = editTitle.trimmingCharacters(in: .whitespaces)
                    guard !trimmed.isEmpty else { return }
                    viewModel.updateType(id: type.id, title: trimmed, color: type.color)
                    editingId = nil
                }) {
                    Image(systemName: "checkmark")
                        .foregroundColor(.successText)
                }

                Button(action: { editingId = nil }) {
                    Image(systemName: "xmark")
                        .foregroundColor(.textSubtle)
                }
            } else {
                Text(type.title)
                    .font(.system(size: 14, weight: type.systemDefined ? .semibold : .regular))
                    .foregroundColor(.textPrimary)

                if type.systemDefined {
                    Text("tm_system".localized)
                        .font(.system(size: 10))
                        .foregroundColor(.textSubtle)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .overlay(RoundedRectangle(cornerRadius: 2).stroke(Color.borderInput, lineWidth: 1))
                }

                Spacer()

                if !type.systemDefined {
                    Button(action: {
                        editingId = type.id
                        editTitle = type.title
                    }) {
                        Image(systemName: "pencil")
                            .font(.system(size: 15))
                            .foregroundColor(.textLink)
                    }

                    Button(action: {
                        deleteTargetId = type.id
                        showDeleteConfirm = true
                    }) {
                        Image(systemName: "trash")
                            .font(.system(size: 15))
                            .foregroundColor(.textSubtle)
                    }
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }
}
