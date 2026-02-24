import type { PaginationOptions, PaginationResult } from "../types/types";
import type { QueryFilter, UpdateQuery } from "mongoose";
import mongoose, { Model } from "mongoose";
import { DatabaseError, NotFoundError } from "./errors/AppError";
import { AppLogger } from "./logging/logger";

export interface BaseServiceOptions {
    enableSoftDelete?: boolean;
    enableAuditFields?: boolean;
    defaultPageSize?: number;
    maxPageSize?: number;
}

export abstract class BaseService<
    TDocument extends mongoose.Document,
    TCreateInput = any,
    TUpdateInput = any
> {
    protected model: Model<TDocument>;
    protected modelName: string;
    protected options: BaseServiceOptions;

    constructor(
        model: Model<TDocument>,
        modelName: string,
        options: BaseServiceOptions = {}
    ) {
        this.model = model;
        this.modelName = modelName;
        this.options = {
            enableSoftDelete: false,
            enableAuditFields: false,
            defaultPageSize: 10,
            maxPageSize: 1000,
            ...options,
        };
    }

    // ---------------- CREATE ----------------
    protected async create(
        data: Partial<TDocument>
    ): Promise<TDocument> {
        try {
            const createData = this.options.enableAuditFields
                ? { ...data, createdAt: new Date(), updatedAt: new Date() }
                : data;

            const doc = await this.model.create(createData);
            return doc;
        } catch (error) {
            this.handleDatabaseError(error, "create");
        }
    }
    // ---------------- FIND ONE ----------------
    protected async findOne(
        filters: QueryFilter<TDocument>
    ): Promise<TDocument | null> {
        try {
            return await this.model.findOne(
                this.buildWhereClause(filters)
            );
        } catch (error) {
            this.handleDatabaseError(error, "findOne");
        }
    }

    // ---------------- FIND BY ID ----------------
    protected async findById(id: string): Promise<TDocument> {
        try {
            const doc = await this.model.findById(id);
            if (!doc) throw new NotFoundError(`${this.modelName} not found`);
            return doc;
        } catch (error) {
            this.handleDatabaseError(error, "findById");
        }
    }

    // ---------------- FIND MANY ----------------
    protected async findMany(
        filters: QueryFilter<TDocument> = {},
        pagination?: Partial<PaginationOptions>,
        sort?: Record<string, 1 | -1>
    ): Promise<PaginationResult<TDocument>> {
        try {
            const where = this.buildWhereClause(filters);
            const finalPagination = this.normalizePagination(pagination);

            const [data, total] = await Promise.all([
                this.model
                    .find(where)
                    .skip(finalPagination.offset)
                    .limit(finalPagination.limit)
                    .sort(sort || { createdAt: -1 }),

                this.model.countDocuments(where),
            ]);

            return this.buildPaginationResult(
                data,
                total,
                finalPagination
            );
        } catch (error) {
            this.handleDatabaseError(error, "findMany");
        }
    }

    // ---------------- EXISTS ----------------
    protected async exists(
        filters: QueryFilter<TDocument>
    ): Promise<boolean> {
        try {
            const count = await this.model.countDocuments(
                this.buildWhereClause(filters)
            );
            return count > 0;
        } catch (error) {
            this.handleDatabaseError(error, "exists");
        }
    }

    // ---------------- UPDATE BY ID ----------------
    protected async updateById(
        id: string,
        data: mongoose.UpdateQuery<TDocument>
    ): Promise<TDocument> {
        try {
            const updateData = this.options.enableAuditFields
                ? { ...data, updatedAt: new Date() }
                : data;

            const updated = await this.model.findByIdAndUpdate(
                id,
                updateData,
                { new: true }
            );

            if (!updated) {
                throw new NotFoundError(`${this.modelName} not found`);
            }

            return updated;
        } catch (error) {
            this.handleDatabaseError(error, "updateById");
        }
    }

    // ---------------- DELETE ----------------
    protected async deleteById(id: string): Promise<void> {
        try {
            if (this.options.enableSoftDelete) {
                await this.model.findByIdAndUpdate(id, {
                    deletedAt: new Date(),
                });
            } else {
                await this.model.findByIdAndDelete(id);
            }
        } catch (error) {
            this.handleDatabaseError(error, "deleteById");
        }
    }

    // ---------------- ERROR HANDLER ----------------
    private handleDatabaseError(error: any, operation: string): never {
        AppLogger.error(
            `Database error in ${this.modelName}.${operation}`,
            { error }
        );

        if (error.name === "CastError") {
            throw new DatabaseError("Invalid ID format");
        }

        if (error.code === 11000) {
            throw new DatabaseError("Duplicate field value");
        }

        throw new DatabaseError(
            `Database operation failed: ${this.modelName}.${operation}`,
            { originalError: error.message }
        );
    }

    // ---------------- PAGINATION ----------------
    private normalizePagination(
        pagination?: Partial<PaginationOptions>
    ): PaginationOptions {
        const page = Math.max(1, pagination?.page || 1);
        const limit = Math.min(
            this.options.maxPageSize!,
            Math.max(
                1,
                pagination?.limit || this.options.defaultPageSize!
            )
        );
        const offset = (page - 1) * limit;

        return { page, limit, offset };
    }

    private buildPaginationResult<T>(
        data: T[],
        total: number,
        pagination: PaginationOptions
    ): PaginationResult<T> {
        const totalPages = Math.ceil(total / pagination.limit);

        return {
            data,
            total,
            page: pagination.page,
            limit: pagination.limit,
            totalPages,
            hasNext: pagination.page < totalPages,
            hasPrevious: pagination.page > 1,
        };
    }

    protected buildWhereClause(
        filters: QueryFilter<TDocument>
    ): QueryFilter<TDocument> {
        if (this.options.enableSoftDelete) {
            return { ...filters, deletedAt: null };
        }
        return filters;
    }
}