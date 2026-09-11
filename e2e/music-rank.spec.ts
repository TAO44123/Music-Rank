import { expect, test } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { closeDatabase, db, users } from '@music-rank/database';

let username = '';

test.afterEach(async () => {
  if (username) await db.delete(users).where(eq(users.username, username));
});

test.afterAll(async () => {
  await closeDatabase();
});

test('registers, authenticates, publishes, and anonymously reads personal lists', async ({ page }) => {
  username = `e2e_listener_${Date.now()}`;
  const password = 'correct horse battery staple';

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Music Rank' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your lists are private to you' })).toBeVisible();

  await page.getByRole('button', { name: 'Register' }).click();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Display name').fill('E2E Listener');
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('button', { name: `@${username}` })).toBeVisible();

  await page.getByRole('button', { name: `@${username}` }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await page.getByRole('button', { name: 'Sign in' }).first().click();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).last().click();
  await expect(page.getByRole('button', { name: `@${username}` })).toBeVisible();

  await page.getByLabel('Search songs or artists').fill('涛声依旧');
  await expect(page.getByText('涛声依旧')).toBeVisible();
  await page.getByRole('button', { name: 'Add Top 10' }).click();
  await page.getByRole('button', { name: 'Add Singing' }).click();
  await page.getByRole('button', { name: 'Edit 涛声依旧' }).click();
  await page.getByLabel('Singing status').getByRole('button', { name: 'Practicing' }).click();
  await page.getByLabel('Note').fill('This remains private.');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.reload();
  await expect(page.getByRole('region', { name: 'My Top 10' }).getByText('涛声依旧')).toBeVisible();
  const singingEntry = page.getByRole('region', { name: 'My Singing List' }).getByRole('listitem').filter({ hasText: '涛声依旧' });
  await expect(singingEntry.getByText('Practicing', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Top 10 is private. Make public' }).click();
  await page.getByRole('button', { name: 'Make public' }).click();
  await expect(page.getByLabel('Top 10 visibility: public')).toBeVisible();
  await page.getByRole('button', { name: 'Singing List is private. Make public' }).click();
  await expect(page.getByText('Your Singing List notes always remain private.')).toBeVisible();
  await page.getByRole('button', { name: 'Make public' }).click();
  await expect(page.getByLabel('Singing List visibility: public')).toBeVisible();

  await page.getByRole('button', { name: `@${username}` }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await page.goto(`/u/${username}`);
  await expect(page.getByRole('heading', { name: 'E2E Listener' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Top 10' }).getByText('涛声依旧')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Singing List' }).getByText('Practicing')).toBeVisible();
  await expect(page.getByText('This remains private.')).not.toBeVisible();
});
