/* TFLIX iOS / iPadOS — single-window scene: a dark window hosting
   MainViewController (the WKWebView shell). */

import UIKit

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: windowScene)
        // Site background — keeps rotation/multitasking gaps dark.
        window.backgroundColor = UIColor(red: 0x0A / 255, green: 0x0A / 255,
                                         blue: 0x0D / 255, alpha: 1)
        window.rootViewController = MainViewController()
        self.window = window
        window.makeKeyAndVisible()
    }
}
