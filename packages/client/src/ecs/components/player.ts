import { defineComponent, Types } from 'bitecs';

export const Player = defineComponent({
  id: Types.ui32
});

export const playerIdMap = new Map<number, string>();
export const reversePlayerIdMap = new Map<string, number>();

let nextPlayerId = 1;

export function getOrCreateNumericPlayerId(stringId: string): number {
  if (reversePlayerIdMap.has(stringId)) {
    return reversePlayerIdMap.get(stringId)!;
  }
  
  const numericId = nextPlayerId++;
  playerIdMap.set(numericId, stringId);
  reversePlayerIdMap.set(stringId, numericId);
  return numericId;
}

export function getStringPlayerId(numericId: number): string | undefined {
  return playerIdMap.get(numericId);
}