import { eq } from 'drizzle-orm';
import { db, closeDatabase } from './client.js';
import { demoUserId } from './config.js';
import { rankingEntries, rankings, songs, users } from './schema.js';

const rankingId = 'f73c2f9e-dfd1-4777-bc5a-d55f2a0db4ae';

const fixtures = [
  ['1c2a849c-0aef-4cac-a307-45674508f01c', '涛声依旧', '毛宁', 1993],
  ['22cbfd77-7dda-4f3f-a8f3-d001a13c826c', '我不想说', '杨钰莹', 1992],
  ['47d0ae76-7a88-4f7d-ab28-2652d9daebbe', '雾里看花', '那英', 1993],
  ['8e918b13-2c48-4caf-af88-2b92f9bece44', '同桌的你', '老狼', 1994],
  ['a80d386d-4a0e-4ca6-9d0a-6f8ce4f5106b', '祝你平安', '孙悦', 1994],
  ['fd94f558-a2d2-49e2-9a9c-1f2e86d6d7bb', '小芳', '李春波', 1993],
  ['13ba6493-c42f-4fd8-b805-02a12771ca8b', '懂你', '满文军', 1996],
  ['82ce9a2f-2a0c-4e6e-b585-afcc7e545a10', '执着', '田震', 1996],
  ['3b184b44-e0ef-4985-bf99-d7a61a0d1d25', '青藏高原', '李娜', 1994],
  ['1fd5bb6c-718e-46be-a7a5-fb3f694ffb1f', '中华民谣', '孙浩', 1995],
  ['f7dcedc9-1f9c-4d68-b288-f2c7947d9ba1', '霸王别姬', '屠洪刚', 1994],
  ['01aa35fd-2b01-42c7-a559-ee5ec71c4b66', '纤夫的爱', '尹相杰、于文华', 1993],
  ['a16486c2-d5c0-4889-a7ed-b7de05dc7d4b', '常回家看看', '陈红', 1999],
  ['df9693b4-1e54-498c-9822-a282573fb571', '你快回来', '孙楠', 1999],
  ['94d6075f-0ca2-407b-a9df-43e929a2a6ab', '相约一九九八', '那英、王菲', 1998],
  ['b1b0e375-a405-4930-bb39-3f05f08c2312', '相思', '毛阿敏', 1993],
  ['c795a307-2db9-483e-b645-338b6bfbc7e6', '弯弯的月亮', '刘欢', 1990],
  ['a29045d6-4c12-4d10-bcbe-14f44f712cb7', '好人一生平安', '李娜', 1990],
  ['59c8d148-a75e-41ff-b4f0-78a16417376e', '我热恋的故乡', '范琳琳', 1991],
  ['a31fae86-2d25-45b2-bbac-b59ef29e6af3', '牵挂你的人是我', '高林生', 1994],
  ['44e874b7-bc39-4ed4-bd4e-c2781ec97d5d', '九月九的酒', '陈少华', 1994],
  ['6e3c93aa-754d-4597-92f4-927dbd65d55d', '爱我中华', '宋祖英', 1991],
  ['1d55e0b1-3e1c-4077-ace5-681cb4818999', '梦里水乡', '江珊', 1994],
  ['aef263cf-2c3a-4376-b5fb-89120bcf6d91', '山不转水转', '那英', 1990],
  ['0662f8b7-26b2-4b42-bb3d-5f46f6de520a', '糊涂的爱', '王志文、江珊', 1994],
  ['451738e2-51b4-476e-a22e-00434c9e5acb', '昨夜星辰', '林淑容', 1990],
  ['e2ea75c1-4e5d-453e-8cc4-04aed8f8b39a', '心会跟爱一起走', '郭峰、陈洁仪', 1998],
  ['0d5f279a-f301-4f16-af07-a1d4c6adca88', '轻轻地告诉你', '杨钰莹', 1993],
  ['7c629e82-039c-4a4a-9e57-94853a7a1b54', '好大一棵树', '田震', 1990],
  ['bdb88978-7665-4984-91ec-8af0b46b3e9c', '千万次地问', '刘欢', 1993]
] as const;

const normalize = (value: string) => value.trim().toLocaleLowerCase();

try {
  await db.transaction(async (transaction) => {
    await transaction.insert(users).values({ id: demoUserId, displayName: 'Demo Listener' })
      .onConflictDoUpdate({ target: users.id, set: { displayName: 'Demo Listener', updatedAt: new Date() } });

    await transaction.insert(rankings).values({
      id: rankingId,
      title: '90s Mainland China Pop Songs',
      era: '1990s',
      sourceType: 'DEMO',
      sourceUrl: null,
      description: 'Fictional demo fixtures for exploring Music Rank.',
      isPublished: true,
      verifiedAt: null
    }).onConflictDoUpdate({
      target: rankings.id,
      set: { title: '90s Mainland China Pop Songs', era: '1990s', sourceType: 'DEMO', sourceUrl: null, description: 'Fictional demo fixtures for exploring Music Rank.', isPublished: true, updatedAt: new Date() }
    });

    for (const [id, title, artist, releaseYear] of fixtures) {
      await transaction.insert(songs).values({
        id,
        title,
        artist,
        releaseYear,
        verificationStatus: 'DEMO',
        normalizedTitle: normalize(title),
        normalizedArtist: normalize(artist)
      }).onConflictDoUpdate({
        target: songs.id,
        set: { title, artist, releaseYear, verificationStatus: 'DEMO', normalizedTitle: normalize(title), normalizedArtist: normalize(artist), updatedAt: new Date() }
      });
    }

    for (const [index, [songId]] of fixtures.entries()) {
      const entryId = `e${String(index + 1).padStart(7, '0')}-0000-4000-8000-000000000000`;
      await transaction.insert(rankingEntries).values({
        id: entryId,
        rankingId,
        songId,
        rank: index + 1,
        verificationStatus: 'DEMO'
      }).onConflictDoUpdate({
        target: rankingEntries.id,
        set: { rankingId, songId, rank: index + 1, verificationStatus: 'DEMO' }
      });
    }
  });

  console.log(JSON.stringify({ level: 'info', message: 'Demo data seeded', songCount: fixtures.length }));
} finally {
  await closeDatabase();
}
