import SwiftUI

/// Two-field form: preset name + multi-select user list.
/// Doubles as create + edit — pass `editing` to pre-fill and update instead
/// of create (server uses POST /user-preset with a `preset_id` in the body
/// for updates; same endpoint as create).
struct CreatePresetView: View {
    @Environment(\.presentationMode) var presentationMode
    let onSaved: () -> Void
    var editing: UserPreset? = nil

    @State private var presetName = ""
    @State private var users: [ProjectUser] = []
    @State private var loadingUsers = false
    @State private var userSearch = ""
    @State private var selectedIds: Set<String> = []
    @State private var saving = false
    @State private var errorMsg: String?

    private var isEditing: Bool { editing != nil }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Preset Name
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Preset Name").sectionLabel()
                        TextField("e.g., My Crew", text: $presetName).inputStyle()
                    }

                    // Select Users
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text("Select Users (\(selectedIds.count))").sectionLabel()
                            Spacer()
                            if !filteredUsers.isEmpty {
                                Button {
                                    let visibleIds = Set(filteredUsers.map { $0.id })
                                    let allSelected = visibleIds.isSubset(of: selectedIds)
                                    if allSelected {
                                        selectedIds.subtract(visibleIds)
                                    } else {
                                        selectedIds.formUnion(visibleIds)
                                    }
                                } label: {
                                    Text(filteredUsers.allSatisfy { selectedIds.contains($0.id) } ? "Clear All" : "Select All")
                                        .font(.system(size: 12, weight: .semibold))
                                        .foregroundColor(Color.primaryAccent)
                                }
                            }
                        }
                        HStack {
                            Image(systemName: "magnifyingglass").foregroundColor(.secondary)
                            TextField("Search users…", text: $userSearch)
                        }
                        .padding(10)
                        .background(Color.surfaceAlt)
                        .clipShape(RoundedRectangle(cornerRadius: 8))

                        if loadingUsers {
                            HStack { Spacer(); ProgressView(); Spacer() }.padding(.vertical, 20)
                        } else if filteredUsers.isEmpty {
                            Text("No users yet").foregroundColor(.secondary)
                                .frame(maxWidth: .infinity).padding(.vertical, 20)
                        } else {
                            VStack(spacing: 0) {
                                ForEach(filteredUsers) { u in
                                    Button { toggle(u.id) } label: {
                                        HStack(alignment: .top) {
                                            Image(systemName: selectedIds.contains(u.id)
                                                  ? "checkmark.square.fill" : "square")
                                                .foregroundColor(selectedIds.contains(u.id)
                                                                 ? Color.primaryAccent : Color.textSubtle)
                                            VStack(alignment: .leading, spacing: 2) {
                                                HStack {
                                                    Text(u.fullName)
                                                        .font(.system(size: 14, weight: .semibold))
                                                        .foregroundColor(Color.textBody)
                                                    if u.isAdmin {
                                                        Text("ADMIN")
                                                            .font(.system(size: 10, weight: .semibold))
                                                            .padding(.horizontal, 6).padding(.vertical, 1)
                                                            .background(Color.primaryAccent.opacity(0.2))
                                                            .foregroundColor(Color.primaryAccent)
                                                            .clipShape(RoundedRectangle(cornerRadius: 4))
                                                    }
                                                }
                                                let sub = [u.departmentName, u.designationName]
                                                    .filter { !$0.isEmpty }.joined(separator: " · ")
                                                if !sub.isEmpty {
                                                    Text(sub).font(.caption).foregroundColor(.secondary)
                                                }
                                            }
                                            Spacer()
                                        }
                                        .padding(.vertical, 8)
                                    }
                                    Divider()
                                }
                            }
                            .padding(.horizontal, 10)
                            .background(Color.surface)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.borderInput, lineWidth: 1))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }
                }
                .padding(20)
            }

            Button(action: save) {
                HStack {
                    if saving {
                        ProgressView().progressViewStyle(CircularProgressViewStyle(tint: .white))
                    }
                    Text(saving ? "Saving…" : (isEditing ? "Update Preset" : "Save Preset"))
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(.white)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(canSave ? Color.primaryAccent : Color.gray.opacity(0.4))
                .cornerRadius(10)
            }
            .disabled(!canSave || saving)
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(Color.surface)
            .overlay(Rectangle().frame(height: 1).foregroundColor(.appBorder), alignment: .top)
        }
        .background(Color.pageBg.ignoresSafeArea())
        .navigationTitle(isEditing ? "Edit Preset" : "New Preset")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            if let e = editing {
                presetName = e.name
                selectedIds = Set(e.members.map { $0.userId })
            }
            loadUsers()
        }
        .alert(isPresented: Binding<Bool>(
            get: { errorMsg != nil },
            set: { if !$0 { errorMsg = nil } }
        )) {
            Alert(title: Text("Error"), message: Text(errorMsg ?? ""), dismissButton: .default(Text("OK")))
        }
    }

    private var canSave: Bool {
        !presetName.trimmingCharacters(in: .whitespaces).isEmpty && !selectedIds.isEmpty
    }

    private var filteredUsers: [ProjectUser] {
        let q = userSearch.trimmingCharacters(in: .whitespaces).lowercased()
        return q.isEmpty ? users : users.filter { $0.fullName.lowercased().contains(q) }
    }

    private func toggle(_ id: String) {
        if selectedIds.contains(id) { selectedIds.remove(id) }
        else { selectedIds.insert(id) }
    }

    private func loadUsers() {
        loadingUsers = true
        Task {
            let list = (try? await DistributeAPI.shared.getProjectUsers()) ?? []
            await MainActor.run { users = list; loadingUsers = false }
        }
    }

    private func save() {
        saving = true
        let name = presetName.trimmingCharacters(in: .whitespaces)
        let ids = Array(selectedIds)
        Task {
            do {
                if let e = editing {
                    try await DistributeAPI.shared.updateUserPreset(id: e.id, name: name, userIds: ids)
                } else {
                    try await DistributeAPI.shared.createUserPreset(name: name, userIds: ids)
                }
                await MainActor.run {
                    saving = false
                    onSaved()
                    presentationMode.wrappedValue.dismiss()
                }
            } catch {
                await MainActor.run {
                    saving = false
                    errorMsg = error.localizedDescription
                }
            }
        }
    }
}
