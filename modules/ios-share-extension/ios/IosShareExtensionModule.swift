import ExpoModulesCore
import Foundation

/// Native module that provides the App Group container URL to JS,
/// and watches for incoming shared content.
public class IosShareExtensionModule: Module {
    private let appGroupId = "group.com.jshir700.syncclipboardmobile"
    private var pollTimer: Timer?

    public func definition() -> ModuleDefinition {
        Name("IosShareExtension")

        Function("getContainerUrl") { () -> String in
            if let url = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: self.appGroupId
            ) {
                return url.absoluteString
            }
            return ""
        }

        Function("getSharedPayload") { () -> [String: Any]? in
            guard let containerUrl = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: self.appGroupId
            ) else { return nil }

            let payloadUrl = containerUrl.appendingPathComponent("shared_payload.json")
            guard FileManager.default.fileExists(atPath: payloadUrl.path),
                  let data = try? Data(contentsOf: payloadUrl),
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                return nil
            }

            // Delete after reading
            try? FileManager.default.removeItem(at: payloadUrl)
            return json
        }

        Events("onSharedContentReceived")
    }
}
