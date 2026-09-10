import { expect, test } from '@playwright/test';

test.beforeEach(async ({ request }) => {
  const topList = await request.get('/api/me/top-list').then((response) => response.json());
  for (const entry of topList as Array<{ id: string }>) await request.delete(`/api/me/top-list/items/${entry.id}`);
  const singingList = await request.get('/api/me/singing-list').then((response) => response.json());
  for (const entry of singingList as Array<{ id: string }>) await request.delete(`/api/me/singing-list/items/${entry.id}`);
});

test.afterEach(async ({ request }) => {
  const topList = await request.get('/api/me/top-list').then((response) => response.json());
  for (const entry of topList as Array<{ id: string }>) await request.delete(`/api/me/top-list/items/${entry.id}`);
  const singingList = await request.get('/api/me/singing-list').then((response) => response.json());
  for (const entry of singingList as Array<{ id: string }>) await request.delete(`/api/me/singing-list/items/${entry.id}`);
});

test('builds, reorders, and persists a personal music list', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Music Rank' })).toBeVisible();
  await page.getByLabel('Search songs or artists').fill('涛声依旧');
  await expect(page.getByText('涛声依旧')).toBeVisible();
  await page.getByRole('button', { name: 'Add Top 10' }).click();
  await page.getByLabel('Search songs or artists').fill('我不想说');
  await page.getByRole('button', { name: 'Add Top 10' }).click();
  await page.getByRole('button', { name: 'Move 我不想说 up' }).click();
  await expect(page.getByRole('heading', { name: 'My Top 10' })).toContainText('My Top 10');
  await page.getByLabel('Search songs or artists').fill('涛声依旧');
  await page.getByRole('button', { name: 'Add Singing' }).click();
  await page.getByRole('button', { name: 'Edit 涛声依旧' }).click();
  await page.getByLabel('Singing status').getByRole('button', { name: 'Practicing' }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  const singingEntry = page.getByRole('region', { name: 'My Singing List' }).getByRole('listitem').filter({ hasText: '涛声依旧' });
  await expect(singingEntry.getByText('Practicing', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('list', { name: 'My Top 10' }).locator('li').first()).toContainText('我不想说');
  await expect(singingEntry.getByText('Practicing', { exact: true })).toBeVisible();
});
