import { useRef } from "react";

export default function UploadButton({
  label,
  icon,
  accept,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  accept: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      className="flex flex-row items-center justify-center gap-4 p-4 rounded-xl border border-dashed border-panel-border bg-secondary/10 hover:bg-secondary/30 hover:border-primary/50 transition-all cursor-pointer"
      onClick={() => inputRef.current?.click()}
    >
      {icon}
      <span className="text-[0.85rem] font-medium">{label}</span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        onChange={onChange}
        className="hidden"
      />
    </div>
  );
}
