import Foundation

/// Box Schedule API endpoint + static headers.
/// `moduledata` and `bodyhash` are stored here so call sites never inline them.
enum APIConstants {
    static let boxScheduleBaseURL = "https://productionapi-dev.zillit.com/api/v2/box-schedule"

    static let accept = "application/json"
    static let acceptCharset = "UTF-8"
    static let timezone = "Asia/Kolkata"
    static let bodyhash = "502d11c05b36af506ed969b29b3f73c43f83ce85bc303640a24c9da032c2eb56"
    static let moduledata = "695308702698fdd102cb91252812508cff101e70dedfbb4a8b6419e914f88f30b5d938cfff5f8475812d7563bd035597d5fd2a7e452841c7b1e93b1eec49ff92912f3340142cb14f1b08e296752e00e824838b64c5dd6aebcf0e1d6cfe39701ff9bb9c6777d3d540c791c2f5122294bbf3ece41736016111cf4163fe5ce4926c32298be1c15af9a6c06c58ce50aeb2dd99b2ddb1a97613f8e2cb7c1793b6ab5a0bec790e9dff7cbbeef730215574c20ad2b3c1a38741bd4c48e4f3b45013f946c95e44b8d99d6c2ecfcb2147b8b513ef"
}
