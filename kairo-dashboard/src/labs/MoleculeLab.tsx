/**
 * Molecule Lab — pick a molecule, view 3D structure with bond lines + atom labels.
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import * as THREE from 'three'
import LabShell from './LabShell'
import LabScene from './LabScene'

// drei's <Text> uses a bundled Roboto subset that doesn't always include
// Unicode subscripts. Convert ₀-₉ to plain digits for in-scene labels so we
// never see tofu boxes. Markdown text in the side panel uses real fonts.
const SUBSCRIPT_MAP: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  '⁺': '+', '⁻': '-',
}
function asciifyFormula(s: string) {
  return s.replace(/[₀-₉⁺⁻]/g, c => SUBSCRIPT_MAP[c] ?? c)
}

interface Atom { sym: string; pos: [number, number, number]; color: string; radius: number }
interface Bond { a: number; b: number; order: 1 | 2 | 3 }
interface Molecule { name: string; formula: string; atoms: Atom[]; bonds: Bond[] }

// Standard CPK colors (close to industry standard)
const C_H = '#f5f5f5', C_C = '#374151', C_O = '#ef4444', C_N = '#3b82f6'
const C_S = '#C7D2E8', C_CL = '#22c55e', C_F = '#a3e635', C_BR = '#a16207', C_P = '#f97316'

// Atomic radii
const R_H = 0.28, R_C = 0.5, R_O = 0.48, R_N = 0.48, R_S = 0.6, R_X = 0.55

const MOLECULES: Record<string, Molecule> = {
  // ── Diatomic / Triatomic Gases ───────────────────────────────────────────
  hydrogen: { name: 'Hydrogen', formula: 'H₂', atoms: [
    { sym: 'H', pos: [-0.4, 0, 0], color: C_H, radius: R_H },
    { sym: 'H', pos: [ 0.4, 0, 0], color: C_H, radius: R_H },
  ], bonds: [{ a: 0, b: 1, order: 1 }] },
  oxygen: { name: 'Oxygen', formula: 'O₂', atoms: [
    { sym: 'O', pos: [-0.6, 0, 0], color: C_O, radius: R_O },
    { sym: 'O', pos: [ 0.6, 0, 0], color: C_O, radius: R_O },
  ], bonds: [{ a: 0, b: 1, order: 2 }] },
  nitrogen: { name: 'Nitrogen', formula: 'N₂', atoms: [
    { sym: 'N', pos: [-0.55, 0, 0], color: C_N, radius: R_N },
    { sym: 'N', pos: [ 0.55, 0, 0], color: C_N, radius: R_N },
  ], bonds: [{ a: 0, b: 1, order: 3 }] },
  chlorine: { name: 'Chlorine', formula: 'Cl₂', atoms: [
    { sym: 'Cl', pos: [-0.9, 0, 0], color: C_CL, radius: R_X },
    { sym: 'Cl', pos: [ 0.9, 0, 0], color: C_CL, radius: R_X },
  ], bonds: [{ a: 0, b: 1, order: 1 }] },
  hcl: { name: 'Hydrogen Chloride', formula: 'HCl', atoms: [
    { sym: 'H',  pos: [-0.7, 0, 0], color: C_H,  radius: R_H },
    { sym: 'Cl', pos: [ 0.7, 0, 0], color: C_CL, radius: R_X },
  ], bonds: [{ a: 0, b: 1, order: 1 }] },
  water: { name: 'Water', formula: 'H₂O', atoms: [
    { sym: 'O', pos: [0, 0, 0],         color: C_O, radius: R_O },
    { sym: 'H', pos: [ 0.95, 0.55, 0],  color: C_H, radius: R_H },
    { sym: 'H', pos: [-0.95, 0.55, 0],  color: C_H, radius: R_H },
  ], bonds: [{ a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }] },
  carbon_dioxide: { name: 'Carbon Dioxide', formula: 'CO₂', atoms: [
    { sym: 'C', pos: [0, 0, 0],     color: C_C, radius: R_C },
    { sym: 'O', pos: [ 1.5, 0, 0],  color: C_O, radius: R_O },
    { sym: 'O', pos: [-1.5, 0, 0],  color: C_O, radius: R_O },
  ], bonds: [{ a: 0, b: 1, order: 2 }, { a: 0, b: 2, order: 2 }] },
  carbon_monoxide: { name: 'Carbon Monoxide', formula: 'CO', atoms: [
    { sym: 'C', pos: [-0.6, 0, 0], color: C_C, radius: R_C },
    { sym: 'O', pos: [ 0.6, 0, 0], color: C_O, radius: R_O },
  ], bonds: [{ a: 0, b: 1, order: 3 }] },
  ozone: { name: 'Ozone', formula: 'O₃', atoms: [
    { sym: 'O', pos: [0, 0, 0],         color: C_O, radius: R_O },
    { sym: 'O', pos: [ 1.1, 0.65, 0],   color: C_O, radius: R_O },
    { sym: 'O', pos: [-1.1, 0.65, 0],   color: C_O, radius: R_O },
  ], bonds: [{ a: 0, b: 1, order: 2 }, { a: 0, b: 2, order: 1 }] },
  sulfur_dioxide: { name: 'Sulfur Dioxide', formula: 'SO₂', atoms: [
    { sym: 'S', pos: [0, 0, 0],         color: C_S, radius: R_S },
    { sym: 'O', pos: [ 1.3, 0.7, 0],    color: C_O, radius: R_O },
    { sym: 'O', pos: [-1.3, 0.7, 0],    color: C_O, radius: R_O },
  ], bonds: [{ a: 0, b: 1, order: 2 }, { a: 0, b: 2, order: 2 }] },
  hydrogen_sulfide: { name: 'Hydrogen Sulfide', formula: 'H₂S', atoms: [
    { sym: 'S', pos: [0, 0, 0],         color: C_S, radius: R_S },
    { sym: 'H', pos: [ 1.0, 0.45, 0],   color: C_H, radius: R_H },
    { sym: 'H', pos: [-1.0, 0.45, 0],   color: C_H, radius: R_H },
  ], bonds: [{ a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }] },

  // ── Tetrahedral / Pyramidal ─────────────────────────────────────────────
  ammonia: { name: 'Ammonia', formula: 'NH₃', atoms: [
    { sym: 'N', pos: [0, 0, 0],            color: C_N, radius: R_N },
    { sym: 'H', pos: [0.95, -0.4, 0],      color: C_H, radius: R_H },
    { sym: 'H', pos: [-0.5, -0.4, 0.85],   color: C_H, radius: R_H },
    { sym: 'H', pos: [-0.5, -0.4, -0.85],  color: C_H, radius: R_H },
  ], bonds: [{ a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }, { a: 0, b: 3, order: 1 }] },
  methane: { name: 'Methane', formula: 'CH₄', atoms: [
    { sym: 'C', pos: [0, 0, 0],            color: C_C, radius: R_C },
    { sym: 'H', pos: [ 0.95,  0.95,  0.95], color: C_H, radius: R_H },
    { sym: 'H', pos: [-0.95, -0.95,  0.95], color: C_H, radius: R_H },
    { sym: 'H', pos: [ 0.95, -0.95, -0.95], color: C_H, radius: R_H },
    { sym: 'H', pos: [-0.95,  0.95, -0.95], color: C_H, radius: R_H },
  ], bonds: [{ a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }, { a: 0, b: 3, order: 1 }, { a: 0, b: 4, order: 1 }] },

  // ── Hydrocarbons ────────────────────────────────────────────────────────
  ethane: { name: 'Ethane', formula: 'C₂H₆', atoms: [
    { sym: 'C', pos: [-0.77, 0, 0],            color: C_C, radius: R_C },
    { sym: 'C', pos: [ 0.77, 0, 0],            color: C_C, radius: R_C },
    { sym: 'H', pos: [-1.2,  0.95, 0],         color: C_H, radius: R_H },
    { sym: 'H', pos: [-1.2, -0.45,  0.85],     color: C_H, radius: R_H },
    { sym: 'H', pos: [-1.2, -0.45, -0.85],     color: C_H, radius: R_H },
    { sym: 'H', pos: [ 1.2,  0.45,  0.85],     color: C_H, radius: R_H },
    { sym: 'H', pos: [ 1.2,  0.45, -0.85],     color: C_H, radius: R_H },
    { sym: 'H', pos: [ 1.2, -0.95, 0],         color: C_H, radius: R_H },
  ], bonds: [
    { a: 0, b: 1, order: 1 },
    { a: 0, b: 2, order: 1 }, { a: 0, b: 3, order: 1 }, { a: 0, b: 4, order: 1 },
    { a: 1, b: 5, order: 1 }, { a: 1, b: 6, order: 1 }, { a: 1, b: 7, order: 1 },
  ] },
  ethylene: { name: 'Ethylene', formula: 'C₂H₄', atoms: [
    { sym: 'C', pos: [-0.66, 0, 0],            color: C_C, radius: R_C },
    { sym: 'C', pos: [ 0.66, 0, 0],            color: C_C, radius: R_C },
    { sym: 'H', pos: [-1.23,  0.92, 0],        color: C_H, radius: R_H },
    { sym: 'H', pos: [-1.23, -0.92, 0],        color: C_H, radius: R_H },
    { sym: 'H', pos: [ 1.23,  0.92, 0],        color: C_H, radius: R_H },
    { sym: 'H', pos: [ 1.23, -0.92, 0],        color: C_H, radius: R_H },
  ], bonds: [
    { a: 0, b: 1, order: 2 },
    { a: 0, b: 2, order: 1 }, { a: 0, b: 3, order: 1 },
    { a: 1, b: 4, order: 1 }, { a: 1, b: 5, order: 1 },
  ] },
  acetylene: { name: 'Acetylene', formula: 'C₂H₂', atoms: [
    { sym: 'C', pos: [-0.6, 0, 0],     color: C_C, radius: R_C },
    { sym: 'C', pos: [ 0.6, 0, 0],     color: C_C, radius: R_C },
    { sym: 'H', pos: [-1.65, 0, 0],    color: C_H, radius: R_H },
    { sym: 'H', pos: [ 1.65, 0, 0],    color: C_H, radius: R_H },
  ], bonds: [{ a: 0, b: 1, order: 3 }, { a: 0, b: 2, order: 1 }, { a: 1, b: 3, order: 1 }] },
  benzene: (() => {
    const atoms: Atom[] = []
    const bonds: Bond[] = []
    const r = 1.4
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2
      atoms.push({ sym: 'C', pos: [Math.cos(angle) * r, Math.sin(angle) * r, 0], color: C_C, radius: R_C })
    }
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2
      const hr = r + 1.0
      atoms.push({ sym: 'H', pos: [Math.cos(angle) * hr, Math.sin(angle) * hr, 0], color: C_H, radius: R_H })
    }
    for (let i = 0; i < 6; i++) {
      bonds.push({ a: i, b: (i + 1) % 6, order: i % 2 === 0 ? 2 : 1 })
      bonds.push({ a: i, b: 6 + i, order: 1 })
    }
    return { name: 'Benzene', formula: 'C₆H₆', atoms, bonds }
  })(),

  // ── Alcohols / Aldehydes / Acids ────────────────────────────────────────
  methanol: { name: 'Methanol', formula: 'CH₃OH', atoms: [
    { sym: 'C', pos: [0, 0, 0],         color: C_C, radius: R_C },
    { sym: 'O', pos: [1.4, 0, 0],       color: C_O, radius: R_O },
    { sym: 'H', pos: [2.0, 0.85, 0],    color: C_H, radius: R_H },
    { sym: 'H', pos: [-0.55, 0.95, 0.4], color: C_H, radius: R_H },
    { sym: 'H', pos: [-0.55, 0.95, -0.4], color: C_H, radius: R_H },
    { sym: 'H', pos: [-0.55, -0.95, 0],  color: C_H, radius: R_H },
  ], bonds: [
    { a: 0, b: 1, order: 1 }, { a: 1, b: 2, order: 1 },
    { a: 0, b: 3, order: 1 }, { a: 0, b: 4, order: 1 }, { a: 0, b: 5, order: 1 },
  ] },
  ethanol: { name: 'Ethanol', formula: 'C₂H₅OH', atoms: [
    { sym: 'C', pos: [-1.4, 0, 0],   color: C_C, radius: R_C },
    { sym: 'C', pos: [0, 0, 0],      color: C_C, radius: R_C },
    { sym: 'O', pos: [1.4, 0, 0],    color: C_O, radius: R_O },
    { sym: 'H', pos: [2.0, 0.85, 0], color: C_H, radius: R_H },
    { sym: 'H', pos: [-1.95, 0.95, 0], color: C_H, radius: R_H },
    { sym: 'H', pos: [-1.95, -0.55, 0.85], color: C_H, radius: R_H },
    { sym: 'H', pos: [-1.95, -0.55, -0.85], color: C_H, radius: R_H },
    { sym: 'H', pos: [0.45, 0.95, 0.6],  color: C_H, radius: R_H },
    { sym: 'H', pos: [0.45, 0.95, -0.6], color: C_H, radius: R_H },
  ], bonds: [
    { a: 0, b: 1, order: 1 }, { a: 1, b: 2, order: 1 }, { a: 2, b: 3, order: 1 },
    { a: 0, b: 4, order: 1 }, { a: 0, b: 5, order: 1 }, { a: 0, b: 6, order: 1 },
    { a: 1, b: 7, order: 1 }, { a: 1, b: 8, order: 1 },
  ] },
  formaldehyde: { name: 'Formaldehyde', formula: 'CH₂O', atoms: [
    { sym: 'C', pos: [0, 0, 0],        color: C_C, radius: R_C },
    { sym: 'O', pos: [1.2, 0.6, 0],    color: C_O, radius: R_O },
    { sym: 'H', pos: [-0.7, 0.95, 0],  color: C_H, radius: R_H },
    { sym: 'H', pos: [-0.7, -0.95, 0], color: C_H, radius: R_H },
  ], bonds: [
    { a: 0, b: 1, order: 2 },
    { a: 0, b: 2, order: 1 }, { a: 0, b: 3, order: 1 },
  ] },
  acetic_acid: { name: 'Acetic Acid', formula: 'CH₃COOH', atoms: [
    { sym: 'C', pos: [-1.3, 0, 0],     color: C_C, radius: R_C },
    { sym: 'C', pos: [0, 0, 0],        color: C_C, radius: R_C },
    { sym: 'O', pos: [0.7, 1.2, 0],    color: C_O, radius: R_O },
    { sym: 'O', pos: [0.7, -1.1, 0],   color: C_O, radius: R_O },
    { sym: 'H', pos: [1.65, -1.4, 0],  color: C_H, radius: R_H },
    { sym: 'H', pos: [-1.85, 0.95, 0], color: C_H, radius: R_H },
    { sym: 'H', pos: [-1.85, -0.55, 0.85], color: C_H, radius: R_H },
    { sym: 'H', pos: [-1.85, -0.55, -0.85], color: C_H, radius: R_H },
  ], bonds: [
    { a: 0, b: 1, order: 1 },
    { a: 1, b: 2, order: 2 },
    { a: 1, b: 3, order: 1 }, { a: 3, b: 4, order: 1 },
    { a: 0, b: 5, order: 1 }, { a: 0, b: 6, order: 1 }, { a: 0, b: 7, order: 1 },
  ] },

  // ── Acids / Bases (simplified) ──────────────────────────────────────────
  hydrogen_peroxide: { name: 'Hydrogen Peroxide', formula: 'H₂O₂', atoms: [
    { sym: 'O', pos: [-0.75, 0, 0],     color: C_O, radius: R_O },
    { sym: 'O', pos: [ 0.75, 0, 0],     color: C_O, radius: R_O },
    { sym: 'H', pos: [-1.2, 0.85, 0.4], color: C_H, radius: R_H },
    { sym: 'H', pos: [ 1.2, 0.85, -0.4], color: C_H, radius: R_H },
  ], bonds: [
    { a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }, { a: 1, b: 3, order: 1 },
  ] },
  sulfuric_acid: { name: 'Sulfuric Acid', formula: 'H₂SO₄', atoms: [
    { sym: 'S', pos: [0, 0, 0],         color: C_S, radius: R_S },
    { sym: 'O', pos: [ 1.3,  0.6, 0.6], color: C_O, radius: R_O },
    { sym: 'O', pos: [-1.3,  0.6, 0.6], color: C_O, radius: R_O },
    { sym: 'O', pos: [ 0.6, -0.9,-1.3], color: C_O, radius: R_O },
    { sym: 'O', pos: [-0.6, -0.9,-1.3], color: C_O, radius: R_O },
    { sym: 'H', pos: [ 0.9, -1.7,-1.7], color: C_H, radius: R_H },
    { sym: 'H', pos: [-0.9, -1.7,-1.7], color: C_H, radius: R_H },
  ], bonds: [
    { a: 0, b: 1, order: 2 }, { a: 0, b: 2, order: 2 },
    { a: 0, b: 3, order: 1 }, { a: 0, b: 4, order: 1 },
    { a: 3, b: 5, order: 1 }, { a: 4, b: 6, order: 1 },
  ] },
  nitric_acid: { name: 'Nitric Acid', formula: 'HNO₃', atoms: [
    { sym: 'N', pos: [0, 0, 0],         color: C_N, radius: R_N },
    { sym: 'O', pos: [ 1.2, 0.6, 0],    color: C_O, radius: R_O },
    { sym: 'O', pos: [-1.2, 0.6, 0],    color: C_O, radius: R_O },
    { sym: 'O', pos: [ 0,   -1.2, 0],   color: C_O, radius: R_O },
    { sym: 'H', pos: [ 0.65,-2.0, 0],   color: C_H, radius: R_H },
  ], bonds: [
    { a: 0, b: 1, order: 2 }, { a: 0, b: 2, order: 1 },
    { a: 0, b: 3, order: 1 }, { a: 3, b: 4, order: 1 },
  ] },
  ammonium: { name: 'Ammonium ion', formula: 'NH₄⁺', atoms: [
    { sym: 'N', pos: [0, 0, 0],            color: C_N, radius: R_N },
    { sym: 'H', pos: [ 0.95,  0.95,  0.95], color: C_H, radius: R_H },
    { sym: 'H', pos: [-0.95, -0.95,  0.95], color: C_H, radius: R_H },
    { sym: 'H', pos: [ 0.95, -0.95, -0.95], color: C_H, radius: R_H },
    { sym: 'H', pos: [-0.95,  0.95, -0.95], color: C_H, radius: R_H },
  ], bonds: [
    { a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }, { a: 0, b: 3, order: 1 }, { a: 0, b: 4, order: 1 },
  ] },
  glucose: { name: 'Glucose (simplified)', formula: 'C₆H₁₂O₆', atoms: (() => {
    // Simplified hexagonal pyranose ring — actual chair conformation
    const atoms: Atom[] = []
    const r = 1.3
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2
      const isOx = i === 5
      atoms.push({
        sym: isOx ? 'O' : 'C',
        pos: [Math.cos(angle) * r, (i % 2 ? 0.25 : -0.25), Math.sin(angle) * r],
        color: isOx ? C_O : C_C,
        radius: isOx ? R_O : R_C,
      })
    }
    // -OH groups + H's on each carbon (skipping the ring O)
    const positions: [number, number, number][] = [
      [ 1.8,  1.1,  0.0], [ 0.7,  1.1,  1.4],  // C1 -OH up, C2 -OH outward
      [-0.7,  1.1,  1.4], [-1.8,  1.1,  0.0],  // C3 -OH, C4 -OH
      [-0.4, -1.4,  0.4],                       // C5 -CH2OH (further out)
    ]
    for (const p of positions) atoms.push({ sym: 'O', pos: p, color: C_O, radius: R_O })
    for (const p of positions) {
      atoms.push({ sym: 'H', pos: [p[0] * 1.35, p[1] + 0.5, p[2] * 1.35], color: C_H, radius: R_H })
    }
    return atoms
  })(), bonds: (() => {
    const bonds: Bond[] = []
    for (let i = 0; i < 6; i++) bonds.push({ a: i, b: (i + 1) % 6, order: 1 })
    for (let i = 0; i < 5; i++) {
      bonds.push({ a: i, b: 6 + i, order: 1 })
      bonds.push({ a: 6 + i, b: 11 + i, order: 1 })
    }
    return bonds
  })() },
}

interface SimProps {
  params: { molecule: string }
  playing: boolean
}

function MoleculeSim({ params, playing }: SimProps) {
  const mol = MOLECULES[params.molecule] || MOLECULES.water
  return (
    <LabScene cameraPos={[4, 3, 6]} cameraFov={50} tint="#1a1a2e" particles={50}>
      <RotatingMolecule mol={mol} playing={playing} />
      <Text position={[0, -3, 0]} fontSize={0.45} color="#fafafa" anchorX="center">
        {asciifyFormula(mol.formula)}
      </Text>
      <OrbitControls enablePan={false} minDistance={3} maxDistance={15} autoRotate={playing} autoRotateSpeed={0.6} />
    </LabScene>
  )
}

function RotatingMolecule({ mol, playing }: { mol: Molecule; playing: boolean }) {
  return (
    <group>
      {mol.atoms.map((a, i) => (
        <group key={i} position={a.pos}>
          <mesh>
            <sphereGeometry args={[a.radius, 24, 24]} />
            <meshStandardMaterial color={a.color} roughness={0.4} metalness={0.2} />
          </mesh>
          <Text position={[0, 0, a.radius + 0.05]} fontSize={0.18} color="#000" anchorX="center" anchorY="middle">
            {a.sym}
          </Text>
        </group>
      ))}
      {mol.bonds.map((b, i) => {
        const a = new THREE.Vector3(...mol.atoms[b.a].pos)
        const c = new THREE.Vector3(...mol.atoms[b.b].pos)
        const dir = c.clone().sub(a)
        const len = dir.length()
        const mid = a.clone().add(c).multiplyScalar(0.5)
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
        const offsets = b.order === 1 ? [[0, 0, 0]]
          : b.order === 2 ? [[0.07, 0, 0], [-0.07, 0, 0]]
          : [[0.1, 0, 0], [0, 0, 0], [-0.1, 0, 0]]
        return offsets.map((off, j) => (
          <mesh key={`${i}-${j}`} position={mid.toArray()} quaternion={quat}>
            <cylinderGeometry args={[0.05, 0.05, len, 6]} />
            <meshStandardMaterial color="#B1B5BA" />
          </mesh>
        ))
      })}
    </group>
  )
}

export default function MoleculeLab({ onBack }: { onBack?: () => void }) {
  return (
    <LabShell
      title="Molecule Builder" subject="Chemistry" topic="Bonding · Class 9-12"
      description="3D structure of common molecules. Single bonds are one rod; double bonds are two parallel rods; triple bonds are three. Bond angles match real geometry."
      Sim={MoleculeSim}
      defaultParams={{ molecule: 'water' }}
      controls={[
        { key: 'molecule', label: 'Molecule', type: 'select', value: 'water',
          options: Object.entries(MOLECULES).map(([k, v]) => ({ value: k, label: `${v.name} (${v.formula})` })) },
      ]}
      aiPrompt={p => `Show the structure of ${MOLECULES[p.molecule]?.name || p.molecule} (${MOLECULES[p.molecule]?.formula || ''}). Explain its molecular geometry (bent, tetrahedral, linear, trigonal pyramidal), hybridization, polarity, and one important real-world use.`}
      onBack={onBack}
    />
  )
}
