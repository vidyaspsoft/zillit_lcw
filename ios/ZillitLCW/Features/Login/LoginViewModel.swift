import Foundation
import Combine

/// LoginViewModel — handles login form validation.
/// Phase 2: Will connect to actual API via AuthManager.
class LoginViewModel: ObservableObject {

    func isValidEmail(_ email: String) -> Bool {
        let emailRegex = "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}"
        return NSPredicate(format: "SELF MATCHES %@", emailRegex).evaluate(with: email)
    }
}
