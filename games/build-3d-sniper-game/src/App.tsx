import { useCallback, useEffect, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { DEFAULT_LOADOUT_CONFIG } from './data/customization';
import { CAMPAIGN_MISSIONS } from './data/missions';
import { getWeaponById } from './data/weapons';
import { liveInput, resetTransientInput } from './game/inputState';
import {
  evaluateMissionOutcome,
  loadSaveData,
  persistSaveData,
  resetSaveData,
} from './save/storage';
import {
  HudSnapshot,
  MissionDefinition,
  MissionResultSummary,
  PlayerSaveData,
  ScreenName,
} from './types/game';
import { InGameHUD } from './ui/InGameHUD';
import {
  CampaignMapScreen,
  ContractBoardScreen,
  GameModesScreen,
  LeaderboardScreen,
  LoadingTransitionScreen,
  MainMenuScreen,
  MissionBriefingScreen,
  MissionResultScreen,
  PauseOverlay,
  ProgressionScreen,
  SettingsScreen,
} from './ui/MenuScreens';
import { WeaponWorkshop } from './ui/WeaponWorkshop';
import { LevelScene, MissionEndPayload } from './world/LevelScene';

export default function App() {
  const [save, setSave] = useState<PlayerSaveData>(() => loadSaveData());
  const [screen, setScreen] = useState<ScreenName>('main_menu');
  const [returnScreen, setReturnScreen] = useState<ScreenName>('main_menu');
  const [selectedMission, setSelectedMission] = useState<MissionDefinition>(CAMPAIGN_MISSIONS[0]);
  const [isPaused, setIsPaused] = useState(false);
  const [runNonce, setRunNonce] = useState(1);
  const [hudSnapshot, setHudSnapshot] = useState<HudSnapshot | null>(null);
  const [lastResult, setLastResult] = useState<MissionResultSummary | null>(null);

  // Sync audio volume settings whenever save settings change
  useEffect(() => {
    const s = save.settings;
    soundEngine.updateSettings(s.masterVolume, s.sfxVolume, s.ambienceVolume, s.muted);
  }, [save.settings]);

  const updateSaveAndPersist = useCallback(
    (updater: (prev: PlayerSaveData) => PlayerSaveData) => {
      setSave((prev) => {
        const next = updater(prev);
        persistSaveData(next);
        return next;
      });
    },
    []
  );

  const launchMission = useCallback((mission: MissionDefinition) => {
    resetTransientInput();
    setSelectedMission(mission);
    setHudSnapshot(null);
    setIsPaused(false);
    setRunNonce((n) => n + 1);
    setScreen('loading');
    setTimeout(() => {
      setScreen('playing');
    }, 320);
  }, []);

  const openBriefingForMission = useCallback(
    (mission: MissionDefinition, backTo: ScreenName = 'main_menu') => {
      setSelectedMission(mission);
      setReturnScreen(backTo);
      setScreen('mission_briefing');
    },
    []
  );

  const handleMissionEnd = useCallback(
    (payload: MissionEndPayload) => {
      if (document.pointerLockElement && document.exitPointerLock) {
        try {
          document.exitPointerLock();
        } catch {
          // Ignore
        }
      }
      resetTransientInput();
      const weapon = getWeaponById(save.equippedWeaponId);
      const { updatedSave, summary } = evaluateMissionOutcome({
        save,
        mission: selectedMission,
        victory: payload.victory,
        failureReason: payload.failureReason,
        shotsFired: payload.shotsFired,
        shotsHit: payload.shotsHit,
        kills: payload.kills,
        headshots: payload.headshots,
        longestShot: payload.longestShot,
        timeSeconds: payload.timeSeconds,
        alarmsTriggered: payload.alarmsTriggered,
        optionalCompletedCount: payload.optionalCompletedCount,
        weaponName: weapon.name,
      });
      setSave(updatedSave);
      setLastResult(summary);
      setScreen(payload.victory ? 'mission_victory' : 'mission_failure');
    },
    [save, selectedMission]
  );

  // Global Keyboard, Mouse, PointerLock, Drag Fallback & Scroll Wheel Input Listeners during Active Play
  useEffect(() => {
    if (screen !== 'playing') {
      resetTransientInput();
      return;
    }

    let isDraggingLook = false;
    let lastClientX = 0;
    let lastClientY = 0;

    const kb = save.settings.keyBindings;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        setIsPaused((prev) => {
          const next = !prev;
          if (next && document.pointerLockElement && document.exitPointerLock) {
            try {
              document.exitPointerLock();
            } catch {
              // Ignore
            }
          }
          return next;
        });
        return;
      }

      if (isPaused) return;

      if (e.code === kb.tacticalMap) {
        e.preventDefault();
        liveInput.tacticalMapHeld = true;
      }

      liveInput.keysDown.add(e.code);

      if (!e.repeat) {
        if (e.code === kb.crouch || e.code === 'ControlLeft') {
          liveInput.crouchToggleRequested = true;
        } else if (e.code === kb.reload) {
          liveInput.reloadRequested = true;
        } else if (e.code === kb.interact) {
          liveInput.interactRequested = true;
        } else if (e.code === kb.binoculars) {
          liveInput.binocularsToggleRequested = true;
        } else if (e.code === kb.cameraToggle) {
          liveInput.cameraModeToggleRequested = true;
        } else if (e.code === kb.equipment1) {
          liveInput.equipment1Requested = true;
        } else if (e.code === kb.equipment2) {
          liveInput.equipment2Requested = true;
        } else if (e.code === kb.ammoCycle) {
          liveInput.ammoCycleRequested = true;
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      liveInput.keysDown.delete(e.code);
      if (e.code === kb.tacticalMap) {
        liveInput.tacticalMapHeld = false;
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (isPaused) return;
      const onUiButton = Boolean((e.target as HTMLElement | null)?.closest('button'));
      if (onUiButton) return;

      if (e.button === 0) {
        liveInput.fireRequested = true;
        liveInput.fireHeld = true;
        isDraggingLook = true;
        lastClientX = e.clientX;
        lastClientY = e.clientY;
      } else if (e.button === 2) {
        e.preventDefault();
        liveInput.toggleScopeRequested = true;
        isDraggingLook = true;
        lastClientX = e.clientX;
        lastClientY = e.clientY;
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) liveInput.fireHeld = false;
      isDraggingLook = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isPaused) return;
      if (document.pointerLockElement) {
        const dx = Math.max(-90, Math.min(90, e.movementX));
        const dy = Math.max(-90, Math.min(90, e.movementY));
        liveInput.lookDeltaX += dx;
        liveInput.lookDeltaY += dy;
      } else if (isDraggingLook || e.buttons > 0) {
        const dx = Math.max(-80, Math.min(80, (e.clientX - lastClientX) * 1.65));
        const dy = Math.max(-80, Math.min(80, (e.clientY - lastClientY) * 1.65));
        liveInput.lookDeltaX += dx;
        liveInput.lookDeltaY += dy;
        lastClientX = e.clientX;
        lastClientY = e.clientY;
      } else {
        lastClientX = e.clientX;
        lastClientY = e.clientY;
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (isPaused) return;
      if (Math.abs(e.deltaY) > 2) {
        liveInput.zoomDeltaSteps += e.deltaY < 0 ? 1 : -1;
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('contextmenu', onContextMenu);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('contextmenu', onContextMenu);
    };
  }, [screen, isPaused, save.settings.keyBindings]);

  const activeLoadout = {
    ...DEFAULT_LOADOUT_CONFIG,
    ...(save.weaponLoadouts[save.equippedWeaponId] ?? {}),
  };

  // Next campaign mission helper on victory screen
  const nextCampaignAfterCurrent =
    selectedMission.campaignIndex && selectedMission.campaignIndex < CAMPAIGN_MISSIONS.length
      ? CAMPAIGN_MISSIONS[selectedMission.campaignIndex]
      : null;

  return (
    <div className="w-screen h-screen bg-zinc-950 overflow-hidden relative">
      {/* Main Menu */}
      {screen === 'main_menu' && (
        <MainMenuScreen
          save={save}
          onNavigate={(target) => {
            setReturnScreen('main_menu');
            setScreen(target);
          }}
          onQuickPlayMission={(m) => launchMission(m)}
          onResetConfirm={() => {
            const fresh = resetSaveData();
            setSave(fresh);
            soundEngine.playUiTone('alert');
          }}
        />
      )}

      {/* Campaign Map */}
      {screen === 'campaign_map' && (
        <CampaignMapScreen
          save={save}
          onSelectMission={(m) => openBriefingForMission(m, 'campaign_map')}
          onBack={() => setScreen('main_menu')}
        />
      )}

      {/* Mission Briefing */}
      {screen === 'mission_briefing' && (
        <MissionBriefingScreen
          mission={selectedMission}
          save={save}
          onStart={() => launchMission(selectedMission)}
          onOpenWorkshop={() => {
            setReturnScreen('mission_briefing');
            setScreen('weapon_workshop');
          }}
          onBack={() => setScreen(returnScreen)}
        />
      )}

      {/* 3D Weapon Workshop & Armory */}
      {screen === 'weapon_workshop' && (
        <WeaponWorkshop
          save={save}
          onUpdateSave={updateSaveAndPersist}
          onBack={() => setScreen(returnScreen)}
          onDeployTestRange={() => launchMission(CAMPAIGN_MISSIONS[0])}
        />
      )}

      {/* Game Modes */}
      {screen === 'game_modes' && (
        <GameModesScreen
          save={save}
          onSelectMission={(m) => openBriefingForMission(m, 'game_modes')}
          onNavigate={(s) => setScreen(s)}
          onBack={() => setScreen('main_menu')}
        />
      )}

      {/* Contract Board */}
      {screen === 'contract_board' && (
        <ContractBoardScreen
          save={save}
          onSelectMission={(m) => openBriefingForMission(m, 'contract_board')}
          onBack={() => setScreen('main_menu')}
        />
      )}

      {/* Player Progression & Badges */}
      {screen === 'progression' && (
        <ProgressionScreen save={save} onBack={() => setScreen('main_menu')} />
      )}

      {/* Local High-Score Leaderboard */}
      {screen === 'leaderboard' && (
        <LeaderboardScreen save={save} onBack={() => setScreen('main_menu')} />
      )}

      {/* Settings Screen (accessible from Main Menu OR Pause Menu) */}
      {screen === 'settings' && (
        <SettingsScreen
          settings={save.settings}
          onChangeSettings={(nextSettings) =>
            updateSaveAndPersist((prev) => ({
              ...prev,
              settings: nextSettings,
            }))
          }
          onBack={() => setScreen(returnScreen)}
        />
      )}

      {/* Loading Transition */}
      {screen === 'loading' && <LoadingTransitionScreen mission={selectedMission} />}

      {/* Active 3D Mission Gameplay + HUD + Pause */}
      {screen === 'playing' && (
        <>
          <LevelScene
            key={`${selectedMission.id}_${runNonce}`}
            mission={selectedMission}
            weaponId={save.equippedWeaponId}
            loadout={activeLoadout}
            ammoType={save.equippedAmmo}
            equippedSlots={save.equippedSlots}
            settings={save.settings}
            paused={isPaused}
            onHudUpdate={setHudSnapshot}
            onMissionEnd={handleMissionEnd}
          />

          {hudSnapshot && (
            <InGameHUD
              hud={hudSnapshot}
              mission={selectedMission}
              settings={save.settings}
              onPause={() => setIsPaused(true)}
              onToggleMute={() =>
                updateSaveAndPersist((prev) => ({
                  ...prev,
                  settings: { ...prev.settings, muted: !prev.settings.muted },
                }))
              }
            />
          )}

          {isPaused && (
            <PauseOverlay
              missionTitle={selectedMission.title}
              onResume={() => setIsPaused(false)}
              onRestart={() => launchMission(selectedMission)}
              onOpenSettings={() => {
                setReturnScreen('playing');
                setScreen('settings');
              }}
              onQuitToMenu={() => {
                setIsPaused(false);
                setScreen('main_menu');
              }}
            />
          )}
        </>
      )}

      {/* Victory / Defeat Result Summary */}
      {(screen === 'mission_victory' || screen === 'mission_failure') && lastResult && (
        <MissionResultScreen
          result={lastResult}
          onReplay={() => launchMission(selectedMission)}
          onNextMission={
            nextCampaignAfterCurrent
              ? () => openBriefingForMission(nextCampaignAfterCurrent, 'campaign_map')
              : null
          }
          onOpenWorkshop={() => {
            setReturnScreen('campaign_map');
            setScreen('weapon_workshop');
          }}
          onReturnMenu={() => setScreen('main_menu')}
        />
      )}
    </div>
  );
}
