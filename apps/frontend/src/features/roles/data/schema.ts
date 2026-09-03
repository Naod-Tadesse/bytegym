import { z } from 'zod';

export const roleSchema = z.object({
  name: z.string().min(1, 'Role name is required').max(255),
  description: z.string().max(500),
});

/** Edit adds `isActive` — three inputs, still comfortably a dialog. */
export const editRoleSchema = roleSchema.extend({
  isActive: z.boolean(),
});

export type RoleFormData = z.infer<typeof roleSchema>;
export type EditRoleFormData = z.infer<typeof editRoleSchema>;
