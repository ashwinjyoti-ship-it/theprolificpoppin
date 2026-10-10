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
