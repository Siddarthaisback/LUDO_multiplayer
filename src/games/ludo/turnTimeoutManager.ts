export interface TurnTimeoutHandlers {
  onTick?: (remainingSeconds: number) => void;
  onTimeout?: () => void;
}

export class TurnTimeoutManager {
  private timer: any = null;
  private remainingSeconds: number = 15;
  private isTimedOut: boolean = false;
  private handlers: TurnTimeoutHandlers;

  constructor(handlers: TurnTimeoutHandlers = {}) {
    this.handlers = handlers;
  }

  public setHandlers(handlers: TurnTimeoutHandlers) {
    this.handlers = handlers;
  }

  public startTurn(durationSeconds: number = 15) {
    this.stop();
    this.remainingSeconds = durationSeconds;
    this.isTimedOut = false;
    this.handlers.onTick?.(this.remainingSeconds);

    this.timer = setInterval(() => {
      this.remainingSeconds -= 1;
      const current = Math.max(0, this.remainingSeconds);
      this.handlers.onTick?.(current);

      if (this.remainingSeconds <= 0) {
        this.stop();
        this.isTimedOut = true;
        this.handlers.onTimeout?.();
      }
    }, 1000);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public getRemainingSeconds(): number {
    return this.remainingSeconds;
  }

  public getIsTimedOut(): boolean {
    return this.isTimedOut;
  }

  public reset() {
    this.stop();
    this.remainingSeconds = 15;
    this.isTimedOut = false;
  }
}
