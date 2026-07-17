import type { Metadata } from "next";
import { VoidforgeGame } from "./game/VoidforgeGame";

export const metadata: Metadata = {
  title: "VOIDFORGE — The Dread Engine Awaits",
  description:
    "Mine Flux Shards, outrun the Fabricators, and destroy the Dread Engine in a modern high-resolution arcade odyssey.",
};

export default function Home() {
  return <VoidforgeGame />;
}
