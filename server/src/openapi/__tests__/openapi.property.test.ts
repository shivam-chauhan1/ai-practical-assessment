import * as fc from 'fast-check';
import { z } from 'zod';
import { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

// Extend Zod with OpenAPI support
extendZodWithOpenApi(z);

/**
 * Property 1: Schema fidelity
 *
 * For any Zod schema field registered with the OpenAPI registry, the generated
 * OpenAPI JSON SHALL preserve its constraints (minLength, maxLength, enum values,
 * format) and SHALL mark optional fields as not appearing in the "required" array.
 *
 * Validates: Requirements 1.2, 1.3
 */
describe('Property 1: Schema fidelity', () => {
  /**
   * Arbitrary that generates a random field configuration including:
   * - minLength / maxLength constraints
   * - enum values
   * - uuid format
   * - optional flag
   */
  const fieldConfigArb = fc.record({
    name: fc.stringMatching(/^[a-z][a-zA-Z0-9]{1,15}$/).filter((s) => s.length >= 2),
    minLength: fc.option(fc.integer({ min: 1, max: 50 }), { nil: undefined }),
    maxLength: fc.option(fc.integer({ min: 51, max: 200 }), { nil: undefined }),
    isEnum: fc.boolean(),
    enumValues: fc.uniqueArray(fc.stringMatching(/^[A-Z][A-Z_]{1,8}$/), { minLength: 2, maxLength: 5 }),
    isUuid: fc.boolean(),
    isOptional: fc.boolean(),
  });

  /**
   * Arbitrary that generates a schema configuration with 1-5 unique fields
   */
  const schemaConfigArb = fc
    .record({
      schemaName: fc.stringMatching(/^[A-Z][a-zA-Z]{2,15}Schema$/),
      fields: fc.array(fieldConfigArb, { minLength: 1, maxLength: 5 }),
    })
    .map((config) => {
      // Ensure unique field names within a schema
      const seenNames = new Set<string>();
      config.fields = config.fields.filter((f) => {
        if (seenNames.has(f.name)) return false;
        seenNames.add(f.name);
        return true;
      });
      if (config.fields.length === 0) {
        config.fields = [
          {
            name: 'defaultField',
            minLength: undefined,
            maxLength: undefined,
            isEnum: false,
            enumValues: ['A', 'B'],
            isUuid: false,
            isOptional: false,
          },
        ];
      }
      return config;
    });

  function buildZodSchema(config: {
    schemaName: string;
    fields: Array<{
      name: string;
      minLength: number | undefined;
      maxLength: number | undefined;
      isEnum: boolean;
      enumValues: string[];
      isUuid: boolean;
      isOptional: boolean;
    }>;
  }) {
    const shape: Record<string, z.ZodTypeAny> = {};

    for (const field of config.fields) {
      let fieldSchema: z.ZodTypeAny;

      if (field.isEnum && field.enumValues.length >= 2) {
        // Create an enum schema
        fieldSchema = z.enum(field.enumValues as [string, ...string[]]);
      } else if (field.isUuid) {
        // Create a uuid string schema
        fieldSchema = z.string().uuid();
      } else {
        // Create a string schema with optional min/max constraints
        let strSchema = z.string();
        if (field.minLength !== undefined) {
          strSchema = strSchema.min(field.minLength);
        }
        if (field.maxLength !== undefined) {
          strSchema = strSchema.max(field.maxLength);
        }
        fieldSchema = strSchema;
      }

      if (field.isOptional) {
        fieldSchema = fieldSchema.optional();
      }

      shape[field.name] = fieldSchema;
    }

    return z.object(shape).openapi(config.schemaName);
  }

  function generateDocument(registry: OpenAPIRegistry, schema: z.ZodTypeAny, schemaName: string) {
    registry.register(schemaName, schema);

    const generator = new OpenApiGeneratorV3(registry.definitions);
    return generator.generateDocument({
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0.0' },
    });
  }

  it('preserves minLength/maxLength constraints in generated OpenAPI schema', () => {
    fc.assert(
      fc.property(schemaConfigArb, (config) => {
        const registry = new OpenAPIRegistry();
        const schema = buildZodSchema(config);
        const doc = generateDocument(registry, schema, config.schemaName);

        const schemaRef = doc.components?.schemas?.[config.schemaName] as any;
        expect(schemaRef).toBeDefined();

        for (const field of config.fields) {
          // Skip enum and uuid fields for minLength/maxLength checks
          if (field.isEnum || field.isUuid) continue;

          const propDef = schemaRef.properties?.[field.name] as any;
          expect(propDef).toBeDefined();

          if (field.minLength !== undefined) {
            expect(propDef.minLength).toBe(field.minLength);
          }
          if (field.maxLength !== undefined) {
            expect(propDef.maxLength).toBe(field.maxLength);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('preserves enum values in generated OpenAPI schema', () => {
    fc.assert(
      fc.property(schemaConfigArb, (config) => {
        const registry = new OpenAPIRegistry();
        const schema = buildZodSchema(config);
        const doc = generateDocument(registry, schema, config.schemaName);

        const schemaRef = doc.components?.schemas?.[config.schemaName] as any;
        expect(schemaRef).toBeDefined();

        for (const field of config.fields) {
          if (!field.isEnum || field.enumValues.length < 2) continue;

          const propDef = schemaRef.properties?.[field.name] as any;
          expect(propDef).toBeDefined();
          expect(propDef.enum).toBeDefined();
          expect(propDef.enum).toEqual(expect.arrayContaining(field.enumValues));
          expect(field.enumValues).toEqual(expect.arrayContaining(propDef.enum));
        }
      }),
      { numRuns: 100 }
    );
  });

  it('preserves uuid format in generated OpenAPI schema', () => {
    fc.assert(
      fc.property(schemaConfigArb, (config) => {
        const registry = new OpenAPIRegistry();
        const schema = buildZodSchema(config);
        const doc = generateDocument(registry, schema, config.schemaName);

        const schemaRef = doc.components?.schemas?.[config.schemaName] as any;
        expect(schemaRef).toBeDefined();

        for (const field of config.fields) {
          if (!field.isUuid || field.isEnum) continue;

          const propDef = schemaRef.properties?.[field.name] as any;
          expect(propDef).toBeDefined();
          expect(propDef.format).toBe('uuid');
        }
      }),
      { numRuns: 100 }
    );
  });

  it('does NOT include optional fields in the required array', () => {
    fc.assert(
      fc.property(schemaConfigArb, (config) => {
        const registry = new OpenAPIRegistry();
        const schema = buildZodSchema(config);
        const doc = generateDocument(registry, schema, config.schemaName);

        const schemaRef = doc.components?.schemas?.[config.schemaName] as any;
        expect(schemaRef).toBeDefined();

        const requiredFields: string[] = schemaRef.required ?? [];

        for (const field of config.fields) {
          if (field.isOptional) {
            expect(requiredFields).not.toContain(field.name);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 2: Error documentation completeness
 *
 * For any endpoint registered in the OpenAPI registry that documents error response
 * codes (400, 401, 403, 404, 409), each error code's response content SHALL reference
 * the shared ErrorResponse schema.
 *
 * Validates: Requirements 2.3
 */
describe('Property 2: Error documentation completeness', () => {
  const ERROR_CODES = [400, 401, 403, 404, 409] as const;

  /**
   * Arbitrary that generates a non-empty subset of error codes from [400, 401, 403, 404, 409]
   */
  const errorCodeSubsetArb = fc
    .subarray([...ERROR_CODES], { minLength: 1, maxLength: 5 })
    .filter((arr) => arr.length >= 1);

  /**
   * Arbitrary that generates a valid path name for registration
   */
  const pathNameArb = fc
    .stringMatching(/^\/[a-z][a-z0-9-]{1,15}$/)
    .filter((s) => s.length >= 2);

  /**
   * Arbitrary that generates a random endpoint configuration with error codes
   */
  const endpointConfigArb = fc.record({
    path: pathNameArb,
    method: fc.constantFrom('get' as const, 'post' as const, 'patch' as const, 'delete' as const),
    errorCodes: errorCodeSubsetArb,
  });

  /**
   * Registers an endpoint with the given error codes, each referencing ErrorResponseSchema,
   * generates the OpenAPI document, and returns it for assertions.
   */
  function registerEndpointAndGenerate(config: {
    path: string;
    method: 'get' | 'post' | 'patch' | 'delete';
    errorCodes: number[];
  }) {
    const registry = new OpenAPIRegistry();

    // Define the ErrorResponseSchema for this test
    const ErrorResponseSchema = z
      .object({
        error: z.object({
          code: z.string(),
          message: z.string(),
          details: z
            .array(
              z.object({
                field: z.string(),
                message: z.string(),
              })
            )
            .optional(),
        }),
      })
      .openapi('ErrorResponse');

    // Define a simple success response schema
    const SuccessSchema = z
      .object({
        success: z.literal(true),
      })
      .openapi('SuccessResponse');

    // Build error responses object
    const responses: Record<string, any> = {
      200: {
        description: 'Successful response',
        content: { 'application/json': { schema: SuccessSchema } },
      },
    };

    for (const code of config.errorCodes) {
      responses[code.toString()] = {
        description: `Error ${code}`,
        content: { 'application/json': { schema: ErrorResponseSchema } },
      };
    }

    registry.registerPath({
      method: config.method,
      path: config.path,
      responses,
    });

    const generator = new OpenApiGeneratorV3(registry.definitions);
    return generator.generateDocument({
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0.0' },
    });
  }

  it('all documented error responses reference the ErrorResponse schema', () => {
    fc.assert(
      fc.property(endpointConfigArb, (config) => {
        const doc = registerEndpointAndGenerate(config);

        // Find the path in the generated document
        const pathDef = (doc.paths as any)?.[config.path]?.[config.method];
        expect(pathDef).toBeDefined();

        // Check each error code's response references ErrorResponse schema
        for (const code of config.errorCodes) {
          const responseDef = pathDef.responses?.[code.toString()];
          expect(responseDef).toBeDefined();
          expect(responseDef.content).toBeDefined();
          expect(responseDef.content['application/json']).toBeDefined();

          const schemaRef =
            responseDef.content['application/json'].schema;
          expect(schemaRef).toBeDefined();
          expect(schemaRef.$ref).toBe('#/components/schemas/ErrorResponse');
        }
      }),
      { numRuns: 100 }
    );
  });

  it('ErrorResponse schema exists in components when error codes are documented', () => {
    fc.assert(
      fc.property(endpointConfigArb, (config) => {
        const doc = registerEndpointAndGenerate(config);

        // The ErrorResponse schema should be in components/schemas
        const schemas = doc.components?.schemas as any;
        expect(schemas).toBeDefined();
        expect(schemas['ErrorResponse']).toBeDefined();

        // Verify it has the expected structure
        const errorSchema = schemas['ErrorResponse'];
        expect(errorSchema.type).toBe('object');
        expect(errorSchema.properties).toBeDefined();
        expect(errorSchema.properties.error).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });

  it('multiple endpoints all reference ErrorResponse for their error codes', () => {
    const multiEndpointArb = fc
      .array(endpointConfigArb, { minLength: 1, maxLength: 4 })
      .map((endpoints) => {
        // Ensure unique paths
        const seen = new Set<string>();
        return endpoints.filter((e) => {
          const key = `${e.method}:${e.path}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      })
      .filter((arr) => arr.length >= 1);

    fc.assert(
      fc.property(multiEndpointArb, (endpoints) => {
        const registry = new OpenAPIRegistry();

        const ErrorResponseSchema = z
          .object({
            error: z.object({
              code: z.string(),
              message: z.string(),
              details: z
                .array(
                  z.object({
                    field: z.string(),
                    message: z.string(),
                  })
                )
                .optional(),
            }),
          })
          .openapi('ErrorResponse');

        const SuccessSchema = z
          .object({
            success: z.literal(true),
          })
          .openapi('SuccessResponse');

        for (const endpoint of endpoints) {
          const responses: Record<string, any> = {
            200: {
              description: 'Successful response',
              content: { 'application/json': { schema: SuccessSchema } },
            },
          };

          for (const code of endpoint.errorCodes) {
            responses[code.toString()] = {
              description: `Error ${code}`,
              content: { 'application/json': { schema: ErrorResponseSchema } },
            };
          }

          registry.registerPath({
            method: endpoint.method,
            path: endpoint.path,
            responses,
          });
        }

        const generator = new OpenApiGeneratorV3(registry.definitions);
        const doc = generator.generateDocument({
          openapi: '3.0.0',
          info: { title: 'Test', version: '1.0.0' },
        });

        // Assert for every endpoint and every error code
        for (const endpoint of endpoints) {
          const pathDef = (doc.paths as any)?.[endpoint.path]?.[endpoint.method];
          expect(pathDef).toBeDefined();

          for (const code of endpoint.errorCodes) {
            const responseDef = pathDef.responses?.[code.toString()];
            expect(responseDef).toBeDefined();
            expect(responseDef.content['application/json'].schema.$ref).toBe(
              '#/components/schemas/ErrorResponse'
            );
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Property 3: Route parameter documentation completeness
 *
 * For any route registered in the OpenAPI registry, all path parameters SHALL be
 * documented with their type and format constraints, all query parameters SHALL be
 * documented with their type and enum values, and all request bodies SHALL reference
 * a registered Zod schema rather than an inline definition.
 *
 * Validates: Requirements 3.2, 3.3, 3.4
 */
describe('Property 3: Route parameter documentation completeness', () => {
  /**
   * Arbitrary that generates a valid path segment name
   */
  const segmentNameArb = fc
    .stringMatching(/^[a-z][a-z0-9]{1,10}$/)
    .filter((s) => s.length >= 2);

  /**
   * Arbitrary that generates a valid parameter name
   */
  const paramNameArb = fc
    .stringMatching(/^[a-z][a-zA-Z0-9]{1,12}$/)
    .filter((s) => s.length >= 2);

  /**
   * Arbitrary that generates enum values for query parameters
   */
  const enumValuesArb = fc.uniqueArray(
    fc.stringMatching(/^[A-Z][A-Z_]{1,8}$/),
    { minLength: 2, maxLength: 5 }
  );

  /**
   * Arbitrary that generates a route configuration with:
   * - Path parameters (uuid type)
   * - Query parameters (with enum values)
   * - Request body referencing a registered schema
   */
  const routeConfigArb = fc.record({
    basePath: segmentNameArb,
    pathParamName: paramNameArb,
    queryParams: fc.array(
      fc.record({
        name: paramNameArb,
        enumValues: enumValuesArb,
      }),
      { minLength: 1, maxLength: 3 }
    ),
    bodySchemaName: fc.stringMatching(/^[A-Z][a-zA-Z]{2,12}Body$/),
    bodyFieldName: paramNameArb,
    method: fc.constantFrom('post' as const, 'patch' as const, 'put' as const),
  }).map((config) => {
    // Ensure unique query param names
    const seenNames = new Set<string>();
    // Ensure pathParamName is not duplicated in query params
    seenNames.add(config.pathParamName);
    config.queryParams = config.queryParams.filter((qp) => {
      if (seenNames.has(qp.name)) return false;
      seenNames.add(qp.name);
      return true;
    });
    if (config.queryParams.length === 0) {
      config.queryParams = [{ name: 'filterStatus', enumValues: ['OPEN', 'CLOSED'] }];
    }
    return config;
  });

  it('all path parameters appear with type string and format uuid', () => {
    fc.assert(
      fc.property(routeConfigArb, (config) => {
        const registry = new OpenAPIRegistry();

        // Create a request body schema and register it
        const bodySchema = z
          .object({ [config.bodyFieldName]: z.string() })
          .openapi(config.bodySchemaName);
        registry.register(config.bodySchemaName, bodySchema);

        // Build path param as uuid
        const pathParam = registry.registerParameter(
          config.pathParamName,
          z.string().uuid().openapi({
            param: {
              name: config.pathParamName,
              in: 'path',
            },
          })
        );

        // Build query params with enums
        const queryParamRefs = config.queryParams.map((qp) =>
          registry.registerParameter(
            qp.name,
            z.enum(qp.enumValues as [string, ...string[]]).openapi({
              param: {
                name: qp.name,
                in: 'query',
              },
            })
          )
        );

        const routePath = `/${config.basePath}/{${config.pathParamName}}`;

        registry.registerPath({
          method: config.method,
          path: routePath,
          request: {
            params: z.object({
              [config.pathParamName]: z.string().uuid(),
            }),
            query: z.object(
              Object.fromEntries(
                config.queryParams.map((qp) => [
                  qp.name,
                  z.enum(qp.enumValues as [string, ...string[]]),
                ])
              )
            ),
            body: {
              content: { 'application/json': { schema: bodySchema } },
            },
          },
          responses: {
            200: { description: 'Success' },
          },
        });

        const generator = new OpenApiGeneratorV3(registry.definitions);
        const doc = generator.generateDocument({
          openapi: '3.0.0',
          info: { title: 'Test', version: '1.0.0' },
        });

        // Get the path operation from the document
        const pathDef = (doc.paths as any)?.[routePath]?.[config.method];
        expect(pathDef).toBeDefined();

        const parameters: any[] = pathDef.parameters ?? [];

        // Assert path parameter has type string and format uuid
        const pathParams = parameters.filter((p: any) => p.in === 'path');
        const matchingPathParam = pathParams.find(
          (p: any) => p.name === config.pathParamName
        );
        expect(matchingPathParam).toBeDefined();
        expect(matchingPathParam.schema.type).toBe('string');
        expect(matchingPathParam.schema.format).toBe('uuid');
      }),
      { numRuns: 100 }
    );
  });

  it('all query parameters appear with their type and enum values preserved', () => {
    fc.assert(
      fc.property(routeConfigArb, (config) => {
        const registry = new OpenAPIRegistry();

        // Create a request body schema and register it
        const bodySchema = z
          .object({ [config.bodyFieldName]: z.string() })
          .openapi(config.bodySchemaName);
        registry.register(config.bodySchemaName, bodySchema);

        const routePath = `/${config.basePath}/{${config.pathParamName}}`;

        registry.registerPath({
          method: config.method,
          path: routePath,
          request: {
            params: z.object({
              [config.pathParamName]: z.string().uuid(),
            }),
            query: z.object(
              Object.fromEntries(
                config.queryParams.map((qp) => [
                  qp.name,
                  z.enum(qp.enumValues as [string, ...string[]]),
                ])
              )
            ),
            body: {
              content: { 'application/json': { schema: bodySchema } },
            },
          },
          responses: {
            200: { description: 'Success' },
          },
        });

        const generator = new OpenApiGeneratorV3(registry.definitions);
        const doc = generator.generateDocument({
          openapi: '3.0.0',
          info: { title: 'Test', version: '1.0.0' },
        });

        const pathDef = (doc.paths as any)?.[routePath]?.[config.method];
        expect(pathDef).toBeDefined();

        const parameters: any[] = pathDef.parameters ?? [];

        // Assert each query param has correct type and enum values
        for (const qp of config.queryParams) {
          const matchingQueryParam = parameters.find(
            (p: any) => p.in === 'query' && p.name === qp.name
          );
          expect(matchingQueryParam).toBeDefined();
          expect(matchingQueryParam.schema.type).toBe('string');
          expect(matchingQueryParam.schema.enum).toBeDefined();
          expect(matchingQueryParam.schema.enum).toEqual(
            expect.arrayContaining(qp.enumValues)
          );
          expect(qp.enumValues).toEqual(
            expect.arrayContaining(matchingQueryParam.schema.enum)
          );
        }
      }),
      { numRuns: 100 }
    );
  });

  it('request bodies reference a named schema via $ref', () => {
    fc.assert(
      fc.property(routeConfigArb, (config) => {
        const registry = new OpenAPIRegistry();

        // Create and register a request body schema
        const bodySchema = z
          .object({ [config.bodyFieldName]: z.string() })
          .openapi(config.bodySchemaName);
        registry.register(config.bodySchemaName, bodySchema);

        const routePath = `/${config.basePath}/{${config.pathParamName}}`;

        registry.registerPath({
          method: config.method,
          path: routePath,
          request: {
            params: z.object({
              [config.pathParamName]: z.string().uuid(),
            }),
            query: z.object(
              Object.fromEntries(
                config.queryParams.map((qp) => [
                  qp.name,
                  z.enum(qp.enumValues as [string, ...string[]]),
                ])
              )
            ),
            body: {
              content: { 'application/json': { schema: bodySchema } },
            },
          },
          responses: {
            200: { description: 'Success' },
          },
        });

        const generator = new OpenApiGeneratorV3(registry.definitions);
        const doc = generator.generateDocument({
          openapi: '3.0.0',
          info: { title: 'Test', version: '1.0.0' },
        });

        const pathDef = (doc.paths as any)?.[routePath]?.[config.method];
        expect(pathDef).toBeDefined();

        // Assert the request body references a named schema (via $ref)
        const requestBody = pathDef.requestBody;
        expect(requestBody).toBeDefined();
        expect(requestBody.content).toBeDefined();
        expect(requestBody.content['application/json']).toBeDefined();

        const bodySchemaRef =
          requestBody.content['application/json'].schema;
        expect(bodySchemaRef).toBeDefined();
        expect(bodySchemaRef.$ref).toBe(
          `#/components/schemas/${config.bodySchemaName}`
        );
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Property 4: Security scheme application consistency
 *
 * For any endpoint that requires authentication (all endpoints except POST /api/auth/login
 * and GET /api/health), the generated OpenAPI spec SHALL include the BearerAuth security
 * requirement on that endpoint's definition.
 *
 * Validates: Requirements 4.2, 4.4
 */
describe('Property 4: Security scheme application consistency', () => {
  /**
   * Arbitrary that generates a valid path segment
   */
  const pathSegmentArb = fc
    .stringMatching(/^[a-z][a-z0-9-]{1,12}$/)
    .filter((s) => s.length >= 2);

  /**
   * Arbitrary that generates an endpoint configuration with a random auth requirement
   */
  const endpointArb = fc.record({
    pathSegment: pathSegmentArb,
    method: fc.constantFrom('get' as const, 'post' as const, 'patch' as const, 'delete' as const),
    requiresAuth: fc.boolean(),
  });

  /**
   * Arbitrary that generates a set of 1-6 endpoints with unique method+path combinations
   */
  const endpointSetArb = fc
    .array(endpointArb, { minLength: 1, maxLength: 6 })
    .map((endpoints) => {
      const seen = new Set<string>();
      return endpoints.filter((e) => {
        const key = `${e.method}:/${e.pathSegment}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    })
    .filter((arr) => arr.length >= 1);

  it('auth-required endpoints have BearerAuth in security, non-auth endpoints do not', () => {
    fc.assert(
      fc.property(endpointSetArb, (endpoints) => {
        const registry = new OpenAPIRegistry();

        // Register the BearerAuth security scheme component
        registry.registerComponent('securitySchemes', 'BearerAuth', {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        });

        // Define a simple response schema for all endpoints
        const SuccessSchema = z
          .object({ success: z.literal(true) })
          .openapi('SuccessResponse');

        // Register each endpoint with appropriate security settings
        for (const endpoint of endpoints) {
          const path = `/${endpoint.pathSegment}`;
          const security = endpoint.requiresAuth
            ? [{ BearerAuth: [] }]
            : [];

          registry.registerPath({
            method: endpoint.method,
            path,
            security,
            responses: {
              200: {
                description: 'Success',
                content: { 'application/json': { schema: SuccessSchema } },
              },
            },
          });
        }

        // Generate the OpenAPI document
        const generator = new OpenApiGeneratorV3(registry.definitions);
        const doc = generator.generateDocument({
          openapi: '3.0.0',
          info: { title: 'Test', version: '1.0.0' },
        });

        // Assert security is correctly applied for each endpoint
        for (const endpoint of endpoints) {
          const path = `/${endpoint.pathSegment}`;
          const pathDef = (doc.paths as any)?.[path]?.[endpoint.method];
          expect(pathDef).toBeDefined();

          const securityArray: Array<Record<string, string[]>> = pathDef.security ?? [];

          if (endpoint.requiresAuth) {
            // Auth-required endpoints MUST have BearerAuth in their security array
            const hasBearerAuth = securityArray.some(
              (scheme) => 'BearerAuth' in scheme
            );
            expect(hasBearerAuth).toBe(true);
          } else {
            // Non-auth endpoints MUST NOT have BearerAuth in their security array
            const hasBearerAuth = securityArray.some(
              (scheme) => 'BearerAuth' in scheme
            );
            expect(hasBearerAuth).toBe(false);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
