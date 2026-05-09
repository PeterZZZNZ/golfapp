"use client";

import * as React from "react";
import {
  X,
  Search,
  Globe,
  BookOpen,
  Download,
  Loader2,
  CheckCircle2,
  MapPin,
  Flag,
} from "lucide-react";
import type { Course } from "@/lib/types";
import { saveCourse } from "@/lib/db/repo";
import {
  searchPublicCourses,
  importPublicCourse,
  type PublicCourse,
} from "@/lib/firebase/sync";
import { useAuth } from "@/lib/firebase/auth";
import { cn } from "@/lib/util";

type Tab = "local" | "community";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with the final local Course object after selection (or import+select). */
  onSelect: (course: Course) => void;
  localCourses: Course[];
}

export function CoursePickerModal({
  open,
  onClose,
  onSelect,
  localCourses,
}: Props) {
  const auth = useAuth();
  const isAuthed = auth.status === "authed";

  const [tab, setTab] = React.useState<Tab>("local");
  const [query, setQuery] = React.useState("");
  const [allPublic, setAllPublic] = React.useState<PublicCourse[]>([]);
  const [fetchingPublic, setFetchingPublic] = React.useState(false);
  const [importingId, setImportingId] = React.useState<string | null>(null);
  const [justImportedId, setJustImportedId] = React.useState<string | null>(null);
  const fetchedRef = React.useRef(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Fetch all public courses once when modal first opens
  React.useEffect(() => {
    if (!open || !isAuthed || fetchedRef.current) return;
    fetchedRef.current = true;
    setFetchingPublic(true);
    searchPublicCourses({ maxResults: 200 })
      .then(setAllPublic)
      .catch(() => {})
      .finally(() => setFetchingPublic(false));
  }, [open, isAuthed]);

  // Reset state when modal closes
  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setTab("local");
      setJustImportedId(null);
      fetchedRef.current = false;
    }
  }, [open]);

  // Trap focus in modal on open
  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Close on Escape key
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const lower = query.trim().toLowerCase();

  const filteredLocal = React.useMemo(
    () =>
      lower
        ? localCourses.filter(
            (c) =>
              c.name.toLowerCase().includes(lower) ||
              (c.location ?? "").toLowerCase().includes(lower)
          )
        : localCourses,
    [localCourses, lower]
  );

  const filteredPublic = React.useMemo(
    () =>
      lower
        ? allPublic.filter(
            (c) =>
              c.name.toLowerCase().includes(lower) ||
              (c.location ?? "").toLowerCase().includes(lower)
          )
        : allPublic,
    [allPublic, lower]
  );

  const handleSelect = (course: Course) => {
    onSelect(course);
    onClose();
  };

  const handleImportAndSelect = async (pub: PublicCourse) => {
    if (importingId) return;
    setImportingId(pub.id);
    try {
      const course = await importPublicCourse(pub, (data) => saveCourse(data));
      setJustImportedId(pub.id);
      await new Promise((r) => setTimeout(r, 450)); // brief "Done!" flash
      onSelect(course);
      onClose();
    } catch (err) {
      console.error("[CoursePickerModal] import failed:", err);
    } finally {
      setImportingId(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet / dialog */}
      <div
        className="relative z-10 bg-[var(--surface)] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg flex flex-col"
        style={{ maxHeight: "min(88vh, 620px)" }}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-2.5 sm:hidden shrink-0">
          <div className="w-9 h-1 rounded-full bg-[var(--border)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
          <span className="font-semibold">Select course</span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg muted hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-4 py-2.5 border-b border-[var(--border)] shrink-0">
          <div className="relative">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 muted pointer-events-none"
            />
            <input
              ref={inputRef}
              className="input pl-8 w-full text-sm"
              placeholder="Search by name or location…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Tabs — only shown when signed in */}
        {isAuthed && (
          <div className="flex shrink-0 border-b border-[var(--border)]">
            <TabButton active={tab === "local"} onClick={() => setTab("local")}>
              <BookOpen size={13} />
              My library
              <Count>{localCourses.length}</Count>
            </TabButton>
            <TabButton
              active={tab === "community"}
              onClick={() => setTab("community")}
            >
              <Globe size={13} />
              Community
              {allPublic.length > 0 && <Count>{allPublic.length}</Count>}
            </TabButton>
          </div>
        )}

        {/* Course list */}
        <div className="flex-1 overflow-y-auto">
          {tab === "local" || !isAuthed ? (
            /* ── My library ── */
            filteredLocal.length === 0 ? (
              <EmptyMsg>
                {localCourses.length === 0
                  ? isAuthed
                    ? "No courses in your library yet — switch to Community to browse public courses."
                    : "No courses yet. Add one from the Courses page first."
                  : "No courses match your search."}
              </EmptyMsg>
            ) : (
              <ul className="p-2 space-y-0.5">
                {filteredLocal.map((c) => (
                  <li key={c.id}>
                    <button
                      className="w-full text-left px-3 py-3 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
                      onClick={() => handleSelect(c)}
                    >
                      <div className="font-medium text-sm">{c.name}</div>
                      <div className="flex flex-wrap gap-x-2 gap-y-0 muted text-xs mt-0.5">
                        {c.location && (
                          <span className="inline-flex items-center gap-0.5">
                            <MapPin size={10} /> {c.location}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-0.5">
                          <Flag size={10} /> {c.holes.length} holes
                        </span>
                        <span>{c.tees.length} tee{c.tees.length !== 1 ? "s" : ""}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : /* ── Community library ── */
          fetchingPublic ? (
            <div className="flex items-center justify-center gap-2 py-14 muted text-sm">
              <Loader2 size={16} className="animate-spin" />
              Loading community courses…
            </div>
          ) : filteredPublic.length === 0 ? (
            <EmptyMsg>
              {allPublic.length === 0
                ? "No community courses published yet."
                : "No community courses match your search."}
            </EmptyMsg>
          ) : (
            <ul className="p-2 space-y-0.5">
              {filteredPublic.map((c) => {
                const isImporting = importingId === c.id;
                const isDone = justImportedId === c.id;
                return (
                  <li
                    key={c.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-lg transition-colors",
                      isDone
                        ? "bg-[var(--surface-2)]"
                        : "hover:bg-[var(--surface-2)]"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{c.name}</div>
                      <div className="flex flex-wrap gap-x-2 muted text-xs mt-0.5">
                        {c.location && (
                          <span className="inline-flex items-center gap-0.5">
                            <MapPin size={10} /> {c.location}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-0.5">
                          <Flag size={10} /> {c.holes.length} holes
                        </span>
                        <span>by {c.contributorName}</span>
                        {!!c.importCount && (
                          <span>{c.importCount} import{c.importCount !== 1 ? "s" : ""}</span>
                        )}
                      </div>
                    </div>

                    <button
                      className={cn(
                        "btn btn-secondary !py-1.5 !px-3 text-xs shrink-0 inline-flex items-center gap-1.5",
                        (isImporting || (!!importingId && !isImporting)) &&
                          "opacity-50 cursor-not-allowed"
                      )}
                      disabled={!!importingId}
                      onClick={() => handleImportAndSelect(c)}
                    >
                      {isDone ? (
                        <CheckCircle2 size={12} className="text-green-500" />
                      ) : isImporting ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Download size={12} />
                      )}
                      {isDone
                        ? "Done!"
                        : isImporting
                        ? "Importing…"
                        : "Import & select"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 py-2.5 text-sm inline-flex items-center justify-center gap-1.5 transition-colors border-b-2 font-medium",
        active
          ? "border-[var(--accent)] text-[var(--accent)]"
          : "border-transparent muted hover:text-[var(--text)]"
      )}
    >
      {children}
    </button>
  );
}

function Count({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] opacity-60 font-normal">({children})</span>
  );
}

function EmptyMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-14 text-center muted text-sm px-6 leading-relaxed">
      {children}
    </div>
  );
}
