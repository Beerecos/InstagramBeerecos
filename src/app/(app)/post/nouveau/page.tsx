import type { Metadata } from "next";
import PostEditor from "@/components/post/post-editor";

export const metadata: Metadata = { title: "Nouveau post" };

export default function NewPostPage() {
  return <PostEditor id={null} />;
}
