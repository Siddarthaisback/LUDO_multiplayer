import { SnakeOrLadder, SpecialTile, SpecialTileType } from '../../types/snakes';
import { DEFAULT_SNAKES_AND_LADDERS, SPECIAL_TILES } from '../../utils/constants';

export class SnakesEngine {
  /**
   * Converts 1-100 tile number to percentage board coordinates (x: 0-100, y: 0-100)
   * Tile 1 is bottom-left, Tile 100 is top-left.
   */
  public static getTileCoordinates(tile: number): { x: number; y: number } {
    if (tile < 1) tile = 1;
    if (tile > 100) tile = 100;

    const rowFromBottom = Math.floor((tile - 1) / 10); // 0 (bottom) to 9 (top)
    const indexInRow = (tile - 1) % 10; // 0 to 9

    const isEvenRow = rowFromBottom % 2 === 0;
    const colFromLeft = isEvenRow ? indexInRow : 9 - indexInRow;

    // Center of tile in percentage (each tile is 10% wide and 10% high)
    const x = colFromLeft * 10 + 5;
    const y = (9 - rowFromBottom) * 10 + 5;

    return { x, y };
  }

  /**
   * Check if a tile has a snake or ladder
   */
  public static checkSnakeOrLadder(
    tile: number,
    customSnakesAndLadders: SnakeOrLadder[] = DEFAULT_SNAKES_AND_LADDERS
  ): SnakeOrLadder | undefined {
    return customSnakesAndLadders.find((item) => item.from === tile);
  }

  /**
   * Check if a tile has a special power-up
   */
  public static checkSpecialTile(tile: number): SpecialTile | undefined {
    return SPECIAL_TILES.find((item) => item.tile === tile);
  }

  /**
   * Calculates next position after dice roll
   * Returns intermediate and final position, whether snake/ladder was hit, bounce status.
   */
  public static calculateMove(
    currentPos: number,
    roll: number,
    exactRollToWin: boolean = true,
    hasShield: boolean = false,
    enablePowerUps: boolean = true
  ): {
    targetPos: number;
    bounced: boolean;
    snakeOrLadder?: SnakeOrLadder;
    shieldUsed: boolean;
    powerUp?: SpecialTile;
  } {
    let rawPos = currentPos + roll;
    let bounced = false;

    if (rawPos > 100) {
      if (exactRollToWin) {
        // Bounce back
        const overshoot = rawPos - 100;
        rawPos = 100 - overshoot;
        bounced = true;
      } else {
        rawPos = 100;
      }
    }

    let shieldUsed = false;
    const snakeOrLadder = this.checkSnakeOrLadder(rawPos);
    let finalPos = rawPos;

    if (snakeOrLadder) {
      if (snakeOrLadder.type === 'snake' && hasShield) {
        // Shield protected against snake!
        shieldUsed = true;
        finalPos = rawPos;
      } else {
        finalPos = snakeOrLadder.to;
      }
    }

    let powerUp: SpecialTile | undefined;
    if (enablePowerUps && !snakeOrLadder) {
      powerUp = this.checkSpecialTile(finalPos);
    }

    return {
      targetPos: finalPos,
      bounced,
      snakeOrLadder,
      shieldUsed,
      powerUp,
    };
  }
}
