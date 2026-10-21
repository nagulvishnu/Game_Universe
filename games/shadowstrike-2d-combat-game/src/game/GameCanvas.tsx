import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { CombatScene, GAME_W, GAME_H, type CombatInit, type TrainingOptions } from './scenes/CombatScene';
import { audio } from './audio/AudioManager';

interface Props {
  config: CombatInit;
  paused: boolean;
  trainingOptions?: TrainingOptions;
  onSceneReady?: (scene: CombatScene) => void;
}

export function GameCanvas({ config, paused, trainingOptions, onSceneReady }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<CombatScene | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    audio.init();
    audio.setVolumes({
      master: config.settings.masterVolume,
      music: config.settings.musicVolume,
      sfx: config.settings.sfxVolume,
    });

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      width: GAME_W,
      height: GAME_H,
      backgroundColor: '#05050a',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      physics: undefined,
      fps: { target: 60, forceSetTimeOut: false },
      render: { antialias: true, powerPreference: 'high-performance' },
      scene: [CombatScene],
      audio: { noAudio: true },
      banner: false,
    });
    gameRef.current = game;

    game.scene.start('combat', config);
    const scene = game.scene.getScene('combat') as CombatScene;
    sceneRef.current = scene;
    onSceneReady?.(scene);

    return () => {
      audio.stopMusic();
      game.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
    // the match config is intentionally captured once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    if (trainingOptions && sceneRef.current) sceneRef.current.setTrainingOptions(trainingOptions);
  }, [trainingOptions]);

  useEffect(() => {
    audio.setVolumes({
      master: config.settings.masterVolume,
      music: config.settings.musicVolume,
      sfx: config.settings.sfxVolume,
    });
  }, [config.settings.masterVolume, config.settings.musicVolume, config.settings.sfxVolume]);

  return <div ref={hostRef} className="h-full w-full [&>canvas]:!h-full [&>canvas]:!w-full" />;
}

export function getCombatScene(): CombatScene | null {
  return null;
}
