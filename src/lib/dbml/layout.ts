// src/lib/dbml/layout.ts
import ELK from 'elkjs/lib/elk.bundled.js';
import type { ParsedSchema, SchemaTable, SchemaRef, SchemaTableGroup } from './parser';

const elk = new ELK();

export type LayoutDirection = 'RIGHT' | 'LEFT' | 'DOWN' | 'UP';

function isHorizontal(dir: LayoutDirection): boolean {
  return dir === 'RIGHT' || dir === 'LEFT';
}

// Layout constants
const TABLE_HEADER_HEIGHT = 36;
const COLUMN_ROW_HEIGHT = 28;
const TABLE_MIN_WIDTH = 200;
const TABLE_MAX_WIDTH = 360;
const CHAR_WIDTH = 8;
const TABLE_PADDING_X = 24;

// Note wrapping constants (exported for Diagram)
export const NOTE_CHAR_WIDTH = 6;
export const NOTE_LINE_HEIGHT = 14;
const NOTE_NAME_AREA = 28;
const NOTE_BOTTOM_PAD = 8;

export function wrapNoteText(note: string, tableWidth: number): string[] {
  const availWidth = tableWidth - TABLE_PADDING_X * 2;
  const charsPerLine = Math.max(1, Math.floor(availWidth / NOTE_CHAR_WIDTH));
  const words = note.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (current && current.length + 1 + word.length > charsPerLine) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

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

export interface LayoutGroup {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  color: string | null;
}

export interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  groups: LayoutGroup[];
  width: number;
  height: number;
}

export function headerHeight(table: SchemaTable, tableWidth: number): number {
  if (!table.note) return TABLE_HEADER_HEIGHT;
  const lines = wrapNoteText(table.note, tableWidth);
  return NOTE_NAME_AREA + lines.length * NOTE_LINE_HEIGHT + NOTE_BOTTOM_PAD;
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
  return Math.min(TABLE_MAX_WIDTH, Math.max(TABLE_MIN_WIDTH, maxLen * CHAR_WIDTH + TABLE_PADDING_X * 2));
}

function tableHeight(table: SchemaTable, tableWidth: number): number {
  return headerHeight(table, tableWidth) + table.columns.length * COLUMN_ROW_HEIGHT;
}

function tableNodeId(table: SchemaTable): string {
  return `${table.schema}.${table.name}`;
}

function portId(table: SchemaTable, columnName: string, side: 'left' | 'right'): string {
  return `${tableNodeId(table)}.${columnName}.${side}`;
}

const GROUP_LABEL_HEIGHT = 32;
const GROUP_PADDING = 20;

function groupNodeId(group: SchemaTableGroup): string {
  return `group:${group.name}`;
}

function buildTableElkNode(table: SchemaTable, direction: LayoutDirection): any {
  const width = estimateTableWidth(table);
  const height = tableHeight(table, width);
  const hh = headerHeight(table, width);
  const horiz = isHorizontal(direction);

  const ports: any[] = [];
  table.columns.forEach((col, i) => {
    const portY = hh + i * COLUMN_ROW_HEIGHT + COLUMN_ROW_HEIGHT / 2;
    if (horiz) {
      // Ports on left/right edges at column center
      ports.push({ id: portId(table, col.name, 'right'), width: 0, height: 0, x: width, y: portY });
      ports.push({ id: portId(table, col.name, 'left'), width: 0, height: 0, x: 0, y: portY });
    } else {
      // Ports on top/bottom edges, spread horizontally across table width
      const portX = TABLE_PADDING_X + ((width - TABLE_PADDING_X * 2) / (table.columns.length + 1)) * (i + 1);
      ports.push({ id: portId(table, col.name, 'right'), width: 0, height: 0, x: portX, y: height });
      ports.push({ id: portId(table, col.name, 'left'), width: 0, height: 0, x: portX, y: 0 });
    }
  });

  return {
    id: tableNodeId(table),
    width,
    height,
    layoutOptions: {
      'elk.portConstraints': 'FIXED_POS',
    },
    ports,
  };
}

export async function computeLayout(schema: ParsedSchema, direction: LayoutDirection = 'RIGHT'): Promise<LayoutResult> {
  const tableMap = new Map<string, SchemaTable>();
  for (const t of schema.tables) {
    tableMap.set(`${t.schema}.${t.name}`, t);
  }

  // Build a mapping from table key -> group for quick lookup
  const tableToGroup = new Map<string, SchemaTableGroup>();
  for (const group of schema.tableGroups) {
    for (const ref of group.tables) {
      tableToGroup.set(`${ref.schemaName}.${ref.tableName}`, group);
    }
  }

  // Build ELK children: group nodes contain their tables, ungrouped tables are top-level
  const topLevelChildren: any[] = [];

  // Create group compound nodes
  for (const group of schema.tableGroups) {
    const groupChildren: any[] = [];
    for (const ref of group.tables) {
      const table = tableMap.get(`${ref.schemaName}.${ref.tableName}`);
      if (table) {
        groupChildren.push(buildTableElkNode(table, direction));
      }
    }
    if (groupChildren.length === 0) continue;

    topLevelChildren.push({
      id: groupNodeId(group),
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': direction,
        'elk.spacing.nodeNode': '60',
        'elk.layered.spacing.nodeNodeBetweenLayers': '120',
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.padding': `[top=${GROUP_LABEL_HEIGHT + GROUP_PADDING}, left=${GROUP_PADDING}, bottom=${GROUP_PADDING}, right=${GROUP_PADDING}]`,
      },
      children: groupChildren,
    });
  }

  // Count connections per table for ordering (most-connected first)
  const connectionCount = new Map<string, number>();
  for (const ref of schema.refs) {
    const fk = `${ref.fromSchema}.${ref.fromTable}`;
    const tk = `${ref.toSchema}.${ref.toTable}`;
    connectionCount.set(fk, (connectionCount.get(fk) || 0) + 1);
    connectionCount.set(tk, (connectionCount.get(tk) || 0) + 1);
  }

  // Add ungrouped tables as top-level children, most-connected first
  const ungroupedTables = schema.tables
    .filter((t) => !tableToGroup.has(tableNodeId(t)))
    .sort((a, b) => (connectionCount.get(tableNodeId(b)) || 0) - (connectionCount.get(tableNodeId(a)) || 0));
  for (const table of ungroupedTables) {
    topLevelChildren.push(buildTableElkNode(table, direction));
  }

  // Build edges (always at root level so they route across groups)
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

  const graph: any = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.padding': '[top=30, left=30, bottom=30, right=30]',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      // Place connected nodes close together
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.nodePlacement.networkSimplex.nodeFlexibility.default': 'NODE_SIZE',
      'elk.spacing.nodeNode': '70',
      'elk.layered.spacing.nodeNodeBetweenLayers': '120',
      // Minimize crossings aggressively
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.crossingMinimization.greedySwitch.type': 'TWO_SIDED',
      'elk.layered.thoroughness': '50',
      // Edges can overlap but keep clearance from nodes for the bend
      'elk.spacing.edgeEdge': '0',
      'elk.spacing.edgeNode': '25',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '0',
      'elk.layered.spacing.edgeNodeBetweenLayers': '25',
      // Consider model order to keep related nodes adjacent
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    },
    children: topLevelChildren,
    edges,
  };

  const result = await elk.layout(graph) as any;

  // Extract nodes and groups from the result
  const nodes: LayoutNode[] = [];
  const groups: LayoutGroup[] = [];

  // Build a lookup from group name to SchemaTableGroup for color/note
  const groupByElkId = new Map<string, SchemaTableGroup>();
  for (const group of schema.tableGroups) {
    groupByElkId.set(groupNodeId(group), group);
  }

  for (const child of result.children || []) {
    const schemaGroup = groupByElkId.get(child.id);
    if (schemaGroup) {
      // This is a group compound node
      groups.push({
        id: child.id,
        x: child.x,
        y: child.y,
        width: child.width,
        height: child.height,
        name: schemaGroup.name,
        color: schemaGroup.color,
      });

      // Extract table nodes inside the group (positions are relative to group)
      for (const grandchild of child.children || []) {
        const table = tableMap.get(grandchild.id)!;
        nodes.push({
          id: grandchild.id,
          x: child.x + grandchild.x,
          y: child.y + grandchild.y,
          width: grandchild.width,
          height: grandchild.height,
          table,
        });
      }
    } else {
      // This is a regular table node
      const table = tableMap.get(child.id)!;
      nodes.push({
        id: child.id,
        x: child.x,
        y: child.y,
        width: child.width,
        height: child.height,
        table,
      });
    }
  }

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
    groups,
    width: result.width || 0,
    height: result.height || 0,
  };
}
