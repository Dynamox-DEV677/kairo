export const STUN: RTCIceServer[]
export const TALK_THRESHOLD: number
export function isPolite(myKey: string, peerKey: string): boolean
export function shouldInitiate(myKey: string, peerKey: string): boolean
export function isForMe(msg: any, myKey: string): boolean
export function reconcilePeers(rosterKeys: string[] | unknown, myKey: string, currentPeerKeys: string[] | unknown): { add: string[]; drop: string[] }
export function rmsLevel(bytes: Uint8Array | number[] | null | undefined): number
