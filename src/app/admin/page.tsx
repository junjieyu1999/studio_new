"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Artwork, ArtworkImage, ArtworkStatus } from "@/types/artwork";
import { ImageSlot, type Slot } from "./ImageSlot";

type Tab = "details" | "images";
type Mode = "edit" | "new";

interface FormFields {
  id: string;
  title: string;
  year: string;
  medium: string;
  dimensions: string;
  status: ArtworkStatus;
  theme: "portrait" | "landscape";
  description: string;
  inspiration: string;
  process: string;
  price: string;
  gradient_bg: string;
  sort_order: string;
}

const BLANK: FormFields = {
  id: "",
  title: "",
  year: new Date().getFullYear().toString(),
  medium: "Oil on canvas",
  dimensions: "",
  status: "available",
  theme: "portrait",
  description: "",
  inspiration: "",
  process: "",
  price: "",
  gradient_bg: "linear-gradient(145deg,#C4A87A 0%,#8B6842 60%,#5C3D1E 100%)",
  sort_order: "0",
};

const SLOTS: Slot[] = [
  { key: 0, label: "Cover photo", hint: "Main image shown on the gallery wall" },
  { key: 1, label: "Detail shot 1", hint: "Close-up, texture, or process detail" },
  { key: 2, label: "Detail shot 2", hint: "Second detail or alternate angle" },
];

const inputCls =
  "w-full rounded border border-black/15 bg-[#efece5] px-3 py-2 text-sm text-[#1c1a17] outline-none transition focus:border-[#8b6842]/50";
const labelCls =
  "text-[0.68rem] uppercase tracking-[0.08em] text-[#1c1a17]/50 flex items-baseline gap-2 flex-wrap";

export default function AdminPage() {
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Artwork | null>(null);
  const [images, setImages] = useState<ArtworkImage[]>([]);
  const [tab, setTab] = useState<Tab>("details");
  const [mode, setMode] = useState<Mode>("edit");
  const [form, setForm] = useState<FormFields>(BLANK);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/artworks")
      .then((r) => r.json())
      .then((d) => {
        setArtworks(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected || mode === "new") return;
    fetch(`/api/artworks/${selected.id}/images`)
      .then((r) => r.json())
      .then((d) => setImages(Array.isArray(d) ? d : []))
      .catch(() => setImages([]));
  }, [selected, mode]);

  const selectArtwork = (a: Artwork) => {
    setSelected(a);
    setMode("edit");
    setTab("details");
    setImages([]);
    setMsg("");
    setErr("");
    setForm({
      id: a.id,
      title: a.title,
      year: a.year,
      medium: a.medium,
      dimensions: a.dimensions,
      status: a.status,
      theme: a.theme,
      description: a.description ?? "",
      inspiration: a.inspiration ?? "",
      process: a.process ?? "",
      price: a.price != null ? String(a.price) : "",
      gradient_bg: a.gradient_bg ?? "",
      sort_order: String(a.sort_order ?? 0),
    });
  };

  const startNew = () => {
    setSelected(null);
    setMode("new");
    setTab("details");
    setImages([]);
    setForm(BLANK);
    setMsg("");
    setErr("");
  };

  const setField =
    (k: keyof FormFields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      if (mode === "new") {
        const res = await fetch("/api/artworks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, sort_order: Number(form.sort_order) || 0 }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setArtworks((prev) =>
          [...prev, json.artwork].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        );
        setSelected(json.artwork);
        setMode("edit");
        setTab("images");
        setMsg("Artwork created — you can now add images.");
      } else if (selected) {
        const res = await fetch(`/api/artworks/${selected.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title,
            year: form.year,
            medium: form.medium,
            dimensions: form.dimensions,
            status: form.status,
            theme: form.theme,
            description: form.description,
            inspiration: form.inspiration,
            process: form.process,
            price: form.price,
            gradient_bg: form.gradient_bg,
            sort_order: Number(form.sort_order) || 0,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setArtworks((prev) => prev.map((a) => (a.id === selected.id ? json.artwork : a)));
        setSelected(json.artwork);
        setMsg("Changes saved.");
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 3000);
    }
  };

  const handleDeleteArtwork = async () => {
    if (!selected) return;
    if (!window.confirm(`Delete "${selected.title}" and all its images? This cannot be undone.`))
      return;
    setDeleting(true);
    setErr("");
    try {
      const res = await fetch(`/api/artworks/${selected.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setArtworks((prev) => prev.filter((a) => a.id !== selected.id));
      setSelected(null);
      setMode("edit");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const imageAtSlot = (k: number) => images.find((i) => i.sort_order === k) ?? null;

  const handleSlotUploaded = (img: ArtworkImage) => {
    setImages((prev) => [...prev.filter((i) => i.sort_order !== img.sort_order), img].sort((a, b) => a.sort_order - b.sort_order));
    if (img.sort_order === 0 && selected) {
      setArtworks((prev) => prev.map((a) => (a.id === selected.id ? { ...a, image_url: img.url } : a)));
      setSelected((s) => (s ? { ...s, image_url: img.url } : s));
    }
  };

  const handleSlotDeleted = (k: number) => {
    setImages((prev) => prev.filter((i) => i.sort_order !== k));
    if (k === 0 && selected) {
      setArtworks((prev) => prev.map((a) => (a.id === selected.id ? { ...a, image_url: null } : a)));
      setSelected((s) => (s ? { ...s, image_url: null } : s));
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#f4f1ea] text-[#1c1a17]/60">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#8b6842]/30 border-t-[#8b6842]" />
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  const showPanel = mode === "new" || selected !== null;

  return (
    <div className="grid min-h-dvh grid-cols-1 bg-[#f4f1ea] text-[#1c1a17] md:grid-cols-[280px_1fr]">
      {/* Sidebar */}
      <aside className="flex flex-col border-b border-black/10 md:h-dvh md:sticky md:top-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-4">
          <Link href="/" className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-[#1c1a17]/50 hover:text-[#1c1a17]">
            ← Gallery
          </Link>
          <button
            onClick={startNew}
            className="rounded bg-[#8b6842] px-3 py-1 text-xs font-medium text-white transition hover:opacity-90"
          >
            + New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {artworks.length === 0 && (
            <p className="p-4 text-xs text-[#1c1a17]/45">No artworks yet.</p>
          )}
          {artworks.map((a) => (
            <button
              key={a.id}
              onClick={() => selectArtwork(a)}
              className={`mb-1 flex w-full items-center gap-3 rounded border px-2.5 py-2 text-left transition ${
                selected?.id === a.id && mode === "edit"
                  ? "border-[#8b6842]/30 bg-[#8b6842]/[0.08]"
                  : "border-transparent hover:bg-black/[0.03]"
              }`}
            >
              <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded-sm border border-black/10 bg-[#efece5]">
                {a.image_url ? (
                  <Image src={a.image_url} alt={a.title} fill sizes="40px" className="object-cover" />
                ) : (
                  <div className="h-full w-full" style={{ background: a.gradient_bg ?? "#EDEAE2" }} />
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm">{a.title}</div>
                <div className="text-[0.62rem] text-[#1c1a17]/45">
                  {a.year} · <span className="capitalize">{a.status}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Panel */}
      <main className="flex min-h-dvh flex-col overflow-y-auto">
        {!showPanel ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 text-[#1c1a17]/55">
            <p className="text-sm">Select an artwork or create a new one</p>
            <button
              onClick={startNew}
              className="rounded bg-[#8b6842] px-6 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
            >
              + Add new artwork
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between gap-4 border-b border-black/10 px-6 py-5">
              <div>
                <h1 className="font-serif text-2xl font-light">
                  {mode === "new" ? "New artwork" : form.title || "Untitled"}
                </h1>
                {mode === "edit" && selected && (
                  <span className="font-mono text-[0.6rem] text-[#1c1a17]/45">/{selected.id}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {msg && <span className="text-xs text-[#8b6842]">{msg}</span>}
                {err && <span className="text-xs text-red-700">{err}</span>}
                {mode === "edit" && selected && (
                  <button
                    onClick={handleDeleteArtwork}
                    disabled={deleting}
                    className="rounded border border-red-700/25 px-3 py-2 text-xs text-red-700 transition hover:bg-red-700/[0.05] disabled:opacity-40"
                  >
                    {deleting ? "Deleting…" : "Delete"}
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="whitespace-nowrap rounded bg-[#8b6842] px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-45"
                >
                  {saving ? "Saving…" : mode === "new" ? "Create artwork →" : "Save changes"}
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-7 border-b border-black/10 px-6">
              <button
                onClick={() => setTab("details")}
                className={`-mb-px border-b-2 py-3 text-sm transition ${
                  tab === "details" ? "border-[#8b6842] text-[#1c1a17]" : "border-transparent text-[#1c1a17]/50 hover:text-[#1c1a17]"
                }`}
              >
                Details
              </button>
              <button
                onClick={() => mode !== "new" && setTab("images")}
                disabled={mode === "new"}
                className={`-mb-px border-b-2 py-3 text-sm transition ${
                  tab === "images" ? "border-[#8b6842] text-[#1c1a17]" : "border-transparent text-[#1c1a17]/50 hover:text-[#1c1a17]"
                } ${mode === "new" ? "cursor-not-allowed opacity-40" : ""}`}
                title={mode === "new" ? "Save the artwork first to unlock images" : undefined}
              >
                Images{" "}
                {mode !== "new" && images.length > 0 && (
                  <span className="ml-1 rounded-full bg-[#8b6842]/15 px-1.5 text-[0.6rem] text-[#8b6842]">{images.length}</span>
                )}
                {mode === "new" && <span className="ml-1 text-[0.62rem] italic opacity-60">— save first</span>}
              </button>
            </div>

            {/* Details tab */}
            {tab === "details" && (
              <div className="flex max-w-3xl flex-col gap-8 px-6 py-6 pb-16">
                <section className="flex flex-col gap-3">
                  <div className="border-b border-black/10 pb-2 font-mono text-[0.58rem] uppercase tracking-[0.2em] text-[#8b6842]">
                    Identity
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label className={labelCls}>
                        ID / slug <span className="text-[#8b6842]">*</span>
                        <span className="text-[0.62rem] normal-case tracking-normal text-[#1c1a17]/40">
                          {mode === "edit" ? "Read-only after creation" : 'e.g. "warm-light-2024" — becomes the URL'}
                        </span>
                      </label>
                      <input
                        type="text"
                        value={form.id}
                        onChange={setField("id")}
                        placeholder="warm-light-2024"
                        readOnly={mode === "edit"}
                        className={`${inputCls} ${mode === "edit" ? "cursor-not-allowed opacity-55" : ""}`}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className={labelCls}>
                        Title <span className="text-[#8b6842]">*</span>
                      </label>
                      <input type="text" value={form.title} onChange={setField("title")} placeholder="Study in Warm Light" className={inputCls} />
                    </div>
                  </div>
                </section>

                <section className="flex flex-col gap-3">
                  <div className="border-b border-black/10 pb-2 font-mono text-[0.58rem] uppercase tracking-[0.2em] text-[#8b6842]">
                    Artwork details
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="flex flex-col gap-1">
                      <label className={labelCls}>Year <span className="text-[#8b6842]">*</span></label>
                      <input type="text" value={form.year} onChange={setField("year")} placeholder="2024" className={inputCls} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className={labelCls}>Medium <span className="text-[#8b6842]">*</span></label>
                      <input type="text" value={form.medium} onChange={setField("medium")} placeholder="Oil on canvas" className={inputCls} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className={labelCls}>Dimensions <span className="text-[#8b6842]">*</span></label>
                      <input type="text" value={form.dimensions} onChange={setField("dimensions")} placeholder="60×80cm" className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="flex flex-col gap-1">
                      <label className={labelCls}>Status</label>
                      <select value={form.status} onChange={setField("status")} className={inputCls}>
                        <option value="available">Available</option>
                        <option value="in-progress">In Progress</option>
                        <option value="sold">Sold</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className={labelCls}>Theme</label>
                      <select value={form.theme} onChange={setField("theme")} className={inputCls}>
                        <option value="portrait">Portrait</option>
                        <option value="landscape">Landscape</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className={labelCls}>
                        Sort order
                        <span className="text-[0.62rem] normal-case tracking-normal text-[#1c1a17]/40">Lower = earlier</span>
                      </label>
                      <input type="number" value={form.sort_order} onChange={setField("sort_order")} min="0" className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="flex flex-col gap-1">
                      <label className={labelCls}>
                        Price (SGD)
                        <span className="text-[0.62rem] normal-case tracking-normal text-[#1c1a17]/40">
                          Blank = &ldquo;Price on request&rdquo;
                        </span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={form.price}
                        onChange={setField("price")}
                        placeholder="1200"
                        className={inputCls}
                      />
                    </div>
                  </div>
                </section>

                <section className="flex flex-col gap-3">
                  <div className="border-b border-black/10 pb-2 font-mono text-[0.58rem] uppercase tracking-[0.2em] text-[#8b6842]">
                    Written content
                  </div>
                  {(
                    [
                      ["description", "About this piece", "Shown on the artwork detail page"],
                      ["inspiration", "Inspiration", "What prompted or influenced the work"],
                      ["process", "Process", "How this painting was made"],
                    ] as [keyof FormFields, string, string][]
                  ).map(([key, label, hint]) => (
                    <div key={key} className="flex flex-col gap-1">
                      <label className={labelCls}>
                        {label}
                        <span className="text-[0.62rem] normal-case tracking-normal text-[#1c1a17]/40">{hint}</span>
                      </label>
                      <textarea rows={4} value={form[key]} onChange={setField(key)} className={`${inputCls} resize-y`} />
                    </div>
                  ))}
                </section>

                <section className="flex flex-col gap-3">
                  <div className="border-b border-black/10 pb-2 font-mono text-[0.58rem] uppercase tracking-[0.2em] text-[#8b6842]">
                    Appearance
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={labelCls}>
                      Placeholder gradient
                      <span className="text-[0.62rem] normal-case tracking-normal text-[#1c1a17]/40">
                        CSS gradient shown while the image loads or if none is uploaded
                      </span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input type="text" value={form.gradient_bg} onChange={setField("gradient_bg")} className={inputCls} />
                      {form.gradient_bg && (
                        <div className="h-9 w-9 shrink-0 rounded border border-black/10" style={{ background: form.gradient_bg }} />
                      )}
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* Images tab */}
            {tab === "images" && selected && (
              <div className="px-6 py-6 pb-16">
                <p className="mb-6 max-w-lg text-sm leading-relaxed text-[#1c1a17]/55">
                  Upload up to 3 images. The <strong className="font-medium text-[#1c1a17]">Cover photo</strong> hangs on the
                  gallery wall; all three appear on the artwork detail page.
                </p>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                  {SLOTS.map((slot) => (
                    <ImageSlot
                      key={slot.key}
                      slot={slot}
                      image={imageAtSlot(slot.key)}
                      artworkId={selected.id}
                      onUploaded={handleSlotUploaded}
                      onDeleted={() => handleSlotDeleted(slot.key)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
