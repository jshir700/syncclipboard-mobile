import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers

/// iOS Share Extension — receives shared content from other apps
/// and stores it in the App Group shared container for the main app to pick up.
@objc(ShareViewController)
class ShareViewController: UIViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        handleSharedContent()
    }

    private func handleSharedContent() {
        guard let extensionContext = extensionContext,
              let inputItems = extensionContext.inputItems as? [NSExtensionItem] else {
            completeRequest()
            return
        }

        var sharedText: String? = nil
        var sharedFileUrl: URL? = nil
        var sharedFileName: String? = nil

        let group = DispatchGroup()

        for item in inputItems {
            guard let attachments = item.attachments else { continue }

            for provider in attachments {
                // Text
                if provider.hasItemConformingToTypeIdentifier(UTType.text.identifier) {
                    group.enter()
                    provider.loadItem(forTypeIdentifier: UTType.text.identifier, options: nil) { (item, error) in
                        if let text = item as? String {
                            sharedText = text
                        } else if let url = item as? URL {
                            sharedText = try? String(contentsOf: url)
                        }
                        group.leave()
                    }
                }

                // URL
                if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    group.enter()
                    provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { (item, error) in
                        if let url = item as? URL {
                            sharedText = url.absoluteString
                        } else if let text = item as? String {
                            sharedText = text
                        }
                        group.leave()
                    }
                }

                // Image / File
                if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) ||
                   provider.hasItemConformingToTypeIdentifier(UTType.data.identifier) {
                    group.enter()
                    if let typeIdentifier = provider.registeredTypeIdentifiers.first {
                        provider.loadFileRepresentation(forTypeIdentifier: typeIdentifier) { (url, error) in
                            if let url = url {
                                sharedFileUrl = url
                                sharedFileName = url.lastPathComponent
                            }
                            group.leave()
                        }
                    } else {
                        group.leave()
                    }
                }
            }
        }

        group.notify(queue: .main) { [weak self] in
            self?.saveToSharedContainer(
                text: sharedText,
                fileUrl: sharedFileUrl,
                fileName: sharedFileName
            )
            self?.completeRequest()
        }
    }

    private func saveToSharedContainer(text: String?, fileUrl: URL?, fileName: String?) {
        guard let appGroupId = Bundle.main.object(
            forInfoDictionaryKey: "AppGroupIdentifier"
        ) as? String else { return }

        guard let containerUrl = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupId
        ) else { return }

        var payload: [String: String] = [:]
        payload["timestamp"] = String(Date().timeIntervalSince1970)

        if let text = text {
            payload["text"] = text
        }

        if let fileUrl = fileUrl, let fileName = fileName {
            let destUrl = containerUrl.appendingPathComponent(fileName)
            try? FileManager.default.removeItem(at: destUrl)
            try? FileManager.default.copyItem(at: fileUrl, to: destUrl)
            payload["fileName"] = fileName
            payload["filePath"] = destUrl.path
        }

        // Write payload as JSON to shared container
        let payloadUrl = containerUrl.appendingPathComponent("shared_payload.json")
        if let jsonData = try? JSONSerialization.data(withJSONObject: payload) {
            try? jsonData.write(to: payloadUrl)
        }
    }

    private func completeRequest() {
        extensionContext?.completeRequest(returningItems: nil)
    }
}
