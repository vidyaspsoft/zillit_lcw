import SwiftUI
import MapKit

/// Result returned by the map picker.
struct PickedLocation: Equatable {
    var address: String
    var lat: Double
    var lng: Double
}

/// Full-screen map picker. User searches an address or drags the pin;
/// confirms with the bottom button. Uses MKLocalSearch for suggestions
/// and CLGeocoder for reverse-geocoding the dropped pin.
struct MapPickerView: View {
    let initial: PickedLocation?
    let onConfirm: (PickedLocation) -> Void
    let onCancel: () -> Void

    // Default region: India centroid; overridden by `initial` if provided.
    @State private var region = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 22.0, longitude: 79.0),
        span: MKCoordinateSpan(latitudeDelta: 20, longitudeDelta: 20)
    )
    @State private var pinCoordinate: CLLocationCoordinate2D?
    @State private var address: String = ""

    @State private var query: String = ""
    @State private var suggestions: [MKLocalSearchCompletion] = []
    @StateObject private var completer = SearchCompleter()
    @State private var queryFocused: Bool = false

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                searchBar
                if !suggestions.isEmpty && queryFocused {
                    suggestionList
                }
                ZStack(alignment: .center) {
                    MapRepresentable(region: $region, pin: $pinCoordinate, onTap: handleMapTap)
                    if pinCoordinate != nil {
                        // Center pin overlay (the actual annotation lives on the map).
                        Image(systemName: "mappin.and.ellipse")
                            .font(.system(size: 32))
                            .foregroundColor(Color.primaryAccent)
                            .shadow(radius: 2)
                            .allowsHitTesting(false)
                    }
                }
                addressBar
                confirmBar
            }
            .navigationTitle("Pick Location")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { onCancel() }
                }
            }
            .onAppear { restoreInitial() }
            .onChange(of: query) { newValue in
                completer.update(query: newValue)
            }
            .onReceive(completer.$results) { results in
                suggestions = results
            }
        }
    }

    // MARK: - Subviews

    private var searchBar: some View {
        HStack {
            Image(systemName: "magnifyingglass").foregroundColor(.secondary)
            TextField("Search location…", text: $query, onEditingChanged: { editing in
                queryFocused = editing
            }, onCommit: { runDirectSearch() })
            if !query.isEmpty {
                Button { query = "" } label: {
                    Image(systemName: "xmark.circle.fill").foregroundColor(.secondary)
                }
            }
        }
        .padding(10)
        .background(Color.surface)
        .overlay(Rectangle().frame(height: 1).foregroundColor(Color.borderInput.opacity(0.5)), alignment: .bottom)
    }

    private var suggestionList: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                ForEach(suggestions, id: \.self) { item in
                    Button {
                        selectSuggestion(item)
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.title).font(.subheadline).foregroundColor(.primary)
                            if !item.subtitle.isEmpty {
                                Text(item.subtitle).font(.caption).foregroundColor(.secondary)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                    }
                    Divider()
                }
            }
        }
        .background(Color.surface)
        .frame(maxHeight: 220)
    }

    private var addressBar: some View {
        Group {
            if !address.isEmpty {
                HStack(alignment: .top) {
                    Image(systemName: "location.fill").foregroundColor(Color.primaryAccent)
                    Text(address).font(.subheadline).lineLimit(2)
                    Spacer()
                }
                .padding(12)
                .background(Color.surfaceAlt)
            }
        }
    }

    private var confirmBar: some View {
        HStack {
            Button(action: onCancel) {
                Text("Cancel")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .background(Color.surfaceAlt)
            .foregroundColor(Color.textBody)
            .cornerRadius(10)

            Button {
                guard let c = pinCoordinate, !address.isEmpty else { return }
                onConfirm(PickedLocation(address: address, lat: c.latitude, lng: c.longitude))
            } label: {
                Text("Confirm")
                    .font(.system(size: 16, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .background(pinCoordinate == nil || address.isEmpty ? Color.gray.opacity(0.3) : Color.primaryAccent)
            .foregroundColor(.white)
            .cornerRadius(10)
            .disabled(pinCoordinate == nil || address.isEmpty)
        }
        .padding(12)
        .background(Color.surface)
    }

    // MARK: - Actions

    private func restoreInitial() {
        if let initial = initial {
            let coord = CLLocationCoordinate2D(latitude: initial.lat, longitude: initial.lng)
            pinCoordinate = coord
            address = initial.address
            region = MKCoordinateRegion(center: coord, span: MKCoordinateSpan(latitudeDelta: 0.02, longitudeDelta: 0.02))
        }
    }

    private func handleMapTap(_ coord: CLLocationCoordinate2D) {
        pinCoordinate = coord
        reverseGeocode(coord)
    }

    private func selectSuggestion(_ completion: MKLocalSearchCompletion) {
        let request = MKLocalSearch.Request(completion: completion)
        MKLocalSearch(request: request).start { resp, _ in
            guard let item = resp?.mapItems.first else { return }
            DispatchQueue.main.async {
                let coord = item.placemark.coordinate
                pinCoordinate = coord
                address = formatAddress(item.placemark) ?? completion.title
                region = MKCoordinateRegion(center: coord, span: MKCoordinateSpan(latitudeDelta: 0.02, longitudeDelta: 0.02))
                query = address
                queryFocused = false
                suggestions = []
            }
        }
    }

    private func runDirectSearch() {
        let req = MKLocalSearch.Request()
        req.naturalLanguageQuery = query
        MKLocalSearch(request: req).start { resp, _ in
            guard let item = resp?.mapItems.first else { return }
            DispatchQueue.main.async {
                let coord = item.placemark.coordinate
                pinCoordinate = coord
                address = formatAddress(item.placemark) ?? query
                region = MKCoordinateRegion(center: coord, span: MKCoordinateSpan(latitudeDelta: 0.02, longitudeDelta: 0.02))
                queryFocused = false
            }
        }
    }

    private func reverseGeocode(_ coord: CLLocationCoordinate2D) {
        CLGeocoder().reverseGeocodeLocation(CLLocation(latitude: coord.latitude, longitude: coord.longitude)) { placemarks, _ in
            guard let pm = placemarks?.first else { return }
            DispatchQueue.main.async {
                address = formatAddress(MKPlacemark(placemark: pm)) ?? "\(coord.latitude), \(coord.longitude)"
            }
        }
    }

    private func formatAddress(_ pm: MKPlacemark) -> String? {
        var parts: [String] = []
        if let n = pm.name, !n.isEmpty { parts.append(n) }
        if let s = pm.locality, !s.isEmpty, !parts.contains(s) { parts.append(s) }
        if let r = pm.administrativeArea, !r.isEmpty { parts.append(r) }
        if let c = pm.country, !c.isEmpty { parts.append(c) }
        return parts.isEmpty ? nil : parts.joined(separator: ", ")
    }
}

// MARK: - Search completer

@MainActor
private final class SearchCompleter: NSObject, ObservableObject, MKLocalSearchCompleterDelegate {
    private let completer = MKLocalSearchCompleter()
    @Published var results: [MKLocalSearchCompletion] = []

    override init() {
        super.init()
        completer.delegate = self
    }

    func update(query: String) {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty {
            results = []
            return
        }
        completer.queryFragment = trimmed
    }

    nonisolated func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        Task { @MainActor in
            self.results = completer.results
        }
    }
    nonisolated func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        Task { @MainActor in
            self.results = []
        }
    }
}

// MARK: - Map (UIViewRepresentable so we can capture taps)

private struct MapRepresentable: UIViewRepresentable {
    @Binding var region: MKCoordinateRegion
    @Binding var pin: CLLocationCoordinate2D?
    var onTap: (CLLocationCoordinate2D) -> Void

    func makeUIView(context: Context) -> MKMapView {
        let map = MKMapView()
        map.delegate = context.coordinator
        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handleTap(_:)))
        map.addGestureRecognizer(tap)
        return map
    }

    func updateUIView(_ map: MKMapView, context: Context) {
        if !areClose(map.region.center, region.center) {
            map.setRegion(region, animated: false)
        }
        // Refresh annotation
        map.removeAnnotations(map.annotations)
        if let p = pin {
            let ann = MKPointAnnotation()
            ann.coordinate = p
            map.addAnnotation(ann)
        }
    }

    private func areClose(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Bool {
        abs(a.latitude - b.latitude) < 0.000001 && abs(a.longitude - b.longitude) < 0.000001
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, MKMapViewDelegate {
        let parent: MapRepresentable
        init(_ parent: MapRepresentable) { self.parent = parent }

        @objc func handleTap(_ gesture: UITapGestureRecognizer) {
            guard let map = gesture.view as? MKMapView else { return }
            let point = gesture.location(in: map)
            let coord = map.convert(point, toCoordinateFrom: map)
            parent.onTap(coord)
        }
    }
}
