/**
 * Types minimaux du Showcase SDK Matterport (SDK for Embeds).
 * Doc : https://matterport.github.io/showcase-sdk/
 */

export interface Vector3 { x: number; y: number; z: number }
export interface Rotation2 { x: number; y: number }

export interface SweepData {
  sid?: string;
  id?: string;
  uuid?: string;
  position: Vector3;
  rotation?: Vector3;
  floorInfo?: { sequence?: number; id?: string };
  alignmentType?: string;
}

export interface RoomBounds { min: Vector3; max: Vector3 }
export interface RoomData { id: string; bounds?: RoomBounds; floorInfo?: { id?: string } }

export interface MpSdk {
  App: {
    state: { subscribe(cb: (state: { phase: string }) => void): { cancel(): void } };
    Phase: Record<string, string>;
  };
  Model: { getData(): Promise<{ sid: string }> };
  Sweep: {
    data: {
      subscribe(observer: {
        onAdded?(index: string, item: SweepData): void;
        onCollectionUpdated?(collection: Record<string, SweepData>): void;
      }): { cancel(): void };
    };
    current: { subscribe(cb: (sweep: { sid: string; position?: Vector3 }) => void): { cancel(): void } };
    moveTo(
      sweepId: string,
      options: { rotation?: Rotation2; transition?: string; transitionTime?: number }
    ): Promise<string>;
    Transition: { INSTANT: string; FLY: string; FADEOUT: string };
  };
  Camera: {
    pose: {
      subscribe(cb: (pose: { position: Vector3; rotation: Rotation2; sweep: string }) => void): { cancel(): void };
    };
    setRotation(rotation: Rotation2, options?: { speed?: number }): Promise<void>;
    rotate(horizontal: number, vertical: number): Promise<void>;
  };
  Room?: {
    current: { subscribe(cb: (current: { rooms: { id: string }[] }) => void): { cancel(): void } };
    data: {
      subscribe(observer: {
        onCollectionUpdated?(collection: Record<string, RoomData>): void;
      }): { cancel(): void };
    };
  };
  Renderer?: {
    takeScreenShot(
      resolution?: { width: number; height: number },
      visibility?: { mattertags?: boolean; sweeps?: boolean }
    ): Promise<string>;
  };
  disconnect(): void;
}

declare global {
  interface Window {
    MP_SDK?: { connect(target: HTMLIFrameElement | Window, key?: string, version?: string): Promise<MpSdk> };
  }
}
