import ExpoModulesCore

public class IosBgTaskAppDelegate: ExpoAppDelegateSubscriber {
    public func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        IosBgTaskModule.shared?.setupBackgroundTasks()
        return true
    }
}
