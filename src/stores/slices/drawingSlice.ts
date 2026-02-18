import { StateCreator } from "zustand";
import { EditorState } from "../editorStore";

export interface DrawingSlice {
  drawingEnabled: boolean;
  drawingColor: string;
  drawingBrushSize: number;
  setDrawingEnabled: (enabled: boolean) => void;
  setDrawingColor: (color: string) => void;
  setDrawingBrushSize: (size: number) => void;
}

export const createDrawingSlice: StateCreator<EditorState, [], [], DrawingSlice> = (set) => ({
  drawingEnabled: false,
  drawingColor: "#ffffff",
  drawingBrushSize: 6,
  setDrawingEnabled: (enabled) => set({ drawingEnabled: enabled }),
  setDrawingColor: (color) => set({ drawingColor: color }),
  setDrawingBrushSize: (size) => set({ drawingBrushSize: size }),
});
