import AVFoundation
import Foundation

final class GameAudio {
    private var munchHigh = true
    private var ambient: [AVAudioPlayer] = []
    private var ambientKind = ""
    private var oneShots: [AVAudioPlayer] = []

    private func url(_ name: String) -> URL? {
        let exts: [String]
        switch name {
        case "death": exts = ["mp3", "wav"]
        default: exts = ["wav", "caf", "mp3", "ogg"]
        }
        for ext in exts {
            if let u = Bundle.main.url(forResource: name, withExtension: ext) { return u }
            if let u = Bundle.main.url(forResource: name, withExtension: ext, subdirectory: "Sounds") { return u }
        }
        return nil
    }

    @discardableResult
    private func play(_ name: String, _ volume: Float = 0.55, loop: Bool = false) -> AVAudioPlayer? {
        guard let u = url(name) else {
            NSLog("OrbiPac audio missing: \(name)")
            return nil
        }
        guard let p = try? AVAudioPlayer(contentsOf: u) else {
            NSLog("OrbiPac audio failed to open: \(name)")
            return nil
        }
        p.volume = volume
        p.numberOfLoops = loop ? -1 : 0
        p.prepareToPlay()
        p.play()
        oneShots.append(p)
        oneShots.removeAll { !$0.isPlaying && $0 !== p }
        return p
    }

    func unlock() {
        // Session is configured by GameController; nothing else required.
    }

    func playMunch() {
        _ = play(munchHigh ? "eat_dot_0" : "eat_dot_1", 0.5)
        munchHigh.toggle()
    }

    func playStart(_ completed: (() -> Void)? = nil) {
        guard let p = play("start", 0.5) else {
            completed?()
            return
        }
        let duration = max(0.05, p.duration)
        DispatchQueue.main.asyncAfter(deadline: .now() + duration) {
            completed?()
        }
    }

    func playEatFruit() { _ = play("eat_fruit") }
    func playEatGhost() { _ = play("eat_ghost") }
    func playExtend() { _ = play("extend", 0.5) }

    /// Matches web: play death one-shot and only stop ambient loops.
    func playDeath() {
        stopAmbient()
        _ = play("death", 0.6)
    }

    /// Prince of Persia–style Mirror alert when shadow mode begins.
    func playDanger() { _ = play("danger", 0.7) }

    /// Mirror-mode death sting.
    func playAccident() {
        stopAmbient()
        _ = play("accident", 0.7)
    }

    private func loop(_ first: String, _ sustained: String, _ kind: String, _ volume: Float) {
        guard ambientKind != kind else { return }
        stopAmbient()
        ambientKind = kind
        if let intro = play(first, volume) {
            // Keep intro out of oneShots cleanup that might drop ambient refs
            ambient.append(intro)
            let duration = max(0.05, intro.duration)
            DispatchQueue.main.asyncAfter(deadline: .now() + duration) { [weak self] in
                guard let self, self.ambientKind == kind else { return }
                if let p = self.play(sustained, volume, loop: true) {
                    self.ambient.append(p)
                }
            }
        } else if let p = play(sustained, volume, loop: true) {
            ambient.append(p)
        }
    }

    func startFright() { loop("fright_firstloop", "fright", "fright", 0.42) }
    func stopFright() { if ambientKind == "fright" { stopAmbient() } }
    func startEyes() { loop("eyes_firstloop", "eyes", "eyes", 0.42) }
    func stopEyes() { if ambientKind == "eyes" { stopAmbient() } }

    func updateSiren(_ left: Int, _ total: Int) {
        guard total > 0, ambientKind != "fright", ambientKind != "eyes" else { return }
        let i = min(4, Int(floor((1 - CGFloat(left) / CGFloat(total)) * 5)))
        loop("siren\(i)_firstloop", "siren\(i)", "siren\(i)", 0.32)
    }

    private func stopAmbient() {
        ambient.forEach { $0.stop() }
        ambient.removeAll()
        ambientKind = ""
    }

    /// Stops ambient sirens/loops. Does not cut one-shots mid-play (death/start).
    func stopAll() {
        stopAmbient()
    }

    /// Full silence for attract / level reset.
    func silence() {
        stopAmbient()
        oneShots.forEach { $0.stop() }
        oneShots.removeAll()
    }
}
