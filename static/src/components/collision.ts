import type { Vector3 } from 'three';

/**
 * Wall AABB for sphere-vs-AABB collision resolution. Each wall occupies
 * [x0, x1] × [z0, z1] on the ground plane. Optional yMin/yMax restricts
 * the wall to a specific floor (e.g. mezzanine-only walls apply only
 * when the camera's eye y is within that range).
 */
export interface WallAABB {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  yMin?: number;
  yMax?: number;
}

export const PLAYER_RADIUS = 0.35;

/**
 * Enumeration of every functional wall in the game. Doorways are the
 * gaps between these rectangles; the list is intentionally sparse so
 * collision is cheap.
 *
 *   Coord convention: x grows to the world +X side, z grows toward the
 *   final room along the main hall's length.
 */
export const WALL_AABBS: readonly WallAABB[] = [
  // ── Starter room ────────────────────────────────────────────────
  // Back (-Z) wall — spans main body + alcove
  { x0: -8, x1: 6, z0: -5.1, z1: -4.9 },
  // +X side wall
  { x0: 5.9, x1: 6.1, z0: -5, z1: 6 },
  // Main body -X wall (only where the alcove isn't cut in)
  { x0: -6.1, x1: -5.9, z0: -2, z1: 6 },
  // Alcove far -X wall
  { x0: -8.1, x1: -7.9, z0: -5, z1: -2 },
  // Alcove inner-corner (front of alcove) at z = -2
  { x0: -8, x1: -6, z0: -2.1, z1: -1.9 },

  // ── Shared wall between starter room and main hall (z = 6) ──────
  // Door-0 opening at x ∈ [-1, 1]; rest is solid.
  { x0: -10, x1: -1, z0: 5.9, z1: 6.1 },
  { x0: 1, x1: 10, z0: 5.9, z1: 6.1 },

  // ── Main hall ───────────────────────────────────────────────────
  // +X window wall — solid for collision (windows are above head)
  { x0: 9.9, x1: 10.1, z0: 6, z1: 38 },
  // -X wall: below the mezzanine (ground floor) it's continuous
  { x0: -10.1, x1: -9.9, z0: 6, z1: 38, yMax: 1.5 },
  // -X wall: above the mezzanine (catwalk door opening in the middle)
  { x0: -10.1, x1: -9.9, z0: 6, z1: 35.5, yMin: 1.5 },
  { x0: -10.1, x1: -9.9, z0: 37.5, z1: 38, yMin: 1.5 },
  // +Z wall (z = 38) with door-1 opening at x ∈ [-1, 1]
  { x0: -10, x1: -1, z0: 37.9, z1: 38.1 },
  { x0: 1, x1: 10, z0: 37.9, z1: 38.1 },

  // ── Corridor 1 (between main hall and the side room) ────────────
  { x0: -1.6, x1: -1.4, z0: 38, z1: 40 },
  { x0: 1.4, x1: 1.6, z0: 38, z1: 40 },

  // ── Side room (previously "final"; behind the always-open door 1) ─
  // -Z wall (z = 40) with doorway middle opening
  { x0: -5, x1: -1, z0: 39.9, z1: 40.1 },
  { x0: 1, x1: 5, z0: 39.9, z1: 40.1 },
  // +Z back wall
  { x0: -5, x1: 5, z0: 51.9, z1: 52.1 },
  // Sides
  { x0: -5.1, x1: -4.9, z0: 40, z1: 52 },
  { x0: 4.9, x1: 5.1, z0: 40, z1: 52 },

  // ── Catwalk corridor A (mezz-level, past the catwalk door) ──────
  // -Z wall
  { x0: -22, x1: -10, z0: 34.9, z1: 35.1, yMin: 1.5 },
  // +Z wall — solid for x ∈ [-19, -10] (opens into corridor B at x < -19)
  { x0: -19, x1: -10, z0: 37.9, z1: 38.1, yMin: 1.5 },
  // -X wall for A + B + stairs combined (x = -22)
  { x0: -22.1, x1: -21.9, z0: 35, z1: 60 },

  // ── Catwalk corridor B (the +Z-going leg) ───────────────────────
  // +X wall at x = -19 (mezzanine level)
  { x0: -19.1, x1: -18.9, z0: 38, z1: 55, yMin: 1.5 },

  // ── Catwalk descent stairs ──────────────────────────────────────
  // +X side wall alongside the stairs, any y
  { x0: -19.1, x1: -18.9, z0: 55, z1: 60 },

  // ── Final room ──────────────────────────────────────────────────
  // -Z wall (z = 60) with stair opening at x ∈ [-22, -19]
  { x0: -34, x1: -22, z0: 59.9, z1: 60.1 },
  { x0: -19, x1: -10, z0: 59.9, z1: 60.1 },
  // +Z back wall
  { x0: -34, x1: -10, z0: 81.9, z1: 82.1 },
  // Sides
  { x0: -34.1, x1: -33.9, z0: 60, z1: 82 },
  { x0: -10.1, x1: -9.9, z0: 60, z1: 82 },
];

/**
 * Push the player's XZ position out of any overlapping wall. Call
 * each frame after integrating movement. `radius` is the player's
 * horizontal radius.
 */
export function resolveWallCollisions(pos: Vector3, radius: number = PLAYER_RADIUS): void {
  for (const w of WALL_AABBS) {
    if (w.yMin !== undefined && pos.y < w.yMin) continue;
    if (w.yMax !== undefined && pos.y > w.yMax) continue;

    const cx = Math.max(w.x0, Math.min(pos.x, w.x1));
    const cz = Math.max(w.z0, Math.min(pos.z, w.z1));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const distSq = dx * dx + dz * dz;
    if (distSq >= radius * radius) continue;

    const dist = Math.sqrt(distSq);
    if (dist > 1e-5) {
      const push = radius - dist;
      pos.x += (dx / dist) * push;
      pos.z += (dz / dist) * push;
    } else {
      // Degenerate: player centre exactly at AABB edge. Push along
      // whichever axis has more room.
      const halfW = (w.x1 - w.x0) / 2;
      const halfD = (w.z1 - w.z0) / 2;
      const cxMid = (w.x0 + w.x1) / 2;
      const czMid = (w.z0 + w.z1) / 2;
      if (halfW < halfD) {
        pos.x = pos.x < cxMid ? w.x0 - radius : w.x1 + radius;
      } else {
        pos.z = pos.z < czMid ? w.z0 - radius : w.z1 + radius;
      }
    }
  }
}
