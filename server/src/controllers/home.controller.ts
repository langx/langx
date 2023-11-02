import { Request, Response } from 'express';

export function welcome(req: Request, res: Response): Response {
  return res.status(200).json({ message: 'Welcome to languageXchange app.' });
}
