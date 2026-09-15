import { expect, test, type Page } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { closeDatabase, db, users } from '@music-rank/database';

// DESIGN-006 §4.4 caps the account button and truncates its label with an
// ellipsis, which required wrapping the label in a block with `overflow: hidden`
// (`AccountActions.tsx`). That clip box is only as tall as the label's line box,
// so it sits directly on top of the glyphs' descenders — and a username is the
// one string in this app that routinely ends up with a character drawn entirely
// below the baseline, because `usernameSchema` allows underscores.
//
// A clipped underscore does not fail any layout assertion: the element boxes are
// all correct, the text is present in the accessible name, and `toBeVisible`
// passes. `demo_user` simply reads as `demo user`. So this measures paint, not
// layout — it screenshots the label and counts dark pixels per row, then does the
// same with the clip removed. If the two disagree, something is cutting ink off.

const LABEL = 'header button span:not(.MuiButton-startIcon):not(.MuiTouchRipple-root)';

type Row = { y: number; dark: number };

async function inkRows(page: Page): Promise<Row[]> {
  const box = await page.locator(LABEL).boundingBox();
  if (!box) throw new Error('account label not found');
  // Padded past the label's own box on both sides: ink clipped *away* would
  // otherwise fall outside the capture and look like it was never painted.
  const clip = { x: Math.floor(box.x), y: Math.floor(box.y) - 4, width: Math.ceil(box.width), height: Math.ceil(box.height) + 10 };
  const png = await page.screenshot({ clip });

  return page.evaluate(async ({ url, top }) => {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;

    const rows: { y: number; dark: number }[] = [];
    for (let y = 0; y < canvas.height; y += 1) {
      let dark = 0;
      for (let x = 0; x < canvas.width; x += 1) {
        const i = (y * canvas.width + x) * 4;
        // The page background is a light cream; anything appreciably darker is ink.
        if (0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2] < 200) dark += 1;
      }
      rows.push({ y: y + top, dark });
    }
    return rows;
  }, { url: `data:image/png;base64,${png.toString('base64')}`, top: clip.y });
}

let username = '';

test.afterEach(async () => {
  if (username) await db.delete(users).where(eq(users.username, username));
});

test.afterAll(async () => {
  await closeDatabase();
});

// Device scale factor 1 is the case that matters: a descender is one physical
// pixel tall there, so it is the width at which a clip is most likely to take
// all of it.
test.use({ deviceScaleFactor: 1, viewport: { width: 1280, height: 900 } });

test('paints the underscores in a truncated account label', async ({ page }) => {
  username = 'e2e_under_score_probe';

  await page.goto('/');
  await page.getByRole('button', { name: 'Register' }).click();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Display name').fill('E2E Underscore');
  await page.getByLabel('Password').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('button', { name: `@${username}` })).toBeVisible();

  const clipped = await inkRows(page);
  await page.locator(LABEL).evaluate((element) => { element.style.overflow = 'visible'; });
  const unclipped = await inkRows(page);
  await page.locator(LABEL).evaluate((element) => { element.style.overflow = ''; });

  const lastInked = (rows: Row[]) => [...rows].reverse().find((row) => row.dark > 0);
  const painted = lastInked(clipped);
  const reference = lastInked(unclipped);

  // Guards against the assertion passing on an empty capture: a label that
  // rendered nothing at all has no inked rows, and "no difference between two
  // blank images" would otherwise read as success.
  expect(reference, 'label painted nothing with the clip removed').toBeDefined();
  expect(painted, 'label painted nothing').toBeDefined();

  // The underscores are the lowest ink in the label. If the clip box cut them
  // off, the clipped capture's last inked row sits above the unclipped one's.
  expect(painted!.y, 'overflow:hidden clipped the descenders off the account label').toBe(reference!.y);

  const totalInk = (rows: Row[]) => rows.reduce((sum, row) => sum + row.dark, 0);
  expect(totalInk(clipped), 'the clip removed ink from the account label').toBe(totalInk(unclipped));
});
