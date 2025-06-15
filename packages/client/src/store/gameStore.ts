import { create } from 'zustand';
import { Player, Snapshot } from '@motionjs/common';

interface GameState {
  connected: boolean;
  roomId: string | null;
  playerId: string | null;
  players: Map<string, Player>;
  latestSnapshot: Snapshot | null;
  inputSequence: number;
  
  setConnected: (connected: boolean) => void;
  setRoomInfo: (roomId: string, playerId: string) => void;
  updateSnapshot: (snapshot: Snapshot) => void;
  incrementInputSequence: () => number;
  reset: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  connected: false,
  roomId: null,
  playerId: null,
  players: new Map(),
  latestSnapshot: null,
  inputSequence: 0,
  
  setConnected: (connected) => set({ connected }),
  
  setRoomInfo: (roomId, playerId) => set({ roomId, playerId }),
  
  updateSnapshot: (snapshot) => set((state) => {
    const players = new Map<string, Player>();
    Object.entries(snapshot.players).forEach(([id, player]) => {
      players.set(id, player);
    });
    return { latestSnapshot: snapshot, players };
  }),
  
  incrementInputSequence: () => {
    const sequence = get().inputSequence + 1;
    set({ inputSequence: sequence });
    return sequence;
  },
  
  reset: () => set({
    connected: false,
    roomId: null,
    playerId: null,
    players: new Map(),
    latestSnapshot: null,
    inputSequence: 0,
  })
}));