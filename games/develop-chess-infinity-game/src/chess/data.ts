/* Static content: puzzles, training lessons, openings. Every entry is validated in __tests__/content.test.ts */

export type PuzzleTheme = "mate1" | "mate2" | "mate3" | "fork" | "pin" | "skewer" | "discovered" | "material" | "defense";

export interface Puzzle {
  id: string;
  title: string;
  theme: PuzzleTheme;
  fen: string;
  /** forced mate in N — solved by exhaustive solver, any mating line is accepted */
  mateIn?: 1 | 2 | 3;
  /** key moves (uci) accepted as the first move for tactical puzzles (engine-verified) */
  accept?: string[];
  hint: string;
  explain: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
}

export const THEME_LABEL: Record<PuzzleTheme, string> = {
  mate1: "Mate in 1", mate2: "Mate in 2", mate3: "Mate in 3", fork: "Fork", pin: "Pin", skewer: "Skewer",
  discovered: "Discovered attack", material: "Win material", defense: "Defence",
};

export const PUZZLES: Puzzle[] = [
  { id: "m1-backrank", title: "Back-rank breakthrough", theme: "mate1", fen: "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", mateIn: 1, difficulty: 1, hint: "The king is trapped behind its own pawns.", explain: "Ra8# — the pawn wall leaves the king no flight square." },
  { id: "m1-scholar", title: "Scholar's finish", theme: "mate1", fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4", mateIn: 1, difficulty: 1, hint: "Two attackers aim at the same weak pawn.", explain: "Qxf7# — supported by the bishop on c4, the queen mates." },
  { id: "m1-smothered", title: "Smothered mate", theme: "mate1", fen: "6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1", mateIn: 1, difficulty: 2, hint: "The king is smothered by its own pieces. Only a knight can check it.", explain: "Nf7# — the classic smothered mate." },
  { id: "m1-trade", title: "Rook takes rook", theme: "mate1", fen: "3r2k1/5ppp/8/8/8/8/5PPP/3RR1K1 w - - 0 1", mateIn: 1, difficulty: 2, hint: "Capture the defender with check.", explain: "Rxd8# — the rook on e1 guards the 8th rank after the capture." },
  { id: "m1-queen-b2", title: "Queen takes the guard", theme: "mate1", fen: "1r4k1/5ppp/8/8/8/8/1Q3PPP/1R4K1 w - - 0 1", mateIn: 1, difficulty: 2, hint: "The black rook is the only defender of the back rank.", explain: "Qxb8# — the rook on b1 supports the queen." },
  { id: "m1-fool", title: "Black strikes first", theme: "mate1", fen: "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2", mateIn: 1, difficulty: 1, hint: "White's king diagonal is wide open.", explain: "Qh4# — the fastest possible checkmate." },

  { id: "m2-ladder", title: "Rook ladder", theme: "mate2", fen: "7k/8/8/8/8/8/R7/1R5K w - - 0 1", mateIn: 2, difficulty: 1, hint: "Cut the king off on the 7th rank first.", explain: "Ra7 forces Kg8, then Rb8#." },
  { id: "m2-kr", title: "King and rook", theme: "mate2", fen: "k7/8/2K5/8/8/8/8/7R w - - 0 1", mateIn: 2, difficulty: 2, hint: "A quiet king move takes away every flight square.", explain: "Kb6 forces Kb8, then Rh8#." },
  { id: "m2-opposition", title: "Take the opposition", theme: "mate2", fen: "7k/8/5K2/8/8/8/8/R7 w - - 0 1", mateIn: 2, difficulty: 2, hint: "Bring the king closer so it covers g7 and h7.", explain: "Kg6 (or Kf7) followed by Ra8#." },
  { id: "m2-sacrifice", title: "Queen sacrifice", theme: "mate2", fen: "2r3k1/5ppp/8/8/Q7/8/5PPP/4R1K1 w - - 0 1", mateIn: 2, difficulty: 2, hint: "Force the defending rook to leave the 8th rank… or be captured.", explain: "Re8+ Rxe8 Qxe8#." },
  { id: "m2-legal", title: "Légal's mate", theme: "mate2", fen: "r2qkb1r/pp2nppp/3p4/2pNN1B1/2BnP3/3P4/PPP2PPP/R2bK2R w KQkq - 1 1", mateIn: 2, difficulty: 3, hint: "A knight check removes the defender of f7.", explain: "Nxf6+ gxf6 Bxf7# — a pair of minor pieces deliver the mate." },

  { id: "m3-rooks", title: "Rook and bishop net", theme: "mate3", fen: "r5rk/5p1p/5R2/4B3/8/8/7P/7K w - - 0 1", mateIn: 3, difficulty: 4, hint: "A rook move to the 6th file prepares a decisive double attack.", explain: "Ra6 starts a three-move forced mate." },
  { id: "m3-black-bishop", title: "Bishop to c5!", theme: "mate3", fen: "r1b1kb1r/pppp1ppp/5q2/4n3/3KP3/2N3PN/PPP4P/R1BQ1B1R b kq - 0 1", mateIn: 3, difficulty: 4, hint: "The white king has wandered into the centre. Check it with a bishop.", explain: "…Bc5+ drives the king into a forced mating net." },
  { id: "m3-quiet", title: "Quiet rook lift", theme: "mate3", fen: "6k1/8/pbp4p/8/8/8/5Q2/1KR5 w - - 0 1", mateIn: 3, difficulty: 3, hint: "Not every winning move gives check.", explain: "Rg1+ begins a forced mate in three." },
  { id: "m3-queen-rook", title: "Queen and rook coordination", theme: "mate3", fen: "1k4Q1/3pp3/4bpR1/8/8/8/8/1K6 w - - 0 1", mateIn: 3, difficulty: 4, hint: "Look for a check that also restricts the king.", explain: "Qb8+ ... a forced mating sequence in three." },

  { id: "f-knight", title: "Knight fork", theme: "fork", fen: "r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1", accept: ["d5c7"], difficulty: 2, hint: "One knight jump attacks the king and the rook together.", explain: "Nc7+ forks the king and the rook on a8." },
  { id: "f-pawn", title: "Pawn fork", theme: "fork", fen: "4k3/8/2n1n3/8/3P4/8/8/4K3 w - - 0 1", accept: ["d4d5"], difficulty: 3, hint: "Pawns attack two squares at once.", explain: "d5 attacks both knights — one must fall." },
  { id: "f-black-knight", title: "Fork the queen", theme: "fork", fen: "k7/8/8/4n3/8/8/3Q3P/6K1 b - - 0 1", accept: ["e5f3"], difficulty: 3, hint: "Find a knight check that also hits the queen.", explain: "…Nf3+ forks the king and the queen on d2." },

  { id: "p-rook", title: "Pin the queen", theme: "pin", fen: "4k3/4q3/8/8/8/8/5K2/R7 w - - 0 1", accept: ["a1e1"], difficulty: 2, hint: "The black queen stands between your rook and its king.", explain: "Re1 pins the queen — it must trade itself for the rook." },
  { id: "p-bishop", title: "Win the pinned knight", theme: "pin", fen: "3k4/3n4/8/8/8/8/3R4/3K1B2 w - - 0 1", accept: ["f1b5", "f1h3"], difficulty: 3, hint: "The knight cannot move — attack it a second time.", explain: "Bb5 (or Bh3) adds a second attacker to the pinned knight on d7." },

  { id: "s-rook", title: "Skewer along the rank", theme: "skewer", fen: "8/8/8/8/q2k4/8/8/4K2R w - - 0 1", accept: ["h1h4"], difficulty: 2, hint: "Check the king so the queen behind it is exposed.", explain: "Rh4+ — after the king moves, Rxa4 wins the queen." },
  { id: "s-bishop", title: "Bishop skewer", theme: "skewer", fen: "2q5/3k4/8/8/8/8/8/4KB2 w - - 0 1", accept: ["f1h3"], difficulty: 3, hint: "The king and queen share a diagonal.", explain: "Bh3+ wins the queen on c8 after the king steps aside." },

  { id: "d-bishop-check", title: "Discovered check", theme: "discovered", fen: "4q1k1/8/8/8/4B3/8/8/4RK2 w - - 0 1", accept: ["e4d5", "e4h7"], difficulty: 3, hint: "Move the bishop with check — it unveils the rook.", explain: "Bd5+ (or Bh7+) gives check and uncovers an attack on the queen." },

  { id: "w-queen", title: "A hanging queen", theme: "material", fen: "r3kb1r/ppp2ppp/2n5/3q4/8/2N2N2/PPP2PPP/R1BQ1RK1 w kq - 0 1", accept: ["d1d5", "c3d5"], difficulty: 1, hint: "Look for loose pieces.", explain: "The queen on d5 is undefended — take it." },
  { id: "w-pawn-attack", title: "Pawn wins the queen", theme: "material", fen: "6k1/5ppp/8/8/8/5q2/6PP/6K1 w - - 0 1", accept: ["g2f3"], difficulty: 1, hint: "Pawns capture diagonally.", explain: "gxf3 wins the queen for nothing." },
  { id: "w-exchange", title: "Win the exchange", theme: "material", fen: "4k3/2r3r1/8/8/8/8/1B6/4K3 w - - 0 1", accept: ["b2g7"], difficulty: 3, hint: "A bishop is worth less than a rook.", explain: "Bxg7 Rxg7 — a bishop for a rook gains material." },

  { id: "df-scholar-queen", title: "Parry the threat", theme: "defense", fen: "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3", accept: ["d8e7", "g7g6", "d8f6", "g8h6", "d7d5", "e8e7"], difficulty: 2, hint: "White threatens Qxf7#. How can f7 be protected?", explain: "Qe7, Qf6, g6, Nh6 (or even d5) stop the mate — every other move allows Qxf7#." },
  { id: "df-scholar-f3", title: "Defend f7", theme: "defense", fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR b KQkq - 3 3", accept: ["d8f6", "g8f6", "d8e7", "g8h6", "f7f6", "d7d5", "f7f5", "e8e7"], difficulty: 2, hint: "The f7 pawn is attacked twice and defended once.", explain: "Nf6 or Qf6 guard f7 (or move the pawn) — every other move allows Qxf7#." },
];

/* ------------------------- Training ------------------------- */
export interface TrainStep {
  text: string;
  fen?: string;
  /** accepted moves (uci) or "mate" for any checkmating move. Missing = info step */
  accept?: string[] | "mate";
  reply?: string;
  success?: string;
}
export interface Lesson { id: string; title: string; subtitle: string; icon: string; steps: TrainStep[] }

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const LESSONS: Lesson[] = [
  {
    id: "pieces", title: "How the pieces move", subtitle: "Rook, bishop, knight, queen, king, pawn and special moves", icon: "♞",
    steps: [
      { text: "The rook moves in straight lines — any distance along ranks and files. Capture the black pawn on e5.", fen: "4k3/8/8/4p3/8/8/8/K3R3 w - - 0 1", accept: ["e1e5"], success: "Rooks love open lines." },
      { text: "The bishop slides diagonally and always stays on its own colour. Capture the pawn on f4.", fen: "4k3/8/8/8/5p2/8/8/K1B5 w - - 0 1", accept: ["c1f4"], success: "Bishops are strongest on open diagonals." },
      { text: "The knight jumps in an L-shape and ignores pieces in the way. Capture the pawn on d5.", fen: "4k3/8/8/3p4/8/2N5/8/K7 w - - 0 1", accept: ["c3d5"], success: "Knights are best near the centre." },
      { text: "The queen combines rook and bishop. Capture the pawn on g4.", fen: "4k3/8/8/8/6p1/8/8/K2Q4 w - - 0 1", accept: ["d1g4"], success: "The queen is your most powerful piece." },
      { text: "The king moves one square in any direction. The pawn on d2 is giving check — capture it!", fen: "4k3/8/8/8/8/8/3p4/4K3 w - - 0 1", accept: ["e1d2"], success: "The king can capture, but never into check." },
      { text: "Pawns move forward but capture diagonally. Capture the pawn on d3.", fen: "4k3/8/8/8/8/3p4/4P3/K7 w - - 0 1", accept: ["e2d3"], success: "Pawns capture one square diagonally forward." },
      { text: "A pawn reaching the last rank promotes. Promote the pawn on a7 (queen is usually best).", fen: "4k3/P7/8/8/8/8/8/4K3 w - - 0 1", accept: ["a7a8q", "a7a8r", "a7a8b", "a7a8n"], success: "Promotion can be a queen, rook, bishop or knight." },
      { text: "Castling tucks the king away and activates a rook. Castle kingside (move the king two squares toward the h-rook).", fen: "4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1", accept: ["e1g1"], success: "Castling is allowed only if neither piece has moved and the king does not pass through check." },
      { text: "En passant: Black just played d7–d5 next to your pawn. Capture it as if it had moved one square.", fen: "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", accept: ["e5d6"], success: "En passant is only available immediately after the double step." },
    ],
  },
  {
    id: "opening", title: "Opening principles", subtitle: "Centre, development, castle early", icon: "♟",
    steps: [
      { text: "Three golden rules: control the centre, develop your pieces, and castle early. Let's play them. Start by taking space in the centre with 1.e4.", fen: START, accept: ["e2e4"], reply: "e7e5", success: "The e-pawn claims the centre and opens lines for the queen and bishop." },
      { text: "Develop a knight toward the centre and attack e5: play Nf3.", accept: ["g1f3"], reply: "b8c6", success: "Knights before bishops — and they attack the centre." },
      { text: "Now develop your bishop to an active diagonal, for example Bc4 or Bb5.", accept: ["f1c4", "f1b5"], reply: "g8f6", success: "Active bishops aim at the opponent's position." },
      { text: "Your king is still in the centre. Castle kingside (O-O) to protect it.", accept: ["e1g1"], reply: "f8c5", success: "King safe, rook developed — the opening goal is complete." },
    ],
  },
  {
    id: "centre", title: "Controlling the centre", subtitle: "Why d4, e4, d5 and e5 matter", icon: "◎",
    steps: [
      { text: "The four central squares (d4, e4, d5, e5) give your pieces the most mobility. Occupy the centre with a pawn: play e4 or d4.", fen: START, accept: ["e2e4", "d2d4"], reply: "d7d5", success: "A central pawn controls key squares and frees your pieces." },
      { text: "Black has challenged you. Support your centre by developing a knight: Nc3 or Nf3.", accept: ["b1c3", "g1f3"], reply: "g8f6", success: "Pieces that eye the centre are stronger than pieces on the rim." },
      { text: "Remember: a knight on the rim is dim. Pieces in the centre control more squares — keep fighting for the centre while you develop.", },
    ],
  },
  {
    id: "development", title: "Piece development", subtitle: "Get every piece into the game", icon: "♝",
    steps: [
      { text: "White has played e4, Nf3 and Black replied e5, Nc6. Develop your bishop to an active square.", fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", accept: ["f1c4", "f1b5", "f1e2", "f1d3"], reply: "g8f6", success: "One minor piece developed." },
      { text: "Bring out your last knight: Nc3.", accept: ["b1c3"], reply: "f8c5", success: "All minor pieces are developed." },
      { text: "Connect your rooks by castling kingside.", accept: ["e1g1"], reply: "d7d6", success: "Develop → castle → connect the rooks." },
      { text: "Avoid moving the same piece twice in the opening and avoid early queen adventures — they waste time while your opponent develops." },
    ],
  },
  {
    id: "kingsafety", title: "King safety", subtitle: "Castling and luft", icon: "♚",
    steps: [
      { text: "Your king is exposed on e1. Castle kingside to make it safe.", fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 6 5", accept: ["e1g1"], success: "Castled — the king sits behind a pawn shield." },
      { text: "Black's rook eyes your back rank and a1 would be checkmate. Create luft (an escape square) with a pawn move.", fen: "r5k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1", accept: ["h2h3", "h2h4", "g2g3", "g2g4", "f2f3", "f2f4"], success: "Luft gives the king room to breathe and prevents back-rank mate." },
      { text: "Keep the pawns in front of your castled king where they are, and avoid opening files toward your king." },
    ],
  },
  {
    id: "tactics", title: "Tactical patterns", subtitle: "Fork, pin, skewer, discovered attack", icon: "⚔",
    steps: [
      { text: "FORK: attack two pieces at once. Find the knight fork.", fen: "r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1", accept: ["d5c7"], success: "Nc7+ wins the rook." },
      { text: "PIN: a pinned piece cannot move without exposing something more valuable. Attack the pinned knight a second time.", fen: "3k4/3n4/8/8/8/8/3R4/3K1B2 w - - 0 1", accept: ["f1b5", "f1h3"], success: "The knight is pinned and attacked twice — it will be lost." },
      { text: "SKEWER: attack a valuable piece so that it must move, exposing a piece behind it. Check the king along the rank.", fen: "8/8/8/8/q2k4/8/8/4K2R w - - 0 1", accept: ["h1h4"], success: "After the king moves, the queen falls." },
      { text: "DISCOVERED ATTACK: move one piece to unleash another. Move the bishop with check!", fen: "4q1k1/8/8/8/4B3/8/8/4RK2 w - - 0 1", accept: ["e4d5", "e4h7"], success: "Check plus a rook attack on the queen — a double purpose move." },
    ],
  },
  {
    id: "mates", title: "Basic checkmates", subtitle: "Back rank, queen, rooks", icon: "♛",
    steps: [
      { text: "BACK-RANK MATE: the king is trapped behind its pawns. Deliver mate with the rook.", fen: "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", accept: "mate", success: "Ra8#" },
      { text: "QUEEN MATE: the queen, supported by the king, delivers mate. Find a checkmating move.", fen: "7k/5K2/6Q1/8/8/8/8/8 w - - 0 1", accept: "mate", success: "The king supports the queen — mate." },
      { text: "TWO-ROOK LADDER, step 1: cut the king off on the seventh rank with Ra7.", fen: "7k/8/8/8/8/8/R7/1R5K w - - 0 1", accept: ["a2a7"], reply: "h8g8", success: "The king is confined to the 8th rank." },
      { text: "Step 2: finish with the other rook.", accept: "mate", success: "Rb8# — the ladder is complete." },
      { text: "KING AND ROOK, step 1: bring the king to b6 to take away flight squares.", fen: "k7/8/2K5/8/8/8/8/7R w - - 0 1", accept: ["c6b6"], reply: "a8b8", success: "Black's king has to step to b8." },
      { text: "Step 2: Rh8 is checkmate.", accept: "mate", success: "Rh8# — the king controls a7, b7 and c7." },
    ],
  },
  {
    id: "endgame", title: "Endgame principles", subtitle: "Promote, activate the king", icon: "♙",
    steps: [
      { text: "In the endgame, passed pawns are powerful. Promote your pawn with check!", fen: "8/4P1k1/8/8/8/8/8/4K3 w - - 0 1", accept: ["e7e8q"], success: "A new queen." },
      { text: "In the endgame the king becomes a fighting piece. Centralise your king toward the loose pawn on e5.", fen: "8/8/8/4p3/8/4K3/8/7k w - - 0 1", accept: ["e3e4"], reply: "h1g2", success: "The king is active and attacks the pawn." },
      { text: "Win the pawn with your king.", accept: ["e4e5"], success: "Kxe5 — the king collects material." },
      { text: "Opposition: when kings face each other with one square between them, the side NOT to move holds the opposition. It decides many pawn endgames. Also remember: put rooks behind passed pawns." },
    ],
  },
];

/* ------------------------- Openings ------------------------- */
export interface Opening { id: string; name: string; eco: string; moves: string[]; ideas: string[]; style: string }

export const OPENINGS: Opening[] = [
  { id: "italian", name: "Italian Game", eco: "C50", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6", "d3"], ideas: ["Bishop eyes f7, the weakest square", "Prepare d4 with c3", "Quick castling and piece play"], style: "Classical" },
  { id: "ruy", name: "Ruy Lopez", eco: "C60", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7"], ideas: ["Pressure the knight defending e5", "Long-term strategic play", "Break with d4 or c3–d4"], style: "Strategic" },
  { id: "scotch", name: "Scotch Game", eco: "C45", moves: ["e4", "e5", "Nf3", "Nc6", "d4", "exd4", "Nxd4", "Nf6", "Nxc6", "bxc6"], ideas: ["Open the centre immediately", "Trade central pawns for activity", "Space and development"], style: "Open" },
  { id: "sicilian", name: "Sicilian Najdorf", eco: "B90", moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"], ideas: ["Black fights for the centre asymmetrically", "…a6 prevents Nb5/Bb5 and prepares …b5", "Sharp, double-edged play"], style: "Sharp" },
  { id: "french", name: "French Defence", eco: "C11", moves: ["e4", "e6", "d4", "d5", "Nc3", "Nf6", "Bg5", "Be7"], ideas: ["Solid pawn chain for Black", "Counterplay with …c5", "The light-squared bishop can become passive"], style: "Solid" },
  { id: "caro", name: "Caro-Kann Defence", eco: "B12", moves: ["e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4", "Bf5"], ideas: ["Support d5 with …c6", "Develop the light bishop before …e6", "Very solid structure"], style: "Solid" },
  { id: "scandi", name: "Scandinavian Defence", eco: "B01", moves: ["e4", "d5", "exd5", "Qxd5", "Nc3", "Qa5"], ideas: ["Challenge e4 immediately", "The queen comes out early — Black loses time", "Easy to learn"], style: "Direct" },
  { id: "pirc", name: "Pirc Defence", eco: "B07", moves: ["e4", "d6", "d4", "Nf6", "Nc3", "g6"], ideas: ["Allow White a big centre, then attack it", "Fianchetto the king's bishop", "Hypermodern"], style: "Hypermodern" },
  { id: "qg", name: "Queen's Gambit Declined", eco: "D30", moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Be7"], ideas: ["White offers a pawn to deflect Black's centre", "Black keeps a rock-solid centre", "Typical minority-attack middlegames"], style: "Classical" },
  { id: "slav", name: "Slav Defence", eco: "D10", moves: ["d4", "d5", "c4", "c6", "Nf3", "Nf6", "Nc3", "dxc4"], ideas: ["Support d5 while keeping the c8-bishop free", "Often grabs the c4 pawn", "Very reliable"], style: "Solid" },
  { id: "kid", name: "King's Indian Defence", eco: "E60", moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6", "Nf3", "O-O"], ideas: ["Let White build a centre, then strike with …e5 or …c5", "Kingside pawn storms", "Rich attacking chances"], style: "Dynamic" },
  { id: "nimzo", name: "Nimzo-Indian Defence", eco: "E20", moves: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4", "e3", "O-O"], ideas: ["Pin the c3-knight to control e4", "Flexible and respected at the top level", "Doubled c-pawns for White after Bxc3"], style: "Strategic" },
  { id: "london", name: "London System", eco: "D02", moves: ["d4", "d5", "Bf4", "Nf6", "e3", "e6", "Nf3", "Bd6"], ideas: ["A solid, easy-to-learn setup for White", "Develop the bishop before e3", "Same plan against many replies"], style: "Solid" },
  { id: "english", name: "English Opening", eco: "A20", moves: ["c4", "e5", "Nc3", "Nf6", "Nf3", "Nc6"], ideas: ["Control d5 from the flank", "A reversed Sicilian", "Flexible transpositions"], style: "Flexible" },
  { id: "dutch", name: "Dutch Defence", eco: "A80", moves: ["d4", "f5", "g3", "Nf6", "Bg2", "e6"], ideas: ["Control e4 immediately", "Aggressive kingside play", "Weakens the king a little"], style: "Aggressive" },
];

/** Morphy's Opera Game (1858) — the animated main-menu board plays this masterpiece. */
export const OPERA_GAME = "e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#".split(" ");

export function dailyPuzzle(date = new Date()): Puzzle {
  const key = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  return PUZZLES[(key * 2654435761 >>> 0) % PUZZLES.length];
}
export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
