import type { VisibilityProject } from "@/lib/visibility/types";

/** Browser-safe state transition for the two mandatory human approval gates. */
export function applyProjectApprovals(
  project: VisibilityProject,
  input: { brandCard?: boolean; topicIds?: string[] },
): VisibilityProject {
  const now = new Date().toISOString();
  const brandCard = input.brandCard
    ? { ...project.brandCard, approvalStatus: "approved" as const, approvedAt: now }
    : project.brandCard;
  const includedTopicIds = input.topicIds ? new Set(input.topicIds) : null;
  const topics = includedTopicIds
    ? project.topics.map((topic) => ({ ...topic, included: includedTopicIds.has(topic.id) }))
    : project.topics;
  const topicsApproved = Boolean(input.topicIds);
  const brandApproved = brandCard.approvalStatus === "approved";

  return {
    ...project,
    brandCard,
    topics,
    state:
      brandApproved && topicsApproved
        ? "ready_to_benchmark"
        : brandApproved
          ? "awaiting_topic_approval"
          : "awaiting_brand_approval",
    updatedAt: now,
  };
}
