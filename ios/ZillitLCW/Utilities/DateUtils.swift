import Foundation

struct DateUtils {
    static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "MMM d, yyyy"
        return f
    }()

    static let timeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "h:mm a"
        return f
    }()

    static let dayNameFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "EEEE"
        return f
    }()

    static let monthYearFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "MMMM yyyy"
        return f
    }()

    static let shortDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "MMM d"
        return f
    }()

    static let fullDayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "EEEE, MMM d, yyyy"
        return f
    }()

    static func fromEpoch(_ ms: Int64) -> Date {
        Date(timeIntervalSince1970: TimeInterval(ms) / 1000.0)
    }

    static func toEpoch(_ date: Date) -> Int64 {
        Int64(date.timeIntervalSince1970 * 1000)
    }

    static func formatDate(_ ms: Int64) -> String {
        dateFormatter.string(from: fromEpoch(ms))
    }

    static func formatTime(_ ms: Int64) -> String {
        timeFormatter.string(from: fromEpoch(ms))
    }

    static func formatDayName(_ ms: Int64) -> String {
        dayNameFormatter.string(from: fromEpoch(ms))
    }

    static func formatMonthYear(_ date: Date) -> String {
        monthYearFormatter.string(from: date)
    }

    static func formatShortDate(_ ms: Int64) -> String {
        shortDateFormatter.string(from: fromEpoch(ms))
    }

    static let dayMonthFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "EEE, MMM d"
        return f
    }()

    static func formatDayMonth(_ ms: Int64) -> String {
        dayMonthFormatter.string(from: fromEpoch(ms))
    }

    static func formatFullDay(_ ms: Int64) -> String {
        fullDayFormatter.string(from: fromEpoch(ms))
    }

    static func isToday(_ ms: Int64) -> Bool {
        Calendar.current.isDateInToday(fromEpoch(ms))
    }

    static func isPast(_ ms: Int64) -> Bool {
        fromEpoch(ms) < Calendar.current.startOfDay(for: Date())
    }

    static func isWeekend(_ ms: Int64) -> Bool {
        Calendar.current.isDateInWeekend(fromEpoch(ms))
    }
}
