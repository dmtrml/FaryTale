"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";

type ImageUploadFieldProps = {
  label: string;
  hint?: string;
  name?: string;
  aspect?: "video" | "square" | "cover";
};

const aspectClasses = {
  video: "aspect-video",
  square: "aspect-square",
  cover: "aspect-[3/4]",
};

export function ImageUploadField({
  label,
  hint,
  name = "image",
  aspect = "video",
}: ImageUploadFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function setFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setFileName(file.name);
  }

  function acceptDroppedFile(file: File) {
    const input = inputRef.current;
    if (!input) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    setFile(file);
  }

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-semibold">
        {label}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        name={name}
        type="file"
        required
        accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
        className="sr-only"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) setFile(file);
        }}
      />
      <label
        htmlFor={inputId}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) acceptDroppedFile(file);
        }}
        className={`mt-2 block cursor-pointer rounded-2xl border-2 border-dashed p-3 text-center transition-colors ${
          dragging ? "border-[#625a51] bg-[#eee8dd]" : "border-[#cfc5b8] bg-white"
        }`}
      >
        {previewUrl ? (
          <div className={`relative mx-auto max-h-56 max-w-sm overflow-hidden rounded-xl bg-[#f4f0e9] ${aspectClasses[aspect]}`}>
            <Image
              unoptimized
              fill
              src={previewUrl}
              alt="Предпросмотр выбранного изображения"
              className="object-contain"
            />
          </div>
        ) : (
          <div className="grid min-h-28 place-items-center px-4 py-6 text-sm text-[#70685e]">
            <div>
              <p className="font-semibold text-[#514940]">Перетащите изображение сюда</p>
              <p className="mt-1">или нажмите, чтобы выбрать файл</p>
            </div>
          </div>
        )}
      </label>
      {fileName ? <p className="mt-2 truncate text-xs text-[#756d64]">Выбрано: {fileName}</p> : null}
      {hint ? <p className="mt-2 text-xs leading-5 text-[#756d64]">{hint}</p> : null}
    </div>
  );
}
