import SwiftUI

/// BoxScheduleView — uses NavigationLink for all sub-screens (no sheets).
/// Fixes iOS 14 "only presenting a single sheet is supported" error.
struct BoxScheduleView: View {
    @EnvironmentObject var authManager: AuthManager
    @EnvironmentObject var themeManager: ThemeManager
    @StateObject private var viewModel = BoxScheduleViewModel()

    @State private var toastMessage: String?
    @State private var showToast = false
    @State private var showViewDefaultSheet = false

    // Navigation destinations (using NavigationLink with isActive)
    @State private var navToHistory = false
    @State private var navToShare = false
    @State private var navToTypeManager = false
    @State private var navToCreateSchedule = false
    @State private var navToCreateEvent = false
    @State private var navToCreateNote = false
    @State private var navToDayDetail = false
    @State private var navToPresets = false
    @State private var showViewDefaultPopover = false

    private let viewDefaultKey = "box-schedule-default-view"

    var body: some View {
        NavigationView {
            ZStack {
                Color.pageBg.ignoresSafeArea()

                VStack(spacing: 0) {
                    headerSection
                    viewToggleSection
                    contentSection
                }

                // Refreshing indicator (non-blocking) — top-right
                VStack {
                    HStack { Spacer(); refreshingIndicator }
                    Spacer()
                }
                .zIndex(50)
                .allowsHitTesting(false)

                // Hidden NavigationLinks (triggered by state)
                hiddenNavigationLinks

                // Toast
                if showToast, let msg = toastMessage {
                    VStack {
                        Spacer()
                        Text(msg)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(.solidDarkText)
                            .padding(.horizontal, 16).padding(.vertical, 10)
                            .background(Color.solidDark)
                            .cornerRadius(8).shadow(radius: 4)
                            .padding(.bottom, 30)
                            .onAppear {
                                DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                                    withAnimation { showToast = false; toastMessage = nil }
                                }
                            }
                    }
                    .zIndex(100)
                }

                // Set Default Popover (rendered at root ZStack level — always on top)
                if showViewDefaultPopover {
                    Color.black.opacity(0.01).ignoresSafeArea()
                        .onTapGesture { showViewDefaultPopover = false }
                    VStack {
                        SetDefaultPopover(
                            title: "dv_choose_title".localized,
                            subtitle: "This view will load first every time you open Box Schedule.",
                            options: [
                                (value: "calendar", label: "bs_calendar_view".localized, desc: "dv_calendar_desc".localized),
                                (value: "list", label: "bs_list_view".localized, desc: "dv_list_desc".localized),
                            ],
                            currentValue: UserDefaults.standard.string(forKey: viewDefaultKey) ?? "calendar",
                            onSelect: { selected in
                                UserDefaults.standard.set(selected, forKey: viewDefaultKey)
                                DispatchQueue.main.async { viewModel.activeView = selected }
                                toastMessage = "dv_default_set".localized.localized(with: selected == "calendar" ? "bs_calendar_view".localized : "bs_list_view".localized)
                                showToast = true
                            },
                            onDismiss: { showViewDefaultPopover = false }
                        )
                        Spacer()
                    }
                    .padding(.top, 130) // Below the Set Default button area
                    .padding(.trailing, 12)
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .zIndex(200)
                }

                // Drawer
                if viewModel.showDrawer { drawerOverlay }
            }
            .navigationBarHidden(true)
        }
        .navigationViewStyle(StackNavigationViewStyle())
        .onAppear {
            DispatchQueue.main.async {
                if let saved = UserDefaults.standard.string(forKey: viewDefaultKey),
                   ["calendar", "list"].contains(saved), viewModel.activeView != saved {
                    viewModel.activeView = saved
                }
                viewModel.loadAll()
            }
        }
        .overlay(loadingOverlay)
        .alert(isPresented: Binding(
            get: { viewModel.errorMessage != nil },
            set: { if !$0 { viewModel.errorMessage = nil } }
        )) {
            Alert(title: Text("bs_error_title".localized), message: Text(viewModel.errorMessage ?? ""), dismissButton: .default(Text("bs_ok".localized)))
        }
    }

    // MARK: - Hidden NavigationLinks
    private var hiddenNavigationLinks: some View {
        VStack {
            NavigationLink(destination: HistoryView(viewModel: viewModel), isActive: $navToHistory) { EmptyView() }
            NavigationLink(destination: ShareView(viewModel: viewModel), isActive: $navToShare) { EmptyView() }
            NavigationLink(destination: TypeManagerView(viewModel: viewModel), isActive: $navToTypeManager) { EmptyView() }
            NavigationLink(destination: PresetListView(), isActive: $navToPresets) { EmptyView() }
            NavigationLink(destination: CreateScheduleView(viewModel: viewModel), isActive: $navToCreateSchedule) { EmptyView() }
            NavigationLink(destination: CreateEventView(viewModel: viewModel, mode: "event"), isActive: $navToCreateEvent) { EmptyView() }
            NavigationLink(destination: CreateEventView(viewModel: viewModel, mode: "note"), isActive: $navToCreateNote) { EmptyView() }
            // SetDefault popover is inline — no NavigationLink needed

            if let dayKey = viewModel.selectedDayKey {
                NavigationLink(destination: DayDetailView(
                    dayKey: dayKey,
                    schedules: viewModel.dayLookup[dayKey] ?? [],
                    viewModel: viewModel
                ), isActive: $navToDayDetail) { EmptyView() }
            }
        }
        .frame(width: 0, height: 0).hidden()
    }

    // MARK: - Loading
    private var loadingOverlay: some View {
        Group {
            if viewModel.isLoading {
                ZStack {
                    Color.black.opacity(0.2).ignoresSafeArea()
                    ProgressView("bs_loading".localized)
                        .padding(24).background(Color.surface).cornerRadius(12).shadow(radius: 4)
                }
            }
        }
    }

    // MARK: - Header (Back + hamburger only — all actions live in the drawer)
    private var headerSection: some View {
        VStack(spacing: 4) {
            HStack {
                Button(action: { authManager.logout() }) {
                    HStack(spacing: 2) {
                        Image(systemName: "chevron.left").font(.system(size: 14))
                        Text("bs_back_to_tools".localized).font(.system(size: 12))
                    }
                    .foregroundColor(.textMuted)
                }
                Spacer()
                Button(action: { withAnimation(.easeInOut(duration: 0.25)) { viewModel.showDrawer = true } }) {
                    Image(systemName: "line.3.horizontal").font(.system(size: 20, weight: .medium)).foregroundColor(.textPrimary).frame(width: 36, height: 36)
                }
            }
            .padding(.horizontal, 16).padding(.top, 8)

            Text("bs_title".localized)
                .font(.custom("Georgia", size: 18)).fontWeight(.bold).tracking(2).foregroundColor(.textPrimary).textCase(.uppercase)
            Text("bs_prepared".localized.localized(with: DateUtils.formatDate(DateUtils.toEpoch(Date()))))
                .font(.system(size: 11)).foregroundColor(.textMuted).padding(.bottom, 8)
        }
        .background(LinearGradient(colors: [Color.surface, Color.surfaceAlt], startPoint: .top, endPoint: .bottom))
        .overlay(Rectangle().frame(height: 1).foregroundColor(.appBorder), alignment: .bottom)
    }


    // MARK: - Refreshing indicator (web parity: BoxSchedulePage.jsx:451-461)
    private var refreshingIndicator: some View {
        Group {
            if viewModel.isLoading && !viewModel.scheduleDays.isEmpty {
                HStack(spacing: 6) {
                    ProgressView().scaleEffect(0.7)
                    Text("Refreshing…")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(.textMuted)
                }
                .padding(.horizontal, 12).padding(.vertical, 4)
                .background(Color.surface.opacity(0.95))
                .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color.appBorder, lineWidth: 1))
                .cornerRadius(20)
                .shadow(color: Color.black.opacity(0.08), radius: 4)
                .padding(.top, 12).padding(.trailing, 16)
            }
        }
    }

    // MARK: - View Toggle + Set Default + Legend
    private var viewToggleSection: some View {
        VStack(spacing: 6) {
            HStack(spacing: 8) {
                Picker("", selection: $viewModel.activeView) {
                    Text("bs_calendar_view".localized).tag("calendar")
                    Text("bs_list_view".localized).tag("list")
                }
                .pickerStyle(SegmentedPickerStyle())

                Button(action: { showViewDefaultPopover.toggle() }) {
                    HStack(spacing: 3) {
                        Image(systemName: "square.grid.2x2").font(.system(size: 10))
                        Text("bs_set_default".localized).font(.system(size: 10, weight: .medium))
                    }
                    .foregroundColor(.textSecondary)
                    .padding(.horizontal, 8).padding(.vertical, 5)
                    .background(Color.surface).cornerRadius(6)
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.borderButton, lineWidth: 1))
                }
            }
            .padding(.horizontal, 12).padding(.top, 6)

            if !viewModel.scheduleTypes.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(viewModel.visibleTypes) { type in
                            HStack(spacing: 4) {
                                RoundedRectangle(cornerRadius: 2).fill(Color(hex: type.color)).frame(width: 10, height: 10)
                                Text(type.title).font(.system(size: 11, weight: .medium)).foregroundColor(.textSecondary)
                            }
                        }
                        if viewModel.hiddenTypeCount > 0 {
                            Button(action: { navToTypeManager = true }) {
                                Text("legend_more".localized.localized(with: viewModel.hiddenTypeCount))
                                    .font(.system(size: 10, weight: .bold)).foregroundColor(.textSecondary)
                                    .padding(.horizontal, 8).padding(.vertical, 3)
                                    .background(Color.surfaceAlt).cornerRadius(10)
                                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.borderButton, lineWidth: 1))
                            }
                        }
                    }
                    .padding(.horizontal, 12)
                }
                .padding(.bottom, 6)
            }
        }
    }

    // MARK: - Content
    private var contentSection: some View {
        Group {
            if viewModel.activeView == "calendar" {
                ScheduleCalendarView(
                    viewModel: viewModel,
                    onDayTap: { dayKey in
                        viewModel.selectedDayKey = dayKey
                        navToDayDetail = true
                    }
                )
            } else {
                ScheduleListView(
                    viewModel: viewModel,
                    onDayTap: { dayKey in
                        viewModel.selectedDayKey = dayKey
                        navToDayDetail = true
                    }
                )
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Drawer
    private var drawerOverlay: some View {
        ZStack(alignment: .trailing) {
            Color.black.opacity(0.4).ignoresSafeArea()
                .onTapGesture { withAnimation(.easeInOut(duration: 0.25)) { viewModel.showDrawer = false } }

            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text("Menu").font(.system(size: 18, weight: .bold)).foregroundColor(.textPrimary)
                    Spacer()
                    Button(action: { withAnimation(.easeInOut(duration: 0.25)) { viewModel.showDrawer = false } }) {
                        Image(systemName: "xmark").font(.system(size: 16, weight: .semibold)).foregroundColor(.textMuted).frame(width: 32, height: 32)
                    }
                }
                .padding(16).background(Color.surfaceAlt)
                .overlay(Rectangle().frame(height: 1).foregroundColor(.appBorder), alignment: .bottom)

                ScrollView {
                    VStack(spacing: 0) {
                        drawerItem(icon: "calendar.badge.plus", label: "bs_create_schedule".localized, color: .primaryAccent) {
                            closeDrawerAnd { navToCreateSchedule = true }
                        }
                        drawerItem(icon: "clock.badge.fill", label: "bs_create_event".localized, color: .actionChanged) {
                            closeDrawerAnd { navToCreateEvent = true }
                        }
                        drawerItem(icon: "note.text.badge.plus", label: "bs_create_note".localized, color: .actionCopied) {
                            closeDrawerAnd { navToCreateNote = true }
                        }
                        drawerDivider
                        drawerItem(icon: "slider.horizontal.3", label: "bs_edit_types".localized, color: .textSecondary) {
                            closeDrawerAnd { navToTypeManager = true }
                        }
                        drawerItem(icon: "star.fill", label: "Presets", color: .primaryAccent) {
                            closeDrawerAnd { navToPresets = true }
                        }
                        drawerItem(icon: "clock.arrow.circlepath", label: "bs_history".localized, color: .textSecondary) {
                            closeDrawerAnd { navToHistory = true }
                        }
                        drawerDivider
                        HStack(spacing: 12) {
                            Image(systemName: themeManager.isDark ? "sun.max.fill" : "moon.fill").font(.system(size: 18))
                                .foregroundColor(themeManager.isDark ? .primaryAccent : .textMuted).frame(width: 28)
                            Text(themeManager.isDark ? "Light Mode" : "Dark Mode").font(.system(size: 15, weight: .medium)).foregroundColor(.textPrimary)
                            Spacer()
                            Toggle("", isOn: Binding(get: { themeManager.isDark }, set: { _ in themeManager.toggleTheme() })).labelsHidden().accentColor(.primaryAccent)
                        }
                        .padding(.horizontal, 16).padding(.vertical, 14)
                    }
                }

                Spacer()
                HStack(spacing: 10) {
                    Text(String(authManager.userName.prefix(1)).uppercased()).font(.system(size: 14, weight: .bold)).foregroundColor(.primaryAccent)
                        .frame(width: 32, height: 32).background(Color.primaryAccent.opacity(0.1)).clipShape(Circle())
                    VStack(alignment: .leading, spacing: 1) {
                        Text(authManager.userName).font(.system(size: 13, weight: .semibold)).foregroundColor(.textPrimary)
                    }
                    Spacer()
                    Button(action: { authManager.logout() }) {
                        Image(systemName: "rectangle.portrait.and.arrow.right").font(.system(size: 16)).foregroundColor(.dangerBg)
                    }
                }
                .padding(16).background(Color.surfaceAlt)
                .overlay(Rectangle().frame(height: 1).foregroundColor(.appBorder), alignment: .top)
            }
            .frame(width: UIScreen.main.bounds.width * 0.75)
            .background(Color.surface)
            .transition(.move(edge: .trailing))
        }
    }

    private func drawerItem(icon: String, label: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon).font(.system(size: 18)).foregroundColor(color).frame(width: 28)
                Text(label).font(.system(size: 15, weight: .medium)).foregroundColor(.textPrimary)
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 12)).foregroundColor(.textPlaceholder)
            }
            .padding(.horizontal, 16).padding(.vertical, 14).background(Color.surface)
        }
    }

    private var drawerDivider: some View {
        Rectangle().fill(Color.appBorder).frame(height: 1).padding(.horizontal, 16).padding(.vertical, 4)
    }

    private func closeDrawerAnd(_ action: @escaping () -> Void) {
        withAnimation(.easeInOut(duration: 0.25)) { viewModel.showDrawer = false }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { action() }
    }
}
