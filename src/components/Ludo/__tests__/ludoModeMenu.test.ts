import { describe, it, expect } from 'vitest';
import {
  createPassAndPlayPlayers,
  createSoloVsBotPlayers,
} from '../LudoModeMenu';

describe('LudoModeMenu Player Factories', () => {
  describe('createPassAndPlayPlayers', () => {
    it('creates 4 human players for 4P pass and play', () => {
      const players = createPassAndPlayPlayers(4);
      expect(players).toHaveLength(4);
      expect(players.every((p) => p.type === 'human')).toBe(true);
      expect(players.map((p) => p.color)).toEqual(['red', 'green', 'yellow', 'blue']);
    });

    it('creates 3 human players for 3P pass and play', () => {
      const players = createPassAndPlayPlayers(3);
      expect(players).toHaveLength(3);
      expect(players.every((p) => p.type === 'human')).toBe(true);
      expect(players.map((p) => p.color)).toEqual(['red', 'green', 'yellow']);
    });

    it('creates 2 human players with red-blue pair by default', () => {
      const players = createPassAndPlayPlayers(2, 'red-blue');
      expect(players).toHaveLength(2);
      expect(players.every((p) => p.type === 'human')).toBe(true);
      expect(players.map((p) => p.color)).toEqual(['red', 'blue']);
    });

    it('creates 2 human players with green-yellow pair when selected', () => {
      const players = createPassAndPlayPlayers(2, 'green-yellow');
      expect(players).toHaveLength(2);
      expect(players.every((p) => p.type === 'human')).toBe(true);
      expect(players.map((p) => p.color)).toEqual(['green', 'yellow']);
    });

    it('applies custom names and avatars for pass and play', () => {
      const customNames = ['Aarav', 'Pooja', 'Rohan', 'Sneha'];
      const customAvatars = ['🦁', '🐼', '🦊', '🐯'];
      const players = createPassAndPlayPlayers(4, 'red-blue', customNames, customAvatars);
      expect(players[0].name).toBe('Aarav');
      expect(players[1].name).toBe('Pooja');
      expect(players[2].name).toBe('Rohan');
      expect(players[3].name).toBe('Sneha');
      expect(players[0].avatar).toBe('🦁');
    });
  });

  describe('createSoloVsBotPlayers', () => {
    it('creates 1 human and 3 bots for 4P solo mode with specified difficulty', () => {
      const players = createSoloVsBotPlayers(4, 'master', 'red-blue', 'Master Guru', '👑');
      expect(players).toHaveLength(4);

      // Human player
      expect(players[0].type).toBe('human');
      expect(players[0].name).toBe('Master Guru');
      expect(players[0].avatar).toBe('👑');
      expect(players[0].color).toBe('red');

      // Bot players
      const bots = players.slice(1);
      expect(bots.every((b) => b.type === 'bot')).toBe(true);
      expect(bots.every((b) => b.difficulty === 'master')).toBe(true);
      expect(bots.map((b) => b.color)).toEqual(['green', 'yellow', 'blue']);
    });

    it('creates 1 human and 1 bot for 2P mode with diagonal colors', () => {
      const playersRedBlue = createSoloVsBotPlayers(2, 'easy', 'red-blue', 'Player 1');
      expect(playersRedBlue).toHaveLength(2);
      expect(playersRedBlue[0].type).toBe('human');
      expect(playersRedBlue[0].color).toBe('red');
      expect(playersRedBlue[1].type).toBe('bot');
      expect(playersRedBlue[1].color).toBe('blue');
      expect(playersRedBlue[1].difficulty).toBe('easy');

      const playersGreenYellow = createSoloVsBotPlayers(2, 'master', 'green-yellow', 'Player 1');
      expect(playersGreenYellow).toHaveLength(2);
      expect(playersGreenYellow[0].color).toBe('green');
      expect(playersGreenYellow[1].color).toBe('yellow');
      expect(playersGreenYellow[1].difficulty).toBe('master');
    });

    it('creates 1 human and 2 bots for 3P mode', () => {
      const players = createSoloVsBotPlayers(3, 'medium');
      expect(players).toHaveLength(3);
      expect(players[0].type).toBe('human');
      expect(players[1].type).toBe('bot');
      expect(players[2].type).toBe('bot');
      expect(players.map((p) => p.color)).toEqual(['red', 'green', 'yellow']);
    });
  });
});
