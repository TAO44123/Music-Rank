import { expect, test, type Page } from '@playwright/test';
import { eq, inArray } from 'drizzle-orm';
import { closeDatabase, db, groupMemberships, users } from '@music-rank/database';

const password = 'correct horse battery staple';
let usernames: string[] = [];
function account(label: string) {
  const username = `e2e_grp_${label}_${Date.now()}`.padEnd(32, 'x').slice(0, 32);
  usernames.push(username);
  return username;
}
async function fillAuth(page: Page, username: string, register = false) {
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Username').fill(username);
  if (register) await dialog.getByLabel('Display name').fill(username);
  await dialog.getByLabel('Password').fill(password);
  await dialog.getByRole('button', { name: register ? 'Create account' : 'Sign in', exact: true }).click();
}
test.afterEach(async () => {
  if (usernames.length) await db.delete(users).where(inArray(users.username, usernames));
  usernames = [];
});
test.afterAll(async () => { await closeDatabase(); });

test('ordinary registration joins, ordinary login does not backfill, and logged-in invitations join once', async ({ page }) => {
  const username = account('ordinary');
  await page.goto('/');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await fillAuth(page, username, true);
  await expect(page.getByRole('button', { name: `@${username}` })).toBeVisible();
  await expect(page).toHaveURL(/\/rankings\/[a-z0-9-]+$/);
  const membership = await page.request.get('/api/me/groups');
  expect(await membership.json()).toMatchObject([{ name: 'Default Group' }]);
  await page.goto('/groups');
  await expect(page.getByRole('list', { name: 'Group members' }).getByText(username, { exact: true })).toBeVisible();
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.username, username));
  // Only this test-created account is reset to model a pre-existing nonmember.
  await db.delete(groupMemberships).where(eq(groupMemberships.userId, user.id));
  await page.context().clearCookies();
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await fillAuth(page, username);
  await expect(page.getByRole('button', { name: `@${username}` })).toBeVisible();
  await expect(page).toHaveURL(/\/rankings\/[a-z0-9-]+$/);
  await page.goto('/groups');
  await expect(page.getByText('You have not joined any groups yet.')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Group members' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /join/i })).toHaveCount(0);
  await page.goto('/invite/default');
  await expect(page).toHaveURL(/\/groups$/);
  await expect(page.getByRole('heading', { name: 'Default Group' })).toBeVisible();
  await page.goto('/invite/default');
  await expect(page).toHaveURL(/\/groups$/);
  expect(await db.select().from(groupMemberships).where(eq(groupMemberships.userId, user.id))).toHaveLength(1);
  const songs = await (await page.request.get('/api/songs')).json();
  const song = songs.find((entry: { id: string }) => entry.id === '1c2a849c-0aef-4cac-a307-45674508f01c');
  expect(song).toBeDefined();
  const origin = { Origin: 'http://127.0.0.1:3101' };
  expect((await page.request.post('/api/me/top-list/items', { headers: origin, data: { songId: song.id } })).status()).toBe(201);
  expect((await page.request.put(`/api/me/singing-list/items/${song.id}`, { headers: origin, data: { status: 'PRACTICING', note: 'Owner private note' } })).status()).toBe(200);
  for (const list of ['top-list', 'singing-list']) {
    expect((await page.request.patch(`/api/me/lists/${list}/visibility`, {
      headers: { Origin: 'http://127.0.0.1:3101' }, data: { visibility: 'PRIVATE' }
    })).status()).toBe(200);
  }
  const memberLink = page.getByRole('list', { name: 'Group members' }).getByRole('link').filter({ hasText: username });
  await memberLink.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Top 10' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Practice Library' })).toBeVisible();
  await expect(page.getByLabel('Top 10 visibility: private')).toBeVisible();
  await expect(page.getByLabel('Practice Library visibility: private')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Top 10' }).getByText(song.title)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Practice Library' }).getByText(song.title)).toBeVisible();
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `test-results/owner-profile-${width}.png`, fullPage: true });
  }
  await page.getByRole('button', { name: 'View public display' }).click();
  await expect(page.getByText('Public profile not found', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Top 10' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to my profile' }).click();
  await expect(page.getByRole('region', { name: 'Top 10' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to group' }).click();
  await expect(page).toHaveURL(/\/groups$/);
  await page.goto(`/u/${username}`);
  await expect(page.getByRole('region', { name: 'Top 10' }).getByText(song.title)).toBeVisible();
  // The identical shared URL never grants a signed-out visitor private access.
  await page.context().clearCookies();
  await page.reload();
  await expect(page.getByText('Public profile not found', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Top 10' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Practice Library' })).toHaveCount(0);
});

test('invitation registration preserves intent and displays only another member’s public lists', async ({ page, request }) => {
  const owner = account('owner');
  const viewer = account('viewer');
  const registration = await request.post('/api/auth/register', { headers: { Origin: 'http://127.0.0.1:3101' }, data: { username: owner, displayName: owner, password } });
  expect(registration.status()).toBe(201);
  const songs = await (await request.get('/api/songs')).json();
  // Use a stable seeded song rather than another parallel test's submission.
  const song = songs.find((entry: { id: string }) => entry.id === '1c2a849c-0aef-4cac-a307-45674508f01c');
  expect(song).toBeDefined();
  const origin = { Origin: 'http://127.0.0.1:3101' };
  expect((await request.post('/api/me/top-list/items', { headers: origin, data: { songId: song.id } })).status()).toBe(201);
  expect((await request.put(`/api/me/singing-list/items/${song.id}`, { headers: origin, data: { status: 'PRACTICING', note: 'E2E group private note' } })).status()).toBe(200);
  expect(await (await request.get('/api/me/list-settings')).json()).toEqual({ topList: 'PUBLIC', singingList: 'PUBLIC' });
  expect((await request.patch('/api/me/lists/top-list/visibility', { headers: origin, data: { visibility: 'PRIVATE' } })).status()).toBe(200);

  await page.goto('/invite/default');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Join Default Group' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Group members' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByRole('button', { name: 'Already have an account? Sign in' }).click();
  await page.getByRole('button', { name: 'Need an account? Register' }).click();
  await fillAuth(page, viewer, true);
  await expect(page).toHaveURL(/\/groups$/);
  await page.getByRole('list', { name: 'Group members' }).getByText(owner, { exact: true }).click();
  await expect(page.getByRole('region', { name: 'Practice Library' }).getByText(song.title)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Top 10' })).toHaveCount(0);
  await expect(page.getByText('E2E group private note')).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to group' }).click();
  await expect(page.getByRole('list', { name: 'Group members' })).toBeVisible();
  await page.screenshot({ path: 'test-results/default-group-desktop.png', fullPage: true });
  for (const width of [320, 390, 600, 900]) {
    await page.setViewportSize({ width, height: 844 });
    const nav = page.getByRole('navigation', { name: width < 600 ? 'Primary bottom' : 'Primary', exact: true });
    await expect(nav.getByRole(width < 600 ? 'link' : 'tab', { name: 'Groups', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/default-group-mobile.png', fullPage: true });
  // Exercise actual selection-based copying when HTTP's async API is absent.
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { value: () => { throw new Error('Native sharing must not be called'); }, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });
  await page.getByRole('button', { name: 'Share invitation' }).click();
  await expect(page.getByRole('dialog', { name: 'Invite friends' })).toBeVisible();
  await expect.poll(() => page.getByRole('dialog', { name: 'Invite friends' }).evaluate((element) => getComputedStyle(element.parentElement!).opacity)).toBe('1');
  await expect(page.getByText('Copy the link to invite friends to Default Group.')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Invitation link', exact: true })).toHaveValue('http://127.0.0.1:3101/invite/default');
  await page.screenshot({ path: 'test-results/share-invitation-mobile.png' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: 'test-results/share-invitation-desktop.png' });
  await page.setViewportSize({ width: 320, height: 720 });
  await expect(page.getByRole('button', { name: 'Copy', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await page.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Link copied.');
  await page.evaluate(() => Reflect.deleteProperty(navigator, 'clipboard'));
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('http://127.0.0.1:3101/invite/default');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.context().clearCookies();
  await page.goto(`/u/${owner}`);
  await expect(page.getByRole('region', { name: 'Practice Library' }).getByText(song.title)).toBeVisible();
  await expect(page.getByText('E2E group private note')).toHaveCount(0);
});

test('an existing logged-out nonmember joins after invitation login', async ({ page, request }) => {
  const username = account('login');
  const registration = await request.post('/api/auth/register', { headers: { Origin: 'http://127.0.0.1:3101' }, data: { username, displayName: username, password } });
  expect(registration.status()).toBe(201);
  const { user } = await registration.json();
  await db.delete(groupMemberships).where(eq(groupMemberships.userId, user.id));
  await page.goto('/invite/default');
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await fillAuth(page, username);
  await expect(page).toHaveURL(/\/groups$/);
  await expect(page.getByRole('list', { name: 'Group members' }).getByText(username, { exact: true })).toBeVisible();
  expect(await db.select().from(groupMemberships).where(eq(groupMemberships.userId, user.id))).toHaveLength(1);
});
