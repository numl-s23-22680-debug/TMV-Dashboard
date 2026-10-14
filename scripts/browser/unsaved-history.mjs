import assert from "node:assert/strict";
import { browser, base, createFixturePage } from "./capture.mjs";

async function editRate(page) {
  const input = page.getByRole("spinbutton", { name: /1-person crew/ });
  await input.fill("49");
  await page.getByText("1 unsaved change", { exact: true }).waitFor();
  return input;
}
async function expectGuard(page, input) {
  await page
    .getByRole("dialog", { name: "Discard unsaved changes?" })
    .waitFor();
  assert.equal(
    new URL(page.url()).searchParams.get("section"),
    "configurations",
  );
  assert.equal(await input.inputValue(), "49");
}
const checks = [];
try {
  const back = await createFixturePage();
  try {
    await back.page.goto(base + "/admin?section=jobs", {
      waitUntil: "networkidle",
    });
    const jobsContext = new URL(back.page.url()).search;
    await back.page
      .getByRole("button", { name: "Settings", exact: true })
      .click();
    const input = await editRate(back.page);
    await back.page.goBack();
    await expectGuard(back.page, input);
    await back.page
      .getByRole("button", { name: "Keep editing", exact: true })
      .click();
    assert.equal(await input.inputValue(), "49");
    await back.page.goBack();
    await expectGuard(back.page, input);
    await back.page
      .getByRole("button", { name: "Discard and continue", exact: true })
      .click();
    await back.page
      .getByRole("heading", { name: "Jobs", exact: true })
      .waitFor();
    assert.equal(new URL(back.page.url()).search, jobsContext);
    checks.push(
      "Real Back keeps edits; repeated Back prompts; discard restores exact Jobs context.",
    );
  } finally {
    await back.context.close();
  }
  for (const decision of ["Keep editing", "Discard and continue"]) {
    const forward = await createFixturePage();
    try {
      await forward.page.goto(base + "/admin?section=configurations", {
        waitUntil: "networkidle",
      });
      await forward.page
        .getByRole("button", { name: "Jobs", exact: true })
        .click();
      await forward.page.goBack();
      const input = await editRate(forward.page);
      await forward.page.goForward();
      await expectGuard(forward.page, input);
      await forward.page
        .getByRole("button", { name: decision, exact: true })
        .click();
      if (decision === "Keep editing")
        assert.equal(await input.inputValue(), "49");
      else
        await forward.page
          .getByRole("heading", { name: "Jobs", exact: true })
          .waitFor();
      checks.push(`Real Forward prompts and honors ${decision}.`);
    } finally {
      await forward.context.close();
    }
  }
  console.log(JSON.stringify({ passed: checks }, null, 2));
} finally {
  await browser.close();
}
