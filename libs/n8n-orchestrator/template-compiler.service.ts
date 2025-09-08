// Simple template compiler that performs {{VAR}} substitution recursively across objects/arrays/strings
// Designed for the n8n orchestrator templates in libs/n8n-orchestrator/templates/

export type TemplateVars = Record<string, string | number | boolean | null | undefined>;

function isPlainObject(value: any): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function substituteInString(input: string, vars: TemplateVars): string {
  // Replace occurrences of {{VAR}} keeping values as strings; caller can cast further if needed
  return input.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_m, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? '' : String(v);
  });
}

export function compileTemplate<T = any>(template: any, vars: TemplateVars): T {
  if (template == null) return template as T;

  if (typeof template === 'string') {
    return substituteInString(template, vars) as unknown as T;
  }

  if (Array.isArray(template)) {
    return template.map((item) => compileTemplate(item, vars)) as unknown as T;
  }

  if (isPlainObject(template)) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(template)) {
      out[k] = compileTemplate(v, vars);
    }
    return out as T;
  }

  // numbers/booleans pass through
  return template as T;
}

export interface NodeBuildOptions {
  id?: string;
  name?: string;
  position?: [number, number];
}

export function withNodeMeta<T extends Record<string, any>>(node: T, opts?: NodeBuildOptions): T {
  if (!opts) return node;
  const copy = { ...node } as any;
  if (opts.id) copy.id = opts.id;
  if (opts.name) copy.name = opts.name;
  if (opts.position) copy.position = opts.position;
  return copy as T;
}
