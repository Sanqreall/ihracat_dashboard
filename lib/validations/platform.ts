import { z } from 'zod';

export const platformSchema = z.object({
  name: z.string().min(1, 'Platform adı zorunlu'),
  slug: z.string().min(1, 'Slug zorunlu').regex(/^[a-z0-9-]+$/, 'Sadece küçük harf, rakam ve tire'),
  commission_rate: z.coerce.number().min(0).max(100).default(0),
  is_active: z.boolean().default(true),
});

export type PlatformInput = z.infer<typeof platformSchema>;
