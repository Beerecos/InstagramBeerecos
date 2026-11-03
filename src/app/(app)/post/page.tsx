import type { Metadata } from "next";
import PostHub from "@/components/post/post-hub";

export const metadata: Metadata = { title: "Post" };

export default function PostPage() {
  return <PostHub />;
}
