// src/lib/dbml/parser.ts
import { Parser } from '@dbml/core';

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

export interface ParsedSchema {
  tables: SchemaTable[];
  refs: SchemaRef[];
  enums: SchemaEnum[];
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

export function parseDBML(source: string): ParseResult {
  try {
    const parser = new Parser();
    const database = parser.parse(source, 'dbml');

    const tables: SchemaTable[] = [];
    const refs: SchemaRef[] = [];
    const enums: SchemaEnum[] = [];

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
    }

    return { ok: true, schema: { tables, refs, enums } };
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
