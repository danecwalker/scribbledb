// src/lib/dbml/parser.ts
// Lazy-load @dbml/core (~15 MB) to keep it in a separate chunk
let _Parser: any;
let _ModelExporter: any;

async function getDbmlCore() {
  if (!_Parser) {
    const mod = await import('@dbml/core');
    _Parser = mod.Parser;
    _ModelExporter = mod.ModelExporter;
  }
  return { Parser: _Parser, ModelExporter: _ModelExporter };
}

export interface SchemaColumn {
  name: string;
  type: string;
  pk: boolean;
  unique: boolean;
  notNull: boolean;
  increment: boolean;
  defaultValue: string | null;
  note: string | null;
}

export interface SchemaTable {
  name: string;
  schema: string;
  columns: SchemaColumn[];
  note: string | null;
  headerColor: string | null;
}

export interface SchemaRef {
  name: string;
  fromSchema: string;
  fromTable: string;
  fromColumns: string[];
  fromRelation: string;
  toSchema: string;
  toTable: string;
  toColumns: string[];
  toRelation: string;
  onDelete: string | null;
  onUpdate: string | null;
}

export interface SchemaEnum {
  name: string;
  schema: string;
  values: { name: string; note: string | null }[];
}

export interface SchemaTableGroup {
  name: string;
  tables: { schemaName: string; tableName: string }[];
  color: string | null;
  note: string | null;
}

export interface ParsedSchema {
  tables: SchemaTable[];
  refs: SchemaRef[];
  enums: SchemaEnum[];
  tableGroups: SchemaTableGroup[];
}

export interface ParseError {
  message: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
}

export type ParseResult =
  | { ok: true; schema: ParsedSchema }
  | { ok: false; errors: ParseError[] };

export async function parseDBML(source: string): Promise<ParseResult> {
  try {
    const { Parser } = await getDbmlCore();
    const parser = new Parser();
    const database = parser.parse(source, 'dbml');

    const tables: SchemaTable[] = [];
    const refs: SchemaRef[] = [];
    const enums: SchemaEnum[] = [];
    const tableGroups: SchemaTableGroup[] = [];

    for (const schema of database.schemas) {
      for (const table of schema.tables) {
        tables.push({
          name: table.name,
          schema: schema.name,
          columns: table.fields.map((field: any) => ({
            name: field.name,
            type: field.type?.type_name ?? String(field.type),
            pk: field.pk ?? false,
            unique: field.unique ?? false,
            notNull: field.not_null ?? false,
            increment: field.increment ?? false,
            defaultValue: field.dbdefault?.value != null ? String(field.dbdefault.value) : null,
            note: field.note || null,
          })),
          note: table.note || null,
          headerColor: table.headerColor || null,
        });
      }

      for (const ref of schema.refs) {
        const [ep1, ep2] = ref.endpoints;
        refs.push({
          name: ref.name || '',
          fromSchema: ep1.schemaName || schema.name,
          fromTable: ep1.tableName,
          fromColumns: ep1.fieldNames,
          fromRelation: ep1.relation,
          toSchema: ep2.schemaName || schema.name,
          toTable: ep2.tableName,
          toColumns: ep2.fieldNames,
          toRelation: ep2.relation,
          onDelete: ref.onDelete || null,
          onUpdate: ref.onUpdate || null,
        });
      }

      for (const en of schema.enums) {
        enums.push({
          name: en.name,
          schema: schema.name,
          values: en.values.map((v: any) => ({
            name: v.name,
            note: v.note || null,
          })),
        });
      }

      for (const group of schema.tableGroups || []) {
        tableGroups.push({
          name: group.name,
          tables: (group.tables || []).map((t: any) => ({
            schemaName: t.schemaName || schema.name,
            tableName: t.name,
          })),
          color: group.color || null,
          note: group.note || null,
        });
      }
    }

    return { ok: true, schema: { tables, refs, enums, tableGroups } };
  } catch (e: any) {
    if (e.diags && Array.isArray(e.diags)) {
      const errors: ParseError[] = e.diags.map((diag: any) => ({
        message: diag.message,
        line: diag.location?.start?.line ?? 1,
        column: diag.location?.start?.column ?? 1,
        severity: diag.type ?? 'error',
      }));
      return { ok: false, errors };
    }
    return {
      ok: false,
      errors: [{ message: e.message ?? 'Unknown parse error', line: 1, column: 1, severity: 'error' }],
    };
  }
}

export type ExportFormat = 'mysql' | 'postgres' | 'oracle' | 'dbml' | 'mssql' | 'json';

export async function exportDBML(source: string, format: ExportFormat): Promise<string> {
  const { Parser, ModelExporter } = await getDbmlCore();
  const parser = new Parser();
  const database = parser.parse(source, 'dbml');

  // Fix jsonb/json defaults for PostgreSQL: wrap as '...'::jsonb
  // @dbml/core doesn't recognize jsonb as a string type, so defaults end up
  // with type 'jsonb'/'json' (quoted values) or 'expression' (backtick values)
  // and export without the required cast.
  if (format === 'postgres') {
    for (const schema of database.schemas) {
      for (const table of schema.tables) {
        for (const field of table.fields) {
          const typeName = field.type?.type_name?.toLowerCase();
          if (
            (typeName === 'jsonb' || typeName === 'json') &&
            field.dbdefault
          ) {
            const val = String(field.dbdefault.value);
            // Skip if already has the cast
            if (val.includes(`::${typeName}`)) continue;
            field.dbdefault = {
              value: `'${val}'::${typeName}`,
              type: 'expression',
            };
          }
        }
      }
    }
  }

  return ModelExporter.export(database, format);
}
