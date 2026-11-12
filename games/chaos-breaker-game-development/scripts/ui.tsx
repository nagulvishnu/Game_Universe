import './stub';
import { renderToString } from 'react-dom/server';
import Hub from '../src/ui/Hub';
import Hud from '../src/ui/Hud';
import { PauseMenu, CombatMenu, ArenaMenu, GameOver } from '../src/ui/Overlays';
import Touch from '../src/ui/Touch';
import { Armory, SettingsPanel, ControlsPanel, ScoreTable } from '../src/ui/common';
import { useGame } from '../src/game/store';
const t = (n: string, el: any) => { try { const s = renderToString(el); console.log('ok', n, s.length); } catch (e: any) { console.log('FAIL', n, e.stack.split('\n').slice(0, 4).join('\n')); } };
const st = useGame.getState();
t('Hub splash', <Hub />);
for (const tab of ['play', 'armory', 'scores', 'settings', 'controls'] as const) { st.set({ hubTab: tab }); t('Hub ' + tab, <Hub />); }
t('Hud', <Hud />); t('Pause', <PauseMenu />); t('Combat', <CombatMenu />); t('Arena', <ArenaMenu />); t('Touch', <Touch />);
t('Armory', <Armory />); t('Settings', <SettingsPanel />); t('Controls', <ControlsPanel />); t('Scores', <ScoreTable mode="all" />);
st.set({ result: { score: 12345, wave: 4, mode: 'survival', weapon: 'void', rank: 1, victory: false, stats: ['a', 'b'] } }); t('GameOver', <GameOver />);
