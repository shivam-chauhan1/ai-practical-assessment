import { listTicketsQuerySchema } from '../src/schemas/ticketSchemas';

describe('listTicketsQuerySchema', () => {
  describe('empty input', () => {
    it('should parse an empty object successfully (all fields optional)', () => {
      const result = listTicketsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should not apply default values at schema level', () => {
      const result = listTicketsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBeUndefined();
        expect(result.data.pageSize).toBeUndefined();
        expect(result.data.sortBy).toBeUndefined();
        expect(result.data.sortOrder).toBeUndefined();
      }
    });
  });

  describe('priority (case-insensitive)', () => {
    it('should accept uppercase priority values', () => {
      const result = listTicketsQuerySchema.safeParse({ priority: 'HIGH' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priority).toBe('HIGH');
      }
    });

    it('should transform lowercase "high" to "HIGH"', () => {
      const result = listTicketsQuerySchema.safeParse({ priority: 'high' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priority).toBe('HIGH');
      }
    });

    it('should transform mixed case "Medium" to "MEDIUM"', () => {
      const result = listTicketsQuerySchema.safeParse({ priority: 'Medium' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priority).toBe('MEDIUM');
      }
    });

    it('should accept all valid priority values case-insensitively', () => {
      for (const val of ['low', 'medium', 'high', 'urgent']) {
        const result = listTicketsQuerySchema.safeParse({ priority: val });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.priority).toBe(val.toUpperCase());
        }
      }
    });

    it('should reject invalid priority values', () => {
      const result = listTicketsQuerySchema.safeParse({ priority: 'CRITICAL' });
      expect(result.success).toBe(false);
    });
  });

  describe('assignedTo', () => {
    it('should accept the literal "unassigned"', () => {
      const result = listTicketsQuerySchema.safeParse({ assignedTo: 'unassigned' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.assignedTo).toBe('unassigned');
      }
    });

    it('should accept a valid UUID v4 string', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const result = listTicketsQuerySchema.safeParse({ assignedTo: uuid });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.assignedTo).toBe(uuid);
      }
    });

    it('should reject an invalid UUID for assignedTo', () => {
      const result = listTicketsQuerySchema.safeParse({ assignedTo: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });

    it('should reject "Unassigned" (case-sensitive literal)', () => {
      const result = listTicketsQuerySchema.safeParse({ assignedTo: 'Unassigned' });
      expect(result.success).toBe(false);
    });

    it('should reject an empty string for assignedTo', () => {
      const result = listTicketsQuerySchema.safeParse({ assignedTo: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('page/pageSize string-to-integer coercion', () => {
    it('should transform valid numeric strings to integers', () => {
      const result = listTicketsQuerySchema.safeParse({ page: '2', pageSize: '50' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.pageSize).toBe(50);
      }
    });

    it('should reject non-integer strings for page', () => {
      const result = listTicketsQuerySchema.safeParse({ page: 'abc' });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer strings for pageSize', () => {
      const result = listTicketsQuerySchema.safeParse({ pageSize: 'xyz' });
      expect(result.success).toBe(false);
    });

    it('should reject decimal strings for page', () => {
      const result = listTicketsQuerySchema.safeParse({ page: '1.5' });
      expect(result.success).toBe(false);
    });

    it('should reject decimal strings for pageSize', () => {
      const result = listTicketsQuerySchema.safeParse({ pageSize: '2.7' });
      expect(result.success).toBe(false);
    });
  });

  describe('pageSize boundaries', () => {
    it('should reject pageSize of "0" (below minimum)', () => {
      const result = listTicketsQuerySchema.safeParse({ pageSize: '0' });
      expect(result.success).toBe(false);
    });

    it('should accept pageSize of "1" (minimum valid)', () => {
      const result = listTicketsQuerySchema.safeParse({ pageSize: '1' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.pageSize).toBe(1);
      }
    });

    it('should accept pageSize of "100" (maximum valid)', () => {
      const result = listTicketsQuerySchema.safeParse({ pageSize: '100' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.pageSize).toBe(100);
      }
    });

    it('should reject pageSize of "101" (above maximum)', () => {
      const result = listTicketsQuerySchema.safeParse({ pageSize: '101' });
      expect(result.success).toBe(false);
    });
  });

  describe('multiple validation errors reported together', () => {
    it('should report errors for multiple invalid fields in one parse', () => {
      const result = listTicketsQuerySchema.safeParse({
        priority: 'INVALID',
        assignedTo: 'not-a-uuid',
        page: 'abc',
        pageSize: '200',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((issue) => issue.path[0]);
        expect(paths).toContain('priority');
        expect(paths).toContain('assignedTo');
        expect(paths).toContain('page');
        expect(paths).toContain('pageSize');
      }
    });
  });

  describe('passthrough unknown params', () => {
    it('should silently ignore unknown query parameters', () => {
      const result = listTicketsQuerySchema.safeParse({ unknownParam: 'hello', foo: 'bar' });
      expect(result.success).toBe(true);
    });
  });
});
