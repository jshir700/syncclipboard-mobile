import ExpoModulesCore
import BackgroundTasks

let BG_REFRESH_TASK_ID = "com.jshir700.syncclipboardmobile.refresh"
let BG_PROCESSING_TASK_ID = "com.jshir700.syncclipboardmobile.processing"

func handleAppRefresh(task: BGAppRefreshTask) {
    task.expirationHandler = { task.setTaskCompleted(success: false) }
    IosBgTaskModule.shared?.performRefresh { success in
        task.setTaskCompleted(success: success)
    }
}

func handleProcessingTask(task: BGProcessingTask) {
    task.expirationHandler = { task.setTaskCompleted(success: false) }
    IosBgTaskModule.shared?.performProcessing { success in
        task.setTaskCompleted(success: success)
    }
}

public class IosBgTaskModule: Module {
    public static var shared: IosBgTaskModule?

    private var currentRefreshCompletion: ((Bool) -> Void)?
    private var currentProcessingCompletion: ((Bool) -> Void)?

    public func definition() -> ModuleDefinition {
        Name("IosBgTask")

        OnCreate {
            IosBgTaskModule.shared = self
            setupBackgroundTasks()
        }

        Function("registerBackgroundTasks") { self.setupBackgroundTasks() }

        Function("scheduleAppRefresh") { (delaySeconds: Double?) in
            let delay = delaySeconds ?? 900
            let request = BGAppRefreshTaskRequest(identifier: BG_REFRESH_TASK_ID)
            request.earliestBeginDate = Date(timeIntervalSinceNow: delay)
            try? BGTaskScheduler.shared.submit(request)
        }

        Function("scheduleProcessingTask") { (delaySeconds: Double?) in
            let delay = delaySeconds ?? 3600
            let request = BGProcessingTaskRequest(identifier: BG_PROCESSING_TASK_ID)
            request.earliestBeginDate = Date(timeIntervalSinceNow: delay)
            request.requiresNetworkConnectivity = true
            request.requiresExternalPower = false
            try? BGTaskScheduler.shared.submit(request)
        }

        Function("cancelAllTasks") { BGTaskScheduler.shared.cancelAllTaskRequests() }

        Function("completeRefresh") { (success: Bool) in
            self.currentRefreshCompletion?(success)
            self.currentRefreshCompletion = nil
        }

        Function("completeProcessing") { (success: Bool) in
            self.currentProcessingCompletion?(success)
            self.currentProcessingCompletion = nil
        }

        Events("onBackgroundRefresh", "onBackgroundProcessing")
    }

    // Public API for AppDelegate and task handlers
    public func setupBackgroundTasks() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: BG_REFRESH_TASK_ID, using: nil) { task in
            if let t = task as? BGAppRefreshTask { handleAppRefresh(task: t) }
        }
        BGTaskScheduler.shared.register(forTaskWithIdentifier: BG_PROCESSING_TASK_ID, using: nil) { task in
            if let t = task as? BGProcessingTask { handleProcessingTask(task: t) }
        }
    }

    func performRefresh(completion: @escaping (Bool) -> Void) {
        currentRefreshCompletion = completion
        sendEvent("onBackgroundRefresh", [:])
        DispatchQueue.main.asyncAfter(deadline: .now() + 25) { [weak self] in
            self?.currentRefreshCompletion?(true)
            self?.currentRefreshCompletion = nil
        }
    }

    func performProcessing(completion: @escaping (Bool) -> Void) {
        currentProcessingCompletion = completion
        sendEvent("onBackgroundProcessing", [:])
        DispatchQueue.main.asyncAfter(deadline: .now() + 55) { [weak self] in
            self?.currentProcessingCompletion?(true)
            self?.currentProcessingCompletion = nil
        }
    }
}
