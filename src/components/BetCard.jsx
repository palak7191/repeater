import { useState, useEffect, useRef } from 'react';
import { getChipNumbers, DOZ_LABEL, COL_LABEL } from '../strategy.js';
import './BetCard.css';

export default function BetCard({
  instruction,
  settings,
  prevInstruction,
  onMissedBet,
  onPartialBet,
}) {
  const [changeType, setChangeType] = useState(null);
  const prevRef = useRef(null);

  // Detect changes between instructions
  useEffect(() => {
    if (!instruction || instruction.type !== 'BET') {
      setChangeType(null);
      prevRef.current = null;
      return;
    }

    const prev = prevRef.current;
    if (prev && prev.type === 'BET') {
      const posChanged = prev.bD !== instruction.bD || prev.bC !== instruction.bC;
      const sizeChanged = prev.betAmt !== instruction.betAmt;

      if (posChanged && sizeChanged) {
        setChangeType('both');
      } else if (posChanged) {
        setChangeType('position');
      } else if (sizeChanged) {
        setChangeType('size');
      } else {
        setChangeType(null);
      }

      // Clear after 1.5s
      if (posChanged || sizeChanged) {
        const timer = setTimeout(() => setChangeType(null), 1500);
        return () => clearTimeout(timer);
      }
    }

    prevRef.current = instruction;
  }, [instruction]);

  if (!instruction) {
    return (
      <div className="betcard betcard--empty">
        <div className="betcard__msg">Start a session to begin</div>
      </div>
    );
  }

  // Warmup mode
  if (instruction.type === 'WARMUP') {
    return (
      <div className="betcard betcard--warmup">
        <div className="betcard__header">
          <span className="betcard__mode">WARMUP</span>
        </div>
        <div className="betcard__warmup-content">
          <div className="betcard__warmup-count">
            {instruction.warmupDone} / {instruction.warmupTotal}
          </div>
          <div className="betcard__warmup-msg">
            Enter spin results (no betting)
          </div>
          <div className="betcard__warmup-bar">
            <div
              className="betcard__warmup-progress"
              style={{ width: `${(instruction.warmupDone / instruction.warmupTotal) * 100}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Observe mode
  if (instruction.type === 'OBSERVE') {
    return (
      <div className="betcard betcard--observe">
        <div className="betcard__header">
          <span className="betcard__mode animate-pulse">OBSERVING</span>
          <span className="betcard__ladder">L{instruction.ladder}</span>
        </div>
        <div className="betcard__observe-content">
          <div className="betcard__observe-icon">👁</div>
          <div className="betcard__observe-msg">{instruction.message}</div>
          <div className="betcard__observe-hint">
            Waiting for pattern to stabilize
          </div>
        </div>
      </div>
    );
  }

  // Bet mode
  const { bD, bC, betAmt, ladder, window, urgency, baseCurrent } = instruction;
  const chipNumbers = getChipNumbers(bD, bC);
  const showMissedPartial = ladder > 0;

  // Build ladder reference
  const ladderRef = [];
  for (let i = 0; i <= 5; i++) {
    const amt = settings.baseBet + i * settings.increment;
    ladderRef.push({ level: i, amt });
  }

  return (
    <div className={`betcard betcard--${urgency}`}>
      {/* Change indicator badge */}
      {changeType && (
        <div className={`betcard__change betcard__change--${changeType}`}>
          {changeType === 'position' && 'Position changed'}
          {changeType === 'size' && 'Size changed'}
          {changeType === 'both' && 'Position + Size changed'}
        </div>
      )}

      <div className="betcard__header">
        <span className="betcard__mode">BET</span>
        <span className="betcard__window">W={window}</span>
        <span className="betcard__ladder">L{ladder}</span>
      </div>

      <div className="betcard__bet-info">
        <div className="betcard__position">
          <span className="betcard__doz">{DOZ_LABEL[bD]}</span>
          <span className="betcard__plus">+</span>
          <span className="betcard__col">{COL_LABEL[bC]}</span>
        </div>
        <div className="betcard__amount">${betAmt}</div>
        {baseCurrent > settings.baseBet && (
          <div className="betcard__ratchet">
            Ratcheted: base ${baseCurrent}
          </div>
        )}
      </div>

      <div className="betcard__chips">
        <div className="betcard__chips-label">Place chips on:</div>
        <div className="betcard__chips-numbers">
          {chipNumbers.map(n => (
            <span key={n} className="betcard__chip-num">{n}</span>
          ))}
        </div>
      </div>

      {/* Ladder reference */}
      <div className="betcard__ladder-ref">
        {ladderRef.map(({ level, amt }) => (
          <div
            key={level}
            className={`betcard__ladder-item ${level === ladder ? 'betcard__ladder-item--active' : ''}`}
          >
            <span className="betcard__ladder-level">L{level}</span>
            <span className="betcard__ladder-amt">${amt}</span>
          </div>
        ))}
      </div>

      {/* Missed/Partial bet buttons */}
      {showMissedPartial && (
        <div className="betcard__actions">
          <button className="betcard__action betcard__action--missed" onClick={onMissedBet}>
            Missed Bet
          </button>
          <button className="betcard__action betcard__action--partial" onClick={onPartialBet}>
            Partial Bet
          </button>
        </div>
      )}
    </div>
  );
}
