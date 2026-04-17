import Foundation

/// Standard API response envelope.
/// `messageElements` is optional because auth endpoints don't include it.
struct APIResponse<T: Decodable>: Decodable {
    let status: Int
    let message: String
    let messageElements: [String]?
    let data: T?
}
