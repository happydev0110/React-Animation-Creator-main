import { useEffect, useState } from "react";

import BaseDemo from "./adapters/pixi/demo/BaseDemo";
import Character from "./adapters/pixi/demo/Character";

import { Toaster as Sonner, toast } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AssetPanel } from "@/components/editor/AssetPanel";
import { CanvasEditor } from "@/components/editor/CanvasEditor";
import { PropertyPanel } from "@/components/editor/PropertyPanel";
import { Timeline } from "@/components/editor/Timeline";
import { DragonBonesTimeline } from "./components/editor/DragonBonesTimeline";
import { Toolbar } from "@/components/ui/Toolbar";

import { Texture } from "pixi.js";
import { useEditorStore } from "./stores/editorStore";

const queryClient = new QueryClient();

// keep outside component so it survives re-renders
let currentDemo: BaseDemo | null = null;

const App = () => {
  const {
    tracks,
    currentTime,
    duration,

    addTrack,
    removeTrack,
    setCurrentTime,
    setIsPlaying,
    setDuration,
    applyKeyframesAtTime,
  } = useEditorStore();

  const [characterName, setCharacterName] = useState("");
  const [skelJson, setSkelJson] = useState<any>(null);
  const [texJson, setTexJson] = useState<any>(null);
  const [imgPng, setImgPng] = useState<Texture | null>(null);

  const [pathId, setPathId] = useState<string | null>(null);
  const [isFabric, setIsFabric] = useState(true);

  /** Set Animation Duration in the store */
  const setAnimationDuration = (time: number) => {
    setDuration(time);

    // remove previous drawing track if exists
    if (pathId) {
      removeTrack(pathId);
    }

    const newId = `drawing_${Date.now()}`;
    setPathId(newId);

    addTrack({
      id: newId,
      name: "Drawing",
      startTime: 0,
      endTime: time,
      keyframes: [],
      color: "green",
      type: "visual",
    });
  };

  /** Reset Timeline to 0 and start playing */
  const startTimeLine = () => {
    setIsPlaying(true);
    setCurrentTime(0);
    applyKeyframesAtTime(0);
  };

  /** Upload DragonBones export files */
  const uploadDragonBones = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "image" | "json/skeleton" | "json/texture",
  ) => {
    const files = e.target.files;
    if (!files) return;

    const file = files[0];

    if (type.includes("json")) {
      const text = await file.text();
      const json = JSON.parse(text);

      if (type === "json/skeleton") setSkelJson(json);
      else setTexJson(json);
    }

    if (type === "image") {
      const imageBitmap = await createImageBitmap(file);
      const texture = Texture.from(imageBitmap);
      setImgPng(texture);
    }
  };

  /** Create PixiJS ArmatureDisplay Demo */
  const createNewAnimation = async () => {
    if (!skelJson || !texJson || !imgPng) {
      toast.error("All 3 files needed to render");
      return;
    }

    setIsFabric(false);
    setCharacterName(skelJson?.name ?? "");

    const armatureName = skelJson?.armature?.[0]?.name;
    if (!armatureName) {
      toast.error("Armature name not found in skeleton JSON");
      return;
    }

    const demo = new Character(
      skelJson,
      texJson,
      imgPng,
      skelJson?.name,
      armatureName,
      setAnimationDuration,
      startTimeLine,
    );

    // destroy old demo
    if (currentDemo) {
      try {
        await (currentDemo as any).destroy?.();
      } catch (e) {
        console.error(e);
      }
    }

    currentDemo = demo;

    try {
      await (currentDemo as any).init?.();
    } catch (e) {
      console.error(e);
      toast.error("Failed to initialize DragonBones demo");
    }
  };

  /** Drive DragonBones pose from Timeline currentTime */
  useEffect(() => {
    if (isFabric) return;
    if (!currentDemo) return;

    const demoAny = currentDemo as any;
    if (typeof demoAny.setTimelineTime === "function") {
      demoAny.setTimelineTime(currentTime);
    }
  }, [currentTime, isFabric]);

  useEffect(() => {
    return () => {
      if (currentDemo) {
        try {
          (currentDemo as any).destroy?.();
        } catch (e) {
          console.error(e);
        }
        currentDemo = null;
      }
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Sonner />
      <div className="h-screen flex flex-col overflow-hidden bg-background">
        <Toolbar />
        <div className="flex-1 flex overflow-hidden">
          <AssetPanel
            characterName={characterName}
            skelJson={skelJson}
            texJson={texJson}
            imagPng={imgPng as any}
            uploadDragonBones={uploadDragonBones}
            createNewAnimation={createNewAnimation}
          />
          <div className="flex-1 flex flex-col overflow-hidden">
            {isFabric ? (
              <>
                <CanvasEditor />
                <Timeline />
              </>
            ) : (
              <>
                <div className="flex-1 flex items-center justify-center bg-canvas p-4 overflow-hidden relative" id="dragonbones" />
                <DragonBonesTimeline />
              </>
            )}
          </div>

          <PropertyPanel />
        </div>
      </div>
    </QueryClientProvider>
  );
};

export default App;
