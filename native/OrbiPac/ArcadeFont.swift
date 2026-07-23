import CoreText
import Foundation
import SwiftUI

enum ArcadeFont {
    static let familyName = "Press Start 2P"
    private static let resourceName = "PressStart2P-Regular"
    private static var didRegister = false

    /// Register the bundled TTF once for Core Text / SwiftUI.
    static func registerIfNeeded() {
        guard !didRegister else { return }
        didRegister = true
        guard let url = Bundle.main.url(forResource: resourceName, withExtension: "ttf") else {
            NSLog("OrbiPac: missing \(resourceName).ttf in app bundle")
            return
        }
        var error: Unmanaged<CFError>?
        if !CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error) {
            // Already registered is fine.
            if let error {
                NSLog("OrbiPac: font register note: \(error.takeUnretainedValue())")
            }
        }
    }

    static func ctFont(size: CGFloat) -> CTFont {
        registerIfNeeded()
        let primary = CTFontCreateWithName(familyName as CFString, size, nil)
        let matched = CTFontCopyPostScriptName(primary) as String?
        if matched?.localizedCaseInsensitiveContains("PressStart") == true
            || matched?.localizedCaseInsensitiveContains("Press Start") == true
        {
            return primary
        }
        // Fallback if PostScript name differs on some platforms.
        if let url = Bundle.main.url(forResource: resourceName, withExtension: "ttf"),
           let descriptors = CTFontManagerCreateFontDescriptorsFromURL(url as CFURL) as? [CTFontDescriptor],
           let desc = descriptors.first
        {
            return CTFontCreateWithFontDescriptor(desc, size, nil)
        }
        return primary
    }

    static func swiftUI(size: CGFloat) -> Font {
        registerIfNeeded()
        return .custom(familyName, size: size)
    }
}
