import * as THREE from 'three';
import { Combatant, Faction, Squad } from './types';
import { CombatantFactory } from './CombatantFactory';
import { ImprovedChunkManager } from '../terrain/ImprovedChunkManager';

export class SquadManager {
  private squads: Map<string, Squad> = new Map();
  private nextSquadId = 0;
  private combatantFactory: CombatantFactory;
  private chunkManager?: ImprovedChunkManager;

  constructor(combatantFactory: CombatantFactory, chunkManager?: ImprovedChunkManager) {
    this.combatantFactory = combatantFactory;
    this.chunkManager = chunkManager;
  }

  createSquad(
    faction: Faction,
    centerPosition: THREE.Vector3,
    squadSize: number
  ): { squad: Squad; members: Combatant[] } {
    const squadId = `squad_${faction}_${this.nextSquadId++}`;
    const squad: Squad = {
      id: squadId,
      faction,
      members: [],
      formation: 'wedge'
    };

    const members: Combatant[] = [];

    for (let i = 0; i < squadSize; i++) {
      const position = this.calculateFormationPosition(centerPosition, i);
      position.y = this.getTerrainHeight(position.x, position.z) + 3;

      const role = i === 0 ? 'leader' : 'follower';
      const combatant = this.combatantFactory.createCombatant(
        faction,
        position,
        { squadId, squadRole: role }
      );

      members.push(combatant);
      squad.members.push(combatant.id);

      if (role === 'leader') {
        squad.leaderId = combatant.id;
      }
    }

    this.squads.set(squadId, squad);
    console.log(`🎖️ Deployed ${faction} squad ${squadId} with ${squadSize} soldiers`);

    return { squad, members };
  }

  private calculateFormationPosition(centerPos: THREE.Vector3, index: number): THREE.Vector3 {
    let offset: THREE.Vector3;

    if (index === 0) {
      // Leader at front/center
      offset = new THREE.Vector3(0, 0, 0);
    } else {
      // Followers in wedge formation behind/beside leader
      const row = Math.floor((index - 1) / 3); // 3 soldiers per row
      const column = (index - 1) % 3 - 1; // -1, 0, 1 for left, center, right

      offset = new THREE.Vector3(
        column * 4, // 4 meters apart horizontally
        0,
        -row * 4 // 4 meters behind each row
      );

      // Add small random variation to avoid perfect grid
      offset.x += (Math.random() - 0.5) * 1.5;
      offset.z += (Math.random() - 0.5) * 1.5;
    }

    return centerPos.clone().add(offset);
  }

  removeSquadMember(squadId: string, memberId: string): void {
    const squad = this.squads.get(squadId);
    if (squad) {
      const index = squad.members.indexOf(memberId);
      if (index > -1) {
        squad.members.splice(index, 1);
      }

      // If squad is empty, remove it
      if (squad.members.length === 0) {
        this.squads.delete(squadId);
      } else if (squad.leaderId === memberId && squad.members.length > 0) {
        // Promote a new leader if the current one died
        squad.leaderId = squad.members[0];
      }
    }
  }

  getSquad(squadId: string): Squad | undefined {
    return this.squads.get(squadId);
  }

  getAllSquads(): Map<string, Squad> {
    return this.squads;
  }

  private getTerrainHeight(x: number, z: number): number {
    if (this.chunkManager) {
      const height = this.chunkManager.getHeightAt(x, z);
      if (height === 0 && (Math.abs(x) > 50 || Math.abs(z) > 50)) {
        return 5; // Default for unloaded chunks
      }
      return height;
    }
    return 5;
  }

  setChunkManager(chunkManager: ImprovedChunkManager): void {
    this.chunkManager = chunkManager;
  }

  dispose(): void {
    this.squads.clear();
  }
}