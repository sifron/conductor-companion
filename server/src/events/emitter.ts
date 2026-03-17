import { EventEmitter } from 'node:events';
import type { BridgeEvent } from '@conductor-companion/shared';

class BridgeEventEmitter extends EventEmitter {
  emitBridgeEvent(event: BridgeEvent) {
    this.emit('bridge-event', event);
  }

  onBridgeEvent(handler: (event: BridgeEvent) => void) {
    this.on('bridge-event', handler);
    return () => this.off('bridge-event', handler);
  }
}

export const bridgeEvents = new BridgeEventEmitter();
