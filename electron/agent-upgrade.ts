/**
 * Rules for "an engine needs a newer version" that must stay testable without Electron or a CLI.
 *
 * Why this exists: when Codex answered "requires a newer version of Codex", the app used to upgrade it on its
 * own and, if the official download failed, went on to a global npm/winget install and then tried other
 * models. Nothing here installs anything. It only:
 *   - remembers that an engine was told to upgrade (so the connection screen can show "업그레이드 필요"),
 *   - words the notice the user sees when a run is stopped because of it,
 *   - judges whether an upgrade the user approved really took effect.
 */

export const AGENT_UPGRADE_NOTE_LIMIT = 8;

/** The one plain notice for a run that was stopped because Codex is too old. Keep the point in the first 120 chars. */
export function codexUpgradeRequiredMessage(): string {
  return [
    'Codex 업그레이드 필요 — 지금 쓰는 모델은 더 새로운 Codex 가 있어야 합니다.',
    '설정 → AI 연결에서 Codex 의 [업그레이드]를 눌러 확인한 뒤 다시 실행해 주세요.',
    '앱은 확인 없이 설치하지 않고, 다른 엔진·모델로 몰래 바꾸지도 않습니다.',
  ].join('\n');
}

export interface AgentUpgradeMemo {
  /** Remember that `provider` was told to upgrade. `version` is what was installed at that moment (if known). */
  mark(provider: string, info?: { version?: string }): void;
  clear(provider: string): void;
  /**
   * Is the note still true? When both the remembered and the current version are known and differ, the user
   * has upgraded by hand: the note is dropped. An unknown version keeps it.
   */
  needs(provider: string, currentVersion?: string): boolean;
}

export function createAgentUpgradeMemo(): AgentUpgradeMemo {
  const notes = new Map<string, { version: string }>();
  return {
    mark(provider, info = {}) {
      if (!provider) return;
      if (!notes.has(provider) && notes.size >= AGENT_UPGRADE_NOTE_LIMIT) return;
      notes.set(provider, { version: String(info.version || '') });
    },
    clear(provider) {
      notes.delete(provider);
    },
    needs(provider, currentVersion) {
      const note = notes.get(provider);
      if (!note) return false;
      if (note.version && currentVersion && note.version !== currentVersion) {
        notes.delete(provider);
        return false;
      }
      return true;
    },
  };
}

export interface CodexUpgradeFacts {
  /** Result of the official download + install (never an npm / winget run). */
  exitCode: number | null;
  timedOut: boolean;
  /** Version text of the program before the upgrade, when it was known. */
  versionBefore?: string;
  /** What a fresh detection finds after the upgrade. */
  toolAfter: { installed: boolean; usable?: boolean; version?: string };
}

/** Did the upgrade the user approved really take effect? Failure texts say what happened and what did NOT. */
export function judgeCodexUpgrade(facts: CodexUpgradeFacts): { ok: boolean; error?: string } {
  const noOtherWay = '다른 방법(npm 등)으로 바꿔 설치하지 않았습니다.';
  if (facts.timedOut || facts.exitCode !== 0) {
    return {
      ok: false,
      error: `Codex 업그레이드에 실패했습니다. 공식 설치 파일 받기가 끝나지 않았습니다. ${noOtherWay}`,
    };
  }
  const after = facts.toolAfter;
  if (!after.installed || after.usable === false) {
    return {
      ok: false,
      error: `Codex 업그레이드 파일은 받았지만 실행 확인이 되지 않았습니다. ${noOtherWay}`,
    };
  }
  if (facts.versionBefore && after.version && facts.versionBefore === after.version) {
    return {
      ok: false,
      error: `Codex 업그레이드가 적용되지 않았습니다. 업그레이드 뒤에도 같은 버전(${after.version})입니다. ${noOtherWay}`,
    };
  }
  return { ok: true };
}
