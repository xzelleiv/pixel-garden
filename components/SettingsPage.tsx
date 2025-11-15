import type { FC } from 'react';
import type { Preferences } from '../types';
import { GAME_VERSION } from '../constants';

type UpdateStatus = 'idle' | 'checking' | 'ready' | 'upToDate' | 'error';

type SettingsPageProps = {
  audioVolume: number;
  onAudioVolumeChange: (value: number) => void;
  preferences: Preferences;
  onPreferenceChange: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  onCheckForUpdates: () => void;
  isUpdateChecking: boolean;
  updateStatus: UpdateStatus;
};

const SettingsToggle: FC<{
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}> = ({ label, value, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={value}
    onClick={() => onChange(!value)}
  className={`season-panel-solid flex w-full items-center justify-between rounded-lg border border-pixel-border/60 bg-pixel-panel/70 px-3 py-2 text-left transition hover:border-pixel-accent ${value ? 'shadow-pixel' : ''}`}
  >
    <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-pixel-accent">{label}</p>
    <span
      className={`ml-3 inline-flex h-5 w-9 items-center rounded-full border border-pixel-border bg-pixel-console-bg p-0.5 transition ${value ? 'justify-end border-pixel-accent bg-pixel-accent/20' : 'justify-start'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-pixel-accent transition ${value ? '' : 'bg-pixel-text/60'}`}></span>
    </span>
  </button>
);

const SettingsPage: FC<SettingsPageProps> = ({
  audioVolume,
  onAudioVolumeChange,
  preferences,
  onPreferenceChange,
  onCheckForUpdates,
  isUpdateChecking,
  updateStatus,
}) => {
  const musicPercentageLabel = `${Math.round(audioVolume * 100)}%`;
  const effectsPercentageLabel = `${Math.round((preferences.effectsVolume ?? 1) * 100)}%`;
  const updateButtonLabel = isUpdateChecking
    ? 'Checking...'
    : updateStatus === 'ready'
      ? 'Apply Update'
      : 'Check for Updates';
  const versionBannerText = updateStatus === 'ready'
    ? 'Update downloaded! Refresh to apply it.'
    : `Current version: v${GAME_VERSION}`;
  const statusTextMap: Record<UpdateStatus, string> = {
    idle: 'You are on the latest version. Updates install automatically.',
    checking: 'Checking for new builds...',
    ready: 'Update downloaded! Apply it to get the latest fixes.',
  upToDate: 'All caught up.',
    error: 'Could not reach the update server. Try again in a bit.',
  };

  return (
    <div className="flex flex-col gap-6 text-xs text-pixel-console-text">
  <section className="season-panel-solid rounded-xl border border-pixel-border bg-pixel-panel/70 p-4 shadow-inner space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-pixel-accent">Music Volume</p>
            <span className="text-[11px] font-bold text-pixel-accent">{musicPercentageLabel}</span>
          </div>
          <label htmlFor="audio-volume" className="sr-only">
            Music volume
          </label>
          <input
            id="audio-volume"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={audioVolume}
            onChange={event => onAudioVolumeChange(Number(event.target.value))}
            className="mt-2 w-full cursor-pointer appearance-none rounded-full bg-pixel-border/50 accent-pixel-accent"
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-pixel-accent">Effects Volume</p>
            <span className="text-[11px] font-bold text-pixel-accent">{effectsPercentageLabel}</span>
          </div>
          <label htmlFor="effects-volume" className="sr-only">
            Effects volume
          </label>
          <input
            id="effects-volume"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={preferences.effectsVolume ?? 1}
            onChange={event => onPreferenceChange('effectsVolume', Number(event.target.value))}
            className="mt-2 w-full cursor-pointer appearance-none rounded-full bg-pixel-border/50 accent-pixel-accent"
          />
        </div>
      </section>

  <section className="season-panel-solid rounded-xl border border-pixel-border/60 bg-pixel-panel/60 p-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-pixel-accent">Accessibility</p>
        <SettingsToggle
          label="Reduced Motion"
          value={preferences.reducedMotion}
          onChange={(value) => onPreferenceChange('reducedMotion', value)}
        />
        <SettingsToggle
          label="Disable Particles"
          value={preferences.disableParticles}
          onChange={(value) => onPreferenceChange('disableParticles', value)}
        />
        <SettingsToggle
          label="Compact Logs"
          value={preferences.compactLogs}
          onChange={(value) => onPreferenceChange('compactLogs', value)}
        />
      </section>

  <section className="season-panel-solid rounded-xl border border-dashed border-pixel-border/60 bg-pixel-panel/60 p-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-pixel-accent">Gameplay</p>
        <SettingsToggle
          label="Season Tips"
          value={preferences.seasonTips}
          onChange={(value) => onPreferenceChange('seasonTips', value)}
        />
        <SettingsToggle
          label="Classic Actions Layout"
          value={preferences.classicActionsUI}
          onChange={(value) => onPreferenceChange('classicActionsUI', value)}
        />
        <SettingsToggle
          label="Classic Upgrades Layout"
          value={preferences.classicUpgradesUI}
          onChange={(value) => onPreferenceChange('classicUpgradesUI', value)}
        />
        <SettingsToggle
          label="Disable Confetti"
          value={preferences.disableConfetti}
          onChange={(value) => onPreferenceChange('disableConfetti', value)}
        />
      </section>

      <section className="season-panel-solid rounded-xl border border-pixel-border/60 bg-pixel-panel/70 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-pixel-accent">Updates</p>
          <span className="text-[10px] text-pixel-text/70">{versionBannerText}</span>
        </div>
        <button
          type="button"
          onClick={onCheckForUpdates}
          disabled={isUpdateChecking}
          className="season-button w-full rounded-lg border-2 border-pixel-border px-3 py-2 text-xs font-bold uppercase shadow-pixel disabled:opacity-60"
        >
          {updateButtonLabel}
        </button>
        <p className="text-[10px] leading-relaxed text-pixel-text/70">
          {statusTextMap[updateStatus]}
        </p>
      </section>
    </div>
  );
};

export default SettingsPage;
