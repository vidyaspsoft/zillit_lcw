import SwiftUI

/// Full-screen Distribute-To picker. 5 tabs, single-mode at a time (latest wins).
/// Returns a `DistributeSelection` via `onConfirm`.
struct SelectInviteesView: View {
    let initial: DistributeSelection
    let onConfirm: (DistributeSelection) -> Void
    let onCancel: () -> Void

    enum Tab: String, CaseIterable, Identifiable {
        case allDepts, departments, users, presets, selfTab
        var id: String { rawValue }
        var label: String {
            switch self {
            case .allDepts: return "All Depts"
            case .departments: return "Departments"
            case .users: return "Users"
            case .presets: return "Preset"
            case .selfTab: return "Self"
            }
        }
        /// Wire enum value (matches spec § 4.2).
        var distributeKey: String {
            switch self {
            case .allDepts: return "all_departments"
            case .departments: return "departments"
            case .users: return "users"
            case .presets: return "presets"
            case .selfTab: return "self"
            }
        }
    }

    @State private var activeTab: Tab = .allDepts
    @State private var allDeptsOn = false
    @State private var selfOn = false
    @State private var selectedDeptIds: Set<String> = []
    @State private var selectedUserIds: Set<String> = []
    @State private var selectedPresetId: String? = nil

    @State private var users: [ProjectUser] = []
    @State private var departments: [Department] = []
    @State private var presets: [UserPreset] = []
    @State private var loading = false
    @State private var loadError: String? = nil

    @State private var deptSearch = ""
    @State private var userSearch = ""
    @State private var presetSearch = ""
    @State private var presetMembersOf: UserPreset? = nil

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                tabBar
                Divider()
                content
                Divider()
                footer
            }
            .navigationTitle("Select Invitees")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { onCancel() } label: { Image(systemName: "xmark") }
                }
            }
            .onAppear { restoreInitial(); loadData() }
            .sheet(item: $presetMembersOf) { preset in
                PresetMembersSheet(preset: preset, onClose: { presetMembersOf = nil })
            }
        }
    }

    // MARK: - Tab bar

    private var tabBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Tab.allCases) { t in
                    Button { activeTab = t } label: {
                        Text(t.label)
                            .font(.system(size: 13, weight: .semibold))
                            .padding(.horizontal, 14).padding(.vertical, 6)
                            .background(activeTab == t ? Color.primaryAccent : Color.surface)
                            .foregroundColor(activeTab == t ? .white : Color.textBody)
                            .overlay(
                                Capsule().stroke(activeTab == t ? Color.primaryAccent : Color.borderInput, lineWidth: 1)
                            )
                            .clipShape(Capsule())
                    }
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
        }
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if loading {
            VStack { Spacer(); ProgressView(); Spacer() }
        } else if let err = loadError {
            VStack { Spacer(); Text(err).foregroundColor(.red); Spacer() }
                .padding()
        } else {
            switch activeTab {
            case .allDepts: allDeptsCard
            case .selfTab: selfCard
            case .departments: departmentsList
            case .users: usersList
            case .presets: presetsList
            }
        }
    }

    private var allDeptsCard: some View {
        VStack(spacing: 14) {
            Spacer()
            Image(systemName: "square.grid.2x2.fill")
                .font(.system(size: 40)).foregroundColor(Color.primaryAccent)
                .frame(width: 72, height: 72)
                .background(Color.primaryAccent.opacity(0.15)).clipShape(RoundedRectangle(cornerRadius: 14))
            Text("Invite all \(users.count) team members").font(.headline)
            Text("Everyone in the project will be invited").font(.subheadline).foregroundColor(.secondary)
            Button {
                allDeptsOn.toggle()
                if allDeptsOn { clearOthers(except: .allDepts) }
            } label: {
                Text(allDeptsOn ? "Selected ✓" : "Select All")
                    .fontWeight(.semibold).padding(.horizontal, 24).padding(.vertical, 10)
                    .background(allDeptsOn ? Color.primaryAccent : Color.surfaceAlt)
                    .foregroundColor(allDeptsOn ? .white : Color.textBody)
                    .clipShape(Capsule())
            }
            .disabled(users.isEmpty)
            Spacer()
        }
    }

    private var selfCard: some View {
        VStack(spacing: 14) {
            Spacer()
            Image(systemName: "person.fill")
                .font(.system(size: 40)).foregroundColor(Color.primaryAccent)
                .frame(width: 72, height: 72)
                .background(Color.primaryAccent.opacity(0.15)).clipShape(RoundedRectangle(cornerRadius: 14))
            Text("Only You").font(.headline)
            Text("This event will be visible to you only").font(.subheadline).foregroundColor(.secondary)
            Button {
                selfOn.toggle()
                if selfOn { clearOthers(except: .selfTab) }
            } label: {
                Text(selfOn ? "Selected ✓" : "Select Me")
                    .fontWeight(.semibold).padding(.horizontal, 24).padding(.vertical, 10)
                    .background(selfOn ? Color.primaryAccent : Color.surfaceAlt)
                    .foregroundColor(selfOn ? .white : Color.textBody)
                    .clipShape(Capsule())
            }
            Spacer()
        }
    }

    private var departmentsList: some View {
        VStack(spacing: 0) {
            HStack {
                searchField(text: $deptSearch, placeholder: "Search departments…")
                Button {
                    selectedDeptIds = Set(filteredDepts.map { $0.id })
                    if !selectedDeptIds.isEmpty { clearOthers(except: .departments) }
                } label: {
                    Text("Select All").font(.system(size: 14, weight: .semibold)).foregroundColor(Color.primaryAccent)
                }
            }
            .padding(12)
            if filteredDepts.isEmpty {
                Spacer(); Text("No departments yet").foregroundColor(.secondary); Spacer()
            } else {
                List {
                    ForEach(filteredDepts) { d in
                        Button { toggleDept(d.id) } label: {
                            HStack {
                                checkbox(selected: selectedDeptIds.contains(d.id))
                                Image(systemName: "person.3").foregroundColor(.secondary)
                                Text(d.name).foregroundColor(Color.textBody)
                                Spacer()
                            }
                        }
                    }
                }
                .listStyle(.plain)
            }
        }
    }

    private var usersList: some View {
        VStack(spacing: 0) {
            HStack {
                searchField(text: $userSearch, placeholder: "Search users…")
                Button {
                    selectedUserIds = Set(filteredUsers.map { $0.id })
                    if !selectedUserIds.isEmpty { clearOthers(except: .users) }
                } label: {
                    Text("Select All").font(.system(size: 14, weight: .semibold)).foregroundColor(Color.primaryAccent)
                }
            }
            .padding(12)
            if filteredUsers.isEmpty {
                Spacer(); Text("No users yet").foregroundColor(.secondary); Spacer()
            } else {
                List {
                    ForEach(filteredUsers) { u in
                        Button { toggleUser(u.id) } label: {
                            HStack(alignment: .top) {
                                checkbox(selected: selectedUserIds.contains(u.id))
                                VStack(alignment: .leading, spacing: 2) {
                                    HStack {
                                        Text(u.fullName).fontWeight(.semibold).foregroundColor(Color.textBody)
                                        if u.isAdmin {
                                            Text("ADMIN")
                                                .font(.system(size: 10, weight: .semibold))
                                                .padding(.horizontal, 6).padding(.vertical, 1)
                                                .background(Color.primaryAccent.opacity(0.2))
                                                .foregroundColor(Color.primaryAccent)
                                                .clipShape(RoundedRectangle(cornerRadius: 4))
                                        }
                                    }
                                    let subtitle = [u.departmentName, u.designationName].filter { !$0.isEmpty }.joined(separator: " · ")
                                    if !subtitle.isEmpty {
                                        Text(subtitle).font(.caption).foregroundColor(.secondary)
                                    }
                                }
                                Spacer()
                            }
                        }
                    }
                }
                .listStyle(.plain)
            }
        }
    }

    private var presetsList: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 4) {
                searchField(text: $presetSearch, placeholder: "Search presets…")
                Text("Long-press a preset to view its members")
                    .font(.caption).italic().foregroundColor(.secondary)
            }
            .padding(12)

            if filteredPresets.isEmpty {
                Spacer(); Text("No presets yet").foregroundColor(.secondary); Spacer()
            } else {
                List {
                    ForEach(filteredPresets) { p in
                        Button { pickPreset(p.id) } label: {
                            HStack {
                                radio(selected: selectedPresetId == p.id)
                                Image(systemName: "star.fill").foregroundColor(Color.primaryAccent)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(p.name).fontWeight(.semibold).foregroundColor(Color.textBody)
                                    Text("\(p.memberCount) member\(p.memberCount == 1 ? "" : "s")")
                                        .font(.caption).foregroundColor(.secondary)
                                }
                                Spacer()
                                Button { presetMembersOf = p } label: {
                                    Image(systemName: "info.circle").foregroundColor(.secondary)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .onLongPressGesture { presetMembersOf = p }
                    }
                }
                .listStyle(.plain)
            }
        }
    }

    // MARK: - Footer

    private var footer: some View {
        HStack {
            Button("Cancel", action: onCancel)
                .padding(.horizontal, 18).padding(.vertical, 10)
                .foregroundColor(Color.textBody)
                .background(Color.surfaceAlt).clipShape(Capsule())
            Spacer()
            Button {
                onConfirm(buildSelection())
            } label: {
                Text("Done (\(doneCount))")
                    .fontWeight(.semibold).padding(.horizontal, 18).padding(.vertical, 10)
                    .foregroundColor(doneCount == 0 ? Color.textSubtle : .white)
                    .background(doneCount == 0 ? Color.surfaceAlt : Color.primaryAccent)
                    .clipShape(Capsule())
            }
            .disabled(doneCount == 0)
        }
        .padding(12)
    }

    // MARK: - Helpers

    private func searchField(text: Binding<String>, placeholder: String) -> some View {
        HStack {
            Image(systemName: "magnifyingglass").foregroundColor(.secondary)
            TextField(placeholder, text: text)
        }
        .padding(8)
        .background(Color.surfaceAlt)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func checkbox(selected: Bool) -> some View {
        Image(systemName: selected ? "checkmark.square.fill" : "square")
            .foregroundColor(selected ? Color.primaryAccent : Color.textSubtle)
    }

    private func radio(selected: Bool) -> some View {
        Image(systemName: selected ? "largecircle.fill.circle" : "circle")
            .foregroundColor(selected ? Color.primaryAccent : Color.textSubtle)
    }

    private var filteredDepts: [Department] {
        let q = deptSearch.trimmingCharacters(in: .whitespaces).lowercased()
        return q.isEmpty ? departments : departments.filter { $0.name.lowercased().contains(q) }
    }
    private var filteredUsers: [ProjectUser] {
        let q = userSearch.trimmingCharacters(in: .whitespaces).lowercased()
        return q.isEmpty ? users : users.filter { $0.fullName.lowercased().contains(q) }
    }
    private var filteredPresets: [UserPreset] {
        let q = presetSearch.trimmingCharacters(in: .whitespaces).lowercased()
        return q.isEmpty ? presets : presets.filter { $0.name.lowercased().contains(q) }
    }

    private var doneCount: Int {
        switch activeTab {
        case .allDepts: return allDeptsOn ? users.count : 0
        case .selfTab: return selfOn ? 1 : 0
        case .departments: return selectedDeptIds.count
        case .users: return selectedUserIds.count
        case .presets: return selectedPresetId == nil ? 0 : 1
        }
    }

    private func clearOthers(except mode: Tab) {
        if mode != .allDepts { allDeptsOn = false }
        if mode != .selfTab { selfOn = false }
        if mode != .departments { selectedDeptIds.removeAll() }
        if mode != .users { selectedUserIds.removeAll() }
        if mode != .presets { selectedPresetId = nil }
    }

    private func toggleDept(_ id: String) {
        if selectedDeptIds.contains(id) { selectedDeptIds.remove(id) }
        else { selectedDeptIds.insert(id) }
        if !selectedDeptIds.isEmpty { clearOthers(except: .departments) }
    }
    private func toggleUser(_ id: String) {
        if selectedUserIds.contains(id) { selectedUserIds.remove(id) }
        else { selectedUserIds.insert(id) }
        if !selectedUserIds.isEmpty { clearOthers(except: .users) }
    }
    private func pickPreset(_ id: String) {
        selectedPresetId = id
        clearOthers(except: .presets)
    }

    private func buildSelection() -> DistributeSelection {
        if allDeptsOn { return DistributeSelection(distributeTo: "all_departments", userIds: [], departmentIds: [], presetId: nil) }
        if selfOn { return DistributeSelection(distributeTo: "self", userIds: [], departmentIds: [], presetId: nil) }
        if let pid = selectedPresetId { return DistributeSelection(distributeTo: "presets", userIds: [], departmentIds: [], presetId: pid) }
        if !selectedUserIds.isEmpty { return DistributeSelection(distributeTo: "users", userIds: Array(selectedUserIds), departmentIds: [], presetId: nil) }
        if !selectedDeptIds.isEmpty { return DistributeSelection(distributeTo: "departments", userIds: [], departmentIds: Array(selectedDeptIds), presetId: nil) }
        return .empty
    }

    private func restoreInitial() {
        switch initial.distributeTo {
        case "all_departments":
            activeTab = .allDepts; allDeptsOn = true
        case "self":
            activeTab = .selfTab; selfOn = true
        case "departments":
            activeTab = .departments; selectedDeptIds = Set(initial.departmentIds)
        case "users":
            activeTab = .users; selectedUserIds = Set(initial.userIds)
        case "presets":
            activeTab = .presets; selectedPresetId = initial.presetId
        default:
            activeTab = .allDepts
        }
    }

    private func loadData() {
        loading = true; loadError = nil
        Task {
            async let u = (try? await DistributeAPI.shared.getProjectUsers()) ?? []
            async let d = (try? await DistributeAPI.shared.getDepartments()) ?? []
            async let p = (try? await DistributeAPI.shared.getUserPresets()) ?? []
            let (uu, dd, pp) = await (u, d, p)
            await MainActor.run {
                users = uu; departments = dd; presets = pp; loading = false
            }
        }
    }
}

// PresetMembersSheet is shared from PresetListView.swift

