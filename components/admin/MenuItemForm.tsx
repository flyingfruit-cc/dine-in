"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createMenuItem,
  updateMenuItem,
  uploadMenuItemImage,
} from "@/actions/menuActions";
import { formatPrice } from "@/utils/formatPrice";
import { VariantEditor } from "@/components/admin/VariantEditor";
import { AvailabilitySchedule } from "@/components/admin/AvailabilitySchedule";
import type { Category, MenuItem, VariantGroup, AvailabilitySchedule as Schedule } from "@/types/app";

interface Props {
  categories: Category[];
  item?: MenuItem;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function MenuItemForm({ categories, item }: Props) {
  const router = useRouter();
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [priceCents, setPriceCents] = useState(item?.price_cents ?? 0);
  const [categoryId, setCategoryId] = useState<string | null>(
    item?.category_id ?? null,
  );
  const [imagePreview, setImagePreview] = useState<string | null>(
    item?.image_url ?? null,
  );
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [variants, setVariants] = useState<VariantGroup[]>(
    item?.variants ?? [],
  );
  const [availabilitySchedule, setAvailabilitySchedule] = useState<Schedule | null>(
    item?.availability_schedule ?? null,
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedItemIdRef = useRef<string | null>(item?.id ?? null);
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSave = async () => {
    setSaveStatus("saving");
    setSaveError(null);
    const textData = {
      name: name.trim(),
      description: description.trim() || null,
      price_cents: priceCents,
      category_id: categoryId,
      variants,
      availability_schedule: availabilitySchedule,
    };

    try {
      let currentId = savedItemIdRef.current;
      let isFirstSave = false;
      if (!currentId) {
        isFirstSave = true;
        const result = await createMenuItem(textData);
        if (!result.success) {
          setSaveStatus("error");
          setSaveError("Unable to save — tap to try again");
          return;
        }
        currentId = result.data.item.id;
        savedItemIdRef.current = currentId;
      } else {
        const updateData =
          imageRemoved && !pendingImageFile
            ? { ...textData, image_url: null }
            : textData;
        const result = await updateMenuItem(currentId, updateData);
        if (!result.success) {
          setSaveStatus("error");
          setSaveError("Unable to save — tap to try again");
          return;
        }
      }

      if (pendingImageFile && currentId) {
        const fd = new FormData();
        fd.append("file", pendingImageFile);
        const uploadResult = await uploadMenuItemImage(currentId, fd);
        if (!uploadResult.success) {
          setSaveStatus("error");
          setSaveError("Unable to save — tap to try again");
          return;
        }
        // Keep the blob URL for display — the CDN URL is identical on every upload to the
        // same path, so switching to it would serve the browser-cached old image.
        // The blob URL shows the new image immediately and is valid for this page session.
        setPendingImageFile(null);
        setFileInputKey((k) => k + 1);
      }

      setImageRemoved(false);

      if (isFirstSave) {
        router.push(`/admin/menu/${currentId}`);
        return;
      }

      setSaveStatus("saved");
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = setTimeout(
        () => setSaveStatus("idle"),
        2000,
      );
    } catch {
      setSaveStatus("error");
      setSaveError("Unable to save — tap to try again");
    }
  };

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!name.trim()) return;
    timerRef.current = setTimeout(() => {
      void doSave();
    }, 2000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [
    name,
    description,
    priceCents,
    categoryId,
    pendingImageFile,
    imageRemoved,
    variants,
    availabilitySchedule,
  ]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    setPendingImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setImageRemoved(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    setPendingImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setImageRemoved(false);
  };

  const handleRemoveImage = () => {
    if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setPendingImageFile(null);
    setImageRemoved(true);
    setFileInputKey((k) => k + 1);
  };

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      {/* Name */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-text-primary">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder="Item name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10 rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-text-primary">
          Description
        </label>
        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
        />
      </div>

      {/* Price */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="price-input"
          className="text-sm font-medium text-text-primary"
        >
          Price
        </label>
        <div className="flex items-center gap-1">
          <span className="text-sm text-text-secondary">$</span>
          <input
            id="price-input"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            aria-label="price"
            value={(priceCents / 100).toFixed(2)}
            onChange={(e) =>
              setPriceCents(Math.round((parseFloat(e.target.value) || 0) * 100))
            }
            className="h-10 w-32 rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      </div>

      {/* Category */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-text-primary">
          Category
        </label>
        <select
          value={categoryId ?? ""}
          onChange={(e) => setCategoryId(e.target.value || null)}
          className="h-10 rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">No category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Variants */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-text-primary">
          Variants
        </label>
        <VariantEditor variants={variants} onChange={setVariants} />
      </div>

      {/* Availability */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-text-primary">
          Availability
        </label>
        <AvailabilitySchedule
          schedule={availabilitySchedule}
          onChange={setAvailabilitySchedule}
        />
      </div>

      {/* Image */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="image-input"
          className="text-sm font-medium text-text-primary"
        >
          Image
        </label>
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="rounded-lg border-2 border-dashed border-border p-4 text-center"
        >
          {imagePreview ? (
            <img
              src={imagePreview}
              alt="Preview"
              className="mx-auto max-h-40 rounded-md object-cover"
            />
          ) : (
            <p className="text-sm text-text-tertiary">
              Drag & drop or tap to select
            </p>
          )}
          <input
            key={fileInputKey}
            id="image-input"
            type="file"
            accept="image/*"
            aria-label="image"
            onChange={handleImageChange}
            className="mt-2 block w-full text-sm text-text-secondary file:mr-2 file:rounded file:border-0 file:bg-surface file:px-3 file:py-1 file:text-sm"
          />
        </div>
        {imagePreview && (
          <button
            type="button"
            onClick={handleRemoveImage}
            className="self-start text-sm text-red-500 hover:text-red-600"
          >
            Remove image
          </button>
        )}
      </div>

      {/* Save status */}
      <div className="text-sm min-h-[1.25rem]">
        {saveStatus === "saving" && (
          <span className="text-text-tertiary">Saving…</span>
        )}
        {saveStatus === "saved" && (
          <span className="text-green-600">Saved ✓</span>
        )}
        {saveStatus === "error" && saveError && (
          <p role="alert" className="text-red-500">
            {saveError}
          </p>
        )}
      </div>

      {/* Navigation CTAs — visible in edit mode */}
      {item && (
        <div className="flex gap-4 text-sm border-t border-border pt-4">
          <Link
            href="/admin/menu/new"
            className="text-text-secondary hover:text-accent"
          >
            Add another item →
          </Link>
          <Link
            href="/admin/menu"
            className="text-text-secondary hover:text-accent"
          >
            Back to menu
          </Link>
        </div>
      )}
    </div>
  );
}
