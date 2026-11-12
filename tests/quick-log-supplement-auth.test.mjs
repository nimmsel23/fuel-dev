import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { createSupplementActions } = require("../functions/supplement-actions.js");

const OWN = "user-a";
const OTHER = "user-b";
const GOOD = "good-token";

function mockRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
  };
}

function mockReq({ token, body = {}, query } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  return {
    method: "POST",
    headers,
    body,
    query,
    get(name) {
      return headers[name.toLowerCase()];
    },
  };
}

function harness(verifyIdToken = async (token) => {
  if (token === GOOD) return { uid: OWN };
  const error = new Error("invalid");
  error.code = "auth/argument-error";
  throw error;
}) {
  const writes = [];
  let transactions = 0;
  const verified = [];

  function docRef(path) {
    return {
      path,
      collection(name) {
        return {
          doc(id) {
            return docRef(`${path}/${name}/${id}`);
          },
        };
      },
      async set(data, options) {
        writes.push({ path, data, options });
      },
    };
  }

  const db = {
    collection(name) {
      return {
        doc(id) {
          return docRef(`${name}/${id}`);
        },
      };
    },
    async runTransaction(fn) {
      transactions += 1;
      const tx = {
        async get() {
          return { exists: false, data: () => undefined };
        },
        set(ref, data, options) {
          writes.push({ path: ref.path, data, options });
        },
      };
      await fn(tx);
    },
  };

  const admin = {
    auth() {
      return {
        verifyIdToken(token) {
          verified.push(token);
          return verifyIdToken(token);
        },
      };
    },
    firestore() {
      return db;
    },
  };
  admin.firestore.FieldValue = { serverTimestamp: () => "SERVER_TIMESTAMP" };

  const actions = createSupplementActions({
    admin,
    getLocalDateParts: () => ({ date: "2026-11-12" }),
  });
  return { actions, writes, verified, transactions: () => transactions };
}

const item = { id: "mag", name: "Magnesium", dose: 400, unit: "mg", time_of_day: "morning" };

test("quickLogSupplement ohne Token antwortet 401 unauthenticated und schreibt nicht", async () => {
  const { actions, writes, verified, transactions } = harness();
  const res = mockRes();
  await actions.quickLogSupplement(
    mockReq({ body: { uid: OTHER, item, date: "2026-11-12", token: GOOD } }),
    res,
  );
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, "unauthenticated");
  assert.equal(verified.length, 0);
  assert.equal(transactions(), 0);
  assert.equal(writes.length, 0);
});

test("quickLogSupplement mit ungültigem Token antwortet 401", async () => {
  const { actions, writes, transactions } = harness();
  const res = mockRes();
  await actions.quickLogSupplement(mockReq({ token: "nope", body: { uid: OWN, item } }), res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, "unauthenticated");
  assert.equal(transactions(), 0);
  assert.equal(writes.length, 0);
});

test("quickLogSupplement lehnt eine fremde uid im Body mit 403 ab", async () => {
  const { actions, writes, verified, transactions } = harness();
  const res = mockRes();
  await actions.quickLogSupplement(
    mockReq({ token: GOOD, body: { uid: OTHER, item, date: "2026-11-12" }, query: { uid: OTHER } }),
    res,
  );
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, "permission-denied");
  assert.deepEqual(verified, [GOOD]);
  assert.equal(transactions(), 0);
  assert.equal(writes.length, 0);
});

test("quickLogSupplement schreibt mit gültigem Token nur unter die eigene uid", async () => {
  const { actions, writes } = harness();
  const res = mockRes();
  await actions.quickLogSupplement(
    mockReq({ token: GOOD, body: { uid: OWN, item, date: "2026-11-12" }, query: { uid: OTHER } }),
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].path, `supplements/${OWN}/logs/2026-11-12`);
  assert.equal(writes[0].data.intakes[0].supplement_id, "mag");
  assert.equal(JSON.stringify(writes[0]).includes(OTHER), false);
});

test("quickLogSupplement ignoriert eine fehlende Body-uid und nutzt die Token-uid", async () => {
  const { actions, writes } = harness();
  const res = mockRes();
  await actions.quickLogSupplement(mockReq({ token: GOOD, body: { item, date: "2026-11-12" } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(writes[0].path, `supplements/${OWN}/logs/2026-11-12`);
});

test("snoozeSupplement ohne Token 401, fremde uid 403, gültiges Token nur unter die eigene uid", async () => {
  const { actions, writes } = harness();

  const missing = mockRes();
  await actions.snoozeSupplement(mockReq({ body: { uid: OTHER, item_ids: ["mag"] } }), missing);
  assert.equal(missing.statusCode, 401);
  assert.equal(missing.body.code, "unauthenticated");

  const foreign = mockRes();
  await actions.snoozeSupplement(mockReq({ token: GOOD, body: { uid: OTHER, item_ids: ["mag"] } }), foreign);
  assert.equal(foreign.statusCode, 403);
  assert.equal(writes.length, 0);

  const ok = mockRes();
  await actions.snoozeSupplement(mockReq({ token: GOOD, body: { uid: OWN, item_ids: ["mag"] } }), ok);
  assert.equal(ok.statusCode, 200);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].path, `users/${OWN}/meta/supplement_snooze`);
  assert.equal(typeof writes[0].data.mag, "number");
});

test("index.js hängt beide Functions an die geprüften Handler und erlaubt Authorization", () => {
  const source = readFileSync(new URL("../functions/index.js", import.meta.url), "utf8");
  assert.match(source, /createSupplementActions\(\{ admin, getLocalDateParts \}\)/);
  assert.match(source, /withCors\(supplementActions\.quickLogSupplement\)/);
  assert.match(source, /withCors\(supplementActions\.snoozeSupplement\)/);
  assert.match(source, /Access-Control-Allow-Headers", "Content-Type, Authorization"/);
  assert.equal(source.includes("const { uid, item, date }"), false);
  assert.equal(source.includes("const { uid, item_ids }"), false);
});
