import { useRef, useEffect, useCallback } from "react";
import { useEditorStore } from "@/stores/editorStore";
import type { Keyframe } from "../../types";

import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  SkipBack,
  Diamond,
  Plus,
  Music,
  SquareSplitHorizontal,
  Video,
  VideoIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { KeyframeEditor } from "./KeyframeEditor";
import { toast } from "sonner";

export function Timeline() {
  const {
    tracks,
    currentTime,
    duration,

    isPlaying,
    selectedObjectId,
    setCurrentTime,
    setIsPlaying,
    setSelectedObject,
    setSelectedKeyframe,
    selectedKeyframe,
    addKeyframeAtCurrentTime,
    applyKeyframesAtTime,
    splitTrack,
    canvas,
    syncAudioPlayback,
    deleteSelected,
    setContextMenu,
    saveCheckpoint,
  } = useEditorStore();

  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>(0);
  const isDraggingPlayhead = useRef(false);
  const resizingTrack = useRef<{ id: string; edge: "start" | "end" } | null>(
    null,
  );
  const draggingTrack = useRef<{
    id: string;
    startX: number;
    originalStart: number;
    originalEnd: number;
  } | null>(null);

  // Calculate visible duration
  const maxTrackEnd = Math.max(...tracks.map((t) => t.endTime), 0);
  const minVisibleDuration = 10; // Minimum timeline duration
  const visibleDuration = Math.max(minVisibleDuration, maxTrackEnd + 2);

  // FIX: "timeline end" should be the last track end (fallback to duration if no tracks)
  const maxDuration = maxTrackEnd > 0 ? maxTrackEnd : duration;

  const pixelsPerSecond = 80;
  const timelineWidth = visibleDuration * pixelsPerSecond;
  const timeToPixels = (time: number) => time * pixelsPerSecond;
  const pixelsToTime = useCallback((px: number) => px / pixelsPerSecond, []);

  // FIX: define updateTrackLive (no history checkpoint spam during mousemove)
  const updateTrackLive = useCallback(
    (id: string, updates: { startTime?: number; endTime?: number }) => {
      useEditorStore.setState((state) => ({
        tracks: state.tracks.map((t) =>
          t.id === id ? { ...t, ...updates } : t,
        ),
      }));
    },
    [],
  );

  // Calculate container width for scroll detection
  const containerWidth = scrollContainerRef.current?.clientWidth || 800;
  const needsScroll = timelineWidth > containerWidth;

  const getTimeFromX = useCallback(
    (clientX: number) => {
      if (!scrollContainerRef.current) return 0;

      const containerRect = scrollContainerRef.current.getBoundingClientRect();
      const scrollLeft = scrollContainerRef.current.scrollLeft;

      const relativeX = clientX - containerRect.left;
      const absoluteX = relativeX + scrollLeft;

      return Math.max(0, pixelsToTime(absoluteX));
    },
    [pixelsToTime],
  );

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest(".keyframe-marker")) return;
      if ((e.target as HTMLElement).closest(".track-label")) return;
      if ((e.target as HTMLElement).closest(".track-resize-handle")) return;

      if (!scrollContainerRef.current) return;

      const newTime = getTimeFromX(e.clientX);
      setCurrentTime(newTime);
      applyKeyframesAtTime(newTime);
    },
    [getTimeFromX, setCurrentTime, applyKeyframesAtTime],
  );

  // Handle Delete key for timeline items
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).tagName === "INPUT" ||
        (e.target as HTMLElement).tagName === "TEXTAREA"
      )
        return;

      if ((e.key === "Delete" || e.key === "Backspace") && selectedObjectId) {
        deleteSelected();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedObjectId, deleteSelected]);

  const handlePlayheadMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      isDraggingPlayhead.current = true;

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDraggingPlayhead.current) return;
        const newTime = getTimeFromX(e.clientX);
        setCurrentTime(newTime);
        applyKeyframesAtTime(newTime);
      };

      const handleMouseUp = () => {
        isDraggingPlayhead.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [getTimeFromX, setCurrentTime, applyKeyframesAtTime],
  );

  const handleTrackResizeStart = useCallback(
    (e: React.MouseEvent, trackId: string, edge: "start" | "end") => {
      e.preventDefault();
      e.stopPropagation();

      // checkpoint ONCE for the whole resize gesture
      saveCheckpoint();

      resizingTrack.current = { id: trackId, edge };

      const handleMouseMove = (ev: MouseEvent) => {
        if (!resizingTrack.current) return;

        const newTime = Math.max(0, getTimeFromX(ev.clientX));

        // always read the latest track from the store to avoid stale closures
        const track = useEditorStore
          .getState()
          .tracks.find((t: any) => t.id === resizingTrack.current?.id);
        if (!track) return;

        if (resizingTrack.current.edge === "start") {
          if (newTime < track.endTime - 0.1) {
            updateTrackLive(track.id, {
              startTime: Math.round(newTime * 10) / 10,
            });
          }
        } else {
          if (newTime > track.startTime + 0.1) {
            updateTrackLive(track.id, {
              endTime: Math.round(newTime * 10) / 10,
            });
          }
        }
      };

      const handleMouseUp = () => {
        resizingTrack.current = null;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [getTimeFromX, saveCheckpoint, updateTrackLive],
  );

  const handleTrackDragStart = useCallback(
    (e: React.MouseEvent, trackId: string) => {
      if ((e.target as HTMLElement).closest(".track-resize-handle")) return;
      e.preventDefault();
      e.stopPropagation();

      const track = useEditorStore
        .getState()
        .tracks.find((t: any) => t.id === trackId);
      if (!track) return;

      // checkpoint ONCE for the whole drag gesture
      saveCheckpoint();

      draggingTrack.current = {
        id: trackId,
        startX: e.clientX,
        originalStart: track.startTime,
        originalEnd: track.endTime,
      };

      const handleMouseMove = (ev: MouseEvent) => {
        if (!draggingTrack.current) return;

        const deltaX = ev.clientX - draggingTrack.current.startX;
        const deltaTime = pixelsToTime(deltaX);

        const newStart = Math.max(
          0,
          draggingTrack.current.originalStart + deltaTime,
        );
        const dur =
          draggingTrack.current.originalEnd -
          draggingTrack.current.originalStart;
        const newEnd = newStart + dur;

        updateTrackLive(draggingTrack.current.id, {
          startTime: Math.round(newStart * 10) / 10,
          endTime: Math.round(newEnd * 10) / 10,
        });
      };

      const handleMouseUp = () => {
        draggingTrack.current = null;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [pixelsToTime, saveCheckpoint, updateTrackLive],
  );

  const handleKeyframeClick = (
    e: React.MouseEvent,
    keyframe: Keyframe,
    trackId: string,
  ) => {
    e.stopPropagation();
    setSelectedKeyframe(keyframe, trackId);
  };

  const handleAddKeyframe = () => {
    if (!selectedObjectId) return;
    const track = tracks.find((t) => t.id === selectedObjectId);
    if (track?.type === "audio") {
      toast.error("Cannot add keyframes to audio tracks");
      return;
    }
    addKeyframeAtCurrentTime(selectedObjectId);
    toast.success("Keyframe added");
  };

  const handlePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      startTimeRef.current = performance.now() - currentTime * 1000;
      setIsPlaying(true);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    applyKeyframesAtTime(0);
  };

  useEffect(() => {
    if (isPlaying) {
      const animate = (timestamp: number) => {
        const elapsed = (timestamp - startTimeRef.current) / 1000;
        const currentMaxEnd = maxDuration;

        if (elapsed >= currentMaxEnd) {
          // stop at end (do NOT reset to 0)
          setIsPlaying(false);
          setCurrentTime(currentMaxEnd);
          syncAudioPlayback();
          return;
        }

        setCurrentTime(elapsed);
        applyKeyframesAtTime(elapsed);
        //syncAudioPlayback();
        animationRef.current = requestAnimationFrame(animate);
      };

      animationRef.current = requestAnimationFrame(animate);
      syncAudioPlayback();
      
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      syncAudioPlayback();
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [
    isPlaying,
    maxDuration, 
    setCurrentTime,
    applyKeyframesAtTime,
    syncAudioPlayback,
    setIsPlaying,
  ]);

  const handleTrackClick = (track: (typeof tracks)[0]) => {
    if (track.type === "audio") {
      setSelectedObject(track.id, null, "audio");
    } else if (track.type === "video") {
      setSelectedObject(track.id, null, "video");
    } else if (track.fabricObject) {
      setSelectedObject(track.id, track.fabricObject, "object");
      if (canvas) {
        canvas.setActiveObject(track.fabricObject);
        canvas.renderAll();
      }
    }
  };

  const handleTimelineRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY / 2 - 50,
    });
  };

  // Generate time markers
  const timeMarkers = [];
  for (let i = 0; i <= visibleDuration; i++) {
    timeMarkers.push(i);
  }

  const handleSplit = () => {
    if (!selectedObjectId) return;
    splitTrack(selectedObjectId);
    toast.success("Track split");
  };

  console.log(tracks, 'tracks in TimeLine')
  return (
    <div className="h-48 bg-timeline border-t border-panel-border flex flex-col relative">
      {/* Controls */}
      <div className="flex items-center gap-2 p-3 border-b border-panel-border">
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          aria-label="Reset Playhead"
          title="Reset Playhead"
          className="h-8 w-8 p-0 bg-secondary border-panel-border hover:bg-muted hover:text-white"
        >
          <SkipBack className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="h-8 px-1 min-w-[90px] bg-secondary border-panel-border hover:bg-muted hover:text-white"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {isPlaying ? "Pause" : "Play"}
        </Button>
        <span className="text-xs text-muted-foreground mx-4 tabular-nums">
          {currentTime.toFixed(2)}s / {maxTrackEnd.toFixed(2)}s
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddKeyframe}
          aria-label="Add Keyframe"
          disabled={
            !selectedObjectId ||
            tracks.find((t) => t.id === selectedObjectId)?.type === "audio"
          }
          className={cn(
            "h-8 px-3 bg-secondary border-panel-border",
            selectedObjectId &&
              tracks.find((t) => t.id === selectedObjectId)?.type !== "audio"
              ? "hover:bg-primary/20 hover:border-primary/50 hover:text-primary"
              : "opacity-40 cursor-not-allowed",
          )}
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Keyframe
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSplit}
          disabled={!selectedObjectId}
          aria-label="Split Timline"
          title="Split Timeline"
          className={cn(
            "h-8 px-3 bg-secondary border-panel-border",
            selectedObjectId
              ? "hover:bg-primary/20 hover:border-primary/50 hover:text-primary"
              : "opacity-40 cursor-not-allowed",
          )}
        >
          <SquareSplitHorizontal />
        </Button>
      </div>

      {/* Timeline Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track Labels */}
        <div className="w-32 border-r border-panel-border flex flex-col flex-shrink-0 track-label overflow-y-auto custom-scrollbar">
          <div className="h-6 border-b border-panel-border" />{" "}
          {/* Spacer for time markers */}
          {tracks.map((track) => (
            <button
              key={track.id}
              onClick={() => handleTrackClick(track)}
              className={cn(
                "h-8 px-3 text-xs text-left truncate transition-colors flex items-center gap-1 flex-shrink-0",
                selectedObjectId === track.id
                  ? "bg-primary/20 text-primary border-l-2 border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
              )}
            >
              {track.type === "audio" && (
                <Music className="w-3 h-3 text-purple-400 flex-shrink-0" />
              )}
              {track.type === "video" && (
                <Video className="w-3 h-3 text-blue-400 flex-shrink-0" />
              )}
              <span className="truncate select-none">{track.name}</span>
              {track.keyframes.length > 0 && (
                <span className="text-[10px] text-playhead select-none">
                  ({track.keyframes.length})
                </span>
              )}
            </button>
          ))}
          {tracks.length === 0 && (
            <div className="h-8 px-3 text-xs text-muted-foreground flex items-center select-none">
              No objects
            </div>
          )}
        </div>

        {/* Timeline Tracks with horizontal scroll */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar"
        >
          <div
            ref={timelineRef}
            className="relative min-w-full"
            style={{ width: `${timelineWidth}px` }}
            onClick={handleTimelineClick}
            onContextMenu={(e) => handleTimelineRightClick(e)}
          >
            {/* Time Markers */}
            <div className="h-6 border-b border-panel-border relative select-none">
              {timeMarkers.map((sec) => (
                <div
                  key={sec}
                  className="absolute text-[10px] text-muted-foreground flex flex-col items-center"
                  style={{ left: `${timeToPixels(sec)}px` }}
                >
                  <span className="mb-0.5">|{sec}</span>
                </div>
              ))}
            </div>

            {/* Tracks */}
            <div className="relative min-h-full">
              {tracks.map((track) => (
                <div
                  key={track.id}
                  className={cn(
                    "h-8 relative cursor-pointer transition-colors",
                    selectedObjectId === track.id && "bg-primary/10",
                  )}
                  onClick={() => handleTrackClick(track)}
                >
                  {/* Track bar */}
                  <div
                    className={cn(
                      "absolute h-5 top-1.5 rounded-full transition-all group cursor-move",
                      track.type === "audio" &&
                      "bg-gradient-to-r from-purple-500/80 to-purple-600/80",
                      track.type === "video" &&
                      "bg-gradient-to-r from-blue-500/80 to-blue-600/80",
                      track.type === "visual" &&
                      "bg-gradient-to-r from-green-500/80 to-green-600/80",
                      selectedObjectId === track.id &&
                      "ring-2 ring-primary ring-offset-1 ring-offset-timeline",
                    )}
                    style={{
                      left: `${timeToPixels(track.startTime)}px`,
                      width: `${timeToPixels(
                        track.endTime - track.startTime,
                      )}px`,
                    }}
                    onMouseDown={(e) => handleTrackDragStart(e, track.id)}
                  >
                    {/* Audio icon inside track */}
                    {track.type === "audio" && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <Music className="w-3 h-3 text-white/60" />
                      </div>
                    )}

                    {track.type === "video" && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <Video className="w-3 h-3 text-white/60" />
                      </div>
                    )}
                    {/* Resize handles */}
                    <div
                      className="track-resize-handle absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 rounded-l-full"
                      onMouseDown={(e) =>
                        handleTrackResizeStart(e, track.id, "start")
                      }
                    />
                    <div
                      className="track-resize-handle absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 rounded-r-full"
                      onMouseDown={(e) =>
                        handleTrackResizeStart(e, track.id, "end")
                      }
                    />
                  </div>

                  {/* Keyframes - only for non-audio tracks */}
                  {track.type !== "audio" &&
                    track.keyframes.map((kf) => (
                      <button
                        key={kf.id}
                        className={cn(
                          "keyframe-marker absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 transition-transform hover:scale-125 z-10",
                          selectedKeyframe?.id === kf.id && "scale-125",
                        )}
                        style={{ left: `${timeToPixels(kf.time)}px` }}
                        onClick={(e) => handleKeyframeClick(e, kf, track.id)}
                        title={`Keyframe @ ${kf.time.toFixed(2)}s`}
                      >
                        <Diamond
                          className={cn(
                            "w-4 h-4",
                            selectedKeyframe?.id === kf.id
                              ? "text-playhead fill-playhead"
                              : "text-foreground fill-background",
                          )}
                        />
                      </button>
                    ))}
                </div>
              ))}
            </div>

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-playhead z-20 cursor-ew-resize group"
              style={{
                left: `${Math.min(timeToPixels(currentTime), timelineWidth)}px`,
              }}
              onMouseDown={handlePlayheadMouseDown}
            >
              <div className="absolute -top-2 left-2/3 -translate-x-1/2 w-6 h-7 flex items-start justify-center cursor-ew-resize rounded-full mt-[5px]">
                <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[12px] border-t-playhead group-hover:border-t-white transition-colors" />
              </div>
              <div className="absolute -left-3 top-0 bottom-0 w-7" />
            </div>
          </div>
        </div>
      </div>

      {/* Keyframe Editor */}
      {/* <KeyframeEditor /> */}
    </div>
  );
}
