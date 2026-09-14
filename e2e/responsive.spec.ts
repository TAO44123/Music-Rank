import { expect, test, type Locator, type Page } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { closeDatabase, db, users } from '@music-rank/database';

// The bug this suite exists to prevent: MUI's `secondaryAction` slot positions row
// actions absolutely, so they never occupy layout space. A row whose text column
// does not reserve that space renders the text *underneath* the buttons. Measuring
// the container element hides this — a container that stretches to full width
// reports a clean box while the glyphs inside it run under the action. So every
// assertion below measures the glyph boxes of individual text nodes with a Range.

const viewports = [
  { label: '320px phone', width: 320, height: 720 },
  { label: '375px phone', width: 375, height: 780 },
  { label: '414px phone', width: 414, height: 820 },
  { label: '600px tablet', width: 600, height: 900 },
  { label: '900px laptop', width: 900, height: 900 }
];

const lists = [
  { path: '/', list: 'Ranked songs' },
  { path: '/personal', list: 'My Top 10' },
  { path: '/practice', list: 'My Practice Library' }
] as const;

type Collision = { row: string; text: string; control: string; overlapX: number; overlapY: number };

// `measured` exists so an assertion cannot pass by measuring nothing: an empty
// list, a row whose text never resolved, or a selector that stopped matching all
// produce zero collisions, which is indistinguishable from a clean layout.
type Measurement = { rows: number; measured: number; collisions: Collision[] };

async function measure(list: Locator): Promise<Measurement> {
  await expect(list.getByRole('listitem').first()).toBeVisible();
  return list.evaluate((root) => {
    const isControl = (node: Element) => node.matches('button, a[href], input, textarea, select, [role="button"]');
    const found: Collision[] = [];
    const rows = Array.from(root.querySelectorAll('li'));
    let measured = 0;

    for (const row of rows) {
      const controls = Array.from(row.querySelectorAll('*')).filter(isControl);
      const controlBoxes = controls
        .map((control) => ({ label: (control.getAttribute('aria-label') ?? control.textContent ?? '').trim().slice(0, 40), rect: control.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 0 && rect.height > 0);

      const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.nodeValue?.trim() ?? '';
        if (!text) continue;
        if (controls.some((control) => control.contains(node))) continue;

        const range = document.createRange();
        range.selectNodeContents(node);
        for (const glyphs of Array.from(range.getClientRects())) {
          if (glyphs.width <= 0 || glyphs.height <= 0) continue;
          measured += 1;
          for (const { label, rect } of controlBoxes) {
            const overlapX = Math.min(glyphs.right, rect.right) - Math.max(glyphs.left, rect.left);
            const overlapY = Math.min(glyphs.bottom, rect.bottom) - Math.max(glyphs.top, rect.top);
            // Touching edges within one device pixel are not an overlap.
            if (overlapX > 1 && overlapY > 1) found.push({ row: (row.textContent ?? '').trim().slice(0, 40), text, control: label, overlapX: Math.round(overlapX), overlapY: Math.round(overlapY) });
          }
        }
      }
    }
    return { rows: rows.length, measured, collisions: found };
  });
}

// Reports what sticks out, not just by how much. "Overflows by 11px" is not
// actionable on its own, and the two scans below cover the two ways it happens:
// an element box wider than the viewport, and content overflowing an element
// that itself fits — a long unbreakable username inside a button, for instance,
// which no scan of element boxes would ever surface.
async function horizontalOverflow(page: Page): Promise<{ over: number; offenders: string[] }> {
  return page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    const offenders: string[] = [];
    const describe = (node: Element) => `<${node.tagName.toLowerCase()} class="${(node.className || '').toString().slice(0, 60)}">`;

    for (const node of Array.from(document.querySelectorAll('*'))) {
      if (node.scrollWidth - node.clientWidth > 1) offenders.push(`content overflows ${describe(node)} by ${node.scrollWidth - node.clientWidth}px: ${JSON.stringify((node.textContent || '').trim().slice(0, 40))}`);
    }

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.nodeValue?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of Array.from(range.getClientRects())) {
        if (rect.right <= limit + 0.5) continue;
        offenders.push(`text reaches ${Math.round(rect.right)}px inside ${describe(node.parentElement!)}: ${JSON.stringify(node.nodeValue.trim().slice(0, 40))}`);
      }
    }

    return { over: document.documentElement.scrollWidth - limit, offenders };
  });
}

let username = '';

test.afterEach(async () => {
  if (username) await db.delete(users).where(eq(users.username, username));
});

test.afterAll(async () => {
  await closeDatabase();
});

test('keeps every list readable and inside the viewport from 320px up', async ({ page }) => {
  // usernameSchema caps at 32 characters, so this exercises the widest account
  // label the contract can ever produce.
  username = `e2e_responsive_${Date.now()}`.padEnd(32, 'x').slice(0, 32);
  const password = 'correct horse battery staple';

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Register' }).click();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Display name').fill('E2E Responsive');
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('button', { name: `@${username}` })).toBeVisible();

  // 纤夫的爱 carries the longest artist string in the seed (尹相杰、于文华) and is the
  // row that first exposed the overlap, so both personal lists must contain it.
  for (const title of ['纤夫的爱', '涛声依旧']) {
    await page.getByLabel('Search songs or artists').fill(title);
    const row = page.getByRole('list', { name: 'Ranked songs' }).getByRole('listitem').filter({ hasText: title });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: /Top 10/ }).click();
    await row.getByRole('button', { name: /Practice/ }).click();
  }

  await page.goto('/practice');
  await page.getByRole('button', { name: 'Edit 纤夫的爱' }).click();
  await page.getByLabel('Note').fill('A long practice note that must never run under the row controls.');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('A long practice note that must never run under the row controls.')).toBeVisible();

  for (const viewport of viewports) {
    await test.step(viewport.label, async () => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const { path, list } of lists) {
        await page.goto(path);

        // `measure` waits for the first row. Both assertions must run after that:
        // `goto` resolves while the SPA has rendered no list at all, and measuring
        // that state reports on a page the user never sees.
        const { rows, measured, collisions } = await measure(page.getByRole('list', { name: list }));
        expect(rows, `${path} rendered no rows at ${viewport.label}`).toBeGreaterThan(0);
        expect(measured, `${path} produced no text to measure at ${viewport.label}`).toBeGreaterThan(0);
        expect(collisions, `${path} has text running under controls at ${viewport.label}`).toEqual([]);
        const overflow = await horizontalOverflow(page);
        const offenders = overflow.offenders.map((entry) => `  ${entry}`).join('\n');
        expect(overflow.over, `${path} overflows horizontally at ${viewport.label} by ${overflow.over}px\n${offenders}`).toBeLessThanOrEqual(0);
      }
    });
  }
});
