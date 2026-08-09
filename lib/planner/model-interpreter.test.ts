import assert from "node:assert/strict";
import test from "node:test";
import {
  parseModelJson,
  parseModelInterpretation,
  type ModelInterpretation,
} from "./model-interpreter-core";

test("parses JSON wrapped in markdown fences", () => {
  assert.deepEqual(
    parseModelJson('```json\n{"relevant":true,"answer":"start"}\n```'),
    { relevant: true, answer: "start" },
  );
});

test("accepts a custom theme returned by the model", () => {
  const parsed = parseModelInterpretation(
    {
      relevant: true,
      answer: "construction-site",
      themeName: "Construction Site",
      themeTags: ["construction", "trucks", "yellow", "black"],
      reply: "A Construction Site party sounds brilliant! 🚧",
    } satisfies ModelInterpretation,
    "theme",
  );

  assert.deepEqual(parsed, {
    relevant: true,
    answer: "construction-site",
    themeName: "Construction Site",
    themeTags: ["construction", "trucks", "yellow", "black"],
    reply: "A Construction Site party sounds brilliant! 🚧",
  });
});

test("rejects out-of-range structured answers", () => {
  assert.equal(
    parseModelInterpretation(
      { relevant: true, answer: "9001", themeName: null, themeTags: [], reply: null },
      "budget",
    ).relevant,
    false,
  );
});

test("sanitizes custom theme identifiers and tags", () => {
  const parsed = parseModelInterpretation(
    {
      relevant: true,
      answer: "  Construction PARTY!!! ",
      themeName: "  Construction Party  ",
      themeTags: [" Construction ", "TRUCKS", "", "construction"],
      reply: null,
    },
    "theme",
  );

  assert.equal(parsed.answer, "construction-party");
  assert.equal(parsed.themeName, "Construction Party");
  assert.deepEqual(parsed.themeTags, ["construction", "trucks"]);
});
