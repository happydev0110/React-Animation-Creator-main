import { StateCreator } from "zustand";
import { EditorState } from "../editorStore";
import { TrackObject, Keyframe } from "../../types";
import { FabricImage } from "fabric";
import { interpolateProperties } from "../../utils/interpolation";

export interface TrackSlice {
  tracks: TrackObject[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  selectedTrackId: string | null;
  selectedKeyframe: Keyframe | null;

  setProjectName: (name: string) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setSelectedKeyframe: (keyframe: Keyframe | null, trackId: string | null) => void;

  addTrack: (track: TrackObject) => void;
  updateTrack: (id: string, updates: Partial<TrackObject>) => void;
  removeTrack: (id: string) => void;
  splitTrack: (id: string) => void;

  addKeyframeAtCurrentTime: (trackId: string) => void;
  updateKeyframe: (trackId: string, keyframeId: string, updates: Partial<Keyframe>) => void;
  removeKeyframe: (trackId: string, keyframeId: string) => void;

  applyKeyframesAtTime: (time: number) => void;
  addAudioTrack: (name: string, audioSrc: string) => void;
  addVideoTrack: (name: string, videoSrc: string) => void;
  syncAudioPlayback: () => void;
}

export const createTrackSlice: StateCreator<EditorState, [], [], TrackSlice> = (set, get) => ({
  tracks: [],
  currentTime: 0,
  duration: 5000,
  isPlaying: false,
  selectedTrackId: null,
  selectedKeyframe: null,

  setProjectName: (name) => set({ projectName: name }),

  setCurrentTime: (time) => {
    set({ currentTime: time });
    get().applyKeyframesAtTime(time);
  },

  setDuration: (duration) => set({ duration }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),

  setSelectedKeyframe: (keyframe, trackId) =>
    set({
      selectedKeyframe: keyframe,
      selectedTrackId: trackId,
    }),

  addTrack: (track) => set((state) => ({ tracks: [...state.tracks, track] })),

  updateTrack: (id, updates) => {
    if (updates.startTime !== undefined || updates.endTime !== undefined) {
      get().saveCheckpoint();
    }
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === id ? { ...track, ...updates } : track,
      ),
    }));
  },

  removeTrack: (id) => {
    get().saveCheckpoint();
    set((state) => {
      const track = state.tracks.find((t) => t.id === id);
      if (track?.fabricObject && state.canvas) {
        state.canvas.remove(track.fabricObject);
      }
      if (track?.audioElement) {
        track.audioElement.pause();
        track.audioElement.src = "";
      }
      return {
        tracks: state.tracks.filter((t) => t.id !== id),
        selectedObjectId: state.selectedObjectId === id ? null : state.selectedObjectId,
        selectedObject: state.selectedObjectId === id ? null : state.selectedObject,
        selectedTrackId: state.selectedTrackId === id ? null : state.selectedTrackId,
      };
    });
  },

  splitTrack: (trackId) => {
    const { tracks, currentTime, saveCheckpoint, canvas } = get();
    const trackToSplit = tracks.find((t) => t.id === trackId);

    if (!trackToSplit) return;

    // check playhead is within track bounds
    if (currentTime <= trackToSplit.startTime || currentTime >= trackToSplit.endTime) {
      console.warn("Playhead is outside the track bounds");
      return;
    }

    saveCheckpoint();

    const splitTime = currentTime;
    const oldEndTime = trackToSplit.endTime;

    // calculate media offsets for audio/video tracks
    const existingOffset = trackToSplit.mediaOffset || 0;
    const newMediaOffset = (splitTime - trackToSplit.startTime) + existingOffset;

    // create new track
    const newTrackId = `${trackToSplit.id}_split_${Date.now()}`;

    // apply keyframes
    const rightKeyframes = trackToSplit.keyframes.filter(k => k.time > splitTime);
    const leftKeyframes = trackToSplit.keyframes.filter(k => k.time <= splitTime);

    let newFabricObject = null;
    let newAudioElement = null;

    if (trackToSplit.type === "visual") {
      if (trackToSplit.fabricObject) {
        // Clone the visual object 
        trackToSplit.fabricObject.clone().then((cloned: any) => {
          newFabricObject = cloned;
          newFabricObject.set({
            left: trackToSplit.fabricObject!.left,
            top: trackToSplit.fabricObject!.top,
            // Add custom ID 
            _customId: newTrackId,
            customType: (trackToSplit.fabricObject as any).customType
          });

          // Propagate the track name onto the cloned fabric object 
          (newFabricObject as any)._assetName = `${trackToSplit.name}`;
          try {
            newFabricObject.name = `${trackToSplit.name}`;
          } catch (e) {

          }

          if (canvas) {
            canvas.add(newFabricObject);
            canvas.renderAll();
            canvas.setActiveObject(newFabricObject);
          }

          // Update the track in the store 
          set((state) => ({
            tracks: state.tracks.map((t) =>
              t.id === newTrackId ? { ...t, fabricObject: newFabricObject } : t,
            ),
            selectedObjectId: newTrackId,
            selectedObject: newFabricObject,
          }));
        });
      }
    }
    else if (trackToSplit.type === "video") {
      // For video, create a new video element
      const oldVideoEl = (trackToSplit.fabricObject as any)?._element;
      if (oldVideoEl) {
        const newVideoEl = document.createElement("video");
        newVideoEl.src = oldVideoEl.src;
        newVideoEl.crossOrigin = "anonymous";
        newVideoEl.muted = true;
        newVideoEl.width = oldVideoEl.width;
        newVideoEl.height = oldVideoEl.height;

        const fabObj = trackToSplit.fabricObject!;
        newFabricObject = new FabricImage(newVideoEl, {
          left: fabObj.left,
          top: fabObj.top,
          scaleX: fabObj.scaleX,
          scaleY: fabObj.scaleY,
          angle: fabObj.angle,
          opacity: fabObj.opacity,
          objectCaching: false,
        });
        (newFabricObject as any)._customId = newTrackId;
        (newFabricObject as any).customType = "video";
        (newFabricObject as any)._element = newVideoEl;

        // Ensure the video fabric object carries the track name for the UI
        (newFabricObject as any)._assetName = `${trackToSplit.name}`;
        try {
          (newFabricObject as any).name = `${trackToSplit.name}`;
        } catch (e) {
          /* ignore if readonly */
        }

        if (canvas) canvas.add(newFabricObject);
      }
    }
    else if (trackToSplit.type === "audio") {
      if (trackToSplit.audioElement) {
        // FIX: Create a new Audio element with the same source instead of cloning
        newAudioElement = new Audio(trackToSplit.audioElement.src);
        newAudioElement.preload = "auto";
        newAudioElement.crossOrigin = "anonymous";
        // Set initial time to the offset (will be adjusted during playback)
        newAudioElement.currentTime = 0;
      }
    }
    // New Track Object
    const rightTrack: TrackObject = {
      ...trackToSplit,
      id: newTrackId,
      startTime: splitTime + 1,
      endTime: oldEndTime,
      keyframes: rightKeyframes,
      fabricObject: newFabricObject,
      audioElement: newAudioElement,
      mediaOffset: newMediaOffset,
      name: `${trackToSplit.name}`
    };

    const updatedLeftTrack = {
      ...trackToSplit,
      endTime: splitTime,
      keyframes: leftKeyframes
    };

    set(state => ({
      tracks: state.tracks
        .map(t => t.id === trackToSplit.id ? updatedLeftTrack : t) // Update old
        .concat(rightTrack), // Add new
      selectedObjectId: newTrackId // Select the new part automatically
    }));

    // Refresh Canvas
    if (canvas) canvas.requestRenderAll();
  },

  addKeyframeAtCurrentTime: (trackId) => {
    get().saveCheckpoint();
    set((state) => {
      const track = state.tracks.find((t) => t.id === trackId);
      if (!track?.fabricObject) return state;

      const fabricObj = track.fabricObject;
      const newKeyframe: Keyframe = {
        id: `kf_${Date.now()}`,
        time: state.currentTime,
        properties: {
          left: fabricObj.left || 0,
          top: fabricObj.top || 0,
          scaleX: fabricObj.scaleX || 1,
          scaleY: fabricObj.scaleY || 1,
          angle: fabricObj.angle || 0,
          opacity: fabricObj.opacity || 1,
        },
        easing: "linear",
      };

      return {
        tracks: state.tracks.map((t) => {
          if (t.id === trackId) {
            const existingIndex = t.keyframes.findIndex(
              (kf) => Math.abs(kf.time - state.currentTime) < 0.05,
            );
            let newKeyframes;
            if (existingIndex >= 0) {
              newKeyframes = [...t.keyframes];
              newKeyframes[existingIndex] = newKeyframe;
            } else {
              newKeyframes = [...t.keyframes, newKeyframe].sort((a, b) => a.time - b.time);
            }
            return { ...t, keyframes: newKeyframes };
          }
          return t;
        }),
      };
    });
  },

  updateKeyframe: (trackId, keyframeId, updates) => {
    get().saveCheckpoint();
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === trackId
          ? {
            ...track,
            keyframes: track.keyframes.map((kf) =>
              kf.id === keyframeId ? { ...kf, ...updates } : kf,
            ),
          }
          : track,
      ),
      selectedKeyframe: state.selectedKeyframe?.id === keyframeId
        ? { ...state.selectedKeyframe, ...updates }
        : state.selectedKeyframe,
    }));
  },

  removeKeyframe: (trackId, keyframeId) => {
    get().saveCheckpoint();
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === trackId
          ? {
            ...track,
            keyframes: track.keyframes.filter((kf) => kf.id !== keyframeId),
          }
          : track,
      ),
      selectedKeyframe: state.selectedKeyframe?.id === keyframeId ? null : state.selectedKeyframe,
    }));
  },

  applyKeyframesAtTime: (time) => {
    const { tracks, canvas, selectedObject, isPlaying, selectedTrackId, setSelectedObject } = get();

    // auto-select next track when playhead moves to it.
    if (isPlaying && selectedTrackId) {
       const currentTrack = tracks.find(t => t.id === selectedTrackId);
       
       // If playhead has passed the current track's end time
       if (currentTrack && time >= currentTrack.endTime) {
         // Find a track that starts exactly where this one ended (within 0.1s tolerance)
         const nextTrack = tracks.find(t => 
             Math.abs(t.startTime - currentTrack.endTime) < 0.1 && 
             t.id !== currentTrack.id
         );

         if (nextTrack) {
           // Switch selection to the new track
           setSelectedObject(nextTrack.id, nextTrack.fabricObject, nextTrack.type);
         }
       }
    }

    tracks.forEach((track) => {
      // ---  Audio Handling ---
      if (track.type === "audio" && track.audioElement) {
        if (!isPlaying) {
          const isInRange = time >= track.startTime && time <= track.endTime;
          if (isInRange) {
            const relativeTime = time - track.startTime;
            const targetFileTime = relativeTime + (track.mediaOffset || 0);

            if (Math.abs(track.audioElement.currentTime - targetFileTime) > 0.1) {
              track.audioElement.currentTime = targetFileTime;
            }
          } else {
            if (!track.audioElement.paused) track.audioElement.pause();
          }
        }
        return;
      }


      if (!track.fabricObject) return;

      track.fabricObject.set({ selectable: true, evented: true });

      if (time < track.startTime || time > track.endTime) {
        if (canvas && canvas.contains(track.fabricObject)) {
          canvas.remove(track.fabricObject);
        }
        return;
      }

      if (canvas && !canvas.contains(track.fabricObject)) {
        canvas.add(track.fabricObject);
        const bg = canvas
          .getObjects()
          .find((o) => (o as any).customType === "background");
        if (bg) canvas.moveObjectTo(bg, 0);
      }

      if (track.keyframes.length > 0) {
        const props = interpolateProperties(track.keyframes, time);
        if (props) {
          Object.keys(props).forEach((key) => {
            track.fabricObject!.set(key as any, (props as any)[key]);
          });
          track.fabricObject.setCoords();
          track.fabricObject.dirty = true;
        }
      }
    });

    if (selectedObject && canvas) {
      canvas.discardActiveObject();
      canvas.setActiveObject(selectedObject);
    }
    canvas?.requestRenderAll();
  },
  addAudioTrack: (name, audioSrc) => {
    get().saveCheckpoint();
    const audio = new Audio(audioSrc);
    audio.preload = "auto";
    const id = `audio_${Date.now()}`;
    const newTrack: TrackObject = {
      id,
      name,
      fabricObject: null,
      startTime: 0,
      endTime: 5,
      keyframes: [],
      color: "purple",
      initialState: { left: 0, top: 0, scaleX: 1, scaleY: 1, angle: 0, opacity: 1 },
      type: "audio",
      audioElement: audio,
      audioSrc,
    };
    audio.addEventListener("loadedmetadata", () => {
      get().updateTrack(id, { endTime: audio.duration });
    });
    set((state) => ({ tracks: [...state.tracks, newTrack] }));
  },

  addVideoTrack: (name, videoSrc) => {
    get().saveCheckpoint();
    const video = document.createElement("video");
    video.src = videoSrc;
    video.preload = "auto"; video.crossOrigin = "anonymous"; video.muted = true;
    video.playsInline = true; video.loop = false; video.style.display = "none";
    video.width = 480; video.height = 360;

    const id = `video_${Date.now()}`;
    const newTrack: TrackObject = {
      id,
      name,
      fabricObject: null,
      startTime: 0,
      endTime: 10,
      keyframes: [],
      color: "orange",
      initialState: { left: 0, top: 0, scaleX: 1, scaleY: 1, angle: 0, opacity: 1 },
      type: "video",
      audioElement: null,
      audioSrc: videoSrc,
    };
    set((state) => ({ tracks: [...state.tracks, newTrack] }));

    // wait for metadata to load to get dimensions and duration
    const onMetadataLoaded = () => {
      const width = video.videoWidth || 480;
      const height = video.videoHeight || 360;
      video.width = width; video.height = height;
      const targetSize = 300;
      const fitScale = Math.min(targetSize / width, targetSize / height);
      const baseLeft = 100 + Math.random() * 200;
      const baseTop = 100 + Math.random() * 200;

      const fabricVideo = new FabricImage(video, {
        left: baseLeft, top: baseTop, scaleX: fitScale, scaleY: fitScale, objectCaching: false,
      });
      (fabricVideo as any)._customId = id;
      (fabricVideo as any).customType = "video";
      (fabricVideo as any)._element = video;

      const canvas = get().canvas;
      if (canvas) {
        canvas.add(fabricVideo);
        canvas.setActiveObject(fabricVideo);
        canvas.renderAll();
      }
      get().updateTrack(id, {
        fabricObject: fabricVideo,
        endTime: video.duration,
        mediaDuration: video.duration,
      });
      video.play().catch((e) => console.log("Autoplay blocked", e));
    };

    if (video.readyState >= 1) onMetadataLoaded();
    else video.onloadedmetadata = onMetadataLoaded;

    document.body.appendChild(video);
  },

  syncAudioPlayback: () => {
    const { tracks, isPlaying, currentTime } = get();

    tracks.forEach((track) => {
      if (track.type === "audio" && track.audioElement) {
        const audio = track.audioElement;

        // We add a tiny buffer (0.01) to end check to prevent early cut-off 
        const isInRange = currentTime >= track.startTime && currentTime < track.endTime;

        if (isPlaying && isInRange) {
          const timeElapsedInTrack = currentTime - track.startTime;
          const targetFileTime = timeElapsedInTrack + (track.mediaOffset || 0);

          if (audio.paused) {
            // The audio is paused but needs to play. 
            audio.currentTime = targetFileTime;

            const playPromise = audio.play();
            if (playPromise !== undefined) {
              playPromise.catch(e => {
                if (e.name !== "AbortError") console.warn("Audio play error", e);
              });
            }
          } else {
            // It is already playing. Check drift and adjust if needed.
            const drift = Math.abs(audio.currentTime - targetFileTime);
            // Lower threshold to catch transitions between split tracks (0.1s instead of 0.3s)
            if (drift > 0.35) {
              audio.currentTime = targetFileTime;
            }
          }
        } else {
          // Not in range or global stop
          if (!audio.paused) {
            audio.pause();
            if (currentTime >= track.endTime) {
                const clipDuration = track.endTime - track.startTime;
                const endFileTime = clipDuration + (track.mediaOffset || 0);
                
                 if (!isNaN(audio.duration)) {
                    audio.currentTime = Math.min(endFileTime, audio.duration);
                 }
            }
          }
        }
      }
    });
  },
});