import { z } from 'zod';

export const branchSchema = z.object({
  name: z.string().min(1, 'Branch name is required').max(120),
  addressLine: z.string().max(255),
  city: z.string().max(80),
  phone: z.string().max(30),
});

/** Edit adds the one field create cannot set — hence five inputs, hence a page. */
export const editBranchSchema = branchSchema.extend({
  isActive: z.boolean(),
});

export type BranchFormData = z.infer<typeof branchSchema>;
export type EditBranchFormData = z.infer<typeof editBranchSchema>;
