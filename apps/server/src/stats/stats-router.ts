import { GetAllStatsResponse } from '@koinsight/common/types';
import { Request, Response, Router } from 'express';
import { db } from '../knex';
import { BooksRepository } from '../books/books-repository';
import { StatsRepository } from './stats-repository';
import { StatsService } from './stats-service';

const router = Router();

router.get('/', async (_: Request, res: Response) => {
  const books = await BooksRepository.getAllWithData();
  const totalPagesRead = StatsService.totalPagesRead(books);

  const stats = await StatsRepository.getAll();
  const perMonth = StatsService.getPerMonthReadingTime(stats);
  const perDayOfTheWeek = StatsService.perDayOfTheWeek(stats);
  const mostPagesInADay = StatsService.mostPagesInADay(books, stats);
  const totalReadingTime = StatsService.totalReadingTime(stats);
  const longestDay = StatsService.longestDay(stats);
  const last7DaysReadTime = StatsService.last7DaysReadTime(stats);

  const response: GetAllStatsResponse = {
    stats,
    perMonth,
    perDayOfTheWeek,
    mostPagesInADay,
    totalReadingTime,
    longestDay,
    last7DaysReadTime,
    totalPagesRead,
  };

  res.status(200).json(response);
});

router.get('/devices', async (_req, res) => {
  try {
    const rows = await db('device as d')
      .leftJoin('book_device as bd', 'bd.device_id', 'd.id')
      .select(
        'd.model as name',
        db.raw("'ebook' as type"),
        db.raw('COALESCE(SUM(bd.total_read_time), 0) as totalTime'),
        db.raw('COALESCE(MAX(bd.last_open), 0) as lastActive')
      )
      .groupBy('d.id', 'd.model')
      .orderBy('totalTime', 'desc');

    res.json(
      rows.map((r) => ({
        name: r.name || 'Unknown device',
        type: 'ebook',
        totalTime: Number(r.totalTime),
        lastActive: Number(r.lastActive) * 1000,
      }))
    );
  } catch (err: any) {
    console.error('Devices stats error:', err);
    res.status(500).json({ error: 'Failed to fetch device stats' });
  }
});

router.get('/:book_md5', async (req: Request<{ book_md5: string }>, res: Response) => {
  const book_md5 = req.params.book_md5;
  const book = await StatsRepository.getByBookMD5(book_md5);
  res.status(200).json(book);
});

export { router as statsRouter };
