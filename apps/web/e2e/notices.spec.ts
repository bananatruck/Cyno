import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("ships the upstream licence notices and linked licence text in the Pages artifact", async ({
  request,
}) => {
  for (const fileName of ["LICENSE", "THIRD_PARTY_NOTICES.md", "licenses/HeroUI-Apache-2.0.txt"]) {
    const response = await request.get(`/${fileName}`);
    expect(response.ok()).toBe(true);
    expect(await response.text()).toBe(
      fs.readFileSync(path.resolve(__dirname, "../../..", fileName), "utf8"),
    );
  }
});
