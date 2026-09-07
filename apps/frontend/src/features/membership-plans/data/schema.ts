import { z } from 'zod';

export const planSchema = z.object({
  name: z.string().min(1, 'Plan name is required').max(120),
  description: z.string().max(500),
  /**
   * `z.number()`, not `z.coerce.number()`: coercion widens the schema's *input*
   * type to `unknown`, and TanStack Form's `StandardSchemaV1` check then
   * rejects it against the form's `number` field. `FormTextField type="number"`
   * already stores a number — and writes 0 when the box is cleared, which is
   * what `min(1)` is really catching.
   */
  durationDays: z.number().int().min(1, 'Must be at least a day'),
  /**
   * Validated as a string and sent as a string — the same shape the API stores
   * and returns. Parsing it to a number here to "check" it would mean parsing
   * a decimal and re-serialising it, which is exactly what `numeric(12,2)`
   * exists to avoid.
   */
  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Use a number like 1500 or 1500.00'),
  /**
   * The joining fee, charged once on a member's very first sale. Same decimal
   * string as `price` and sent the same way — but optional, so the empty box is
   * allowed and means the plan carries no fee. It is normalised to `'0'` on
   * submit rather than left as `''`, which the API's pattern rejects.
   */
  registrationFee: z
    .string()
    .regex(
      /^(\d+(\.\d{1,2})?)?$/,
      'Use a number like 900 or 900.00, or leave it empty',
    ),
});

/** Edit adds the one field create cannot set — hence five inputs, hence a page. */
export const editPlanSchema = planSchema.extend({
  isActive: z.boolean(),
});

export type PlanFormData = z.infer<typeof planSchema>;
export type EditPlanFormData = z.infer<typeof editPlanSchema>;
