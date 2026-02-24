import type { NextFunction, Request, Response } from "express";
import { NotFoundError } from "../core/errors/AppError";


export function notFoundHandler() {
    return (req: Request, res: Response, next: NextFunction) => {
        next(new NotFoundError(`Route ${req.method} ${req.path}`));
    };
}
