import type { Metadata } from "next";
import ScriptEditor from "@/components/reels/script-editor";

export const metadata: Metadata = { title: "Nouveau script" };

export default function NewScriptPage() {
  return <ScriptEditor />;
}
