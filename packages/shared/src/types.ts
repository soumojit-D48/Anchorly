export const CheckNames = ['TESTS', 'SIZE', 'STYLE', 'DESCRIPTION'] as const;
export type CheckName = (typeof CheckNames)[number];

export const BadgeTypes = ['FIRST_PR', 'TEN_PRS', 'FIFTY_PRS', 'MOST_IMPROVED'] as const;
export type BadgeType = (typeof BadgeTypes)[number];

export const ReactionTypes = ['THUMBS_UP', 'THUMBS_DOWN'] as const;
export type ReactionType = (typeof ReactionTypes)[number];
