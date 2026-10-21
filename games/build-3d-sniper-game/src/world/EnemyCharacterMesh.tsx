import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EnemyEntity } from '../ai/enemyAI';

interface EnemyCharacterMeshProps {
  enemy: EnemyEntity;
  thermalActive: boolean;
}

export const EnemyCharacterMesh: React.FC<EnemyCharacterMeshProps> = ({
  enemy,
  thermalActive,
}) => {
  const rootRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const torsoGroupRef = useRef<THREE.Group>(null);
  const glintRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!rootRef.current) return;
    rootRef.current.position.set(enemy.x, enemy.y, enemy.z);

    if (enemy.state === 'dead') {
      // Collapse onto ground
      const fallAngle = enemy.deathProgress * (Math.PI / 2.05);
      rootRef.current.rotation.set(-fallAngle, enemy.rotY, 0);
      rootRef.current.position.y = enemy.y + enemy.deathProgress * 0.14;
      if (glintRef.current) glintRef.current.visible = false;
      return;
    }

    rootRef.current.rotation.set(0, enemy.rotY, 0);

    // Walk / patrol procedural leg swing + hit flinch
    const swing = enemy.isMoving ? Math.sin(enemy.animTime * 1.45) * 0.55 : 0;
    if (leftLegRef.current) leftLegRef.current.rotation.x = swing;
    if (rightLegRef.current) rightLegRef.current.rotation.x = -swing;

    if (torsoGroupRef.current) {
      const flinch = enemy.hitFlashTimer > 0 ? -0.24 : 0;
      const crouchLean = enemy.state === 'engaging' ? 0.12 : 0;
      torsoGroupRef.current.rotation.x = crouchLean + flinch;
    }

    if (glintRef.current) {
      const showGlint = enemy.enemyClass === 'counter_sniper' && enemy.sniperGlintCharge > 0.08;
      glintRef.current.visible = showGlint;
      if (showGlint) {
        const s = 0.22 + enemy.sniperGlintCharge * 0.55;
        glintRef.current.scale.setScalar(s);
      }
    }
  });

  // Sabotage Electronic Node / Generator Array
  if (enemy.enemyClass === 'sabotage_node') {
    const destroyed = enemy.state === 'dead';
    return (
      <group ref={rootRef}>
        <mesh position={[0, 0.72, 0]} castShadow>
          <boxGeometry args={[1.25, 1.44, 1.05]} />
          <meshStandardMaterial
            color={destroyed ? '#1f2937' : '#334155'}
            metalness={0.7}
            roughness={0.4}
          />
        </mesh>
        {/* Glowing Top Core Weakpoint */}
        <mesh position={[0, 1.78, 0]}>
          <cylinderGeometry args={[0.38, 0.44, 0.68, 12]} />
          <meshStandardMaterial
            color={destroyed ? '#27272a' : thermalActive ? '#fef08a' : '#ef4444'}
            emissive={destroyed ? '#000000' : thermalActive ? '#f97316' : '#dc2626'}
            emissiveIntensity={destroyed ? 0 : 1.85}
          />
        </mesh>
        {!destroyed && (
          <mesh position={[0, 2.38, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.75, 6]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} />
          </mesh>
        )}
      </group>
    );
  }

  // Steel Range Target Dummy
  if (enemy.enemyClass === 'target_dummy') {
    const down = enemy.state === 'dead';
    return (
      <group ref={rootRef}>
        {/* Base Rail Carriage */}
        <mesh position={[0, 0.14, 0]}>
          <boxGeometry args={[0.9, 0.28, 0.5]} />
          <meshStandardMaterial color="#27272a" metalness={0.8} roughness={0.35} />
        </mesh>
        {/* Steel Torso Silhouette */}
        <mesh position={[0, 0.98, 0]} castShadow>
          <boxGeometry args={[0.78, 1.12, 0.09]} />
          <meshStandardMaterial
            color={down ? '#3f3f46' : thermalActive ? '#fde047' : '#e2e8f0'}
            emissive={thermalActive && !down ? '#f59e0b' : '#000000'}
            emissiveIntensity={thermalActive && !down ? 1.2 : 0}
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>
        {/* Red Bullseye Head Plate */}
        <mesh position={[0, 1.62, 0.02]}>
          <cylinderGeometry args={[0.25, 0.25, 0.1, 16]} />
          <meshStandardMaterial
            color={down ? '#52525b' : '#ef4444'}
            emissive={!down ? '#dc2626' : '#000000'}
            emissiveIntensity={!down ? 0.55 : 0}
          />
        </mesh>
      </group>
    );
  }

  // Friendly Hostage (Kneeling high-visibility silhouette)
  if (enemy.enemyClass === 'hostage') {
    return (
      <group ref={rootRef}>
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[0.5, 0.78, 0.36]} />
          <meshStandardMaterial
            color="#0284c7"
            emissive={thermalActive ? '#38bdf8' : '#0369a1'}
            emissiveIntensity={thermalActive ? 1.3 : 0.3}
          />
        </mesh>
        <mesh position={[0, 1.04, 0]} castShadow>
          <sphereGeometry args={[0.21, 12, 12]} />
          <meshStandardMaterial
            color="#fed7aa"
            emissive={thermalActive ? '#bae6fd' : '#000000'}
            emissiveIntensity={thermalActive ? 1.1 : 0}
          />
        </mesh>
        {/* Overhead Friendly Diamond Marker */}
        <mesh position={[0, 1.65, 0]}>
          <octahedronGeometry args={[0.14, 0]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
      </group>
    );
  }

  // Humanoid Combatant Silhouette Colors per Role
  const isDead = enemy.state === 'dead';
  const uniformColor =
    enemy.enemyClass === 'commander'
      ? '#7f1d1d'
      : enemy.enemyClass === 'armored'
      ? '#334155'
      : enemy.enemyClass === 'counter_sniper'
      ? '#364935'
      : enemy.enemyClass === 'scout'
      ? '#3f3f46'
      : '#44403c';

  const vestColor =
    enemy.enemyClass === 'commander'
      ? '#b91c1c'
      : enemy.enemyClass === 'armored'
      ? '#0f172a'
      : '#1c1917';

  const thermalEmissive = !isDead && thermalActive ? '#fb923c' : '#000000';
  const thermalHead = !isDead && thermalActive ? '#fef08a' : '#000000';
  const thermalAmt = !isDead && thermalActive ? 1.65 : 0;

  return (
    <group ref={rootRef}>
      {/* Left & Right Articulated Legs */}
      <mesh ref={leftLegRef} position={[-0.14, 0.44, 0]} castShadow>
        <boxGeometry args={[0.19, 0.88, 0.22]} />
        <meshStandardMaterial
          color={uniformColor}
          emissive={thermalEmissive}
          emissiveIntensity={thermalAmt * 0.8}
          roughness={0.75}
        />
      </mesh>
      <mesh ref={rightLegRef} position={[0.14, 0.44, 0]} castShadow>
        <boxGeometry args={[0.19, 0.88, 0.22]} />
        <meshStandardMaterial
          color={uniformColor}
          emissive={thermalEmissive}
          emissiveIntensity={thermalAmt * 0.8}
          roughness={0.75}
        />
      </mesh>

      {/* Upper Articulated Torso, Armor, Arms, Rifle & Head */}
      <group ref={torsoGroupRef} position={[0, 0.88, 0]}>
        {/* Torso + Tactical Vest */}
        <mesh position={[0, 0.28, 0]} castShadow>
          <boxGeometry
            args={[
              enemy.enemyClass === 'armored' ? 0.62 : 0.5,
              0.56,
              enemy.enemyClass === 'armored' ? 0.36 : 0.28,
            ]}
          />
          <meshStandardMaterial
            color={vestColor}
            emissive={thermalEmissive}
            emissiveIntensity={thermalAmt}
            roughness={0.55}
            metalness={enemy.enemyClass === 'armored' ? 0.55 : 0.2}
          />
        </mesh>

        {/* Shoulder Pauldrons on Armored / Commander */}
        {(enemy.enemyClass === 'armored' || enemy.enemyClass === 'commander') && (
          <>
            <mesh position={[-0.36, 0.46, 0]}>
              <boxGeometry args={[0.16, 0.2, 0.28]} />
              <meshStandardMaterial
                color={enemy.enemyClass === 'commander' ? '#eab308' : '#475569'}
                metalness={0.75}
                roughness={0.3}
              />
            </mesh>
            <mesh position={[0.36, 0.46, 0]}>
              <boxGeometry args={[0.16, 0.2, 0.28]} />
              <meshStandardMaterial
                color={enemy.enemyClass === 'commander' ? '#eab308' : '#475569'}
                metalness={0.75}
                roughness={0.3}
              />
            </mesh>
          </>
        )}

        {/* Arms Aiming Weapon Forward (+Z local) */}
        <mesh position={[-0.26, 0.38, 0.18]} rotation={[0.95, 0.2, 0]}>
          <boxGeometry args={[0.13, 0.48, 0.13]} />
          <meshStandardMaterial
            color={uniformColor}
            emissive={thermalEmissive}
            emissiveIntensity={thermalAmt * 0.75}
          />
        </mesh>
        <mesh position={[0.24, 0.38, 0.18]} rotation={[1.05, -0.2, 0]}>
          <boxGeometry args={[0.13, 0.48, 0.13]} />
          <meshStandardMaterial
            color={uniformColor}
            emissive={thermalEmissive}
            emissiveIntensity={thermalAmt * 0.75}
          />
        </mesh>

        {/* Enemy Weapon Model */}
        <mesh position={[0.04, 0.38, 0.42]}>
          <boxGeometry
            args={[
              0.07,
              0.1,
              enemy.enemyClass === 'counter_sniper' ? 1.05 : 0.68,
            ]}
          />
          <meshStandardMaterial color="#18181b" metalness={0.8} roughness={0.3} />
        </mesh>

        {/* Counter-Sniper Scope Glint Flare */}
        <mesh ref={glintRef} position={[0.04, 0.48, 0.78]} visible={false}>
          <octahedronGeometry args={[0.35, 0]} />
          <meshBasicMaterial color="#fef08a" />
        </mesh>

        {/* Head & Distinct Helmet / Hood */}
        <group position={[0, 0.73, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.21, 14, 14]} />
            <meshStandardMaterial
              color="#d6b499"
              emissive={thermalHead}
              emissiveIntensity={thermalAmt * 1.25}
              roughness={0.65}
            />
          </mesh>
          {/* Tactical Helmet / Beret / Ghillie Cowl */}
          <mesh position={[0, 0.07, -0.01]}>
            <sphereGeometry
              args={[
                enemy.enemyClass === 'armored' ? 0.245 : 0.228,
                12,
                10,
                0,
                Math.PI * 2,
                0,
                Math.PI * 0.6,
              ]}
            />
            <meshStandardMaterial
              color={
                enemy.enemyClass === 'commander'
                  ? '#991b1b'
                  : enemy.enemyClass === 'armored'
                  ? '#1e293b'
                  : '#292524'
              }
              metalness={0.45}
              roughness={0.45}
            />
          </mesh>
        </group>

        {/* Overhead Tactical Recon Diamond if Tagged or Priority Target */}
        {!isDead && (enemy.tagged || enemy.isPriorityTarget) && (
          <mesh position={[0, 1.18, 0]}>
            <octahedronGeometry args={[enemy.isPriorityTarget ? 0.17 : 0.12, 0]} />
            <meshBasicMaterial
              color={
                enemy.isPriorityTarget
                  ? '#f59e0b'
                  : enemy.state === 'engaging'
                  ? '#ef4444'
                  : '#10b981'
              }
            />
          </mesh>
        )}
      </group>
    </group>
  );
};
