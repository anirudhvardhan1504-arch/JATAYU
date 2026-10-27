/**
 * Utility to inject replay mode headers across frontend service calls.
 */
export function getReplayHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const queryReplay = searchParams.get('demo') === 'replay' || searchParams.get('replay') === 'true';
    const storageReplay = sessionStorage.getItem('jatayu_replay_mode') === 'true';

    if (!queryReplay && !storageReplay) {
      return {};
    }

    const scenario =
      searchParams.get('scenario') ||
      sessionStorage.getItem('jatayu_replay_scenario') ||
      'chennai_deluge_2023';

    return {
      'X-Jatayu-Replay-Mode': 'true',
      'X-Jatayu-Replay-Scenario': scenario,
    };
  } catch {
    return {};
  }
}
