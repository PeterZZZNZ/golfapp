"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Link as LinkIcon, Pencil, FileText, Sparkles } from "lucide-react";
import { saveCourse } from "@/lib/db/repo";
import type { HoleSpec, TeeBox } from "@/lib/types";
import {
  CourseForm,
  draftToCourse,
  emptyDraft,
} from "@/components/CourseForm";
import { ScraperPanel } from "@/components/ScraperPanel";
import { CsvImportPanel } from "@/components/CsvImportPanel";
import { ImageImportPanel } from "@/components/ImageImportPanel";
import { cn } from "@/lib/util";
import { useAuth } from "@/lib/firebase/auth";
import { publishCourse } from "@/lib/firebase/sync";

type Tab = "manual" | "photo" | "url" | "csv";

export default function NewCoursePage() {
  const router = useRouter();
  const auth = useAuth();
  const [tab, setTab] = React.useState<Tab>("manual");
  const [shareToLibrary, setShareToLibrary] = React.useState(true);
  const [publishError, setPublishError] = React.useState<string | null>(null);
  const [prefilled, setPrefilled] = React.useState<{
    name?: string;
    sourceUrl?: string;
    tees?: TeeBox[];
    holes?: HoleSpec[];
  } | null>(null);

  const baseDraft = React.useMemo(() => {
    const d = emptyDraft();
    if (prefilled) {
      if (prefilled.name) d.name = prefilled.name;
      if (prefilled.sourceUrl) d.sourceUrl = prefilled.sourceUrl;
      if (prefilled.tees && prefilled.tees.length) d.tees = prefilled.tees;
      if (prefilled.holes && prefilled.holes.length) d.holes = prefilled.holes;
    }
    return d;
  }, [prefilled]);

  const onSave = async (draft: Parameters<typeof draftToCourse>[0]) => {
    setPublishError(null);
    const course = await saveCourse(draftToCourse(draft));
    let publishFailed = false;
    if (shareToLibrary && auth.status === "authed") {
      await publishCourse({
        course,
        contributorName:
          auth.profile?.displayName ?? auth.user.displayName ?? "Anonymous",
      }).catch((err) => {
        console.error("[publishCourse] Failed:", err);
        setPublishError(
          "Course saved, but publishing to the community library failed. You can try again from the course detail page."
        );
        publishFailed = true;
      });
    }
    if (!publishFailed) {
      router.push(`/courses/${course.id}`);
    }
  };

  const onParsed = (p: {
    name?: string;
    sourceUrl?: string;
    tees?: TeeBox[];
    holes?: HoleSpec[];
  }) => {
    setPrefilled(p);
    setTab("manual");
  };

  return (
    <div className="space-y-5 fade-in">
      <div>
        <div className="h1">Add a course</div>
        <div className="muted text-sm mt-1">
          Fill it in yourself, scan a scorecard photo with AI, paste a scorecard URL, or import CSV.
        </div>
      </div>

      {publishError && (
        <div className="rounded-lg border border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-200 flex items-start gap-2">
          <span className="shrink-0 mt-0.5">⚠️</span>
          <div>
            <span>{publishError}</span>
            <button
              className="ml-2 underline opacity-70 hover:opacity-100"
              onClick={() => router.push("/courses")}
            >
              Go to courses
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="card p-1 inline-flex gap-1 flex-wrap">
          <TabBtn active={tab === "manual"} onClick={() => setTab("manual")}>
            <Pencil size={14} /> Manual
          </TabBtn>
          <TabBtn active={tab === "photo"} onClick={() => setTab("photo")}>
            <Sparkles size={14} /> Scan photo
          </TabBtn>
          <TabBtn active={tab === "url"} onClick={() => setTab("url")}>
            <LinkIcon size={14} /> Import from URL
          </TabBtn>
          <TabBtn active={tab === "csv"} onClick={() => setTab("csv")}>
            <FileText size={14} /> Paste CSV
          </TabBtn>
        </div>

        {auth.status === "authed" ? (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="accent-[var(--accent)]"
              checked={shareToLibrary}
              onChange={(e) => setShareToLibrary(e.target.checked)}
            />
            <span className="text-sm font-medium">Add to community library</span>
          </label>
        ) : null}
      </div>

      {tab === "manual" ? (
        <>
          <CourseForm
            key={prefilled ? "prefilled" : "blank"}
            initialDraft={baseDraft}
            onSave={onSave}
            onCancel={() => router.push("/courses")}
            saveLabel={shareToLibrary ? "Save & publish to library" : "Save course"}
          />
        </>
      ) : tab === "photo" ? (
        <ImageImportPanel onParsed={onParsed} />
      ) : tab === "url" ? (
        <ScraperPanel onParsed={onParsed} />
      ) : (
        <CsvImportPanel onParsed={onParsed} />
      )}
    </div>
  );
}

function TabBtn({
  active,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      className={cn(
        "btn !py-1.5 !px-3 text-sm",
        active ? "btn-primary" : "btn-ghost"
      )}
      {...props}
    >
      {children}
    </button>
  );
}
