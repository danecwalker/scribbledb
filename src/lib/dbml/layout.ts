// src/lib/dbml/layout.ts
import ELK from 'elkjs/lib/elk.bundled.js';
import type { ParsedSchema, SchemaTable, SchemaRef } from './parser';

const elk = new ELK();

// Layout constants
const TABLE_HEADER_HEIGHT = 36;
const COLUMN_ROW_HEIGHT = 28;
const TABLE_MIN_WIDTH = 200;
const CHAR_WIDTH = 8;
const TABLE_PADDING_X = 24;

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  table: SchemaTable;
}

export interface LayoutPort {
  nodeId: string;
  columnName: string;
  x: number;
  y: number;
  side: 'left' | 'right';
}

export interface LayoutEdge {
  id: string;
  ref: SchemaRef;
  points: { x: number; y: number }[];
}

export interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
}

function estimateTableWidth(table: SchemaTable): number {
  let maxLen = table.name.length;
  for (const col of table.columns) {
    const constraintParts: string[] = [];
    if (col.pk) constraintParts.push('PK');
    if (col.unique) constraintParts.push('UQ');
    if (col.notNull) constraintParts.push('NN');
    if (col.increment) constraintParts.push('AI');
    const constraintStr = constraintParts.length > 0 ? `  ${constraintParts.join(' ')}` : '';
    const lineLen = col.name.length + col.type.length + 3 + constraintStr.length;
    if (lineLen > maxLen) maxLen = lineLen;
  }
  return Math.max(TABLE_MIN_WIDTH, maxLen * CHAR_WIDTH + TABLE_PADDING_X * 2);
}

function tableHeight(table: SchemaTable): number {
  return TABLE_HEADER_HEIGHT + table.columns.length * COLUMN_ROW_HEIGHT;
}

function tableNodeId(table: SchemaTable): string {
  return `${table.schema}.${table.name}`;
}

function portId(table: SchemaTable, columnName: string, side: 'left' | 'right'): string {
  return `${tableNodeId(table)}.${columnName}.${side}`;
}

export async function computeLayout(schema: ParsedSchema): Promise<LayoutResult> {
  const tableMap = new Map<string, SchemaTable>();
  for (const t of schema.tables) {
    tableMap.set(`${t.schema}.${t.name}`, t);
  }

  const children = schema.tables.map((table) => {
    const width = estimateTableWidth(table);
    const height = tableHeight(table);

    const ports: any[] = [];
    table.columns.forEach((col, i) => {
      ports.push({
        id: portId(table, col.name, 'right'),
        width: 8,
        height: 8,
        layoutOptions: { 'elk.port.side': 'EAST' },
        properties: { 'org.eclipse.elk.port.index': String(i) },
      });
      ports.push({
        id: portId(table, col.name, 'left'),
        width: 8,
        height: 8,
        layoutOptions: { 'elk.port.side': 'WEST' },
        properties: { 'org.eclipse.elk.port.index': String(i) },
      });
    });

    return {
      id: tableNodeId(table),
      width,
      height,
      layoutOptions: {
        'elk.portConstraints': 'FIXED_SIDE',
        'elk.portAlignment.default': 'CENTER',
      },
      ports,
    };
  });

  // Build edges and track which refs survived filtering
  const survivingRefs: SchemaRef[] = [];
  const edges: { id: string; sources: string[]; targets: string[] }[] = [];

  for (const ref of schema.refs) {
    const fromKey = `${ref.fromSchema}.${ref.fromTable}`;
    const toKey = `${ref.toSchema}.${ref.toTable}`;
    const fromTable = tableMap.get(fromKey);
    const toTable = tableMap.get(toKey);

    if (!fromTable || !toTable) continue;

    const fromCol = ref.fromColumns[0] || '';
    const toCol = ref.toColumns[0] || '';

    edges.push({
      id: `e${edges.length}`,
      sources: [portId(fromTable, fromCol, 'right')],
      targets: [portId(toTable, toCol, 'left')],
    });
    survivingRefs.push(ref);
  }

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '60',
      'elk.layered.spacing.nodeNodeBetweenLayers': '100',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.padding': '[top=30, left=30, bottom=30, right=30]',
    },
    children,
    edges,
  };

  const result = await elk.layout(graph) as any;

  const nodes: LayoutNode[] = (result.children || []).map((child: any) => {
    const table = tableMap.get(child.id)!;
    return {
      id: child.id,
      x: child.x,
      y: child.y,
      width: child.width,
      height: child.height,
      table,
    };
  });

  const layoutEdges: LayoutEdge[] = (result.edges || []).map((edge: any, i: number) => {
    const points: { x: number; y: number }[] = [];
    if (edge.sections) {
      for (const section of edge.sections) {
        points.push(section.startPoint);
        if (section.bendPoints) {
          points.push(...section.bendPoints);
        }
        points.push(section.endPoint);
      }
    }
    return {
      id: edge.id,
      ref: survivingRefs[i],
      points,
    };
  });

  return {
    nodes,
    edges: layoutEdges,
    width: result.width || 0,
    height: result.height || 0,
  };
}
