const { z } = require("zod");
const R = require("./connect.rules");

// Request bodies for /api/connect. No `.default()` anywhere: an edit only changes what it sends
// (Zod 4's partial() fills defaults in — see the zod4-partial-update note), the service fills the rest.

const id = z.string().trim().min(1).max(64);
const ids = (max) => z.array(id).max(max);
const text = (max) => z.string().trim().max(max);
const date = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-12-31");

const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Your name needs at least 2 letters").max(30, "Keep your name under 30 letters")
    .regex(/^[\p{L}\p{N} .'_-]+$/u, "Use letters, numbers and spaces in your name").optional(),
  avatar: z.object({ icon: z.string().max(20).optional(), color: z.string().max(12).optional() }).optional(),
  bio: text(300).optional(),
  interests: z.array(z.enum(R.INTEREST_KEYS)).max(8, "Pick up to 8 interests").optional(),
  skills: z.array(z.enum(R.INTEREST_KEYS)).max(6, "Pick up to 6 things you're good at").optional(),
  showCertificates: z.boolean().optional(),
});

const postSchema = z.object({
  body: text(3000).optional(),
  category: z.enum(R.CATEGORY_KEYS).optional(),
  communityId: id.nullable().optional(),
  fileIds: ids(6).optional(),
  link: text(500).optional(),
  projectId: id.nullable().optional(),
  achievement: z.object({ kind: z.enum(["connect_badge", "class_badge", "certificate"]), id: id }).nullable().optional(),
});

const postEditSchema = z.object({
  body: text(3000).optional(),
  category: z.enum(R.CATEGORY_KEYS).optional(),
  link: text(500).optional(),
});

const commentSchema = z.object({ body: z.string().trim().min(1, "Write something first").max(1000), parentCommentId: id.nullable().optional() });
const commentEditSchema = z.object({ body: z.string().trim().min(1).max(1000) });
const reactionSchema = z.object({ kind: z.enum(R.REACTIONS) });
const shareSchema = z.object({ body: text(1000).optional(), communityId: id.nullable().optional() });

const reportSchema = z.object({
  targetType: z.enum(["post", "comment", "message", "member", "project", "update"]),
  targetId: id,
  reason: z.enum(R.REPORT_REASON_KEYS),
  note: text(1000).optional(),
});

const communitySchema = z.object({
  name: z.string().trim().min(3).max(80),
  description: text(1000).optional(),
  icon: text(30).optional(),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  topics: z.array(z.enum(R.INTEREST_KEYS)).max(6).optional(),
  joinMode: z.enum(["open", "approval"]).optional(),
  postingMode: z.enum(["members", "moderators"]).optional(),
});
const moderatorsSchema = z.object({ userIds: ids(20) });
const inviteMembersSchema = z.object({ memberIds: ids(30).min(1) });

const conversationSchema = z.object({ memberIds: ids(9).min(1, "Choose who to chat with"), title: text(60).optional() });
const messageSchema = z.object({ body: text(2000).optional(), fileIds: ids(4).optional() })
  .refine((v) => (v.body && v.body.length) || (v.fileIds && v.fileIds.length), "Write a message first");
const muteSchema = z.object({ muted: z.boolean() });

const projectSchema = z.object({
  title: z.string().trim().min(3, "Give your project a title").max(120),
  description: text(4000).optional(),
  category: z.enum(R.PROJECT_CATEGORY_KEYS).optional(),
  technologies: z.array(z.enum(R.INTEREST_KEYS)).max(6).optional(),
  visibility: z.enum(["team", "community"]).optional(),
  lookingForMembers: z.boolean().optional(),
  coverFileId: id.nullable().optional(),
  demoLink: text(500).optional(),
  status: z.enum(R.PROJECT_STATUSES).optional(),
});
const projectEditSchema = projectSchema.partial();
const projectInviteSchema = z.object({ memberIds: ids(R.PROJECT_TEAM_MAX).min(1, "Choose who to invite") });
const projectMemberSchema = z.object({ responsibility: text(120).optional(), makeOwner: z.boolean().optional() });
const milestoneSchema = z.object({ title: z.string().trim().min(2).max(150), dueOn: date.nullable().optional() });
const milestoneEditSchema = z.object({ title: z.string().trim().min(2).max(150).optional(), dueOn: date.nullable().optional(), done: z.boolean().optional() });
const updateSchema = z.object({ body: z.string().trim().min(2, "Say what's new").max(3000), fileIds: ids(6).optional(), link: text(500).optional() });

const challengeSchema = z.object({
  title: z.string().trim().min(3).max(150),
  description: text(5000).optional(),
  kind: z.enum(R.CHALLENGE_KIND_KEYS).optional(),
  entryMode: z.enum(["individual", "team", "both"]).optional(),
  teamMin: z.number().int().min(2).max(R.PROJECT_TEAM_MAX).nullable().optional(),
  teamMax: z.number().int().min(2).max(R.PROJECT_TEAM_MAX).nullable().optional(),
  startsOn: date.nullable().optional(),
  endsOn: date.nullable().optional(),
  prizes: text(1000).optional(),
  rules: text(4000).optional(),
  communityId: id.nullable().optional(),
  competitionId: id.nullable().optional(),
});
const challengeEditSchema = challengeSchema.partial();
const enterSchema = z.object({ mode: z.enum(["individual", "team"]), projectId: id.nullable().optional() });
const entrySchema = z.object({ title: text(150).optional(), description: text(2000).optional(), fileIds: ids(6).optional(), link: text(500).optional(), submit: z.boolean().optional() });
const awardSchema = z.object({ award: z.enum(R.AWARDS).nullable(), feedback: text(1000).optional() });

const decisionSchema = z.object({
  action: z.enum(["dismiss", "remove", "suspend"]),
  days: z.number().int().min(1).max(90).optional(),
  note: text(1000).optional(),
});
const rejectSchema = z.object({ reason: text(500).optional() });
const removeSchema = z.object({ reason: text(500).optional() });
const suspendSchema = z.object({ days: z.number().int().min(1).max(90), reason: z.string().trim().min(3, "Say why").max(500) });
const recordConsentSchema = z.object({ learnerId: id, note: z.string().trim().min(10, "Say how the parent gave consent (who, when, how)").max(500) });

const consentSchema = z.object({
  agree: z.literal(true, { message: "Tick the box to agree" }),
  directMessages: z.boolean().optional(),
});
const switchesSchema = z.object({ directMessages: z.boolean().optional() });
const withdrawSchema = z.object({ deleteData: z.boolean().optional() });
const parentBlockSchema = z.object({ memberId: id });

const settingsSchema = z.object({
  dmMinAge: z.number().int().min(8).max(18).optional(),
  directMessages: z.boolean().optional(),
  groupChats: z.boolean().optional(),
  messageFiles: z.enum(R.MESSAGE_FILE_MODES).optional(),
  reviewNewMemberPosts: z.number().int().min(0).max(20).optional(),
  reviewFiles: z.boolean().optional(),
  reviewAll: z.boolean().optional(),
  educatorsCreate: z.boolean().optional(),
  moderatorUserIds: ids(50).optional(),
  blockedWords: z.array(z.string().trim().min(2).max(40)).max(300).optional(),
  linkDomains: z.array(z.string().trim().min(3).max(100)).max(100).optional(),
  postsPerHour: z.number().int().min(1).max(100).optional(),
  commentsPerHour: z.number().int().min(1).max(300).optional(),
  messagesPerMinute: z.number().int().min(1).max(120).optional(),
});

module.exports = {
  profileSchema, postSchema, postEditSchema, commentSchema, commentEditSchema, reactionSchema, shareSchema, reportSchema,
  communitySchema, moderatorsSchema, inviteMembersSchema, conversationSchema, messageSchema, muteSchema,
  projectSchema, projectEditSchema, projectInviteSchema, projectMemberSchema, milestoneSchema, milestoneEditSchema, updateSchema,
  challengeSchema, challengeEditSchema, enterSchema, entrySchema, awardSchema,
  decisionSchema, rejectSchema, removeSchema, suspendSchema, recordConsentSchema,
  consentSchema, switchesSchema, withdrawSchema, parentBlockSchema, settingsSchema,
};
