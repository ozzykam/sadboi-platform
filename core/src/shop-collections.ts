import { z } from "zod";
const id = z.string().regex(/^[a-f0-9]{64}$/);
const members = z
  .array(id)
  .max(100)
  .refine(
    (values) => new Set(values).size === values.length,
    "Choose each item only once.",
  );
export const shopCollectionInputSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().max(3000),
    productIds: members,
    artworkIds: members,
    order: z.number().int().min(0).max(999999),
  })
  .strict();
export const shopCollectionCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("save"),
      id: id.nullable(),
      revision: z.number().int().min(0),
      operationId: z.string().uuid(),
      input: shopCollectionInputSchema,
    })
    .strict(),
  z
    .object({
      action: z.enum(["publish", "unpublish", "archive", "restore"]),
      id,
      revision: z.number().int().min(1),
      operationId: z.string().uuid(),
    })
    .strict(),
]);
export type ShopCollectionInput = z.infer<typeof shopCollectionInputSchema>;
export type ShopCollectionRecord = {
  id: string;
  revision: number;
  input: ShopCollectionInput;
  published: boolean;
  publishedRevision: number | null;
  archived: boolean;
  updatedAt: string;
};
export type PublicCollection = ShopCollectionInput & { id: string };
