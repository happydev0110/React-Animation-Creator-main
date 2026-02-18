import { FabricObject } from "fabric";

export interface Keyframe {
  id: string;
  time: number;
  properties: {
    left?: number;
    top?: number;
    scaleX?: number;
    scaleY?: number;
    angle?: number;
    opacity?: number;
    [key: string]: any;
  };
  easing: string;
}

export interface TrackObject {
  id: string;
  name: string;
  type: "visual" | "audio" | "video";
  fabricObject: FabricObject | null;
  startTime: number;
  endTime: number;
  keyframes: Keyframe[];
  color: string;
  initialState: any;
  audioElement?: HTMLAudioElement | null;
  audioSrc?: string;
  mediaDuration?: number;
  mediaOffset?: number;
  imageFilters?: string[];
}

export interface Asset {
  id: string;
  name: string;
  type: "item" | "background" | "audio" | "video";
  color: string;
  icon: string;
  src?: string;
}