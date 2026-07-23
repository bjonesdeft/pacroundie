import Foundation

let leaderboardKey = "pacroundie-leaderboard"
let legacyHighKey = "pacroundie-high-score"
let leaderboardSize = 10, nameMaxLength = 10

func fruitKindForLevel(_ level: Int) -> Int {
    if level <= 1 { return 0 }; if level == 2 { return 1 }; if level <= 4 { return 2 }
    if level <= 6 { return 3 }; if level <= 8 { return 4 }; if level <= 10 { return 5 }; if level <= 12 { return 6 }; return 7
}
private func normalizedName(_ value: String) -> String {
    let allowed = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_")
    let s = String(value.trimmingCharacters(in:.whitespacesAndNewlines).uppercased().unicodeScalars.filter { allowed.contains($0) }.map(Character.init).prefix(nameMaxLength))
    return s.isEmpty ? "PLAYER" : s
}
private func sorted(_ list:[ScoreEntry])->[ScoreEntry] { list.sorted { $0.score != $1.score ? $0.score > $1.score : ($0.level != $1.level ? $0.level > $1.level : $0.at > $1.at) } }
func loadLeaderboard() -> [ScoreEntry] {
    let d=UserDefaults.standard
    if let data=d.data(forKey:leaderboardKey),let list=try? JSONDecoder().decode([ScoreEntry].self,from:data) { return Array(sorted(list).prefix(leaderboardSize)) }
    let old=d.integer(forKey:legacyHighKey); if old > 0 {let b=[ScoreEntry(name:"PLAYER",score:old,level:1,at:Date().timeIntervalSince1970)];saveLeaderboard(b);return b};return []
}
func saveLeaderboard(_ list:[ScoreEntry]) { let b=Array(sorted(list).prefix(leaderboardSize));if let data=try? JSONEncoder().encode(b){UserDefaults.standard.set(data,forKey:leaderboardKey)};UserDefaults.standard.set(b.first?.score ?? 0,forKey:legacyHighKey) }
func clearLeaderboard(){UserDefaults.standard.removeObject(forKey:leaderboardKey);UserDefaults.standard.removeObject(forKey:legacyHighKey)}
func bestScore()->Int {loadLeaderboard().first?.score ?? 0}
func qualifiesForBoard(_ score:Int)->Bool {let b=loadLeaderboard();return score > 0 && (b.count < leaderboardSize || score > (b.last?.score ?? 0))}
@discardableResult func submitRun(score:Int,level:Int,name:String)->ScoreEntry? {guard qualifiesForBoard(score) else{return nil};let e=ScoreEntry(name:normalizedName(name),score:score,level:max(1,level),at:Date().timeIntervalSince1970);saveLeaderboard(loadLeaderboard()+[e]);return e}
