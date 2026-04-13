import { useStore, DEFAULT_SETTINGS } from '../store.jsx';
import './Settings.css';

function SettingRow({ label, children, hint }) {
  return (
    <div className="set__row">
      <div className="set__row-left">
        <span className="set__row-label">{label}</span>
        {hint && <span className="set__row-hint">{hint}</span>}
      </div>
      <div className="set__row-right">{children}</div>
    </div>
  );
}

function NumberInput({ value, onChange, min, max, step = 1 }) {
  return (
    <input
      type="number"
      className="set__input"
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      min={min}
      max={max}
      step={step}
    />
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      className={`set__toggle ${checked ? 'set__toggle--on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="set__toggle-track">
        <span className="set__toggle-thumb" />
      </span>
      <span className="set__toggle-label">{checked ? 'ON' : 'OFF'}</span>
    </button>
  );
}

export default function Settings({ onBack }) {
  const { state, dispatch } = useStore();
  const { settings } = state;

  function update(key, value) {
    dispatch({ type: 'UPDATE_SETTINGS', settings: { [key]: value } });
  }

  function handleReset() {
    if (window.confirm('Reset all settings to defaults?')) {
      dispatch({ type: 'RESET_SETTINGS' });
    }
  }

  return (
    <div className="set">
      {/* Header */}
      <div className="set__header">
        <button className="set__back" onClick={onBack}>Back</button>
        <div className="set__title">SETTINGS</div>
        <button className="set__reset" onClick={handleReset}>Reset</button>
      </div>

      <div className="set__body">
        {/* Table name */}
        <div className="set__section">
          <div className="set__section-title">TABLE</div>
          <div className="set__card">
            <SettingRow label="Table name" hint="Name for tracking">
              <input
                type="text"
                className="set__input set__input--text"
                value={settings.tableName}
                onChange={e => update('tableName', e.target.value)}
                placeholder="e.g., Vegas Table 3"
              />
            </SettingRow>
          </div>
        </div>

        {/* Core settings */}
        <div className="set__section">
          <div className="set__section-title">CORE</div>
          <div className="set__card">
            <SettingRow label="Bankroll" hint="Starting amount">
              <NumberInput
                value={settings.bankroll}
                onChange={v => update('bankroll', v)}
                min={100}
                step={100}
              />
            </SettingRow>
            <SettingRow label="Base bet" hint="Initial bet amount">
              <NumberInput
                value={settings.baseBet}
                onChange={v => update('baseBet', v)}
                min={1}
                step={5}
              />
            </SettingRow>
            <SettingRow label="Increment" hint="Ladder step size">
              <NumberInput
                value={settings.increment}
                onChange={v => update('increment', v)}
                min={1}
                step={5}
              />
            </SettingRow>
          </div>
        </div>

        {/* Window settings */}
        <div className="set__section">
          <div className="set__section-title">WINDOW</div>
          <div className="set__card">
            <SettingRow label="Start window (W1)" hint="Initial window size">
              <NumberInput
                value={settings.startWindow}
                onChange={v => update('startWindow', v)}
                min={2}
                max={7}
              />
            </SettingRow>
            <SettingRow label="Wide window (W2)" hint="Protective window">
              <NumberInput
                value={settings.wideWindow}
                onChange={v => update('wideWindow', v)}
                min={3}
                max={10}
              />
            </SettingRow>
          </div>
        </div>

        {/* Autoswitch settings */}
        <div className="set__section">
          <div className="set__section-title">AUTOSWITCH</div>
          <div className="set__card">
            <SettingRow label="Enabled">
              <Toggle
                checked={settings.autoswitchEnabled}
                onChange={v => update('autoswitchEnabled', v)}
              />
            </SettingRow>
            <SettingRow label="Switch after losses" hint="Consecutive losses to trigger">
              <NumberInput
                value={settings.switchToWideAfterLosses}
                onChange={v => update('switchToWideAfterLosses', v)}
                min={2}
                max={10}
              />
            </SettingRow>
            <SettingRow label="Net threshold" hint="Only switch if net P&L below">
              <NumberInput
                value={settings.switchToWideNetThreshold}
                onChange={v => update('switchToWideNetThreshold', v)}
                step={50}
              />
            </SettingRow>
            <SettingRow label="Switch back after wins" hint="Consecutive wins to return">
              <NumberInput
                value={settings.switchBackAfterWins}
                onChange={v => update('switchBackAfterWins', v)}
                min={2}
                max={10}
              />
            </SettingRow>
          </div>
        </div>

        {/* Observe-wait settings */}
        <div className="set__section">
          <div className="set__section-title">OBSERVE-WAIT</div>
          <div className="set__card">
            <SettingRow label="Observe at ladder" hint="Stop betting when ladder reaches">
              <NumberInput
                value={settings.observeAtLadder}
                onChange={v => update('observeAtLadder', v)}
                min={2}
                max={10}
              />
            </SettingRow>
            <SettingRow label="Observe window" hint="Spins to watch">
              <NumberInput
                value={settings.observeWindow}
                onChange={v => update('observeWindow', v)}
                min={3}
                max={15}
              />
            </SettingRow>
            <SettingRow label="Wins needed" hint="Wins to resume betting">
              <NumberInput
                value={settings.observeWinsNeeded}
                onChange={v => update('observeWinsNeeded', v)}
                min={1}
                max={10}
              />
            </SettingRow>
          </div>
        </div>

        {/* Part-win settings */}
        <div className="set__section">
          <div className="set__section-title">PART-WIN</div>
          <div className="set__card">
            <SettingRow label="Reset below ladder" hint="Full reset if ladder below this on part-win">
              <NumberInput
                value={settings.pwResetBelowLadder}
                onChange={v => update('pwResetBelowLadder', v)}
                min={1}
                max={5}
              />
            </SettingRow>
          </div>
        </div>

        {/* Ratchet settings */}
        <div className="set__section">
          <div className="set__section-title">RATCHET</div>
          <div className="set__card">
            <SettingRow label="Enabled">
              <Toggle
                checked={settings.ratchetEnabled}
                onChange={v => update('ratchetEnabled', v)}
              />
            </SettingRow>
            <SettingRow label="After wins" hint="Consecutive wins to ratchet">
              <NumberInput
                value={settings.ratchetAfterWins}
                onChange={v => update('ratchetAfterWins', v)}
                min={2}
                max={10}
              />
            </SettingRow>
            <SettingRow label="Ratchet amount" hint="Increase per step">
              <NumberInput
                value={settings.ratchetAmount}
                onChange={v => update('ratchetAmount', v)}
                min={5}
                step={5}
              />
            </SettingRow>
            <SettingRow label="Max base bet" hint="Maximum ratcheted base">
              <NumberInput
                value={settings.ratchetMax}
                onChange={v => update('ratchetMax', v)}
                min={settings.baseBet}
                step={10}
              />
            </SettingRow>
            <SettingRow label="Reset on losses" hint="Losses to reset ratchet">
              <NumberInput
                value={settings.ratchetResetOnLoss}
                onChange={v => update('ratchetResetOnLoss', v)}
                min={1}
                max={5}
              />
            </SettingRow>
          </div>
        </div>

        {/* Current values summary */}
        <div className="set__section">
          <div className="set__section-title">CURRENT CONFIGURATION</div>
          <div className="set__summary">
            <div className="set__summary-row">
              <span>Bankroll:</span>
              <span className="mono">${settings.bankroll.toLocaleString()}</span>
            </div>
            <div className="set__summary-row">
              <span>Bet range:</span>
              <span className="mono">
                ${settings.baseBet} - ${settings.baseBet + 5 * settings.increment}
              </span>
            </div>
            <div className="set__summary-row">
              <span>Window:</span>
              <span className="mono">W={settings.startWindow} → W={settings.wideWindow}</span>
            </div>
            <div className="set__summary-row">
              <span>Observe:</span>
              <span className="mono">L{settings.observeAtLadder}+ ({settings.observeWindow} spins)</span>
            </div>
            <div className="set__summary-row">
              <span>Ratchet:</span>
              <span className="mono">
                {settings.ratchetEnabled ? `+$${settings.ratchetAmount} (max $${settings.ratchetMax})` : 'OFF'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
