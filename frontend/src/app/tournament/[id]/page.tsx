"use client";

import { useParams } from "next/navigation";
import TournamentRunPage from "@/components/live/TournamentRunPage";

export default function TournamentPage() {
  const params = useParams();
  const id = params.id as string;

  return <TournamentRunPage tournamentId={id} />;
}