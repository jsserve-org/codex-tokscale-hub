import type { Metadata } from "next";
import MergeClient from "./MergeClient";

export const metadata: Metadata = {
  title: "Merge Proxy - Tokscale",
  description: "Inspect and manage local multi-device merge submissions",
};

export default function MergePage() {
  return <MergeClient />;
}
