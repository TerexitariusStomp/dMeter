import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get the role for a user. Returns "free" if no role row exists.
 * Internal only -- exposed to clients via the authenticated /api/user-role HTTP action.
 */
export const getUserRole = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("userRoles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    return { role: row?.role ?? "free" };
  },
});

/**
 * Set (upsert) the role for a user. Admin-only in practice --
 * called from Convex dashboard or admin scripts, not from the client.
 * Using internalMutation so it cannot be called from any client SDK.
 */
export const setUserRole = internalMutation({
  args: {
    userId: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userRoles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { role: args.role });
    } else {
      await ctx.db.insert("userRoles", {
        userId: args.userId,
        role: args.role,
      });
    }
    return { success: true };
  },
});
