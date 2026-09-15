import { expect, test } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { closeDatabase, db, songs, users } from '@music-rank/database';

let username = '';
let submittedSongTitles: string[] = [];

test.afterEach(async () => {
  if (username) await db.delete(users).where(eq(users.username, username));
  for (const title of submittedSongTitles) await db.delete(songs).where(eq(songs.title, title));
  submittedSongTitles = [];
});

test.afterAll(async () => {
  await closeDatabase();
});

test('registers, authenticates, publishes, and anonymously reads personal lists', async ({ page }) => {
  username = `e2e_listener_${Date.now()}`;
  const password = 'correct horse battery staple';
  const personalSubmissionTitle = `E2E Personal ${username}`;
  const practiceSubmissionTitle = `E2E Practice ${username}`;
  submittedSongTitles = [personalSubmissionTitle, practiceSubmissionTitle];

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Music Rank' })).toBeVisible();
  await expect(page).toHaveURL(/\/rankings\/[a-z0-9-]+$/);
  const rankingPath = new URL(page.url()).pathname;
  await expect(page.getByRole('tab', { name: /Personal Ranking/ })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /Practice Library/ })).toHaveCount(0);

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
  await expect(page.getByRole('tab', { name: /Personal Ranking/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Practice Library/ })).toBeVisible();

  await page.getByLabel('Search songs or artists').fill('涛声依旧');
  await expect(page).toHaveURL(/\?q=/);
  await expect(page.getByText('涛声依旧')).toBeVisible();
  await page.getByRole('button', { name: 'Add Top 10' }).click();
  await page.getByRole('button', { name: 'Add Practice' }).click();

  await page.getByRole('tab', { name: /Personal Ranking/ }).click();
  await expect(page).toHaveURL(/\/personal$/);
  await expect(page.getByRole('region', { name: 'My Top 10' }).getByText('涛声依旧')).toBeVisible();
  await page.getByRole('button', { name: 'Can’t find a song? Add it here' }).click();
  await page.getByLabel('Song title').fill(personalSubmissionTitle);
  await page.getByLabel('Artist').fill('E2E Submitter');
  await page.getByRole('button', { name: 'Add song' }).click();
  await expect(page.getByRole('region', { name: 'My Top 10' }).getByText(personalSubmissionTitle)).toBeVisible();
  await page.getByRole('button', { name: 'Top 10 is private. Make public' }).click();
  await page.getByRole('button', { name: 'Make public' }).click();
  await expect(page.getByLabel('Top 10 visibility: public')).toBeVisible();

  await page.getByRole('tab', { name: /Practice Library/ }).click();
  await expect(page).toHaveURL(/\/practice$/);
  await page.getByRole('button', { name: 'Can’t find a song? Add it here' }).click();
  await page.getByLabel('Song title').fill(practiceSubmissionTitle);
  await page.getByLabel('Artist').fill('E2E Submitter');
  await page.getByRole('button', { name: 'Add song' }).click();
  await expect(page.getByRole('region', { name: 'My Practice Library' }).getByText(practiceSubmissionTitle)).toBeVisible();
  await page.getByRole('button', { name: 'Edit 涛声依旧' }).click();
  await page.getByLabel('Singing status').getByRole('button', { name: 'Practicing' }).click();
  await page.getByLabel('Note').fill('This remains private.');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.reload();
  await expect(page).toHaveURL(/\/practice$/);
  const practiceEntry = page.getByRole('region', { name: 'My Practice Library' }).getByRole('listitem').filter({ hasText: '涛声依旧' });
  await expect(practiceEntry.getByText('Practicing', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Practice Library is private. Make public' }).click();
  await expect(page.getByText('Your Practice Library notes always remain private.')).toBeVisible();
  await page.getByRole('button', { name: 'Make public' }).click();
  await expect(page.getByLabel('Practice Library visibility: public')).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/personal$/);
  await expect(page.getByRole('tab', { name: /Personal Ranking/ })).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('button', { name: `@${username}` }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL((url) => url.pathname === rankingPath);
  await expect(page.getByRole('dialog', { name: 'Sign in to Music Rank' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /Personal Ranking/ })).toHaveCount(0);

  await page.goto('/personal');
  await expect(page).toHaveURL((url) => url.pathname === rankingPath);
  await expect(page.getByRole('dialog', { name: 'Sign in to Music Rank' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.goto(`/u/${username}`);
  await expect(page.getByRole('heading', { name: 'E2E Listener' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Top 10' }).getByText('涛声依旧')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Top 10' }).getByText(personalSubmissionTitle)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Practice Library' }).getByText('Practicing')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Practice Library' }).getByText(practiceSubmissionTitle)).toBeVisible();
  await expect(page.getByText('This remains private.')).not.toBeVisible();

  await page.goto(`${rankingPath}?q=${encodeURIComponent(personalSubmissionTitle)}`);
  await expect(page.getByText('No songs found')).toBeVisible();
});
