import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const roles = db.prepare('SELECT * FROM roles ORDER BY name ASC').all();
  res.json(roles);
});

export default router;
