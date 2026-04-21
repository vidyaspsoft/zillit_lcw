import SwiftUI

/// TypeManagerView — manage schedule types (add/edit/delete custom types).
/// Tapping the color circle (in Add section or in Edit mode) opens a color palette.
struct TypeManagerView: View {
    @Environment(\.presentationMode) var presentationMode
    @ObservedObject var viewModel: BoxScheduleViewModel

    @State private var newTitle = ""
    @State private var newColor = "#9B59B6"
    @State private var editingId: String? = nil
    @State private var editTitle = ""
    @State private var editColor = "#9B59B6"
    @State private var showDeleteConfirm = false
    @State private var deleteTargetId: String? = nil
    @State private var colorPickerTarget: ColorPickerTarget? = nil
    @State private var typeCountAtCreate: Int = -1

    enum ColorPickerTarget: Identifiable {
        case new
        case edit
        var id: String {
            switch self {
            case .new: return "new"
            case .edit: return "edit"
            }
        }
    }

    // 14 preset colors (same palette as Android)
    private let availableColors: [String] = [
        "#F39C12", "#E74C3C", "#27AE60", "#95A5A6", "#3498DB", "#8E44AD", "#1ABC9C",
        "#E67E22", "#2980B9", "#C0392B", "#16A085", "#D35400", "#2C3E50", "#7F8C8D"
    ]

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
                    Button(action: { colorPickerTarget = .new }) {
                        Circle()
                            .fill(Color(hex: newColor))
                            .frame(width: 28, height: 28)
                            .overlay(Circle().stroke(Color.borderInput, lineWidth: 1))
                    }
                    .buttonStyle(PlainButtonStyle())

                    TextField("tm_type_name_hint".localized, text: $newTitle)
                        .inputStyle()

                    Button(action: {
                        let trimmed = newTitle.trimmingCharacters(in: .whitespaces)
                        guard !trimmed.isEmpty else { return }
                        // Web/Android parity: duplicate name + color validation
                        if viewModel.scheduleTypes.contains(where: { $0.title.lowercased() == trimmed.lowercased() }) {
                            viewModel.errorMessage = "A type with this name already exists."
                            return
                        }
                        if viewModel.scheduleTypes.contains(where: { $0.color.lowercased() == newColor.lowercased() }) {
                            viewModel.errorMessage = "This color is already used by another type."
                            return
                        }
                        typeCountAtCreate = viewModel.scheduleTypes.count
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
        .onChange(of: viewModel.scheduleTypes.count) { newCount in
            // Auto-dismiss once the server confirms the newly created type appeared.
            // CreateScheduleView then observes the same count bump and auto-selects it.
            if typeCountAtCreate >= 0 && newCount > typeCountAtCreate {
                typeCountAtCreate = -1
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                    presentationMode.wrappedValue.dismiss()
                }
            }
        }
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
        .sheet(item: $colorPickerTarget) { target in
            ColorPaletteSheet(
                availableColors: availableColors,
                initialColor: target == .new ? newColor : editColor,
                onPick: { picked in
                    if target == .new { newColor = picked }
                    else { editColor = picked }
                    colorPickerTarget = nil
                },
                onCancel: { colorPickerTarget = nil }
            )
        }
    }

    private func typeRow(_ type: ScheduleType) -> some View {
        HStack(spacing: 12) {
            // Color circle — tappable in edit mode
            Button(action: {
                if editingId == type.id { colorPickerTarget = .edit }
            }) {
                Circle()
                    .fill(Color(hex: editingId == type.id ? editColor : type.color))
                    .frame(width: 28, height: 28)
                    .overlay(Circle().stroke(
                        editingId == type.id ? Color.primaryAccent : Color.borderInput,
                        lineWidth: editingId == type.id ? 2 : 1
                    ))
            }
            .buttonStyle(PlainButtonStyle())
            .disabled(editingId != type.id)

            if editingId == type.id {
                TextField("tm_type_name_hint".localized, text: $editTitle)
                    .inputStyle()

                Button(action: {
                    let trimmed = editTitle.trimmingCharacters(in: .whitespaces)
                    guard !trimmed.isEmpty else { return }
                    viewModel.updateType(id: type.id, title: trimmed, color: editColor)
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
                        editColor = type.color
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

// MARK: - Color Palette Sheet

/// Modal sheet with 14 preset color swatches and a custom hex input.
struct ColorPaletteSheet: View {
    let availableColors: [String]
    let initialColor: String
    let onPick: (String) -> Void
    let onCancel: () -> Void

    @State private var selected: String
    @State private var hexInput: String = ""
    @State private var pickerColor: Color

    init(availableColors: [String], initialColor: String, onPick: @escaping (String) -> Void, onCancel: @escaping () -> Void) {
        self.availableColors = availableColors
        self.initialColor = initialColor
        self.onPick = onPick
        self.onCancel = onCancel
        self._selected = State(initialValue: initialColor)
        self._pickerColor = State(initialValue: Color(hex: initialColor))
    }

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 8), count: 7)

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Pick a color")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(.textPrimary)
                Spacer()
                Button(action: onCancel) {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.textSubtle)
                }
            }

            // Preview of current selection
            HStack(spacing: 12) {
                Circle()
                    .fill(Color(hex: selected))
                    .frame(width: 36, height: 36)
                    .overlay(Circle().stroke(Color.borderInput, lineWidth: 1))
                Text(selected.uppercased())
                    .font(.system(size: 14, weight: .medium).monospacedDigit())
                    .foregroundColor(.textBody)
                Spacer()
            }

            // 14 preset swatches in 2 rows of 7
            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(availableColors, id: \.self) { hex in
                    Button(action: {
                        selected = hex
                        pickerColor = Color(hex: hex)
                    }) {
                        Circle()
                            .fill(Color(hex: hex))
                            .frame(width: 34, height: 34)
                            .overlay(
                                Circle().stroke(
                                    selected.lowercased() == hex.lowercased() ? Color.solidDark : Color.borderInput,
                                    lineWidth: selected.lowercased() == hex.lowercased() ? 2 : 1
                                )
                            )
                    }
                    .buttonStyle(PlainButtonStyle())
                }
            }

            // Native iOS HSV color picker (iOS 14+)
            HStack {
                Text("FULL COLOR PICKER").sectionLabel()
                Spacer()
                ColorPicker("", selection: $pickerColor, supportsOpacity: false)
                    .labelsHidden()
                    .onChange(of: pickerColor) { newColor in
                        selected = hexString(from: newColor)
                    }
            }

            // Custom hex input
            VStack(alignment: .leading, spacing: 4) {
                Text("CUSTOM HEX").sectionLabel()
                HStack(spacing: 8) {
                    TextField("#RRGGBB", text: $hexInput)
                        .inputStyle()
                        .autocapitalization(.allCharacters)
                        .disableAutocorrection(true)
                    Button(action: applyHex) {
                        Text("Apply")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(.primaryAccent)
                    }
                    .secondaryButtonStyle()
                }
            }

            Spacer()

            // Done button
            Button(action: { onPick(selected) }) {
                Text("Done")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(.solidDarkText)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color.solidDark)
                    .cornerRadius(10)
            }
        }
        .padding(20)
        .background(Color.pageBg.ignoresSafeArea())
    }

    private func applyHex() {
        let raw = hexInput.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalized = raw.hasPrefix("#") ? raw : "#\(raw)"
        // Validate 7 (#RRGGBB) or 9 (#RRGGBBAA) chars of valid hex
        let valid = (normalized.count == 7 || normalized.count == 9) &&
            normalized.dropFirst().allSatisfy { $0.isHexDigit }
        if valid {
            selected = normalized.uppercased()
            pickerColor = Color(hex: normalized)
            hexInput = ""
        }
    }

    /// Converts a SwiftUI Color to a #RRGGBB hex string.
    private func hexString(from color: Color) -> String {
        let uic = UIColor(color)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        uic.getRed(&r, green: &g, blue: &b, alpha: &a)
        return String(format: "#%02X%02X%02X",
                      Int((r * 255).rounded()),
                      Int((g * 255).rounded()),
                      Int((b * 255).rounded()))
    }
}
