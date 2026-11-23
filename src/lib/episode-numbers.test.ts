import assert from "node:assert/strict";
import { test, describe } from "node:test";
import {
  parseEpisodeNumber,
  seriesHasGaps,
  missingEpisodeNumbers,
  buildEpisodePlan,
  type ExistingEpisode,
} from "./episode-numbers";

function existing(numbers: number[]): ExistingEpisode[] {
  return numbers.map((n) => ({
    id: `id-${n}`,
    number: n,
    title: `Episode ${n}`,
    videoUrl: `/videos/e${n}.mp4`,
  }));
}

describe("parseEpisodeNumber", () => {
  test("recognizes common patterns", () => {
    assert.equal(parseEpisodeNumber("E01.mp4"), 1);
    assert.equal(parseEpisodeNumber("EP01.mp4"), 1);
    assert.equal(parseEpisodeNumber("ep12.webm"), 12);
    assert.equal(parseEpisodeNumber("第1集.mp4"), 1);
    assert.equal(parseEpisodeNumber("第 05 集.mp4"), 5);
    assert.equal(parseEpisodeNumber("01.mp4"), 1);
    assert.equal(parseEpisodeNumber("S01E01.mp4"), 1);
    assert.equal(parseEpisodeNumber("Show Name S01E08.mp4"), 8);
    assert.equal(parseEpisodeNumber("Episode 3.mp4"), 3);
    assert.equal(parseEpisodeNumber("drama-EP07-final.mp4"), 7);
    assert.equal(parseEpisodeNumber("clip_09.mp4"), 9);
  });

  test("returns null when no episode number is present", () => {
    assert.equal(parseEpisodeNumber("teaser.mp4"), null);
    assert.equal(parseEpisodeNumber("final-cut.webm"), null);
    assert.equal(parseEpisodeNumber("show-2024.mp4"), null);
  });
});

describe("gap detection", () => {
  test("12346789 is missing 5", () => {
    const nums = [1, 2, 3, 4, 6, 7, 8, 9];
    assert.equal(seriesHasGaps(nums), true);
    assert.deepEqual(missingEpisodeNumbers(nums), [5]);
  });

  test("continuous 1–8 has no gaps", () => {
    const nums = [1, 2, 3, 4, 5, 6, 7, 8];
    assert.equal(seriesHasGaps(nums), false);
    assert.deepEqual(missingEpisodeNumbers(nums), []);
  });
});

describe("buildEpisodePlan compaction", () => {
  test("12346789 becomes 1–8, with 6→5, 7→6, …", () => {
    const plan = buildEpisodePlan({
      existing: existing([1, 2, 3, 4, 6, 7, 8, 9]),
      incoming: [],
      compactGaps: true,
    });
    assert.deepEqual(
      plan.items.map((it) => [it.originalNumber, it.assignedNumber, it.shifted]),
      [
        [1, 1, false],
        [2, 2, false],
        [3, 3, false],
        [4, 4, false],
        [6, 5, true],
        [7, 6, true],
        [8, 7, true],
        [9, 8, true],
      ],
    );
    assert.deepEqual(plan.missingNumbers, [5]);
    assert.equal(plan.hasGaps, true);
    assert.equal(plan.items.find((it) => it.originalNumber === 6)?.title, "Episode 5");
  });

  test("continuous numbers stay unchanged when compacting", () => {
    const plan = buildEpisodePlan({
      existing: existing([1, 2, 3, 4, 5]),
      incoming: [],
      compactGaps: true,
    });
    assert.equal(plan.hasGaps, false);
    assert.equal(plan.willChange, false);
    assert.deepEqual(
      plan.items.map((it) => [it.originalNumber, it.assignedNumber, it.shifted]),
      [
        [1, 1, false],
        [2, 2, false],
        [3, 3, false],
        [4, 4, false],
        [5, 5, false],
      ],
    );
  });

  test("multiple gaps all shift forward", () => {
    const plan = buildEpisodePlan({
      existing: existing([1, 2, 4, 5, 8, 9]),
      incoming: [],
      compactGaps: true,
    });
    assert.deepEqual(plan.missingNumbers, [3, 6, 7]);
    assert.deepEqual(
      plan.items.map((it) => [it.originalNumber, it.assignedNumber, it.shifted]),
      [
        [1, 1, false],
        [2, 2, false],
        [4, 3, true],
        [5, 4, true],
        [8, 5, true],
        [9, 6, true],
      ],
    );
  });

  test("filenames without numbers use selection order", () => {
    const plan = buildEpisodePlan({
      existing: [],
      incoming: [
        { filename: "teaser.mp4" },
        { filename: "final-cut.mp4" },
        { filename: "bonus.webm" },
      ],
      compactGaps: true,
    });
    assert.deepEqual(
      plan.items.map((it) => [it.filename, it.sourceNumber, it.assignedNumber, it.parseFailed]),
      [
        ["teaser.mp4", null, 1, true],
        ["final-cut.mp4", null, 2, true],
        ["bonus.webm", null, 3, true],
      ],
    );
  });

  test("merges incoming files with existing episodes then compacts", () => {
    const plan = buildEpisodePlan({
      existing: existing([1, 2, 3, 4, 6]),
      incoming: [{ filename: "EP07.mp4" }, { filename: "S01E09.mp4" }],
      compactGaps: true,
    });
    // existing 1,2,3,4,6 + new 7,9 → missing 5,8 → compact to 1–7
    assert.deepEqual(plan.missingNumbers, [5, 8]);
    const rows = plan.items.map((it) => ({
      kind: it.kind,
      original: it.originalNumber,
      assigned: it.assignedNumber,
      shifted: it.shifted,
      filename: it.filename || null,
    }));
    assert.deepEqual(rows, [
      { kind: "existing", original: 1, assigned: 1, shifted: false, filename: null },
      { kind: "existing", original: 2, assigned: 2, shifted: false, filename: null },
      { kind: "existing", original: 3, assigned: 3, shifted: false, filename: null },
      { kind: "existing", original: 4, assigned: 4, shifted: false, filename: null },
      { kind: "existing", original: 6, assigned: 5, shifted: true, filename: null },
      { kind: "new", original: 7, assigned: 6, shifted: true, filename: "EP07.mp4" },
      { kind: "new", original: 9, assigned: 7, shifted: true, filename: "S01E09.mp4" },
    ]);
  });

  test("compactGaps=false keeps original numbers including holes", () => {
    const plan = buildEpisodePlan({
      existing: existing([1, 2, 3, 4, 6, 7, 8, 9]),
      incoming: [],
      compactGaps: false,
    });
    assert.equal(plan.hasGaps, true);
    assert.equal(plan.willChange, false);
    assert.deepEqual(
      plan.items.map((it) => [it.originalNumber, it.assignedNumber, it.shifted]),
      [
        [1, 1, false],
        [2, 2, false],
        [3, 3, false],
        [4, 4, false],
        [6, 6, false],
        [7, 7, false],
        [8, 8, false],
        [9, 9, false],
      ],
    );
  });

  test("unparsed files take the smallest unused numbers, then compact", () => {
    const plan = buildEpisodePlan({
      existing: existing([1, 2, 3]),
      incoming: [{ filename: "extra-a.mp4" }, { filename: "EP08.mp4" }, { filename: "extra-b.mp4" }],
      compactGaps: true,
    });
    // unparsed extra-a → 4, EP08 → 8, extra-b → 5; missing 6,7; compact 1–6
    const rows = plan.items.map((it) => [it.filename || `existing-${it.originalNumber}`, it.originalNumber, it.assignedNumber]);
    assert.deepEqual(rows, [
      ["existing-1", 1, 1],
      ["existing-2", 2, 2],
      ["existing-3", 3, 3],
      ["extra-a.mp4", 4, 4],
      ["extra-b.mp4", 5, 5],
      ["EP08.mp4", 8, 6],
    ]);
    assert.equal(plan.items.find((it) => it.filename === "EP08.mp4")?.shifted, true);
  });
});
