import type { NextFunction, Request, Response } from "express";
import { v4 as uuidv4 } from 'uuid';

export function requestId() {
    return (req: Request, res: Response, next: NextFunction) => {
        //check if request id already exists (maybe from load balancer)
        const existingId = req.headers['x-request-id'] || req.headers['x-correlaton-id'];

        req.id = typeof existingId === 'string' ? existingId : uuidv4();

        //Add request ID to response headers for debugging
        res.setHeader('x-request-id', req.id);

        next();
    }
}