import { useState, useEffect, useCallback } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const ROUNDS = [
  { round: 1, target: 300 },
  { round: 2, target: 600 },
  { round: 3, target: 1000 },
  { round: 4, target: 1800 },
  { round: 5, target: 3000 },
  { round: 6, target: 5000 },
  { round: 7, target: 8000 },
  { round: 8, target: 13000 },
  { round: 9, target: 20000 },
  { round: 10, target: 35000 },
];

import ACTIVE_CARDS from './data/activeCards.json';

import JOKERS from './data/jokers.json';

// ─── POKER HAND EVALUATION ────────────────────────────────────────────────────

const HAND_RANKS = {
  "Five of a Kind":  { chips: 160, mult: 16 },
  "Four of a Kind":  { chips: 60,  mult: 7  },
  "Full House":      { chips: 40,  mult: 4  },
  "Three of a Kind": { chips: 30,  mult: 3  },
  "Two Pair":        { chips: 20,  mult: 2  },
  "Pair":            { chips: 10,  mult: 2  },
  "Small Straight":  { chips: 30,  mult: 4  },
  "Large Straight":  { chips: 40,  mult: 5  },
  "High Card":       { chips: 5,   mult: 1  },
};

function evaluateHand(dice) {
  const vals = dice.map(d => d.value);
  const counts = {};
  vals.forEach(v => counts[v] = (counts[v] || 0) + 1);
  const groups = Object.values(counts).sort((a, b) => b - a);
  const sorted = [...vals].sort((a, b) => a - b);
  const isSmallStr = [1,2,3,4,5].every((v,i) => sorted[i] === v);
  const isLargeStr = [2,3,4,5,6].every((v,i) => sorted[i] === v);
  
  if (groups[0] === 5) return "Five of a Kind";
  if (groups[0] === 4) return "Four of a Kind";
  if (groups[0] === 3 && groups[1] === 2) return "Full House";
  if (isLargeStr) return "Large Straight";
  if (isSmallStr) return "Small Straight";
  if (groups[0] === 3) return "Three of a Kind";
  if (groups[0] === 2 && groups[1] === 2) return "Two Pair";
  if (groups[0] === 2) return "Pair";
  return "High Card";
}

function scoreHand(dice, jokers, handHistory, cardsPlayedThisRound, gold, handsInRound) {
  const handName = evaluateHand(dice);
  const base = HAND_RANKS[handName];
  let chips = base.chips;
  let mult = base.mult;
  const dieSum = dice.reduce((s, d) => s + d.value, 0);
  chips += dieSum;

  // Apply jokers
  jokers.forEach(joker => {
    const vals = dice.map(d => d.value);
    switch (joker.id) {
      case 1: mult += vals.filter(v => v === 6).length * 3; break;
      case 2: mult += vals.filter(v => v === 1).length * 4; break;
      case 3: if (vals.every(v => v % 2 === 0)) chips += 50; break;
      case 4: if (vals.every(v => v % 2 !== 0)) chips += 50; break;
      case 5: if (handName.includes("Straight")) mult += 12; break;
      case 6: if (handName === "Pair" || handName === "Two Pair") chips += 20; break;
      case 7: if (handName === "Three of a Kind") chips *= 2; break;
      case 8: if (handName === "High Card") chips += 300; break;
      case 9: if (handName === "Five of a Kind") { chips += 500; mult += 50; } break;
      case 10: if (handName === "Full House") {
        const fhCount = handHistory.filter(h => h === "Full House").length;
        mult += fhCount + 1;
      } break;
      case 12: mult += cardsPlayedThisRound; break; // card counter uses cards played
      case 13: chips += cardsPlayedThisRound * 10; break;
      case 15: mult += Math.floor(gold / 10); break;
      case 18: mult += handsInRound; break;
      case 19: {
        const last = handHistory[handHistory.length - 1];
        if (last === handName) mult += 5;
        break;
      }
      default: break;
    }
  });

  return { handName, chips, mult, score: chips * mult };
}

// ─── DICE COMPONENT ───────────────────────────────────────────────────────────

function DieFace({ value, isGolden }) {
  const pips = {
    1: [[50,50]],
    2: [[25,25],[75,75]],
    3: [[25,25],[50,50],[75,75]],
    4: [[25,25],[75,25],[25,75],[75,75]],
    5: [[25,25],[75,25],[50,50],[25,75],[75,75]],
    6: [[25,25],[75,25],[25,50],[75,50],[25,75],[75,75]],
  };
  const positions = pips[value] || [];
  
  return (
    <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
      <rect x="4" y="4" width="92" height="92" rx="16" ry="16"
        fill={isGolden ? "#3d2a00" : "#f5f0e8"}
        stroke={isGolden ? "#ffd700" : "#c8b898"}
        strokeWidth="3"
        style={{ filter: "drop-shadow(2px 4px 6px rgba(0,0,0,0.5))" }}
      />
      {positions.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="9"
          fill={isGolden ? "#ffd700" : "#2c1a0e"}
        />
      ))}
    </svg>
  );
}

// ─── CARD COMPONENT ───────────────────────────────────────────────────────────

function CardComponent({ card, isSelected, onClick, dimmed, isJoker }) {
  const typeColors = {
    Math: "#4a9eff", Logic: "#9b6dff", RNG: "#ff9b4a",
    Clone: "#4aff9b", Force: "#ffd700", Draw: "#ff4a9b",
    Utility: "#a0ff4a", "Per Die": "#ffd700", "Hand Rule": "#4aff9b",
    "Poker Hand": "#9b6dff", Economy: "#a0ff4a", Scaling: "#ff9b4a",
    "Score State": "#ff4a4a", RNG2: "#ff9b4a",
  };
  const tc = typeColors[card.type || card.trigger] || "#aaa";

  return (
    <div onClick={onClick} style={{
      width: isJoker ? "120px" : "100px",
      minHeight: isJoker ? "80px" : "130px",
      background: isSelected
        ? "linear-gradient(145deg, #5a3a1a, #3a2010)"
        : "linear-gradient(145deg, #3a2a18, #251a0e)",
      border: `2px solid ${isSelected ? "#ffd700" : dimmed ? "#2a1a0a" : "#5a4020"}`,
      borderRadius: "10px",
      padding: "8px",
      cursor: dimmed ? "not-allowed" : "pointer",
      opacity: dimmed ? 0.4 : 1,
      transform: isSelected ? "translateY(-8px)" : "none",
      transition: "all 0.2s ease",
      boxShadow: isSelected
        ? "0 8px 20px rgba(255,215,0,0.4)"
        : "0 3px 8px rgba(0,0,0,0.5)",
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      flexShrink: 0,
      position: "relative",
    }}>
      <div style={{ fontSize: "10px", fontFamily: "'Playfair Display', serif", color: "#ffd700", fontWeight: "700", lineHeight: 1.2 }}>
        {card.name}
      </div>
      <div style={{
        display: "inline-block",
        background: tc + "22",
        border: `1px solid ${tc}66`,
        borderRadius: "4px",
        padding: "1px 5px",
        fontSize: "8px",
        color: tc,
        fontFamily: "monospace",
        fontWeight: "700",
        width: "fit-content",
      }}>
        {card.type || card.trigger}
      </div>
      {!isJoker && (
        <div style={{ fontSize: "8px", color: "#c8a060", lineHeight: 1.3, flex: 1 }}>
          {card.desc}
        </div>
      )}
      {isJoker && (
        <div style={{ fontSize: "8px", color: "#c8a060", lineHeight: 1.3 }}>
          {card.desc}
        </div>
      )}
      {!isJoker && (
        <div style={{
          position: "absolute", top: "6px", right: "6px",
          width: "18px", height: "18px",
          background: "#1a0a00",
          border: "1px solid #ffd70066",
          borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "9px", fontWeight: "700", color: "#ffd700",
          fontFamily: "monospace",
        }}>
          {card.cost}
        </div>
      )}
    </div>
  );
}

// ─── SCORE POPUP ──────────────────────────────────────────────────────────────

function ScorePopup({ result, onDone }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 100, fontFamily: "'Playfair Display', serif",
    }}>
      <div style={{
        background: "linear-gradient(145deg, #2a1a08, #1a0e04)",
        border: "2px solid #ffd700",
        borderRadius: "16px",
        padding: "40px 48px",
        textAlign: "center",
        boxShadow: "0 0 60px rgba(255,215,0,0.3)",
        minWidth: "320px",
      }}>
        <div style={{ color: "#ffd700", fontSize: "14px", letterSpacing: "3px", marginBottom: "8px" }}>
          HAND SCORED
        </div>
        <div style={{ color: "#fff", fontSize: "28px", fontWeight: "700", marginBottom: "16px" }}>
          {result.handName}
        </div>
        <div style={{ color: "#c8a060", fontSize: "13px", marginBottom: "8px" }}>
          {result.chips} chips × {result.mult} mult
        </div>
        <div style={{ color: "#ffd700", fontSize: "48px", fontWeight: "700", lineHeight: 1 }}>
          {result.score.toLocaleString()}
        </div>
        <button onClick={onDone} style={{
          marginTop: "24px",
          background: "#ffd700",
          color: "#1a0800",
          border: "none",
          borderRadius: "8px",
          padding: "10px 32px",
          fontSize: "14px",
          fontWeight: "700",
          cursor: "pointer",
          fontFamily: "'Playfair Display', serif",
          letterSpacing: "1px",
        }}>
          CONTINUE
        </button>
      </div>
    </div>
  );
}

// ─── SHOP COMPONENT ───────────────────────────────────────────────────────────

function Shop({ gold, onBuy, onClose, shopCards, shopJokers, equippedJokers }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 100,
    }}>
      <div style={{
        background: "linear-gradient(145deg, #1e1206, #130c04)",
        border: "2px solid #5a4020",
        borderRadius: "16px",
        padding: "32px",
        width: "min(800px, 95vw)",
        maxHeight: "90vh",
        overflowY: "auto",
        fontFamily: "'Playfair Display', serif",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div style={{ color: "#ffd700", fontSize: "24px", fontWeight: "700" }}>⚜ The Shop</div>
          <div style={{ color: "#a0ff4a", fontSize: "18px", fontWeight: "700" }}>
            💰 ${gold}
          </div>
        </div>

        <div style={{ color: "#c8a060", fontSize: "12px", marginBottom: "16px", letterSpacing: "2px" }}>
          ACTIVE CARDS — $3 each
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "28px" }}>
          {shopCards.map((card, i) => (
            <div key={i} style={{ position: "relative" }}>
              <CardComponent card={card} dimmed={gold < 3} onClick={() => gold >= 3 && onBuy("card", card, i)} />
              <div style={{
                position: "absolute", bottom: "-20px", left: "50%", transform: "translateX(-50%)",
                color: "#ffd700", fontSize: "11px", fontWeight: "700",
              }}>$3</div>
            </div>
          ))}
        </div>

        <div style={{ color: "#c8a060", fontSize: "12px", marginBottom: "16px", letterSpacing: "2px", marginTop: "24px" }}>
          JOKERS — $5 each {equippedJokers.length >= 5 ? "(SLOTS FULL)" : `(${5 - equippedJokers.length} slots free)`}
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "28px" }}>
          {shopJokers.map((joker, i) => (
            <div key={i} style={{ position: "relative" }}>
              <CardComponent card={joker} isJoker dimmed={gold < 5 || equippedJokers.length >= 5}
                onClick={() => gold >= 5 && equippedJokers.length < 5 && onBuy("joker", joker, i)} />
              <div style={{
                position: "absolute", bottom: "-20px", left: "50%", transform: "translateX(-50%)",
                color: "#ffd700", fontSize: "11px", fontWeight: "700",
              }}>$5</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: "16px" }}>
          <button onClick={onClose} style={{
            background: "#ffd700", color: "#1a0800", border: "none",
            borderRadius: "8px", padding: "12px 40px",
            fontSize: "15px", fontWeight: "700", cursor: "pointer",
            fontFamily: "'Playfair Display', serif", letterSpacing: "1px",
          }}>
            NEXT ROUND →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CLAIRVOYANCE PICKER ──────────────────────────────────────────────────────

function ClairvoyancePicker({ cards, onPick }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 200,
    }}>
      <div style={{
        background: "linear-gradient(145deg, #2a1a08, #1a0e04)",
        border: "2px solid #9b6dff",
        borderRadius: "16px", padding: "32px", textAlign: "center",
        fontFamily: "'Playfair Display', serif",
      }}>
        <div style={{ color: "#9b6dff", fontSize: "18px", marginBottom: "20px" }}>
          ✦ Clairvoyance — Choose 1 to draw
        </div>
        <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
          {cards.map((card, i) => (
            <CardComponent key={i} card={card} onClick={() => onPick(i)} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── WILDCARD PICKER ──────────────────────────────────────────────────────────

function WildcardPicker({ onPick }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 200,
    }}>
      <div style={{
        background: "linear-gradient(145deg, #2a1a08, #1a0e04)",
        border: "2px solid #9b6dff", borderRadius: "16px",
        padding: "32px", textAlign: "center",
        fontFamily: "'Playfair Display', serif",
      }}>
        <div style={{ color: "#9b6dff", fontSize: "18px", marginBottom: "20px" }}>
          ✦ Wildcard — Choose a face value
        </div>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          {[1,2,3,4,5,6].map(v => (
            <button key={v} onClick={() => onPick(v)} style={{
              width: "56px", height: "56px", background: "#1a0a00",
              border: "2px solid #9b6dff", borderRadius: "10px",
              color: "#ffd700", fontSize: "24px", fontWeight: "700",
              cursor: "pointer", fontFamily: "'Playfair Display', serif",
            }}>{v}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── LOCK PICKER ──────────────────────────────────────────────────────────────

function LockPicker({ dice, onPick, count, title }) {
  const [selected, setSelected] = useState([]);
  const toggle = i => {
    if (selected.includes(i)) setSelected(selected.filter(x => x !== i));
    else if (selected.length < count) setSelected([...selected, i]);
  };
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 200,
    }}>
      <div style={{
        background: "linear-gradient(145deg, #2a1a08, #1a0e04)",
        border: "2px solid #ff9b4a", borderRadius: "16px",
        padding: "32px", textAlign: "center",
        fontFamily: "'Playfair Display', serif",
      }}>
        <div style={{ color: "#ff9b4a", fontSize: "16px", marginBottom: "20px" }}>
          {title} (select {count})
        </div>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginBottom: "20px" }}>
          {dice.map((die, i) => (
            <div key={i} onClick={() => toggle(i)} style={{
              width: "56px", height: "56px", cursor: "pointer",
              border: `3px solid ${selected.includes(i) ? "#ff9b4a" : "#333"}`,
              borderRadius: "10px", overflow: "hidden",
            }}>
              <DieFace value={die.value} />
            </div>
          ))}
        </div>
        <button disabled={selected.length !== count} onClick={() => onPick(selected)} style={{
          background: selected.length === count ? "#ff9b4a" : "#333",
          color: "#1a0800", border: "none", borderRadius: "8px",
          padding: "10px 28px", fontSize: "14px", fontWeight: "700",
          cursor: selected.length === count ? "pointer" : "not-allowed",
          fontFamily: "'Playfair Display', serif",
        }}>
          Confirm
        </button>
      </div>
    </div>
  );
}

// ─── SQUEEZE PICKER ───────────────────────────────────────────────────────────

function SqueezePicker({ onPick }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 200,
    }}>
      <div style={{
        background: "linear-gradient(145deg, #2a1a08, #1a0e04)",
        border: "2px solid #4a9eff", borderRadius: "16px",
        padding: "32px", textAlign: "center",
        fontFamily: "'Playfair Display', serif",
      }}>
        <div style={{ color: "#4a9eff", fontSize: "18px", marginBottom: "20px" }}>
          The Squeeze — Apply to ALL dice
        </div>
        <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
          <button onClick={() => onPick(1)} style={{
            background: "#1a2a3a", color: "#4a9eff",
            border: "2px solid #4a9eff", borderRadius: "8px",
            padding: "12px 28px", fontSize: "18px", fontWeight: "700",
            cursor: "pointer",
          }}>+1 All</button>
          <button onClick={() => onPick(-1)} style={{
            background: "#1a2a3a", color: "#4a9eff",
            border: "2px solid #4a9eff", borderRadius: "8px",
            padding: "12px 28px", fontSize: "18px", fontWeight: "700",
            cursor: "pointer",
          }}>-1 All</button>
        </div>
      </div>
    </div>
  );
}

// ─── GAME OVER ────────────────────────────────────────────────────────────────

function GameOver({ won, round, onRestart }) {
  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "radial-gradient(ellipse at center, #1a0e04 0%, #0a0604 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 200, fontFamily: "'Playfair Display', serif",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "72px", marginBottom: "16px" }}>
          {won ? "🏆" : "💀"}
        </div>
        <div style={{ color: "#ffd700", fontSize: "48px", fontWeight: "700", marginBottom: "16px" }}>
          {won ? "YOU WIN!" : "GAME OVER"}
        </div>
        <div style={{ color: "#c8a060", fontSize: "18px", marginBottom: "40px" }}>
          {won ? "You beat all 10 rounds!" : `Eliminated on Round ${round}`}
        </div>
        <button onClick={onRestart} style={{
          background: "#ffd700", color: "#1a0800", border: "none",
          borderRadius: "10px", padding: "14px 48px",
          fontSize: "18px", fontWeight: "700", cursor: "pointer",
          fontFamily: "'Playfair Display', serif", letterSpacing: "2px",
        }}>
          PLAY AGAIN
        </button>
      </div>
    </div>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function rollDie() {
  return Math.floor(Math.random() * 6) + 1;
}

function makeShuffledDeck() {
  const pool = [...ACTIVE_CARDS, ...ACTIVE_CARDS.slice(0, 10)]; // 30-card draw pile
  return pool.sort(() => Math.random() - 0.5);
}

function makeShopCards() {
  const shuffled = [...ACTIVE_CARDS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

function makeShopJokers() {
  const shuffled = [...JOKERS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 2);
}

function clampDie(v) {
  return Math.min(6, Math.max(1, v));
}

// ─── MAIN GAME ────────────────────────────────────────────────────────────────

export default function RollOfTheDraw() {
  const initState = () => ({
    phase: "play", // play | shop | gameover
    roundIdx: 0,
    handIdx: 0,        // 0-4 (5 hands per round)
    cumulativeScore: 0,
    gold: 5,
    energy: 3,
    maxEnergy: 3,
    deck: makeShuffledDeck(),
    hand: [],
    dice: Array(5).fill(null).map(() => ({ value: rollDie(), locked: false })),
    jokers: [],
    equippedJokers: [],
    selectedCardIdx: null,
    pendingCard: null,   // card requiring UI step
    pendingStep: null,   // which step: "selectDie1" | "selectDie2" | etc.
    pendingData: {},
    scorePopup: null,
    handHistory: [],
    cardsPlayedThisRound: 0,
    shopCards: [],
    shopJokers: [],
    message: "",
    freeRerolls: 0,      // from Four-Leaf Clover
    goldenDieIdx: null,  // from Golden Die joker
    escalatorCount: 0,
    gameOver: false,
    gameWon: false,
    clairvoyanceCards: null,
    wildcardDieIdx: null,
    lockPickerConfig: null,   // { count, purpose, callback }
    squeezePicker: false,
  });

  const [G, setG] = useState(initState);

  // Draw initial hand
  useEffect(() => {
    setG(g => {
      const toDraw = Math.min(5, g.deck.length);
      const newHand = [...g.hand, ...g.deck.slice(0, toDraw)].slice(0, 10); // max 10
      const newDeck = g.deck.slice(toDraw);
      // Golden Die from joker
      let goldenDieIdx = null;
      if (g.equippedJokers.find(j => j.id === 16)) {
        goldenDieIdx = Math.floor(Math.random() * 5);
      }
      // Four-Leaf Clover
      const freeRerolls = g.equippedJokers.find(j => j.id === 17) ? 1 : 0;
      return { ...g, hand: newHand, deck: newDeck, goldenDieIdx, freeRerolls };
    });
  }, []);

  const drawCards = useCallback((count = 5) => {
    setG(g => {
      const toDraw = Math.min(count, g.deck.length);
      const newHand = [...g.hand, ...g.deck.slice(0, toDraw)].slice(0, 10);
      const newDeck = g.deck.slice(toDraw);
      return { ...g, hand: newHand, deck: newDeck };
    });
  }, []);

  const playCard = (cardIdx) => {
    setG(g => {
      if (g.phase !== "play") return g;
      const card = g.hand[cardIdx];
      if (!card) return g;
      // Energy Drink special: 0 cost, discard for +1 energy
      if (card.id === 18) {
        const newHand = g.hand.filter((_, i) => i !== cardIdx);
        return {
          ...g, hand: newHand,
          energy: Math.min(g.energy + 1, g.maxEnergy + 2),
          cardsPlayedThisRound: g.cardsPlayedThisRound + 1,
          message: "Energy Drink! +1 Energy.",
          // Scrapper joker
          gold: g.equippedJokers.find(j => j.id === 20) ? g.gold + 1 : g.gold,
        };
      }
      if (card.cost > g.energy) {
        return { ...g, message: "Not enough Energy!" };
      }
      return {
        ...g,
        selectedCardIdx: cardIdx,
        pendingCard: card,
        pendingStep: getFirstStep(card),
        pendingData: {},
        message: "",
      };
    });
  };

  const getFirstStep = (card) => {
    switch (card.id) {
      case 1: case 2: case 3: case 4: case 8: case 9: case 10: case 11: case 19:
        return "selectDie";
      case 5: return "confirmRerollAll";
      case 6: return "selectDie1";
      case 7: return "lockAndLoad";
      case 12: return "wildcard";
      case 13: return "snakeEyes";
      case 14: return "boxcars";
      case 15: return "squeeze";
      case 16: return "confirmMirror";
      case 17: return "drawTwo";
      case 20: return "clairvoyance";
      default: return "done";
    }
  };

  const selectDie = (dieIdx) => {
    setG(g => {
      if (!g.pendingCard) return g;
      const card = g.pendingCard;
      const dice = g.dice.map(d => ({ ...d }));
      let newEnergy = g.energy - card.cost;
      let newHand = g.hand.filter((_, i) => i !== g.selectedCardIdx);
      let msg = `Played: ${card.name}`;
      let extraGold = g.equippedJokers.find(j => j.id === 20) ? 1 : 0;

      switch (card.id) {
        case 1: dice[dieIdx].value = clampDie(dice[dieIdx].value + 1); break;
        case 2: dice[dieIdx].value = clampDie(dice[dieIdx].value - 1); break;
        case 3: { const opp = {1:6,2:5,3:4,4:3,5:2,6:1}; dice[dieIdx].value = opp[dice[dieIdx].value]; break; }
        case 4: dice[dieIdx].value = rollDie(); break;
        case 8: dice[dieIdx].value = 6; break;
        case 9: dice[dieIdx].value = 1; break;
        case 10: { let v; do { v = rollDie(); } while (v % 2 !== 0); dice[dieIdx].value = v; break; }
        case 11: { let v; do { v = rollDie(); } while (v % 2 === 0); dice[dieIdx].value = v; break; }
        case 19: dice[dieIdx].value = rollDie(); break;
        default: break;
      }

      return {
        ...g, dice, energy: newEnergy, hand: newHand,
        pendingCard: null, pendingStep: null, selectedCardIdx: null,
        cardsPlayedThisRound: g.cardsPlayedThisRound + 1,
        gold: g.gold + extraGold,
        message: msg,
      };
    });
  };

  const handleDieClick = (dieIdx) => {
    setG(g => {
      if (!g.pendingCard || !g.pendingStep) return g;
      const step = g.pendingStep;
      
      if (step === "selectDie") { selectDie(dieIdx); return g; }
      if (step === "selectDie1") {
        return { ...g, pendingData: { die1: dieIdx }, pendingStep: "selectDie2" };
      }
      if (step === "selectDie2") {
        const die1 = g.pendingData.die1;
        const dice = g.dice.map(d => ({ ...d }));
        dice[dieIdx].value = dice[die1].value;
        const newHand = g.hand.filter((_, i) => i !== g.selectedCardIdx);
        const extraGold = g.equippedJokers.find(j => j.id === 20) ? 1 : 0;
        return {
          ...g, dice, pendingCard: null, pendingStep: null, pendingData: {},
          selectedCardIdx: null,
          energy: g.energy - g.pendingCard.cost,
          hand: newHand,
          cardsPlayedThisRound: g.cardsPlayedThisRound + 1,
          gold: g.gold + extraGold,
          message: "Duplicate applied!",
        };
      }
      return g;
    });
  };

  // Resolve pending card steps triggered by die clicks
  useEffect(() => {
    // handled inline
  }, []);

  const handlePendingStep = (step, data) => {
    setG(g => {
      if (!g.pendingCard) return g;
      const card = g.pendingCard;
      const dice = g.dice.map(d => ({ ...d }));
      const newHand = g.hand.filter((_, i) => i !== g.selectedCardIdx);
      const extraGold = g.equippedJokers.find(j => j.id === 20) ? 1 : 0;
      const base = {
        ...g,
        energy: g.energy - card.cost,
        hand: newHand,
        pendingCard: null, pendingStep: null, pendingData: {},
        selectedCardIdx: null,
        cardsPlayedThisRound: g.cardsPlayedThisRound + 1,
        gold: g.gold + extraGold,
      };

      if (step === "rerollAll") {
        const newDice = dice.map(d => ({ ...d, value: rollDie(), locked: false }));
        return { ...base, dice: newDice, message: "Re-rolled all dice!" };
      }
      if (step === "wildcard") {
        return { ...g, wildcardDieIdx: data.dieIdx, pendingStep: "wildcardValue" };
      }
      if (step === "wildcardValue") {
        dice[g.wildcardDieIdx].value = data.value;
        return { ...base, dice, wildcardDieIdx: null, message: "Wildcard set!" };
      }
      if (step === "snakeEyes") {
        const [i1, i2] = data.indices;
        dice[i1].value = 1; dice[i2].value = 1;
        return { ...base, dice, message: "Snake Eyes! Two 1s." };
      }
      if (step === "boxcars") {
        const [i1, i2] = data.indices;
        dice[i1].value = 6; dice[i2].value = 6;
        return { ...base, dice, message: "Boxcars! Two 6s." };
      }
      if (step === "mirror") {
        dice[4].value = dice[0].value;
        return { ...base, dice, message: "Mirror: copied left to right." };
      }
      if (step === "drawTwo") {
        const toDraw = Math.min(2, g.deck.length);
        const newHand2 = [...newHand, ...g.deck.slice(0, toDraw)].slice(0, 10);
        const newDeck = g.deck.slice(toDraw);
        return { ...base, hand: newHand2, deck: newDeck, message: "Drew 2 cards!" };
      }
      if (step === "lockAndLoad") {
        const [i1, i2] = data.indices;
        const newDice = dice.map((d, i) =>
          i === i1 || i === i2 ? d : { ...d, value: rollDie() }
        );
        return { ...base, dice: newDice, message: "Lock & Load!" };
      }
      if (step === "squeeze") {
        const delta = data.delta;
        const newDice = dice.map(d => ({ ...d, value: clampDie(d.value + delta) }));
        return { ...base, dice: newDice, message: `The Squeeze: ${delta > 0 ? "+" : ""}${delta} all dice.` };
      }
      if (step === "clairvoyance") {
        const top3 = g.deck.slice(0, 3);
        return { ...g, clairvoyanceCards: top3, pendingStep: "clairvoyancePick" };
      }
      if (step === "clairvoyancePick") {
        const chosen = g.deck[data.idx];
        const newDeck = g.deck.filter((_, i) => i !== data.idx);
        const newHand2 = [...newHand, chosen].slice(0, 10);
        return { ...base, hand: newHand2, deck: newDeck, clairvoyanceCards: null, message: "Clairvoyance!" };
      }
      return g;
    });
  };

  const submitHand = () => {
    setG(g => {
      if (g.phase !== "play") return g;
      const result = scoreHand(
        g.dice, g.equippedJokers, g.handHistory,
        g.cardsPlayedThisRound, g.gold, g.handIdx
      );
      const newCumulative = g.cumulativeScore + result.score;
      const newHandHistory = [...g.handHistory, result.handName];

      return {
        ...g,
        cumulativeScore: newCumulative,
        handHistory: newHandHistory,
        scorePopup: result,
        // don't advance hand yet — wait for popup dismiss
      };
    });
  };

  const dismissScorePopup = () => {
    setG(g => {
      const nextHandIdx = g.handIdx + 1;
      const target = ROUNDS[g.roundIdx].target;

      // Re-roll all dice for next hand
      const newDice = g.dice.map(() => ({ value: rollDie(), locked: false }));
      // Golden Die
      let goldenDieIdx = null;
      if (g.equippedJokers.find(j => j.id === 16)) goldenDieIdx = Math.floor(Math.random() * 5);
      const freeRerolls = g.equippedJokers.find(j => j.id === 17) ? 1 : 0;

      // Energy reset
      const newEnergy = g.maxEnergy;

      // Draw up to 5 for new hand
      const toDraw = Math.min(5 - g.hand.length, g.deck.length);
      const drawnCards = toDraw > 0 ? g.deck.slice(0, toDraw) : [];
      const newHand = [...g.hand, ...drawnCards].slice(0, 10);
      const newDeck = toDraw > 0 ? g.deck.slice(toDraw) : g.deck;

      if (nextHandIdx >= 5) {
        // Round over
        if (g.cumulativeScore >= target) {
          // Beat the round! Go to shop
          let earnedGold = 4; // base
          earnedGold += g.energy; // unspent energy +$1 each (or +$2 with Energy Saver)
          if (g.equippedJokers.find(j => j.id === 11)) earnedGold += g.energy; // double
          // Interest
          const interest = Math.min(5, Math.floor(g.gold / 5));
          earnedGold += interest;

          if (g.roundIdx + 1 >= ROUNDS.length) {
            // Won the game!
            return { ...g, scorePopup: null, gameOver: true, gameWon: true };
          }

          return {
            ...g,
            phase: "shop",
            scorePopup: null,
            gold: g.gold + earnedGold,
            shopCards: makeShopCards(),
            shopJokers: makeShopJokers(),
            handIdx: 0,
            cumulativeScore: 0,
            cardsPlayedThisRound: 0,
            dice: newDice,
            goldenDieIdx,
            freeRerolls,
            energy: newEnergy,
            hand: newHand,
            deck: newDeck,
          };
        } else {
          // Failed round
          return { ...g, scorePopup: null, gameOver: true, gameWon: false };
        }
      }

      return {
        ...g,
        scorePopup: null,
        handIdx: nextHandIdx,
        dice: newDice,
        goldenDieIdx,
        freeRerolls,
        energy: newEnergy,
        hand: newHand,
        deck: newDeck,
      };
    });
  };

  const handleShopBuy = (type, item, idx) => {
    setG(g => {
      if (type === "card") {
        if (g.gold < 3) return g;
        const newShopCards = g.shopCards.filter((_, i) => i !== idx);
        return {
          ...g, gold: g.gold - 3,
          deck: [...g.deck, item],
          shopCards: newShopCards,
          message: `Bought ${item.name}!`,
        };
      }
      if (type === "joker") {
        if (g.gold < 5 || g.equippedJokers.length >= 5) return g;
        const newShopJokers = g.shopJokers.filter((_, i) => i !== idx);
        return {
          ...g, gold: g.gold - 5,
          equippedJokers: [...g.equippedJokers, item],
          shopJokers: newShopJokers,
          message: `Equipped ${item.name}!`,
        };
      }
      return g;
    });
  };

  const closeShop = () => {
    setG(g => ({
      ...g,
      phase: "play",
      roundIdx: g.roundIdx + 1,
      handIdx: 0,
      cumulativeScore: 0,
      cardsPlayedThisRound: 0,
      handHistory: [],
      deck: g.deck.length < 10 ? [...g.deck, ...makeShuffledDeck().slice(0, 10)] : g.deck,
    }));
  };

  const useFreeReroll = () => {
    setG(g => {
      if (g.freeRerolls <= 0) return g;
      const newDice = g.dice.map(() => ({ value: rollDie(), locked: false }));
      let goldenDieIdx = null;
      if (g.equippedJokers.find(j => j.id === 16)) goldenDieIdx = Math.floor(Math.random() * 5);
      return { ...g, dice: newDice, freeRerolls: g.freeRerolls - 1, goldenDieIdx, message: "Free re-roll used!" };
    });
  };

  const restart = () => setG(initState());

  // ── Resolve pending steps via handlers ──

  const resolvePendingCard = (step, data) => {
    if (step === "selectDie") {
      selectDie(data.dieIdx);
    } else {
      handlePendingStep(step, data);
    }
  };

  // Render overlays
  const renderOverlays = () => {
    const g = G;
    if (g.pendingCard && g.pendingStep === "confirmRerollAll") {
      return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#1a0e04", border: "2px solid #ff9b4a", borderRadius: "16px", padding: "32px", textAlign: "center", fontFamily: "'Playfair Display', serif" }}>
            <div style={{ color: "#ff9b4a", fontSize: "18px", marginBottom: "20px" }}>Re-roll all 5 dice?</div>
            <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
              <button onClick={() => resolvePendingCard("rerollAll", {})} style={{ background: "#ff9b4a", color: "#1a0800", border: "none", borderRadius: "8px", padding: "10px 24px", fontSize: "14px", fontWeight: "700", cursor: "pointer" }}>Confirm</button>
              <button onClick={() => setG(g => ({ ...g, pendingCard: null, pendingStep: null, selectedCardIdx: null }))} style={{ background: "#333", color: "#aaa", border: "none", borderRadius: "8px", padding: "10px 24px", fontSize: "14px", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      );
    }
    if (g.pendingCard && g.pendingStep === "confirmMirror") {
      return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#1a0e04", border: "2px solid #4aff9b", borderRadius: "16px", padding: "32px", textAlign: "center", fontFamily: "'Playfair Display', serif" }}>
            <div style={{ color: "#4aff9b", fontSize: "18px", marginBottom: "20px" }}>Copy die [1] value to die [5]?</div>
            <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
              <button onClick={() => resolvePendingCard("mirror", {})} style={{ background: "#4aff9b", color: "#1a0800", border: "none", borderRadius: "8px", padding: "10px 24px", fontSize: "14px", fontWeight: "700", cursor: "pointer" }}>Confirm</button>
              <button onClick={() => setG(g => ({ ...g, pendingCard: null, pendingStep: null, selectedCardIdx: null }))} style={{ background: "#333", color: "#aaa", border: "none", borderRadius: "8px", padding: "10px 24px", fontSize: "14px", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      );
    }
    if (g.pendingCard?.id === 7 && g.pendingStep === "lockAndLoad") {
      return <LockPicker dice={g.dice} count={2} title="Lock & Load — keep 2 dice"
        onPick={indices => resolvePendingCard("lockAndLoad", { indices })} />;
    }
    if (g.pendingCard?.id === 13 && g.pendingStep === "snakeEyes") {
      return <LockPicker dice={g.dice} count={2} title="Snake Eyes — choose 2 dice to become 1s"
        onPick={indices => resolvePendingCard("snakeEyes", { indices })} />;
    }
    if (g.pendingCard?.id === 14 && g.pendingStep === "boxcars") {
      return <LockPicker dice={g.dice} count={2} title="Boxcars — choose 2 dice to become 6s"
        onPick={indices => resolvePendingCard("boxcars", { indices })} />;
    }
    if (g.pendingCard?.id === 15 && g.pendingStep === "squeeze") {
      return <SqueezePicker onPick={delta => resolvePendingCard("squeeze", { delta })} />;
    }
    if (g.pendingCard?.id === 17 && g.pendingStep === "drawTwo") {
      resolvePendingCard("drawTwo", {});
      return null;
    }
    if (g.pendingCard?.id === 20 && g.pendingStep === "clairvoyance") {
      resolvePendingCard("clairvoyance", {});
      return null;
    }
    if (g.clairvoyanceCards) {
      return <ClairvoyancePicker cards={g.clairvoyanceCards}
        onPick={idx => resolvePendingCard("clairvoyancePick", { idx })} />;
    }
    if (g.wildcardDieIdx === null && g.pendingCard?.id === 12 && g.pendingStep === "wildcard") {
      return <LockPicker dice={g.dice} count={1} title="Wildcard — select die to change"
        onPick={([dieIdx]) => handlePendingStep("wildcard", { dieIdx })} />;
    }
    if (g.wildcardDieIdx !== null) {
      return <WildcardPicker onPick={value => handlePendingStep("wildcardValue", { value })} />;
    }
    return null;
  };

  const g = G;
  const round = ROUNDS[g.roundIdx] || ROUNDS[ROUNDS.length - 1];
  const progress = Math.min(1, g.cumulativeScore / round.target);
  const currentHandName = evaluateHand(g.dice);
  const previewScore = scoreHand(g.dice, g.equippedJokers, g.handHistory, g.cardsPlayedThisRound, g.gold, g.handIdx);

  const needsDieSelection = g.pendingCard && [
    "selectDie", "selectDie1", "selectDie2"
  ].includes(g.pendingStep);

  if (g.gameOver) {
    return <GameOver won={g.gameWon} round={g.roundIdx + 1} onRestart={restart} />;
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 50% 30%, #1a4a1a 0%, #0d2e0d 50%, #071407 100%)",
      backgroundImage: `
        radial-gradient(ellipse at 50% 30%, #1a4a1a 0%, #0d2e0d 50%, #071407 100%),
        repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(0,0,0,0.03) 40px, rgba(0,0,0,0.03) 41px),
        repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(0,0,0,0.03) 40px, rgba(0,0,0,0.03) 41px)
      `,
      padding: "16px",
      fontFamily: "'Playfair Display', serif",
      color: "#fff",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      position: "relative",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&display=swap" rel="stylesheet" />

      {/* ── HEADER ── */}
      <div className="top-bar" style={{
        background: "linear-gradient(90deg, #1a0e04, #2a1a08, #1a0e04)",
        border: "1px solid #5a4020",
        borderRadius: "10px", padding: "10px 20px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
      }}>
        <div className="top-bar-title" style={{ color: "#ffd700", fontWeight: "900", letterSpacing: "1px" }}>
          🎲 Roll of the Draw
        </div>
        <div className="top-bar-stats">
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#888", fontSize: "9px", letterSpacing: "2px" }}>ROUND</div>
            <div style={{ color: "#ffd700", fontSize: "18px", fontWeight: "700" }}>{g.roundIdx + 1}/10</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#888", fontSize: "9px", letterSpacing: "2px" }}>TARGET</div>
            <div style={{ color: "#ff4a4a", fontSize: "16px", fontWeight: "700" }}>{round.target.toLocaleString()}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#888", fontSize: "9px", letterSpacing: "2px" }}>SCORE</div>
            <div style={{ color: "#4aff9b", fontSize: "18px", fontWeight: "700" }}>{g.cumulativeScore.toLocaleString()}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#888", fontSize: "9px", letterSpacing: "2px" }}>HAND</div>
            <div style={{ color: "#fff", fontSize: "18px", fontWeight: "700" }}>{g.handIdx + 1}/5</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#888", fontSize: "9px", letterSpacing: "2px" }}>GOLD</div>
            <div style={{ color: "#a0ff4a", fontSize: "18px", fontWeight: "700" }}>💰${g.gold}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#888", fontSize: "9px", letterSpacing: "2px" }}>ENERGY</div>
            <div style={{ color: "#ff9b4a", fontSize: "18px", fontWeight: "700" }}>⚡{g.energy}/{g.maxEnergy}</div>
          </div>
        </div>
      </div>

      {/* ── PROGRESS BAR ── */}
      <div style={{
        height: "8px", background: "#0d1a0d",
        borderRadius: "4px", overflow: "hidden",
        border: "1px solid #1a3a1a",
      }}>
        <div style={{
          height: "100%", width: `${progress * 100}%`,
          background: `linear-gradient(90deg, #4aff9b, ${progress >= 1 ? "#ffd700" : "#a0ff4a"})`,
          transition: "width 0.5s ease",
          boxShadow: "0 0 8px rgba(74,255,155,0.6)",
        }} />
      </div>

      {/* ── MAIN AREA ── */}
      <div className="main-layout">

        {/* ── JOKER SLOTS ── */}
        <div className="joker-slots">
          <div style={{ color: "#888", fontSize: "9px", letterSpacing: "2px", marginBottom: "4px" }}>JOKERS</div>
          {Array(5).fill(null).map((_, i) => {
            const joker = g.equippedJokers[i];
            return joker ? (
              <CardComponent key={i} card={joker} isJoker />
            ) : (
              <div key={i} style={{
                height: "54px",
                border: "1px dashed #2a1a0a",
                borderRadius: "8px",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#2a1a0a", fontSize: "20px",
              }}>+</div>
            );
          })}
        </div>

        {/* ── CENTER ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>

          {/* ── DICE AREA ── */}
          <div style={{
            background: "radial-gradient(ellipse at center, #1e5c1e 0%, #0d3a0d 100%)",
            border: "2px solid #2a5020",
            borderRadius: "12px", padding: "20px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
            boxShadow: "inset 0 4px 20px rgba(0,0,0,0.4)",
            position: "relative",
          }}>
            {/* Felt texture hint */}
            <div style={{
              position: "absolute", inset: 0, borderRadius: "10px",
              backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.02) 3px, rgba(0,0,0,0.02) 6px)",
              pointerEvents: "none",
            }} />

            {/* Instruction */}
            {needsDieSelection && (
              <div style={{
                background: "rgba(255,215,0,0.1)", border: "1px solid #ffd700",
                borderRadius: "6px", padding: "6px 16px",
                color: "#ffd700", fontSize: "12px", letterSpacing: "1px",
              }}>
                {g.pendingStep === "selectDie2" ? `${g.pendingCard.name}: select 2nd die` : `${g.pendingCard.name}: select a die`}
              </div>
            )}

            {/* Dice */}
            <div className="dice-row">
              {g.dice.map((die, i) => (
                <div key={i}
                  onClick={() => needsDieSelection && handleDieClick(i)}
                  style={{
                    width: "72px", height: "72px",
                    cursor: needsDieSelection ? "pointer" : "default",
                    transform: needsDieSelection ? "scale(1.05)" : "none",
                    transition: "transform 0.15s",
                    filter: g.goldenDieIdx === i ? "drop-shadow(0 0 10px #ffd700)" : "none",
                    border: needsDieSelection ? "2px solid rgba(255,215,0,0.5)" : "2px solid transparent",
                    borderRadius: "18px",
                    boxSizing: "border-box",
                  }}>
                  <DieFace value={die.value} isGolden={g.goldenDieIdx === i} />
                </div>
              ))}
            </div>

            {/* Hand eval + score preview */}
            <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
              <div style={{
                background: "rgba(0,0,0,0.4)", border: "1px solid #3a5030",
                borderRadius: "8px", padding: "8px 16px", textAlign: "center",
              }}>
                <div style={{ color: "#888", fontSize: "9px", letterSpacing: "2px" }}>CURRENT HAND</div>
                <div style={{ color: "#ffd700", fontSize: "16px", fontWeight: "700" }}>{currentHandName}</div>
              </div>
              <div style={{
                background: "rgba(0,0,0,0.4)", border: "1px solid #3a5030",
                borderRadius: "8px", padding: "8px 16px", textAlign: "center",
              }}>
                <div style={{ color: "#888", fontSize: "9px", letterSpacing: "2px" }}>PREVIEW SCORE</div>
                <div style={{ color: "#4aff9b", fontSize: "16px", fontWeight: "700" }}>{previewScore.score.toLocaleString()}</div>
                <div style={{ color: "#555", fontSize: "9px" }}>{previewScore.chips}×{previewScore.mult}</div>
              </div>
              {g.freeRerolls > 0 && (
                <button onClick={useFreeReroll} style={{
                  background: "#1a3a1a", color: "#4aff9b",
                  border: "2px solid #4aff9b", borderRadius: "8px",
                  padding: "8px 14px", fontSize: "11px", fontWeight: "700",
                  cursor: "pointer", fontFamily: "'Playfair Display', serif",
                }}>
                  🍀 Free Re-roll ({g.freeRerolls})
                </button>
              )}
            </div>

            {/* Submit button */}
            <button onClick={submitHand} disabled={!!g.pendingCard} style={{
              background: g.pendingCard ? "#1a1a1a" : "linear-gradient(135deg, #b8860b, #ffd700, #b8860b)",
              color: g.pendingCard ? "#444" : "#1a0800",
              border: "none", borderRadius: "10px",
              padding: "12px 48px",
              fontSize: "16px", fontWeight: "700",
              cursor: g.pendingCard ? "not-allowed" : "pointer",
              fontFamily: "'Playfair Display', serif",
              letterSpacing: "2px",
              boxShadow: g.pendingCard ? "none" : "0 4px 16px rgba(255,215,0,0.4)",
              transition: "all 0.2s",
            }}>
              SCORE HAND
            </button>
          </div>

          {/* ── HAND ── */}
          <div style={{
            background: "rgba(0,0,0,0.3)",
            border: "1px solid #2a1a0a",
            borderRadius: "10px", padding: "12px",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: "10px",
            }}>
              <div style={{ color: "#888", fontSize: "9px", letterSpacing: "2px" }}>
                YOUR HAND ({g.hand.length} cards) — deck: {g.deck.length}
              </div>
              <div style={{ color: "#c8a060", fontSize: "10px" }}>
                {g.message}
              </div>
            </div>
            <div className="hand-area">
              {g.hand.length === 0 ? (
                <div style={{ color: "#2a1a0a", fontSize: "13px", padding: "20px" }}>
                  No cards in hand
                </div>
              ) : (
                g.hand.map((card, i) => (
                  <CardComponent
                    key={i}
                    card={card}
                    isSelected={g.selectedCardIdx === i}
                    dimmed={card.id !== 18 && (card.cost > g.energy || !!g.pendingCard)}
                    onClick={() => !g.pendingCard && playCard(i)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── OVERLAYS ── */}
      {renderOverlays()}
      {g.scorePopup && <ScorePopup result={g.scorePopup} onDone={dismissScorePopup} />}
      {g.phase === "shop" && (
        <Shop
          gold={g.gold}
          onBuy={handleShopBuy}
          onClose={closeShop}
          shopCards={g.shopCards}
          shopJokers={g.shopJokers}
          equippedJokers={g.equippedJokers}
        />
      )}
    </div>
  );
}
