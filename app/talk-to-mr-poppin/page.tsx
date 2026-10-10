import type { Metadata } from "next";
import { readerAuthProviders } from "@/auth";
import { isAiConfigured } from "@/lib/ai-config";
import ReaderSessionProvider from "./ReaderSessionProvider";
import TalkToMrPoppinClient from "./TalkToMrPoppinClient";

const starters = [
  "What do the essays say about noticing tension in the body?",
  "How do awareness and habit show up across the archive?",
  "Where do the essays look at desire without moralizing it?",
  "What is the knot, in the sense of The Mechanics of the Knots?",
];

const OG_IMAGE = "/mr-poppin/mr-poppin-full-1024.png";

export const metadata: Metadata = {
  title: "Talk to Mr. Poppin — theprolificpoppin",
  description:
    "Ask Mr. Poppin about something you've noticed in yourself. A quiet companion grounded in the essay archive.",
  openGraph: {
    title: "Talk to Mr. Poppin",
    description: "A quiet companion who has read the essays closely.",
    images: [
      {
        url: OG_IMAGE,
        width: 1024,
        height: 1024,
        alt: "Mr. Poppin, sipping chai on a stack of books",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Talk to Mr. Poppin",
    description: "A quiet companion who has read the essays closely.",
    images: [OG_IMAGE],
  },
};

export default function TalkToMrPoppinPage() {
  const configured = isAiConfigured();
  const providers = readerAuthProviders();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
      <ReaderSessionProvider>
        <TalkToMrPoppinClient starters={starters} configured={configured} initialProviders={providers} />
      </ReaderSessionProvider>
    </div>
  );
}
