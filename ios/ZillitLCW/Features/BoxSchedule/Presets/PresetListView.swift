import SwiftUI

/// Lists existing user presets with a "+ New Preset" button.
/// Tapping the info icon opens a member-detail sheet; tapping
/// the + button pushes CreatePresetView.
struct PresetListView: View {
    @State private var presets: [UserPreset] = []
    @State private var loading = false
    @State private var errorMsg: String?
    @State private var search = ""
    @State private var membersOf: UserPreset?
    @State private var navToCreate = false
    @State private var editingPreset: UserPreset? = nil

    var body: some View {
        ZStack {
            Color.pageBg.ignoresSafeArea()

            VStack(spacing: 0) {
                searchRow
                if loading {
                    Spacer(); ProgressView(); Spacer()
                } else if let e = errorMsg {
                    Spacer(); Text(e).foregroundColor(.red); Spacer()
                } else if filteredPresets.isEmpty {
                    Spacer(); Text("No presets yet").foregroundColor(.secondary); Spacer()
                } else {
                    List {
                        ForEach(filteredPresets) { p in
                            HStack {
                                Image(systemName: "star.fill")
                                    .foregroundColor(Color.primaryAccent)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(p.name).font(.system(size: 14, weight: .semibold)).foregroundColor(Color.textBody)
                                    Text("\(p.memberCount) member\(p.memberCount == 1 ? "" : "s")")
                                        .font(.caption).foregroundColor(.secondary)
                                }
                                Spacer()
                                Button { editingPreset = p } label: {
                                    Image(systemName: "pencil").foregroundColor(Color.primaryAccent)
                                }
                                .buttonStyle(.plain)
                                Button { membersOf = p } label: {
                                    Image(systemName: "info.circle").foregroundColor(.secondary)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    .listStyle(.plain)
                }
            }

            // Hidden links — separate ones for create and edit so each gets its own destination state.
            NavigationLink(destination: CreatePresetView(onSaved: { reload() }), isActive: $navToCreate) {
                EmptyView()
            }
            NavigationLink(
                destination: editingPreset.map { CreatePresetView(onSaved: { reload() }, editing: $0) },
                isActive: Binding(
                    get: { editingPreset != nil },
                    set: { if !$0 { editingPreset = nil } }
                )
            ) {
                EmptyView()
            }
        }
        .navigationTitle("Presets")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button { navToCreate = true } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .onAppear { reload() }
        .sheet(item: $membersOf) { p in
            PresetMembersSheet(preset: p, onClose: { membersOf = nil })
        }
    }

    private var searchRow: some View {
        HStack {
            Image(systemName: "magnifyingglass").foregroundColor(.secondary)
            TextField("Search presets…", text: $search)
        }
        .padding(10)
        .background(Color.surfaceAlt)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .padding(12)
    }

    private var filteredPresets: [UserPreset] {
        let q = search.trimmingCharacters(in: .whitespaces).lowercased()
        return q.isEmpty ? presets : presets.filter { $0.name.lowercased().contains(q) }
    }

    private func reload() {
        loading = true; errorMsg = nil
        Task {
            do {
                let list = try await DistributeAPI.shared.getUserPresets()
                await MainActor.run { presets = list; loading = false }
            } catch {
                await MainActor.run { errorMsg = error.localizedDescription; loading = false }
            }
        }
    }
}

/// Shared member-list sheet (also used by SelectInviteesView).
struct PresetMembersSheet: View {
    let preset: UserPreset
    let onClose: () -> Void

    var body: some View {
        NavigationView {
            List(preset.members, id: \.userId) { m in
                VStack(alignment: .leading, spacing: 2) {
                    Text(m.fullName).font(.system(size: 14, weight: .medium))
                    if !m.designation.isEmpty {
                        Text(m.designation).font(.caption).foregroundColor(.secondary)
                    }
                }
            }
            .navigationTitle(preset.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("OK", action: onClose)
                }
            }
        }
    }
}
