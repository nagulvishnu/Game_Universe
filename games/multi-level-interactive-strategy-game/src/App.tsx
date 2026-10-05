import { useState } from 'react';
import GameScreen from './components/GameScreen';
import LevelSelect from './components/LevelSelect';
import Menu from './components/Menu';
import { LEVELS } from './game/data';
import { isUnlocked, loadProgress, recordWin, saveProgress, type Progress } from './game/storage';

type Screen = { name: 'menu' } | { name: 'levels' } | { name: 'game'; levelId: number; attempt: number };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'menu' });
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const [diffId, setDiffId] = useState(1);

  if (screen.name === 'menu') {
    return (
      <Menu
        progress={progress}
        onPlay={() => setScreen({ name: 'levels' })}
        onReset={() => {
          const empty = { stars: {}, crown: {} };
          saveProgress(empty);
          setProgress(empty);
        }}
      />
    );
  }

  if (screen.name === 'levels') {
    return (
      <LevelSelect
        progress={progress}
        diffId={diffId}
        setDiffId={setDiffId}
        onBack={() => setScreen({ name: 'menu' })}
        onPlay={(levelId) => setScreen({ name: 'game', levelId, attempt: 0 })}
      />
    );
  }

  const level = LEVELS.find((l) => l.id === screen.levelId)!;
  const next = LEVELS.find((l) => l.id === level.id + 1);

  return (
    <GameScreen
      key={`${level.id}-${diffId}-${screen.attempt}`}
      level={level}
      diffId={diffId}
      onExit={() => setScreen({ name: 'levels' })}
      onRetry={() => setScreen({ name: 'game', levelId: level.id, attempt: screen.attempt + 1 })}
      onNext={
        next && (isUnlocked(progress, next.id) || (progress.stars[level.id] ?? 0) > 0)
          ? () => setScreen({ name: 'game', levelId: next.id, attempt: 0 })
          : null
      }
      onWin={(stars) => setProgress((p) => recordWin(p, level.id, stars, diffId))}
    />
  );
}
