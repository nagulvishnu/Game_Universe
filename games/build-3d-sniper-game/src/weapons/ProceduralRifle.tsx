import React from 'react';
import { DEFAULT_LOADOUT_CONFIG, getAttachmentById } from '../data/customization';
import { WeaponDefinition, WeaponLoadoutConfig } from '../types/game';

interface ProceduralRifleProps {
  weapon: WeaponDefinition;
  loadout?: Partial<WeaponLoadoutConfig>;
  boltCycleProgress?: number; // 0..1
  reloadProgress?: number; // 0..1
  muzzleFlashIntensity?: number; // 0..1
  scale?: number;
}

export const ProceduralRifle: React.FC<ProceduralRifleProps> = ({
  weapon,
  loadout,
  boltCycleProgress = 0,
  reloadProgress = 0,
  muzzleFlashIntensity = 0,
  scale = 1,
}) => {
  const cfg: WeaponLoadoutConfig = { ...DEFAULT_LOADOUT_CONFIG, ...(loadout ?? {}) };
  const skinAtt = getAttachmentById(cfg.skin);
  const opticAtt = getAttachmentById(cfg.optic);
  const muzzleAtt = getAttachmentById(cfg.muzzle);
  const underAtt = getAttachmentById(cfg.underbarrel);
  const magAtt = getAttachmentById(cfg.magazine);
  const barrelAtt = getAttachmentById(cfg.barrel);
  const stockAtt = getAttachmentById(cfg.stock);
  const charmAtt = getAttachmentById(cfg.charm);

  const primaryColor = skinAtt.cosmeticColor ?? weapon.visual.receiverColor;
  const stockColor = skinAtt.secondaryColor ?? weapon.visual.stockColor;
  const accentColor = weapon.visual.accentColor;

  const extraBarrel = barrelAtt.id === 'barrel_heavy_long' ? 0.22 : barrelAtt.id === 'barrel_fluted' ? -0.05 : 0;
  const barrelLen = weapon.visual.barrelLength + extraBarrel;
  const barrelRad = weapon.visual.barrelThickness * (barrelAtt.id === 'barrel_heavy_long' ? 1.15 : 1);

  const isBullpup = weapon.visual.family === 'bullpup_covert';
  const isScout = weapon.visual.family === 'scout_light';
  const isHeavyAM = weapon.visual.family === 'anti_materiel';
  const isRailProto = weapon.visual.family === 'rail_prototype';
  const hasSuppressor = Boolean(muzzleAtt.suppressed || weapon.visual.builtInSuppressor);

  // Bolt animation curve: lift (0..0.25), slide back (0.25..0.55), slide forward (0.55..0.85), lock (0.85..1)
  let boltSlideZ = 0;
  let boltLiftRot = 0;
  if (boltCycleProgress > 0 && weapon.action === 'bolt') {
    if (boltCycleProgress < 0.25) {
      boltLiftRot = (boltCycleProgress / 0.25) * 1.05;
    } else if (boltCycleProgress < 0.55) {
      boltLiftRot = 1.05;
      boltSlideZ = ((boltCycleProgress - 0.25) / 0.3) * 0.14;
    } else if (boltCycleProgress < 0.85) {
      boltLiftRot = 1.05;
      boltSlideZ = (1 - (boltCycleProgress - 0.55) / 0.3) * 0.14;
    } else {
      boltLiftRot = (1 - (boltCycleProgress - 0.85) / 0.15) * 1.05;
    }
  }

  // Magazine drop curve during reload
  let magDropY = 0;
  if (reloadProgress > 0) {
    if (reloadProgress < 0.4) {
      magDropY = -(reloadProgress / 0.4) * 0.24;
    } else if (reloadProgress < 0.75) {
      magDropY = -(1 - (reloadProgress - 0.4) / 0.35) * 0.24;
    }
  }

  const magHeight =
    magAtt.id === 'mag_extended'
      ? 0.22
      : weapon.visual.magazineStyle === 'box_10' || weapon.visual.magazineStyle === 'heavy_50'
      ? 0.18
      : weapon.visual.magazineStyle === 'box_5'
      ? 0.12
      : 0.06;

  const muzzleTipZ = -0.25 - barrelLen - (hasSuppressor ? 0.26 : 0.09);

  return (
    <group scale={scale}>
      {/* Upper & Lower Receiver Chassis */}
      <mesh position={[0, 0.02, 0]} castShadow>
        <boxGeometry args={[isHeavyAM ? 0.095 : 0.072, 0.095, 0.46]} />
        <meshStandardMaterial color={primaryColor} metalness={0.65} roughness={0.35} />
      </mesh>

      {/* Top Picatinny Rail */}
      <mesh position={[0, 0.075, -0.08]}>
        <boxGeometry args={[0.042, 0.018, 0.56]} />
        <meshStandardMaterial color="#18181b" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Accent Side Plate / Engraving Stripe */}
      <mesh position={[0.038, 0.025, -0.02]}>
        <boxGeometry args={[0.008, 0.024, 0.26]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={isRailProto ? accentColor : '#000000'}
          emissiveIntensity={isRailProto ? 1.4 : 0}
          metalness={0.7}
          roughness={0.25}
        />
      </mesh>

      {/* Pistol Grip */}
      <mesh position={[0, -0.085, 0.14]} rotation={[0.32, 0, 0]}>
        <boxGeometry args={[0.048, 0.15, 0.062]} />
        <meshStandardMaterial color={stockColor} roughness={0.7} metalness={0.15} />
      </mesh>

      {/* Trigger Guard */}
      <mesh position={[0, -0.048, 0.07]}>
        <boxGeometry args={[0.022, 0.04, 0.09]} />
        <meshStandardMaterial color="#1f2937" metalness={0.7} roughness={0.4} />
      </mesh>

      {/* Buttstock Architecture (Distinct per Weapon Family + Stock Attachment) */}
      {isBullpup ? (
        <mesh position={[0, 0.005, 0.34]} castShadow>
          <boxGeometry args={[0.08, 0.15, 0.34]} />
          <meshStandardMaterial color={stockColor} roughness={0.5} metalness={0.3} />
        </mesh>
      ) : isScout ? (
        <group position={[0, 0.0, 0.36]}>
          {/* Skeletonized twin-tube stock */}
          <mesh position={[0, 0.025, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.014, 0.014, 0.36, 8]} />
            <meshStandardMaterial color={stockColor} metalness={0.6} roughness={0.35} />
          </mesh>
          <mesh position={[0, -0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.36, 8]} />
            <meshStandardMaterial color={stockColor} metalness={0.6} roughness={0.35} />
          </mesh>
          <mesh position={[0, -0.01, 0.18]}>
            <boxGeometry args={[0.052, 0.15, 0.035]} />
            <meshStandardMaterial color="#111827" roughness={0.85} />
          </mesh>
        </group>
      ) : (
        <group position={[0, -0.01, 0.38]}>
          <mesh castShadow>
            <boxGeometry args={[0.064, 0.13, 0.38]} />
            <meshStandardMaterial color={stockColor} roughness={0.58} metalness={0.2} />
          </mesh>
          {/* Rubber Recoil Buttpad */}
          <mesh position={[0, -0.005, 0.2]}>
            <boxGeometry args={[0.068, 0.145, 0.03]} />
            <meshStandardMaterial color="#0f172a" roughness={0.9} />
          </mesh>
          {/* Cheek Riser if PRS Stock or Chassis */}
          {(stockAtt.id === 'stock_cheek_riser' ||
            weapon.visual.family === 'chassis_precision' ||
            isHeavyAM) && (
            <mesh position={[0, 0.075, -0.03]}>
              <boxGeometry args={[0.072, 0.042, 0.19]} />
              <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.4} />
            </mesh>
          )}
        </group>
      )}

      {/* Handguard / Forend Shroud */}
      <mesh position={[0, 0.018, -0.42]} castShadow>
        <boxGeometry
          args={[
            isHeavyAM || isRailProto ? 0.088 : 0.066,
            isHeavyAM || isRailProto ? 0.092 : 0.072,
            Math.min(barrelLen * 0.58, 0.58),
          ]}
        />
        <meshStandardMaterial color={primaryColor} metalness={0.6} roughness={0.38} />
      </mesh>

      {/* Prototype Glowing Capacitor Coils for Deadeye Prototype */}
      {isRailProto && (
        <group position={[0, 0.02, -0.48]}>
          {[-0.14, 0, 0.14].map((cz, idx) => (
            <mesh key={idx} position={[0, 0, cz]}>
              <boxGeometry args={[0.096, 0.032, 0.045]} />
              <meshStandardMaterial
                color="#06b6d4"
                emissive="#06b6d4"
                emissiveIntensity={2.0}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* Free-Floated Match Barrel */}
      <mesh position={[0, 0.024, -0.25 - barrelLen / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[barrelRad * 0.88, barrelRad, barrelLen, 14]} />
        <meshStandardMaterial color="#1f242d" metalness={0.82} roughness={0.26} />
      </mesh>

      {/* Muzzle Attachment: Suppressor OR Muzzle Brake */}
      {hasSuppressor ? (
        <mesh
          position={[0, 0.024, -0.25 - barrelLen - 0.12]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <cylinderGeometry args={[0.044, 0.044, 0.28, 16]} />
          <meshStandardMaterial color="#18181b" metalness={0.55} roughness={0.45} />
        </mesh>
      ) : weapon.visual.muzzleBrakeStyle === 'clam_heavy' ||
        muzzleAtt.id === 'muzzle_compensator' ? (
        <mesh position={[0, 0.024, -0.25 - barrelLen - 0.055]} castShadow>
          <boxGeometry args={[0.095, 0.058, 0.12]} />
          <meshStandardMaterial color="#27272a" metalness={0.85} roughness={0.28} />
        </mesh>
      ) : (
        <mesh position={[0, 0.024, -0.25 - barrelLen - 0.04]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[barrelRad * 1.25, barrelRad * 1.15, 0.085, 12]} />
          <meshStandardMaterial color="#27272a" metalness={0.85} roughness={0.3} />
        </mesh>
      )}

      {/* Articulated Bolt Handle */}
      <group
        position={[0.036, 0.038, 0.02 + boltSlideZ]}
        rotation={[0, 0, -boltLiftRot]}
      >
        <mesh position={[0.032, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.008, 0.008, 0.065, 8]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0.066, 0, 0]}>
          <sphereGeometry args={[0.017, 10, 10]} />
          <meshStandardMaterial color="#111827" metalness={0.5} roughness={0.4} />
        </mesh>
      </group>

      {/* Detachable Magazine (animates on reload) */}
      <mesh
        position={[0, -0.04 - magHeight / 2 + magDropY, isBullpup ? 0.32 : -0.06]}
        rotation={[weapon.visual.magazineStyle === 'heavy_50' ? -0.08 : 0, 0, 0]}
        castShadow
      >
        <boxGeometry args={[0.048, magHeight, isHeavyAM ? 0.16 : 0.115]} />
        <meshStandardMaterial color="#18181b" metalness={0.65} roughness={0.4} />
      </mesh>

      {/* Optical Scope Assembly */}
      <group position={[0, 0.125, -0.05]}>
        {/* Dual Scope Mount Rings */}
        <mesh position={[0, -0.025, 0.09]}>
          <boxGeometry args={[0.056, 0.045, 0.032]} />
          <meshStandardMaterial color="#18181b" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.025, -0.1]}>
          <boxGeometry args={[0.056, 0.045, 0.032]} />
          <meshStandardMaterial color="#18181b" metalness={0.8} roughness={0.3} />
        </mesh>

        {opticAtt.opticType === 'thermal' ? (
          // Boxy Military FLIR Thermal Housing
          <group>
            <mesh castShadow>
              <boxGeometry args={[0.072, 0.074, 0.34]} />
              <meshStandardMaterial color="#27272a" metalness={0.6} roughness={0.38} />
            </mesh>
            <mesh position={[0, 0, -0.172]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.031, 0.031, 0.01, 16]} />
              <meshStandardMaterial color="#f59e0b" emissive="#d97706" emissiveIntensity={0.6} metalness={0.9} roughness={0.1} />
            </mesh>
          </group>
        ) : (
          // Cylindrical Precision Rifle Tube + Objective Bell + Elevation Turrets
          <group>
            <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry
                args={[
                  0.023,
                  0.023,
                  opticAtt.opticType === 'variable' ? 0.42 : 0.34,
                  16,
                ]}
              />
              <meshStandardMaterial color="#18181b" metalness={0.75} roughness={0.28} />
            </mesh>
            {/* Front Objective Bell */}
            <mesh
              position={[0, 0, opticAtt.opticType === 'variable' ? -0.22 : -0.17]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.036, 0.024, 0.09, 16]} />
              <meshStandardMaterial color="#18181b" metalness={0.75} roughness={0.28} />
            </mesh>
            {/* Objective Lens Tint */}
            <mesh
              position={[0, 0, opticAtt.opticType === 'variable' ? -0.266 : -0.216]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.033, 0.033, 0.005, 16]} />
              <meshStandardMaterial
                color={opticAtt.opticType === 'lowlight' ? '#10b981' : '#38bdf8'}
                emissive={opticAtt.opticType === 'lowlight' ? '#059669' : '#0284c7'}
                emissiveIntensity={0.45}
                metalness={0.95}
                roughness={0.08}
              />
            </mesh>
            {/* Top Elevation Dial Turret */}
            <mesh position={[0, 0.034, 0]}>
              <cylinderGeometry args={[0.016, 0.016, 0.028, 12]} />
              <meshStandardMaterial color="#3f3f46" metalness={0.85} roughness={0.25} />
            </mesh>
          </group>
        )}
      </group>

      {/* Underbarrel Attachment: Folding Carbon Bipod OR Hand-Stop */}
      {underAtt.id === 'under_bipod' && (
        <group position={[0, -0.025, -0.58]}>
          <mesh position={[-0.042, -0.085, 0]} rotation={[0.18, 0, -0.22]}>
            <cylinderGeometry args={[0.009, 0.008, 0.19, 8]} />
            <meshStandardMaterial color="#18181b" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0.042, -0.085, 0]} rotation={[0.18, 0, 0.22]}>
            <cylinderGeometry args={[0.009, 0.008, 0.19, 8]} />
            <meshStandardMaterial color="#18181b" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      )}
      {underAtt.id === 'under_grip' && (
        <mesh position={[0, -0.055, -0.45]} rotation={[-0.35, 0, 0]}>
          <boxGeometry args={[0.036, 0.09, 0.045]} />
          <meshStandardMaterial color="#27272a" roughness={0.6} />
        </mesh>
      )}

      {/* Cosmetic Hanging Weapon Charm */}
      {charmAtt.charmType && charmAtt.charmType !== 'none' && (
        <group position={[-0.045, -0.015, 0.04]}>
          <mesh position={[0, -0.028, 0]}>
            <cylinderGeometry
              args={[
                0.011,
                0.011,
                charmAtt.charmType === 'brass_casing' ? 0.048 : 0.01,
                10,
              ]}
            />
            <meshStandardMaterial
              color={
                charmAtt.charmType === 'brass_casing'
                  ? '#eab308'
                  : charmAtt.charmType === 'meridian_shard'
                  ? '#06b6d4'
                  : '#e2e8f0'
              }
              emissive={charmAtt.charmType === 'meridian_shard' ? '#06b6d4' : '#000000'}
              emissiveIntensity={charmAtt.charmType === 'meridian_shard' ? 1.5 : 0}
              metalness={0.9}
              roughness={0.2}
            />
          </mesh>
        </group>
      )}

      {/* Dynamic Muzzle Flash */}
      {muzzleFlashIntensity > 0.02 && !hasSuppressor && (
        <group position={[0, 0.024, muzzleTipZ]}>
          <mesh scale={muzzleFlashIntensity * 0.28}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color="#fde047" transparent opacity={muzzleFlashIntensity * 0.9} />
          </mesh>
          <pointLight color="#fb923c" intensity={muzzleFlashIntensity * 5} distance={9} />
        </group>
      )}
    </group>
  );
};
