"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft } from "lucide-react";
import { getCourse, saveCourse } from "@/lib/db/repo";
import {
  CourseForm,
  draftFromCourse,
  draftToCourse,
} from "@/components/CourseForm";

export default function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = React.use(params);
  const course = useLiveQuery(() => getCourse(id), [id], undefined);

  if (course === undefined) return <div className="muted">Loading…</div>;
  if (!course) return <div className="muted">Course not found.</div>;

  return (
    <div className="space-y-5 fade-in">
      <div>
        <Link href={`/courses/${course.id}`} className="link inline-flex items-center gap-1 text-sm">
          <ArrowLeft size={14} /> {course.name}
        </Link>
        <div className="h1 mt-1">Edit course</div>
      </div>

      <CourseForm
        initialDraft={draftFromCourse(course)}
        onSave={async (draft) => {
          const patch = draftToCourse(draft);
          await saveCourse({
            ...patch,
            id: course.id,
            createdAt: course.createdAt,
          });
          router.push(`/courses/${course.id}`);
        }}
        onCancel={() => router.push(`/courses/${course.id}`)}
        saveLabel="Save changes"
      />
    </div>
  );
}
