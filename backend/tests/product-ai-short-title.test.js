const assert = require('node:assert/strict');
const test = require('node:test');

require('ts-node/register/transpile-only');

const { createProductAiService } = require('../src/services/productAiService');

function createFakeKnex(initialRows = []) {
  let rows = [...initialRows];
  let nextId = rows.reduce((max, row) => Math.max(max, row.id || 0), 0) + 1;

  class FakeQuery {
    constructor(table) {
      this.table = table;
      this.filters = [];
    }

    where(criteria) {
      this.filters.push((row) =>
        Object.entries(criteria).every(([key, value]) => row[key] === value)
      );
      return this;
    }

    whereNot(column, value) {
      this.filters.push((row) => row[column] !== value);
      return this;
    }

    _filteredRows() {
      return rows.filter((row) => this.filters.every((filter) => filter(row)));
    }

    first() {
      return Promise.resolve(this._filteredRows()[0]);
    }

    update(updateData) {
      const matched = this._filteredRows();
      matched.forEach((row) => Object.assign(row, updateData));
      return Promise.resolve(matched.length);
    }

    insert(data) {
      const row = { ...data, id: data.id ?? nextId++ };
      rows.push(row);
      return Promise.resolve([row.id]);
    }
  }

  const knex = (table) => new FakeQuery(table);
  knex.fn = { now: () => new Date() };

  return {
    knex,
    getRows: () => rows,
  };
}

test('processProductAiJob persists short titles and emits completed payload', async () => {
  const { knex } = createFakeKnex();
  const events = [];
  const getIO = () => ({
    emit: (event, payload) => {
      events.push({ event, payload });
    },
  });

  const analyzeProductViaPython = async () => ({
    title: 'Short title',
    description: 'First sentence. Second sentence.',
    tags: [{ value: 'Cozy' }],
    captions: [],
    meta: {
      contractVersion: 'test',
      device: 'CPU',
      models: { tagger: 'clip', captioner: 'blip', llm: 'llm' },
      timings: {
        imageLoadMs: 1,
        taggerMs: 1,
        captionerMs: 1,
        llmMs: 1,
        totalMs: 4,
      },
    },
  });

  const service = createProductAiService({ knex, analyzeProductViaPython, getIO });

  const [jobId] = await knex('product_ai_jobs').insert({
    product_id: null,
    image_paths: JSON.stringify([]),
    price: 19.99,
    status: 'PENDING',
    result_display_name: null,
    result_description: null,
    result_tags: null,
    error_message: null,
    created_at: new Date(),
    updated_at: new Date(),
  });

  await service.processProductAiJob(jobId);

  const stored = await knex('product_ai_jobs').where({ id: jobId }).first();
  assert.equal(stored.status, 'SUCCESS');
  assert.equal(stored.result_display_name, 'Short title');
  assert.ok(stored.result_description);
  assert.ok(stored.result_tags);

  const completedEvents = events.filter((event) => event.event === 'aiJob:completed');
  assert.ok(completedEvents.length > 0);
  const payload = completedEvents[completedEvents.length - 1].payload;
  assert.equal(payload.status, 'SUCCESS');
  assert.equal(payload.resultDisplayName, 'Short title');
  assert.ok(payload.resultDescription);
});
