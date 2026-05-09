"use client";

import * as React from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Map as MapIcon, ArrowRight, Globe, Search, Download } from "lucide-react";
import { listCourses, saveCourse } from "@/lib/db/repo";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { sum } from "@/lib/util";
import { useAuth } from "@/lib/firebase/auth";
import {
  importPublicCourse,
  searchPublicCourses,
  type PublicCourse,
} from "@/lib/firebase/sync";

type Tab = "mine" | "library";

export default function CoursesPage() {
  const [tab, setTab] = React.useState<Tab>("mine");
  const courses = useLiveQuery(() => listCourses(), [], undefined);

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="h1">Courses</div>
          <div className="muted text-sm mt-1">
            Your library and the community database.
          </div>
        </div>
        <Link href="/courses/new" className="btn btn-primary">
          <Plus size={16} /> Add course
        </Link>
      </div>

      {/* Tab switcher */}
      <div className="card p-1 inline-flex gap-1">
        <TabBtn active={tab === "mine"} onClick={() => setTab("mine")}>
          <MapIcon size={14} /> My courses
          {courses && courses.length > 0 ? (
            <span className="badge badge-muted ml-1">{courses.length}</span>
          ) : null}
        </TabBtn>
        <TabBtn active={tab === "library"} onClick={() => setTab("library")}>
          <Globe size={14} /> Community library
        </TabBtn>
      </div>

      {tab === "mine" ? (
        <MyCourses courses={courses} />
      ) : (
        <LibraryTab />
      )}
    </div>
  );
}

function MyCourses({
  courses,
}: {
  courses: import("@/lib/types").Course[] | undefined;
}) {
  if (courses === undefined) return <div className="muted">Loading…</div>;
  if (courses.length === 0) {
    return (
      <EmptyState
        icon={<MapIcon size={36} />}
        title="No courses yet"
        description="Add a course manually, scan a scorecard photo, or browse the community library."
        action={
          <div className="flex gap-2">
            <Link href="/courses/new" className="btn btn-primary">
              Add a course
            </Link>
          </div>
        }
      />
    );
  }
  return (
    <Card>
      <div className="hscroll">
        <table className="table">
          <thead>
            <tr>
              <th>Course</th>
              <th>Location</th>
              <th className="text-right">Holes</th>
              <th className="text-right">Par</th>
              <th className="text-right">Tees</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => {
              const totalPar = sum(c.holes.map((h) => h.par));
              return (
                <tr key={c.id}>
                  <td>
                    <Link href={`/courses/${c.id}`} className="link">
                      {c.name}
                    </Link>
                  </td>
                  <td className="muted">{c.location ?? "—"}</td>
                  <td className="text-right num">{c.holes.length}</td>
                  <td className="text-right num">{totalPar}</td>
                  <td className="text-right num">{c.tees.length}</td>
                  <td className="text-right">
                    <Link
                      href={`/courses/${c.id}`}
                      className="link inline-flex items-center gap-1 text-sm"
                    >
                      Open <ArrowRight size={14} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function LibraryTab() {
  const auth = useAuth();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<PublicCourse[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [importing, setImporting] = React.useState<string | null>(null);
  const [importedIds, setImportedIds] = React.useState<Set<string>>(new Set());

  // Load all on mount; re-search when query changes (debounced).
  React.useEffect(() => {
    if (auth.status !== "authed") return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const list = await searchPublicCourses({ q: query });
        if (!cancelled) setResults(list);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, auth.status]);

  if (auth.status === "anon") {
    return (
      <Card>
        <CardHeader
          title="Sign in to browse the library"
          subtitle="The community course library is available to all signed-in users."
        />
        <Link href="/auth" className="btn btn-primary">
          Sign in
        </Link>
      </Card>
    );
  }

  async function doImport(course: PublicCourse) {
    setImporting(course.id);
    try {
      await importPublicCourse(course, saveCourse);
      setImportedIds((s) => new Set([...s, course.id]));
    } catch {
      // ignore — user can retry
    } finally {
      setImporting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 muted pointer-events-none"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by course name or location…"
          className="!pl-9"
        />
      </div>

      {auth.status === "loading" || loading ? (
        <div className="muted text-sm">Loading…</div>
      ) : results === null ? null : results.length === 0 ? (
        <EmptyState
          icon={<Globe size={36} />}
          title={query ? "No courses found" : "No public courses yet"}
          description={
            query
              ? "Try a different search term."
              : "Be the first to add a course to the community library! Save a course and hit Publish."
          }
        />
      ) : (
        <Card>
          <div className="hscroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Location</th>
                  <th className="text-right">Holes</th>
                  <th className="text-right">Par</th>
                  <th className="text-right">Tees</th>
                  <th>Added by</th>
                  <th className="text-right">Imports</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {results.map((c) => {
                  const totalPar = sum(c.holes.map((h) => h.par));
                  const alreadyImported = importedIds.has(c.id);
                  const busy = importing === c.id;
                  return (
                    <tr key={c.id}>
                      <td className="font-medium">{c.name}</td>
                      <td className="muted">{c.location ?? "—"}</td>
                      <td className="text-right num">{c.holes.length}</td>
                      <td className="text-right num">{totalPar}</td>
                      <td className="text-right num">{c.tees.length}</td>
                      <td className="muted text-sm">{c.contributorName}</td>
                      <td className="text-right num muted text-sm">
                        {c.importCount ?? 0}
                      </td>
                      <td className="text-right">
                        {alreadyImported ? (
                          <span className="badge">
                            <Download size={12} /> Imported
                          </span>
                        ) : (
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() => doImport(c)}
                            className="!py-1 !px-2.5 text-sm"
                          >
                            {busy ? "…" : (
                              <>
                                <Download size={13} /> Import
                              </>
                            )}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="muted text-xs mt-2">
            {results.length} course{results.length === 1 ? "" : "s"} in the
            library{query ? ` matching "${query}"` : ""}.
          </div>
        </Card>
      )}
    </div>
  );
}

function TabBtn({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn !py-1.5 !px-3 text-sm inline-flex items-center gap-1.5 ${
        active ? "btn-primary" : "btn-ghost"
      }`}
    >
      {children}
    </button>
  );
}
