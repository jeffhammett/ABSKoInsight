import { GetAllStatsResponse } from '@koinsight/common/types';
import { Request, Response, Router } from 'express';
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

router.get('/:book_md5', async (req: Request<{ book_md5: string }>, res: Response) => {
  const book_md5 = req.params.book_md5;
  const book = await StatsRepository.getByBookMD5(book_md5);
  res.status(200).json(book);
});

router.delete('/page-stats/:id', async (req: Request<{ id: string }>, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  await StatsRepository.blockPageStat(id);
  res.status(200).json({ message: 'Session blocked' });
});

export { router as statsRouter };
