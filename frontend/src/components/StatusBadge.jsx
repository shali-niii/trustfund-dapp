import React from "react";
import { getCampaignStateMeta, getMilestoneStateMeta } from "../utils/helpers";

export function CampaignStatusBadge({ state }) {
  const meta = getCampaignStateMeta(state);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${meta.color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export function MilestoneStatusBadge({ state }) {
  const meta = getMilestoneStateMeta(state);
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${meta.color}`}
    >
      {meta.label}
    </span>
  );
}
