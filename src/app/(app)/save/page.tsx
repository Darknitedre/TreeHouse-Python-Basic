import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { SavePostForm } from "@/components/save-post-form";

export const dynamic = "force-dynamic";

// Accepts share-target params (?url=&text=&title=) from the PWA share sheet.
export default function SavePage({
  searchParams,
}: {
  searchParams: { url?: string; text?: string };
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Save a post" subtitle="Add content and let AI turn it into action." />
      <Suspense>
        <SavePostForm initial={{ url: searchParams.url, text: searchParams.text }} />
      </Suspense>
    </div>
  );
}
