// src/lib/dbml/lang-dbml.ts
import { StreamLanguage, type StreamParser } from '@codemirror/language';

interface DBMLState {
  inString: boolean;
  inSingleString: boolean;
  inBlockComment: boolean;
  inNote: boolean;
}

const dbmlParser: StreamParser<DBMLState> = {
  name: 'dbml',

  startState(): DBMLState {
    return { inString: false, inSingleString: false, inBlockComment: false, inNote: false };
  },

  copyState(state: DBMLState): DBMLState {
    return { ...state };
  },

  token(stream, state): string | null {
    // Block comment
    if (state.inBlockComment) {
      if (stream.match('*/')) {
        state.inBlockComment = false;
      } else {
        stream.next();
      }
      return 'blockComment';
    }

    // Double-quoted string
    if (state.inString) {
      if (stream.skipTo('"')) {
        stream.next();
        state.inString = false;
      } else {
        stream.skipToEnd();
      }
      return 'string';
    }

    // Single-quoted string
    if (state.inSingleString) {
      if (stream.skipTo("'")) {
        stream.next();
        state.inSingleString = false;
      } else {
        stream.skipToEnd();
      }
      return 'string';
    }

    // Multi-line note content
    if (state.inNote) {
      if (stream.match("'''")) {
        state.inNote = false;
        return 'string';
      }
      stream.next();
      return 'string';
    }

    // Skip whitespace
    if (stream.eatSpace()) return null;

    // Line comment
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'lineComment';
    }

    // Block comment start
    if (stream.match('/*')) {
      state.inBlockComment = true;
      return 'blockComment';
    }

    // Multi-line note
    if (stream.match("'''")) {
      state.inNote = true;
      return 'string';
    }

    // Double-quoted string
    if (stream.peek() === '"') {
      stream.next();
      state.inString = true;
      return 'string';
    }

    // Single-quoted string
    if (stream.peek() === "'") {
      stream.next();
      state.inSingleString = true;
      return 'string';
    }

    // Keywords (block-level declarations)
    if (stream.match(/^(Table|Ref|Enum|TableGroup|Project|Note)\b/)) {
      return 'keyword';
    }

    // Sub-keywords
    if (stream.match(/^(indexes|as|null)\b/)) {
      return 'keyword';
    }

    // Constraints (inside brackets)
    if (stream.match(/^(pk|primary\s+key|not\s+null|unique|increment|default|ref|note)\b/i)) {
      return 'atom';
    }

    // Relationship operators
    if (stream.match(/^(<>|[<>\-])/) && !stream.match(/^\w/, false)) {
      return 'operator';
    }

    // Numbers
    if (stream.match(/^\d+(\.\d+)?/)) {
      return 'number';
    }

    // Common SQL types
    if (stream.match(/^(int|integer|bigint|smallint|tinyint|serial|bigserial|float|double|real|decimal|numeric|boolean|bool|varchar|char|text|blob|bytea|date|time|datetime|timestamp|timestamptz|uuid|json|jsonb|xml|money|inet|cidr|macaddr|bit|varbit|interval|point|line|polygon|circle|box|path|array)\b/i)) {
      return 'typeName';
    }

    // Brackets
    if (stream.match(/^[{}\[\]()]/)) {
      return 'bracket';
    }

    // Dot accessor
    if (stream.peek() === '.') {
      stream.next();
      return 'operator';
    }

    // Colon
    if (stream.peek() === ':') {
      stream.next();
      return 'operator';
    }

    // Identifiers
    if (stream.match(/^[a-zA-Z_]\w*/)) {
      return 'variableName';
    }

    // Consume any unrecognized character
    stream.next();
    return null;
  },
};

export const dbmlLanguage = StreamLanguage.define(dbmlParser);
