import {
  createEditor,
  toEqualDocument,
  doc,
  p,
  strong,
  table,
  tr as row,
  td,
  th,
  tdCursor,
  tdEmpty,
  thEmpty,
  blockquote,
  atomInline,
  atomBlock
} from '../test-helpers';
import { NodeSelection, TextSelection } from 'prosemirror-state';
import { Fragment } from 'prosemirror-model';
import {
  removeParentNodeOfType,
  replaceParentNodeOfType,
  removeSelectedNode,
  safeInsert,
  replaceSelectedNode,
  setParentNodeMarkup,
  selectParentNodeOfType,
  removeNodeBefore
} from '../src';

describe('transforms', () => {
  describe('removeParentNodeOfType', () => {
    it('should return an original transaction if there is no parent node of a given NodeType', () => {
      const { state: { schema, tr } } = createEditor(doc(p('<cursor>')));
      const newTr = removeParentNodeOfType(schema.nodes.table)(tr);
      expect(tr).toBe(newTr);
    });
    describe('when there is a p("one") before the table node and p("two") after', () => {
      it('should remove table and preserve p("one") and p("two")', () => {
        const { state: { schema, tr } } = createEditor(
          doc(p('one'), table(row(tdCursor)), p('two'))
        );
        const newTr = removeParentNodeOfType(schema.nodes.table)(tr);
        expect(newTr).not.toBe(tr);
        toEqualDocument(newTr.doc, doc(p('one'), p('two')));
      });
    });
  });

  describe('replaceParentNodeOfType', () => {
    it('should return an original transaction if there is no parent node of a given NodeType', () => {
      const { state: { schema, tr } } = createEditor(doc(p('<cursor>')));
      const node = schema.nodes.paragraph.createChecked({}, schema.text('new'));
      const newTr = replaceParentNodeOfType(schema.nodes.table, node)(tr);
      expect(tr).toBe(newTr);
    });
    it('should return an original transaction if replacing is not possible', () => {
      const { state: { schema, tr } } = createEditor(
        doc(p('one'), table(row(tdCursor)), p('two'))
      );
      const node = schema.text('new');
      const newTr = replaceParentNodeOfType(schema.nodes.table, node)(tr);
      expect(tr).toBe(newTr);
    });
    describe('when there is a p("one") before the table node and p("two") after', () => {
      it('should replace table with p("new") and preserve p("one") and p("two")', () => {
        const { state: { schema, tr } } = createEditor(
          doc(p('one'), table(row(tdCursor)), p('two'))
        );
        const node = schema.nodes.paragraph.createChecked(
          {},
          schema.text('new')
        );
        const newTr = replaceParentNodeOfType(schema.nodes.table, node)(tr);
        expect(newTr).not.toBe(tr);
        toEqualDocument(newTr.doc, doc(p('one'), p('new'), p('two')));
      });
    });
    describe('when there are tree paragraphs', () => {
      it('should replace the middle paragraph with p("new") and preserve p("one") and p("two")', () => {
        const { state: { schema, tr } } = createEditor(
          doc(p('one'), p('hello<cursor>there'), p('two'))
        );
        const node = schema.nodes.paragraph.createChecked(
          {},
          schema.text('new')
        );
        const newTr = replaceParentNodeOfType(schema.nodes.paragraph, node)(tr);
        expect(newTr).not.toBe(tr);
        toEqualDocument(newTr.doc, doc(p('one'), p('new'), p('two')));
      });
    });
    it('should be composable with other transforms', () => {
      const { state: { schema, tr } } = createEditor(
        doc(p('one'), table(row(td(p('hello<cursor>there')))), p('two'))
      );
      const { paragraph, table: tableNode } = schema.nodes;
      const node = paragraph.createChecked({}, schema.text('new'));

      const newTr = replaceParentNodeOfType(tableNode, node)(tr);
      expect(newTr).not.toBe(tr);
      toEqualDocument(newTr.doc, doc(p('one'), p('new'), p('two')));

      const newTr2 = removeParentNodeOfType(paragraph)(newTr);
      expect(newTr2).not.toBe(newTr);
      toEqualDocument(newTr2.doc, doc(p('one'), p('new')));
    });
  });

  describe('removeSelectedNode', () => {
    it('should return an original transaction if selection is not a NodeSelection', () => {
      const { state: { tr } } = createEditor(doc(p('one')));
      const newTr = removeSelectedNode(tr);
      expect(newTr).toBe(tr);
    });

    it('should remove selected inline node', () => {
      const { state: { tr } } = createEditor(
        doc(p('one<node>', atomInline(), 'two'))
      );
      const newTr = removeSelectedNode(tr);
      expect(newTr).not.toBe(tr);
      toEqualDocument(newTr.doc, doc(p('onetwo')));
    });

    it('should remove selected block node', () => {
      const { state } = createEditor(doc(p('one'), p('test'), p('two')));
      const tr = state.tr.setSelection(NodeSelection.create(state.doc, 5));
      const newTr = removeSelectedNode(tr);
      expect(newTr).not.toBe(tr);
      toEqualDocument(newTr.doc, doc(p('one'), p('two')));
    });
  });

  describe('safeInsert', () => {
    it('should insert a node if its allowed at the current cursor position', () => {
      const { state: { schema, tr } } = createEditor(doc(p('one<cursor>')));
      const node = schema.nodes.atomInline.createChecked();
      const newTr = safeInsert(node)(tr);
      expect(newTr).not.toBe(tr);
      toEqualDocument(newTr.doc, doc(p('one', atomInline())));
    });

    it('should insert a Fragment if its allowed at the current cursor position', () => {
      const { state: { schema, tr } } = createEditor(doc(p('one<cursor>')));
      const node = schema.nodes.atomInline.createChecked();
      const newTr = safeInsert(Fragment.from(node))(tr);
      expect(newTr).not.toBe(tr);
      toEqualDocument(newTr.doc, doc(p('one', atomInline())));
    });

    it('should insert a paragraph after the parent node if its not allowed at the cursor position and move cursor inside of the new paragraph', () => {
      const { state: { schema, tr } } = createEditor(
        doc(p(strong('zero'), 'o<cursor>ne'), p('three'))
      );
      const node = schema.nodes.paragraph.createChecked({}, schema.text('two'));
      const newTr = safeInsert(node)(tr);
      expect(newTr).not.toBe(tr);
      toEqualDocument(
        newTr.doc,
        doc(p(strong('zero'), 'one'), p('two'), p('three'))
      );
      expect(newTr.selection.$from.parent.textContent).toEqual('two');
    });

    it('should insert a Fragment after the parent node if its not allowed at the cursor position and move cursor inside of the new paragraph', () => {
      const { state: { schema, tr } } = createEditor(
        doc(p(strong('zero'), 'o<cursor>ne'), p('three'))
      );
      const node = schema.nodes.paragraph.createChecked({}, schema.text('two'));
      const newTr = safeInsert(Fragment.from(node))(tr);
      expect(newTr).not.toBe(tr);
      toEqualDocument(
        newTr.doc,
        doc(p(strong('zero'), 'one'), p('two'), p('three'))
      );
      expect(newTr.selection.$from.parent.textContent).toEqual('two');
    });

    it('should replace an empty parent paragraph with the given node', () => {
      const { state: { schema, tr } } = createEditor(
        doc(p('one'), p('<cursor>'), p('three'))
      );
      const node = schema.nodes.blockquote.createChecked(
        {},
        schema.nodes.paragraph.createChecked({}, schema.text('two'))
      );
      const newTr = safeInsert(Fragment.from(node))(tr);
      expect(newTr).not.toBe(tr);
      toEqualDocument(
        newTr.doc,
        doc(p('one'), blockquote(p('two')), p('three'))
      );
      expect(newTr.selection.$from.parent.textContent).toEqual('two');
    });

    it('should insert a node at position 0 (start of the doc) and move cursor inside of the new paragraph', () => {
      const { state: { schema, tr } } = createEditor(
        doc(p('one'), p('two<cursor>'))
      );
      const node = schema.nodes.paragraph.createChecked({}, schema.text('new'));
      const newTr = safeInsert(node, 0)(tr);
      expect(newTr).not.toBe(tr);
      toEqualDocument(newTr.doc, doc(p('new'), p('one'), p('two')));
      expect(newTr.selection.$from.parent.textContent).toEqual('new');
    });
    it('should insert a Fragment at position 0 (start of the doc) and move cursor inside of the new paragraph', () => {
      const { state: { schema, tr } } = createEditor(
        doc(p('one'), p('two<cursor>'))
      );
      const node = schema.nodes.paragraph.createChecked({}, schema.text('new'));
      const newTr = safeInsert(Fragment.from(node), 0)(tr);
      expect(newTr).not.toBe(tr);
      toEqualDocument(newTr.doc, doc(p('new'), p('one'), p('two')));
      expect(newTr.selection.$from.parent.textContent).toEqual('new');
    });
    it('should insert a node at position 1 and move cursor inside of the new paragraph', () => {
      const { state: { schema, tr } } = createEditor(
        doc(p('one'), p('two<cursor>'))
      );
      const node = schema.nodes.paragraph.createChecked({}, schema.text('new'));
      const newTr = safeInsert(node, 1)(tr);
      expect(newTr).not.toBe(tr);
      toEqualDocument(newTr.doc, doc(p('one'), p('new'), p('two')));
      expect(newTr.selection.$from.parent.textContent).toEqual('new');
    });
    it('should insert a node at position in between two nodes and move cursor inside of the new paragraph', () => {
      const { state: { schema, tr } } = createEditor(
        doc(p('one'), p('two<cursor>'))
      );
      const node = schema.nodes.paragraph.createChecked({}, schema.text('new'));
      const newTr = safeInsert(node, 5)(tr);
      expect(newTr).not.toBe(tr);
      toEqualDocument(newTr.doc, doc(p('one'), p('new'), p('two')));
      expect(newTr.selection.$from.parent.textContent).toEqual('new');
    });
  });

  describe('replaceSelectedNode', () => {
    it('should return an original transaction if current selection is not a NodeSelection', () => {
      const { state: { schema, tr } } = createEditor(doc(p('<cursor>')));
      const node = schema.nodes.paragraph.createChecked({}, schema.text('new'));
      const newTr = replaceSelectedNode(node)(tr);
      expect(tr).toBe(newTr);
    });
    it('should return an original transaction if replacing is not possible', () => {
      const { state } = createEditor(doc(p('one')));
      const tr = state.tr.setSelection(NodeSelection.create(state.doc, 0));
      const node = state.schema.text('new');
      const newTr = replaceSelectedNode(node)(tr);
      expect(tr).toBe(newTr);
    });

    it('should replace selected node with the given `node`', () => {
      const { state } = createEditor(doc(p('one'), p('test'), p('two')));
      const tr = state.tr.setSelection(NodeSelection.create(state.doc, 5));
      const node = state.schema.nodes.paragraph.createChecked(
        {},
        state.schema.text('new')
      );
      const newTr = replaceSelectedNode(node)(tr);
      expect(newTr).not.toBe(tr);
      toEqualDocument(newTr.doc, doc(p('one'), p('new'), p('two')));
    });
  });

  describe('setParentNodeMarkup', () => {
    it('should return an original transaction if there is not parent node of a given nodeType', () => {
      const { state: { schema, tr } } = createEditor(doc(p('<cursor>')));
      const newTr = setParentNodeMarkup(
        schema.nodes.blockquote,
        schema.nodes.paragraph
      )(tr);
      expect(tr).toBe(newTr);
    });

    it('should update nodeType', () => {
      const { state: { schema, tr } } = createEditor(
        doc(table(row(td(p('text<cursor>')))))
      );
      const newTr = setParentNodeMarkup(
        schema.nodes.table_cell,
        schema.nodes.table_header
      )(tr);
      expect(newTr).not.toBe(tr);
      toEqualDocument(newTr.doc, doc(table(row(th(p('text'))))));
    });

    it('should update attributes', () => {
      const { state } = createEditor(doc(table(row(td(p('text<cursor>'))))));
      const { schema: { nodes: { table_cell } } } = state;
      const newTr = setParentNodeMarkup(table_cell, null, {
        colspan: 5,
        rowspan: 7
      })(state.tr);
      expect(newTr).not.toBe(state.tr);
      newTr.doc.content.descendants(child => {
        if (child.type === table_cell) {
          expect(child.attrs).toEqual({
            colspan: 5,
            rowspan: 7,
            colwidth: null,
            pretty: true,
            ugly: false
          });
        }
      });
    });
  });

  describe('selectParentNodeOfType', () => {
    it('should return an original transaction if current selection is a NodeSelection', () => {
      const { state } = createEditor(doc(p('one')));
      const tr = state.tr.setSelection(NodeSelection.create(state.doc, 1));
      const newTr = selectParentNodeOfType(state.schema.nodes.paragraph)(tr);
      expect(tr).toBe(newTr);
    });
    it('should return an original transaction if there is no parent node of a given `nodeType`', () => {
      const { state: { tr, schema } } = createEditor(doc(p('one')));
      const newTr = selectParentNodeOfType(schema.nodes.table)(tr);
      expect(tr).toBe(newTr);
    });
    it('should return a new transaction that selects a parent node of a given `nodeType`', () => {
      const { state: { tr, schema } } = createEditor(doc(p('one')));
      const newTr = selectParentNodeOfType(schema.nodes.paragraph)(tr);
      expect(newTr).not.toBe(tr);
      expect(newTr.selection.node.type.name).toEqual('paragraph');
    });
    it('should return a new transaction that selects a parent node of a given `nodeType`, if `nodeType` an array', () => {
      const {
        state: { tr, schema: { nodes: { paragraph, table } } }
      } = createEditor(doc(p('one')));
      const newTr = selectParentNodeOfType([table, paragraph])(tr);
      expect(newTr).not.toBe(tr);
      expect(newTr.selection.node.type.name).toEqual('paragraph');
    });
  });

  describe('removeNodeBefore', () => {
    it('should return an original transaction if there is no nodeBefore', () => {
      const { state: { tr } } = createEditor(doc(p('<cursor>')));
      const newTr = removeNodeBefore(tr);
      expect(tr).toBe(newTr);
    });
    it('should a new transaction that removes nodeBefore if its a table', () => {
      const { state: { tr } } = createEditor(
        doc(p('one'), table(row(tdEmpty), row(tdEmpty)), '<cursor>', p('two'))
      );
      const newTr = removeNodeBefore(tr);
      expect(newTr).not.toBe(tr);
      toEqualDocument(newTr.doc, doc(p('one'), p('two')));
    });
    it('should a new transaction that removes nodeBefore if its a blockquote', () => {
      const { state: { tr } } = createEditor(
        doc(p('one'), blockquote(p('')), '<cursor>', p('two'))
      );
      const newTr = removeNodeBefore(tr);
      expect(newTr).not.toBe(tr);
      toEqualDocument(newTr.doc, doc(p('one'), p('two')));
    });
    it('should a new transaction that removes nodeBefore if its a leaf node', () => {
      const { state: { tr } } = createEditor(
        doc(p('one'), atomBlock(), '<cursor>', p('two'))
      );
      const newTr = removeNodeBefore(tr);
      expect(newTr).not.toBe(tr);
      toEqualDocument(newTr.doc, doc(p('one'), p('two')));
    });
  });
});
