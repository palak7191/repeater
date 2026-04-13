import { isRed, getDozens, getColumn } from '../engine.js';
import { getChipNumbers } from '../strategy.js';
import './NumberPad.css';

// Roulette table layout: 3 rows (columns) x 12 cols (numbers in order)
const ROWS = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],  // C3
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],  // C2
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],  // C1
];

export default function NumberPad({ onNumber, betD, betC, disabled }) {
  const chipNumbers = betD && betC ? getChipNumbers(betD, betC) : [];

  function handleClick(n) {
    if (!disabled) {
      onNumber(n);
    }
  }

  return (
    <div className="numpad">
      {/* Zero button */}
      <button
        className="numpad__zero"
        onClick={() => handleClick(0)}
        disabled={disabled}
      >
        0
      </button>

      {/* Number grid */}
      <div className="numpad__grid">
        {ROWS.map((row, rowIdx) => (
          <div key={rowIdx} className="numpad__row">
            {row.map(n => {
              const isChip = chipNumbers.includes(n);
              const inDozen = betD && getDozens(n) === betD;
              const inColumn = betC && getColumn(n) === betC;
              const red = isRed(n);

              return (
                <button
                  key={n}
                  className={`numpad__btn ${red ? 'numpad__btn--red' : 'numpad__btn--black'} ${isChip ? 'numpad__btn--chip' : ''} ${inDozen && !isChip ? 'numpad__btn--dozen' : ''} ${inColumn && !isChip ? 'numpad__btn--column' : ''}`}
                  onClick={() => handleClick(n)}
                  disabled={disabled}
                >
                  {n}
                </button>
              );
            })}
            {/* Column label */}
            <div className={`numpad__col-label ${betC === (3 - rowIdx) ? 'numpad__col-label--active' : ''}`}>
              C{3 - rowIdx}
            </div>
          </div>
        ))}

        {/* Dozen labels row */}
        <div className="numpad__dozen-row">
          <div className={`numpad__dozen-label ${betD === 1 ? 'numpad__dozen-label--active' : ''}`}>
            D1 (1-12)
          </div>
          <div className={`numpad__dozen-label ${betD === 2 ? 'numpad__dozen-label--active' : ''}`}>
            D2 (13-24)
          </div>
          <div className={`numpad__dozen-label ${betD === 3 ? 'numpad__dozen-label--active' : ''}`}>
            D3 (25-36)
          </div>
        </div>
      </div>
    </div>
  );
}
