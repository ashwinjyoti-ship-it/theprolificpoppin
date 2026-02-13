import { defaultEssays } from "@/lib/data";
import EssayClient from "./EssayClient";

export function generateStaticParams() {
  return defaultEssays
    .filter(e => e.published)
    .map(e => ({ slug: e.slug }));
}

export default function EssayPage() {
  return <EssayClient />;
}
