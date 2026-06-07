import EssayClient from "./EssayClient";
import { getEssayBySlug, getPublishedEssays } from "@/lib/server-data";
import type { Essay } from "@/lib/data";

type Props = {
  params: { slug: string };
};

export async function generateStaticParams() {
  const essays = await getPublishedEssays();
  return essays.map(essay => ({ slug: essay.slug }));
}

export default async function EssayPage({ params }: Props) {
  const { slug } = params;
  const essay = await getEssayBySlug(slug);

  if (!essay) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <h1 className="font-serif text-3xl mb-4">Essay not found</h1>
        <a href="/essays" className="text-accent hover:underline">Back to essays</a>
      </div>
    );
  }

  const all = await getPublishedEssays();
  const idx = all.findIndex(item => item.id === essay.id);
  const adjacent = {
    prev: idx > 0 ? all[idx - 1] : undefined,
    next: idx >= 0 && idx < all.length - 1 ? all[idx + 1] : undefined,
  } as { prev?: Essay; next?: Essay };

  return <EssayClient essay={essay} adjacent={adjacent} />;
}
